import { describe, expect, it } from "vitest";
import { measure, words as heard } from "../src/prosody.ts";
import { renderWords, type Word } from "../src/voice.ts";

// What the app hears in a voice, checked on made-up audio whose loudness,
// pitch and timing are known exactly. Real voices are messier; whether the
// result looks like how someone said it is judged by people trying it.
const RATE = 16_000;

// a voice-like tone (a fundamental and four overtones) whose pitch can glide,
// written into a clip at a given time
function tone(clip: Float32Array, from: number, to: number, hz: [number, number], amplitude: number): void {
  let phase = 0;
  const n = Math.round((to - from) * RATE);
  for (let i = 0; i < n; i++) {
    const f = hz[0] + ((hz[1] - hz[0]) * i) / n;
    phase += (2 * Math.PI * f) / RATE;
    let s = 0;
    for (let k = 1; k <= 5; k++) s += Math.sin(k * phase) / k;
    clip[Math.round(from * RATE) + i] = amplitude * s * 0.5;
  }
}

// four one-syllable words with pauses between them, each vowel about as long
// as a spoken one (0.2 s) except the drawn-out one
function clip(): Float32Array {
  const c = new Float32Array(RATE * 2.6);
  tone(c, 0.1, 0.3, [150, 150], 0.1); // "one": ordinary
  tone(c, 0.6, 0.8, [150, 150], 0.4); // "two": four times the amplitude, about 12 dB louder
  tone(c, 1.1, 1.35, [180, 300], 0.1); // "six": higher, and rising
  tone(c, 1.6, 2.4, [150, 150], 0.1); // "so": held for 0.8 s
  return c;
}

const words = [
  { w: "one", start: 0.1, end: 0.3 },
  { w: "two", start: 0.6, end: 0.8 },
  { w: "six", start: 1.1, end: 1.35 },
  { w: "so", start: 1.6, end: 2.4 },
];

describe("hearing how a word was said", () => {
  const [one, two, six, so] = measure(clip(), RATE, words);

  it("hears a louder word as louder, by about how much louder it was", () => {
    expect(two.loud - one.loud).toBeGreaterThan(9);
    expect(two.loud - one.loud).toBeLessThan(15);
  });

  it("hears a higher word as higher, and a rising one as rising", () => {
    expect(six.pitch! - one.pitch!).toBeGreaterThan(4);
    expect(six.rise).toBeGreaterThan(4);
    expect(Math.abs(one.rise)).toBeLessThan(1);
  });

  it("hears a drawn-out word as drawn out", () => {
    // "so" holds its sound for 0.8 s, three times as long as the others
    expect(so.stretch).toBeGreaterThan(1);
    expect(Math.abs(one.stretch)).toBeLessThan(0.5);
  });

  it("measures everything against the rest of the message, so a typical word sits near zero", () => {
    expect(Math.abs(one.loud)).toBeLessThan(1);
    expect(Math.abs(one.pitch!)).toBeLessThan(1);
  });

  it("doesn't count a pause as part of the word before it", () => {
    // Whisper often lets a word run on into the silence after it
    const [late] = measure(clip(), RATE, [{ w: "one", start: 0.1, end: 0.55 }, ...words.slice(1)]);
    expect(Math.abs(late.stretch - one.stretch)).toBeLessThan(0.2);
    expect(Math.abs(late.loud - one.loud)).toBeLessThan(1);
  });

  it("moves a word Whisper placed in the pause after it back onto its speech, so the pause shows", () => {
    // Whisper runs late before a pause, sometimes putting a word wholly in
    // the silence after it (it did this to "Americans" in a JFK recording)
    const c = new Float32Array(RATE * 2);
    tone(c, 0.1, 0.4, [150, 150], 0.1);
    tone(c, 1.2, 1.5, [150, 150], 0.1);
    const [ask, not] = measure(c, RATE, [
      { w: "ask", start: 0.45, end: 1.0 },
      { w: "not", start: 1.3, end: 1.9 },
    ]);
    expect(ask.start).toBeCloseTo(0.1, 1);
    expect(ask.end).toBeLessThanOrEqual(0.45);
    expect(not.start).toBeCloseTo(1.2, 1);
    expect(not.start - ask.end).toBeGreaterThan(0.7);
  });

  it("drops the labels Whisper puts on sounds that aren't words, even split over several", () => {
    const chunks = ["[BLANK_AUDIO]", " (upbeat", " music)", " *laughs*", " hello", " -", " ♪", " la", " ♪", " there."].map(
      (text, i) => ({ text, timestamp: [i, i + 1] as [number, number | null] }),
    );
    chunks.at(-1)!.timestamp[1] = null;
    expect(heard(chunks, 20)).toEqual([
      { w: "hello", start: 4, end: 5 },
      { w: "there.", start: 9, end: 20 },
    ]);
  });

  it("hears nothing in silence, so the words Whisper invents for it never get sent", () => {
    expect(measure(new Float32Array(RATE * 2), RATE, [{ w: "you", start: 0, end: 1 }])).toEqual([]);
  });

  it("hears a whisper, which has no pitch to find, as someone speaking", () => {
    // noise shaped into syllables: loudness rising and falling four times a
    // second, as a whispered sentence does, with nothing voiced
    const c = new Float32Array(RATE * 2);
    let seed = 5;
    for (let i = 0; i < c.length; i++) {
      const t = i / RATE;
      const syllable = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) ** 2;
      c[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * (0.002 + 0.05 * syllable);
    }
    const [x] = measure(c, RATE, [{ w: "secret", start: 0.1, end: 1.8 }]);
    expect(x.w).toBe("secret");
    expect(x.pitch).toBeNull();
  });

  it("hears nothing in a room's background noise either, hum and all", () => {
    // what a quiet room gives a laptop: hiss, plus mains hum and its harmonics
    const c = new Float32Array(RATE * 2);
    let seed = 1;
    const noise = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.004;
    for (let i = 0; i < c.length; i++) {
      const t = i / RATE;
      c[i] = noise() + 0.002 * Math.sin(2 * Math.PI * 50 * t) + 0.001 * Math.sin(2 * Math.PI * 100 * t) + 0.0005 * Math.sin(2 * Math.PI * 150 * t);
    }
    expect(measure(c, RATE, [{ w: "you", start: 0, end: 1 }])).toEqual([]);
  });
});

describe("drawing a drawn-out word", () => {
  const word = (x: Partial<Word> & { w: string }): Word => ({ start: 0, end: 0.5, loud: 0, pitch: 0, rise: 0, stretch: 0, held: null, contour: [], ...x });
  // what a reader sees, tags stripped
  const seen = (x: Word): string => renderWords([x]).replace(/<[^>]+>/g, "");

  it("repeats a letter, the way people type it, only when the word was drawn out", () => {
    expect(seen(word({ w: "so", stretch: 1, held: 0.6 }))).toBe("sooo");
    expect(seen(word({ w: "so", stretch: 0.3, held: 0.6 }))).toBe("so");
    expect(seen(word({ w: "I", stretch: 1.5 }))).toBe("I");
  });

  it("repeats the vowel nearest where the voice held, not just the last one", () => {
    expect(seen(word({ w: "amazing", stretch: 1, held: 0.4 }))).toMatch(/^amaa+zing$/);
    expect(seen(word({ w: "amazing", stretch: 1, held: 0.8 }))).toMatch(/^amazii+ng$/);
  });

  it("never repeats a silent e, and repeats the last letter of a word with no vowel", () => {
    expect(seen(word({ w: "please", stretch: 1, held: null }))).toMatch(/^pleaa+se$/);
    expect(seen(word({ w: "please", stretch: 1, held: 1 }))).toMatch(/^pleaa+se$/);
    expect(seen(word({ w: "hmm", stretch: 1 }))).toMatch(/^hmmm+$/);
    expect(seen(word({ w: "good.", stretch: 1 }))).toMatch(/^gooo+d\.$/);
  });

  it("repeats more the longer it was held, up to a point", () => {
    expect(seen(word({ w: "no", stretch: 2 })).length).toBeGreaterThan(seen(word({ w: "no", stretch: 1 })).length);
    expect(seen(word({ w: "unbelievable", stretch: 2, held: 0.5 })).length).toBeLessThanOrEqual("unbelievable".length + 5);
  });

  it("hides the repeats from screen readers, which read the word as it was said", () => {
    expect(renderWords([word({ w: "so", stretch: 1 })])).toMatch(/^<span[^>]*>so<span class="held" aria-hidden="true">o+<\/span><\/span>$/);
  });

  // a three-syllable word, syllables split by the short silence of a
  // consonant, with the given lengths in seconds
  const heldIn = (lengths: [number, number, number], hz: [number, number] = [180, 180]): number | null => {
    const c = new Float32Array(RATE * 2);
    let at = 0.05;
    for (const length of lengths) {
      tone(c, at, at + length, hz, 0.1);
      at += length + 0.06;
    }
    return measure(c, RATE, [{ w: "amazing", start: 0, end: at }])[0].held;
  };

  it("hears which syllable of a word the voice held", () => {
    expect(heldIn([0.12, 0.6, 0.12])).toBeCloseTo(0.5, 1); // a-maaa-zing
    expect(heldIn([0.6, 0.12, 0.12])).toBeLessThan(0.35); // aaa-ma-zing
    expect(heldIn([0.12, 0.12, 0.6])).toBeGreaterThan(0.65); // a-ma-ziiing
  });

  it("still hears a sound as held when its pitch slides while it's held", () => {
    expect(heldIn([0.12, 0.12, 0.6], [150, 260])).toBeGreaterThan(0.65);
  });

  it("can tell a word is drawn out even when it's the whole message", () => {
    const c = new Float32Array(RATE * 1.5);
    tone(c, 0.1, 1.3, [150, 150], 0.1); // "no" held for over a second
    const words = measure(c, RATE, [{ w: "no", start: 0.1, end: 1.3 }]);
    expect(renderWords(words).replace(/<[^>]+>/g, "")).toMatch(/^nooo+$/);
  });
});
