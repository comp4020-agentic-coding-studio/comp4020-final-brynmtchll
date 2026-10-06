import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { marked } from "marked";
import { openMarket } from "./db.ts";
import { marketPage, readmePage } from "./view.ts";

const css = readFileSync(new URL("./style.css", import.meta.url));
const readme = readmePage(await marked.parse(readFileSync("README.md", "utf8")));

// /data is the Fly volume, the only storage that survives a restart or a
// redeploy (the Dockerfile sets DATA_DIR); locally it falls back to ./data
const dir = process.env.DATA_DIR ?? "data";
mkdirSync(dir, { recursive: true });
const market = openMarket(joinPath(dir, "market.db"));

const COOKIE = "air_id";
const YEAR = 60 * 60 * 24 * 365;

const cookieId = (req: IncomingMessage): string | undefined =>
  req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)`))?.[1];

async function form(req: IncomingMessage): Promise<URLSearchParams> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) break;
  }
  return new URLSearchParams(body);
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

const back = (res: ServerResponse, msg?: string, headers: Record<string, string> = {}): void => {
  res.writeHead(303, { location: msg ? `/?m=${msg}` : "/", ...headers });
  res.end();
};

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://x");
  const me = market.findPlayer(cookieId(req));

  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, "text/html; charset=utf-8", marketPage(market.snapshot(me?.id), url.searchParams.get("m") ?? undefined));
  }
  if (req.method === "GET" && (url.pathname === "/readme/" || url.pathname === "/readme")) {
    return send(res, 200, "text/html; charset=utf-8", readme);
  }
  if (req.method === "GET" && url.pathname === "/style.css") {
    return send(res, 200, "text/css; charset=utf-8", css);
  }
  if (req.method === "GET" && url.pathname === "/api/state") {
    return send(res, 200, "application/json", JSON.stringify(market.snapshot(me?.id)));
  }

  if (req.method === "POST" && url.pathname === "/join") {
    if (me) return back(res);
    const id = randomUUID();
    const result = market.join(id, (await form(req)).get("name") ?? "");
    if (!result.ok) return back(res, result.reason);
    // behind Fly's proxy the browser is on https, so the cookie can insist on it
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return back(res, undefined, {
      "set-cookie": `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/trade") {
    if (!me) return back(res, "no-player");
    const f = await form(req);
    const side = f.get("side");
    const raw = f.get("qty") ?? "";
    if (side !== "buy" && side !== "sell") return back(res, "bad-qty");
    const qty = raw === "max" ? "max" : /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
    const result = market.trade(me.id, side, qty);
    return back(res, result.ok ? undefined : result.reason);
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
server.listen(port, "0.0.0.0", () => console.log(`AIR listening on :${port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    market.close();
    process.exit(0);
  });
}
