import { DatabaseSync } from "node:sqlite";
import { GRANT, POP_AFTER, affordable, priceOf, reserve, span } from "./market.ts";

export type Player = { id: string; name: string; coins: number; shares: number; joined_at: number };

// a player as anyone can see them: the id is also their login cookie, so it
// never leaves the server
export type Row = Omit<Player, "id"> & { cashOut: number };

export type JoinResult = { ok: true } | { ok: false; reason: "name-bad" | "name-taken" };
export type TradeResult =
  | { ok: true; qty: number; amount: number }
  | { ok: false; reason: "no-player" | "broke" | "no-shares" | "bad-qty" };

type Bubble = { id: number; started_at: number; last_buy_at: number | null; popped_at: number | null; peak_supply: number; burned: number };

export type TapeEntry =
  | { kind: "trade"; name: string; side: "buy" | "sell"; qty: number; amount: number; at: number }
  | { kind: "pop"; bubble: number; burned: number; at: number };

export type PastBubble = {
  number: number;
  startedAt: number;
  poppedAt: number;
  peakPrice: number;
  burned: number;
  bag: { name: string; shares: number } | null;
};

// The market's state lives in one SQLite file. `now` is injectable so the
// pop can be checked without waiting five real minutes.
export function openMarket(file: string, now: () => number = Date.now) {
  const db = new DatabaseSync(file);
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
    CREATE TABLE IF NOT EXISTS bubbles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      last_buy_at INTEGER,
      popped_at INTEGER,
      peak_supply INTEGER NOT NULL DEFAULT 0,
      burned INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bubble_id INTEGER NOT NULL REFERENCES bubbles(id),
      player_id TEXT NOT NULL REFERENCES players(id),
      side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      qty INTEGER NOT NULL CHECK (qty > 0),
      amount INTEGER NOT NULL,
      supply_after INTEGER NOT NULL,
      at INTEGER NOT NULL
    );
    -- who was holding when a bubble popped, and their share of what vanished
    CREATE TABLE IF NOT EXISTS bags (
      bubble_id INTEGER NOT NULL REFERENCES bubbles(id),
      player_id TEXT NOT NULL REFERENCES players(id),
      shares INTEGER NOT NULL,
      lost INTEGER NOT NULL,
      PRIMARY KEY (bubble_id, player_id)
    );
  `);
  if (!db.prepare("SELECT 1 FROM bubbles WHERE popped_at IS NULL").get()) {
    db.prepare("INSERT INTO bubbles (started_at) VALUES (?)").run(now());
  }

  const num = (v: unknown): number => Number(v);
  const supply = (): number => num((db.prepare("SELECT COALESCE(SUM(shares), 0) AS s FROM players").get() as { s: number }).s);
  const current = (): Bubble => db.prepare("SELECT * FROM bubbles WHERE popped_at IS NULL").get() as Bubble;
  const findPlayer = (id: string | undefined): Player | undefined =>
    id ? (db.prepare("SELECT * FROM players WHERE id = ?").get(id) as Player | undefined) : undefined;

  // when the current bubble pops if nobody buys first, or null while there's
  // nothing to pop (no shares held, or no buy yet)
  const popsAt = (b: Bubble, s: number): number | null =>
    s > 0 && b.last_buy_at !== null ? num(b.last_buy_at) + POP_AFTER : null;

  // node:sqlite is synchronous and node runs one request at a time, but each
  // change still runs in its own transaction so a failure part-way leaves
  // nothing half-written
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

  // Pops the current bubble if its clock has run out. Nothing ticks on the
  // server (the machine sleeps when nobody's visiting), so every read and
  // write settles first, and a pop is dated to when the clock ran out rather
  // than when someone next looked.
  function settle(): void {
    const b = current();
    const s = supply();
    const at = popsAt(b, s);
    if (at === null || now() < at) return;
    const burned = reserve(s);
    const holders = db.prepare("SELECT id, shares FROM players WHERE shares > 0").all() as { id: string; shares: number }[];
    for (const h of holders) {
      db.prepare("INSERT INTO bags (bubble_id, player_id, shares, lost) VALUES (?, ?, ?, ?)")
        .run(b.id, h.id, h.shares, Math.round((burned * num(h.shares)) / s));
    }
    db.exec("UPDATE players SET shares = 0");
    db.prepare("UPDATE bubbles SET popped_at = ?, burned = ? WHERE id = ?").run(at, burned, b.id);
    db.prepare("INSERT INTO bubbles (started_at) VALUES (?)").run(at);
  }

  function join(id: string, rawName: string): JoinResult {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 20) return { ok: false, reason: "name-bad" };
    if (db.prepare("SELECT 1 FROM players WHERE name = ?").get(name)) return { ok: false, reason: "name-taken" };
    db.prepare("INSERT INTO players (id, name, coins, joined_at) VALUES (?, ?, ?, ?)").run(id, name, GRANT, now());
    return { ok: true };
  }

  // qty is a whole number of shares, or "max" for as many as the player can
  // afford (buying) or all they hold (selling)
  function trade(id: string, side: "buy" | "sell", want: number | "max"): TradeResult {
    return atomically((): TradeResult => {
      settle();
      const p = findPlayer(id);
      if (!p) return { ok: false, reason: "no-player" };
      const b = current();
      const s = supply();
      const t = now();
      const log = db.prepare(
        "INSERT INTO trades (bubble_id, player_id, side, qty, amount, supply_after, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      if (side === "buy") {
        const qty = want === "max" ? affordable(s, num(p.coins)) : want;
        if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: want === "max" ? "broke" : "bad-qty" };
        const cost = span(s, qty);
        if (cost > num(p.coins)) return { ok: false, reason: "broke" };
        db.prepare("UPDATE players SET coins = coins - ?, shares = shares + ? WHERE id = ?").run(cost, qty, id);
        // every buy restarts the clock
        db.prepare("UPDATE bubbles SET last_buy_at = ?, peak_supply = MAX(peak_supply, ?) WHERE id = ?").run(t, s + qty, b.id);
        log.run(b.id, id, "buy", qty, cost, s + qty, t);
        return { ok: true, qty, amount: cost };
      }
      const qty = want === "max" ? num(p.shares) : want;
      if (!Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: want === "max" ? "no-shares" : "bad-qty" };
      if (qty > num(p.shares)) return { ok: false, reason: "no-shares" };
      const payout = span(s - qty, qty);
      db.prepare("UPDATE players SET coins = coins + ?, shares = shares - ? WHERE id = ?").run(payout, qty, id);
      log.run(b.id, id, "sell", qty, payout, s - qty, t);
      return { ok: true, qty, amount: payout };
    });
  }

  // everything the page and /api/state show, in one consistent read
  function snapshot(meId?: string) {
    atomically(settle);
    const b = current();
    const s = supply();
    const players = db.prepare("SELECT * FROM players").all() as Player[];
    const totalCoins = players.reduce((sum, p) => sum + num(p.coins), 0);
    const burnedTotal = num((db.prepare("SELECT COALESCE(SUM(burned), 0) AS b FROM bubbles").get() as { b: number }).b);
    // what each player would walk away with if they sold everything right
    // now, ahead of everyone else
    const ranked = players
      .map((p) => ({ ...p, cashOut: num(p.coins) + span(s - num(p.shares), num(p.shares)) }))
      .sort((x, y) => y.cashOut - x.cashOut);
    const strip = ({ id: _id, ...row }: Player & { cashOut: number }): Row => row;

    const trades = (
      db.prepare(
        `SELECT p.name, t.side, t.qty, t.amount, t.at FROM trades t JOIN players p ON p.id = t.player_id
         ORDER BY t.id DESC LIMIT 12`,
      ).all() as Omit<Extract<TapeEntry, { kind: "trade" }>, "kind">[]
    ).map((t): TapeEntry => ({ kind: "trade", ...t }));
    const pops = (
      db.prepare("SELECT id, burned, popped_at FROM bubbles WHERE popped_at IS NOT NULL ORDER BY id DESC LIMIT 12").all() as {
        id: number;
        burned: number;
        popped_at: number;
      }[]
    ).map((p): TapeEntry => ({ kind: "pop", bubble: num(p.id), burned: num(p.burned), at: num(p.popped_at) }));
    const tape = [...trades, ...pops].sort((x, y) => num(y.at) - num(x.at)).slice(0, 12);

    const past = (
      db.prepare("SELECT * FROM bubbles WHERE popped_at IS NOT NULL ORDER BY id DESC LIMIT 8").all() as Bubble[]
    ).map((pb): PastBubble => {
      const bag = db
        .prepare(
          `SELECT p.name, g.shares FROM bags g JOIN players p ON p.id = g.player_id
           WHERE g.bubble_id = ? ORDER BY g.shares DESC LIMIT 1`,
        )
        .get(pb.id) as { name: string; shares: number } | undefined;
      return {
        number: num(pb.id),
        startedAt: num(pb.started_at),
        poppedAt: num(pb.popped_at),
        peakPrice: priceOf(num(pb.peak_supply)),
        burned: num(pb.burned),
        bag: bag ? { name: bag.name, shares: num(bag.shares) } : null,
      };
    });

    const history = (
      db.prepare("SELECT supply_after FROM trades WHERE bubble_id = ? ORDER BY id DESC LIMIT 400").all(b.id) as {
        supply_after: number;
      }[]
    )
      .map((t) => priceOf(num(t.supply_after) + 1))
      .reverse();

    const meRow = ranked.find((r) => r.id === meId);
    const myBags = meRow
      ? (db
          .prepare(
            `SELECT g.bubble_id AS bubble, g.shares, g.lost, b.popped_at AS at FROM bags g JOIN bubbles b ON b.id = g.bubble_id
             WHERE g.player_id = ? ORDER BY g.bubble_id DESC`,
          )
          .all(meRow.id) as { bubble: number; shares: number; lost: number; at: number }[])
      : [];

    const lastPrice = s > 0 ? priceOf(s) : 0;
    const pot = reserve(s);
    const at = popsAt(b, s);
    return {
      bubble: { number: num(b.id), startedAt: num(b.started_at), popsIn: at === null ? null : Math.max(0, at - now()) },
      supply: s,
      nextPrice: priceOf(s + 1),
      lastPrice,
      pot,
      // every share valued at what the last one cost, which nobody could
      // actually realise: selling walks the price back down the curve
      paper: s * lastPrice,
      totalCoins,
      burnedTotal,
      granted: players.length * GRANT,
      players: ranked.map(strip),
      tape,
      past,
      history,
      me: meRow
        ? {
            ...strip(meRow),
            bags: myBags.map((g) => ({ bubble: num(g.bubble), shares: num(g.shares), lost: num(g.lost), at: num(g.at) })),
          }
        : undefined,
    };
  }

  return { findPlayer, join, trade, snapshot, close: () => db.close() };
}

export type Market = ReturnType<typeof openMarket>;
export type Snapshot = ReturnType<Market["snapshot"]>;
