import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { openRoom, type Message } from "./db.ts";
import { APP, readmePage, roomPage } from "./view.ts";
import { clean, cleanVoice, hueOf, spotAt, wordHtml } from "./voice.ts";

const css = readFileSync(new URL("./style.css", import.meta.url));
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// The page's own scripts are TypeScript in src/ like the server, so the
// browser and the server share voice.ts. Node strips the types once at boot
// and serves plain JavaScript, which keeps the app free of a build step. Only
// these files are served.
const scripts = new Map(
  ["client.ts", "voice.ts", "prosody.ts", "phrases.ts", "worker.ts", "tap.ts"].map((f) => [
    f,
    stripTypeScriptTypes(readFileSync(new URL(`./${f}`, import.meta.url), "utf8")),
  ]),
);

// /data is the Fly volume, the only storage that survives a restart or a
// redeploy (the Dockerfile sets DATA_DIR); locally it falls back to ./data
const dir = process.env.DATA_DIR ?? "data";
mkdirSync(dir, { recursive: true });
const room = openRoom(joinPath(dir, "room.db"));

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

// No one person can fill the room: at most SAY_LIMIT phrases in any
// SAY_WINDOW. Someone talking without a break sends a phrase at every pause,
// and Whisper takes most of a second on each even on a fast machine, so
// ordinary talk sends one every second or two at most. Kept in memory; a
// restart forgets.
const SAY_LIMIT = 20;
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
// so the map doesn't keep everyone who ever spoke
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of said) if (times.every((t) => now - t >= SAY_WINDOW)) said.delete(id);
}, SAY_WINDOW).unref();

const tenths = (n: number): number => Math.round(n * 10) / 10;

// A phrase goes out as what the stage needs to play it: who, where they
// stand and in what colour, each word as HTML with when it was said, and the
// plain text for screen readers.
const event = (m: Message): string =>
  `id: ${m.id}\nevent: said\ndata: ${JSON.stringify({
    id: m.id,
    name: m.name,
    hue: hueOf(room.seatOf(m.name)),
    ...spotAt(room.seatOf(m.name)),
    text: m.text,
    at: m.at,
    words: m.words.map((w, i) => ({
      html: wordHtml(w),
      t: w.start,
      d: tenths(w.end - w.start),
      gap: tenths((m.words[i + 1]?.start ?? w.end) - w.end),
    })),
  })}\n\n`;

// Where a stream starts: after the message the browser last saw (Last-Event-ID,
// which it sends itself when it reconnects), or after the newest one the page
// was drawn with (?after=), so nothing said while the page loaded is lost.
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
  res.write(": listening\n\n");
  listening.add(res);
  req.on("close", () => listening.delete(res));
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
    return send(res, 200, "text/html; charset=utf-8", roomPage(room.people(), seated, url.searchParams.get("m") ?? undefined));
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
    return send(res, 403, "text/plain; charset=utf-8", "Changes can only come from this site's own pages");
  }

  if (req.method === "POST" && url.pathname === "/join") {
    if (me) return back(res);
    const id = randomUUID();
    const result = room.join(id, new URLSearchParams((await body(req, 4096)) ?? "").get("name") ?? "");
    if (!result.ok) return back(res, result.reason);
    // every open page gives them a place straight away
    const joined = room.findPerson(id)!;
    const seat = room.seatOf(joined.name);
    const arrival = `event: joined\ndata: ${JSON.stringify({ name: joined.name, hue: hueOf(seat), ...spotAt(seat) })}\n\n`;
    for (const listener of listening) listener.write(arrival);
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, undefined, {
      "set-cookie": `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/say") {
    if (!me) return json(res, 401, { error: "no-person" });
    if (tooFast(me.id)) return json(res, 429, { error: "too-fast" });
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
      return json(res, 400, { error: "not-a-message" });
    }
    const m = room.say(me.id, words, cleanVoice((parsed as { voice?: unknown }).voice));
    // stored, so it's sent: one listener that can't take it doesn't fail the rest
    let payload = "";
    try {
      payload = event(m);
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
