// Hands and heads that go with particular words, as people's do when they
// talk: "hi" with a little wave, "me" with a hand to the chest, "you" with
// an open hand out, "big" with the hands apart, "maybe" with a shrug, "yes"
// with a nod and "no" with a shake. Read off the speaker's own words as
// they go up, never anyone else's, and only ever showing the word: what a
// word means to someone, how they feel saying it, is theirs to show.
//
// Each is a pose at its height, as drawn (body.ts: x to the screen's right,
// y up, z towards whoever's looking), which the head eases into and out of
// over the word; a few move as they're held (a wave waves). Words that are
// almost always said in passing ("I", "a", "the") get none: a hand to the
// chest on every "I" would be a tic, not a gesture.
import { mirrored, RESTING, unit, type Arm, type Side, type Vec } from "./body.ts";

export type Gesture = {
  // which hands: the one they talk with, or both
  hands: "one" | "both";
  // the arm at the gesture's height (the right; the left is its mirror)
  arm: Arm | null;
  // as it's held: "wave" waves the forearm, "shrug" lifts the elbows a little
  moves?: "wave" | "shrug";
  // the head with it: a nod, a shake, a tilt, as many times as it says
  head?: { nod?: number; shake?: number; tilt?: number };
};

const hand = (curl: number, point: Vec, palm: Vec) => ({ curl: [curl, curl, curl, curl, curl] as [number, number, number, number, number], point: unit(point), palm: unit(palm) });

// (as the right arm does them)
const POSES = {
  // a hand up by the shoulder, palm out, fingers loose: hello, bye
  wave: { upper: unit([0.5, -0.4, 0.3]), fore: unit([0.12, 1, 0.12]), hand: hand(0.06, [0.05, 1, 0], [0, 0, 1]) },
  // the hand flat on the chest
  me: { upper: unit([0.2, -0.9, 0.45]), fore: unit([-0.9, 0.35, 0.35]), hand: hand(0.12, [-0.85, 0.3, 0.3], [0, 0, -1]) },
  // an open hand out towards whoever's listening, palm up
  // (out and a little aside, or it points straight at whoever's looking
  // and hardly shows)
  you: { upper: unit([0.45, -0.5, 0.75]), fore: unit([0.5, 0.35, 0.8]), hand: hand(0.1, [0.45, 0.3, 0.85], [0, 1, 0.1]) },
  // both hands out to the sides, palms facing: this big
  big: { upper: unit([0.8, -0.45, 0.4]), fore: unit([0.55, 0.45, 0.7]), hand: hand(0.1, [0.4, 0.5, 0.75], [-1, 0, 0]) },
  // a pinch in front, close together: this small
  small: { upper: unit([0.15, -0.8, 0.55]), fore: unit([-0.3, 0.75, 0.6]), hand: { curl: [0.55, 0.45, 1, 1, 1] as [number, number, number, number, number], point: unit([-0.2, 0.8, 0.5]), palm: unit([-1, 0, 0]) } },
  // both palms up and out from the elbows: who knows
  shrug: { upper: unit([0.3, -0.85, 0.4]), fore: unit([0.6, 0.2, 0.8]), hand: hand(0.12, [0.5, 0.15, 0.85], [0.15, 1, 0]) },
  // both palms out and down, pressing the air: wait, hold on, calm down
  wait: { upper: unit([0.3, -0.6, 0.75]), fore: unit([0.05, 0.55, 0.85]), hand: hand(0.05, [0.05, 1, 0.1], [0, 0, 1]) },
  // a finger up: one, first, actually
  one: { upper: unit([0.42, -0.5, 0.45]), fore: unit([0.05, 1, 0.2]), hand: { curl: [0.9, 0, 1, 1, 1] as [number, number, number, number, number], point: unit([0.02, 1, 0.05]), palm: [0, 0, 1] as Vec } },
  // pointing out, away: there, that one, over there
  there: { upper: unit([0.65, -0.35, 0.65]), fore: unit([0.65, 0.15, 0.75]), hand: { curl: [0.9, 0, 1, 1, 1] as [number, number, number, number, number], point: unit([0.65, 0.15, 0.75]), palm: [0, -1, 0] as Vec } },
  // a thumb up in front: yes, sure, great (as the emote, a little lower)
  thumb: { upper: unit([0.3, -0.75, 0.6]), fore: unit([-0.45, 0.5, 0.72]), hand: { curl: [0, 1, 1, 1, 1] as [number, number, number, number, number], point: unit([-0.53, 0.23, 0.82]), palm: unit([-0.76, 0.24, -0.61]) } },
} satisfies Record<string, Arm>;

const G: Record<string, Gesture> = {
  hi: { hands: "one", arm: POSES.wave, moves: "wave" },
  bye: { hands: "one", arm: POSES.wave, moves: "wave" },
  me: { hands: "one", arm: POSES.me },
  you: { hands: "one", arm: POSES.you },
  big: { hands: "both", arm: POSES.big },
  small: { hands: "one", arm: POSES.small },
  maybe: { hands: "both", arm: POSES.shrug, moves: "shrug", head: { tilt: 1 } },
  wait: { hands: "both", arm: POSES.wait },
  one: { hands: "one", arm: POSES.one },
  there: { hands: "one", arm: POSES.there },
  great: { hands: "one", arm: POSES.thumb },
  yes: { hands: "one", arm: null, head: { nod: 2 } },
  no: { hands: "one", arm: null, head: { shake: 2 } },
  everyone: { hands: "both", arm: POSES.shrug },
};

// The words for each. Only words that are themselves the gesture, said on
// their own or near enough; their plain forms, lower case, without the
// punctuation round them.
const WORDS: Record<string, keyof typeof G> = {};
const words = (g: keyof typeof G, list: string): void => {
  for (const w of list.split(" ")) WORDS[w] = g;
};
words("hi", "hi hello hey hiya howdy heya g'day");
words("bye", "bye goodbye cya seeya ciao cheerio");
words("me", "me myself mine");
words("you", "you you're yours yourself");
words("big", "big huge enormous massive giant gigantic everything wide");
words("small", "tiny little small bit teeny smidge");
words("maybe", "maybe perhaps dunno whatever idk possibly");
words("wait", "wait hold hang calm stop slow");
words("one", "one first firstly actually");
words("there", "there that over");
words("great", "great awesome nice sure perfect cool brilliant");
words("yes", "yes yeah yep yup yeh uh-huh mhm absolutely exactly definitely right");
words("no", "no nope nah never");
words("everyone", "everyone everybody all y'all");

// The gesture a word goes with, if any. `alone` is whether it was said with
// weight (leaned on, or the phrase's only word): "that" and "over" and
// "one" are said in passing far more often than pointed with, so they only
// count then; the rest count whenever.
// (measured on a paragraph of ordinary talk: with "you" and "me" counting
// every time, one word in five was a gesture; people don't point at
// whoever they're talking to on every "you")
const ONLY_LEANED = new Set(["that", "over", "one", "all", "right", "wide", "everything", "hold", "stop", "slow", "bit", "little", "first", "actually", "mine", "sure", "nice", "cool", "you", "you're", "yours", "me", "myself", "there", "everyone", "everybody", "great", "big", "no", "yes", "yeah", "never"]);
export function gestureFor(word: string, leaned = false): Gesture | null {
  const w = word.toLowerCase().replace(/^[^a-z']+|[^a-z'-]+$/g, "");
  const g = WORDS[w];
  if (!g) return null;
  if (ONLY_LEANED.has(w) && !leaned) return null;
  return G[g];
}

// An arm for a gesture on a side, `amount` of the way there from resting (0
// to 1), `t` seconds in (for one that moves while it's held).
export function gestureArm(g: Gesture, side: Side, amount: number, t: number): Arm | null {
  if (!g.arm) return null;
  const right = g.moves === "wave" ? { ...g.arm, fore: unit([g.arm.fore[0] + Math.sin(t * Math.PI * 7) * 0.32, g.arm.fore[1], g.arm.fore[2]]) } : g.moves === "shrug" ? { ...g.arm, upper: unit([g.arm.upper[0], g.arm.upper[1] + Math.sin(Math.min(1, t * 3) * Math.PI / 2) * 0.12, g.arm.upper[2]]) } : g.arm;
  const to = side === "right" ? right : mirrored(right);
  const r = RESTING[side];
  const mix = (a: Vec, b: Vec): Vec => unit([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
  const rh = r.hand!;
  const th = to.hand!;
  return {
    upper: mix(r.upper, to.upper),
    fore: mix(r.fore, to.fore),
    hand: { curl: rh.curl.map((c, i) => c + (th.curl[i] - c) * amount) as typeof rh.curl, point: mix(rh.point, th.point), palm: mix(rh.palm, th.palm) },
  };
}

// The head with a gesture, `t` of the way through it (0 to 1), `amount` as
// far as it goes: a nod is down and up, a shake side to side, a tilt over
// and back.
export function gestureHead(g: Gesture, t: number, amount: number): { pitch: number; yaw: number; roll: number } {
  const h = g.head ?? {};
  const out = { pitch: 0, yaw: 0, roll: 0 };
  // (big enough to read across a room once the head's eased after it)
  if (h.nod) out.pitch = Math.max(0, Math.sin(t * Math.PI * h.nod * 2)) * 0.24 * amount;
  if (h.shake) out.yaw = Math.sin(t * Math.PI * h.shake * 2) * 0.34 * amount;
  if (h.tilt) out.roll = Math.sin(Math.min(1, t * 1.5) * Math.PI) * 0.16 * h.tilt * amount;
  return out;
}
