import { describe, expect, it } from "vitest";
import { held, inside, LEVEL, MOST_YAW, ROOM, shotFor, turned, VIEWS, type Vec3 } from "../src/camera.ts";
import { seatPlaces } from "../src/seats.ts";

// Where the room's camera goes, checked as numbers: every view, however
// it's turned and zoomed, stays inside the room, looking at the people.
// How each view looks is judged by eye, at both sizes.
const isInside = (p: Vec3): boolean => Math.abs(p[0]) <= ROOM.x + 1e-6 && p[1] >= ROOM.floor - 1e-6 && p[1] <= ROOM.top + 1e-6 && p[2] >= ROOM.back - 1e-6 && p[2] <= ROOM.front + 1e-6;

describe("the room's camera", () => {
  it("stays inside the room in every view, however far it's turned or zoomed", () => {
    for (const aspect of [390 / 600, 1, 16 / 9]) {
      for (const n of [1, 2, 5, 12]) {
        const places = seatPlaces(n, aspect);
        for (const view of VIEWS) {
          for (const yaw of [-9, -1, 0, 0.6, 9]) {
            for (const pitch of [-9, 0, 9]) {
              for (const zoom of [0.01, 1, 50]) {
                const s = turned(shotFor(view, places, aspect, n > 1 ? 1 : -1, 0), { yaw, pitch, zoom });
                expect(isInside(s.at), `${view} ${n} ${aspect} ${yaw} ${pitch} ${zoom}: ${s.at}`).toBe(true);
                // and never looking up from under anyone, or from behind them
                expect(s.at[1]).toBeGreaterThan(s.look[1]);
                expect(s.at[2]).toBeGreaterThan(s.look[2]);
              }
            }
          }
        }
      }
    }
  });

  it("frames everyone as it always did when nobody's turned it", () => {
    const places = seatPlaces(5, 16 / 9);
    const s = turned(shotFor("follow", places, 16 / 9, -1, 2), LEVEL);
    // straight on, in the middle, in front of and above the rows
    expect(s.at[0]).toBeCloseTo(0);
    expect(s.look[0]).toBeCloseTo(0);
    expect(s.at[1]).toBeGreaterThan(s.look[1]);
  });

  it("leans towards whoever's talking, and closes in on them in the speaker view", () => {
    const places = seatPlaces(5, 16 / 9);
    const right = places.findIndex((p) => p.x === Math.max(...places.map((q) => q.x)));
    expect(shotFor("follow", places, 16 / 9, right, right).look[0]).toBeGreaterThan(0);
    const close = shotFor("speaker", places, 16 / 9, right, right);
    const p = places[right];
    expect(Math.hypot(close.look[0] - p.x, close.look[2] - p.z)).toBeLessThan(0.5);
    expect(Math.hypot(close.at[0] - p.x, close.at[2] - p.z)).toBeLessThan(16);
  });

  it("turns no further round than MOST_YAW from straight on", () => {
    const places = seatPlaces(5, 16 / 9);
    for (const yaw of [-5, 5]) {
      const s = turned(shotFor("follow", places, 16 / 9, -1, 2), { ...LEVEL, yaw });
      expect(Math.abs(Math.atan2(s.at[0] - s.look[0], s.at[2] - s.look[2]))).toBeLessThanOrEqual(MOST_YAW + 1e-6);
    }
  });

  it("holds a turn to what the shot can show, so dragging back moves it at once", () => {
    const places = seatPlaces(5, 16 / 9);
    for (const view of VIEWS) {
      const shot = shotFor(view, places, 16 / 9, -1, 2);
      for (const yaw of [-5, 5]) {
        const t = held(shot, { ...LEVEL, yaw });
        // as far round as an unheld turn goes...
        expect(turned(shot, t).at[0]).toBeCloseTo(turned(shot, { ...LEVEL, yaw }).at[0], 6);
        // ...and a little back from there is a little back on the screen
        const back = turned(shot, { ...t, yaw: t.yaw - Math.sign(yaw) * 0.05 });
        expect(Math.abs(back.at[0] - turned(shot, t).at[0])).toBeGreaterThan(0.01);
      }
      expect(held(shot, LEVEL)).toEqual(LEVEL);
    }
  });

  it("brings a point outside the room in along the line to it", () => {
    const from: Vec3 = [0, 0, 0];
    const p = inside(from, [100, 0, 0]);
    expect(p[0]).toBeCloseTo(ROOM.x);
    expect(inside(from, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
