import { describe, expect, it } from "vitest";
import { cleanLook, DEFAULT_LOOK, randomLook, SLIDERS, VOICES } from "../src/packs.ts";
import { echoOf, remember, runsOf, type Spoken } from "../src/speech.ts";

// Speaking what people say, checked as what's handed to the browser to say:
// which words go together, and at what pitch, speed and loudness. How it
// then sounds depends on the device's voices, and is judged by ear.
const plain = (text: string): Spoken => ({ text, loud: 0, pitch: 0, stretch: 0 });
const look = { voice: "warm", tune: {} } as const;

describe("speaking a phrase the way it was said", () => {
  it("says ordinary words together, as the voice is", () => {
    const runs = runsOf("so I was thinking we could go".split(" ").map(plain), look);
    // at most six together, so a long phrase still keeps up with its words
    expect(runs.map((r) => r.text)).toEqual(["so I was thinking we could", "go"]);
    expect(runs[0]).toMatchObject({ pitch: 1, rate: 1, volume: 0.8 });
  });

  it("gives a word that stood out its own run: louder, higher, slower, as it was said", () => {
    const [before, loud, after] = runsOf([plain("this is"), { text: "SO", loud: 9, pitch: 5, stretch: 0 }, plain("good")], look);
    expect([before.text, loud.text, after.text]).toEqual(["this is", "SO", "good"]);
    expect(loud.volume).toBeGreaterThan(before.volume);
    expect(loud.pitch).toBeGreaterThan(before.pitch);
    // but only half as much higher as it was said (a whole five semitones,
    // spoken, sounds silly)
    expect(loud.pitch).toBeCloseTo(2 ** (2.5 / 12), 2);
    const [drawn] = runsOf([{ text: "good", loud: 0, pitch: 0, stretch: 1.6 }], look);
    expect(drawn.rate).toBeLessThan(0.7);
    const [quiet] = runsOf([{ text: "psst", loud: -9, pitch: 0, stretch: 0 }], look);
    expect(quiet.volume).toBeLessThan(0.5);
  });

  it("speaks a word's effect too: a whisper quiet, spooky low and slow", () => {
    const [whisper] = runsOf([{ text: "secret", loud: 0, pitch: 0, stretch: 0, effect: "whisper" }], look);
    expect(whisper.volume).toBeLessThanOrEqual(0.35);
    const [spooky] = runsOf([{ text: "boo", loud: 0, pitch: 0, stretch: 0, effect: "spooky" }], look);
    expect(spooky.pitch).toBeLessThan(1);
    expect(spooky.rate).toBeLessThan(1);
  });

  it("speaks in the voice chosen, moved by its pitch and speed sliders, and always within what a browser takes", () => {
    const deep = runsOf([plain("hello")], { voice: "deep", tune: {} })[0];
    const tiny = runsOf([plain("hello")], { voice: "tiny", tune: {} })[0];
    expect(deep.pitch).toBeLessThan(1);
    expect(tiny.pitch).toBeGreaterThan(1.5);
    const higher = runsOf([plain("hello")], { voice: "warm", tune: { voicePitch: 1, voiceSpeed: 1 } })[0];
    expect(higher.pitch).toBeCloseTo(2 ** 0.5, 2);
    expect(higher.rate).toBeGreaterThan(1.3);
    for (const voice of VOICES) {
      for (const tune of [{ voicePitch: 1, voiceSpeed: 1 }, { voicePitch: -1, voiceSpeed: -1 }]) {
        for (const w of [plain("x"), { text: "x", loud: 40, pitch: 24, stretch: 4, effect: "impact" }, { text: "x", loud: -40, pitch: -24, stretch: 0, effect: "spooky" }]) {
          const [run] = runsOf([w], { voice: voice.id, tune });
          expect(run.pitch).toBeGreaterThanOrEqual(0.1);
          expect(run.pitch).toBeLessThanOrEqual(2);
          expect(run.rate).toBeGreaterThanOrEqual(0.3);
          expect(run.rate).toBeLessThanOrEqual(3);
          expect(run.volume).toBeGreaterThan(0);
          expect(run.volume).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("says nothing for a phrase with no words in it", () => {
    expect(runsOf([plain(""), plain("  ")], look)).toEqual([]);
  });
});

describe("not taking what was spoken for what the listener said", () => {
  it("drops a phrase that's mostly what was just spoken here, heard back through the microphone", () => {
    const now = Date.now();
    remember("did you see the match last night", now);
    expect(echoOf("you see the match last night", now + 2000)).toBe(true);
    // the listener's own words get through, even on the same subject
    expect(echoOf("no I missed it what happened", now + 2000)).toBe(false);
    // and a while after, nothing is taken for an echo
    expect(echoOf("did you see the match last night", now + 20_000)).toBe(false);
  });

  it("lets a word or two back through unless it's all of what was spoken", () => {
    const now = Date.now();
    remember("yeah but why", now);
    expect(echoOf("yeah", now + 1000)).toBe(false);
    remember("hello", now);
    expect(echoOf("Hello.", now + 1000)).toBe(true);
  });
});

describe("the voices someone can choose", () => {
  it("offers voices and a silent one, takes only those, and a surprise always speaks", () => {
    expect(VOICES.length).toBeGreaterThan(5);
    expect(VOICES.map((v) => v.id)).toContain("silent");
    expect(DEFAULT_LOOK.voice).not.toBe("silent");
    expect(cleanLook({ voice: "deep" })).toMatchObject({ voice: "deep" });
    expect(cleanLook({ voice: "Samantha" })).toBeNull();
    expect(cleanLook({ tune: { voicePitch: 3 } })!.tune).toEqual({ voicePitch: 1 });
    expect(SLIDERS.map((s) => s.id)).toEqual(expect.arrayContaining(["voicePitch", "voiceSpeed"]));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) expect(randomLook(rnd).voice).not.toBe("silent");
  });
});
