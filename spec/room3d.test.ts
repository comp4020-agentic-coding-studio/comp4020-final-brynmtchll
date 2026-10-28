import { describe, expect, it } from "vitest";
import { ROW, seatPlaces } from "../src/seats.ts";

// Where people sit in the room, checked as numbers. Whether the room then
// looks like people around a table is judged by eye, at both sizes.
describe("where people sit in the room", () => {
  it("gives everyone a seat, nobody on top of anyone, in rows that suit the screen", () => {
    for (const aspect of [390 / 600, 1, 16 / 9, 21 / 9]) {
      for (let n = 1; n <= 12; n++) {
        const seats = seatPlaces(n, aspect);
        expect(seats).toHaveLength(n);
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const [a, b] = [seats[i], seats[j]];
            // a seat apart in a row, or in different rows
            expect(Math.hypot(a.x - b.x, a.z - b.z) > 3 || a.row !== b.row).toBe(true);
          }
        }
        // each row behind is higher, so faces show over the heads in front
        for (const s of seats) expect(s.y).toBeCloseTo(s.row * ROW.y);
        // and nobody faces away: each seat turned towards the middle
        for (const s of seats) expect(Math.sign(s.turn) === -Math.sign(s.x) || Math.abs(s.x) < 1e-6).toBe(true);
      }
    }
  });

  it("puts a phone's room in rows of a few, and a wide screen's in long rows", () => {
    const rowsOf = (n: number, aspect: number) => Math.max(...seatPlaces(n, aspect).map((s) => s.row)) + 1;
    expect(rowsOf(9, 390 / 600)).toBeGreaterThanOrEqual(3);
    expect(rowsOf(9, 16 / 9)).toBeLessThanOrEqual(2);
    expect(rowsOf(3, 16 / 9)).toBe(1);
  });
});
