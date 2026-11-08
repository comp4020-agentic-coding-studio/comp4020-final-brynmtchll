import { describe, expect, inject, it } from "vitest";

// Said's promises, checked over HTTP against the running app. These join
// people and say things, so they run against a local or CI app (a throwaway
// /data) and skip against the live one unless SPEC_WRITES=1 says otherwise.
// Every room is at /r/<slug>/; the open room's slug is "main", and what's
// below talks to it unless it says which.
const baseUrl = inject("baseUrl");
const writable = /\/\/(localhost|127\.0\.0\.1)[:/]/.test(baseUrl) || process.env.SPEC_WRITES === "1";

type Said = { id: number; name: string; text: string; words: Record<string, unknown>[]; at: number };

// a word as the page sends it, with ordinary numbers unless a test says otherwise
const word = (w: string, start: number, extra: Record<string, unknown> = {}) => ({
  w,
  start,
  end: start + 0.3,
  loud: 0,
  pitch: 0,
  rise: 0,
  stretch: 0,
  ...extra,
});

// a person with their own cookie, as a separate browser would be
async function person() {
  let cookie = "";
  const name = `spec-${Math.random().toString(36).slice(2, 10)}`;
  const join = await fetch(new URL("/join", baseUrl), {
    method: "POST",
    body: new URLSearchParams({ name }),
    redirect: "manual",
  });
  cookie = join.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookie, "joining should hand back a cookie").not.toBe("");
  const say = (payload: unknown, room = "main") =>
    fetch(new URL(`/r/${room}/say`, baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    });
  const page = async (room = "main") => (await fetch(new URL(`/r/${room}/`, baseUrl), { headers: { cookie } })).text();
  return { name, cookie, say, page };
}

// An open page's live stream. One reader collects every message event as it
// comes; waitFor resolves with the first one that mentions `needle`,
// whether it came before or after the call, so several can wait at once.
function listen(headers: Record<string, string> = {}, query = "", room = "main") {
  const controller = new AbortController();
  const ready = fetch(new URL(`/r/${room}/events${query}`, baseUrl), { headers, signal: controller.signal });
  const seen: { id: number; type: string }[] = [];
  const waiting = new Set<() => void>();
  const reading = (async () => {
    const res = await ready;
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += value;
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const lines = buffer.slice(0, cut).split("\n");
          const data = lines.find((l) => l.startsWith("data: "));
          const type = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "message";
          buffer = buffer.slice(cut + 2);
          if (data) seen.push({ ...JSON.parse(data.slice(6)), type });
          for (const wake of waiting) wake();
        }
      }
    } catch {
      // closed
    }
  })();
  const waitFor = (needle: string, ms = 3000): Promise<{ id: number; type: string; name?: string }> =>
    new Promise((resolve, reject) => {
      const check = (): void => {
        const found = seen.find((e) => JSON.stringify(e).includes(needle));
        if (!found) return;
        waiting.delete(check);
        clearTimeout(timer);
        resolve(found);
      };
      const timer = setTimeout(() => {
        waiting.delete(check);
        reject(new Error(`"${needle}" didn't arrive within ${ms} ms`));
      }, ms);
      waiting.add(check);
      check();
    });
  // the first event (since listening) that passes a test, waiting for one
  const waitUntil = (test: (e: Record<string, unknown>) => boolean, ms = 3000): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const check = (): void => {
        const found = seen.find((e) => test(e as Record<string, unknown>));
        if (!found) return;
        waiting.delete(check);
        clearTimeout(timer);
        resolve(found as Record<string, unknown>);
      };
      const timer = setTimeout(() => {
        waiting.delete(check);
        reject(new Error(`nothing passing the test arrived within ${ms} ms`));
      }, ms);
      waiting.add(check);
      check();
    });
  return {
    ready,
    waitFor,
    waitUntil,
    close: () => {
      controller.abort();
      void reading;
    },
  };
}

const messages = async (room = "main"): Promise<Said[]> =>
  ((await (await fetch(new URL(`/r/${room}/api/messages`, baseUrl))).json()) as { messages: Said[] }).messages;
// a page open on a room from now, as a browser opening it would (the page
// says where it was drawn up to)
const newest = async (): Promise<number> => Math.max(0, ...(await messages()).map((m) => m.id));

describe.skipIf(!writable)("a room", () => {
  it("remembers who you are when you come back, in every room", async () => {
    const p = await person();
    expect(await p.page()).toContain(`data-me="${p.name}"`);
    expect(await (await fetch(new URL("/", baseUrl), { headers: { cookie: p.cookie } })).text()).toContain(`>${p.name}</strong> on this browser`);
  });

  it("gives everyone their own colour, the same on every page, and a different one from the person before", async () => {
    const [a, b] = [await person(), await person()];
    await a.say({ words: [word("colour", 0)] });
    await b.say({ words: [word("mine", 0)] });
    const hue = (page: string, name: string) => page.match(new RegExp(`class="turn[^"]*" data-name="${name}"[^>]*style="--hue:(\\d+)"`))?.[1];
    const [fromA, fromB] = [await a.page(), await b.page()];
    expect(hue(fromA, a.name)).toBeDefined();
    expect(hue(fromB, a.name)).toEqual(hue(fromA, a.name));
    expect(hue(fromB, b.name)).not.toEqual(hue(fromB, a.name));
    // your own turns are marked yours, nobody else's
    expect(fromB).toMatch(new RegExp(`class="turn mine" data-name="${b.name}"`));
    expect(fromB).toMatch(new RegExp(`class="turn" data-name="${a.name}"`));
  });

  it("sends each phrase with what a page needs to show it and read it aloud", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const stamp = Date.now();
    await p.say({ words: [word(`first${stamp}`, 0.2), word("second", 0.9, { loud: 7.6, pitch: -3.2, stretch: 0.44, rise: 4.2 })] });
    const e = (await watcher.waitFor(`first${stamp}`)) as unknown as { name: string; hue: number; at: number; words: { html: string; t: number; d: number; say: number[] }[] };
    expect(e.name).toBe(p.name);
    expect(e.hue).toBeGreaterThanOrEqual(0);
    expect(e.hue).toBeLessThan(360);
    expect(e.at).toBeGreaterThan(0);
    expect(e.words.map((w) => [w.t, w.d])).toEqual([[0.2, 0.3], [0.9, 0.3]]);
    expect(e.words[1].html).toContain("second");
    expect(e.words[1].html).toContain("--loud:7.6");
    // how each was said, for reading it aloud: louder, lower, a little drawn
    // out, rising through it
    expect(e.words.map((w) => w.say)).toEqual([[0, 0, 0, 0], [8, -3, 0.4, 4]]);
    watcher.close();
  });

  it("shows what one person says on every other open page within a second, without a reload", async () => {
    const watcher = listen();
    await watcher.ready;
    const speaker = await person();
    const marker = `live${Date.now()}`;
    const started = performance.now();
    const arrived = watcher.waitFor(marker);
    expect((await speaker.say({ words: [word(marker, 0)] })).status).toBe(201);
    const event = await arrived;
    expect(performance.now() - started).toBeLessThan(1000);
    expect(event.name).toBe(speaker.name);
    watcher.close();
  });

  it("gets everyone's words to every open page when several speak at the same moment", async () => {
    const watchers = [listen(), listen(), listen()];
    await Promise.all(watchers.map((w) => w.ready));
    const speakers = await Promise.all([person(), person(), person(), person()]);
    const stamp = Date.now();
    const said = speakers.map((_, i) => `together${i}x${stamp}`);
    const arrivals = watchers.flatMap((w) => said.map((m) => w.waitFor(m)));
    const statuses = await Promise.all(speakers.map((p, i) => p.say({ words: [word(said[i], 0)] }).then((r) => r.status)));
    expect(statuses).toEqual([201, 201, 201, 201]);
    const got = await Promise.allSettled(arrivals);
    expect(got.filter((g) => g.status === "rejected")).toHaveLength(0);
    for (const w of watchers) w.close();
  });

  it("keeps the transcript, in order, by whom, for whoever opens the room later", async () => {
    const p = await person();
    const stamp = Date.now().toString(36);
    for (const w of [`hello${stamp}`, "there", "friend"]) await p.say({ words: [word(w, 0)] });
    // a stranger, with no name and no page open before, reads it all, in order
    const page = await (await fetch(new URL("/r/main/", baseUrl))).text();
    const at = (s: string) => page.indexOf(s);
    expect(at(`hello${stamp}`)).toBeGreaterThan(-1);
    expect(at(`hello${stamp}`)).toBeLessThan(at(`>there<`, ));
    // one turn: one name, the three phrases in it
    const turn = page.slice(page.lastIndexOf(`data-name="${p.name}"`, at(`hello${stamp}`)));
    expect(turn.slice(0, turn.indexOf("</li>"))).toMatch(new RegExp(`hello${stamp}[\\s\\S]*there[\\s\\S]*friend`));
    // and as text, to take away
    const txt = await fetch(new URL("/r/main/transcript.txt", baseUrl));
    expect(txt.headers.get("content-disposition")).toMatch(/attachment; filename="main-\d{4}-\d\d-\d\d\.txt"/);
    expect(await txt.text()).toMatch(new RegExp(`${p.name}\\n.*hello${stamp}\\nthere\\nfriend`));
  });

  it("catches a page up on what it missed when it reconnects, or while it loaded", async () => {
    const p = await person();
    const first = (await (await p.say({ words: [word("before", 0)] })).json()) as { id: number };
    const missed = `missed${Date.now()}`;
    await p.say({ words: [word(missed, 0)] });
    // the browser sends Last-Event-ID itself when it reconnects
    const back = listen({ "last-event-id": String(first.id) });
    expect((await back.waitFor(missed)).id).toBeGreaterThan(first.id);
    back.close();
    // a page drawn with `first` as its newest opens its stream from there
    const late = listen({}, `?after=${first.id}`);
    expect((await late.waitFor(missed)).id).toBeGreaterThan(first.id);
    late.close();
  });

  it("says where a page is up to, so dropping before anything's said, or again after, neither loses nor repeats", async () => {
    const p = await person();
    const first = (await (await p.say({ words: [word("one", 0)] })).json()) as { id: number };
    const second = (await (await p.say({ words: [word("two", 0)] })).json()) as { id: number };
    const controller = new AbortController();
    const res = await fetch(new URL("/r/main/events", baseUrl), { headers: { "last-event-id": String(first.id) }, signal: controller.signal });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let head = "";
    while (!head.includes(": listening")) head += (await reader.read()).value;
    controller.abort();
    expect(head.match(/^id: (\d+)/gm)?.at(-1)).toBe(`id: ${second.id}`);
    // a page that drops before anything's said: back from where it was
    const fresh = new AbortController();
    const r2 = await fetch(new URL(`/r/main/events?after=${second.id}`, baseUrl), { signal: fresh.signal });
    const rd = r2.body!.pipeThrough(new TextDecoderStream()).getReader();
    let h2 = "";
    while (!h2.includes(": listening")) h2 += (await rd.read()).value;
    fresh.abort();
    const blip = `blip${Date.now()}`;
    await p.say({ words: [word(blip, 0)] });
    const again = listen({ "last-event-id": h2.match(/^id: (\d+)/m)![1] });
    expect((await again.waitFor(blip)).type).toBe("said");
    await expect(again.waitFor(`"text":"two"`, 300)).rejects.toThrow();
    again.close();
  });

  it("keeps a queue of hands up to speak, in the order raised, the same on every page, until each has spoken", async () => {
    const watcher = listen();
    await watcher.ready;
    const [a, b] = [await person(), await person()];
    const hand = (cookie: string, up: unknown) =>
      fetch(new URL("/r/main/hand", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ up }) });
    const ours = (e: Record<string, unknown>): string[] => (e.queue as string[]).filter((n) => n === a.name || n === b.name);
    const queued = (want: string[]) => watcher.waitUntil((e) => e.type === "hand" && JSON.stringify(ours(e)) === JSON.stringify(want));
    expect(await (await hand(a.cookie, true)).json()).toMatchObject({ queue: expect.arrayContaining([a.name]) });
    await queued([a.name]);
    await hand(b.cookie, true);
    // raising it again doesn't move you to the back
    expect(ours((await (await hand(a.cookie, true)).json()) as Record<string, unknown>)).toEqual([a.name, b.name]);
    await queued([a.name, b.name]);
    // a later page shows it too
    const page = await b.page();
    expect(page).toMatch(/class="queue" id="queue" aria-live="polite">/);
    expect(page).toMatch(/aria-pressed="true"><span aria-hidden="true">✋<\/span> <span class="hand-label">Lower hand/);
    // having your say takes your hand down (but not what arrives just after
    // it went up: that was said before)
    await a.say({ words: [word("earlier", 0)] });
    await new Promise((r) => setTimeout(r, 400));
    expect(ours((await (await hand(b.cookie, true)).json()) as Record<string, unknown>)).toEqual([a.name, b.name]);
    await new Promise((r) => setTimeout(r, 3000));
    await a.say({ words: [word("thanks", 0)] });
    await queued([b.name]);
    expect((await hand(b.cookie, "maybe")).status).toBe(400);
    await hand(b.cookie, false);
    await queued([]);
    expect((await fetch(new URL("/r/main/hand", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: '{"up":true}' })).status).toBe(401);
    // without the page's script, the button's form does it, and comes back
    const viaForm = await fetch(new URL("/r/main/hand", baseUrl), { method: "POST", headers: { cookie: b.cookie }, body: new URLSearchParams({ up: "true" }), redirect: "manual" });
    expect(viaForm.status).toBe(303);
    await hand(b.cookie, false);
    watcher.close();
  }, 15_000);

  it("shows who's here now on every page, and takes them off a little after their last page closes", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const theirs = listen({ cookie: p.cookie });
    await theirs.ready;
    await watcher.waitUntil((e) => e.type === "here" && (e.here as { name: string }[]).some((h) => h.name === p.name));
    theirs.close();
    // (a reload isn't leaving: they stay a few seconds)
    await watcher.waitUntil((e) => e.type === "here" && !(e.here as { name: string }[]).some((h) => h.name === p.name) && (e as { t?: number }).t === undefined, 14_000);
    watcher.close();
  }, 20_000);

  // What each person may change is decided on the server, from the cookie
  // alone: nothing a page sends can make a word someone else's.
  it("credits what's said to whoever's cookie sent it, whatever name the request claims", async () => {
    const [a, b] = [await person(), await person()];
    const stamp = `claim${Date.now()}`;
    await a.say({ name: b.name, person: b.name, words: [word(stamp, 0, { name: b.name })] });
    expect((await messages()).find((m) => m.text === stamp)!.name).toBe(a.name);
  });

  // Correcting your own words after you've said them, live; nobody else's.
  const editAs = (cookie: string, body: unknown) =>
    fetch(new URL("/r/main/edit", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("lets you correct a word you've said, live for everyone, keeping how you said it", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const stamp = `there${Date.now()}`;
    const { id } = (await (await p.say({ words: [word("over", 0), word(stamp, 0.4, { loud: 9 })] })).json()) as { id: number };
    expect((await editAs(p.cookie, { id, index: 1, text: "their" })).status).toBe(200);
    const changed = (await watcher.waitFor(`"text":"over their"`)) as unknown as { type: string; words: { html: string }[] };
    expect(changed.type).toBe("edited");
    expect(changed.words[1].html).toContain("--loud:9");
    expect((await messages()).find((m) => m.id === id)?.text).toBe("over their");
    expect((await editAs(p.cookie, { id, index: 0, remove: true })).status).toBe(200);
    expect((await messages()).find((m) => m.id === id)?.text).toBe("their");
    // the last word gone takes the phrase with it, for everyone
    expect((await editAs(p.cookie, { id, index: 0, remove: true })).status).toBe(200);
    expect(await watcher.waitFor(`"id":${id},"removed":true`)).toMatchObject({ type: "edited" });
    watcher.close();
  });

  it("refuses a change to anyone else's words, whatever the request says", async () => {
    const [a, b] = [await person(), await person()];
    const stamp = `mine${Date.now()}`;
    const { id } = (await (await a.say({ words: [word(stamp, 0)] })).json()) as { id: number };
    expect((await editAs(b.cookie, { id, index: 0, text: "hacked", name: a.name })).status).toBe(403);
    expect((await editAs(b.cookie, { id, index: 0, remove: true })).status).toBe(403);
    expect((await messages()).find((m) => m.id === id)?.text).toBe(stamp);
    for (const bad of [{ id, index: 9, text: "x" }, { id, index: 0 }, { id, index: 0, effect: "impact" }, { id: "1", index: 0, text: "x" }]) {
      expect([400, 403]).toContain((await editAs(a.cookie, bad)).status);
    }
  });

  it("offers no way to take back or rewrite anyone's words wholesale", async () => {
    const p = await person();
    for (const [method, path] of [["PUT", "/r/main/say"], ["DELETE", "/r/main/say"], ["PATCH", "/r/main/say"], ["POST", "/r/main/unsay"], ["DELETE", "/r/main/api/messages"]]) {
      const res = await fetch(new URL(path, baseUrl), { method, headers: { cookie: p.cookie, "content-type": "application/json" }, body: "{}" });
      expect([403, 404], `${method} ${path}`).toContain(res.status);
    }
  });

  it("shows words heard early to everyone, without keeping them, until the real phrase replaces them", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const stamp = `early${Date.now()}`;
    const early = (body: unknown) =>
      fetch(new URL("/r/main/early", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await early({ words: [word(stamp, 0)], draft: 7 })).status).toBe(200);
    expect((await watcher.waitFor(stamp)) as unknown as { type: string; draft: number }).toMatchObject({ type: "early", draft: 7 });
    expect((await messages()).some((m) => m.text === stamp)).toBe(false);
    const real = `real${Date.now()}`;
    await p.say({ words: [word(real, 0)], draft: 7 });
    expect((await watcher.waitFor(real)) as unknown as { type: string; draft: number }).toMatchObject({ type: "said", draft: 7 });
    expect((await early({ words: "a recording", draft: 1 })).status).toBe(400);
    watcher.close();
  });

  it("only lets someone who has joined say anything", async () => {
    const res = await fetch(new URL("/r/main/say", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: [word("nobody", 0)] }) });
    expect(res.status).toBe(401);
  });

  it("refuses things that aren't a message", async () => {
    const p = await person();
    for (const bad of ["not json", {}, { words: [] }, { words: [{ w: "", start: 0, end: 1 }] }, { words: [{ w: "x" }] }]) {
      expect((await p.say(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("stores words and how they were said, and nothing else, so audio can't ride along", async () => {
    const p = await person();
    const marker = `only${Date.now()}`;
    const res = await p.say({ audio: "UklGRiQAAABXQVZF", words: [word(marker, 0, { audio: "UklGRiQAAABXQVZF", blob: [1, 2, 3], effect: "rainbow" })] });
    expect(res.status).toBe(201);
    const found = (await messages()).find((m) => m.text === marker)!;
    expect(Object.keys(found.words[0]).sort()).toEqual(["contour", "end", "held", "loud", "pitch", "rise", "start", "stretch", "w"]);
    expect(JSON.stringify(found)).not.toContain("UklGR");
  });

  it("marks a message typed instead of said as typed, and reads it out in its writer's voice, never as their own", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    expect((await fetch(new URL("/voice", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify({ voice: "deep", pitch: 0.3, speed: -2 }) })).status).toBe(200);
    const marker = `typed${Date.now()}`;
    const res = await p.say({ typed: true, voice: { pitch: 30, range: 6, loud: -20, pace: 12 }, words: [word(marker, 0, { loud: 6 })] });
    expect(res.status).toBe(201);
    expect(await watcher.waitFor(marker)).toMatchObject({ type: "said", typed: true, voice: { voice: "deep", pitch: 0.3, speed: -1 } });
    expect((await messages()).find((m) => m.text === marker)).toMatchObject({ typed: true, usual: null });
    expect(await p.page()).toMatch(new RegExp(`class="phrase typed"[^>]*>[\\s\\S]*?${marker}`));
    const said = `said${Date.now()}`;
    await p.say({ words: [word(said, 0)] });
    expect(await watcher.waitFor(said)).not.toHaveProperty("typed");
    // only voices on offer
    expect((await fetch(new URL("/voice", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify({ voice: "Samantha" }) })).status).toBe(400);
    watcher.close();
  });

  it("pulls extreme numbers into range, so one shout can't take over the page", async () => {
    const p = await person();
    const marker = `loud${Date.now()}`;
    await p.say({ words: [word(marker, 0, { loud: 500, pitch: -90, rise: 1e9, stretch: -40 })] });
    expect((await messages()).find((m) => m.text === marker)!.words[0]).toMatchObject({ loud: 18, pitch: -12, rise: 12, stretch: -2 });
  });

  it("won't let one person fill the room, even all at once, and doesn't hold that against anyone else", async () => {
    const loud = await person();
    const statuses = await Promise.all(Array.from({ length: 200 }, (_, i) => loud.say({ words: [word(`burst${i}`, 0)] }).then((r) => r.status)));
    expect(statuses.filter((s) => s === 201)).toHaveLength(150);
    const other = await person();
    expect((await other.say({ words: [word("meanwhile", 0)] })).status).toBe(201);
  });

  it("won't let one place fill the room with new names", async () => {
    const from = `2001:db8::${Date.now().toString(16)}`;
    const results: (string | null)[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await fetch(new URL("/join", baseUrl), { method: "POST", body: new URLSearchParams({ name: `fl${Math.random().toString(36).slice(2, 9)}${i}` }), headers: { "fly-client-ip": from }, redirect: "manual" });
      results.push(new URL(res.headers.get("location")!, baseUrl).searchParams.get("m"));
    }
    expect(results.slice(0, 30).every((m) => m === null)).toBe(true);
    expect(results[30]).toBe("too-many-joins");
  });

  it("only takes changes from the app's own pages, so another site can't sign someone in as someone new", async () => {
    const p = await person();
    const res = await fetch(new URL("/join", baseUrl), { method: "POST", body: new URLSearchParams({ name: `evil-${Date.now()}` }), headers: { cookie: p.cookie, origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" }, redirect: "manual" });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await p.page()).toContain(`data-me="${p.name}"`);
  });

  it("won't let a new name pass as an existing one with invisible characters", async () => {
    const p = await person();
    const res = await fetch(new URL("/join", baseUrl), { method: "POST", body: new URLSearchParams({ name: `${p.name}​` }), redirect: "manual" });
    expect(new URL(res.headers.get("location")!, baseUrl).searchParams.get("m")).toBe("name-taken");
  });

  it("keeps the transcript readable whatever characters someone says", async () => {
    const p = await person();
    const watcher = listen();
    await watcher.ready;
    // "İ" is two characters once lowercased, which once shifted the drawn-out
    // letter off the end of the word and took the whole page down
    for (const w of ["İoo", "𝐚𝐚h", "naïve", "ÆGIR"]) expect((await p.say({ words: [word(w, 0, { stretch: 2, held: 0.5 })] })).status).toBe(201);
    expect((await watcher.waitFor("ÆGIR")).id).toBeGreaterThan(0);
    expect((await fetch(new URL("/r/main/", baseUrl))).status).toBe(200);
    expect((await fetch(new URL("/r/main/transcript.txt", baseUrl))).status).toBe(200);
    watcher.close();
  });

  it("compares a message with how its speaker usually sounds, once there's a usual", async () => {
    const p = await person();
    const usual = { pitch: 20, range: 6, loud: -20, pace: 4 };
    const stamp = Date.now();
    const marker = (k: number) => `usual${k}x${stamp}`;
    await p.say({ words: [word(marker(0), 0)], voice: usual });
    expect(((await messages()).find((m) => m.text === marker(0)) as Said & { usual: unknown }).usual).toBeNull();
    for (let k = 1; k < 3; k++) await p.say({ words: [word(marker(k), 0)], voice: usual });
    await p.say({ words: [word(marker(9), 0)], voice: { pitch: 25, range: 12, loud: -10, pace: 6 } });
    const found = (await messages()).find((m) => m.text === marker(9)) as Said & { usual: Record<string, number> };
    expect(found.usual.pitch).toBeGreaterThan(2.5);
    expect(found.usual.loud).toBeGreaterThan(5);
  });

  it("escapes what people say, so nobody can put markup on anyone else's page", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    await p.say({ words: [word("<script>alert(1)</script>", 0)] });
    const e = (await watcher.waitFor("alert(1)")) as unknown as { words: { html: string }[] };
    expect(e.words[0].html).not.toContain("<script>");
    expect(e.words[0].html).toContain("&lt;script&gt;");
    expect(await (await fetch(new URL("/r/main/", baseUrl))).text()).not.toContain("<script>alert(1)");
    watcher.close();
  });
});

describe.skipIf(!writable)("rooms", () => {
  // a room opened by `p` (as JSON), and what came back
  const makeRoom = async (p: { cookie: string }, body: Record<string, unknown>) => {
    const res = await fetch(new URL("/rooms", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as { room?: { slug: string; name: string; about: string; keep: string; listed: boolean } } };
  };
  const change = (p: { cookie: string }, slug: string, c: unknown) => fetch(new URL(`/r/${slug}/room`, baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify(c) });

  it("keeps what's said in a room to that room, live and stored", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const { status, body } = await makeRoom(a, { name: `Talk ${Date.now()}` });
    expect(status).toBe(201);
    const slug = body.room!.slug;
    const main = listen();
    const there = listen({}, "", slug);
    await Promise.all([main.ready, there.ready]);
    const secret = `onlyhere${Date.now()}`;
    expect((await b.say({ words: [word(secret, 0)] }, slug)).status).toBe(201);
    await there.waitFor(secret);
    expect((await messages(slug)).map((m) => m.text)).toContain(secret);
    expect((await messages()).map((m) => m.text)).not.toContain(secret);
    await expect(main.waitFor(secret, 600)).rejects.toThrow();
    expect(await a.page()).not.toContain(secret);
    main.close();
    there.close();
  });

  it("opens with a name, what it's about, how long it keeps what's said, and who can find it, from what's on offer", async () => {
    const a = await person();
    const { body } = await makeRoom(a, { name: `Tutorial ${Date.now()}`, about: "Week 12 questions", keep: "day", listed: false });
    expect(body.room).toMatchObject({ about: "Week 12 questions", keep: "day", listed: false });
    // a week, listed, unless it says
    expect((await makeRoom(a, { name: `Plain ${Date.now()}` })).body.room).toMatchObject({ keep: "week", listed: true, about: "" });
    expect((await makeRoom(a, { name: "x", keep: "forever" })).status).toBe(400);
    expect((await makeRoom(a, { name: "x", about: "y".repeat(141) })).status).toBe(400);
    expect((await makeRoom(a, { name: "   " })).status).toBe(400);
    expect((await makeRoom({ cookie: "" }, { name: "Nobody's" })).status).toBe(401);
    // from the front page's form too, to the new room after
    const viaForm = await fetch(new URL("/rooms", baseUrl), { method: "POST", headers: { cookie: a.cookie }, body: new URLSearchParams({ name: `Form ${Date.now()}`, about: "", keep: "hour", listed: "no" }), redirect: "manual" });
    expect(viaForm.status).toBe(303);
    expect(viaForm.headers.get("location")).toMatch(/^\/r\/form-\d+\/$/);
  });

  it("lets only whoever opened a room change it, and every page in it sees the change", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const { body } = await makeRoom(a, { name: `Mine ${Date.now()}` });
    const slug = body.room!.slug;
    const watcher = listen({}, "", slug);
    await watcher.ready;
    expect((await change(b, slug, { name: "taken over" })).status).toBe(403);
    expect((await change(b, slug, { close: true })).status).toBe(403);
    expect((await change(a, slug, { keep: "forever" })).status).toBe(400);
    expect((await change(a, slug, { name: "Renamed", about: "Now about this", keep: "always" })).status).toBe(200);
    expect(await watcher.waitUntil((e) => e.type === "changed")).toMatchObject({ name: "Renamed", about: "Now about this", keep: "always" });
    const page = await b.page(slug);
    expect(page).toContain("Renamed");
    expect(page).not.toContain("taken over");
    // the room's settings are on its opener's page only
    expect(page).not.toContain("data-room-settings");
    expect(await a.page(slug)).toContain("data-room-settings");
    // (the open room is nobody's to change)
    expect((await change(a, "main", { name: "x" })).status).toBe(403);
    watcher.close();
  });

  it("deletes what a room no longer keeps, at once when it's made to keep less, and everything when it's closed", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const { body } = await makeRoom(a, { name: `Brief ${Date.now()}`, keep: "always" });
    const slug = body.room!.slug;
    const said = `kept${Date.now()}`;
    await b.say({ words: [word(said, 0)] }, slug);
    expect((await messages(slug)).map((m) => m.text)).toContain(said);
    // keeping an hour, what's newer stays
    expect((await change(a, slug, { keep: "hour" })).status).toBe(200);
    expect((await messages(slug)).map((m) => m.text)).toContain(said);
    // closed: it and what was said in it, gone, and every page in it told
    const watcher = listen({}, "", slug);
    await watcher.ready;
    expect((await change(a, slug, { close: true })).status).toBe(200);
    await watcher.waitUntil((e) => e.type === "closed");
    expect((await fetch(new URL(`/r/${slug}/`, baseUrl))).status).toBe(404);
    expect((await fetch(new URL(`/r/${slug}/api/messages`, baseUrl))).status).toBe(404);
    expect(await (await fetch(new URL("/", baseUrl))).text()).not.toContain(`/r/${slug}/`);
    watcher.close();
  });

  it("escapes a room's name and what it's about wherever they're shown, and never shows who opened it by id", async () => {
    const a = await person();
    const name = `<img src=x onerror=alert(1)> ${Date.now()}`.slice(0, 40);
    const { status, body } = await makeRoom(a, { name, about: "<b>bold</b>" });
    expect(status).toBe(201);
    const id = a.cookie.split("=")[1];
    expect(JSON.stringify(body)).not.toContain(id);
    for (const path of [`/r/${body.room!.slug}/`, "/", `/r/${body.room!.slug}/transcript.txt`]) {
      const page = await (await fetch(new URL(path, baseUrl), { headers: { cookie: a.cookie } })).text();
      if (!path.endsWith(".txt")) {
        expect(page, path).not.toContain("<img src=x");
        expect(page, path).not.toContain("<b>bold</b>");
      }
      expect(page, path).not.toContain(id);
    }
  });

  it("lists a room for anyone to find, or keeps it to those with the link", async () => {
    const [a, b] = await Promise.all([person(), person()]);
    const open = await makeRoom(a, { name: `Open ${Date.now()}` });
    const hidden = await makeRoom(a, { name: `Hidden ${Date.now()}`, listed: false });
    const list = async (p: { cookie: string }) => (await fetch(new URL("/", baseUrl), { headers: { cookie: p.cookie } })).text();
    expect(await list(b)).toContain(`/r/${open.body.room!.slug}/`);
    expect(await list(b)).not.toContain(`/r/${hidden.body.room!.slug}/`);
    expect(await list(a)).toContain(`/r/${hidden.body.room!.slug}/`);
    expect((await fetch(new URL(`/r/${hidden.body.room!.slug}/`, baseUrl), { headers: { cookie: b.cookie } })).status).toBe(200);
    expect((await fetch(new URL("/r/no-such-room-here/", baseUrl))).status).toBe(404);
  });

  it("never shows anyone another person's id, since it doubles as their login", async () => {
    const p = await person();
    await p.say({ words: [word("hello", 0)] });
    const id = p.cookie.split("=")[1];
    expect(JSON.stringify(await messages())).not.toContain(id);
    for (const path of ["/", "/r/main/", "/r/main/transcript.txt"]) expect(await (await fetch(new URL(path, baseUrl))).text(), path).not.toContain(id);
  });
});
