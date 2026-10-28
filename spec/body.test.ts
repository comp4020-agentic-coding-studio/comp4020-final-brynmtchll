import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bodyFrom, cleanBody, GESTURE_ARMS, GESTURES, handFrom, handPoints, RESTING, type Curl, type Seen, type Side } from "../src/body.ts";
import { EMOTES } from "../src/packs.ts";

// Arms and hands read off a camera, checked on what MediaPipe read from real
// photos (spec/fixtures/hands: the numbers only, with whose photo each was).
// Whether an avatar's arm then looks like the person's is judged by eye.
const fixture = (name: string): Seen & { hands: { gesture: string }[] } => {
  const f = JSON.parse(readFileSync(new URL(`./fixtures/hands/${name}.json`, import.meta.url), "utf8"));
  return { pose: f.pose, hands: f.hands };
};
const out = (c: number): boolean => c < 0.35;
const curled = (c: number): boolean => c > 0.65;

describe("reading arms and hands off a camera", () => {
  it("reads a thumbs up as a thumb out and four fingers curled, on the arm whose hand it is", () => {
    const seen = fixture("thumbs-up");
    expect(seen.hands[0].gesture).toBe("Thumb_Up");
    const body = bodyFrom(seen);
    // his left hand, his forearm across his chest: on the left of the screen
    // (as in a mirror), the forearm pointing across towards the other side
    const hand = body.left?.hand;
    expect(hand).toBeTruthy();
    const [thumb, ...fingers] = hand!.curl;
    expect(out(thumb)).toBe(true);
    expect(fingers.every(curled)).toBe(true);
    expect(body.left!.fore[0]).toBeGreaterThan(0.5);
    // the thumb's hand points up and out from him
    expect(hand!.point[1]).toBeGreaterThan(0);
    // his right arm hangs, its hand out of sight
    expect(body.right?.hand).toBeNull();
    expect(body.right!.upper[1]).toBeLessThan(-0.7);
  });

  it("reads an \"I love you\" as the thumb, first and little fingers out and the middle two curled", () => {
    const seen = fixture("i-love-you");
    expect(seen.hands[0].gesture).toBe("ILoveYou");
    const hand = bodyFrom(seen).right?.hand;
    expect(hand).toBeTruthy();
    const [thumb, index, middle, ring, little] = hand!.curl;
    expect([thumb, index, little].every(out)).toBe(true);
    expect([middle, ring].every(curled)).toBe(true);
  });

  it("leaves out an arm it can't see, and hangs a hand seen without a body beside the face", () => {
    const seen = fixture("thumbs-up");
    const noBody = bodyFrom({ pose: null, hands: seen.hands });
    // MediaPipe's "Left" is the hand on the left of the picture as it comes
    // (un-mirrored), which is the person's left
    expect(noBody.left?.hand).toBeTruthy();
    expect(noBody.right).toBeNull();
    expect(noBody.left!.fore[1]).toBeGreaterThan(0.5);
    expect(bodyFrom({ pose: null, hands: [] })).toEqual({ left: null, right: null, tilt: 0, turn: 0 });
  });

  it("draws back a hand that reads as the same hand, either side, any way it faces", () => {
    const hands: Curl[] = [
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1],
      [0, 0, 1, 1, 0],
      [1, 0, 0, 1, 1],
    ];
    for (const side of ["left", "right"] as Side[]) {
      for (const curl of hands) {
        for (const [point, palm] of [
          [[0, 1, 0], [0, 0, 1]],
          [[1, 0, 0], [0, 0, -1]],
          [[0, -0.6, 0.8], [1, 0, 0]],
        ] as const) {
          // as MediaPipe would give it: un-mirrored, y down, z away
          const marks = handPoints(side, { curl, point: [...point], palm: [...palm] }).map(([x, y, z]) => ({ x: -x, y: -y, z: -z }));
          const back = handFrom(side, marks);
          back.curl.forEach((c, i) => expect(Math.abs(c - curl[i])).toBeLessThan(0.15));
          back.point.forEach((v, i) => expect(Math.abs(v - point[i])).toBeLessThan(0.05));
          back.palm.forEach((v, i) => expect(Math.abs(v - palm[i])).toBeLessThan(0.05));
        }
      }
    }
  });
});

describe("what's sent for someone's arms", () => {
  it("keeps only the numbers, each a direction or within its range, and refuses what isn't a body", () => {
    const sent = cleanBody({
      left: { upper: [0, -2, 0], fore: [3, 0, 4], hand: { curl: [-1, 0.5, 2, 0, 1], point: [0, 1, 0], palm: [0, 0, 1], picture: "data:..." } },
      right: { upper: "up", fore: [0, 1, 0] },
      tilt: 9,
      turn: -0.2,
      picture: "data:image/png;base64,AAAA",
    });
    expect(sent).toEqual({
      left: { upper: [0, -1, 0], fore: [0.6, 0, 0.8], hand: { curl: [0, 0.5, 1, 0, 1], point: [0, 1, 0], palm: [0, 0, 1] } },
      right: null,
      tilt: 0.4,
      turn: -0.2,
    });
    expect(cleanBody("a picture")).toBeNull();
    expect(cleanBody([1, 2, 3])).toBeNull();
    // a hand that isn't one goes, and its arm stays
    expect(cleanBody({ left: { upper: [0, -1, 0], fore: [0, -1, 0], hand: { curl: [1, 2] } } })?.left?.hand).toBeNull();
    // a direction of nothing isn't a direction, nor one too long to measure
    expect(cleanBody({ left: { upper: [0, 0, 0], fore: [0, -1, 0] } })?.left).toBeNull();
    expect(cleanBody({ left: { upper: [1.7e308, 1.7e308, 1.7e308], fore: [0, -1, 0] } })?.left).toBeNull();
  });
});

describe("what arms do in an emote", () => {
  it("gives every emote's arm a pose, and every gesture that does an emote is one MediaPipe names", () => {
    for (const em of EMOTES) {
      if ("arm" in em) expect(GESTURE_ARMS[em.arm], em.id).toBeTruthy();
      if ("gesture" in em) expect(GESTURES as readonly string[]).toContain(em.gesture);
    }
    const gestures = EMOTES.flatMap((em) => ("gesture" in em ? [em.gesture] : []));
    expect(new Set(gestures).size).toBe(gestures.length);
  });

  it("draws each emote's hand as the gesture it's named for", () => {
    const [thumb, ...fingers] = GESTURE_ARMS.thumbs.hand!.curl;
    expect(out(thumb) && fingers.every(curled)).toBe(true);
    // pointing the right way: up, and down
    expect(GESTURE_ARMS.thumbs.hand!.point[1]).toBeGreaterThan(0);
    const peace = GESTURE_ARMS.peace.hand!.curl;
    expect([peace[1], peace[2]].every(out) && [peace[3], peace[4]].every(curled)).toBe(true);
    const love = GESTURE_ARMS.love.hand!.curl;
    expect([love[0], love[1], love[4]].every(out) && [love[2], love[3]].every(curled)).toBe(true);
    expect(GESTURE_ARMS.wave.hand!.curl.every(out)).toBe(true);
    // resting arms hang, mirror images of each other
    expect(RESTING.left.upper[1]).toBeLessThan(-0.9);
    expect(RESTING.left.upper[0]).toBe(-RESTING.right.upper[0]);
  });
});
