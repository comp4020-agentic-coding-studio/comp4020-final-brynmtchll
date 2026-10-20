import { describe, expect, inject, it } from "vitest";

// The room's promises, checked over HTTP against the running app. These join
// people and say things, so they run against a local or CI app (a throwaway
// /data) and skip against the live one unless SPEC_WRITES=1 says otherwise.
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
  const say = (payload: unknown) =>
    fetch(new URL("/say", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    });
  const page = async () => (await fetch(new URL("/", baseUrl), { headers: { cookie } })).text();
  return { name, cookie, say, page };
}

// An open page's live stream. One reader collects every message event as it
// comes; waitFor resolves with the first one that mentions `needle`,
// whether it came before or after the call, so several can wait at once.
function listen(headers: Record<string, string> = {}, query = "") {
  const controller = new AbortController();
  const ready = fetch(new URL(`/events${query}`, baseUrl), { headers, signal: controller.signal });
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
  return {
    ready,
    waitFor,
    close: () => {
      controller.abort();
      void reading;
    },
  };
}

const messages = async (): Promise<Said[]> =>
  ((await (await fetch(new URL("/api/messages", baseUrl))).json()) as { messages: Said[] }).messages;

describe.skipIf(!writable)("the room", () => {
  it("remembers who you are when you come back", async () => {
    const p = await person();
    expect(await p.page()).toMatch(new RegExp(`class="spot mine" data-name="${p.name}"`));
  });

  it("gives everyone a card of their own in their own colour, yours apart from everyone else's", async () => {
    const [a, b] = [await person(), await person()];
    await a.say({ words: [word("card", 0)] });
    const hue = (page: string, name: string) => page.match(new RegExp(`data-name="${name}" style="--hue:(\\d+)"`))?.[1];
    const [fromA, fromB] = [await a.page(), await b.page()];
    for (const [page, name] of [[fromA, a.name], [fromB, a.name], [fromB, b.name]]) {
      expect(hue(page, name), `${name}'s card`).toBeDefined();
    }
    // the same colour on every page, and a different one from the person before
    expect(hue(fromB, a.name)).toEqual(hue(fromA, a.name));
    expect(hue(fromB, b.name)).not.toEqual(hue(fromB, a.name));
    // your own card is the one marked yours, and it isn't in everyone else's stack
    expect(fromB).toMatch(new RegExp(`<ul class="mine-card"><li class="spot mine" data-name="${b.name}"`));
    expect(fromB.slice(fromB.indexOf('id="stage"'))).not.toContain(`data-name="${b.name}"`);
  });

  it("gives someone a place on every open page the moment they join", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const e = (await watcher.waitFor(p.name)) as unknown as { type: string; name: string; hue: number };
    expect(e).toMatchObject({ type: "joined", name: p.name });
    expect(e.hue).toBeGreaterThanOrEqual(0);
    expect(e.hue).toBeLessThan(360);
    watcher.close();
  });

  it("sends each phrase with what a page needs to play it word by word", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const stamp = Date.now();
    await p.say({ words: [word(`first${stamp}`, 0.2), word("second", 0.9)] });
    const e = (await watcher.waitFor(`first${stamp}`)) as unknown as { name: string; hue: number; words: { html: string; t: number; d: number }[] };
    expect(e.name).toBe(p.name);
    expect(e.hue).toBeGreaterThanOrEqual(0);
    expect(e.hue).toBeLessThan(360);
    expect(e.words.map((w) => [w.t, w.d])).toEqual([[0.2, 0.3], [0.9, 0.3]]);
    expect(e.words[1].html).toContain("second");
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

  it("catches a page up on what it missed when it reconnects", async () => {
    const p = await person();
    const first = (await (await p.say({ words: [word("before", 0)] })).json()) as { id: number };
    const missed = `missed${Date.now()}`;
    await p.say({ words: [word(missed, 0)] });
    // the browser sends Last-Event-ID itself when it reconnects
    const back = listen({ "last-event-id": String(first.id) });
    expect((await back.waitFor(missed)).id).toBeGreaterThan(first.id);
    back.close();
  });

  it("keeps what was said, by whom, after the page that said it has gone", async () => {
    const p = await person();
    const marker = `kept${Date.now()}`;
    await p.say({ words: [word(marker, 0)] });
    const found = (await messages()).find((m) => m.text === marker);
    expect(found).toMatchObject({ name: p.name, text: marker });
    // and who said it keeps their place in the room
    expect(await (await fetch(new URL("/", baseUrl))).text()).toContain(`data-name="${p.name}"`);
  });

  it("gets everyone's message to every open page when several speak at the same moment", async () => {
    const watchers = [listen(), listen(), listen()];
    await Promise.all(watchers.map((w) => w.ready));
    const speakers = await Promise.all([person(), person(), person(), person()]);
    const stamp = Date.now();
    const said = speakers.map((_, i) => `together${i}x${stamp}`);
    const arrivals = watchers.flatMap((w) => said.map((m) => w.waitFor(m)));
    const statuses = await Promise.all(speakers.map((p, i) => p.say({ words: [word(said[i], 0)] }).then((r) => r.status)));
    expect(statuses).toEqual([201, 201, 201, 201]);
    // waitFor reads from the start of each stream, so each needle is found in turn
    const got = await Promise.allSettled(arrivals);
    expect(got.filter((g) => g.status === "rejected")).toHaveLength(0);
    for (const w of watchers) w.close();
  });

  it("keeps a brief record of what's been said, joined into lines, for whoever comes along later", async () => {
    const p = await person();
    const stamp = Date.now().toString(36);
    for (const w of [`hello${stamp}`, "there", "friend"]) await p.say({ words: [word(w, 0)] });
    const page = await (await fetch(new URL("/", baseUrl))).text();
    const line = page.match(new RegExp(`<li[^>]*data-name="${p.name}"[^>]*><strong>[^<]*</strong> <span class="said-text">([^<]*)</span>`))?.[1];
    expect(line).toBe(`hello${stamp} there friend`);
  });

  it("shows someone's face as an emoji on every open page, and nothing but an emoji", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    const face = (body: unknown) =>
      fetch(new URL("/face", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await face({ face: "😂" })).status).toBe(200);
    const e = (await watcher.waitFor("😂")) as unknown as { type: string; name: string };
    expect(e).toMatchObject({ type: "face", name: p.name });
    // a picture, a score or any other text is refused
    for (const bad of [{ face: "data:image/png;base64,AAAA" }, { face: 0.9 }, { face: "<b>hi</b>" }]) {
      expect((await face(bad)).status).toBe(400);
    }
    // and whoever arrives later sees it by their name
    expect(await (await fetch(new URL("/", baseUrl))).text()).toMatch(new RegExp(`data-name="${p.name}"[\\s\\S]*?spot-face[^>]*>😂<`));
    expect((await face({ face: null })).status).toBe(200);
    watcher.close();
  });

  it("clears a face its page stops sending, so nobody's left wearing one", async () => {
    const watcher = listen();
    await watcher.ready;
    const p = await person();
    await fetch(new URL("/face", baseUrl), { method: "POST", headers: { cookie: p.cookie, "content-type": "application/json" }, body: JSON.stringify({ face: "😠" }) });
    // nothing more from that page: within the 12 s it's taken to have gone
    const cleared = await watcher.waitFor(`"name":"${p.name}","face":null`, 16_000);
    expect(cleared).toMatchObject({ type: "face" });
    watcher.close();
  }, 20_000);

  // What each person may change is decided on the server, from the cookie
  // alone: nothing a page sends can make a word or a face someone else's.
  it("credits what's said to whoever's cookie sent it, whatever name the request claims", async () => {
    const [a, b] = [await person(), await person()];
    const stamp = `claim${Date.now()}`;
    await a.say({ name: b.name, person: b.name, words: [word(stamp, 0, { name: b.name })] });
    const found = (await messages()).find((m) => m.text === stamp)!;
    expect(found.name).toBe(a.name);
  });

  it("only lets a person change their own face", async () => {
    const watcher = listen();
    await watcher.ready;
    const [a, b] = [await person(), await person()];
    await fetch(new URL("/face", baseUrl), {
      method: "POST",
      headers: { cookie: a.cookie, "content-type": "application/json" },
      body: JSON.stringify({ face: "😠", name: b.name }),
    });
    const e = (await watcher.waitFor("😠")) as unknown as { name: string };
    expect(e.name).toBe(a.name);
    expect(await b.page()).not.toMatch(new RegExp(`data-name="${b.name}"[\\s\\S]{0,200}?spot-face[^>]*>😠<`));
    watcher.close();
  });

  it("offers no way to change or take back anyone's words once said", async () => {
    const p = await person();
    for (const [method, path] of [["PUT", "/say"], ["DELETE", "/say"], ["PATCH", "/say"], ["POST", "/unsay"], ["POST", "/edit"], ["DELETE", "/api/messages"]]) {
      const res = await fetch(new URL(path, baseUrl), { method, headers: { cookie: p.cookie, "content-type": "application/json" }, body: "{}" });
      expect([403, 404], `${method} ${path}`).toContain(res.status);
    }
  });

  it("only lets someone who has joined say anything", async () => {
    const res = await fetch(new URL("/say", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words: [word("nobody", 0)] }),
    });
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
    const res = await p.say({ audio: "UklGRiQAAABXQVZF", words: [word(marker, 0, { audio: "UklGRiQAAABXQVZF", blob: [1, 2, 3] })] });
    expect(res.status).toBe(201);
    const found = (await messages()).find((m) => m.text === marker)!;
    expect(Object.keys(found.words[0]).sort()).toEqual(["contour", "end", "held", "loud", "pitch", "rise", "start", "stretch", "w"]);
    expect(JSON.stringify(found)).not.toContain("UklGR");
  });

  it("pulls extreme numbers into range, so one shout can't take over the page", async () => {
    const p = await person();
    const marker = `loud${Date.now()}`;
    await p.say({ words: [word(marker, 0, { loud: 500, pitch: -90, rise: 1e9, stretch: -40 })] });
    const w = (await messages()).find((m) => m.text === marker)!.words[0];
    expect(w).toMatchObject({ loud: 18, pitch: -12, rise: 12, stretch: -2 });
  });

  it("won't let one person fill the room, and doesn't hold that against anyone else", async () => {
    const loud = await person();
    const statuses: number[] = [];
    // each word goes out on its own, two or three a second for someone
    // talking on; the limit (150 in 30 s) is past that
    for (let i = 0; i < 151; i++) statuses.push((await loud.say({ words: [word(`again${i}`, 0)] })).status);
    expect(statuses.slice(0, 150).every((s) => s === 201)).toBe(true);
    expect(statuses[150]).toBe(429);
    const other = await person();
    expect((await other.say({ words: [word("meanwhile", 0)] })).status).toBe(201);
  });

  it("holds to the limit even when someone sends a burst all at once", async () => {
    const burst = await person();
    const statuses = await Promise.all(Array.from({ length: 200 }, (_, i) => burst.say({ words: [word(`burst${i}`, 0)] }).then((r) => r.status)));
    expect(statuses.filter((s) => s === 201)).toHaveLength(150);
  });

  it("won't let one place fill the room with new names", async () => {
    // the checks themselves join a lot from one address, so this asks as a
    // different one (the server takes Fly's word for where a request is from)
    const from = `2001:db8::${Date.now().toString(16)}`;
    const results: (string | null)[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await fetch(new URL("/join", baseUrl), {
        method: "POST",
        body: new URLSearchParams({ name: `fl${Math.random().toString(36).slice(2, 9)}${i}` }),
        headers: { "fly-client-ip": from },
        redirect: "manual",
      });
      results.push(new URL(res.headers.get("location")!, baseUrl).searchParams.get("m"));
    }
    // a classroom's worth gets in; past that, no
    expect(results.slice(0, 30).every((m) => m === null)).toBe(true);
    expect(results[30]).toBe("too-many-joins");
  });

  it("only takes changes from the app's own pages, so another site can't sign someone in as someone new", async () => {
    const p = await person();
    const res = await fetch(new URL("/join", baseUrl), {
      method: "POST",
      body: new URLSearchParams({ name: `evil-${Date.now()}` }),
      headers: { cookie: p.cookie, origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" },
      redirect: "manual",
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await p.page()).toMatch(new RegExp(`class="spot mine" data-name="${p.name}"`));
  });

  it("won't let a new name pass as an existing one with invisible characters", async () => {
    const p = await person();
    const res = await fetch(new URL("/join", baseUrl), {
      method: "POST",
      body: new URLSearchParams({ name: `${p.name}\u200B` }),
      redirect: "manual",
    });
    expect(new URL(res.headers.get("location")!, baseUrl).searchParams.get("m")).toBe("name-taken");
  });

  it("keeps the room readable whatever characters someone says", async () => {
    const p = await person();
    // "İ" is two characters once lowercased, which once shifted the drawn-out
    // letter off the end of the word and took the whole page down
    const watcher = listen();
    await watcher.ready;
    for (const w of ["İoo", "𝐚𝐚h", "naïve", "ÆGIR"]) {
      expect((await p.say({ words: [word(w, 0, { stretch: 2, held: 0.5 })] })).status).toBe(201);
    }
    expect((await watcher.waitFor("ÆGIR")).id).toBeGreaterThan(0);
    expect((await fetch(new URL("/", baseUrl))).status).toBe(200);
    watcher.close();
  });

  it("catches a page up on what was said while it loaded", async () => {
    const p = await person();
    const before = (await (await p.say({ words: [word("loading", 0)] })).json()) as { id: number };
    const meanwhile = `meanwhile${Date.now()}`;
    await p.say({ words: [word(meanwhile, 0)] });
    // a page drawn with `before` as its newest message opens its stream from there
    const late = listen({}, `?after=${before.id}`);
    expect((await late.waitFor(meanwhile)).id).toBeGreaterThan(before.id);
    late.close();
  });

  it("compares a message with how its speaker usually sounds, once there's a usual", async () => {
    const p = await person();
    const usual = { pitch: 20, range: 6, loud: -20, pace: 4 };
    const stamp = Date.now();
    const marker = (k: number) => `usual${k}x${stamp}`;
    await p.say({ words: [word(marker(0), 0)], voice: usual });
    const first = (await messages()).find((m) => m.text === marker(0)) as Said & { usual: unknown };
    expect(first.usual).toBeNull();
    for (let k = 1; k < 3; k++) await p.say({ words: [word(marker(k), 0)], voice: usual });
    const excited = marker(9);
    await p.say({ words: [word(excited, 0)], voice: { pitch: 25, range: 12, loud: -10, pace: 6 } });
    const found = (await messages()).find((m) => m.text === excited) as Said & { usual: Record<string, number> };
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
    watcher.close();
  });

  it("lets a page that drops off before anything's said catch up when it reconnects", async () => {
    // a new page's stream says where it's up to; the browser sends that back
    // when it reconnects
    const controller = new AbortController();
    const res = await fetch(new URL("/events?after=now", baseUrl), { signal: controller.signal });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let head = "";
    while (!head.includes("\n\n")) head += (await reader.read()).value;
    controller.abort();
    const id = head.match(/^id: (\d+)/m)?.[1];
    expect(id).toBeDefined();
    const p = await person();
    const meanwhile = `blip${Date.now()}`;
    await p.say({ words: [word(meanwhile, 0)] });
    const back = listen({ "last-event-id": id! });
    expect((await back.waitFor(meanwhile)).type).toBe("said");
    back.close();
  });

  it("starts a newly opened page from now, not from everything ever said", async () => {
    const p = await person();
    const old = `before${Date.now()}`;
    await p.say({ words: [word(old, 0)] });
    const fresh = listen({}, "?after=now");
    await fresh.ready;
    const next = `after${Date.now()}`;
    await p.say({ words: [word(next, 0)] });
    await fresh.waitFor(next);
    await expect(fresh.waitFor(old, 300)).rejects.toThrow();
    fresh.close();
  });

  it("never shows anyone another person's id, since it doubles as their login", async () => {
    const p = await person();
    await p.say({ words: [word("hello", 0)] });
    const id = p.cookie.split("=")[1];
    expect(JSON.stringify(await messages())).not.toContain(id);
    expect(await (await fetch(new URL("/", baseUrl))).text()).not.toContain(id);
  });
});
