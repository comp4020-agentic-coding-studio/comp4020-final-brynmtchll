// What keeps an avatar alive when nothing's telling it what to do: it
// breathes, blinks on its own rhythm, its eyes flick about now and then, its
// head drifts a little, and how each word was said shows on its face (brows
// up for a word said high, eyes wide for one said loud, a squint for one
// said quietly and low). A face from a camera always wins what it shows: this
// only fills in, so nobody's avatar is a mask between expressions.
//
// As ARKit scores (arkit.ts) and a small turn of the head and eyes, from a
// seed so each person's rhythm is their own, and from the time alone, so
// every page shows the same person doing the same thing.
import { ARKIT, type Face52 } from "./arkit.ts";

const at = (k: string): number => ARKIT.indexOf(k as (typeof ARKIT)[number]);
const BLINK_L = at("eyeBlinkLeft");
const BLINK_R = at("eyeBlinkRight");

// a smooth wobble from -1 to 1, made of three slow waves (no two people's
// the same, never quite repeating)
function wobble(seed: number, t: number, speed = 1): number {
  const a = seed * 12.9898;
  return (Math.sin(t * 0.31 * speed + a) * 0.5 + Math.sin(t * 0.73 * speed + a * 1.7) * 0.3 + Math.sin(t * 1.37 * speed + a * 2.3) * 0.2);
}
// a number from 0 to 1 for the n-th event of a seed, the same everywhere
function hash(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// How shut the eyes are from blinking at `t` seconds: a blink every 2 to 6
// s (closing in 0.07 s, opening in 0.15, as real blinks are quicker down
// than up), sometimes two close together.
export function blinkAt(seed: number, t: number): number {
  let start = 0;
  for (let n = 0; n < 4000; n++) {
    const gap = 2 + hash(seed, n) * 4;
    const next = start + gap;
    if (next > t + 0.3) break;
    const since = t - next;
    if (since >= 0 && since < 0.22) return since < 0.07 ? since / 0.07 : 1 - (since - 0.07) / 0.15;
    // (a double blink, now and then)
    if (hash(seed, n + 9999) < 0.15) {
      const second = since - 0.32;
      if (second >= 0 && second < 0.22) return second < 0.07 ? second / 0.07 : 1 - (second - 0.07) / 0.15;
    }
    start = next;
  }
  return 0;
}

export type Alive = { face: Face52; head: { yaw: number; pitch: number; roll: number }; eyes: { x: number; y: number }; breath: number };

// What a person's avatar is doing of itself at `t` seconds: breathing (0 to 1,
// for the chest and shoulders), a blink, eyes that hold then flick (as eyes
// do: a saccade every second or two, then still), and a head that drifts by
// a few degrees.
export function aliveAt(seed: number, t: number): Alive {
  const face = ARKIT.map(() => 0);
  const b = blinkAt(seed, t);
  face[BLINK_L] = b;
  face[BLINK_R] = b;
  // eyes: held at a point, then a quick jump to the next (every 0.8 to 2.4 s)
  let s = 0;
  let n = 0;
  while (n < 4000) {
    const hold = 0.8 + hash(seed + 7, n) * 1.6;
    if (s + hold > t) break;
    s += hold;
    n++;
  }
  const eyes = { x: (hash(seed + 3, n) - 0.5) * 0.5, y: (hash(seed + 5, n) - 0.5) * 0.25 };
  return {
    face,
    head: { yaw: wobble(seed, t, 0.6) * 0.06, pitch: wobble(seed + 1, t, 0.5) * 0.04, roll: wobble(seed + 2, t, 0.4) * 0.03 },
    eyes,
    breath: Math.sin(t * ((2 * Math.PI) / (3.6 + hash(seed, 1) * 1.4))) * 0.5 + 0.5,
  };
}

// How a word was said, on the face, while it's going up: higher said, brows
// up and eyes a little wider; louder, eyes wide and the brows with them; said
// quiet and low, a softer squint. Numbers from voice.ts (loud in dB against
// the speaker's usual, pitch in semitones), eased by the caller.
export function sayingFace(loud: number, pitch: number): Partial<Record<(typeof ARKIT)[number], number>> {
  const up = Math.max(0, Math.min(1, pitch / 6));
  const down = Math.max(0, Math.min(1, -pitch / 6));
  const lo = Math.max(0, Math.min(1, loud / 10));
  const soft = Math.max(0, Math.min(1, -loud / 10));
  return {
    browInnerUp: up * 0.7 + lo * 0.3,
    browOuterUpLeft: up * 0.6 + lo * 0.25,
    browOuterUpRight: up * 0.6 + lo * 0.25,
    eyeWideLeft: lo * 0.6 + up * 0.2,
    eyeWideRight: lo * 0.6 + up * 0.2,
    eyeSquintLeft: soft * 0.35 + down * 0.2,
    eyeSquintRight: soft * 0.35 + down * 0.2,
    browDownLeft: down * 0.3,
    browDownRight: down * 0.3,
  };
}

// The face shown: a camera's, if there is one, with only a blink of its own
// added when the camera's eyes are open (none if they're shut); otherwise the
// avatar's own life, the mouth from the voice, and how the word was said.
export function faceShown(camera: Face52 | null, alive: Alive, mouth: Face52, saying: Partial<Record<(typeof ARKIT)[number], number>>): Face52 {
  if (camera) return camera;
  const f = alive.face.map((v, i) => Math.max(v, mouth[i]));
  for (const [k, v] of Object.entries(saying)) {
    const i = at(k);
    if (i >= 0) f[i] = Math.min(1, Math.max(f[i], v ?? 0));
  }
  return f;
}
