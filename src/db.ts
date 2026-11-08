import { DatabaseSync } from "node:sqlite";
import { compare, textOf, USUAL_OVER, type Usual, type Voice, type Word } from "./voice.ts";
import { isVoice, keepMs, keepOf, MAIN_KEEP, voiceFor, type Keep, type VoiceId } from "./packs.ts";

export type Person = { id: string; name: string; joined_at: number };

// a message as anyone can see it: who said it by name, never by id, since the
// id is also their login cookie; how it compared with how they usually
// sound, as worked out when they said it; and whether it was typed instead
export type Message = { id: number; name: string; text: string; words: Word[]; usual: Usual | null; at: number; typed?: true };

// A room: one conversation, with its own transcript. The first, the main
// room, is everyone's and has no maker; anyone who's joined can open
// another, for a tutorial or a meeting or a table, with a name, what it's
// about, how long it keeps what's said (packs.ts KEEPS), and whether it's
// listed for anyone to find or only for those given its link. Its slug is
// its address (/r/<slug>/), made from its name.
export type RoomInfo = { id: number; slug: string; name: string; about: string; keep: Keep; listed: boolean; maker: string | null; made_at: number };

export type JoinResult = { ok: true } | { ok: false; reason: "name-bad" | "name-taken" };

type MessageRow = { id: number; name: string; text: string; words: string; usual: string | null; at: number; typed: number | null };

// Everything lives in one SQLite file: who has joined, the rooms, and what's
// been said in each, for as long as each keeps it. `now` is injectable so
// time can be pinned in a check.
export const MAIN = 1;
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
  // already exist (the database on the volume predates most of this)
  const columns = (db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("voice")) db.exec("ALTER TABLE messages ADD COLUMN voice TEXT");
  if (!columns.includes("usual")) db.exec("ALTER TABLE messages ADD COLUMN usual TEXT");
  if (!columns.includes("typed")) db.exec("ALTER TABLE messages ADD COLUMN typed INTEGER");
  if (!columns.includes("room")) db.exec("ALTER TABLE messages ADD COLUMN room INTEGER");
  db.exec("UPDATE messages SET room = 1 WHERE room IS NULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      listed INTEGER NOT NULL DEFAULT 1,
      maker TEXT REFERENCES people(id),
      made_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_by_room ON messages (room, id);
    CREATE INDEX IF NOT EXISTS messages_by_person ON messages (person_id, id);
  `);
  const roomColumns = (db.prepare("PRAGMA table_info(rooms)").all() as { name: string }[]).map((c) => c.name);
  if (!roomColumns.includes("about")) db.exec("ALTER TABLE rooms ADD COLUMN about TEXT NOT NULL DEFAULT ''");
  if (!roomColumns.includes("keep")) db.exec(`ALTER TABLE rooms ADD COLUMN keep TEXT NOT NULL DEFAULT '${MAIN_KEEP}'`);
  if (!db.prepare("SELECT 1 FROM rooms WHERE id = 1").get()) db.prepare("INSERT INTO rooms (id, slug, name, listed, maker, made_at, keep) VALUES (1, 'main', 'The main room', 1, NULL, ?, ?)").run(now(), MAIN_KEEP);
  // the main room was "The main room" with a 3D look before; it's the lobby now
  db.prepare("UPDATE rooms SET name = 'Open room', about = 'Anyone can talk here. Open a room of your own for a group.', keep = ? WHERE id = 1 AND about = ''").run(MAIN_KEEP);

  // the voice someone's typed words are read out in (packs.ts VOICES), and
  // how much higher and faster than it, once they've chosen
  const peopleColumns = (db.prepare("PRAGMA table_info(people)").all() as { name: string }[]).map((c) => c.name);
  if (!peopleColumns.includes("voice")) db.exec("ALTER TABLE people ADD COLUMN voice TEXT");
  type Spoken = { voice: VoiceId; pitch: number; speed: number };
  const seatOf = (name: string): number =>
    Number((db.prepare("SELECT rowid AS seat FROM people WHERE name = ?").get(name) as { seat: number } | undefined)?.seat ?? 0);
  const voiceOfPerson = (name: string): Spoken => {
    const r = db.prepare("SELECT voice FROM people WHERE name = ?").get(name) as { voice: string | null } | undefined;
    const kept = r?.voice ? (JSON.parse(r.voice) as Partial<Spoken>) : {};
    return { voice: isVoice(kept.voice) ? kept.voice : voiceFor(seatOf(name)), pitch: kept.pitch ?? 0, speed: kept.speed ?? 0 };
  };
  const setVoice = (id: string, v: Spoken): void => void db.prepare("UPDATE people SET voice = ? WHERE id = ?").run(JSON.stringify(v), id);

  const findPerson = (id: string | undefined): Person | undefined =>
    id ? (db.prepare("SELECT id, name, joined_at FROM people WHERE id = ?").get(id) as Person | undefined) : undefined;

  const toMessage = (r: MessageRow): Message => ({
    id: Number(r.id),
    name: r.name,
    text: r.text,
    // (effects people put on words before are dropped, but for a typed
    // whisper: there aren't any others now)
    words: (JSON.parse(r.words) as Word[]).map(({ effect, ...w }) => ({ ...w, contour: w.contour ?? [], ...(effect === "whisper" ? { effect } : {}) })),
    usual: r.usual ? (JSON.parse(r.usual) as Usual) : null,
    at: Number(r.at),
    ...(r.typed ? { typed: true as const } : {}),
  });

  const SELECT = "SELECT m.id, p.name, m.text, m.words, m.usual, m.at, m.typed FROM messages m JOIN people p ON p.id = m.person_id";

  // A name as typed, cleaned: invisible characters (zero-width spaces,
  // joiners, direction marks) dropped and the rest normalised, so two names
  // that look the same are the same name, and 1 to `most` long.
  const cleanName = (raw: string, most: number): string | null => {
    const name = raw.normalize("NFKC").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().replace(/\s+/g, " ");
    return name.length >= 1 && name.length <= most ? name : null;
  };
  function join(id: string, rawName: string): JoinResult {
    const name = cleanName(rawName, 20);
    if (!name) return { ok: false, reason: "name-bad" };
    if (db.prepare("SELECT 1 FROM people WHERE name = ?").get(name)) return { ok: false, reason: "name-taken" };
    db.prepare("INSERT INTO people (id, name, joined_at) VALUES (?, ?, ?)").run(id, name, now());
    return { ok: true };
  }

  // the voices of someone's last few messages, oldest first
  const voices = (personId: string): Voice[] =>
    (db.prepare("SELECT voice FROM messages WHERE person_id = ? AND voice IS NOT NULL ORDER BY id DESC LIMIT ?").all(personId, USUAL_OVER) as { voice: string }[])
      .map((r) => JSON.parse(r.voice) as Voice)
      .reverse();

  // words and voice have already been through clean() and cleanVoice()
  // (a typed one has no voice, so isn't compared with their usual)
  function say(personId: string, words: Word[], voice: Voice | null = null, typed = false, room = MAIN): Message {
    const usual = voice && !typed ? compare(voice, voices(personId)) : null;
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (person_id, text, words, voice, usual, typed, at, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(personId, textOf(words), JSON.stringify(words), typed ? null : voice && JSON.stringify(voice), usual && JSON.stringify(usual), typed ? 1 : null, now(), room);
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(lastInsertRowid) as MessageRow);
  }

  // A correction someone makes to a word they said (the speech model heard
  // "their" for "there"): new text, keeping how it was said, or the word
  // gone. Only their own: the message must be theirs, or nothing changes and
  // null comes back. A message left with no words is removed.
  type Edit = { text?: string; remove?: boolean };
  function edit(personId: string, messageId: number, index: number, change: Edit, room = MAIN): Message | "removed" | null {
    const row = db.prepare("SELECT person_id, words FROM messages WHERE id = ? AND room = ?").get(messageId, room) as { person_id: string; words: string } | undefined;
    if (!row || row.person_id !== personId) return null;
    const words = JSON.parse(row.words) as Word[];
    if (!Number.isInteger(index) || index < 0 || index >= words.length) return null;
    if (change.remove) words.splice(index, 1);
    else if (change.text !== undefined) words[index] = { ...words[index], w: change.text, held: null };
    if (words.length === 0) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
      return "removed";
    }
    db.prepare("UPDATE messages SET words = ?, text = ? WHERE id = ?").run(JSON.stringify(words), textOf(words), messageId);
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(messageId) as MessageRow);
  }

  // the latest messages in a room, newest first
  const recent = (limit = 50, room = MAIN): Message[] =>
    (db.prepare(`${SELECT} WHERE m.room = ? ORDER BY m.id DESC LIMIT ?`).all(room, limit) as MessageRow[]).map(toMessage);

  // the whole transcript a room keeps, oldest first: what its page opens
  // with, and what's downloaded
  const transcript = (room = MAIN, limit = 2000): Message[] =>
    (db.prepare(`${SELECT} WHERE m.room = ? ORDER BY m.id DESC LIMIT ?`).all(room, limit) as MessageRow[]).map(toMessage).reverse();

  // everything said in a room after a given message, oldest first: what a
  // reconnecting page missed while it was away
  const since = (id: number, limit = 200, room = MAIN): Message[] =>
    (db.prepare(`${SELECT} WHERE m.id > ? AND m.room = ? ORDER BY m.id ASC LIMIT ?`).all(id, room, limit) as MessageRow[]).map(toMessage);

  // who's spoken in a room within what it keeps, by when they last did
  const speakers = (room = MAIN): { name: string; seat: number; last: number }[] =>
    (
      db
        .prepare("SELECT p.name, p.rowid AS seat, MAX(m.at) AS last FROM messages m JOIN people p ON p.id = m.person_id WHERE m.room = ? GROUP BY p.id ORDER BY last DESC LIMIT 40")
        .all(room) as { name: string; seat: number; last: number }[]
    ).map((r) => ({ name: r.name, seat: Number(r.seat), last: Number(r.last) }));

  // (ids run across every room, so a page's place in one is just the newest)
  const newest = (): number => Number((db.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM messages").get() as { n: number }).n);

  // ---- rooms ----
  type RoomRow = { id: number; slug: string; name: string; about: string; keep: string; listed: number; maker: string | null; made_at: number };
  const toRoom = (r: RoomRow): RoomInfo => ({ id: Number(r.id), slug: r.slug, name: r.name, about: r.about ?? "", keep: keepOf(r.keep) ?? MAIN_KEEP, listed: !!r.listed, maker: r.maker, made_at: Number(r.made_at) });
  const ROOM = "SELECT id, slug, name, about, keep, listed, maker, made_at FROM rooms";
  const roomBySlug = (slug: string): RoomInfo | undefined => {
    const r = db.prepare(`${ROOM} WHERE slug = ?`).get(slug) as RoomRow | undefined;
    return r && toRoom(r);
  };
  const roomById = (id: number): RoomInfo | undefined => {
    const r = db.prepare(`${ROOM} WHERE id = ?`).get(id) as RoomRow | undefined;
    return r && toRoom(r);
  };
  // The rooms anyone can find, and any of yours that aren't: the main room
  // first, then the most lately talked in. Each with how many have spoken in
  // it in the last hour and when it was last talked in.
  const HOUR = 60 * 60_000;
  function rooms(personId?: string): (RoomInfo & { lately: number; last: number | null })[] {
    return (
      db
        .prepare(
          `SELECT r.id, r.slug, r.name, r.about, r.keep, r.listed, r.maker, r.made_at,
             (SELECT COUNT(DISTINCT m.person_id) FROM messages m WHERE m.room = r.id AND m.at > ?) AS lately,
             (SELECT MAX(m.at) FROM messages m WHERE m.room = r.id) AS last
           FROM rooms r WHERE r.listed = 1 OR r.maker = ? ORDER BY r.id = 1 DESC, COALESCE(last, r.made_at) DESC LIMIT 60`,
        )
        .all(now() - HOUR, personId ?? "") as (RoomRow & { lately: number; last: number | null })[]
    ).map((r) => ({ ...toRoom(r), lately: Number(r.lately), last: r.last === null ? null : Number(r.last) }));
  }
  // A room's address from its name: lower case, letters and digits joined
  // by dashes, made unique with a number if it's taken.
  const slugOf = (name: string): string => {
    const base = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "room";
    let slug = base;
    for (let n = 2; db.prepare("SELECT 1 FROM rooms WHERE slug = ?").get(slug) || slug === "main"; n++) slug = `${base}-${n}`;
    return slug;
  };
  const MOST_ROOMS_EACH = 12;
  const ABOUT = 140;
  type MakeResult = { ok: true; room: RoomInfo } | { ok: false; reason: "room-name-bad" | "too-many-rooms" | "not-a-keep" | "about-too-long" };
  function makeRoom(personId: string, made: { name: string; about?: string; keep?: unknown; listed?: boolean }): MakeResult {
    const name = cleanName(made.name, 40);
    if (!name) return { ok: false, reason: "room-name-bad" };
    const about = (made.about ?? "").normalize("NFKC").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().replace(/\s+/g, " ");
    if (about.length > ABOUT) return { ok: false, reason: "about-too-long" };
    const keep = made.keep === undefined ? "week" : keepOf(made.keep);
    if (!keep) return { ok: false, reason: "not-a-keep" };
    if (Number((db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE maker = ?").get(personId) as { n: number }).n) >= MOST_ROOMS_EACH) return { ok: false, reason: "too-many-rooms" };
    const { lastInsertRowid } = db.prepare("INSERT INTO rooms (slug, name, about, keep, listed, maker, made_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(slugOf(name), name, about, keep, made.listed === false ? 0 : 1, personId, now());
    return { ok: true, room: roomById(Number(lastInsertRowid))! };
  }
  // A change to a room: its name, what it's about, how long it keeps what's
  // said, whether it's listed. Only by whoever made it (the main room has
  // nobody who did). Null if it's not theirs or not a change. Keeping less
  // takes effect at once: what's older than it now is gone.
  function changeRoom(personId: string, id: number, change: { name?: unknown; about?: unknown; keep?: unknown; listed?: unknown }): RoomInfo | null {
    const r = roomById(id);
    if (!r || !r.maker || r.maker !== personId) return null;
    const name = change.name === undefined ? r.name : typeof change.name === "string" ? cleanName(change.name, 40) : null;
    const about = change.about === undefined ? r.about : typeof change.about === "string" ? change.about.normalize("NFKC").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().replace(/\s+/g, " ") : null;
    const keep = change.keep === undefined ? r.keep : keepOf(change.keep);
    const listed = change.listed === undefined ? r.listed : typeof change.listed === "boolean" ? change.listed : null;
    if (!name || about === null || about.length > ABOUT || !keep || listed === null) return null;
    db.prepare("UPDATE rooms SET name = ?, about = ?, keep = ?, listed = ? WHERE id = ?").run(name, about, keep, listed ? 1 : 0, id);
    forget();
    return roomById(id)!;
  }
  // A room closed by whoever made it: it and everything said in it, gone.
  function closeRoom(personId: string, id: number): boolean {
    const r = roomById(id);
    if (!r || !r.maker || r.maker !== personId) return false;
    db.prepare("DELETE FROM messages WHERE room = ?").run(id);
    db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
    return true;
  }

  // What each room no longer keeps, deleted: everything said in it longer
  // ago than it keeps. Run now and then by the server, and at once when a
  // room's made to keep less. Returns which rooms lost something, and how much.
  function forget(): Map<number, number> {
    const gone = new Map<number, number>();
    for (const r of db.prepare("SELECT id, keep FROM rooms").all() as { id: number; keep: string }[]) {
      const ms = keepMs(keepOf(r.keep) ?? MAIN_KEEP);
      if (ms === null) continue;
      const { changes } = db.prepare("DELETE FROM messages WHERE room = ? AND at < ?").run(Number(r.id), now() - ms);
      if (Number(changes)) gone.set(Number(r.id), Number(changes));
    }
    // and anything said in a room that's gone
    db.exec("DELETE FROM messages WHERE room NOT IN (SELECT id FROM rooms)");
    return gone;
  }

  return { findPerson, join, say, edit, recent, transcript, since, speakers, seatOf, newest, voiceOfPerson, setVoice, rooms, roomBySlug, roomById, makeRoom, changeRoom, closeRoom, forget, close: () => db.close() };
}

export type Room = ReturnType<typeof openRoom>;
