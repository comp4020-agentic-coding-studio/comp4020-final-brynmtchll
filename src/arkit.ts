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

// What a cartoon head needs from a face, side by side, in its own terms:
// each eye's lid (blink and squint apart, so a wink, a squint and a sleepy
// look are each their own), how far the lower lids rise (a real smile's
// crinkle), each brow's inner and outer end, each mouth corner up or down,
// out or in, the lips pressed, rolled in, pushed out or funnelled, the jaw
// open and to either side, the upper lip raised, cheeks puffed and lifted,
// the nose wrinkled, the tongue out. All 0 to 1, but the sideways ones -1 to
// 1 (+ the screen's right). Sides are as drawn in the mirror: the camera's
// "Left" is the person's left, which their avatar shows on the screen's left.
export type Detail = {
  lidL: number; lidR: number; // shut: 0 open, 1 closed
  squintL: number; squintR: number; // lower lid up
  wideL: number; wideR: number;
  innerUp: number; // both brows' inner ends up (worry, surprise)
  outerUpL: number; outerUpR: number;
  downL: number; downR: number; // brows down and in
  smileL: number; smileR: number;
  frownL: number; frownR: number;
  stretchL: number; stretchR: number; // corners pulled out (fear, a grimace)
  dimpleL: number; dimpleR: number;
  press: number; // lips pressed together
  rollIn: number; // lips rolled in
  pucker: number;
  funnel: number;
  shrug: number; // lower lip pushed up (a pout)
  upperUp: number; // upper lip raised (disgust)
  jaw: number; // open
  jawSide: number; // -1 to 1
  mouthSide: number; // the whole mouth to one side, -1 to 1
  puff: number;
  cheekUp: number;
  sneer: number;
  tongue: number;
  lookX: number; lookY: number; // -1 to 1
};
export const STILL_DETAIL: Detail = {
  lidL: 0, lidR: 0, squintL: 0, squintR: 0, wideL: 0, wideR: 0, innerUp: 0, outerUpL: 0, outerUpR: 0, downL: 0, downR: 0,
  smileL: 0, smileR: 0, frownL: 0, frownR: 0, stretchL: 0, stretchR: 0, dimpleL: 0, dimpleR: 0, press: 0, rollIn: 0, pucker: 0, funnel: 0,
  shrug: 0, upperUp: 0, jaw: 0, jawSide: 0, mouthSide: 0, puff: 0, cheekUp: 0, sneer: 0, tongue: 0, lookX: 0, lookY: 0,
};

const I = Object.fromEntries(ARKIT.map((k, i) => [k, i])) as Record<ArkitName, number>;
// A face's 52 scores (as from a camera, with its rest taken off) as a head's
// detail. A little gain on what a camera reads small (brows and corners
// move only a few tenths on most faces), so a cartoon shows it as clearly
// as a real face does.
export function detailOf(f: Face52): Detail {
  const g = (k: ArkitName, gain = 1): number => Math.min(1, (f[I[k]] ?? 0) * gain);
  // (the mirror: the person's left is the screen's left, as drawn)
  const avg2 = (a: number, b: number): number => (a + b) / 2;
  return {
    lidL: g("eyeBlinkLeft", 1.15), lidR: g("eyeBlinkRight", 1.15),
    squintL: g("eyeSquintLeft", 1.4), squintR: g("eyeSquintRight", 1.4),
    wideL: g("eyeWideLeft", 1.6), wideR: g("eyeWideRight", 1.6),
    innerUp: g("browInnerUp", 1.5),
    outerUpL: g("browOuterUpLeft", 1.6), outerUpR: g("browOuterUpRight", 1.6),
    downL: g("browDownLeft", 1.5), downR: g("browDownRight", 1.5),
    smileL: g("mouthSmileLeft", 1.3), smileR: g("mouthSmileRight", 1.3),
    frownL: g("mouthFrownLeft", 2), frownR: g("mouthFrownRight", 2),
    stretchL: g("mouthStretchLeft", 2), stretchR: g("mouthStretchRight", 2),
    dimpleL: g("mouthDimpleLeft", 2), dimpleR: g("mouthDimpleRight", 2),
    press: Math.min(1, avg2(g("mouthPressLeft"), g("mouthPressRight")) * 2 + g("mouthClose") * 0.5),
    rollIn: Math.min(1, avg2(g("mouthRollLower"), g("mouthRollUpper")) * 1.8),
    pucker: g("mouthPucker", 1.3),
    funnel: g("mouthFunnel", 1.5),
    shrug: Math.min(1, avg2(g("mouthShrugLower"), g("mouthShrugUpper")) * 1.6),
    upperUp: Math.min(1, avg2(g("mouthUpperUpLeft"), g("mouthUpperUpRight")) * 1.8),
    jaw: g("jawOpen", 1.25),
    jawSide: Math.max(-1, Math.min(1, (g("jawRight") - g("jawLeft")) * 2.5)),
    mouthSide: Math.max(-1, Math.min(1, (g("mouthRight") - g("mouthLeft")) * 2.5)),
    puff: g("cheekPuff", 1.5),
    cheekUp: Math.min(1, avg2(g("cheekSquintLeft"), g("cheekSquintRight")) * 1.6),
    sneer: Math.min(1, avg2(g("noseSneerLeft"), g("noseSneerRight")) * 1.8),
    tongue: g("tongueOut", 2),
    lookX: Math.max(-1, Math.min(1, (avg2(g("eyeLookOutRight"), g("eyeLookInLeft")) - avg2(g("eyeLookOutLeft"), g("eyeLookInRight"))) * 2.2)),
    lookY: Math.max(-1, Math.min(1, (avg2(g("eyeLookUpLeft"), g("eyeLookUpRight")) - avg2(g("eyeLookDownLeft"), g("eyeLookDownRight"))) * 2.2)),
  };
}

// The same detail from the 15-number expression, for a face from a page that
// sends no scores (and from emotes, and the studio's pulled faces): the
// detail a cartoon head shows, made symmetric where the expression is.
export function detailFrom(e: { smile: number; frown: number; open: number; pucker: number; browUp: number; browDown: number; blink: number; wink: number; smirk: number; brow: number; lookX: number; lookY: number; wide: number; puff: number; sneer: number }): Detail {
  const lean = (v: number, s: 1 | -1): number => Math.max(0, v * s);
  return {
    ...STILL_DETAIL,
    lidL: Math.min(1, e.blink + lean(e.wink, -1)), lidR: Math.min(1, e.blink + lean(e.wink, 1)),
    squintL: e.smile * 0.5, squintR: e.smile * 0.5,
    wideL: e.wide, wideR: e.wide,
    innerUp: e.browUp * (0.6 + e.frown * 0.4),
    outerUpL: Math.min(1, e.browUp + lean(e.brow, -1)), outerUpR: Math.min(1, e.browUp + lean(e.brow, 1)),
    downL: e.browDown, downR: e.browDown,
    smileL: Math.min(1, e.smile + lean(e.smirk, -1)), smileR: Math.min(1, e.smile + lean(e.smirk, 1)),
    frownL: e.frown, frownR: e.frown,
    pucker: e.pucker, jaw: e.open, puff: e.puff, cheekUp: e.smile * 0.6, sneer: e.sneer, upperUp: e.sneer * 0.6,
    lookX: e.lookX, lookY: e.lookY,
  };
}

// one detail eased towards another, as an expression is (k of the way)
export function easeDetail(a: Detail, b: Detail, k: number): Detail {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Detail)[]) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}
// the larger of two details, part by part (a voice's mouth over a face's;
// the sideways ones by whichever's further from the middle)
export function overlay(a: Detail, b: Partial<Detail>): Detail {
  const out = { ...a };
  for (const [key, v] of Object.entries(b) as [keyof Detail, number][]) {
    const sideways = key === "jawSide" || key === "mouthSide" || key === "lookX" || key === "lookY";
    out[key] = sideways ? (Math.abs(v) > Math.abs(out[key]) ? v : out[key]) : Math.max(out[key], v);
  }
  return out;
}
