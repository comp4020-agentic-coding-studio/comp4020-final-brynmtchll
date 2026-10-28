// Someone's shoulders, arms and hands: what's read of them off their camera,
// the few numbers sent for them, and hands drawn back from those numbers.
// Shared by the server (which checks what's sent) and the browser (which
// reads arms and hands, and draws them).
//
// As with a face, only numbers leave the browser, and few of them: which way
// each half of each arm points, how curled each finger is, and which way the
// hand faces. Sides and directions are as drawn, in a mirror: x to the right
// of the screen, y up, z towards whoever's looking. So your avatar's hand goes
// up on the side you see yours go up in the camera preview.

export type Vec = [number, number, number];
// thumb, index, middle, ring, little finger: 0 straight, 1 curled right in
export type Curl = [number, number, number, number, number];
// a hand: its fingers, which way it points (wrist to knuckles) and which way
// its palm faces
export type Hand = { curl: Curl; point: Vec; palm: Vec };
// an arm: which way the upper arm points from the shoulder and the forearm
// from the elbow, and its hand if that's been seen
export type Arm = { upper: Vec; fore: Vec; hand: Hand | null };
// both arms (null for one that isn't in view), and the shoulders' tilt and
// turn in radians, the way a head's roll and yaw are (avatar.ts Pose)
export type Body = { left: Arm | null; right: Arm | null; tilt: number; turn: number };
export type Side = "left" | "right";

const TILT = 0.4;
const TURN = 0.6;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const within = (n: unknown, reach: number): number => (finite(n) ? Math.min(reach, Math.max(-reach, n)) : 0);
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec): Vec => {
  const n = length(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
// a with none of b in it (b a unit vector)
const reject = (a: Vec, b: Vec): Vec => sub(a, scale(b, dot(a, b)));
const angle = (a: Vec, b: Vec): number => Math.acos(Math.min(1, Math.max(-1, dot(unit(a), unit(b)))));

// ---- checking what's sent ----

function cleanVec(v: unknown): Vec | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(finite)) return null;
  const n = Math.hypot(v[0], v[1], v[2]);
  if (n < 1e-3 || !Number.isFinite(n)) return null;
  return [round2(v[0] / n), round2(v[1] / n), round2(v[2] / n)];
}

function cleanHand(input: unknown): Hand | null {
  if (typeof input !== "object" || input === null) return null;
  const h = input as Record<string, unknown>;
  const point = cleanVec(h.point);
  const palm = cleanVec(h.palm);
  if (!Array.isArray(h.curl) || h.curl.length !== 5 || !h.curl.every(finite) || !point || !palm) return null;
  return { curl: h.curl.map((c: number) => round2(Math.min(1, Math.max(0, c)))) as Curl, point, palm };
}

function cleanArm(input: unknown): Arm | null {
  if (typeof input !== "object" || input === null) return null;
  const a = input as Record<string, unknown>;
  const upper = cleanVec(a.upper);
  const fore = cleanVec(a.fore);
  if (!upper || !fore) return null;
  return { upper, fore, hand: cleanHand(a.hand) };
}

// a body as sent, as its numbers and nothing else (an arm that isn't one is
// taken as out of view), or null if it isn't one at all
export function cleanBody(input: unknown): Body | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const b = input as Record<string, unknown>;
  return { left: cleanArm(b.left), right: cleanArm(b.right), tilt: round2(within(b.tilt, TILT)), turn: round2(within(b.turn, TURN)) };
}

// ---- reading them off the camera ----

// A landmark as MediaPipe gives it, as the camera has it: x across the
// picture to the right, y down, z away from the camera (metres, for "world"
// landmarks; a fraction of the picture, for image ones), and how sure it is
// that the point is in view (pose landmarks only).
export type Mark = { x: number; y: number; z: number; v?: number };
// What the hands-and-body reader (hands.ts) saw in one frame: the body's 33
// landmarks if it found one, and for each hand it found its 21, which side
// it took it for and what it took it to be doing (a MediaPipe gesture name).
export type Seen = {
  pose: { image: Mark[]; world: Mark[] } | null;
  hands: { side: string; gesture: string; score: number; image: Mark[]; world: Mark[] }[];
};

// as drawn: mirrored, up, towards whoever's looking
const drawn = (m: Mark): Vec => [-m.x, -m.y, -m.z];

// MediaPipe's pose landmarks for each arm: shoulder, elbow, wrist. In a
// mirror, someone's own left shows on the left of the screen.
const ARMS: Record<Side, [number, number, number]> = { left: [11, 13, 15], right: [12, 14, 16] };
const SURE = 0.5; // how sure the reader must be that a wrist is in view

// The hand's joints, by MediaPipe's numbering from the wrist (0): the thumb
// 1 to 4, then each finger's knuckle to its tip.
const FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

// How curled a finger is, from how far it bends at its three joints in all:
// up to about 1.3 radians held out (a real finger held straight still bends
// a little), about 3.1 in a fist (measured on photos of a thumbs up and an
// "I love you", spec/fixtures/hands).
const STRAIGHT = 1;
const CURLED = 2; // more than STRAIGHT
// A thumb tucks across the palm rather than bending much, so how far in it
// is goes by how near its tip comes to the little finger's knuckle, for the
// size of the hand: about 1.2 to 1.4 of the hand's length held out, 0.5
// tucked into a fist.
const THUMB_OUT = 1.15;
const THUMB_IN = 0.6;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const bends = (pts: Vec[]): number => {
  let total = 0;
  for (let i = 0; i + 2 < pts.length; i++) total += angle(sub(pts[i + 1], pts[i]), sub(pts[i + 2], pts[i + 1]));
  return total;
};

// A hand as drawn, from its 21 world landmarks.
export function handFrom(side: Side, world: Mark[]): Hand {
  const p = world.map(drawn);
  const thumb = clamp01((THUMB_OUT - length(sub(p[4], p[17])) / (length(sub(p[9], p[0])) || 1)) / THUMB_IN);
  const fingers = FINGERS.slice(1).map((f) => clamp01((bends([p[0], ...f.map((i) => p[i])]) - STRAIGHT) / CURLED));
  const point = unit(sub(p[9], p[0]));
  // the palm's way out: across from the index knuckle to the little
  // finger's, which runs the other way on a right hand
  const across = cross(sub(p[5], p[0]), sub(p[17], p[0]));
  const palm = unit(reject(scale(across, side === "left" ? 1 : -1), point));
  return { curl: [thumb, ...fingers].map(round2) as Curl, point: point.map(round2) as Vec, palm: palm.map(round2) as Vec };
}

// Arms and hands from what the reader saw. Each hand goes with the arm whose
// wrist it's nearest in the picture (or, with no body found, the side the
// reader took it for); an arm is in view if its wrist is, or its hand is.
export function bodyFrom(seen: Seen): Body {
  const pose = seen.pose;
  const handOf: Partial<Record<Side, Seen["hands"][number]>> = {};
  for (const h of seen.hands) {
    let side: Side = h.side === "Right" ? "right" : "left";
    if (pose) {
      const far = (i: number): number => Math.hypot(pose.image[i].x - h.image[0].x, pose.image[i].y - h.image[0].y);
      side = far(15) <= far(16) ? "left" : "right";
    }
    if (!handOf[side] || h.score > handOf[side]!.score) handOf[side] = h;
  }
  const arm = (side: Side): Arm | null => {
    const h = handOf[side];
    const hand = h ? handFrom(side, h.world) : null;
    if (!pose) return hand ? { ...RAISED[side], hand } : null;
    const [s, e, w] = ARMS[side];
    if (!hand && (pose.image[w].v ?? 1) < SURE) return null;
    const at = (i: number): Vec => drawn(pose.world[i]);
    return { upper: unit(sub(at(e), at(s))).map(round2) as Vec, fore: unit(sub(at(w), at(e))).map(round2) as Vec, hand };
  };
  let tilt = 0;
  let turn = 0;
  if (pose) {
    // the line from the left shoulder to the right, as drawn
    const across = sub(drawn(pose.world[12]), drawn(pose.world[11]));
    tilt = Math.atan2(across[1], across[0]);
    turn = Math.atan2(-across[2], across[0]);
  }
  return { left: arm("left"), right: arm("right"), tilt: round2(within(tilt, TILT)), turn: round2(within(turn, TURN)) };
}

// ---- drawing a hand back ----

// A left hand held up, palm to whoever's looking, in metres from the wrist:
// fingers up (+y), palm facing out (+z), the thumb towards the middle (+x;
// on a right hand, -x). Each finger's knuckle, and the length of each of its
// three bones; the thumb from the base of the palm.
const KNUCKLES: Vec[] = [
  [0.025, 0.085, 0],
  [0, 0.09, 0],
  [-0.018, 0.085, 0],
  [-0.037, 0.075, 0],
];
const BONES = [
  [0.04, 0.025, 0.022],
  [0.045, 0.028, 0.023],
  [0.042, 0.026, 0.022],
  [0.032, 0.02, 0.019],
];
// how a finger's curl is shared among its joints, knuckle to tip
const SHARE = [0.4, 0.4, 0.2];
const THUMB_BASE: Vec = [0.02, 0.025, 0.005];
const THUMB_BONES = [0.035, 0.032, 0.027];
const THUMB_HELD_OUT: Vec = unit([0.7, 0.7, 0.25]);
const THUMB_TUCKED: Vec = unit([-0.8, 0.35, 0.35]);

// The hand's 21 joints, in metres from the wrist, turned the way it faces.
export function handPoints(side: Side, hand: Hand): Vec[] {
  const s = side === "left" ? 1 : -1;
  const flip = (v: Vec): Vec => [v[0] * s, v[1], v[2]];
  const out: Vec[] = [[0, 0, 0]];
  // thumb: from held out to tucked across the palm
  const t = clamp01(hand.curl[0]);
  const thumbWay = unit(add(scale(flip(THUMB_HELD_OUT), 1 - t), scale(flip(THUMB_TUCKED), t)));
  let at = flip(THUMB_BASE);
  out.push(at);
  for (const bone of THUMB_BONES) {
    at = add(at, scale(thumbWay, bone));
    out.push(at);
  }
  // fingers: each bending towards the palm, a share at each joint
  KNUCKLES.forEach((k, f) => {
    const knuckle = flip(k);
    const along = unit([knuckle[0], knuckle[1], 0]);
    // (drawn straighter than a real one reads: a finger held out, straight)
    const total = 0.1 + clamp01(hand.curl[f + 1]) * 3;
    let bent = 0;
    let p = knuckle;
    out.push(p);
    BONES[f].forEach((bone, j) => {
      bent += total * SHARE[j];
      p = add(p, add(scale(along, bone * Math.cos(bent)), [0, 0, bone * Math.sin(bent)]));
      out.push(p);
    });
  });
  // turned to point and face as the hand does
  const y = unit(hand.point);
  const z = unit(reject(hand.palm, y));
  const x = cross(y, z);
  return out.map((p) => add(add(scale(x, p[0]), scale(y, p[1])), scale(z, p[2])));
}

// ---- arms that aren't being read ----

// The mirror image of an arm, for the other side.
export const mirrored = (a: Arm): Arm => {
  const m = (v: Vec): Vec => [-v[0], v[1], v[2]];
  return { upper: m(a.upper), fore: m(a.fore), hand: a.hand && { ...a.hand, point: m(a.hand.point), palm: m(a.hand.palm) } };
};

// Hanging by someone's side, hand relaxed and palm in.
export const RESTING: Record<Side, Arm> = (() => {
  const right: Arm = { upper: unit([0.22, -1, 0.05]), fore: unit([0.05, -1, 0.3]), hand: { curl: [0.3, 0.35, 0.35, 0.35, 0.35], point: unit([0, -1, 0.2]), palm: [-1, 0, 0] } };
  return { right, left: mirrored(right) };
})();

// A hand up beside the face, for a hand seen with no body to hang it from.
const RAISED: Record<Side, Omit<Arm, "hand">> = (() => {
  const right = { upper: unit([0.5, -0.45, 0.3]), fore: unit([0.05, 1, 0.15]) };
  return { right, left: { upper: [-right.upper[0], right.upper[1], right.upper[2]] as Vec, fore: [-right.fore[0], right.fore[1], right.fore[2]] as Vec } };
})();

// What an emote's arm does (packs.ts EMOTES `arm`), as the right arm does it:
// a thumb up in front of the chest (its hand as read off the photo in
// spec/fixtures/hands), a hand up to wave, a peace sign, an "I love you",
// a finger pointing up, a fist pumped, a hand on the chin.
const UP = RAISED.right;
const PALM_OUT: Pick<Hand, "point" | "palm"> = { point: unit([0.05, 1, 0]), palm: [0, 0, 1] };
const THUMBS: Pick<Hand, "point" | "palm"> = { point: unit([-0.53, 0.23, 0.82]), palm: unit([-0.76, 0.24, -0.61]) };
export const GESTURE_ARMS: Record<string, Arm> = {
  thumbs: { upper: unit([0.3, -0.75, 0.6]), fore: unit([-0.45, 0.55, 0.7]), hand: { curl: [0, 1, 1, 1, 1], ...THUMBS } },
  boo: { upper: unit([0.3, -0.75, 0.6]), fore: unit([-0.45, 0.3, 0.8]), hand: { curl: [0, 1, 1, 1, 1], point: THUMBS.point, palm: scale(THUMBS.palm, -1) } },
  wave: { ...UP, hand: { curl: [0.1, 0.05, 0.05, 0.05, 0.1], ...PALM_OUT } },
  peace: { ...UP, hand: { curl: [0.9, 0, 0, 1, 1], ...PALM_OUT } },
  love: { ...UP, hand: { curl: [0, 0.05, 1, 1, 0.05], ...PALM_OUT } },
  point: { ...UP, hand: { curl: [0.9, 0, 1, 1, 1], ...PALM_OUT } },
  pump: { upper: unit([0.55, 0.7, 0.2]), fore: unit([0.05, 1, 0.1]), hand: { curl: [1, 1, 1, 1, 1], point: unit([0, 1, 0.1]), palm: unit([-1, 0, 0.3]) } },
  chin: { upper: unit([-0.05, -0.75, 0.66]), fore: unit([-0.6, 0.78, 0.2]), hand: { curl: [0.3, 0.2, 0.9, 0.95, 0.95], point: unit([-0.35, 0.9, 0.2]), palm: unit([-0.3, 0, -1]) } },
};

// A hand up to speak next (packs.ts has no emote for it: it stays up until
// it's their turn, or they put it down)
export const HAND_UP: Arm = { upper: unit([0.42, 0.6, 0.2]), fore: unit([0.04, 1, 0.05]), hand: { curl: [0.15, 0.05, 0.05, 0.05, 0.1], point: unit([0.02, 1, 0]), palm: [0, 0, 1] } };

// MediaPipe's names for what a hand is doing, which an emote can go off on
export const GESTURES = ["Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"] as const;
