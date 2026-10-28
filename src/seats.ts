// Where people sit in the room (room3d.ts), as numbers: kept apart from the
// drawing so it can be checked without a browser.

const SEAT_GAP = 3.3; // between neighbours, along the arc, in head units
const ARC = 13; // the arc's radius

// Seats on arcs, centred, rows of them raised one behind another (as in a
// lecture theatre, each row half a seat along, so faces show between the
// heads in front), as many in a row as suits the shape of the screen: a wide
// one has a long row, a phone stands people in rows of two or three, so
// they're big enough to see either way.
export const ROW = { y: 3.4, z: -5 };
export type Place = { x: number; y: number; z: number; turn: number; row: number };
export function seatPlaces(n: number, aspect = 16 / 9): Place[] {
  const out: Place[] = [];
  const perRow = Math.max(1, Math.min(6, Math.round(Math.sqrt(n * aspect * 1.4))));
  const rows = Math.ceil(n / perRow);
  for (let row = 0; row < rows; row++) {
    // the front rows full; the back one takes what's left
    const count = row < rows - 1 ? perRow : n - perRow * (rows - 1);
    const r = ARC - row * ROW.z;
    const step = SEAT_GAP / r;
    for (let i = 0; i < count; i++) {
      const a = (i - (count - 1) / 2 + (row % 2 ? 0.5 : 0) * (count < perRow ? 0 : 1)) * step;
      out.push({ x: Math.sin(a) * r, y: row * ROW.y, z: -r + Math.cos(a) * r - 8 + row * ROW.z, turn: -a, row });
    }
  }
  return out;
}
