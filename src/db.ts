import { DatabaseSync } from "node:sqlite";
import { textOf, type Word } from "./voice.ts";

export type Person = { id: string; name: string; joined_at: number };

// a message as anyone can see it: who said it by name, never by id, since the
// id is also their login cookie
export type Message = { id: number; name: string; text: string; words: Word[]; at: number };

export type JoinResult = { ok: true } | { ok: false; reason: "name-bad" | "name-taken" };

type MessageRow = { id: number; name: string; text: string; words: string; at: number };

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

  const findPerson = (id: string | undefined): Person | undefined =>
    id ? (db.prepare("SELECT * FROM people WHERE id = ?").get(id) as Person | undefined) : undefined;

  const toMessage = (r: MessageRow): Message => ({
    id: Number(r.id),
    name: r.name,
    text: r.text,
    words: JSON.parse(r.words) as Word[],
    at: Number(r.at),
  });

  const SELECT = "SELECT m.id, p.name, m.text, m.words, m.at FROM messages m JOIN people p ON p.id = m.person_id";

  function join(id: string, rawName: string): JoinResult {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 20) return { ok: false, reason: "name-bad" };
    if (db.prepare("SELECT 1 FROM people WHERE name = ?").get(name)) return { ok: false, reason: "name-taken" };
    db.prepare("INSERT INTO people (id, name, joined_at) VALUES (?, ?, ?)").run(id, name, now());
    return { ok: true };
  }

  // words have already been through clean()
  function say(personId: string, words: Word[]): Message {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (person_id, text, words, at) VALUES (?, ?, ?, ?)")
      .run(personId, textOf(words), JSON.stringify(words), now());
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(lastInsertRowid) as MessageRow);
  }

  // the latest messages, newest first
  const recent = (limit = 50): Message[] =>
    (db.prepare(`${SELECT} ORDER BY m.id DESC LIMIT ?`).all(limit) as MessageRow[]).map(toMessage);

  // everything said after a given message, oldest first: what a reconnecting
  // page missed while it was away
  const since = (id: number, limit = 200): Message[] =>
    (db.prepare(`${SELECT} WHERE m.id > ? ORDER BY m.id ASC LIMIT ?`).all(id, limit) as MessageRow[]).map(toMessage);

  return { findPerson, join, say, recent, since, close: () => db.close() };
}

export type Room = ReturnType<typeof openRoom>;
