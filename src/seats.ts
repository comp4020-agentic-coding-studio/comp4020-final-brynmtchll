// Where people sit in the room (room3d.ts), as numbers: kept apart from the
// drawing so it can be checked without a browser.

const SEAT_GAP = 3.3; // between neighbours, along the arc, in head units
const ARC = 13; // the arc's radius

// Seats on arcs, centred, rows of them raised one behind another (as in a
// lecture theatre, each row half a seat along, so faces show between the
// heads in front), as many in a row as suits the shape of the screen: a wide
// one has a long row, a phone stands people in rows of two or three, so
// they're big enough to see either way.
// (a row's chairs come 3.6 back from where its people's heads are: 6 back,
// the row behind has an aisle in front of it, on its step, to walk along
// without going through anyone's face or the chairs in front)
export const ROW = { y: 3.4, z: -6 };
export type Place = { x: number; y: number; z: number; turn: number; row: number };
export function seatPlaces(n: number, aspect = 16 / 9): Place[] {
  const out: Place[] = [];
  // (three or fewer, on a screen that isn't tall, side by side, and two on
  // one that is: a second row of one or two only hides the front row behind
  // the table, or one person's head in front of the other's body)
  const perRow = Math.max(Math.min(n, aspect >= 1 ? 3 : 2), Math.min(6, Math.round(Math.sqrt(n * aspect * 1.4))));
  const rows = Math.ceil(n / perRow);
  for (let row = 0; row < rows; row++) {
    // the front rows full; the back one takes what's left
    const count = row < rows - 1 ? perRow : n - perRow * (rows - 1);
    const r = ARC - row * ROW.z;
    const step = SEAT_GAP / r;
    for (let i = 0; i < count; i++) out.push(placeAt((i - (count - 1) / 2 + (row % 2 ? 0.5 : 0) * (count < perRow ? 0 : 1)) * step, row));
  }
  return out;
}
// the place `a` round a row's arc
function placeAt(a: number, row: number): Place {
  const r = ARC - row * ROW.z;
  return { x: Math.sin(a) * r, y: row * ROW.y, z: -r + Math.cos(a) * r - 8 + row * ROW.z, turn: -a, row };
}

// A raised row's step goes on past its ends, with no chairs on it (as a
// lecture theatre's does), far enough that someone walking out along the
// row steps down past the end of every row in front, not into the backs of
// their chairs. The places along it, each as a seat would be.
export function stepsBeside(places: Place[]): Place[] {
  const out: Place[] = [];
  const rows = places.length ? Math.max(...places.map((p) => p.row)) + 1 : 0;
  for (let row = 1; row < rows; row++) {
    const gap = SEAT_GAP / (ARC - row * ROW.z);
    const lower = [...places, ...out].filter((p) => p.row < row);
    const angles = places.filter((p) => p.row === row).map((p) => -p.turn);
    for (const dir of [-1, 1]) {
      const past = Math.max(...lower.map((p) => p.x * dir)) + 1.5;
      let a = dir < 0 ? Math.min(...angles) : Math.max(...angles);
      for (let n = 0; n < 8 && placeAt(a, row).x * dir < past; n++) out.push(placeAt((a += dir * gap), row));
    }
  }
  return out;
}
