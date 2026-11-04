import { describe, expect, it } from "vitest";
import { cleanLook, DEFAULT_LOOK, randomLook, SLIDERS, VOICES } from "../src/packs.ts";
import { drawOut, echoOf, naturalPlan, playedSpans, remember, runsOf, type Spoken } from "../src/speech.ts";

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
    // heard a little wrong, still an echo
    expect(echoOf("did you see the match last nite", now + 2000)).toBe(true);
    // the listener's own words get through, even on the same subject, even
    // a reply that says much of it back
    expect(echoOf("no I missed it what happened", now + 2000)).toBe(false);
    remember("do you want to get lunch", now);
    expect(echoOf("yes I want to get lunch", now + 2000)).toBe(false);
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

describe("speaking a phrase in a natural voice", () => {
  it("says a phrase whole, and moves only the words that stood out: louder, higher, drawn out", () => {
    const plan = naturalPlan([plain("oh this is"), { text: "SO", loud: 9, pitch: 4, stretch: 0 }, { text: "good", loud: 0, pitch: 0, stretch: 1.6 }, { text: "psst", loud: -9, pitch: 0, stretch: 0 }], look)!;
    expect(plan.words).toEqual(["oh this is", "SO", "good", "psst"]);
    const [ordinary, loud, drawn, quiet] = plan.shapes;
    expect(ordinary).toEqual({ gain: 1, rate: 1, stretch: 1 });
    expect(loud.gain).toBeGreaterThan(1.5);
    expect(loud.rate).toBeGreaterThan(1);
    // drawn out: longer, at its own pitch (lower too, it slurred)
    expect(drawn.stretch).toBeGreaterThan(1.5);
    expect(drawn.rate).toBe(1);
    expect(quiet.gain).toBeLessThan(0.6);
    expect(naturalPlan([plain(""), plain(" ")], look)).toBeNull();
  });

  it("raises or lowers a voice without speeding it up or slowing it down, within what the model says well", () => {
    for (const voicePitch of [-1, 0, 1]) {
      const plan = naturalPlan([plain("hello")], { voice: "warm", tune: { voicePitch } })!;
      // heard at the voice's own pace whatever its pitch
      expect(plan.speed * plan.play).toBeCloseTo(1, 1);
      expect(Math.sign(plan.play - 1)).toBe(Math.sign(voicePitch));
    }
    for (const voice of VOICES) {
      for (const tune of [{ voicePitch: 1, voiceSpeed: 1 }, { voicePitch: -1, voiceSpeed: -1 }]) {
        const plan = naturalPlan([plain("x"), { text: "x", loud: 40, pitch: 24, stretch: 4, effect: "impact" }, { text: "x", loud: -40, pitch: -24, stretch: 0, effect: "spooky" }], { voice: voice.id, tune })!;
        expect(plan.speed).toBeGreaterThanOrEqual(0.6);
        expect(plan.speed).toBeLessThanOrEqual(1.7);
        expect(plan.play).toBeGreaterThanOrEqual(0.6);
        expect(plan.play).toBeLessThanOrEqual(1.6);
        for (const sh of plan.shapes) {
          expect(sh.rate).toBeGreaterThanOrEqual(0.8);
          expect(sh.rate).toBeLessThanOrEqual(1.2);
          expect(sh.stretch).toBeGreaterThanOrEqual(1);
          expect(sh.stretch).toBeLessThanOrEqual(2);
          expect(plan.volume * sh.gain).toBeGreaterThan(0);
        }
      }
    }
  });

  it("whispers a hushed voice or a whispered word quietly", () => {
    expect(naturalPlan([plain("a secret")], { voice: "whisper", tune: {} })!.volume).toBeLessThan(naturalPlan([plain("a secret")], look)!.volume);
    const [w] = naturalPlan([{ text: "secret", loud: 0, pitch: 0, stretch: 0, effect: "whisper" }], look)!.shapes;
    expect(w.gain).toBeLessThanOrEqual(0.45);
  });

  it("works out where each word is played, once the ones that stood out are played faster or slower", () => {
    const spans: [number, number][] = [[0, 0.4], [0.45, 0.8], [0.8, 1.2]];
    const played = playedSpans(spans, [{ gain: 1, rate: 1, stretch: 1 }, { gain: 1, rate: 0.5, stretch: 1 }, { gain: 1, rate: 1, stretch: 1 }], 1);
    // the second word takes twice as long, and the third starts later for it
    expect(played[1][1] - played[1][0]).toBeCloseTo(0.7, 5);
    expect(played[2][0]).toBeCloseTo(1.15, 5);
    // a voice played faster all through takes less time
    expect(playedSpans(spans, [{ gain: 1, rate: 1, stretch: 1 }, { gain: 1, rate: 1, stretch: 1 }, { gain: 1, rate: 1, stretch: 1 }], 1.25).at(-1)![1]).toBeCloseTo(0.96, 5);
  });

  it("draws a drawn-out word out where it is, and moves the words after it along", () => {
    const rate = 1000;
    const audio = new Float32Array(1000).map((_, i) => Math.sin(i / 3));
    const spans: [number, number][] = [[0, 0.3], [0.3, 0.6], [0.6, 1]];
    const out = drawOut({ audio, spans }, [{ gain: 1, rate: 1, stretch: 1 }, { gain: 1, rate: 1, stretch: 1.5 }, { gain: 1, rate: 1, stretch: 1 }], rate);
    expect(out.spans[0]).toEqual([0, 0.3]);
    expect(out.spans[1][1] - out.spans[1][0]).toBeCloseTo(0.45, 1);
    expect(out.spans[2][0]).toBeCloseTo(out.spans[1][1], 5);
    expect(out.audio.length / rate).toBeCloseTo(out.spans[2][1], 2);
    // nothing drawn out: the very same sound
    const same = { audio, spans };
    expect(drawOut(same, spans.map(() => ({ gain: 1, rate: 1, stretch: 1 })), rate)).toBe(same);
  });

  it("has a natural voice for every voice but silent, each one Kokoro has", () => {
    for (const v of VOICES) {
      if (v.id === "silent") continue;
      expect(v.kokoro, v.id).toMatch(/^[ab][fm]_[a-z]+$/);
      expect(v.about.length).toBeGreaterThan(2);
    }
    expect(new Set(VOICES.map((v) => v.label)).size).toBe(VOICES.length);
  });
});
