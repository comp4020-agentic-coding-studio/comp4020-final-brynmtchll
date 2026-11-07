// Walking about the room (room3d.ts), as numbers: where the floor is, what's
// in the way, and a step taken from where someone stands. Kept apart from
// the drawing so it can be checked without a browser, and shared with the
// server, which holds anyone walking to the same floor.

export type Spot = { x: number; z: number; turn: number };

// The floor anyone can walk on: short of the walls (at 26 either side and
// behind), and in front no further than the camera usually stands.
export const FLOOR_AREA = { x: 22.5, back: -23.5, front: 16 };
// how near the middle of someone can come to a wall or a thing in the way
const BODY = 1.3;
// The things standing on the floor, each round or oval: the table, the
// green armchair, the lamp, three pots and the bookcase.
type Thing = { x: number; z: number; rx: number; rz: number };
export const THINGS: Thing[] = [
  { x: 0, z: -4.2, rx: 9.2, rz: 2.8 },
  { x: -18, z: -7, rx: 3.2, rz: 3.2 },
  { x: -19, z: -15, rx: 1.2, rz: 1.2 },
  { x: 21, z: -14, rx: 1.6, rz: 1.6 },
  { x: -21.5, z: -22, rx: 2, rz: 2 },
  { x: 20, z: 4, rx: 1.3, rz: 1.3 },
  { x: 19, z: -24.6, rx: 4.2, rz: 1.6 },
];
// how fast someone walks (units a second; a head is about 2 across), and
// turns to face where they're going (radians a second, at most)
export const PACE = 7;
export const TURN_RATE = 9;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// Where someone may stand: on the floor, and out of anything on it (pushed
// straight out of whatever they'd be in, the nearest way).
export function onFloor(x: number, z: number): { x: number; z: number } {
  const edge = (q: { x: number; z: number }) => ({ x: clamp(q.x, -FLOOR_AREA.x, FLOOR_AREA.x), z: clamp(q.z, FLOOR_AREA.back, FLOOR_AREA.front) });
  let p = edge({ x, z });
  // (a few times over: pushed out of a pot in a corner, against the walls,
  // and held to the floor, can put someone back in the pot; round again, it's
  // pushed along the wall instead)
  for (let round = 0; round < 4; round++) {
    let moved = false;
    for (const t of THINGS) {
      const ax = t.rx + BODY;
      const az = t.rz + BODY;
      const dx = (p.x - t.x) / ax;
      const dz = (p.z - t.z) / az;
      const d = Math.hypot(dx, dz);
      if (d >= 1) continue;
      // (dead in the middle: out the front)
      let [ux, uz] = d < 1e-6 ? [0, 1] : [dx / d, dz / d];
      // (out through a wall is no way out: along it instead)
      const out = { x: t.x + ux * ax, z: t.z + uz * az };
      if (Math.abs(out.x) > FLOOR_AREA.x) [ux, uz] = [0, uz >= 0 ? 1 : -1];
      if (out.z < FLOOR_AREA.back || out.z > FLOOR_AREA.front) [ux, uz] = [ux >= 0 ? 1 : -1, 0];
      if (Math.abs(t.x + ux * ax) > FLOOR_AREA.x || t.z + uz * az < FLOOR_AREA.back || t.z + uz * az > FLOOR_AREA.front) [ux, uz] = [-ux, -uz];
      p = edge({ x: t.x + ux * ax * 1.0001, z: t.z + uz * az * 1.0001 });
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}

// A step: from where someone stands, going `ahead` and `aside` (each -1..1,
// as a stick or keys have it, relative to `facing`, the way the camera
// looks), for `dt` seconds. They turn towards where they're going, quickly
// but not at once, and slide along anything they walk into rather than
// stopping dead.
export function step(at: Spot, ahead: number, aside: number, facing: number, dt: number): Spot {
  const len = Math.hypot(ahead, aside);
  if (len < 0.05) return at;
  const k = Math.min(1, len);
  const a = facing + Math.atan2(aside, ahead);
  const want = { x: at.x + Math.sin(a) * PACE * k * dt, z: at.z + Math.cos(a) * PACE * k * dt };
  // (the x and z of a step apart: blocked one way, it slides the other)
  let to = onFloor(want.x, want.z);
  if (Math.hypot(to.x - want.x, to.z - want.z) > 1e-3) {
    const alongX = onFloor(want.x, at.z);
    const alongZ = onFloor(at.x, want.z);
    to = Math.abs(alongX.x - at.x) > Math.abs(alongZ.z - at.z) ? alongX : alongZ;
  }
  return { ...to, turn: turnedTo(at.turn, a, TURN_RATE * dt) };
}

// `from`, turned towards `to` by at most `most` (radians), the short way round
export function turnedTo(from: number, to: number, most: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + clamp(d, -most, most);
}

// A spot as sent, held to the floor, or null if it isn't one
export function cleanSpot(raw: unknown): Spot | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, z, turn } = raw as Record<string, unknown>;
  if (![x, z, turn].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const p = onFloor(x as number, z as number);
  const t = Math.atan2(Math.sin(turn as number), Math.cos(turn as number));
  const r2 = (n: number): number => Math.round(n * 100) / 100;
  return { x: r2(p.x), z: r2(p.z), turn: r2(t) };
}
