// Each person's avatar: a face drawn in SVG that pulls the expression its
// owner is pulling, from a handful of numbers read off their camera, in a look
// they choose. Shared by the server (which draws it into the page and checks
// what's sent) and the browser (which redraws it as expressions arrive).
//
// Nothing about a face leaves its owner's browser but the numbers in
// Expression and Pose, many times a second while they've asked for it: no
// picture. head3d.ts draws the same face as a 3D head; this flat one is what
// the server draws into the page, and stays where there's no WebGL.

// How the face is set, from MediaPipe's expression scores. Most are 0 to 1;
// the ones that go either way (one side more than the other, eyes left or
// right) are -1 to 1. Sides are as drawn, in a mirror: + is the right of the
// screen.
export type Expression = {
  smile: number;
  frown: number;
  open: number; // jaw
  pucker: number;
  browUp: number;
  browDown: number;
  blink: number;
  wink: number; // -1 to 1: one eye shut more than the other, + the eye on the right
  smirk: number; // -1 to 1: one corner of the mouth up more, + the right
  brow: number; // -1 to 1: one brow raised more, + the right
  lookX: number; // -1 to 1: eyes turned, + to the right
  lookY: number; // -1 to 1: + up
  wide: number; // eyes wide open
  puff: number; // cheeks puffed
  sneer: number; // nose wrinkled
};
export const REST: Expression = { smile: 0, frown: 0, open: 0, pucker: 0, browUp: 0, browDown: 0, blink: 0, wink: 0, smirk: 0, brow: 0, lookX: 0, lookY: 0, wide: 0, puff: 0, sneer: 0 };
const KEYS = Object.keys(REST) as (keyof Expression)[];
const EITHER_WAY = new Set<keyof Expression>(["wink", "smirk", "brow", "lookX", "lookY"]);

// What someone can choose about how their avatar looks lives in packs.ts.
export { cleanLook, lookFor } from "./packs.ts";
import type { Look } from "./packs.ts";
export type { Look };

const clamp01 = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// an expression as sent, as its numbers and nothing else, each within its
// range, or null if it isn't one
export function cleanExpression(input: unknown): Expression | null {
  if (typeof input !== "object" || input === null) return null;
  const e = input as Record<string, unknown>;
  return Object.fromEntries(KEYS.map((k) => [k, round2(EITHER_WAY.has(k) ? within(e[k], 1) : clamp01(e[k]))])) as Expression;
}

// Which way someone's head is turned, in radians, as drawn: nodding (pitch,
// + is chin down), shaking (yaw, + turns the nose to the right of the screen)
// and tilting (roll, + is anticlockwise); and where it is, -1 to 1: across
// (x, + right), up (y) and leaning in (z, + nearer). Drawn as in a mirror,
// the way the camera preview shows you, so your avatar moves the way you see
// yourself move. Sent with an expression, kept within a head's reach.
export type Pose = { pitch: number; yaw: number; roll: number; x: number; y: number; z: number };
export const STILL: Pose = { pitch: 0, yaw: 0, roll: 0, x: 0, y: 0, z: 0 };
const REACH: Pose = { pitch: 0.5, yaw: 0.7, roll: 0.5, x: 1, y: 1, z: 1 };
function within(n: unknown, reach: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(reach, Math.max(-reach, n)) : 0;
}

// a head's turn and place as sent, as its numbers and nothing else, or null
// if it isn't one
export function cleanPose(input: unknown): Pose | null {
  if (typeof input !== "object" || input === null) return null;
  const p = input as Record<string, unknown>;
  return Object.fromEntries((Object.keys(REACH) as (keyof Pose)[]).map((k) => [k, round2(within(p[k], REACH[k]))])) as Pose;
}

// MediaPipe's facial transformation matrix (4 by 4, a column at a time) as
// the head's turn and place, as the camera has it: its rotation taken apart
// in the order three.js puts one back together (x, then y, then z), then
// mirrored (a mirror leaves a nod as it is and turns a shake or a tilt the
// other way); its place in centimetres from the camera, x across the
// picture, y up, z nearer (tried on the portrait moved about in the frame).
export type Placed = Pose;
export function placed(m: ArrayLike<number>): Placed {
  return {
    pitch: Math.atan2(-m[9], m[10]),
    yaw: -Math.asin(Math.min(1, Math.max(-1, m[8]))),
    roll: -Math.atan2(-m[4], m[0]),
    x: m[12],
    y: m[13],
    z: m[14],
  };
}

// That as a Pose, against `home`, where this person's head usually is (a
// laptop's camera sits below the eyes, so a head facing the screen is
// turned up from it): moving SHIFT cm from there (or LEAN cm nearer) is as
// far as the head goes. Mirrored, so moving to the picture's right is to
// the screen's left. With no home, it's taken to be where the head is, so
// only the turn shows.
const SHIFT = 12;
const LEAN = 15;
export function poseFrom(m: ArrayLike<number>, home?: Placed): Pose {
  const now = placed(m);
  const from = home ?? { ...now, pitch: 0, yaw: 0, roll: 0 };
  return cleanPose({
    pitch: now.pitch - from.pitch,
    yaw: now.yaw - from.yaw,
    roll: now.roll,
    x: -(now.x - from.x) / SHIFT,
    y: (now.y - from.y) / SHIFT,
    z: (now.z - from.z) / LEAN,
  })!;
}

// MediaPipe's expression scores (blend shapes), by its names for them.
export type Shapes = Partial<Record<string, number>>;

// MediaPipe's expression scores as an Expression. Its scores rarely reach 1,
// so each is stretched so an ordinary smile or frown moves the avatar fully,
// and a resting face sits at rest. MediaPipe names sides as the person's own
// (their left eye is on the picture's right), which in a mirror is the
// screen's left. `rest` is how this person's face scores at rest, where it's
// known (see resting()): taken off first, so a face that rests a little
// frowny, or with one brow higher, rests as a rest.
export function fromShapes(raw: Shapes, rest: Shapes = {}): Expression {
  const s: Shapes = {};
  for (const [k, v] of Object.entries(raw)) s[k] = Math.max(0, (v ?? 0) - (rest[k] ?? 0));
  const avg = (...names: string[]): number => names.reduce((n, k) => n + (s[k] ?? 0), 0) / names.length;
  const stretch = (v: number, from: number, to: number): number => round2(clamp01((v - from) / (to - from)));
  // (+ 0, so no side is ever -0)
  const lean = (v: number, from: number, to: number): number => round2(Math.sign(v) * clamp01((Math.abs(v) - from) / (to - from))) + 0;
  const smile = avg("mouthSmileLeft", "mouthSmileRight");
  const blinkL = s.eyeBlinkLeft ?? 0;
  const blinkR = s.eyeBlinkRight ?? 0;
  return {
    smile: stretch(smile, 0.1, 0.7),
    frown: stretch(avg("mouthFrownLeft", "mouthFrownRight", "mouthPressLeft", "mouthPressRight"), 0.08, 0.45),
    open: stretch(s.jawOpen ?? 0, 0.05, 0.55),
    pucker: stretch(Math.max(s.mouthPucker ?? 0, (s.mouthFunnel ?? 0) * 0.8), 0.2, 0.8),
    browUp: stretch(avg("browInnerUp", "browOuterUpLeft", "browOuterUpRight"), 0.1, 0.6),
    // A real smile pushes the cheeks up and the brows down: MediaPipe gave a
    // broad grin browDown 0.83, which drawn as it stood was a scowl. A smile
    // takes its brows-down away (the eyes crinkle instead); without one,
    // brows down is a frown or a glare.
    browDown: stretch(avg("browDownLeft", "browDownRight") * (1 - Math.min(1, smile * 1.4)), 0.1, 0.55),
    // both eyes shut is a blink; one shut more than the other is a wink, its
    // own eye (their left, the screen's left, is -)
    blink: stretch(Math.min(blinkL, blinkR), 0.35, 0.75),
    wink: lean(blinkR - blinkL, 0.15, 0.5),
    smirk: lean((s.mouthSmileRight ?? 0) - (s.mouthSmileLeft ?? 0), 0.12, 0.45),
    brow: lean((s.browOuterUpRight ?? 0) - (s.browOuterUpLeft ?? 0), 0.12, 0.4),
    // Eyes to the screen's right (their left, in the mirror) is their left eye
    // looking out and their right looking in; tried on the portrait with its
    // irises moved.
    lookX: lean(avg("eyeLookOutRight", "eyeLookInLeft") - avg("eyeLookOutLeft", "eyeLookInRight"), 0.05, 0.4),
    lookY: lean(avg("eyeLookUpLeft", "eyeLookUpRight") - avg("eyeLookDownLeft", "eyeLookDownRight"), 0.05, 0.4),
    wide: stretch(avg("eyeWideLeft", "eyeWideRight"), 0.15, 0.55),
    puff: stretch(s.cheekPuff ?? 0, 0.15, 0.55),
    sneer: stretch(avg("noseSneerLeft", "noseSneerRight"), 0.15, 0.5),
  };
}

// Learning someone's face at rest, from the scores as they come: for each,
// a low percentile of the last few seconds' readings (what it falls back to
// between expressions), never more than MOST_REST, so a held grin isn't
// learned as a rest.
const REST_OVER = 240; // readings: about eight seconds at 30 a second
const MOST_REST = 0.35;
export function resting(): { add(s: Shapes): void; rest(): Shapes } {
  const seen: Shapes[] = [];
  return {
    add(s) {
      seen.push(s);
      if (seen.length > REST_OVER) seen.shift();
    },
    rest() {
      if (seen.length < 30) return {};
      const out: Shapes = {};
      for (const k of Object.keys(seen.at(-1)!)) {
        const vs = seen.map((x) => x[k] ?? 0).sort((a, b) => a - b);
        out[k] = Math.min(MOST_REST, vs[Math.floor(vs.length * 0.2)]);
      }
      return out;
    },
  };
}

// Readings jitter frame to frame, but a face moves fast: the One Euro filter
// (Casiez, Roussel and Vogel, CHI 2012) smooths hard while a number holds
// still and hardly at all while it moves, so jitter goes without lag. One
// per number; `at` in seconds.
export function oneEuro(minCutoff = 1.2, beta = 0.6, dCutoff = 1): (v: number, at: number) => number {
  let last: number | null = null;
  let lastD = 0;
  let lastAt = 0;
  const alpha = (cutoff: number, dt: number): number => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return (v, at) => {
    if (last === null) {
      last = v;
      lastAt = at;
      return v;
    }
    const dt = Math.max(1e-3, at - lastAt);
    lastAt = at;
    const d = (v - last) / dt;
    lastD += alpha(dCutoff, dt) * (d - lastD);
    last += alpha(minCutoff + beta * Math.abs(lastD), dt) * (v - last);
    return last;
  };
}

// The same for every number of an object.
export function smoother<O extends Record<string, number>>(minCutoff?: number, beta?: number): (o: O, at: number) => O {
  const filters = new Map<string, (v: number, at: number) => number>();
  return (o, at) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (!filters.has(k)) filters.set(k, oneEuro(minCutoff, beta));
      out[k] = round2(filters.get(k)!(v, at));
    }
    return out as O;
  };
}

const n = (v: number): string => (Math.round(v * 10) / 10).toString();

// The avatar as SVG, 100 by 100, in a look, pulling an expression. Each
// feature is drawn from the numbers, so it moves smoothly between any two.
// (a label is someone's name: never markup)
const attr = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function avatarSvg(look: Look, e: Expression = REST, label = ""): string {
  const ink = "#1b1f2a";
  // eyes: open height shrinks with a blink (or a wink, on its side), and
  // with a big smile (cheeks push up); the pupils follow where they look
  const lidOf = (side: number): number => Math.max(0.08, 1 - Math.min(1, e.blink + Math.max(0, e.wink * side)) - e.smile * 0.35 + e.wide * 0.2);
  const eyeY = 44 - e.browUp * 2;
  const eye = (cx: number): string => {
    const lid = lidOf(cx < 50 ? -1 : 1);
    const x = cx + e.lookX * 2.5;
    if (look.eyes === "sleepy") return `<path d="M${x - 6} ${eyeY} q6 ${n(5 * lid)} 12 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    const r = look.eyes === "round" ? 6 : 4.5;
    const shine = look.eyes === "sparkle" ? `<circle cx="${x + 1.8}" cy="${n(eyeY - 1.8 * lid)}" r="1.6" fill="#fff"/>` : "";
    const white = look.eyes === "round" ? `<ellipse cx="${x}" cy="${eyeY}" rx="${r + 2}" ry="${n((r + 2) * lid)}" fill="#fff"/>` : "";
    return `${white}<ellipse cx="${x}" cy="${eyeY}" rx="${r - (look.eyes === "round" ? 2 : 0)}" ry="${n(Math.max(0.6, (r - (look.eyes === "round" ? 2 : 0)) * lid))}" fill="${ink}"/>${shine}`;
  };
  // brows: up lifts them; down drops them and angles the inner ends down
  // (cross); up with a frown lifts the inner ends (worried, sad)
  const brow = (x: number, side: number): string => {
    // side is 1 for the brow on the left of the screen, -1 for the right
    const y = 33 - e.browUp * 6 + e.browDown * 4 - Math.max(0, -e.brow * side) * 5;
    const inner = e.browDown * 5 - e.browUp * e.frown * 6 - e.browUp * 1.5;
    const outer = -e.browDown * 1.5 + e.browUp * e.frown * 3;
    return `<path d="M${x - 7 * side} ${n(y + outer)} L${x + 6 * side} ${n(y + inner)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  };
  // mouth: smile curves the corners up, frown down; open drops the jaw;
  // pucker narrows it to a little "o"
  const w = (look.mouth === "wide" ? 22 : 16) * (1 - e.pucker * 0.55) * (1 + e.smile * 0.15);
  const curve = (e.smile - e.frown) * 9;
  const open = e.open * 16 + e.pucker * 3;
  const my = 66 + e.frown * 2;
  let mouth: string;
  if (look.mouth === "cat" && open < 3) {
    mouth = `<path d="M${n(50 - w / 2)} ${n(my - curve * 0.4)} q${n(w / 4)} ${n(5 + curve * 0.5)} ${n(w / 2)} 0 q${n(w / 4)} ${n(5 + curve * 0.5)} ${n(w / 2)} 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (open < 2.5) {
    mouth = `<path d="M${n(50 - w / 2)} ${n(my - curve * 0.5)} Q50 ${n(my + curve)} ${n(50 + w / 2)} ${n(my - curve * 0.5)}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    // an open mouth: a lip line on top, a jaw that drops below, a tongue
    const top = my - curve * 0.5;
    mouth = `<path d="M${n(50 - w / 2)} ${n(top)} Q50 ${n(my + curve * 0.6)} ${n(50 + w / 2)} ${n(top)} Q50 ${n(my + curve * 0.6 + open + 4)} ${n(50 - w / 2)} ${n(top)} Z" fill="#5a1f2b" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>` +
      (open > 6 ? `<ellipse cx="50" cy="${n(my + curve * 0.4 + open * 0.75)}" rx="${n(w * 0.25)}" ry="${n(open * 0.18)}" fill="#e36a7a"/>` : "");
  }
  const blush = look.extra === "blush" || e.smile > 0.6
    ? `<ellipse cx="29" cy="58" rx="6" ry="3.5" fill="#ff7a8a" opacity="${n(look.extra === "blush" ? 0.55 : (e.smile - 0.6) * 1.2)}"/><ellipse cx="71" cy="58" rx="6" ry="3.5" fill="#ff7a8a" opacity="${n(look.extra === "blush" ? 0.55 : (e.smile - 0.6) * 1.2)}"/>`
    : "";
  const extra = ({
    none: "",
    blush: "",
    glasses: `<g fill="none" stroke="${ink}" stroke-width="2.5"><circle cx="36" cy="${eyeY}" r="9"/><circle cx="64" cy="${eyeY}" r="9"/><path d="M45 ${eyeY} h10 M27 ${eyeY - 2} l-7 -3 M73 ${eyeY - 2} l7 -3"/></g>`,
    shades: `<g fill="${ink}"><path d="M24 ${eyeY - 7} h24 v7 q-1 7 -12 7 q-11 0 -12 -7 Z M52 ${eyeY - 7} h24 v7 q-1 7 -12 7 q-11 0 -12 -7 Z"/><path d="M48 ${eyeY - 5} h4" stroke="${ink}" stroke-width="2.5"/></g>`,
    hat: `<path d="M10 25 Q50 10 90 25 L86 31 Q50 19 14 31 Z" fill="#2f3a56"/><path d="M24 24 Q26 -2 50 -2 Q74 -2 76 24 Z" fill="#3d4a6e"/><path d="M24.5 17 Q50 11 75.5 17 L75.8 22 Q50 16 24.2 22 Z" fill="#e0506a"/>`,
    headphones: `<path d="M16 52 Q14 14 50 12 Q86 14 84 52" fill="none" stroke="${ink}" stroke-width="5"/><rect x="9" y="46" width="12" height="20" rx="5" fill="${look.extraColour}"/><rect x="79" y="46" width="12" height="20" rx="5" fill="${look.extraColour}"/>`,
  } as Record<string, string>)[look.extra] ?? "";
  // hair, as a cap of its colour over the top of the head (the 3D head has
  // the shapes; this is the fallback)
  const hair = look.hair === "none" ? "" : `<path d="M14 46 Q14 12 50 12 Q86 12 86 46 Q72 26 50 26 Q28 26 14 46 Z" fill="${look.hairColour}"/>`;
  return `<svg class="avatar" viewBox="0 -4 100 104" role="img" aria-label="${attr(label)}"><circle cx="50" cy="52" r="38" fill="${look.skin}" stroke="${ink}" stroke-width="2.5"/>${hair}${blush}${look.brows === "none" ? "" : brow(36, 1) + brow(64, -1)}${eye(36)}${eye(64)}${mouth}${extra}</svg>`;
}
