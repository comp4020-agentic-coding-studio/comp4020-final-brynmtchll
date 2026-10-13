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

// an open page's live stream: resolves with the first message event whose
// HTML mentions `needle`
function listen(headers: Record<string, string> = {}, query = "") {
  const controller = new AbortController();
  const ready = fetch(new URL(`/events${query}`, baseUrl), { headers, signal: controller.signal });
  const waitFor = async (needle: string, ms = 3000): Promise<{ id: number; html: string }> => {
    const res = await ready;
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    const deadline = setTimeout(() => controller.abort(), ms);
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`stream ended before "${needle}" arrived`);
        buffer += value;
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data: "));
          if (data?.includes(needle)) return JSON.parse(data.slice(6));
        }
      }
    } finally {
      clearTimeout(deadline);
    }
  };
  return { ready, waitFor, close: () => controller.abort() };
}

const messages = async (): Promise<Said[]> =>
  ((await (await fetch(new URL("/api/messages", baseUrl))).json()) as { messages: Said[] }).messages;

describe.skipIf(!writable)("the room", () => {
  it("remembers who you are when you come back", async () => {
    const p = await person();
    expect(await p.page()).toContain(`Say something, ${p.name}`);
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
    expect(event.html).toContain(speaker.name);
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
    expect(await (await fetch(new URL("/", baseUrl))).text()).toContain(marker);
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
    for (let i = 0; i < 7; i++) statuses.push((await loud.say({ words: [word(`again${i}`, 0)] })).status);
    expect(statuses.slice(0, 6)).toEqual([201, 201, 201, 201, 201, 201]);
    expect(statuses[6]).toBe(429);
    const other = await person();
    expect((await other.say({ words: [word("meanwhile", 0)] })).status).toBe(201);
  });

  it("holds to the limit even when someone sends a burst all at once", async () => {
    const burst = await person();
    const statuses = await Promise.all(Array.from({ length: 20 }, (_, i) => burst.say({ words: [word(`burst${i}`, 0)] }).then((r) => r.status)));
    expect(statuses.filter((s) => s === 201)).toHaveLength(6);
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
    expect(await p.page()).toContain(`Say something, ${p.name}`);
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
    for (const w of ["İoo", "𝐚𝐚h", "naïve", "ÆGIR"]) {
      expect((await p.say({ words: [word(w, 0, { stretch: 2, held: 0.5 })] })).status).toBe(201);
    }
    const page = await fetch(new URL("/", baseUrl));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("İoo");
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
    const page = await (await fetch(new URL("/", baseUrl))).text();
    expect(page).toMatch(new RegExp(`${excited}[\\s\\S]*?Higher, more animated and louder than ${p.name} usually sounds`));
  });

  it("escapes what people say, so nobody can put markup on anyone else's page", async () => {
    const p = await person();
    await p.say({ words: [word("<script>alert(1)</script>", 0)] });
    expect(await (await fetch(new URL("/", baseUrl))).text()).not.toContain("<script>alert(1)</script>");
  });

  it("never shows anyone another person's id, since it doubles as their login", async () => {
    const p = await person();
    await p.say({ words: [word("hello", 0)] });
    const id = p.cookie.split("=")[1];
    expect(JSON.stringify(await messages())).not.toContain(id);
    expect(await (await fetch(new URL("/", baseUrl))).text()).not.toContain(id);
  });
});
