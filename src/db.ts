import { DatabaseSync } from "node:sqlite";
import { compare, textOf, USUAL_OVER, type Usual, type Voice, type Word } from "./voice.ts";
import { cleanScene, DEFAULT_SCENE, fullLook, fullScene, lookFor, type Look, type Scene } from "./packs.ts";

export type Person = { id: string; name: string; joined_at: number };

// a message as anyone can see it: who said it by name, never by id, since the
// id is also their login cookie; and how it compared with how they usually
// sound, as worked out when they said it; and whether it was typed instead
export type Message = { id: number; name: string; text: string; words: Word[]; usual: Usual | null; at: number; typed?: true };

// A room people talk in. The first, the main room, is everyone's and has no
// maker; anyone who's joined can make another, with a name, a look, and
// whether it's listed for anyone to find or only for those given its link.
// Its slug is its address (/r/<slug>/), made from its name.
export type RoomInfo = { id: number; slug: string; name: string; scene: Scene; listed: boolean; maker: string | null; made_at: number };

export type JoinResult = { ok: true } | { ok: false; reason: "name-bad" | "name-taken" };

type MessageRow = { id: number; name: string; text: string; words: string; usual: string | null; at: number; typed: number | null };

// The room lives in one SQLite file: who has joined, and everything they've
// said. `now` is injectable so time can be pinned in a check.
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
  // already exist: the message's whole voice, and how it compared with usual
  // (both JSON, both null for a message from before they were kept)
  const columns = (db.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes("voice")) db.exec("ALTER TABLE messages ADD COLUMN voice TEXT");
  if (!columns.includes("usual")) db.exec("ALTER TABLE messages ADD COLUMN usual TEXT");
  // the speaker's face (an emoji) when they said it, if they were showing one
  if (!columns.includes("face")) db.exec("ALTER TABLE messages ADD COLUMN face TEXT");
  // 1 for a message typed rather than said (its shape is the one asked for)
  if (!columns.includes("typed")) db.exec("ALTER TABLE messages ADD COLUMN typed INTEGER");
  // which room it was said in (null, for one from before there were rooms, is
  // the main room's)
  if (!columns.includes("room")) db.exec("ALTER TABLE messages ADD COLUMN room INTEGER");
  db.exec("UPDATE messages SET room = 1 WHERE room IS NULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      scene TEXT,
      listed INTEGER NOT NULL DEFAULT 1,
      maker TEXT REFERENCES people(id),
      made_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_by_room ON messages (room, id);
  `);
  if (!db.prepare("SELECT 1 FROM rooms WHERE id = 1").get()) db.prepare("INSERT INTO rooms (id, slug, name, scene, listed, maker, made_at) VALUES (1, 'main', 'The main room', NULL, 1, NULL, ?)").run(now());
  // Space: a room with nothing in it but what people say, where each person
  // is their words (view.ts spacePage). Unlisted: it's reached from the
  // header, not the rooms list.
  if (!db.prepare("SELECT 1 FROM rooms WHERE slug = 'space'").get()) db.prepare("INSERT INTO rooms (slug, name, scene, listed, maker, made_at) VALUES ('space', 'Space', NULL, 0, NULL, ?)").run(now());
  // where each person last was in Space, 0 to 1 across and down it, so they
  // come back to the same spot and everyone sees them there
  db.exec("CREATE TABLE IF NOT EXISTS spots (person_id TEXT PRIMARY KEY REFERENCES people(id), x REAL NOT NULL, y REAL NOT NULL, at INTEGER NOT NULL)");
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
    ...(r.typed ? { typed: true as const } : {}),
  });

  const SELECT = "SELECT m.id, p.name, m.text, m.words, m.usual, m.at, m.typed FROM messages m JOIN people p ON p.id = m.person_id";

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
  function react(personId: string, messageId: number, index: number, reaction: string, room = MAIN): { counts: Counts; on: boolean; owner: string } | null {
    const row = db.prepare("SELECT m.words, p.name FROM messages m JOIN people p ON p.id = m.person_id WHERE m.id = ? AND m.room = ?").get(messageId, room) as { words: string; name: string } | undefined;
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
  // (a typed one has no voice, so isn't compared with their usual)
  function say(personId: string, words: Word[], voice: Voice | null = null, face: string | null = null, typed = false, room = MAIN): Message {
    const usual = voice && !typed ? compare(voice, voices(personId)) : null;
    const { lastInsertRowid } = db
      .prepare("INSERT INTO messages (person_id, text, words, voice, usual, face, typed, at, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(personId, textOf(words), JSON.stringify(words), typed ? null : voice && JSON.stringify(voice), usual && JSON.stringify(usual), face, typed ? 1 : null, now(), room);
    return toMessage(db.prepare(`${SELECT} WHERE m.id = ?`).get(lastInsertRowid) as MessageRow);
  }

  // A change someone makes to a word they've already said: new text (keeping
  // how it was said), an effect on or off, or the word gone. Only their own:
  // the message must be theirs, or nothing changes and null comes back. A
  // message left with no words is removed.
  type Edit = { text?: string; effect?: string | null; remove?: boolean };
  function edit(personId: string, messageId: number, index: number, change: Edit, room = MAIN): Message | "removed" | null {
    const row = db.prepare("SELECT person_id, words FROM messages WHERE id = ? AND room = ?").get(messageId, room) as { person_id: string; words: string } | undefined;
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
  const threads = (perPerson = 30, room = MAIN): Map<string, (Message & { reactions: Record<number, Counts> })[]> => {
    const out = new Map<string, (Message & { reactions: Record<number, Counts> })[]>();
    for (const m of (db.prepare(`${SELECT} WHERE m.room = ? ORDER BY m.id DESC LIMIT 600`).all(room) as MessageRow[]).map((r) => ({ ...toMessage(r), reactions: reactionsOn(Number(r.id)) }))) {
      const list = out.get(m.name) ?? [];
      if (list.length < perPerson) list.unshift(m);
      out.set(m.name, list);
    }
    return out;
  };

  // the latest messages, newest first
  const recent = (limit = 50, room = MAIN): Message[] =>
    (db.prepare(`${SELECT} WHERE m.room = ? ORDER BY m.id DESC LIMIT ?`).all(room, limit) as MessageRow[]).map(toMessage);

  // everything said after a given message, oldest first: what a reconnecting
  // page missed while it was away
  const since = (id: number, limit = 200, room = MAIN): Message[] =>
    (db.prepare(`${SELECT} WHERE m.id > ? AND m.room = ? ORDER BY m.id ASC LIMIT ?`).all(id, room, limit) as MessageRow[]).map(toMessage);

  // Who stands on the stage, and where: everyone who has said something in
  // the last WHILE, or joined in that time, most recent first, at most
  // `limit`. Each keeps the place they were given when they joined (their
  // join order, as `seat`), so nobody moves when someone arrives or leaves,
  // and every page puts them in the same spot.
  const WHILE = 60 * 60_000;
  // In another room than the main one, it's who's said something there, and
  // who's in it now (`here`, from the server, which knows whose pages are
  // open where); joining puts someone in the main room only.
  const people = (limit = 16, room = MAIN, here: string[] = []): { name: string; seat: number }[] => {
    const rows = (
      room === MAIN
        ? db
            .prepare(
              `SELECT p.name, p.rowid AS seat, MAX(COALESCE(MAX(m.at), 0), p.joined_at) AS last FROM people p
               LEFT JOIN messages m ON m.person_id = p.id AND m.room = 1
               GROUP BY p.id HAVING last > ? ORDER BY last DESC LIMIT ?`,
            )
            .all(now() - WHILE, limit)
        : db
            .prepare(
              `SELECT p.name, p.rowid AS seat, MAX(m.at) AS last FROM people p
               JOIN messages m ON m.person_id = p.id AND m.room = ?
               GROUP BY p.id HAVING last > ? ORDER BY last DESC LIMIT ?`,
            )
            .all(room, now() - WHILE, limit)
    ) as { name: string; seat: number }[];
    const out = rows.map((r) => ({ name: r.name, seat: Number(r.seat) }));
    // (whoever's in it now and hasn't spoken yet, first: they've just come)
    for (const name of here) {
      if (out.some((p) => p.name === name)) continue;
      const seat = (db.prepare("SELECT rowid AS seat FROM people WHERE name = ?").get(name) as { seat: number } | undefined)?.seat;
      if (seat !== undefined) out.unshift({ name, seat: Number(seat) });
    }
    return out.slice(0, limit);
  };
  const seatOf = (name: string): number =>
    Number((db.prepare("SELECT rowid AS seat FROM people WHERE name = ?").get(name) as { seat: number } | undefined)?.seat ?? 0);

  // (ids run across every room, so a page's place in one is just the newest)
  const newest = (): number => Number((db.prepare("SELECT COALESCE(MAX(id), 0) AS n FROM messages").get() as { n: number }).n);

  // A brief record of what's been said lately: each person's words joined
  // into lines, a line ending when someone else speaks or after a pause of
  // LINE_BREAK, the newest last, at most `lines`. Words go out one at a time,
  // so this is what makes the room legible to someone who's just arrived.
  const LINE_BREAK = 8_000; // ms
  type Line = { name: string; seat: number; text: string; at: number; until: number; face: string | null };
  function record(lines = 12, scan = 400, room = MAIN): Line[] {
    const rows = (
      db
        .prepare(
          `SELECT p.name, p.rowid AS seat, m.text, m.at, m.face FROM messages m JOIN people p ON p.id = m.person_id
           WHERE m.room = ? ORDER BY m.id DESC LIMIT ?`,
        )
        .all(room, scan) as { name: string; seat: number; text: string; at: number; face: string | null }[]
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

  // ---- rooms ----
  type RoomRow = { id: number; slug: string; name: string; scene: string | null; listed: number; maker: string | null; made_at: number };
  const toRoom = (r: RoomRow): RoomInfo => ({ id: Number(r.id), slug: r.slug, name: r.name, scene: fullScene(r.scene ? JSON.parse(r.scene) : null), listed: !!r.listed, maker: r.maker, made_at: Number(r.made_at) });
  const roomBySlug = (slug: string): RoomInfo | undefined => {
    const r = db.prepare("SELECT * FROM rooms WHERE slug = ?").get(slug) as RoomRow | undefined;
    return r && toRoom(r);
  };
  const roomById = (id: number): RoomInfo | undefined => {
    const r = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
    return r && toRoom(r);
  };
  // the rooms anyone can find, and any of yours that aren't, the main room
  // first, then the busiest lately; each with how many have spoken in it in
  // the last WHILE
  function rooms(personId?: string): (RoomInfo & { lately: number })[] {
    return (
      db
        .prepare(
          `SELECT r.*, (SELECT COUNT(DISTINCT m.person_id) FROM messages m WHERE m.room = r.id AND m.at > ?) AS lately,
             (SELECT MAX(m.at) FROM messages m WHERE m.room = r.id) AS last
           FROM rooms r WHERE r.listed = 1 OR r.maker = ? ORDER BY r.id = 1 DESC, COALESCE(last, r.made_at) DESC LIMIT 60`,
        )
        .all(now() - WHILE, personId ?? "") as (RoomRow & { lately: number })[]
    ).map((r) => ({ ...toRoom(r), lately: Number(r.lately) }));
  }
  // A room's address from its name: lower case, letters and digits joined
  // by dashes, made unique with a number if it's taken.
  const slugOf = (name: string): string => {
    const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "room";
    let slug = base;
    for (let n = 2; db.prepare("SELECT 1 FROM rooms WHERE slug = ?").get(slug) || slug === "main"; n++) slug = `${base}-${n}`;
    return slug;
  };
  const MOST_ROOMS_EACH = 12;
  type MakeResult = { ok: true; room: RoomInfo } | { ok: false; reason: "room-name-bad" | "too-many-rooms" | "not-a-scene" };
  // a name as a person's is cleaned: no invisible characters, 1 to 40 long
  const cleanName = (raw: string, most: number): string | null => {
    const name = raw.normalize("NFKC").replace(/[\p{Cf}\p{Cc}]/gu, "").trim().replace(/\s+/g, " ");
    return name.length >= 1 && name.length <= most ? name : null;
  };
  function makeRoom(personId: string, rawName: string, scene: unknown, listed: boolean): MakeResult {
    const name = cleanName(rawName, 40);
    if (!name) return { ok: false, reason: "room-name-bad" };
    const clean = scene === undefined ? DEFAULT_SCENE : cleanScene(scene);
    if (!clean) return { ok: false, reason: "not-a-scene" };
    if (Number((db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE maker = ?").get(personId) as { n: number }).n) >= MOST_ROOMS_EACH) return { ok: false, reason: "too-many-rooms" };
    const { lastInsertRowid } = db.prepare("INSERT INTO rooms (slug, name, scene, listed, maker, made_at) VALUES (?, ?, ?, ?, ?, ?)").run(slugOf(name), name, JSON.stringify(clean), listed ? 1 : 0, personId, now());
    return { ok: true, room: roomById(Number(lastInsertRowid))! };
  }
  // A change to a room: only by whoever made it (the main room has nobody
  // who did, so it can't be changed). Null if it's not theirs or not a change.
  function changeRoom(personId: string, id: number, change: { name?: unknown; scene?: unknown; listed?: unknown }): RoomInfo | null {
    const r = roomById(id);
    if (!r || !r.maker || r.maker !== personId) return null;
    const name = change.name === undefined ? r.name : typeof change.name === "string" ? cleanName(change.name, 40) : null;
    const scene = change.scene === undefined ? r.scene : cleanScene(change.scene, r.scene);
    const listed = change.listed === undefined ? r.listed : typeof change.listed === "boolean" ? change.listed : null;
    if (!name || !scene || listed === null) return null;
    db.prepare("UPDATE rooms SET name = ?, scene = ?, listed = ? WHERE id = ?").run(name, JSON.stringify(scene), listed ? 1 : 0, id);
    return roomById(id)!;
  }

  // Where someone last was in Space, if they've been (where someone new
  // starts is worked out from who's there: hearing.ts freeSpot).
  const spotOf = (personId: string): { x: number; y: number } | undefined => {
    const r = db.prepare("SELECT x, y FROM spots WHERE person_id = ?").get(personId) as { x: number; y: number } | undefined;
    return r ? { x: Number(r.x), y: Number(r.y) } : undefined;
  };
  const setSpot = (personId: string, x: number, y: number): void =>
    void db.prepare("INSERT INTO spots (person_id, x, y, at) VALUES (?, ?, ?, ?) ON CONFLICT(person_id) DO UPDATE SET x = excluded.x, y = excluded.y, at = excluded.at").run(personId, x, y, now());
  // everyone in Space lately (opened it or moved in it in the last few
  // hours), where they were, and their colour's seat
  const SPACE_WHILE = 3 * 3600_000;
  const spots = (): { name: string; seat: number; x: number; y: number; at: number }[] =>
    (db.prepare("SELECT p.name, p.rowid AS seat, s.x, s.y, s.at FROM spots s JOIN people p ON p.id = s.person_id WHERE s.at > ? ORDER BY s.at DESC LIMIT 60").all(now() - SPACE_WHILE) as { name: string; seat: number; x: number; y: number; at: number }[]).map((r) => ({ name: r.name, seat: Number(r.seat), x: Number(r.x), y: Number(r.y), at: Number(r.at) }));

  return { spotOf, setSpot, spots, findPerson, join, say, edit, react, reactionsOn, threads, recent, since, people, seatOf, newest, record, setLook, lookOf, savedLooks, saveLook, rooms, roomBySlug, roomById, makeRoom, changeRoom, close: () => db.close() };
}

export type Room = ReturnType<typeof openRoom>;
