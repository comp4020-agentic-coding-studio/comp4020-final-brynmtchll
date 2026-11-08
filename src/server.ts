import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { MAIN, openRoom, type Message, type RoomInfo } from "./db.ts";
import { APP, homePage, notFoundPage, readmePage, roomPage, transcriptText } from "./view.ts";
import { clean, cleanVoice, hueOf, wordHtml } from "./voice.ts";
import { isVoice, KEEPS } from "./packs.ts";

// What's live in each room, in memory: the pages open on it (each a
// stream), whose they are, and whose hand is up. A room's words are stored;
// this is the moment, so a restart forgetting it is right. Made as each
// room is first opened.
type Live = {
  id: number;
  listening: Set<ServerResponse>;
  pagesOf: Map<string, number>; // name, how many pages it has open here
  goneSince: Map<string, number>; // name, since when it's had none here
  hands: Map<string, number>; // name, when raised (oldest first)
  hereShown: string;
};
const lives = new Map<number, Live>();
const liveOf = (id: number): Live => {
  let l = lives.get(id);
  if (!l) lives.set(id, (l = { id, listening: new Set(), pagesOf: new Map(), goneSince: new Map(), hands: new Map(), hereShown: "" }));
  return l;
};
const tell = (l: Live, payload: string): void => {
  for (const listener of l.listening) listener.write(payload);
};
const tellAll = (payload: string): void => {
  for (const l of lives.values()) tell(l, payload);
};
// A room as it's sent: never who made it (their id is their login), only
// whether it's yours, which the page is told apart
const shown = <R extends RoomInfo>({ maker: _, ...r }: R): Omit<R, "maker"> => r;

// Who's in a room now: has a page open on it, with their colour. A reload
// or a moment's lost connection isn't leaving: someone stays here for
// STILL_HERE after their last page closes.
const STILL_HERE = 8_000;
const hereIn = (l: Live): { name: string; hue: number }[] => {
  const now = Date.now();
  const names = new Set([...l.pagesOf.keys(), ...[...l.goneSince].filter(([, t]) => now - t < STILL_HERE).map(([n]) => n)]);
  return [...names].map((name) => ({ name, hue: hueOf(room.seatOf(name)) }));
};
const showHere = (l: Live): void => {
  const now = JSON.stringify({ here: hereIn(l) });
  if (now === l.hereShown) return;
  l.hereShown = now;
  tell(l, `event: here\ndata: ${now}\n\n`);
};
setInterval(() => {
  const now = Date.now();
  for (const l of lives.values()) {
    for (const [name, t] of l.goneSince) if (now - t > GONE_FOR) l.goneSince.delete(name);
    showHere(l);
  }
}, 2000).unref();

// Who has a hand up to speak next, in each room, in the order they raised
// it: for now, so in memory. A hand goes down when its owner says something
// there (unless they raised it a moment ago: what arrives then was said
// before), puts it down, or has had no page open on the room for GONE_FOR.
// Every page in the room hears the whole queue each time it changes.
const GONE_FOR = 60_000;
const JUST_RAISED = 3_000; // ms: about how late a phrase can arrive after its last word
const handQueue = (l: Live): string[] => [...l.hands.keys()];
const showHands = (l: Live): void => tell(l, `event: hand\ndata: ${JSON.stringify({ queue: handQueue(l) })}\n\n`);
const handDown = (l: Live, name: string): void => {
  if (l.hands.delete(name)) showHands(l);
};
setInterval(() => {
  const now = Date.now();
  for (const l of lives.values()) for (const [name, at] of l.hands) if (!l.pagesOf.get(name) && now - (l.goneSince.get(name) ?? at) > GONE_FOR) handDown(l, name);
}, 10_000).unref();

// Limits apart from words, so someone near the word limit can still put
// their hand down. Kept in memory; a restart forgets.
function limiter(most: number, over = 10_000): (personId: string) => boolean {
  const sent = new Map<string, number[]>();
  return (personId) => {
    const now = Date.now();
    const recent = (sent.get(personId) ?? []).filter((t) => now - t < over);
    recent.push(now);
    sent.set(personId, recent);
    return recent.length > most;
  };
}
const earlyTooFast = limiter(120);
const handTooFast = limiter(30);
const roomsTooFast = limiter(40);
const voiceTooFast = limiter(30);

const css = readFileSync(new URL("./style.css", import.meta.url));
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// The page's own scripts are TypeScript in src/ like the server, so the
// browser and the server share voice.ts. Node strips the types the first
// time each is asked for and serves plain JavaScript, which keeps the app
// free of a build step. Only these files are served.
const SCRIPTS = new Set(["client.ts", "voice.ts", "prosody.ts", "phrases.ts", "packs.ts", "speech.ts", "worker.ts", "tap.ts", "typed.ts", "kokoro.ts", "kokoro-text.ts", "vad.ts"]);
const stripped = new Map<string, string>();
const scriptOf = (f: string): string | undefined => {
  if (!SCRIPTS.has(f)) return undefined;
  if (!stripped.has(f)) stripped.set(f, stripTypeScriptTypes(readFileSync(new URL(`./${f}`, import.meta.url), "utf8")));
  return stripped.get(f);
};

// /data is the Fly volume, the only storage that survives a restart or a
// redeploy (the Dockerfile sets DATA_DIR); locally it falls back to ./data
const dir = process.env.DATA_DIR ?? "data";
mkdirSync(dir, { recursive: true });
const room = openRoom(joinPath(dir, "room.db"));

// Who did what, one line each, to stdout, where `flyctl logs` reads it: the
// person by name and a short tag of their id (enough to tell two people apart
// without printing the id itself, which is their login), the action, and what
// it was. Refusals say why. What someone said is logged as words only; there's
// never any audio to log.
type Who = { id: string; name: string } | undefined;
const tag = (id: string): string => id.slice(0, 4);
function log(who: Who, action: string, detail: Record<string, unknown> = {}): void {
  const person = who ? `${who.name}#${tag(who.id)}` : "-";
  const rest = Object.entries(detail)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join(" ");
  console.log(`${person.padEnd(18)} ${action.padEnd(9)} ${rest}`.trimEnd());
}

// What each room no longer keeps goes, now and then, and every page open on
// a room that lost something is told to take it down.
const forget = (): void => {
  for (const [id, n] of room.forget()) {
    log(undefined, "forgot", { room: id, messages: n });
    tell(liveOf(id), `event: forgot\ndata: ${JSON.stringify({ before: Date.now() - (KEEPS.find((k) => k.id === room.roomById(id)?.keep)?.ms ?? 0) })}\n\n`);
  }
};
forget();
setInterval(forget, 60_000).unref();

const COOKIE = "said_id";
const YEAR = 60 * 60 * 24 * 365;

const cookieId = (req: IncomingMessage): string | undefined =>
  req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`))?.[1];

// the request body as text, or null past `limit` bytes; decoded once at the
// end, since a character can be split across two chunks
async function body(req: IncomingMessage, limit: number): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// A change can only come from this site's own pages. Without this, another
// site could submit a form to /join: the browser doesn't send the SameSite
// cookie on that, so the server would make a new person and the browser would
// keep the new cookie in place of the old. Browsers say where a request came
// from in Sec-Fetch-Site (or, older ones, Origin); a request with neither,
// like a script or a check, isn't a browser being tricked.
function sameSite(req: IncomingMessage): boolean {
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin" || site === "none";
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

// Pages are cross-origin isolated, which is what lets Whisper's WebAssembly
// runtime use more than one CPU core (it needs SharedArrayBuffer). The price:
// anything a page loads from another site must say it may be embedded, which
// the CDN and Hugging Face both do.
const ISOLATED = { "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp" };

function send(res: ServerResponse, status: number, type: string, payload: string | Buffer, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...ISOLATED, ...headers });
  res.end(payload);
}

const json = (res: ServerResponse, status: number, value: unknown): void =>
  send(res, status, "application/json", JSON.stringify(value));

// back to a page (`to`, its address), with a message to show
const back = (res: ServerResponse, to: string, msg?: string, headers: Record<string, string> = {}): void => {
  res.writeHead(303, { location: msg ? `${to}?m=${msg}` : to, ...headers });
  res.end();
};

// Live updates go out as server-sent events: one long response per open page,
// and the server writes each new message down every one of them. Each event
// carries the message id, so a page that drops off and reconnects says the
// last one it saw (the browser does this itself) and gets what it missed.
const allListening = (): number => [...lives.values()].reduce((n, l) => n + l.listening.size, 0);
// each open page holds a connection on a 256 MB machine, so there's a ceiling
const MOST_LISTENING = 500;

// No one person can fill a room: at most SAY_LIMIT sends in any SAY_WINDOW.
// Someone talking without a break sends a phrase at every pause, so the
// limit is well past that. A send counts from when it arrives, before its
// body is read, so a burst can't all slip in under the limit; one that turns
// out not to be a message is uncounted again.
const SAY_LIMIT = 150;
const SAY_WINDOW = 30_000;
const said = new Map<string, number[]>();
function tooFast(personId: string): boolean {
  const now = Date.now();
  const recent = (said.get(personId) ?? []).filter((t) => now - t < SAY_WINDOW);
  if (recent.length >= SAY_LIMIT) {
    said.set(personId, recent);
    return true;
  }
  recent.push(now);
  said.set(personId, recent);
  return false;
}
const uncount = (personId: string): void => void said.get(personId)?.pop();

// Joining is limited too, by where it comes from, so a script joining over
// and over can't fill a room with names. Fly's proxy says where a request
// really came from in Fly-Client-IP. A classroom on one network shares an
// address, so the limit is a room's worth.
const JOIN_LIMIT = 30;
const JOIN_WINDOW = 10 * 60_000;
const joins = new Map<string, number[]>();
function joiningTooFast(req: IncomingMessage): boolean {
  const from = String(req.headers["fly-client-ip"] ?? req.socket.remoteAddress ?? "");
  // The checks join hundreds of people from the machine the app runs on (in
  // CI, the image itself, started from the same host). A request from this
  // machine with no Fly-Client-IP can't have come through Fly's proxy, which
  // always sets it, so on the deployed app nobody can pass as one.
  if (!req.headers["fly-client-ip"] && /^(::1|127\.|::ffff:127\.|172\.17\.)/.test(from)) return false;
  const now = Date.now();
  const recent = (joins.get(from) ?? []).filter((t) => now - t < JOIN_WINDOW);
  joins.set(from, recent);
  if (recent.length >= JOIN_LIMIT) return true;
  recent.push(now);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [from, times] of joins) if (times.every((t) => now - t >= JOIN_WINDOW)) joins.delete(from);
  for (const [id, times] of said) if (times.every((t) => now - t >= SAY_WINDOW)) said.delete(id);
}, SAY_WINDOW).unref();

const tenths = (n: number): number => Math.round(n * 10) / 10;

// A phrase as it goes to a page: who and in what colour, each word as HTML
// with when it was said and how (for reading it aloud), and the plain text.
// A typed one carries its speaker's voice, so it's read out in it.
const phraseOf = (m: Message) => ({
  id: m.id,
  name: m.name,
  hue: hueOf(room.seatOf(m.name)),
  text: m.text,
  at: m.at,
  ...(m.typed ? { typed: true, voice: room.voiceOfPerson(m.name) } : {}),
  words: m.words.map((w, i) => ({
    html: wordHtml(w, (m.words[i + 1]?.start ?? w.end) - w.end),
    t: w.start,
    d: tenths(w.end - w.start),
    say: [Math.round(w.loud), Math.round(w.pitch ?? 0), tenths(w.stretch), Math.round(w.rise)],
  })),
});
const event = (m: Message, draft?: number): string => `id: ${m.id}\nevent: said\ndata: ${JSON.stringify({ ...(draft !== undefined ? { draft } : {}), ...phraseOf(m) })}\n\n`;

// Where a stream starts: after the phrase the browser last saw (Last-Event-ID,
// which it sends itself when it reconnects), or after the one a page was
// drawn with (?after=). What it missed comes first.
function listen(req: IncomingMessage, res: ServerResponse, l: Live, after: string | null): void {
  // the page tries again itself, waiting longer each time
  if (allListening() >= MOST_LISTENING) return send(res, 503, "text/plain; charset=utf-8", "Too many people listening");
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", ...ISOLATED });
  const last = Number(req.headers["last-event-id"] ?? after ?? NaN);
  let upTo = Number.isSafeInteger(last) ? Math.max(last, 0) : room.newest();
  if (Number.isSafeInteger(last)) {
    for (const m of room.since(last, 200, l.id)) {
      res.write(event(m));
      upTo = m.id;
    }
  }
  // where this page is up to, so if the stream drops before anything's been
  // said, the browser's reconnect catches up from here rather than from now
  res.write(`id: ${upTo}\n: listening\n\n`);
  l.listening.add(res);
  const who = room.findPerson(cookieId(req));
  if (who) {
    l.pagesOf.set(who.name, (l.pagesOf.get(who.name) ?? 0) + 1);
    l.goneSince.delete(who.name);
  }
  // the room as it is now: who's here, and whose hands are up
  res.write(`event: room\ndata: ${JSON.stringify({ upTo, queue: handQueue(l), here: hereIn(l) })}\n\n`);
  showHere(l);
  log(who, "watching", { room: l.id, pages: allListening() });
  req.on("close", () => {
    l.listening.delete(res);
    if (who) {
      const left = (l.pagesOf.get(who.name) ?? 1) - 1;
      if (left > 0) l.pagesOf.set(who.name, left);
      else {
        l.pagesOf.delete(who.name);
        l.goneSince.set(who.name, Date.now());
      }
    }
    log(who, "left", { room: l.id, pages: allListening() });
  });
}

// a comment line now and then, so Fly's proxy doesn't close a quiet stream
setInterval(() => tellAll(": still here\n\n"), 25_000).unref();

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://x");
  const me = room.findPerson(cookieId(req));

  // Which room: each at /r/<slug>/ (the open one's is "main"), and
  // everything a room's page asks for under it (its stream, what's said in
  // it) goes to that room. Its pages ask by relative address, so they don't
  // need to know. Everything else (the front page, the README, the page's
  // files, joining, opening a room) is the site's.
  let here: RoomInfo = room.roomById(MAIN)!;
  const inRoom = url.pathname.match(/^\/r\/([a-z0-9-]{1,40})(\/.*)?$/i);
  if (inRoom) {
    const found = room.roomBySlug(inRoom[1]);
    if (!found) return send(res, 404, "text/html; charset=utf-8", notFoundPage());
    if (!inRoom[2]) {
      res.writeHead(301, { location: `/r/${found.slug}/${url.search}` });
      res.end();
      return;
    }
    here = found;
    url.pathname = inRoom[2];
  }
  const roomRoute = !!inRoom;
  const l = liveOf(here.id);
  const base = `/r/${here.slug}/`;

  // the front page: what Said is, and every room to go into or open
  if (req.method === "GET" && url.pathname === "/" && !roomRoute) {
    const listed = room.rooms(me?.id).map((r) => ({ ...shown(r), here: hereIn(liveOf(r.id)).length, mine: !!me && r.maker === me.id }));
    return send(res, 200, "text/html; charset=utf-8", homePage(me ? { name: me.name, hue: hueOf(room.seatOf(me.name)) } : undefined, listed, url.searchParams.get("m") ?? undefined));
  }
  if (req.method === "GET" && url.pathname === "/" && roomRoute) {
    const transcript = room.transcript(here.id, 400);
    const mine = me ? { name: me.name, hue: hueOf(room.seatOf(me.name)), voice: room.voiceOfPerson(me.name) } : undefined;
    return send(res, 200, "text/html; charset=utf-8", roomPage({ ...shown(here), mine: !!me && here.maker === me.id }, mine, transcript, (name) => hueOf(room.seatOf(name)), handQueue(l), hereIn(l), room.newest(), url.searchParams.get("m") ?? undefined));
  }
  // what a room keeps, as plain text, to take away
  if (req.method === "GET" && url.pathname === "/transcript.txt" && roomRoute) {
    const file = `${here.slug}-${new Date().toISOString().slice(0, 10)}.txt`;
    return send(res, 200, "text/plain; charset=utf-8", transcriptText(here, room.transcript(here.id)), { "content-disposition": `attachment; filename="${file}"` });
  }
  if (req.method === "GET" && !roomRoute && (url.pathname === "/readme/" || url.pathname === "/readme")) {
    return send(res, 200, "text/html; charset=utf-8", readme);
  }
  if (req.method === "GET" && url.pathname === "/style.css" && !roomRoute) {
    return send(res, 200, "text/css; charset=utf-8", css);
  }
  const script = req.method === "GET" && !roomRoute && url.pathname.startsWith("/js/") && scriptOf(url.pathname.slice(4));
  if (script) {
    return send(res, 200, "text/javascript; charset=utf-8", script);
  }
  if (req.method === "GET" && url.pathname === "/events" && roomRoute) {
    return listen(req, res, l, url.searchParams.get("after"));
  }
  if (req.method === "GET" && url.pathname === "/api/messages" && roomRoute) {
    return json(res, 200, { me: me ? { name: me.name } : null, messages: room.recent(50, here.id) });
  }

  if (req.method === "POST" && !sameSite(req)) {
    log(me, "refused", { why: "cross-site", path: url.pathname, from: String(req.headers.origin ?? req.headers["sec-fetch-site"]) });
    return send(res, 403, "text/plain; charset=utf-8", "Changes can only come from this site's own pages");
  }

  // Joining: a name, and you're someone, on this browser, in every room.
  // From the front page or a room's, back to where it came from.
  if (req.method === "POST" && url.pathname === "/join") {
    const to = roomRoute ? base : "/";
    if (me) return back(res, to);
    if (joiningTooFast(req)) {
      log(undefined, "refused", { why: "too-many-joins" });
      return back(res, to, "too-many-joins");
    }
    const id = randomUUID();
    const result = room.join(id, new URLSearchParams((await body(req, 4096)) ?? "").get("name") ?? "");
    if (!result.ok) {
      log(undefined, "refused", { why: result.reason });
      return back(res, to, result.reason);
    }
    log(room.findPerson(id), "joined");
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, to, undefined, { "set-cookie": `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}` });
  }

  // A correction to a word someone's already said, live, for everyone: new
  // text, or gone. Only their own words (db.ts edit checks the message is
  // theirs); what's typed is cleaned like any word.
  if (req.method === "POST" && url.pathname === "/edit" && roomRoute) {
    if (!me) return json(res, 401, { error: "no-person" });
    if (tooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { id?: unknown; index?: unknown; text?: unknown; remove?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 1024)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-an-edit" });
    }
    const change: { text?: string; remove?: boolean } = {};
    if (raw.remove === true) change.remove = true;
    if (typeof raw.text === "string") {
      const text = raw.text.replace(/\s+/g, " ").trim();
      if (text.length < 1 || text.length > 40) return json(res, 400, { error: "not-an-edit" });
      change.text = text;
    }
    if (!Number.isSafeInteger(raw.id) || !Number.isSafeInteger(raw.index) || Object.keys(change).length === 0) return json(res, 400, { error: "not-an-edit" });
    const result = room.edit(me.id, raw.id as number, raw.index as number, change, here.id);
    if (!result) {
      log(me, "refused", { why: "not-theirs", message: raw.id as number });
      return json(res, 403, { error: "not-yours" });
    }
    log(me, "edited", { message: raw.id as number, word: raw.index as number, ...(change.text ? { text: change.text } : {}), ...(change.remove ? { removed: "yes" } : {}) });
    tell(l, `event: edited\ndata: ${JSON.stringify(result === "removed" ? { id: raw.id, removed: true } : phraseOf(result))}\n\n`);
    return json(res, 200, {});
  }

  // The voice someone's typed words are read out in (packs.ts VOICES), and
  // how much higher and faster: theirs, kept with them, in every room.
  if (req.method === "POST" && url.pathname === "/voice") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (voiceTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { voice?: unknown; pitch?: unknown; speed?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 256)) ?? "{}") ?? {};
    } catch {
      raw = {};
    }
    const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100 : v === undefined ? 0 : null);
    const [pitch, speed] = [n(raw.pitch), n(raw.speed)];
    if (!isVoice(raw.voice) || pitch === null || speed === null) return json(res, 400, { error: "not-a-voice" });
    room.setVoice(me.id, { voice: raw.voice, pitch, speed });
    log(me, "voice", { voice: raw.voice, pitch, speed });
    return json(res, 200, { voice: room.voiceOfPerson(me.name) });
  }

  // A hand up to speak next, or down: only your own (from the cookie). From
  // the page's script as JSON, or without it from the button's form.
  if (req.method === "POST" && url.pathname === "/hand" && roomRoute) {
    const form = !(req.headers["content-type"] ?? "").includes("json");
    if (!me) return form ? back(res, base, "no-person") : json(res, 401, { error: "no-person" });
    if (handTooFast(me.id)) return form ? back(res, base) : json(res, 429, { error: "too-fast" });
    const raw = (await body(req, 64)) ?? "";
    let up: unknown;
    try {
      up = form ? { true: true, false: false }[new URLSearchParams(raw).get("up") ?? ""] : (JSON.parse(raw || "{}") as { up?: unknown }).up;
    } catch {
      up = undefined;
    }
    if (typeof up !== "boolean") return form ? back(res, base) : json(res, 400, { error: "not-a-hand" });
    if (up && !l.hands.has(me.name)) {
      l.hands.set(me.name, Date.now());
      log(me, "hand", { up: "yes", place: l.hands.size });
      showHands(l);
    } else if (!up && l.hands.has(me.name)) {
      log(me, "hand", { up: "no" });
      handDown(l, me.name);
    }
    return form ? back(res, base) : json(res, 200, { queue: handQueue(l) });
  }

  // A new room: anyone who's joined may open one, with a name, what it's
  // about, how long it keeps what's said (packs.ts KEEPS) and whether it's
  // listed. From the front page's form, or as JSON; either way to the new
  // room after.
  if (req.method === "POST" && url.pathname === "/rooms" && !roomRoute) {
    const form = !(req.headers["content-type"] ?? "").includes("json");
    if (!me) return form ? back(res, "/", "no-person") : json(res, 401, { error: "no-person" });
    if (roomsTooFast(me.id)) return form ? back(res, "/", "too-many-rooms") : json(res, 429, { error: "too-fast" });
    const raw = (await body(req, 2048)) ?? "";
    let sent: { name?: unknown; about?: unknown; keep?: unknown; listed?: unknown } = {};
    try {
      if (form) {
        const f = new URLSearchParams(raw);
        sent = { name: f.get("name") ?? "", about: f.get("about") ?? "", keep: f.get("keep") ?? undefined, listed: f.get("listed") !== "no" };
      } else sent = JSON.parse(raw || "{}");
    } catch {
      sent = {};
    }
    const made = room.makeRoom(me.id, { name: typeof sent.name === "string" ? sent.name : "", about: typeof sent.about === "string" ? sent.about : "", keep: sent.keep, listed: sent.listed !== false });
    if (!made.ok) {
      log(me, "refused", { why: made.reason });
      return form ? back(res, "/", made.reason) : json(res, 400, { error: made.reason });
    }
    log(me, "opened", { room: made.room.slug, keep: made.room.keep, listed: made.room.listed ? "yes" : "no" });
    return form ? back(res, `/r/${made.room.slug}/`) : json(res, 201, { room: shown(made.room) });
  }

  // A change to this room (its name, what it's about, how long it keeps
  // what's said, whether it's listed): only by whoever opened it. Every
  // page in it shows the change; keeping less takes what's older down.
  if (req.method === "POST" && url.pathname === "/room" && roomRoute) {
    if (!me) return json(res, 401, { error: "no-person" });
    if (roomsTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let change: { name?: unknown; about?: unknown; keep?: unknown; listed?: unknown; close?: unknown } = {};
    try {
      change = JSON.parse((await body(req, 1024)) ?? "{}") ?? {};
    } catch {
      return json(res, 400, { error: "not-a-change" });
    }
    if (typeof change !== "object") return json(res, 400, { error: "not-a-change" });
    if (here.maker !== me.id) {
      log(me, "refused", { why: "not-their-room", room: here.slug });
      return json(res, 403, { error: "not-yours" });
    }
    if (change.close === true) {
      room.closeRoom(me.id, here.id);
      log(me, "closed", { room: here.slug });
      tell(l, `event: closed\ndata: {}\n\n`);
      return json(res, 200, { closed: true });
    }
    const changed = room.changeRoom(me.id, here.id, change);
    if (!changed) return json(res, 400, { error: "not-a-change" });
    log(me, "room", { room: changed.slug, name: changed.name, keep: changed.keep, listed: changed.listed ? "yes" : "no" });
    tell(l, `event: changed\ndata: ${JSON.stringify(shown(changed))}\n\n`);
    forget();
    return json(res, 200, { room: shown(changed) });
  }

  // Words heard early, while a phrase is still being said: shown to everyone
  // at once, faded, until the phrase ends and the real one (POST /say)
  // replaces them. Never stored or logged; each page keeps only the latest
  // for each speaker, keyed by a number the speaker's page chose.
  if (req.method === "POST" && url.pathname === "/early" && roomRoute) {
    if (!me) return json(res, 401, { error: "no-person" });
    if (earlyTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let parsed: { words?: unknown; draft?: unknown } = {};
    try {
      parsed = JSON.parse((await body(req, 32 * 1024)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-a-message" });
    }
    const words = clean(parsed.words);
    if (!words || !Number.isSafeInteger(parsed.draft)) return json(res, 400, { error: "not-a-message" });
    tell(l, `event: early\ndata: ${JSON.stringify({ name: me.name, hue: hueOf(room.seatOf(me.name)), draft: parsed.draft, words: words.map((w, i) => ({ html: wordHtml(w, (words[i + 1]?.start ?? w.end) - w.end) })) })}\n\n`);
    return json(res, 200, {});
  }

  if (req.method === "POST" && url.pathname === "/say" && roomRoute) {
    if (!me) {
      log(undefined, "refused", { why: "not-joined", path: "/say" });
      return json(res, 401, { error: "no-person" });
    }
    if (tooFast(me.id)) {
      log(me, "refused", { why: "too-fast", path: "/say" });
      return json(res, 429, { error: "too-fast" });
    }
    const raw = await body(req, 64 * 1024);
    let parsed: unknown;
    try {
      parsed = raw === null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const words = clean((parsed as { words?: unknown } | null)?.words);
    if (!words) {
      uncount(me.id);
      log(me, "refused", { why: "not-a-message" });
      return json(res, 400, { error: "not-a-message" });
    }
    // typed rather than said: shaped as asked, shown as typed
    const typed = (parsed as { typed?: unknown }).typed === true;
    const m = room.say(me.id, words, cleanVoice((parsed as { voice?: unknown }).voice), typed, here.id);
    const draft = (parsed as { draft?: unknown }).draft;
    log(me, typed ? "typed" : "said", { room: here.id, text: m.text });
    tell(l, event(m, Number.isSafeInteger(draft) ? (draft as number) : undefined));
    // they've had their turn
    if (Date.now() - (l.hands.get(me.name) ?? 0) > JUST_RAISED) handDown(l, me.name);
    return json(res, 201, { id: m.id });
  }

  send(res, 404, "text/plain; charset=utf-8", "Not found");
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, "text/plain; charset=utf-8", "Something went wrong");
  });
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => console.log(`${APP} listening on :${port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.closeAllConnections();
    server.close();
    room.close();
    process.exit(0);
  });
}
