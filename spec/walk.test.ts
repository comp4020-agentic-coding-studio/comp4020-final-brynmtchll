import { describe, expect, it } from "vitest";
import { seatPlaces, stepsBeside } from "../src/seats.ts";
import { blocked, cleanSpot, clearLine, FLOOR_AREA, held, inSeat, onFloor, route, seatSpot, step, THINGS, turnedTo, wayOut, type Chair } from "../src/walk.ts";

// Walking about the room: on the floor, round the furniture, never through it.
const inThing = (x: number, z: number): boolean => THINGS.some((t) => ((x - t.x) / t.rx) ** 2 + ((z - t.z) / t.rz) ** 2 < 1);
// the chairs in a room of `n`, as the room has them, with the empty step
// past a raised row's ends
const chairsOf = (n: number): Chair[] => {
  const places = seatPlaces(n);
  return [...places.map((p) => ({ x: p.x, z: p.z, turn: p.turn, up: p.y })), ...stepsBeside(places).map((p) => ({ x: p.x, z: p.z, turn: p.turn, up: p.y, empty: true }))];
};
// along a way, a point every so often
const along = (pts: { x: number; z: number }[], from: { x: number; z: number }): { x: number; z: number }[] => {
  const out = [];
  let at = from;
  for (const p of pts) {
    const n = Math.max(1, Math.ceil(Math.hypot(p.x - at.x, p.z - at.z) / 0.2));
    for (let i = 1; i <= n; i++) out.push({ x: at.x + ((p.x - at.x) * i) / n, z: at.z + ((p.z - at.z) * i) / n });
    at = p;
  }
  return out;
};

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
    // and right is to the right, as the camera sees it (looking towards -z,
    // the screen's right is +x): it walked left, once
    expect(step(at, 0, 1, Math.PI, 0.1).x).toBeGreaterThan(at.x);
    expect(step(at, 0, 1, 0, 0.1).x).toBeLessThan(at.x);
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

  it("gets everyone out of their chair and back into it, from any seat in a room of any size, never through a chair or the table", () => {
    for (let n = 1; n <= 12; n++) {
      const chairs = chairsOf(n);
      for (let i = 0; i < n; i++) {
        const way = wayOut(chairs, i);
        const c = chairs[i];
        // from standing up in front of their chair...
        expect(Math.hypot(way[0].x - seatSpot(c).x, way[0].z - seatSpot(c).z), `${n}: seat ${i}`).toBeLessThan(1e-6);
        expect(way[0].up).toBeCloseTo(c.up);
        // ...out to the floor, somewhere clear to walk from
        const end = way.at(-1)!;
        expect(end.up, `${n}: seat ${i}`).toBe(0);
        expect(blocked(end.x, end.z, chairs), `${n}: seat ${i} ends at ${end.x}, ${end.z}`).toBe(false);
        // ...along the way through nobody's chair on the same floor as them
        // (along a raised row's step, the row in front is below: its chairs'
        // backs come up beside the step's edge), and nothing on the floor
        let up = way[0].up;
        let at = way[0];
        for (const w of way) {
          for (const p of along([w], at)) {
            const level = chairs.filter((o, j) => j !== i && Math.abs(o.up - up) < 0.05);
            expect(inSeat(level, p.x, p.z), `${n}: seat ${i} through a chair at ${p.x}, ${p.z}`).toBe(false);
            expect(inThing(p.x, p.z), `${n}: seat ${i} through the table at ${p.x}, ${p.z}`).toBe(false);
          }
          up = w.up;
          at = w;
        }
      }
    }
  });

  it("finds the way round the table and the chairs to anywhere on the floor, and back to their chair", () => {
    for (const n of [1, 5, 8, 12]) {
      const chairs = chairsOf(n);
      const ends = chairs.slice(0, n).map((_, i) => wayOut(chairs, i).at(-1)!);
      // (from and to places anyone can stand)
      const spots = [...ends, { x: 0, z: 12 }, { x: -20, z: -20 }, { x: 18, z: -20 }, { x: -14, z: -22 }, { x: -12, z: 8 }].map((p) => held(p.x, p.z, chairs));
      for (const a of spots)
        for (const b of spots) {
          const way = route(a, b, chairs);
          const last = way.at(-1)!;
          // (there, or, somewhere nobody can stand, as near as anyone can)
          const there = held(b.x, b.z, chairs);
          expect(Math.hypot(last.x - there.x, last.z - there.z), `${n}: ${a.x},${a.z} to ${b.x},${b.z}`).toBeLessThan(0.8);
          let at = a;
          for (const p of way) {
            expect(clearLine(at, p, chairs), `${n}: ${a.x},${a.z} to ${b.x},${b.z}, ${at.x},${at.z} to ${p.x},${p.z}`).toBe(true);
            at = p;
          }
        }
    }
  });

  it("slides along the chairs as well as the table, and never into either", () => {
    const chairs = chairsOf(12);
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.4]) {
      let at = { ...held(0, 8, chairs), turn: 0 };
      for (let i = 0; i < 300; i++) {
        at = step(at, 1, 0.2, facing, 1 / 30, chairs);
        expect(inSeat(chairs, at.x, at.z) || inThing(at.x, at.z), `${facing}: ${at.x}, ${at.z}`).toBe(false);
      }
    }
  });

  it("goes as near as anyone can get to somewhere nobody can, never through anything on the way", () => {
    // (behind the back row of a full room, its step from wall to wall)
    const chairs = chairsOf(12);
    const from = held(0, 12, chairs);
    const way = route(from, { x: 0, z: -23 }, chairs);
    let at = from;
    for (const p of way) {
      expect(clearLine(at, p, chairs), `${at.x},${at.z} to ${p.x},${p.z}`).toBe(true);
      at = p;
    }
    expect(blocked(at.x, at.z, chairs)).toBe(false);
  });
});
