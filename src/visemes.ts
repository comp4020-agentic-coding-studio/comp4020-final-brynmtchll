// A mouth that makes the shapes of the words, without a camera: how loud
// someone is (the levels their page sends as they talk) opens it, and the
// word going up, read letter by letter, shapes it: "oo" puckers, "ee"
// stretches, "m", "b" and "p" press the lips shut, "f" and "v" tuck the lower
// lip, "ah" drops the jaw. As ARKit scores (arkit.ts), so a face from a
// camera and a mouth from a voice are the same kind of thing, and the avatar
// shows whichever it has (a camera's wins).
//
// English spelling is a rough guide to sound, but a mouth only needs the
// shape of each sound, roughly in time, to read as speech: lip-sync for
// animation works the same way, from about a dozen mouth shapes ("visemes").
import { ARKIT, STILL52, type ArkitName, type Face52 } from "./arkit.ts";

type Shape = Partial<Record<ArkitName, number>>;

// the mouth shapes, as ARKit scores at full strength
const SHAPES: Record<string, Shape> = {
  rest: {},
  ah: { jawOpen: 0.7, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3 }, // a, ah
  eh: { jawOpen: 0.45, mouthStretchLeft: 0.35, mouthStretchRight: 0.35 }, // e, eh
  ee: { jawOpen: 0.2, mouthStretchLeft: 0.6, mouthStretchRight: 0.6, mouthSmileLeft: 0.25, mouthSmileRight: 0.25 }, // ee, i
  oh: { jawOpen: 0.45, mouthFunnel: 0.65, mouthPucker: 0.3 }, // o
  oo: { jawOpen: 0.15, mouthPucker: 0.9, mouthFunnel: 0.4 }, // oo, u, w
  mbp: { mouthClose: 0.6, mouthPressLeft: 0.6, mouthPressRight: 0.6, mouthRollLower: 0.2 }, // m, b, p: lips together
  fv: { jawOpen: 0.1, mouthRollLower: 0.6, mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25 }, // f, v: lower lip to teeth
  th: { jawOpen: 0.2, tongueOut: 0.4 }, // th
  l: { jawOpen: 0.3, tongueOut: 0.1 }, // l, n, d, t
  s: { jawOpen: 0.08, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 }, // s, z, ch, sh, j
  r: { jawOpen: 0.2, mouthPucker: 0.35, mouthFunnel: 0.3 }, // r
  k: { jawOpen: 0.35 }, // k, g, h
};

// A word's letters as a run of mouth shapes. Two-letter sounds first (so
// "th" isn't t then h, "oo" isn't two o's), then one letter each; silent
// letters (a final e, an h after most consonants) make no shape of their own.
export function visemesOf(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    const pair: Record<string, string> = { th: "th", sh: "s", ch: "s", ph: "fv", oo: "oo", ee: "ee", ea: "ee", ou: "oh", ow: "oh", ai: "eh", ay: "eh", oa: "oh", qu: "oo", wh: "oo", ng: "k", ck: "k", ie: "ee" };
    if (pair[two]) {
      out.push(pair[two]);
      i++;
      continue;
    }
    const c = w[i];
    if (c === "e" && i === w.length - 1 && w.length > 2) continue; // a final e is silent
    if (c === "h" && i > 0) continue;
    const one: Record<string, string> = { a: "ah", e: "eh", i: "ee", o: "oh", u: "oo", y: "ee", w: "oo", m: "mbp", b: "mbp", p: "mbp", f: "fv", v: "fv", l: "l", n: "l", d: "l", t: "l", s: "s", z: "s", c: "s", j: "s", x: "s", r: "r", k: "k", g: "k", h: "k", q: "k" };
    out.push(one[c] ?? "rest");
  }
  // (two of the same in a row is one held shape)
  return out.filter((v, i) => v !== out[i - 1]);
}

// Which shape the mouth is making `t` seconds into a word `len` long, and
// how far into it (the shapes share the word's time evenly), blended into the
// next for the last third of each, as a mouth moves continuously from one
// shape to the next.
export function mouthAt(shapes: string[], t: number, len: number): Shape {
  if (!shapes.length || len <= 0) return {};
  const each = len / shapes.length;
  const i = Math.min(shapes.length - 1, Math.max(0, Math.floor(t / each)));
  const within = (t - i * each) / each;
  const a = SHAPES[shapes[i]] ?? {};
  const b = SHAPES[shapes[i + 1] ?? "rest"] ?? {};
  const k = within > 0.66 ? (within - 0.66) / 0.34 : 0;
  const out: Shape = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<ArkitName>) out[key] = (a[key] ?? 0) * (1 - k) + (b[key] ?? 0) * k;
  return out;
}

// The mouth as a face (52 scores): a shape, opened as wide as the voice is
// loud (`level`, 0 to 1; a whisper barely moves it, a shout opens it right
// up), and without a word to go on, the jaw alone following the level.
export function mouthFace(shape: Shape | null, level: number): Face52 {
  const f = [...STILL52];
  const open = Math.min(1, Math.max(0, level));
  if (!shape || !Object.keys(shape).length) {
    f[ARKIT.indexOf("jawOpen")] = Math.round(open * 0.6 * 100) / 100;
    return f;
  }
  // (lips pressed shut for an m stay shut however loud; everything else opens
  // with the voice, never quite to nothing while there is one)
  const strength = 0.35 + open * 0.75;
  for (const [k, v] of Object.entries(shape) as [ArkitName, number][]) {
    const press = k === "mouthClose" || k.startsWith("mouthPress") || k.startsWith("mouthRoll");
    f[ARKIT.indexOf(k)] = Math.round(Math.min(1, v * (press ? 1 : strength)) * 100) / 100;
  }
  return f;
}

// A camera's face, with a voice's mouth laid over it where the camera isn't
// sure (no face found) or not running: the face from the camera always wins
// what it can see.
export function withMouth(face: Face52 | null, mouth: Face52): Face52 {
  if (!face) return mouth;
  return face;
}
