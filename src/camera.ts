// Where the room's camera stands and what it looks at, as numbers, kept
// apart from the drawing (room3d.ts) so they can be checked without a
// browser. Each way of seeing the room (VIEWS) frames it from where everyone
// sits and who's talking; then it's turned round the middle, tipped up or
// down and zoomed as far as whoever's watching has dragged it, but never out
// through a wall or the floor.
import { ROW, type Place } from "./seats.ts";

export type Vec3 = [number, number, number];
export type Shot = { at: Vec3; look: Vec3 };
// follow: everyone, leaning towards whoever's talking (as the room always
// was); speaker: close on whoever's talking, or last talked; wide: the whole
// room, from a front corner; above: looking down over the table
export const VIEWS = ["follow", "speaker", "wide", "above"] as const;
export type View = (typeof VIEWS)[number];
// how far the watcher has turned it: round the middle and up or down (in
// radians), and nearer or further (1 as framed, less is nearer)
export type Turn = { yaw: number; pitch: number; zoom: number };
export const LEVEL: Turn = { yaw: 0, pitch: 0, zoom: 1 };

// The inside of the room the camera stays in: short of the walls either side
// (at 26) and behind (at -26), above the floor (at -5.2), below the top of
// the walls, and not so far out front that it sees past their ends.
export const ROOM = { x: 23.5, back: -23.5, front: 37.5, floor: -3.6, top: 30 };
// Turned at most this far round from straight on (about 50 degrees:
// further and it's looking along the rows, at the backs of the chairs), and
// looking down at least a little and at most nearly straight down; never
// nearer to what it's looking at than NEAREST, which is inside the front
// row.
export const MOST_YAW = 0.85;
export const RISE: [number, number] = [0.04, 1.4];
export const ZOOM: [number, number] = [0.4, 1.9];
const NEAREST = 6;

export const fovFor = (aspect: number): number => (aspect < 1 ? 52 : 38);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// How far back the camera stands to fit everyone in, across and up and down
// (a narrow screen, further back), and the height of the rows' middle.
export function framing(places: Place[], aspect: number): { rows: number; back: number; middle: number; depth: number } {
  const fov = (fovFor(aspect) * Math.PI) / 180;
  const rows = places.length ? Math.max(...places.map((p) => p.row)) + 1 : 1;
  // (room either side of the outermost: their shoulders, and a hand up)
  const half = places.length ? Math.max(...places.map((p) => Math.abs(p.x))) + (aspect < 1 ? 2.6 : 4.6) : 5;
  const across = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  // heads (and hands up) in every row, and the table in front
  const tall = 6.5 + (rows - 1) * ROW.y * 1.25;
  const back = Math.max(half / Math.tan(across / 2), tall / 2 / Math.tan(fov / 2), 12) + (rows - 1) * 2;
  return { rows, back, middle: -0.4 + (rows - 1) * ROW.y * 0.5, depth: -10 + (rows - 1) * ROW.z * 0.5 };
}

// The way someone in a seat faces: out of the arc, towards the middle
export const facing = (p: Place): Vec3 => [Math.sin(p.turn), 0, Math.cos(p.turn)];

// The shot for a view: `talking` is who's talking now (or -1), `focus` who
// the speaker view is on (whoever talked last, or you).
export function shotFor(view: View, places: Place[], aspect: number, talking: number, focus: number): Shot {
  const { rows, back, middle, depth } = framing(places, aspect);
  if (view === "speaker" && places[focus]) {
    const p = places[focus];
    const f = facing(p);
    // in front of them, a little above, near enough for head and shoulders
    // and the word over their head (looking a little over it, so the word
    // has room)
    const d = aspect < 1 ? 14 : 12.5;
    return { at: [p.x + f[0] * d, p.y + 2.4, p.z + f[2] * d], look: [p.x, p.y + 0.3, p.z] };
  }
  if (view === "wide") {
    const d = back * 1.08;
    return { at: [-d * 0.5, middle + d * 0.42, -8 + d * 0.82], look: [0, middle - 0.4, depth] };
  }
  if (view === "above") {
    return { at: [0, middle + back * 1.02, -8 + back * 0.32], look: [0, middle - 1.2, depth + 0.6] };
  }
  // a little above, looking down at the rows, leaning towards whoever's
  // talking (a little over the table, so it doesn't hide the front row)
  const lean = places[talking] ? places[talking].x * 0.35 : 0;
  return { at: [lean * 0.5, middle + back * (rows > 1 ? 0.3 : 0.25), -8 + back], look: [lean, middle, depth] };
}

// A shot turned and zoomed as the watcher has it: round what it looks at,
// within MOST_YAW of straight on and RISE of level, and then brought in
// along its line of sight as far as it needs to be to stay inside the room.
export function turned(s: Shot, t: Turn): Shot {
  const off = [s.at[0] - s.look[0], s.at[1] - s.look[1], s.at[2] - s.look[2]];
  const flat = Math.hypot(off[0], off[2]);
  const r = Math.max(NEAREST, Math.hypot(...off) * clamp(t.zoom, ZOOM[0], ZOOM[1]));
  const yaw = clamp(Math.atan2(off[0], off[2]) + t.yaw, -MOST_YAW, MOST_YAW);
  const rise = clamp(Math.atan2(off[1], flat) + t.pitch, RISE[0], RISE[1]);
  const at: Vec3 = [s.look[0] + Math.sin(yaw) * Math.cos(rise) * r, s.look[1] + Math.sin(rise) * r, s.look[2] + Math.cos(yaw) * Math.cos(rise) * r];
  return { at: inside(s.look, at), look: s.look };
}

// `at`, brought towards `from` (which is inside) until it's inside the room too
export function inside(from: Vec3, at: Vec3): Vec3 {
  const lo = [-ROOM.x, ROOM.floor, ROOM.back];
  const hi = [ROOM.x, ROOM.top, ROOM.front];
  let k = 1;
  for (let i = 0; i < 3; i++) {
    const d = at[i] - from[i];
    if (at[i] > hi[i] && d > 0) k = Math.min(k, (hi[i] - from[i]) / d);
    if (at[i] < lo[i] && d < 0) k = Math.min(k, (lo[i] - from[i]) / d);
  }
  k = Math.max(0, k);
  return [from[0] + (at[0] - from[0]) * k, from[1] + (at[1] - from[1]) * k, from[2] + (at[2] - from[2]) * k];
}
