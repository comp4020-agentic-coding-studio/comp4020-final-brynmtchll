import { describe, expect, it } from "vitest";
import { apart, clarity, FLOOR, freeSpot, near, reach, READ_AT, scaleAt, SEEN_AT, seenAt } from "../src/hearing.ts";

// Reading across the room as you'd hear across it: clear close to, gone
// further off, a loud word carrying further than a quiet one.
describe("hearing across the room", () => {
  it("reads someone clearly close to, fainter further off, and not at all past their reach", () => {
    expect(clarity(0)).toBe(1);
    expect(clarity(READ_AT * 0.5)).toBe(1);
    expect(clarity(READ_AT * 0.8)).toBeGreaterThan(0);
    expect(clarity(READ_AT * 0.8)).toBeLessThan(1);
    expect(clarity(READ_AT)).toBe(0);
    for (let d = 0; d < 40; d += 0.5) expect(clarity(d + 0.5)).toBeLessThanOrEqual(clarity(d));
  });

  it("carries a loud word further and a quiet one less far, within bounds", () => {
    expect(reach(9)).toBeGreaterThan(reach(0));
    expect(reach(-12)).toBeLessThan(reach(0));
    const d = READ_AT * 1.1;
    expect(clarity(d, 0)).toBe(0);
    expect(clarity(d, 9)).toBeGreaterThan(0);
    expect(clarity(READ_AT * 0.5, -18)).toBe(0);
    // however loud, not right across the room; however quiet, still at your shoulder
    expect(reach(1000)).toBeLessThan(SEEN_AT);
    expect(clarity(2, -1000)).toBeGreaterThan(0);
  });

  it("draws further captions smaller, never too small to see, and shows someone's talking further off than it can be read", () => {
    expect(scaleAt(0)).toBeGreaterThan(scaleAt(20));
    expect(scaleAt(1000)).toBeGreaterThanOrEqual(0.55);
    expect(seenAt(READ_AT * 2)).toBe(true);
    expect(seenAt(SEEN_AT + 1)).toBe(false);
    expect(near({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(true);
    expect(near({ x: 0, z: 0 }, { x: READ_AT, z: 1 })).toBe(false);
  });

  it("lays Space over one floor for everyone, so whoever can read you, you can read, and nobody's ever out of sight", () => {
    const a = { x: 0.2, y: 0.3 };
    const b = { x: 0.6, y: 0.7 };
    expect(apart(a, b)).toBe(apart(b, a));
    expect(apart({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeLessThan(SEEN_AT);
    // from the middle, the ends are out of reading
    expect(clarity(apart({ x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }))).toBe(0);
    expect(FLOOR.w).toBeGreaterThan(FLOOR.h);
  });

  it("starts someone new in Space clear of everyone there, near the middle when there's room", () => {
    expect(apart(freeSpot([]), { x: 0.5, y: 0.5 })).toBeLessThan(1);
    const there: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const at = freeSpot(there);
      for (const t of there) expect(apart(at, t)).toBeGreaterThan(READ_AT * 0.5);
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(1);
      there.push(at);
    }
  });
});
