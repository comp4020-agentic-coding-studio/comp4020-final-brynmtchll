import { mkdirSync } from "node:fs";
import { join as joinPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GRANT, affordable, priceOf, reserve, span } from "./market.ts";

// /data is the Fly volume, the only storage that survives a restart or a
// redeploy. Locally it falls back to ./data.
const dir = process.env.DATA_DIR ?? (process.env.FLY_APP_NAME ? "/data" : "data");
mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(joinPath(dir, "market.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    coins INTEGER NOT NULL CHECK (coins >= 0),
    shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
    joined_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    qty INTEGER NOT NULL CHECK (qty > 0),
    amount INTEGER NOT NULL,
    supply_after INTEGER NOT NULL,
    at INTEGER NOT NULL
  );
`);

export type Player = { id: string; name: string; coins: number; shares: number; joined_at: number };

const supply = (): number =>
  Number((db.prepare("SELECT COALESCE(SUM(shares), 0) AS s FROM players").get() as { s: number }).s);

export const findPlayer = (id: string | undefined): Player | undefined =>
  id ? (db.prepare("SELECT * FROM players WHERE id = ?").get(id) as Player | undefined) : undefined;

// node:sqlite is synchronous and node runs one request at a time, but each
// trade still runs in its own transaction so a failure part-way leaves nothing
// half-written
function atomically<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export type JoinResult = { ok: true; player: Player } | { ok: false; reason: "name-bad" | "name-taken" };

export function join(id: string, rawName: string): JoinResult {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 20) return { ok: false, reason: "name-bad" };
  if (db.prepare("SELECT 1 FROM players WHERE name = ?").get(name)) return { ok: false, reason: "name-taken" };
  db.prepare("INSERT INTO players (id, name, coins, joined_at) VALUES (?, ?, ?, ?)").run(id, name, GRANT, Date.now());
  return { ok: true, player: findPlayer(id)! };
}

export type TradeResult =
  | { ok: true; qty: number; amount: number }
  | { ok: false; reason: "no-player" | "broke" | "no-shares" | "bad-qty" };

// qty is a whole number of shares, or "max" for as many as the player can
// afford (buying) or all they hold (selling)
export function trade(id: string, side: "buy" | "sell", want: number | "max"): TradeResult {
  return atomically((): TradeResult => {
    const p = findPlayer(id);
    if (!p) return { ok: false, reason: "no-player" };
    const s = supply();
    let qty: number;
    if (side === "buy") {
      qty = want === "max" ? affordable(s, p.coins) : want;
      if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: want === "max" ? "broke" : "bad-qty" };
      const cost = span(s, qty);
      if (cost > p.coins) return { ok: false, reason: "broke" };
      db.prepare("UPDATE players SET coins = coins - ?, shares = shares + ? WHERE id = ?").run(cost, qty, id);
      db.prepare("INSERT INTO trades (player_id, side, qty, amount, supply_after, at) VALUES (?, 'buy', ?, ?, ?, ?)")
        .run(id, qty, cost, s + qty, Date.now());
      return { ok: true, qty, amount: cost };
    }
    qty = want === "max" ? p.shares : want;
    if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: want === "max" ? "no-shares" : "bad-qty" };
    if (qty > p.shares) return { ok: false, reason: "no-shares" };
    const payout = span(s - qty, qty);
    db.prepare("UPDATE players SET coins = coins + ?, shares = shares - ? WHERE id = ?").run(payout, qty, id);
    db.prepare("INSERT INTO trades (player_id, side, qty, amount, supply_after, at) VALUES (?, 'sell', ?, ?, ?, ?)")
      .run(id, qty, payout, s - qty, Date.now());
    return { ok: true, qty, amount: payout };
  });
}

// a player as anyone can see them: the id is also their login cookie, so it
// never leaves the server
export type Row = Omit<Player, "id"> & { cashOut: number };
export type Trade = { name: string; side: "buy" | "sell"; qty: number; amount: number; supply_after: number; at: number };

// everything the page and /api/state show, in one consistent read
export function snapshot(meId?: string) {
  const s = supply();
  const players = db.prepare("SELECT * FROM players").all() as Player[];
  const totalCoins = players.reduce((sum, p) => sum + Number(p.coins), 0);
  // what each player would walk away with if they sold everything right now,
  // ahead of everyone else
  const ranked = players
    .map((p) => ({ ...p, cashOut: Number(p.coins) + span(s - Number(p.shares), Number(p.shares)) }))
    .sort((a, b) => b.cashOut - a.cashOut);
  const strip = ({ id: _id, ...row }: Player & { cashOut: number }): Row => row;
  const recent = db
    .prepare(
      `SELECT p.name, t.side, t.qty, t.amount, t.supply_after, t.at
       FROM trades t JOIN players p ON p.id = t.player_id ORDER BY t.id DESC LIMIT 12`,
    )
    .all() as Trade[];
  const history = (
    db.prepare("SELECT supply_after FROM trades ORDER BY id DESC LIMIT 400").all() as { supply_after: number }[]
  )
    .map((t) => priceOf(Number(t.supply_after) + 1))
    .reverse();
  const lastPrice = s > 0 ? priceOf(s) : 0;
  const pot = reserve(s);
  return {
    supply: s,
    nextPrice: priceOf(s + 1),
    lastPrice,
    pot,
    // every share valued at what the last one cost, which nobody could
    // actually realise: selling walks the price back down the curve
    paper: s * lastPrice,
    totalCoins,
    granted: players.length * GRANT,
    holders: players.filter((p) => Number(p.shares) > 0).length,
    players: ranked.map(strip),
    recent,
    history,
    me: ranked.filter((r) => r.id === meId).map(strip)[0],
  };
}

export type Snapshot = ReturnType<typeof snapshot>;
