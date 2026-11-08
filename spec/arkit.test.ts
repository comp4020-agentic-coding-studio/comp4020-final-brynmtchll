import { describe, expect, it } from "vitest";
import { ARKIT, cleanFace52, easeFace, face52, faceFilter, mirrored, oneEuro, STILL52 } from "../src/arkit.ts";
import { aliveAt, blinkAt, faceShown, sayingFace } from "../src/alive.ts";
import { mouthAt, mouthFace, visemesOf } from "../src/visemes.ts";

// A face as all 52 of MediaPipe's scores, as the avatars show it.
describe("a face as 52 scores", () => {
  it("has every ARKit name once, in a fixed order", () => {
    expect(ARKIT).toHaveLength(52);
    expect(new Set(ARKIT).size).toBe(52);
    expect(ARKIT).toContain("jawOpen");
    expect(ARKIT).toContain("tongueOut");
    expect(ARKIT).toContain("cheekSquintLeft");
  });

  it("takes a face's rest off and keeps every score between 0 and 1", () => {
    const f = face52({ jawOpen: 0.8, mouthSmileLeft: 0.3, browDownLeft: 0.25, nonsense: 9 }, { browDownLeft: 0.25, mouthSmileLeft: 0.1 });
    expect(f[ARKIT.indexOf("jawOpen")]).toBe(0.8);
    expect(f[ARKIT.indexOf("browDownLeft")]).toBe(0);
    expect(f[ARKIT.indexOf("mouthSmileLeft")]).toBeCloseTo(0.22, 2);
    expect(f.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(face52({ jawOpen: 7, eyeBlinkLeft: -2 })[ARKIT.indexOf("jawOpen")]).toBe(1);
  });

  it("takes only exactly 52 numbers from someone else's page, pulled into range", () => {
    expect(cleanFace52(STILL52)).toEqual(STILL52);
    expect(cleanFace52(STILL52.map(() => 3))?.every((v) => v === 1)).toBe(true);
    expect(cleanFace52(STILL52.slice(1))).toBeNull();
    expect(cleanFace52([...STILL52.slice(1), "0"])).toBeNull();
    expect(cleanFace52([...STILL52.slice(1), Number.NaN])).toBeNull();
    expect(cleanFace52({ length: 52 })).toBeNull();
    expect(cleanFace52("x".repeat(52))).toBeNull();
  });

  it("mirrors left for right and leaves the middle alone", () => {
    const f = [...STILL52];
    f[ARKIT.indexOf("eyeBlinkLeft")] = 1;
    f[ARKIT.indexOf("jawOpen")] = 0.5;
    const m = mirrored(f);
    expect(m[ARKIT.indexOf("eyeBlinkRight")]).toBe(1);
    expect(m[ARKIT.indexOf("eyeBlinkLeft")]).toBe(0);
    expect(m[ARKIT.indexOf("jawOpen")]).toBe(0.5);
    expect(mirrored(m)).toEqual(f);
  });
});

describe("following a face smoothly", () => {
  it("holds a barely moving score steady but follows a fast one closely", () => {
    const f = oneEuro();
    // jitter round 0.3 at 30 frames a second: smoothed to well under the jitter
    let out = 0;
    for (let i = 0; i < 60; i++) out = f(0.3 + (i % 2 ? 0.04 : -0.04), i / 30);
    expect(Math.abs(out - 0.3)).toBeLessThan(0.03);
    // a jump (a jaw dropping): most of the way there within three frames
    const g = oneEuro();
    for (let i = 0; i < 10; i++) g(0, i / 30);
    let v = 0;
    for (let i = 10; i < 13; i++) v = g(1, i / 30);
    expect(v).toBeGreaterThan(0.7);
  });

  it("lets a blink through fast, and keeps every score in range", () => {
    const filt = faceFilter();
    const b = ARKIT.indexOf("eyeBlinkLeft");
    for (let i = 0; i < 10; i++) filt([...STILL52], i / 30);
    const shut = [...STILL52];
    shut[b] = 1;
    let got = STILL52;
    for (let i = 10; i < 12; i++) got = filt(shut, i / 30);
    expect(got[b]).toBeGreaterThan(0.8);
    expect(got.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it("eases a face arriving a few times a second the same way at any frame rate", () => {
    const to = STILL52.map(() => 1);
    let at60 = [...STILL52];
    for (let i = 0; i < 6; i++) at60 = easeFace(at60, to, 1 / 60);
    let at30 = [...STILL52];
    for (let i = 0; i < 3; i++) at30 = easeFace(at30, to, 1 / 30);
    expect(at60[0]).toBeCloseTo(at30[0], 5);
    expect(at60[0]).toBeGreaterThan(0.85);
  });
});

describe("a mouth from a voice, without a camera", () => {
  it("reads a word's letters as the mouth shapes that say it", () => {
    expect(visemesOf("moon")).toEqual(["mbp", "oo", "l"]);
    expect(visemesOf("see")).toEqual(["s", "ee"]);
    expect(visemesOf("think")).toEqual(["th", "ee", "l", "k"]);
    expect(visemesOf("make")).toEqual(["mbp", "ah", "k"]);
    expect(visemesOf("Bob!")).toEqual(["mbp", "oh", "mbp"]);
    expect(visemesOf("...")).toEqual([]);
  });

  it("moves from one shape to the next through a word, and opens wider the louder it's said", () => {
    const shapes = visemesOf("moon");
    expect(mouthAt(shapes, 0.01, 0.6).mouthPressLeft).toBeGreaterThan(0.5);
    expect(mouthAt(shapes, 0.3, 0.6).mouthPucker).toBeGreaterThan(0.8);
    const soft = mouthFace(mouthAt(visemesOf("ah"), 0.1, 0.4), 0.1);
    const loud = mouthFace(mouthAt(visemesOf("ah"), 0.1, 0.4), 1);
    const jaw = ARKIT.indexOf("jawOpen");
    expect(loud[jaw]).toBeGreaterThan(soft[jaw]);
    // lips pressed for an m stay pressed however quiet
    expect(mouthFace(mouthAt(["mbp"], 0.1, 0.3), 0)[ARKIT.indexOf("mouthPressLeft")]).toBeGreaterThan(0.5);
    // no word to go on: the jaw follows the level alone
    expect(mouthFace(null, 0.5)[jaw]).toBeCloseTo(0.3, 2);
    expect(mouthFace(null, 0.5).every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe("an avatar alive on its own", () => {
  it("blinks every few seconds, quickly, and the same on every page", () => {
    const blinks: number[] = [];
    let was = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      const b = blinkAt(42, t);
      if (b > 0.9 && was <= 0.9) blinks.push(t);
      was = b;
    }
    expect(blinks.length).toBeGreaterThan(8);
    expect(blinks.length).toBeLessThan(35);
    expect(blinkAt(42, 17.3)).toBe(blinkAt(42, 17.3));
    // someone else blinks on their own rhythm
    let same = 0;
    for (let t = 0; t < 30; t += 0.05) if ((blinkAt(1, t) > 0.5) === (blinkAt(2, t) > 0.5) && blinkAt(1, t) > 0.5) same++;
    expect(same).toBeLessThan(10);
  });

  it("breathes, drifts a little and glances about, never far", () => {
    for (let t = 0; t < 30; t += 0.37) {
      const a = aliveAt(7, t);
      expect(Math.abs(a.head.yaw)).toBeLessThan(0.07);
      expect(Math.abs(a.eyes.x)).toBeLessThanOrEqual(0.25);
      expect(a.breath).toBeGreaterThanOrEqual(0);
      expect(a.breath).toBeLessThanOrEqual(1);
      expect(a.face.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
  });

  it("shows how a word was said on the face, and lets a camera's face win", () => {
    const high = sayingFace(2, 6);
    const low = sayingFace(-8, -4);
    expect(high.browInnerUp!).toBeGreaterThan(0.6);
    expect(low.eyeSquintLeft!).toBeGreaterThan(0.3);
    expect(sayingFace(10, 0).eyeWideLeft!).toBeGreaterThan(0.5);
    const cam = STILL52.map((_, i) => (i === 0 ? 0.9 : 0));
    expect(faceShown(cam, aliveAt(1, 3), STILL52, high)).toEqual(cam);
    const own = faceShown(null, aliveAt(1, 3), STILL52, high);
    expect(own[ARKIT.indexOf("browInnerUp")]).toBeGreaterThan(0.6);
  });
});
