import { DatabaseSync } from "node:sqlite";
import { compare, textOf, USUAL_OVER, type Usual, type Voice, type Word } from "./voice.ts";
import { fullLook, lookFor, type Look } from "./packs.ts";

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
  // the speaker's face (an emoji) when they said it, if they were showing one
  if (!columns.includes("face")) db.exec("ALTER TABLE messages ADD COLUMN face TEXT");
  // a phrase every second or two per person adds up: who's been speaking
  // lately and someone's last few voices are looked up by person, newest first
  db.exec("CREATE INDEX IF NOT EXISTS messages_by_person ON messages (person_id, id)");

  // how each person's avatar looks (avatar.ts Look, as JSON), once they've chosen
  const peopleColumns = (db.prepare("PRAGMA table_info(people)").all() as { name: string }[]).map((c) => c.name);
  if (!peopleColumns.includes("look")) db.exec("ALTER TABLE people ADD COLUMN look TEXT");
  const setLook = (id: string, look: Look): void => void db.prepare("UPDATE people SET look = ? WHERE id = ?").run(JSON.stringify(look), id);
  // Looks someone has saved to wear again: SAVED_LOOKS slots, each a whole
  // look or empty, as JSON. Only ever read or written for them.
  const SAVED_LOOKS = 4;
  if (!peopleColumns.includes("looks")) db.exec("ALTER TABLE people ADD COLUMN looks TEXT");
  const savedLooks = (id: string): (Look | null)[] => {
    const r = db.prepare("SELECT looks FROM people WHERE id = ?").get(id) as { looks: string | null } | undefined;
    const kept = r?.looks ? (JSON.parse(r.looks) as unknown[]) : [];
    return Array.from({ length: SAVED_LOOKS }, (_, i) => (kept[i] ? fullLook(kept[i]) : null));
  };
  const saveLook = (id: string, slot: number, look: Look | null): (Look | null)[] | null => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= SAVED_LOOKS) return null;
    const looks = savedLooks(id);
    looks[slot] = look;
    db.prepare("UPDATE people SET looks = ? WHERE id = ?").run(JSON.stringify(looks), id);
    return looks;
  };
  // someone who hasn't chosen has one from their seat
  const lookOf = (name: string): Look => {
    const r = db.prepare("SELECT look, rowid AS seat FROM people WHERE name = ?").get(name) as { look: string | null; seat: number } | undefined;
    // (a look saved before some part existed gets that part's default)
    return r?.look ? fullLook(JSON.parse(r.look)) : lookFor(Number(r?.seat ?? 0));
  };

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

  // Reactions people put on words someone said: one each per word, whose
  // reaction it is by person (never shown by id), which word, and which
  // reaction (packs.ts REACTIONS). Gone with their message.
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      word INTEGER NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id),
      reaction TEXT NOT NULL,
      PRIMARY KEY (message_id, word, person_id)
    );
  `);
  // A reaction from someone to a word, on, or off if it's the one they'd
  // already put there; anyone who's joined may react to anyone's word (it's
  // theirs, not a change to the word). Returns the word's reactions after,
  // as counts, or null if there's no such word.
  type Counts = Record<string, number>;
  function react(personId: string, messageId: number, index: number, reaction: string): { counts: Counts; on: boolean; owner: string } | null {
    const row = db.prepare("SELECT m.words, p.name FROM messages m JOIN people p ON p.id = m.person_id WHERE m.id = ?").get(messageId) as { words: string; name: string } | undefined;
    if (!row || !Number.isInteger(index) || index < 0 || index >= (JSON.parse(row.words) as Word[]).length) return null;
    const had = db.prepare("SELECT reaction FROM reactions WHERE message_id = ? AND word = ? AND person_id = ?").get(messageId, index, personId) as { reaction: string } | undefined;
    const on = had?.reaction !== reaction;
    if (on) db.prepare("INSERT OR REPLACE INTO reactions (message_id, word, person_id, reaction) VALUES (?, ?, ?, ?)").run(messageId, index, personId, reaction);
    else db.prepare("DELETE FROM reactions WHERE message_id = ? AND word = ? AND person_id = ?").run(messageId, index, personId);
    return { counts: reactionsOn(messageId)[index] ?? {}, on, owner: row.name };
  }
  // every word of a message's reactions, as counts, by word
  function reactionsOn(messageId: number): Record<number, Counts> {
    const out: Record<number, Counts> = {};
    for (const r of db.prepare("SELECT word, reaction, COUNT(*) AS n FROM reactions WHERE message_id = ? GROUP BY word, reaction").all(messageId) as { word: number; reaction: string; n: number }[]) {
      (out[r.word] ??= {})[r.reaction] = Number(r.n);
    }
    return out;
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
  function say(personId: string, words: Word[], voice: Voice | null = null, face: string | null = null): Message {
    const usual = voice ? compare(voice, voices(personId)) : null;
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (person_id, text, words, voice, usual, face, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(personId, textOf(words), JSON.stringify(words), voice && JSON.stringify(voice), usual && JSON.stringify(usual), face, now());
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(lastInsertRowid) as MessageRow);
  }

  // A change someone makes to a word they've already said: new text (keeping
  // how it was said), an effect on or off, or the word gone. Only their own:
  // the message must be theirs, or nothing changes and null comes back. A
  // message left with no words is removed.
  type Edit = { text?: string; effect?: string | null; remove?: boolean };
  function edit(personId: string, messageId: number, index: number, change: Edit): Message | "removed" | null {
    const row = db.prepare("SELECT person_id, words FROM messages WHERE id = ?").get(messageId) as { person_id: string; words: string } | undefined;
    if (!row || row.person_id !== personId) return null;
    const words = JSON.parse(row.words) as Word[];
    if (!Number.isInteger(index) || index < 0 || index >= words.length) return null;
    if (change.remove) {
      words.splice(index, 1);
      // its reactions go with it, and the ones after it move up a word
      db.prepare("DELETE FROM reactions WHERE message_id = ? AND word = ?").run(messageId, index);
      db.prepare("UPDATE reactions SET word = word - 1 WHERE message_id = ? AND word > ?").run(messageId, index);
    } else {
      const w = { ...words[index] };
      if (change.text !== undefined) {
        w.w = change.text;
        // which letter was held belonged to the old spelling
        w.held = null;
      }
      if (change.effect !== undefined) {
        if (change.effect) w.effect = change.effect as Word["effect"];
        else delete w.effect;
      }
      words[index] = w;
    }
    if (words.length === 0) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
      return "removed";
    }
    db.prepare("UPDATE messages SET words = ?, text = ? WHERE id = ?").run(JSON.stringify(words), textOf(words), messageId);
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(messageId) as MessageRow);
  }

  // each person's last few messages, oldest first: what their thread shows
  // (with the reactions on each word)
  const threads = (perPerson = 30): Map<string, (Message & { reactions: Record<number, Counts> })[]> => {
    const out = new Map<string, (Message & { reactions: Record<number, Counts> })[]>();
    for (const m of (db.prepare(`${SELECT} ORDER BY m.id DESC LIMIT 600`).all() as MessageRow[]).map((r) => ({ ...toMessage(r), reactions: reactionsOn(Number(r.id)) }))) {
      const list = out.get(m.name) ?? [];
      if (list.length < perPerson) list.unshift(m);
      out.set(m.name, list);
    }
    return out;
  };

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

  // A brief record of what's been said lately: each person's words joined
  // into lines, a line ending when someone else speaks or after a pause of
  // LINE_BREAK, the newest last, at most `lines`. Words go out one at a time,
  // so this is what makes the room legible to someone who's just arrived.
  const LINE_BREAK = 8_000; // ms
  type Line = { name: string; seat: number; text: string; at: number; until: number; face: string | null };
  function record(lines = 12, scan = 400): Line[] {
    const rows = (
      db
        .prepare(
          `SELECT p.name, p.rowid AS seat, m.text, m.at, m.face FROM messages m JOIN people p ON p.id = m.person_id
           ORDER BY m.id DESC LIMIT ?`,
        )
        .all(scan) as { name: string; seat: number; text: string; at: number; face: string | null }[]
    ).reverse();
    const out: Line[] = [];
    for (const r of rows) {
      const last = out.at(-1);
      if (last && last.name === r.name && Number(r.at) - last.until < LINE_BREAK) {
        last.text += ` ${r.text}`;
        last.until = Number(r.at);
        // a line shows the face its speaker had for most of it: the latest one
        if (r.face) last.face = r.face;
      } else out.push({ name: r.name, seat: Number(r.seat), text: r.text, at: Number(r.at), until: Number(r.at), face: r.face });
    }
    return out.slice(-lines);
  }

  return { findPerson, join, say, edit, react, reactionsOn, threads, recent, since, people, seatOf, newest, record, setLook, lookOf, savedLooks, saveLook, close: () => db.close() };
}

export type Room = ReturnType<typeof openRoom>;
