import { describe, expect, it } from "vitest";
import { measure } from "../src/prosody.ts";
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

function clip(): Float32Array {
  const c = new Float32Array(RATE * 3.2);
  tone(c, 0.0, 0.5, [150, 150], 0.1); // "one": ordinary
  tone(c, 0.7, 1.2, [150, 150], 0.4); // "two": four times the amplitude, about 12 dB louder
  tone(c, 1.4, 1.9, [180, 300], 0.1); // "six": higher, and rising
  tone(c, 2.0, 3.0, [150, 150], 0.1); // "so": two letters over a whole second
  return c;
}

const words = [
  { w: "one", start: 0.0, end: 0.5 },
  { w: "two", start: 0.7, end: 1.2 },
  { w: "six", start: 1.4, end: 1.9 },
  { w: "so", start: 2.0, end: 3.0 },
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
    expect(so.stretch).toBeGreaterThan(1);
    expect(Math.abs(one.stretch)).toBeLessThan(0.5);
  });

  it("measures everything against the rest of the message, so a typical word sits near zero", () => {
    expect(Math.abs(one.loud)).toBeLessThan(1);
    expect(Math.abs(one.pitch!)).toBeLessThan(1);
  });

  it("doesn't count a pause as part of the word before it", () => {
    // Whisper often lets a word run on into the silence after it
    const [late] = measure(clip(), RATE, [{ w: "one", start: 0.0, end: 0.7 }, ...words.slice(1)]);
    expect(Math.abs(late.stretch - one.stretch)).toBeLessThan(0.2);
    expect(Math.abs(late.loud - one.loud)).toBeLessThan(1);
  });

  it("hears nothing in silence, so the words Whisper invents for it never get sent", () => {
    expect(measure(new Float32Array(RATE * 2), RATE, [{ w: "you", start: 0, end: 1 }])).toEqual([]);
  });
});

describe("drawing a drawn-out word", () => {
  const word = (x: Partial<Word> & { w: string }): Word => ({ start: 0, end: 0.5, loud: 0, pitch: 0, rise: 0, stretch: 0, held: null, ...x });
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
