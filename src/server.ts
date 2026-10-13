import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { openRoom, type Message } from "./db.ts";
import { APP, messageHtml, readmePage, roomPage } from "./view.ts";
import { clean } from "./voice.ts";

const css = readFileSync(new URL("./style.css", import.meta.url));
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// The page's own scripts are TypeScript in src/ like the server, so the
// browser and the server share voice.ts. Node strips the types once at boot
// and serves plain JavaScript, which keeps the app free of a build step. Only
// these files are served.
const scripts = new Map(
  ["client.ts", "voice.ts", "prosody.ts", "worker.ts", "tap.ts"].map((f) => [
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

async function body(req: IncomingMessage, limit: number): Promise<string | null> {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > limit) return null;
  }
  return text;
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

const event = (m: Message): string => `id: ${m.id}\nevent: said\ndata: ${JSON.stringify({ id: m.id, html: messageHtml(m) })}\n\n`;

function listen(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  const last = Number(req.headers["last-event-id"]);
  if (Number.isSafeInteger(last)) for (const m of room.since(last)) res.write(event(m));
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
    return send(res, 200, "text/html; charset=utf-8", roomPage(room.recent(), me, url.searchParams.get("m") ?? undefined));
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
    return listen(req, res);
  }
  if (req.method === "GET" && url.pathname === "/api/messages") {
    return json(res, 200, { me: me ? { name: me.name } : null, messages: room.recent() });
  }

  if (req.method === "POST" && url.pathname === "/join") {
    if (me) return back(res);
    const id = randomUUID();
    const result = room.join(id, new URLSearchParams((await body(req, 4096)) ?? "").get("name") ?? "");
    if (!result.ok) return back(res, result.reason);
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, undefined, {
      "set-cookie": `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/say") {
    if (!me) return json(res, 401, { error: "no-person" });
    const raw = await body(req, 64 * 1024);
    let parsed: unknown;
    try {
      parsed = raw === null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const words = clean((parsed as { words?: unknown } | null)?.words);
    if (!words) return json(res, 400, { error: "not-a-message" });
    const m = room.say(me.id, words);
    for (const listener of listening) listener.write(event(m));
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
