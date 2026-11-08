// A face as all 52 of the scores MediaPipe's face landmarker reads off it
// each frame (Apple ARKit's names: jawOpen, mouthSmileLeft, cheekSquintRight,
// mouthPressLeft, tongueOut…), each 0 to 1. The avatars (VRoid "perfect
// sync" models, made for this) have a shape for every one, so a face is
// shown as it is, muscle by muscle, rather than squeezed into a handful of
// expressions (Brynly, 8 Nov: "i want these in depth mimmicked").
//
// Only these numbers leave the browser: no picture, never sound. They're
// sent as a short list in this order, each to two decimals, so a face is a
// few hundred bytes.

export const ARKIT = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
  "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight",
  "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight",
  "eyeWideLeft", "eyeWideRight",
  "jawForward", "jawLeft", "jawOpen", "jawRight",
  "mouthClose", "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight", "mouthFunnel",
  "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight", "mouthPucker",
  "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
  "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft", "mouthUpperUpRight",
  "noseSneerLeft", "noseSneerRight", "tongueOut",
] as const;
export type ArkitName = (typeof ARKIT)[number];
// a face: one score per name, in ARKIT's order
export type Face52 = number[];

export const STILL52: Face52 = ARKIT.map(() => 0);

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const two = (n: number): number => Math.round(n * 100) / 100;

// MediaPipe's scores by name (as its blendshape categories come), with how
// this face scores at rest taken off (a face that rests a little frowny
// rests as a rest), then stretched back to 0–1 above the rest, as a list.
export function face52(scores: Partial<Record<string, number>>, rest: Partial<Record<string, number>> = {}): Face52 {
  return ARKIT.map((k) => {
    const r = Math.min(0.6, rest[k] ?? 0);
    return two(clamp01(((scores[k] ?? 0) - r) / (1 - r)));
  });
}

// A face as it arrives from someone else's page: exactly 52 numbers, each
// pulled into 0–1 (anything else isn't a face). The server keeps to this too.
export function cleanFace52(raw: unknown): Face52 | null {
  if (!Array.isArray(raw) || raw.length !== ARKIT.length) return null;
  const out: Face52 = [];
  for (const v of raw) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out.push(two(clamp01(v)));
  }
  return out;
}

// The scores mirrored, left for right: the camera sees someone as others
// see them, but they see themselves in a mirror (their own avatar, on their
// own screen, moves like a reflection).
const SWAP = ARKIT.map((k) => {
  const other = k.endsWith("Left") ? k.replace(/Left$/, "Right") : k.endsWith("Right") ? k.replace(/Right$/, "Left") : k;
  return ARKIT.indexOf(other as ArkitName);
});
export const mirrored = (f: Face52): Face52 => SWAP.map((j) => f[j]);

// Following a face smoothly without lagging it: the One Euro filter (Casiez,
// Roussel & Vogel, CHI 2012), which smooths hard when a score is barely
// moving (so a still face doesn't shimmer) and hardly at all when it moves
// fast (so a blink or a jaw dropping isn't late). One per score.
export function oneEuro(minCutoff = 1.6, beta = 18, dCutoff = 1): (x: number, t: number) => number {
  let prev: number | null = null;
  let dPrev = 0;
  let tPrev = 0;
  const alpha = (cutoff: number, dt: number): number => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return (x, t) => {
    if (prev === null) {
      prev = x;
      tPrev = t;
      return x;
    }
    const dt = Math.max(1e-3, t - tPrev);
    tPrev = t;
    const d = (x - prev) / dt;
    dPrev = dPrev + alpha(dCutoff, dt) * (d - dPrev);
    const cutoff = minCutoff + beta * Math.abs(dPrev);
    prev = prev + alpha(cutoff, dt) * (x - prev);
    return prev;
  };
}
export function faceFilter(): (f: Face52, t: number) => Face52 {
  // (blinks are fast and all-or-nothing: they're filtered least, or a blink
  // reads as a slow droop)
  const filters = ARKIT.map((k) => (k.startsWith("eyeBlink") ? oneEuro(4, 40) : oneEuro()));
  return (f, t) => f.map((v, i) => two(clamp01(filters[i](v, t))));
}

// A face arriving from the network a few times a second, eased towards on
// every frame drawn, so it moves continuously rather than stepping: each
// frame goes this share of the rest of the way per 1/60 s.
export function easeFace(from: Face52, to: Face52, dt: number, rate = 0.35): Face52 {
  const k = 1 - Math.pow(1 - rate, dt * 60);
  return from.map((v, i) => v + (to[i] - v) * k);
}
