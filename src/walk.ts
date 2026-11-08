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
// green armchair, the lamp, three pots and the bookcase. (The table stands
// far enough out from the chairs to walk along in front of them.)
type Thing = { x: number; z: number; rx: number; rz: number };
export const THINGS: Thing[] = [
  { x: 0, z: -1, rx: 9.2, rz: 2.8 },
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
export const TABLE = THINGS[0];

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
// but not at once, and slide along anything they walk into (the furniture,
// and the `chairs`) rather than stopping dead or going through.
export function step(at: Spot, ahead: number, aside: number, facing: number, dt: number, chairs: Chair[] = []): Spot {
  const len = Math.hypot(ahead, aside);
  if (len < 0.05) return at;
  const k = Math.min(1, len);
  // (aside is to the right of where the camera looks: a heading of `facing`
  // goes along (sin, cos), so its right is the heading less a quarter turn)
  const a = facing - Math.atan2(aside, ahead);
  const want = { x: at.x + Math.sin(a) * PACE * k * dt, z: at.z + Math.cos(a) * PACE * k * dt };
  // (the x and z of a step apart: blocked one way, it slides the other)
  let to = held(want.x, want.z, chairs);
  if (Math.hypot(to.x - want.x, to.z - want.z) > 1e-3) {
    const alongX = held(want.x, at.z, chairs);
    const alongZ = held(at.x, want.z, chairs);
    to = Math.abs(alongX.x - at.x) > Math.abs(alongZ.z - at.z) ? alongX : alongZ;
  }
  // (hemmed in, pushed out of one chair into the next: stays where they
  // were, unless that's in the way too, as when the chairs move round them)
  if (blocked(to.x, to.z, chairs) && !blocked(at.x, at.z, chairs)) to = { x: at.x, z: at.z };
  return { ...to, turn: turnedTo(at.turn, a, TURN_RATE * dt) };
}

// ---- the chairs, and getting in and out of them ----

// A chair: where its sitter's head is, the way it faces, and how high the
// step it stands on is (0, on the floor; a row further back is raised).
// `empty`: a stretch of step with no chair on it (seats.ts, stepsBeside).
export type Chair = { x: number; z: number; turn: number; up: number; empty?: boolean };
// A chair's footprint, from its sitter's head: either side, in front and
// behind; on a step, the step's, which runs on in front of the chair, a
// ledge to walk along (no walking on to it, but by the way out). And how
// near the middle of someone may come to one: in front, far enough that
// walking past someone sat in it doesn't go through their face; at the
// sides and back, a body's width.
// (the chair as drawn, room3d.ts: 3.8 across and arms 0.7 thick either
// side, the seat from 0.25 in front of a head to the back at 3.4 behind)
const CHAIR = { half: 2.25, front: 0.25, back: 3.6 };
export const STEP = { half: 2.45, front: 2.1, back: 3.9 };
const REACH = { front: 1.25, side: 0.8 };
// Where someone stands up to, or sits down from, in front of a chair,
// facing as it does; and where they step forward to, to walk away (or
// along a raised row's ledge)
export const SAT_BACK = 0.7;
export const OUT = 1.9;
const ahead = (c: Chair, by: number): { x: number; z: number } => ({ x: c.x + Math.sin(c.turn) * by, z: c.z + Math.cos(c.turn) * by });
export const seatSpot = (c: Chair): Spot => ({ ...ahead(c, SAT_BACK), turn: c.turn });
// a point as a chair sees it: across (u, to its right) and ahead (v)
const across = (c: Chair, x: number, z: number): { u: number; v: number } => {
  const [dx, dz, s, k] = [x - c.x, z - c.z, Math.sin(c.turn), Math.cos(c.turn)];
  return { u: dx * k - dz * s, v: dx * s + dz * k };
};
const shape = (c: Chair): typeof CHAIR => (c.up > 0.05 ? STEP : CHAIR);
// (kept off its sides and back by a body's width, and only a little off its
// front, straight ahead of it: in front of a row is where to walk along it)
const inChair = (c: Chair, x: number, z: number): boolean => {
  const { u, v } = across(c, x, z);
  const f = shape(c);
  if (v < -1.2) return Math.abs(u) < f.half + REACH.side && v > -f.back - REACH.side;
  return Math.abs(u) < f.half && v < f.front + REACH.front;
};
// Whether a point is in a chair itself (not near it, or on a step)
export const inSeat = (chairs: Chair[], x: number, z: number): boolean =>
  chairs.some((c) => {
    if (c.empty) return false;
    const { u, v } = across(c, x, z);
    return Math.abs(u) < CHAIR.half && v < CHAIR.front && v > -CHAIR.back;
  });
// Whether someone can't stand here: off the floor, in the furniture, or in
// (or too near) a chair.
export function blocked(x: number, z: number, chairs: Chair[] = []): boolean {
  if (Math.abs(x) > FLOOR_AREA.x + 1e-9 || z < FLOOR_AREA.back - 1e-9 || z > FLOOR_AREA.front + 1e-9) return true;
  for (const t of THINGS) if (((x - t.x) / (t.rx + BODY)) ** 2 + ((z - t.z) / (t.rz + BODY)) ** 2 < 0.9999) return true;
  return chairs.some((c) => inChair(c, x, z));
}
// Where someone may stand, among the chairs too: out of any they're in,
// the shortest way, and back on the floor (a few times over, as being
// pushed out of one can put them in the furniture)
export function held(x: number, z: number, chairs: Chair[] = []): { x: number; z: number } {
  let p = onFloor(x, z);
  for (let round = 0; round < 3; round++) {
    const c = chairs.find((c) => inChair(c, p.x, p.z));
    if (!c) break;
    const { u, v } = across(c, p.x, p.z);
    const f = shape(c);
    const e = 1e-3;
    // (the nearest way out of it: out the front, the back, or a side)
    const ways: [number, number][] = [[u, f.front + REACH.front + e], [u, -f.back - REACH.side - e], [f.half + REACH.side + e, v], [-f.half - REACH.side - e, v]];
    if (v >= -1.2) ways.push([f.half + e, v], [-f.half - e, v]);
    const [nu, nv] = ways.filter(([a, b]) => !inChair({ ...c, x: 0, z: 0, turn: 0 }, a, b)).sort((a, b) => Math.hypot(a[0] - u, a[1] - v) - Math.hypot(b[0] - u, b[1] - v))[0];
    const [s, k] = [Math.sin(c.turn), Math.cos(c.turn)];
    p = onFloor(c.x + nu * k + nv * s, c.z - nu * s + nv * k);
  }
  return p;
}
// How high the floor is here: a step's height, on one, or 0
export function underfoot(chairs: Chair[], x: number, z: number): number {
  let up = 0;
  for (const c of chairs) {
    if (c.up <= 0.05) continue;
    const { u, v } = across(c, x, z);
    if (Math.abs(u) < STEP.half && v < STEP.front && v > -STEP.back) up = Math.max(up, c.up);
  }
  return up;
}

// A place on the way out of a chair, and how high the floor is there
export type Step = { x: number; z: number; up: number };
// The way out of chair `i`, from standing in front of it to somewhere on
// the floor that's clear to walk from (and, backwards, the way back in).
// From the front row, standing up is enough: in front of it is the floor,
// between the chairs and the table. From a raised row, along in front of
// its seats, on its step, to its nearer end, and on past it, hopping down
// off the step (and off a lower row's, if that's there), until clear of the
// chairs.
export function wayOut(chairs: Chair[], i: number): Step[] {
  const c = chairs[i];
  const way: Step[] = [{ ...ahead(c, SAT_BACK), up: c.up }];
  // (from the front row: out towards the table, until clear of the chairs
  // either side. Straight ahead, out of an end chair, would cut across the
  // arm of the next: round the curve of the row, they face in.)
  if (c.up <= 0.05) {
    const a = c.turn * 0.3;
    const out = (by: number) => ({ x: way[0].x + Math.sin(a) * (by - SAT_BACK), z: way[0].z + Math.cos(a) * (by - SAT_BACK) });
    for (let by = OUT; by < OUT + 3; by += 0.25) if (!blocked(out(by).x, out(by).z, chairs)) return [...way, { ...out(by), up: 0 }];
    return [...way, { ...held(out(OUT).x, out(OUT).z, chairs), up: 0 }];
  }
  const row = chairs.filter((o) => Math.abs(o.up - c.up) < 0.05).sort((a, b) => a.x - b.x);
  const at = row.indexOf(c);
  const dir = at < row.length - 1 - at || (at === row.length - 1 - at && c.x < 0) ? -1 : 1;
  // (along the ledge, in front of each seat in turn; between two, out at
  // the further of their two fronts, so the way between doesn't cut the
  // corner of either, round the curve)
  for (let k = at; k >= 0 && k < row.length; k += dir) {
    const next = row[k + dir];
    way.push({ ...ahead(row[k], OUT), up: c.up });
    if (next) {
      const mid = { x: (row[k].x + next.x) / 2, z: (row[k].z + next.z) / 2, turn: (row[k].turn + next.turn) / 2, up: c.up };
      way.push({ ...ahead(mid, OUT + 0.4), up: c.up });
    }
  }
  // (on past its end, sideways from the last chair, as far in front of it:
  // along the curve of the row, they'd turn into the chair)
  const end = row[dir < 0 ? 0 : row.length - 1];
  const from = ahead(end, OUT);
  const d = { x: dir * Math.cos(end.turn), z: -dir * Math.sin(end.turn) };
  const on = (s: number): { x: number; z: number } => ({ x: from.x + d.x * s, z: from.z + d.z * s });
  let up = c.up;
  for (let s = 0.25; s < 30; s += 0.25) {
    const p = on(s);
    const there = underfoot(chairs, p.x, p.z);
    // (at each edge, a hop down off it, from just before it to a little
    // past it)
    if (Math.abs(there - up) > 0.05) {
      way.push({ ...on(Math.max(0, s - 0.6)), up }, { ...on(s + 0.9), up: there });
      up = there;
      s += 0.9;
      continue;
    }
    if (there <= 0.05 && !blocked(p.x, p.z, chairs)) return [...way, { ...p, up: 0 }];
  }
  // (nowhere clear that way: as near as there is)
  return [...way, { ...held(on(30).x, on(30).z, chairs), up: 0 }];
}

// ---- finding the way ----

// Whether someone could walk straight from `a` to `b` without anything in
// the way
export function clearLine(a: { x: number; z: number }, b: { x: number; z: number }, chairs: Chair[] = []): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    if (blocked(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, chairs)) return false;
  }
  return true;
}
// The floor as a grid, each square open or not, made again only when the
// chairs move
const CELL = 0.5;
const NX = Math.floor((2 * FLOOR_AREA.x) / CELL) + 1;
const NZ = Math.floor((FLOOR_AREA.front - FLOOR_AREA.back) / CELL) + 1;
const cellAt = (i: number): { x: number; z: number } => ({ x: -FLOOR_AREA.x + (i % NX) * CELL, z: FLOOR_AREA.back + Math.floor(i / NX) * CELL });
let grid = { key: "", shut: new Uint8Array(0) };
function shutFor(chairs: Chair[]): Uint8Array {
  const key = chairs.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.turn.toFixed(2)},${c.up.toFixed(1)}`).join(" ");
  if (grid.key === key) return grid.shut;
  // (shut if anywhere in the square is: then walking between the middles
  // of two open squares can't clip the edge of anything)
  const shut = new Uint8Array(NX * NZ);
  const h = CELL / 2;
  for (let i = 0; i < shut.length; i++) {
    const p = cellAt(i);
    shut[i] = [[0, 0], [-h, -h], [h, -h], [-h, h], [h, h]].some(([dx, dz]) => blocked(p.x + dx, p.z + dz, chairs)) ? 1 : 0;
  }
  grid = { key, shut };
  return shut;
}
// The way from `from` to `to`, round anything in the way: the places to
// walk straight to, one after another, ending at `to` (or as near it as
// anyone can stand). Straight there, if nothing's in the way.
export function route(from: { x: number; z: number }, to: { x: number; z: number }, chairs: Chair[] = []): { x: number; z: number }[] {
  if (clearLine(from, to, chairs)) return [to];
  const shut = shutFor(chairs);
  // (the nearest open square to a point, however far: only looking a few
  // squares out, somewhere behind a full back row found none, and asking
  // again from where anyone could stand near it found none either, round and
  // round until the page ran out of stack, 120 times a second)
  const near = (p: { x: number; z: number }): number => {
    const cx = Math.round((p.x + FLOOR_AREA.x) / CELL);
    const cz = Math.round((p.z - FLOOR_AREA.back) / CELL);
    for (let r = 0; r < Math.max(NX, NZ); r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const [x, z] = [cx + dx, cz + dz];
          if (x >= 0 && x < NX && z >= 0 && z < NZ && !shut[z * NX + x]) return z * NX + x;
        }
    return -1;
  };
  const start = near(from);
  const goal = near(to);
  if (start < 0 || goal < 0) return [from];
  // (A*, eight ways from each square)
  // (at full precision: rounded to a float32, a long way's cost came back
  // less than it went in, and the square was passed over as already done)
  const cost = new Float64Array(NX * NZ).fill(Infinity);
  const came = new Int32Array(NX * NZ).fill(-1);
  const guess = (i: number): number => {
    const [dx, dz] = [Math.abs((i % NX) - (goal % NX)), Math.abs(Math.floor(i / NX) - Math.floor(goal / NX))];
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const heap: [number, number][] = [[guess(start), start]];
  const push = (e: [number, number]): void => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0; ) {
      const up = (i - 1) >> 1;
      if (heap[up][0] <= heap[i][0]) break;
      [heap[up], heap[i]] = [heap[i], heap[up]];
      i = up;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [i * 2 + 1, i * 2 + 2];
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  cost[start] = 0;
  // (somewhere nobody can get to, as behind the back row of a full room: as
  // near it as anyone can)
  let best = start;
  while (heap.length) {
    const [f, i] = pop();
    if (guess(i) < guess(best)) best = i;
    if (i === goal) break;
    if (f > cost[i] + guess(i) + 1e-6) continue;
    const [x, z] = [i % NX, Math.floor(i / NX)];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const [nx, nz] = [x + dx, z + dz];
        if (nx < 0 || nx >= NX || nz < 0 || nz >= NZ) continue;
        const j = nz * NX + nx;
        // (no cutting a corner between two shut squares)
        if (shut[j] || (dx && dz && (shut[z * NX + nx] || shut[nz * NX + x]))) continue;
        const c = cost[i] + (dx && dz ? Math.SQRT2 : 1);
        if (c < cost[j]) {
          cost[j] = c;
          came[j] = i;
          push([c + guess(j), j]);
        }
      }
  }
  const reached = goal === start || came[goal] >= 0;
  const end = reached ? goal : best;
  const cells: { x: number; z: number }[] = [];
  for (let i = end; i !== start && i >= 0; i = came[i]) cells.unshift(cellAt(i));
  // (to `to` itself at the end, if anyone can stand there and get there)
  if (reached && !blocked(to.x, to.z, chairs) && (!cells.length || clearLine(cells.at(-1)!, to, chairs))) cells.push(to);
  if (!cells.length) return [from];
  // the corners only: from each, on to the furthest corner in sight (from
  // the nearest square that's open, if where they are isn't). (Only where
  // the squares turn: along a straight run, every square is in sight.)
  const turns = cells.filter((p, k) => k === cells.length - 1 || k === 0 || Math.abs((cells[k + 1].x - p.x) * (p.z - cells[k - 1].z) - (cells[k + 1].z - p.z) * (p.x - cells[k - 1].x)) > 1e-6);
  const out: { x: number; z: number }[] = [];
  let at = blocked(from.x, from.z, chairs) ? cellAt(start) : from;
  if (at !== from) out.push(at);
  for (let k = 0; k < turns.length; ) {
    let far = k;
    for (let j = turns.length - 1; j > k; j--)
      if (clearLine(at, turns[j], chairs)) {
        far = j;
        break;
      }
    // (none in sight: the next square, which always is)
    if (far === k && k > 0 && !clearLine(at, turns[k], chairs)) {
      const i = cells.indexOf(turns[k]);
      for (let j = cells.indexOf(at as { x: number; z: number }) + 1; j < i; j++) out.push(cells[j]);
    }
    out.push(turns[far]);
    at = turns[far];
    k = far + 1;
  }
  return out.length ? out : [from];
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
