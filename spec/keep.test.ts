import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MAIN, openRoom } from "../src/db.ts";
import { KEEPS } from "../src/packs.ts";

// How long a room keeps what's said, checked on the database itself with
// the clock in hand (the running app can't be made to wait a week).
const dir = mkdtempSync(join(tmpdir(), "said-keep-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const HOUR = 60 * 60_000;
const word = (w: string) => ({ w, start: 0, end: 0.3, loud: 0, pitch: 0, rise: 0, stretch: 0, held: null, contour: [] });

describe("how long a room keeps what's said", () => {
  it("deletes what's older than each room keeps, and nothing newer, whatever each keeps", () => {
    let t = 1_000_000_000_000;
    const db = openRoom(join(dir, "a.db"), () => t);
    db.join("p1", "Pat");
    const rooms = Object.fromEntries(KEEPS.map((k) => {
      const made = db.makeRoom("p1", { name: `Keeps ${k.id}`, keep: k.id });
      if (!made.ok) throw new Error(made.reason);
      return [k.id, made.room.id];
    }));
    for (const id of Object.values(rooms)) db.say("p1", [word("old")], null, false, id);
    db.say("p1", [word("old")], null, false, MAIN);
    // two hours on: what was kept an hour is gone, the rest isn't
    t += 2 * HOUR;
    for (const id of Object.values(rooms)) db.say("p1", [word("new")], null, false, id);
    db.forget();
    const texts = (id: number) => db.transcript(id).map((m) => m.text);
    expect(texts(rooms.hour)).toEqual(["new"]);
    expect(texts(rooms.day)).toEqual(["old", "new"]);
    // eight days on: a week's is gone too, and the open room keeps a day
    t += 8 * 24 * HOUR;
    db.forget();
    expect(texts(rooms.day)).toEqual([]);
    expect(texts(rooms.week)).toEqual([]);
    expect(texts(MAIN)).toEqual([]);
    expect(texts(rooms.always)).toEqual(["old", "new"]);
    db.close();
  });

  it("deletes at once what's older than a room is made to keep, and everything when it's closed", () => {
    let t = 1_000_000_000_000;
    const db = openRoom(join(dir, "b.db"), () => t);
    db.join("p1", "Pat");
    db.join("p2", "Sam");
    const made = db.makeRoom("p1", { name: "Long", keep: "always" });
    if (!made.ok) throw new Error(made.reason);
    const id = made.room.id;
    db.say("p2", [word("last")], null, false, id);
    t += 3 * HOUR;
    db.say("p2", [word("week")], null, false, id);
    // only whoever opened it can change it
    expect(db.changeRoom("p2", id, { keep: "hour" })).toBeNull();
    expect(db.transcript(id)).toHaveLength(2);
    expect(db.changeRoom("p1", id, { keep: "hour" })?.keep).toBe("hour");
    expect(db.transcript(id).map((m) => m.text)).toEqual(["week"]);
    // closed: it, and every word said in it
    expect(db.closeRoom("p2", id)).toBe(false);
    expect(db.closeRoom("p1", id)).toBe(true);
    expect(db.roomById(id)).toBeUndefined();
    expect(db.transcript(id)).toEqual([]);
    db.close();
  });
});
