import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { openRoom, type Message } from "./db.ts";
import { APP, readmePage, roomPage, studioPage } from "./view.ts";
import { clean, cleanVoice, hueOf, wordHtml } from "./voice.ts";
import { readExpression, type Face } from "./face.ts";
import { cleanExpression, cleanPose, REST, type Expression, type Pose } from "./avatar.ts";
import { cleanBody, type Body } from "./body.ts";
import { cleanLook, emoteOf, isEffect, reactionOf, stylesCss, type Look } from "./packs.ts";

// Everyone's expression as they last showed it, in memory: a face is for now,
// so a restart forgetting it is right. A page showing a face sends it several
// times a second; one not heard from for FACE_FOR is taken to have gone (a
// phone put away, a closed tab), and put back to rest for everyone, so
// nobody's avatar is left frozen mid-grin. The emoji kept with each word in
// the record is read off the same numbers.
const FACE_FOR = 6_000;
const expressions = new Map<string, Expression>();
const faces = new Map<string, Face | null>(); // the emoji each expression reads as, for the record
const faceSeen = new Map<string, number>();
const showExpression = (name: string, e: Expression | null, pose: Pose | null = null, body: Body | null = null): void => {
  if (e) expressions.set(name, e);
  else expressions.delete(name);
  const face = e ? readExpression(e) : null;
  if ((faces.get(name) ?? null) !== face) {
    console.log(`${name.padEnd(18)} face      face="${face ?? "none"}"`);
    faces.set(name, face);
  }
  const payload = `event: face\ndata: ${JSON.stringify({ name, e: e ?? REST, pose: e ? pose : null, body: e ? body : null })}\n\n`;
  for (const listener of listening) listener.write(payload);
};
setInterval(() => {
  const now = Date.now();
  for (const [name, seen] of faceSeen) {
    if (now - seen < FACE_FOR) continue;
    faceSeen.delete(name);
    showExpression(name, null);
  }
}, 2000).unref();
// Faces and voices are limited apart from words, so a talker near the word
// limit can still clear their face. A page sends a face up to 20 times a
// second and a voice about 8; each limit leaves room over that.
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
const faceTooFast = limiter(300);
const voiceTooFast = limiter(150);
const earlyTooFast = limiter(120);
const emoteTooFast = limiter(20);
const reactTooFast = limiter(60);

// style.css, and after it how each word style in packs.ts is drawn
const css = Buffer.concat([readFileSync(new URL("./style.css", import.meta.url)), Buffer.from(`\n/* word styles, from packs.ts */\n${stylesCss()}\n`)]);
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// The page's own scripts are TypeScript in src/ like the server, so the
// browser and the server share voice.ts. Node strips the types once at boot
// and serves plain JavaScript, which keeps the app free of a build step. Only
// these files are served.
const scripts = new Map(
  ["client.ts", "studio.ts", "voice.ts", "prosody.ts", "phrases.ts", "face.ts", "avatar.ts", "body.ts", "hands.ts", "packs.ts", "head3d.ts", "worker.ts", "tap.ts"].map((f) => [
    f,
    stripTypeScriptTypes(readFileSync(new URL(`./${f}`, import.meta.url), "utf8")),
  ]),
);

// /data is the Fly volume, the only storage that survives a restart or a
// redeploy (the Dockerfile sets DATA_DIR); locally it falls back to ./data
const dir = process.env.DATA_DIR ?? "data";
mkdirSync(dir, { recursive: true });
const room = openRoom(joinPath(dir, "room.db"));

// Who did what, one line each, to stdout, where `flyctl logs` reads it: the
// person by name and a short tag of their id (enough to tell two people apart
// without printing the id itself, which is their login), the action, and what
// it was. Refusals say why. What someone said is logged as words only; there's
// never any audio or picture to log.
type Who = { id: string; name: string } | undefined;
const tag = (id: string): string => id.slice(0, 4);
function log(who: Who, action: string, detail: Record<string, unknown> = {}): void {
  const person = who ? `${who.name}#${tag(who.id)}` : "-";
  const rest = Object.entries(detail)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join(" ");
  console.log(`${person.padEnd(18)} ${action.padEnd(9)} ${rest}`.trimEnd());
}

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

function send(res: ServerResponse, status: number, type: string, payload: string | Buffer): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...ISOLATED });
  res.end(payload);
}

const json = (res: ServerResponse, status: number, value: unknown): void =>
  send(res, status, "application/json", JSON.stringify(value));

const back = (res: ServerResponse, msg?: string, headers: Record<string, string> = {}): void => {
  res.writeHead(303, { location: msg ? `/?m=${msg}` : "/", ...headers });
  res.end();
};

// Live updates go out as server-sent events: one long response per open page,
// and the server writes each new message down every one of them. Each event
// carries the message id, so a page that drops off and reconnects says the
// last one it saw (the browser does this itself) and gets what it missed.
const listening = new Set<ServerResponse>();
// each open page holds a connection on a 256 MB machine, so there's a ceiling
const MOST_LISTENING = 500;

// No one person can fill the room: at most SAY_LIMIT sends in any
// SAY_WINDOW. Each word goes out on its own as it leaves its speaker's queue,
// and someone talking without a break says two or three a second, so the
// limit is past that. Kept in memory; a restart forgets.
const SAY_LIMIT = 150; // a phrase at every pause, and every live edit, count
const SAY_WINDOW = 30_000;
// A send counts from when it arrives, before its body is read, so a burst of
// sends at once can't all slip in under the limit; one that turns out not to
// be a message is uncounted again.
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

// Joining is limited too, by where it comes from: each join gives the person
// a place on every open page, so a script joining over and over would fill
// the room with names and push the people actually talking off it. Fly's
// proxy says where a request really came from in Fly-Client-IP. A classroom
// on one network shares an address, so the limit is a room's worth.
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
}, JOIN_WINDOW).unref();
// so the map doesn't keep everyone who ever spoke
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of said) if (times.every((t) => now - t >= SAY_WINDOW)) said.delete(id);
}, SAY_WINDOW).unref();

const tenths = (n: number): number => Math.round(n * 10) / 10;

// A phrase goes out as what the stage needs to play it: who, where they
// stand and in what colour, each word as HTML with when it was said, and the
// plain text for screen readers.
// (with their look, so a page that had no card for them, or had let it go
// for room, can draw them as they are)
const phraseOf = (m: Message) => ({
  id: m.id,
  name: m.name,
  hue: hueOf(room.seatOf(m.name)),
  look: room.lookOf(m.name),
  text: m.text,
  at: m.at,
  words: m.words.map((w, i) => ({
    html: wordHtml(w),
    t: w.start,
    d: tenths(w.end - w.start),
    gap: tenths((m.words[i + 1]?.start ?? w.end) - w.end),
  })),
  reactions: room.reactionsOn(m.id),
});
const event = (m: Message, draft?: number): string =>
  `id: ${m.id}\nevent: said\ndata: ${JSON.stringify({
    ...(draft !== undefined ? { draft } : {}),
    id: m.id,
    name: m.name,
    hue: hueOf(room.seatOf(m.name)),
    look: room.lookOf(m.name),
    text: m.text,
    at: m.at,
    words: m.words.map((w, i) => ({
      html: wordHtml(w),
      t: w.start,
      d: tenths(w.end - w.start),
      gap: tenths((m.words[i + 1]?.start ?? w.end) - w.end),
    })),
  })}\n\n`;

// Where a stream starts: after the phrase the browser last saw (Last-Event-ID,
// which it sends itself when it reconnects), or, for a page just opened
// (?after=now), from now: words are for the moment they're said.
function listen(req: IncomingMessage, res: ServerResponse, after: string | null): void {
  // the page tries again itself, waiting longer each time
  if (listening.size >= MOST_LISTENING) return send(res, 503, "text/plain; charset=utf-8", "Too many people listening");
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", ...ISOLATED });
  // a reconnecting page catches up on what it missed; a new one starts now
  const last = Number(req.headers["last-event-id"] ?? (after === "now" ? room.newest() : after) ?? NaN);
  if (Number.isSafeInteger(last)) {
    for (const m of room.since(last)) {
      try {
        res.write(event(m));
      } catch (err) {
        console.error(`message ${m.id} couldn't be drawn`, err);
      }
    }
  }
  // where this page is up to, so if the stream drops before anything's been
  // said, the browser's reconnect (which sends the last id it saw) catches up
  // on what it missed rather than starting from "now" again
  res.write(`id: ${Number.isSafeInteger(last) ? Math.max(last, 0) : room.newest()}\n: listening\n\n`);
  listening.add(res);
  const who = room.findPerson(cookieId(req));
  log(who, "watching", { pages: listening.size });
  req.on("close", () => {
    listening.delete(res);
    log(who, "left", { pages: listening.size });
  });
}

// a comment line now and then, so Fly's proxy doesn't close a quiet stream
setInterval(() => {
  for (const res of listening) res.write(": still here\n\n");
}, 25_000).unref();

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://x");
  const me = room.findPerson(cookieId(req));

  if (req.method === "GET" && url.pathname === "/") {
    const seated = me ? { ...me, seat: room.seatOf(me.name) } : undefined;
    return send(res, 200, "text/html; charset=utf-8", roomPage(room.people(), seated, url.searchParams.get("m") ?? undefined, room.record(), expressions, room.lookOf, room.threads(), seated ? room.savedLooks(seated.id) : []));
  }
  // the studio, for making your avatar: only for someone who's joined (a
  // look is someone's), so anyone else is sent to join first
  if (req.method === "GET" && url.pathname === "/studio") {
    if (!me) return back(res, "no-person");
    return send(res, 200, "text/html; charset=utf-8", studioPage(me, room.lookOf(me.name), room.savedLooks(me.id), hueOf(room.seatOf(me.name))));
  }
  if (req.method === "GET" && (url.pathname === "/readme/" || url.pathname === "/readme")) {
    return send(res, 200, "text/html; charset=utf-8", readme);
  }
  if (req.method === "GET" && url.pathname === "/style.css") {
    return send(res, 200, "text/css; charset=utf-8", css);
  }
  const script = req.method === "GET" && url.pathname.startsWith("/js/") && scripts.get(url.pathname.slice(4));
  if (script) {
    return send(res, 200, "text/javascript; charset=utf-8", script);
  }
  if (req.method === "GET" && url.pathname === "/events") {
    return listen(req, res, url.searchParams.get("after"));
  }
  if (req.method === "GET" && url.pathname === "/api/messages") {
    return json(res, 200, { me: me ? { name: me.name } : null, messages: room.recent() });
  }

  if (req.method === "POST" && !sameSite(req)) {
    log(me, "refused", { why: "cross-site", path: url.pathname, from: String(req.headers.origin ?? req.headers["sec-fetch-site"]) });
    return send(res, 403, "text/plain; charset=utf-8", "Changes can only come from this site's own pages");
  }

  if (req.method === "POST" && url.pathname === "/join") {
    if (me) return back(res);
    if (joiningTooFast(req)) {
      log(undefined, "refused", { why: "too-many-joins" });
      return back(res, "too-many-joins");
    }
    const id = randomUUID();
    const result = room.join(id, new URLSearchParams((await body(req, 4096)) ?? "").get("name") ?? "");
    if (!result.ok) {
      log(undefined, "refused", { why: result.reason });
      return back(res, result.reason);
    }
    // every open page gives them a place straight away
    const joined = room.findPerson(id)!;
    log(joined, "joined", { seat: room.seatOf(joined.name) });
    const seat = room.seatOf(joined.name);
    const arrival = `event: joined\ndata: ${JSON.stringify({ name: joined.name, hue: hueOf(seat), look: room.lookOf(joined.name) })}\n\n`;
    for (const listener of listening) listener.write(arrival);
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, undefined, {
      "set-cookie": `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}`,
    });
  }

  // Someone's expression and how their head is turned, as numbers
  // (avatar.ts says which), or none: their avatar pulls it on every open
  // page. Nothing else is accepted, so no picture can ride along. Limited
  // apart from words.
  if (req.method === "POST" && url.pathname === "/face") {
    if (!me) {
      log(undefined, "refused", { why: "not-joined", path: "/face" });
      return json(res, 401, { error: "no-person" });
    }
    if (faceTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: unknown;
    let rawPose: unknown;
    let rawBody: unknown;
    try {
      // (arms and hands too: a few dozen numbers more)
      const sent = JSON.parse((await body(req, 2048)) ?? "{}") as { e?: unknown; pose?: unknown; body?: unknown };
      raw = sent.e ?? null;
      rawPose = sent.pose ?? null;
      rawBody = sent.body ?? null;
    } catch {
      return json(res, 400, { error: "not-a-face" });
    }
    const e = raw === null ? null : cleanExpression(raw);
    const pose = rawPose === null ? null : cleanPose(rawPose);
    const arms = rawBody === null ? null : cleanBody(rawBody);
    if ((raw !== null && !e) || (rawPose !== null && !pose) || (rawBody !== null && !arms)) {
      log(me, "refused", { why: "not-a-face" });
      return json(res, 400, { error: "not-a-face" });
    }
    if (e) faceSeen.set(me.name, Date.now());
    else faceSeen.delete(me.name);
    showExpression(me.name, e, pose, arms);
    return json(res, 200, {});
  }

  // A change to a word someone's already said, live, for everyone: new text,
  // an effect, or gone. Only their own words (db.ts edit checks the message
  // is theirs); what's typed is cleaned like any word.
  if (req.method === "POST" && url.pathname === "/edit") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (tooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { id?: unknown; index?: unknown; text?: unknown; effect?: unknown; remove?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 1024)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-an-edit" });
    }
    const change: { text?: string; effect?: string | null; remove?: boolean } = {};
    if (raw.remove === true) change.remove = true;
    if (typeof raw.text === "string") {
      const text = raw.text.replace(/\s+/g, " ").trim();
      if (text.length < 1 || text.length > 40) return json(res, 400, { error: "not-an-edit" });
      change.text = text;
    }
    if (raw.effect === null || isEffect(raw.effect)) change.effect = raw.effect as string | null;
    if (!Number.isSafeInteger(raw.id) || !Number.isSafeInteger(raw.index) || Object.keys(change).length === 0) {
      return json(res, 400, { error: "not-an-edit" });
    }
    const result = room.edit(me.id, raw.id as number, raw.index as number, change);
    if (!result) {
      log(me, "refused", { why: "not-theirs", message: raw.id as number });
      return json(res, 403, { error: "not-yours" });
    }
    log(me, "edited", { message: raw.id as number, word: raw.index as number, ...(change.text ? { text: change.text } : {}), ...(change.effect !== undefined ? { effect: change.effect ?? "none" } : {}), ...(change.remove ? { removed: "yes" } : {}) });
    const payload =
      result === "removed"
        ? `event: edited\ndata: ${JSON.stringify({ id: raw.id, removed: true })}\n\n`
        : `event: edited\ndata: ${JSON.stringify(phraseOf(result))}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, {});
  }

  // How someone's avatar looks, from the choices avatar.ts offers: kept with
  // them, and shown on every open page.
  if (req.method === "POST" && url.pathname === "/look") {
    if (!me) return json(res, 401, { error: "no-person" });
    let look: Look | null = null;
    try {
      // parts it doesn't mention stay as they were
      look = cleanLook((JSON.parse((await body(req, 2048)) ?? "{}") as { look?: unknown }).look, room.lookOf(me.name));
    } catch {
      look = null;
    }
    if (!look) {
      log(me, "refused", { why: "not-a-look" });
      return json(res, 400, { error: "not-a-look" });
    }
    room.setLook(me.id, look);
    log(me, "look", look);
    const payload = `event: look\ndata: ${JSON.stringify({ name: me.name, look })}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, { look });
  }

  // A look someone saves to wear again, in one of their slots: the look
  // they're wearing now, or none to clear it. Only their own slots (from the
  // cookie); never shown to anyone else until they wear one.
  if (req.method === "POST" && url.pathname === "/looks") {
    if (!me) return json(res, 401, { error: "no-person" });
    let raw: { slot?: unknown; clear?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 256)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-a-slot" });
    }
    const looks = room.saveLook(me.id, raw.slot as number, raw.clear === true ? null : room.lookOf(me.name));
    if (!looks) return json(res, 400, { error: "not-a-slot" });
    log(me, raw.clear === true ? "unsaved" : "saved", { slot: raw.slot as number });
    return json(res, 200, { looks });
  }

  // An emote (packs.ts EMOTES): someone's head does it, for everyone, for a
  // moment. Only one on offer, only their own head (who's doing it comes
  // from the cookie), and not too often. Logged, not stored.
  if (req.method === "POST" && url.pathname === "/emote") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (emoteTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let emote;
    try {
      emote = emoteOf((JSON.parse((await body(req, 256)) ?? "{}") as { emote?: unknown }).emote);
    } catch {
      emote = undefined;
    }
    if (!emote) {
      log(me, "refused", { why: "not-an-emote" });
      return json(res, 400, { error: "not-an-emote" });
    }
    log(me, "emote", { emote: emote.id });
    const payload = `event: emote\ndata: ${JSON.stringify({ name: me.name, emote: emote.id })}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, {});
  }

  // A reaction to a word (packs.ts REACTIONS), anyone's word: on, or off if
  // it's the one this person already put there. The reaction is theirs (from
  // the cookie), so it isn't a change to the word, and anyone who's joined
  // may; only one on offer. Kept with the word, shown on it for everyone.
  if (req.method === "POST" && url.pathname === "/react") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (reactTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { id?: unknown; index?: unknown; reaction?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 256)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-a-reaction" });
    }
    const reaction = reactionOf(raw.reaction);
    if (!reaction || !Number.isSafeInteger(raw.id) || !Number.isSafeInteger(raw.index)) return json(res, 400, { error: "not-a-reaction" });
    const result = room.react(me.id, raw.id as number, raw.index as number, reaction.id);
    if (!result) return json(res, 404, { error: "no-such-word" });
    log(me, result.on ? "reacted" : "unreacted", { to: result.owner, message: raw.id as number, word: raw.index as number, reaction: reaction.id });
    const payload = `event: reacted\ndata: ${JSON.stringify({ id: raw.id, index: raw.index, counts: result.counts })}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, { counts: result.counts, on: result.on });
  }

  // How loud someone is talking, as it happens: a few levels, 0 to 1, a
  // microphone batch each, which move their avatar's mouth on every open
  // page. Not the sound: a dozen numbers at most, each rounded. Never stored
  // or logged.
  if (req.method === "POST" && url.pathname === "/voice") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (voiceTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let levels: unknown;
    try {
      levels = (JSON.parse((await body(req, 512)) ?? "{}") as { levels?: unknown }).levels;
    } catch {
      return json(res, 400, { error: "not-a-voice" });
    }
    if (!Array.isArray(levels) || levels.length === 0 || levels.length > 12 || !levels.every((l) => typeof l === "number" && Number.isFinite(l))) {
      return json(res, 400, { error: "not-a-voice" });
    }
    const clean = levels.map((l: number) => Math.round(Math.min(1, Math.max(0, l)) * 100) / 100);
    const payload = `event: voice\ndata: ${JSON.stringify({ name: me.name, levels: clean })}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, {});
  }

  // Words heard early, while a phrase is still being said: shown to everyone
  // at once, faded, until the phrase ends and the real one (POST /say)
  // replaces them. Never stored or logged; each page keeps only the latest
  // for each speaker, keyed by a number the speaker's page chose.
  if (req.method === "POST" && url.pathname === "/early") {
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
    const payload = `event: early\ndata: ${JSON.stringify({
      name: me.name,
      hue: hueOf(room.seatOf(me.name)),
      look: room.lookOf(me.name),
      draft: parsed.draft,
      words: words.map((w, i) => ({ html: wordHtml(w), t: w.start, d: tenths(w.end - w.start), gap: tenths((words[i + 1]?.start ?? w.end) - w.end) })),
    })}\n\n`;
    for (const listener of listening) listener.write(payload);
    return json(res, 200, {});
  }

  if (req.method === "POST" && url.pathname === "/say") {
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
    const m = room.say(me.id, words, cleanVoice((parsed as { voice?: unknown }).voice), faces.get(me.name) ?? null);
    const draft = (parsed as { draft?: unknown }).draft;
    const w = words[0];
    log(me, "said", {
      text: m.text,
      ...(w.effect ? { effect: w.effect } : {}),
      ...(Math.abs(w.loud) >= 6 ? { loud: w.loud } : {}),
      ...(w.stretch >= 1 ? { drawn: "out" } : {}),
    });
    // stored, so it's sent: one listener that can't take it doesn't fail the rest
    let payload = "";
    try {
      payload = event(m, Number.isSafeInteger(draft) ? (draft as number) : undefined);
    } catch (err) {
      console.error(`message ${m.id} couldn't be drawn`, err);
    }
    if (payload) for (const listener of listening) listener.write(payload);
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
