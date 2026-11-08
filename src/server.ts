import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { MAIN, openRoom, type Message, type RoomInfo } from "./db.ts";
import { APP, notFoundPage, readmePage, roomPage, roomsPage, studioPage } from "./view.ts";
import { clean, cleanVoice, hueOf, wordHtml } from "./voice.ts";
import { readExpression, type Face } from "./face.ts";
import { cleanExpression, cleanPose, REST, type Expression, type Pose } from "./avatar.ts";
import { cleanBody, type Body } from "./body.ts";
import { cleanLook, emoteOf, isEffect, reactionOf, SCENES, stylesCss, type Look } from "./packs.ts";
import { cleanSpot, type Spot } from "./walk.ts";
import { overdue } from "./gone.ts";

// What's live in each room, in memory: the pages open on it (each a
// stream), whose they are, whose hand is up, who's up and walking about, and
// who's away. A room's words are stored; this is the moment, so a restart
// forgetting it is right. Rooms are made as they're first opened.
type Live = {
  id: number;
  listening: Set<ServerResponse>;
  pagesOf: Map<string, number>; // name, how many pages it has open here
  goneSince: Map<string, number>; // name, since when it's had none here
  hands: Map<string, number>; // name, when raised (oldest first)
  standing: Map<string, Spot>;
  awayShown: string;
};
const lives = new Map<number, Live>();
const liveOf = (id: number): Live => {
  let l = lives.get(id);
  if (!l) lives.set(id, (l = { id, listening: new Set(), pagesOf: new Map(), goneSince: new Map(), hands: new Map(), standing: new Map(), awayShown: "" }));
  return l;
};
const tell = (l: Live, payload: string): void => {
  for (const listener of l.listening) listener.write(payload);
};
// every page in every room: someone's look and face are theirs wherever
// they are, so every room that shows them hears of a change
const tellAll = (payload: string): void => {
  for (const l of lives.values()) tell(l, payload);
};
// A room as it's sent: never who made it (their id is their login), only
// whether it's yours, which the page works out from that
const shown = ({ maker: _, ...r }: RoomInfo): Omit<RoomInfo, "maker"> => r;
// who's in a room now: has a page open on it
const hereIn = (l: Live): string[] => [...l.pagesOf.keys()];
// who a room shows: its people, and whoever's in it now, but not anyone
// who's in another room now and not this one (gone to talk elsewhere: they
// come back when they do)
const elsewhere = (l: Live): Set<string> => {
  const out = new Set<string>();
  for (const o of lives.values()) if (o !== l) for (const name of o.pagesOf.keys()) if (!l.pagesOf.get(name)) out.add(name);
  return out;
};
const peopleIn = (l: Live): { name: string; seat: number }[] => {
  const gone = elsewhere(l);
  return room.people(16 + gone.size, l.id, hereIn(l)).filter((p) => !gone.has(p.name)).slice(0, 16);
};

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
  tellAll(`event: face\ndata: ${JSON.stringify({ name, e: e ?? REST, pose: e ? pose : null, body: e ? body : null })}\n\n`);
};
// Who has a hand up to speak next, in each room, in the order they raised
// it: for now, like a face, so in memory. A hand goes down when its owner
// says something there (unless they raised it a moment ago: what arrives
// then was said before), puts it down, or has had no page open on the room
// for GONE_FOR (a hand left up after someone's gone shouldn't keep its
// place; one waiting a long turn should). Every page in the room hears the
// whole queue each time it changes, so they all show it in the same order.
const JUST_RAISED = 3_000; // ms: about how late a phrase can arrive after its last word
const handQueue = (l: Live): string[] => [...l.hands.keys()];
const showHands = (l: Live): void => tell(l, `event: hand\ndata: ${JSON.stringify({ queue: handQueue(l) })}\n\n`);
const handDown = (l: Live, name: string): void => {
  if (l.hands.delete(name)) showHands(l);
};
// (gone a minute: hand down, back in their chair; see gone.ts)
setInterval(() => {
  for (const l of lives.values()) {
    const due = overdue(l, Date.now());
    for (const name of due.hands) handDown(l, name);
    for (const name of due.sit) showWalk(l, name, null);
    for (const name of due.forget) l.goneSince.delete(name);
  }
}, 10_000).unref();
// Who's in a room with no page open on it (a closed tab, a phone put away)
// for longer than a reload takes: shown as away, rather than as if they
// were sat there listening. They keep their place on the stage meanwhile,
// so their words stay where they were.
// (After a restart nobody's page is back yet, so it's counted from then.)
const AWAY_AFTER = 8_000;
const started = Date.now();
const away = (l: Live): string[] => peopleIn(l).flatMap((p) => (!l.pagesOf.get(p.name) && Date.now() - (l.goneSince.get(p.name) ?? started) > AWAY_AFTER ? [p.name] : []));
// (and who's in another room now: their card goes from this one until
// they're back)
const showAway = (l: Live): void => {
  if (!l.listening.size) return;
  const now = JSON.stringify({ away: away(l), elsewhere: [...elsewhere(l)] });
  if (now === l.awayShown) return;
  l.awayShown = now;
  tell(l, `event: here\ndata: ${now}\n\n`);
};
setInterval(() => {
  for (const l of lives.values()) showAway(l);
}, 2000).unref();
// Who's up and walking about a room, and where: like a face, in memory
// only, and never logged (a stream of positions says nothing to keep). Sat
// back down, gone for GONE_FOR, or into another room, they're in their seat
// again.
const showWalk = (l: Live, name: string, at: Spot | null): void => {
  // (up with no page open here, as one whose stream hasn't connected: the
  // same minute as anyone gone, from now)
  if (at && !l.pagesOf.get(name) && !l.goneSince.has(name)) l.goneSince.set(name, Date.now());
  if (at) l.standing.set(name, at);
  else if (!l.standing.delete(name)) return;
  tell(l, `event: walk\ndata: ${JSON.stringify({ name, at })}\n\n`);
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
const handTooFast = limiter(30);
const walkTooFast = limiter(200);
const looksTooFast = limiter(30);
const roomsTooFast = limiter(40);

// style.css, and after it how each word style in packs.ts is drawn
const css = Buffer.concat([readFileSync(new URL("./style.css", import.meta.url)), Buffer.from(`\n/* word styles, from packs.ts */\n${stylesCss()}\n`)]);
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// The page's own scripts are TypeScript in src/ like the server, so the
// browser and the server share voice.ts. Node strips the types the first
// time each is asked for (not at boot, so a server waking up answers sooner)
// and serves plain JavaScript, which keeps the app free of a build step. Only
// these files are served.
const SCRIPTS = new Set(["client.ts", "studio.ts", "voice.ts", "prosody.ts", "phrases.ts", "face.ts", "avatar.ts", "body.ts", "hands.ts", "handreader.ts", "packs.ts", "head3d.ts", "room3d.ts", "seats.ts", "camera.ts", "speech.ts", "worker.ts", "tap.ts", "typed.ts", "kokoro.ts", "kokoro-text.ts", "vad.ts", "walk.ts"]);
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

// back to a room's page (`to`, its address), with a message to show
const back = (res: ServerResponse, to: string, msg?: string, headers: Record<string, string> = {}): void => {
  res.writeHead(303, { location: msg ? `${to}?m=${msg}` : to, ...headers });
  res.end();
};

// Live updates go out as server-sent events: one long response per open page,
// and the server writes each new message down every one of them. Each event
// carries the message id, so a page that drops off and reconnects says the
// last one it saw (the browser does this itself) and gets what it missed.
// (each room's pages are its Live's `listening`; this counts them all)
const allListening = (): number => [...lives.values()].reduce((n, l) => n + l.listening.size, 0);
// each open page holds a connection on a 256 MB machine, so there's a ceiling
const MOST_LISTENING = 500;
// how many of the latest phrases a page coming back is sent as they stand
const CAUGHT_UP = 50;

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
  ...(m.typed ? { typed: true } : {}),
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
    ...(m.typed ? { typed: true } : {}),
    words: m.words.map((w, i) => ({
      html: wordHtml(w),
      t: w.start,
      d: tenths(w.end - w.start),
      gap: tenths((m.words[i + 1]?.start ?? w.end) - w.end),
      // how it was said, for speaking it: as the word's drawing already says
      say: [Math.round(w.loud), Math.round(w.pitch ?? 0), tenths(w.stretch), Math.round(w.rise)],
    })),
  })}\n\n`;

// Where a stream starts: after the phrase the browser last saw (Last-Event-ID,
// which it sends itself when it reconnects), or after the one a page was
// drawn with (?after=), or, failing that (?after=now), from now: words are
// for the moment they're said. A page that's coming back after its stream
// dropped says so (?back, or Last-Event-ID), and is told what changed.
function listen(req: IncomingMessage, res: ServerResponse, l: Live, after: string | null, back: boolean): void {
  // the page tries again itself, waiting longer each time
  if (allListening() >= MOST_LISTENING) return send(res, 503, "text/plain; charset=utf-8", "Too many people listening");
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", ...ISOLATED });
  // a reconnecting page catches up on what it missed; a new one starts now
  const coming = back || req.headers["last-event-id"] !== undefined;
  const last = Number(req.headers["last-event-id"] ?? (after === "now" ? room.newest() : after) ?? NaN);
  let upTo = Number.isSafeInteger(last) ? Math.max(last, 0) : room.newest();
  if (Number.isSafeInteger(last)) {
    for (const m of room.since(last, 200, l.id)) {
      try {
        res.write(event(m));
        upTo = m.id;
      } catch (err) {
        console.error(`message ${m.id} couldn't be drawn`, err);
      }
    }
  }
  // where this page is up to, so if the stream drops before anything's been
  // said, the browser's reconnect (which sends the last id it saw) catches up
  // on what it missed rather than starting from "now" again
  res.write(`id: ${upTo}\n: listening\n\n`);
  l.listening.add(res);
  const who = room.findPerson(cookieId(req));
  if (who) {
    const first = !l.pagesOf.get(who.name);
    l.pagesOf.set(who.name, (l.pagesOf.get(who.name) ?? 0) + 1);
    l.goneSince.delete(who.name);
    // (a new page starts them in their chair, so if they were left standing,
    // by a reload or a page closed while up, they sit for everyone too,
    // rather than standing where they were for a minute while their own
    // page has them sitting; a page back after a drop still has them up)
    if (first && !coming) showWalk(l, who.name, null);
    // someone come into a room that wasn't showing them: every page there
    // gives them a place
    if (first) tell(l, `event: joined\ndata: ${JSON.stringify({ name: who.name, hue: hueOf(room.seatOf(who.name)), look: room.lookOf(who.name) })}\n\n`);
  }
  // The room as it is now: whose hands are up and who's away. A page coming
  // back after its connection dropped (a phone asleep, a deploy) missed more
  // than what was said: who arrived or changed how they look, and what was
  // done to what's already on it. So it also gets who's on the stage and the
  // latest phrases as they stand, edited, reacted to, or gone.
  const now: Record<string, unknown> = { upTo, queue: handQueue(l), away: away(l), elsewhere: [...elsewhere(l)], standing: Object.fromEntries(l.standing) };
  if (coming) {
    const latest = room.recent(CAUGHT_UP, l.id);
    now.people = peopleIn(l).map((p) => ({ name: p.name, hue: hueOf(p.seat), look: room.lookOf(p.name) }));
    // (from the oldest it covers: one older that's on the page is past it)
    now.from = latest.length < CAUGHT_UP ? 0 : (latest.at(-1)?.id ?? 0);
    now.phrases = latest.flatMap((m) => {
      try {
        const { look: _, ...p } = phraseOf(m);
        return [p];
      } catch {
        return [];
      }
    });
  }
  res.write(`event: room\ndata: ${JSON.stringify(now)}\n\n`);
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

  // Which room: the main room at /, another at /r/<slug>/, and everything a
  // room's page asks for under it (its stream, what's said in it) goes to
  // that room. Its pages ask by relative address, so they don't need to know.
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
  const l = liveOf(here.id);
  const base = here.id === MAIN ? "/" : `/r/${here.slug}/`;

  if (req.method === "GET" && url.pathname === "/") {
    const seated = me ? { ...me, seat: room.seatOf(me.name) } : undefined;
    // (someone opening a room is in it from now, so they're on its page)
    const people = peopleIn(l);
    if (seated && !people.some((p) => p.name === seated.name)) people.unshift({ name: seated.name, seat: seated.seat });
    return send(res, 200, "text/html; charset=utf-8", roomPage(people, seated, url.searchParams.get("m") ?? undefined, room.record(12, 400, here.id), expressions, room.lookOf, room.threads(30, here.id), seated ? room.savedLooks(seated.id) : [], handQueue(l), away(l), room.newest(), { ...here, mine: !!me && here.maker === me.id }, room.rooms(me?.id)));
  }
  // every room, to find one or make one
  if (req.method === "GET" && url.pathname === "/rooms" && here.id === MAIN) {
    return send(res, 200, "text/html; charset=utf-8", roomsPage(room.rooms(me?.id).map((r) => ({ ...r, here: hereIn(liveOf(r.id)).length, mine: !!me && r.maker === me.id })), !!me, url.searchParams.get("m") ?? undefined));
  }
  // the studio, for making your avatar: only for someone who's joined (a
  // look is someone's), so anyone else is sent to join first
  if (req.method === "GET" && url.pathname === "/studio" && here.id === MAIN) {
    if (!me) return back(res, base, "no-person");
    const from = room.roomBySlug(url.searchParams.get("from") ?? "");
    return send(res, 200, "text/html; charset=utf-8", studioPage(me, room.lookOf(me.name), room.savedLooks(me.id), hueOf(room.seatOf(me.name)), from && from.id !== MAIN ? `/r/${from.slug}/` : "/"));
  }
  if (req.method === "GET" && here.id === MAIN && (url.pathname === "/readme/" || url.pathname === "/readme")) {
    return send(res, 200, "text/html; charset=utf-8", readme);
  }
  if (req.method === "GET" && url.pathname === "/style.css" && here.id === MAIN) {
    return send(res, 200, "text/css; charset=utf-8", css);
  }
  const script = req.method === "GET" && here.id === MAIN && url.pathname.startsWith("/js/") && scriptOf(url.pathname.slice(4));
  if (script) {
    return send(res, 200, "text/javascript; charset=utf-8", script);
  }
  if (req.method === "GET" && url.pathname === "/events") {
    return listen(req, res, l, url.searchParams.get("after"), url.searchParams.has("back"));
  }
  if (req.method === "GET" && url.pathname === "/api/messages") {
    return json(res, 200, { me: me ? { name: me.name } : null, messages: room.recent(50, here.id) });
  }

  if (req.method === "POST" && !sameSite(req)) {
    log(me, "refused", { why: "cross-site", path: url.pathname, from: String(req.headers.origin ?? req.headers["sec-fetch-site"]) });
    return send(res, 403, "text/plain; charset=utf-8", "Changes can only come from this site's own pages");
  }

  if (req.method === "POST" && url.pathname === "/join") {
    if (me) return back(res, base);
    if (joiningTooFast(req)) {
      log(undefined, "refused", { why: "too-many-joins" });
      return back(res, base, "too-many-joins");
    }
    const id = randomUUID();
    const result = room.join(id, new URLSearchParams((await body(req, 4096)) ?? "").get("name") ?? "");
    if (!result.ok) {
      log(undefined, "refused", { why: result.reason });
      return back(res, base, result.reason);
    }
    // every open page gives them a place straight away
    const joined = room.findPerson(id)!;
    log(joined, "joined", { seat: room.seatOf(joined.name) });
    const seat = room.seatOf(joined.name);
    const arrival = `event: joined\ndata: ${JSON.stringify({ name: joined.name, hue: hueOf(seat), look: room.lookOf(joined.name) })}\n\n`;
    tell(liveOf(MAIN), arrival);
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, base, undefined, {
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
    const result = room.edit(me.id, raw.id as number, raw.index as number, change, here.id);
    if (!result) {
      log(me, "refused", { why: "not-theirs", message: raw.id as number });
      return json(res, 403, { error: "not-yours" });
    }
    log(me, "edited", { message: raw.id as number, word: raw.index as number, ...(change.text ? { text: change.text } : {}), ...(change.effect !== undefined ? { effect: change.effect ?? "none" } : {}), ...(change.remove ? { removed: "yes" } : {}) });
    const payload =
      result === "removed"
        ? `event: edited\ndata: ${JSON.stringify({ id: raw.id, removed: true })}\n\n`
        : `event: edited\ndata: ${JSON.stringify(phraseOf(result))}\n\n`;
    tell(l, payload);
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
    tellAll(payload);
    return json(res, 200, { look });
  }

  // A look someone saves to wear again, in one of their slots: the look
  // they're wearing now, or none to clear it. Only their own slots (from the
  // cookie); never shown to anyone else until they wear one.
  if (req.method === "POST" && url.pathname === "/looks") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (looksTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { slot?: unknown; clear?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 256)) ?? "{}") ?? {};
    } catch {
      return json(res, 400, { error: "not-a-slot" });
    }
    if (typeof raw !== "object") return json(res, 400, { error: "not-a-slot" });
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
    tell(l, payload);
    return json(res, 200, {});
  }

  // A hand up to speak next, or down: only your own (from the cookie). From
  // the page's script as JSON, or without it from the button's form, which
  // comes back to the room.
  if (req.method === "POST" && url.pathname === "/hand") {
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
    if (typeof up !== "boolean") {
      log(me, "refused", { why: "not-a-hand" });
      return form ? back(res, base) : json(res, 400, { error: "not-a-hand" });
    }
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
    const result = room.react(me.id, raw.id as number, raw.index as number, reaction.id, here.id);
    if (!result) return json(res, 404, { error: "no-such-word" });
    log(me, result.on ? "reacted" : "unreacted", { to: result.owner, message: raw.id as number, word: raw.index as number, reaction: reaction.id });
    const payload = `event: reacted\ndata: ${JSON.stringify({ id: raw.id, index: raw.index, counts: result.counts })}\n\n`;
    tell(l, payload);
    return json(res, 200, { counts: result.counts, on: result.on });
  }

  // A new room: anyone who's joined may make one, with a name, a look
  // (packs.ts SCENE_PARTS) and whether it's listed. From the rooms page's
  // form, or as JSON; either way to the new room after.
  if (req.method === "POST" && url.pathname === "/rooms" && here.id === MAIN) {
    const form = !(req.headers["content-type"] ?? "").includes("json");
    if (!me) return form ? back(res, "/rooms", "no-person") : json(res, 401, { error: "no-person" });
    if (roomsTooFast(me.id)) return form ? back(res, "/rooms", "too-many-rooms") : json(res, 429, { error: "too-fast" });
    const raw = (await body(req, 2048)) ?? "";
    let sent: { name?: unknown; scene?: unknown; listed?: unknown } = {};
    try {
      if (form) {
        const f = new URLSearchParams(raw);
        const theme = SCENES.find((t) => t.id === f.get("theme"));
        sent = { name: f.get("name") ?? "", scene: theme?.scene, listed: f.get("listed") !== "no" };
      } else sent = JSON.parse(raw || "{}");
    } catch {
      sent = {};
    }
    const made = room.makeRoom(me.id, typeof sent.name === "string" ? sent.name : "", sent.scene, sent.listed !== false);
    if (!made.ok) {
      log(me, "refused", { why: made.reason });
      return form ? back(res, "/rooms", made.reason) : json(res, 400, { error: made.reason });
    }
    log(me, "made", { room: made.room.slug, listed: made.room.listed ? "yes" : "no" });
    return form ? back(res, `/r/${made.room.slug}/`) : json(res, 201, { room: shown(made.room) });
  }

  // A change to this room (its name, how it looks, whether it's listed):
  // only by whoever made it. Every page in it redraws it.
  if (req.method === "POST" && url.pathname === "/room") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (roomsTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let change: { name?: unknown; scene?: unknown; listed?: unknown } = {};
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
    const changed = room.changeRoom(me.id, here.id, change);
    if (!changed) return json(res, 400, { error: "not-a-change" });
    log(me, "room", { room: changed.slug, name: changed.name, ...changed.scene, listed: changed.listed ? "yes" : "no" });
    tell(l, `event: scene\ndata: ${JSON.stringify({ name: changed.name, scene: changed.scene, listed: changed.listed })}\n\n`);
    return json(res, 200, { room: shown(changed) });
  }

  // Up and walking about the room, or sat back down: where you stand (held
  // to the floor, out of the furniture), or { sit: true }. Only your own
  // (from the cookie). Shown to every open page as it happens; kept only
  // while you're up, so a page opened meanwhile sees you there.
  if (req.method === "POST" && url.pathname === "/walk") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (walkTooFast(me.id)) return json(res, 429, { error: "too-fast" });
    let raw: { at?: unknown; sit?: unknown } = {};
    try {
      raw = JSON.parse((await body(req, 256)) ?? "{}");
    } catch {
      return json(res, 400, { error: "not-a-place" });
    }
    if (raw.sit === true) {
      showWalk(l, me.name, null);
      return json(res, 200, { at: null });
    }
    const at = cleanSpot(raw.at);
    if (!at) return json(res, 400, { error: "not-a-place" });
    showWalk(l, me.name, at);
    return json(res, 200, { at });
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
    tell(l, payload);
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
    tell(l, payload);
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
    // typed rather than said: shaped as asked, shown as typed
    const typed = (parsed as { typed?: unknown }).typed === true;
    const m = room.say(me.id, words, cleanVoice((parsed as { voice?: unknown }).voice), faces.get(me.name) ?? null, typed, here.id);
    const draft = (parsed as { draft?: unknown }).draft;
    const w = words[0];
    log(me, typed ? "typed" : "said", {
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
    if (payload) tell(l, payload);
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
