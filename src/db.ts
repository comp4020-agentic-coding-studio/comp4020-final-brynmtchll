import { DatabaseSync } from "node:sqlite";
import { compare, textOf, USUAL_OVER, type Usual, type Voice, type Word } from "./voice.ts";

export type Person = { id: string; name: string; joined_at: number };

// a message as anyone can see it: who said it by name, never by id, since the
// id is also their login cookie; and how it compared with how they usually
// sound, as worked out when they said it
export type Message = { id: number; name: string; text: string; words: Word[]; usual: Usual | null; at: number };

export type JoinResult = { ok: true } | { ok: false; reason: "name-bad" | "name-taken" };

type MessageRow = { id: number; name: string; text: string; words: string; usual: string | null; at: number };

// The room lives in one SQLite file: who has joined, and everything they've
// said. `now` is injectable so time can be pinned in a check.
export function openRoom(file: string, now: () => number = Date.now) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      joined_at INTEGER NOT NULL
    );
    -- the words and how each was said, as JSON; text is the same words plain,
    -- for anything that only wants to read them
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL REFERENCES people(id),
      text TEXT NOT NULL,
      words TEXT NOT NULL,
      at INTEGER NOT NULL
    );
  `);
  // added after the first messages were stored, so added to a table that may
  // already exist: the message's whole voice, and how it compared with usual
  // (both JSON, both null for a message from before they were kept)
  const columns = (db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("voice")) db.exec("ALTER TABLE messages ADD COLUMN voice TEXT");
  if (!columns.includes("usual")) db.exec("ALTER TABLE messages ADD COLUMN usual TEXT");

  const findPerson = (id: string | undefined): Person | undefined =>
    id ? (db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Person | undefined) : undefined;

  const toMessage = (r: MessageRow): Message => ({
    id: Number(r.id),
    name: r.name,
    text: r.text,
    words: (JSON.parse(r.words) as Word[]).map((w) => ({ ...w, contour: w.contour ?? [] })),
    usual: r.usual ? (JSON.parse(r.usual) as Usual) : null,
    at: Number(r.at),
  });

  const SELECT = "SELECT m.id, p.name, m.text, m.words, m.usual, m.at FROM messages m JOIN people p ON p.id = m.person_id";

  // Invisible characters (zero-width spaces, joiners, direction marks) are
  // dropped and the rest normalised, so two names that look the same are the
  // same name: nobody can pass as "alice" with "alice" and a zero-width space.
  function join(id: string, rawName: string): JoinResult {
    const name = rawName
      .normalize("NFKC")
      .replace(/[\p{Cf}\p{Cc}]/gu, "")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 20) return { ok: false, reason: "name-bad" };
    if (db.prepare("SELECT 1 FROM people WHERE name = ?").get(name)) return { ok: false, reason: "name-taken" };
    db.prepare("INSERT INTO people (id, name, joined_at) VALUES (?, ?, ?)").run(id, name, now());
    return { ok: true };
  }

  // the voices of someone's last few messages, oldest first
  const voices = (personId: string): Voice[] =>
    (
      db
        .prepare("SELECT voice FROM messages WHERE person_id = ? AND voice IS NOT NULL ORDER BY id DESC LIMIT ?")
        .all(personId, USUAL_OVER) as { voice: string }[]
    )
      .map((r) => JSON.parse(r.voice) as Voice)
      .reverse();

  // words and voice have already been through clean() and cleanVoice()
  function say(personId: string, words: Word[], voice: Voice | null = null): Message {
    const usual = voice ? compare(voice, voices(personId)) : null;
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (person_id, text, words, voice, usual, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(personId, textOf(words), JSON.stringify(words), voice && JSON.stringify(voice), usual && JSON.stringify(usual), now());
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(lastInsertRowid) as MessageRow);
  }

  // the latest messages, newest first
  const recent = (limit = 50): Message[] =>
    (db.prepare(`${SELECT} ORDER BY m.id DESC LIMIT ?`).all(limit) as MessageRow[]).map(toMessage);

  // everything said after a given message, oldest first: what a reconnecting
  // page missed while it was away
  const since = (id: number, limit = 200): Message[] =>
    (db.prepare(`${SELECT} WHERE m.id > ? ORDER BY m.id ASC LIMIT ?`).all(id, limit) as MessageRow[]).map(toMessage);

  // Who stands on the stage, and where: everyone who has said something in
  // the last WHILE, or joined in that time, most recent first, at most
  // `limit`. Each keeps the place they were given when they joined (their
  // join order, as `seat`), so nobody moves when someone arrives or leaves,
  // and every page puts them in the same spot.
  const WHILE = 60 * 60_000;
  const people = (limit = 16): { name: string; seat: number }[] =>
    (
      db
        .prepare(
          `SELECT p.name, p.rowid AS seat, MAX(COALESCE(MAX(m.at), 0), p.joined_at) AS last FROM people p
           LEFT JOIN messages m ON m.person_id = p.id
           GROUP BY p.id HAVING last > ? ORDER BY last DESC LIMIT ?`,
        )
        .all(now() - WHILE, limit) as { name: string; seat: number }[]
    ).map((r) => ({ name: r.name, seat: Number(r.seat) }));
  const seatOf = (name: string): number =>
    Number((db.prepare("SELECT rowid AS seat FROM people WHERE name = ?").get(name) as { seat: number } | undefined)?.seat ?? 0);

  const newest = (): number => Number((db.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM messages").get() as { n: number }).n);

  return { findPerson, join, say, recent, since, people, seatOf, newest, close: () => db.close() };
}

export type Room = ReturnType<typeof openRoom>;
