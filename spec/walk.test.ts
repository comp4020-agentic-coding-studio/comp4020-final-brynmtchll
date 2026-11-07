import { describe, expect, it } from "vitest";
import { cleanSpot, FLOOR_AREA, onFloor, step, THINGS, turnedTo } from "../src/walk.ts";

// Walking about the room: on the floor, round the furniture, never through it.
const inThing = (x: number, z: number): boolean => THINGS.some((t) => ((x - t.x) / t.rx) ** 2 + ((z - t.z) / t.rz) ** 2 < 1);

describe("walking about the room", () => {
  it("keeps everyone on the floor and out of the furniture, wherever they try to stand", () => {
    for (let x = -40; x <= 40; x += 1.7)
      for (let z = -40; z <= 30; z += 1.3) {
        const p = onFloor(x, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(FLOOR_AREA.x);
        expect(p.z).toBeGreaterThanOrEqual(FLOOR_AREA.back);
        expect(p.z).toBeLessThanOrEqual(FLOOR_AREA.front);
        expect(inThing(p.x, p.z), `${x}, ${z} put at ${p.x}, ${p.z}`).toBe(false);
      }
  });

  it("walks the way the stick points, from where the camera looks, at a walking pace", () => {
    const at = { x: 0, z: 10, turn: 0 };
    // facing into the room (towards -z), ahead is further in
    const on = step(at, 1, 0, Math.PI, 0.1);
    expect(on.z).toBeLessThan(at.z);
    expect(Math.abs(on.x - at.x)).toBeLessThan(1e-6);
    expect(Math.hypot(on.x - at.x, on.z - at.z)).toBeCloseTo(0.7, 5);
    // a stick barely moved goes nowhere
    expect(step(at, 0.02, 0.02, 0, 0.1)).toEqual(at);
  });

  it("slides along the table when walked into it, rather than stopping dead or going through", () => {
    let at = { x: -4, z: 2, turn: Math.PI };
    // at the table and a little to one side, for three seconds
    for (let i = 0; i < 90; i++) {
      at = step(at, 1, 0.3, Math.PI, 1 / 30);
      expect(inThing(at.x, at.z)).toBe(false);
    }
    expect(Math.abs(at.x + 4)).toBeGreaterThan(3);
  });

  it("turns to face where they're going the short way round, not all at once", () => {
    const same = (a: number, b: number) => expect(Math.cos(a - b)).toBeCloseTo(1, 6);
    same(turnedTo(3, -3, 10), -3);
    // from 3 to -3 the short way is up, past pi, not down past 0
    expect(turnedTo(3, -3, 0.1)).toBeCloseTo(3.1, 5);
    expect(turnedTo(0, 1, 0.2)).toBeCloseTo(0.2, 5);
  });

  it("takes a place as three numbers held to the floor, and nothing that isn't one", () => {
    expect(cleanSpot({ x: 1.234, z: 9, turn: 7, video: "x" })).toEqual({ x: 1.23, z: 9, turn: 0.72 });
    expect(cleanSpot({ x: Infinity, z: 0, turn: 0 })).toBeNull();
    expect(cleanSpot({ x: "1", z: 0, turn: 0 })).toBeNull();
    expect(cleanSpot(null)).toBeNull();
  });
});
