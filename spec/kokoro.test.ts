import { describe, expect, it } from "vitest";
import { fixSounds, normalise, pieces, shareOut, stretch, STYLE, styleAt, trim, wordSpans } from "../src/kokoro-text.ts";

// What the natural voice is given to say, worked out from the words: checked
// without the model, which only the browser runs.
describe("text for a natural voice", () => {
  it("reads numbers, money, times and titles the way people say them", () => {
    expect(normalise("Dr. Smith paid $5.50 at 3:05 in 1984")).toBe("Doctor Smith paid 5 dollars and 50 cents at 3 oh 5 in 19 84");
    expect(normalise("it’s 2.5 times “better”")).toBe(`it's 2 point 5 times "better"`);
    expect(normalise("pages 3-4")).toBe("pages 3 to 4");
    // emoji aren't read out; chat shorthand is said letter by letter
    expect(normalise("so good 😂👍🏽 really")).toBe("so good really");
    expect(normalise("lol omg that's it")).toBe("L O L O M G that's it");
    expect(normalise("lollipop")).toBe("lollipop");
  });

  it("keeps punctuation between the words to be turned into sounds, so the voice can read it", () => {
    expect(pieces("so, are you coming?")).toEqual([
      { say: true, text: "so" },
      { say: false, text: ", " },
      { say: true, text: "are you coming" },
      { say: false, text: "?" },
    ]);
    expect(pieces("hello")).toEqual([{ say: true, text: "hello" }]);
  });

  it("fixes up the sounds the way the voice learnt them", () => {
    expect(fixSounds("ɹed bʊk x", false)).toBe("ɹed bʊk k");
    expect(fixSounds("nˈaɪnti", true)).toBe("nˈaɪndi");
  });

  it("takes the voice's style for the phrase's length, never past the end of it", () => {
    expect(styleAt(2)).toBe(0);
    expect(styleAt(12)).toBe(10 * STYLE);
    expect(styleAt(10_000)).toBe(509 * STYLE);
  });

  it("trims the quiet either side of what's said, without a click", () => {
    const rate = 24_000;
    const pcm = new Float32Array(rate * 1.5);
    for (let i = rate * 0.4; i < rate * 0.9; i++) pcm[i] = 0.5 * Math.sin((i / rate) * 2 * Math.PI * 220);
    const out = trim(pcm, rate);
    expect(out.length / rate).toBeGreaterThan(0.5);
    expect(out.length / rate).toBeLessThan(0.6);
    // faded in and out
    expect(Math.abs(out[0])).toBeLessThan(0.01);
    expect(Math.abs(out.at(-1)!)).toBeLessThan(0.01);
    expect(trim(new Float32Array(rate), rate).length).toBe(0);
  });

  it("shares a phrase's sounds out among its words, a pause after punctuation counting for more", () => {
    const words = ["so", "I", "was", "thinking,", "lunch?"];
    const units = shareOut(words, "sˈoʊ ˈaɪ wˈʌz θˈɪŋkɪŋ, lˈʌntʃ?");
    expect(units).toHaveLength(5);
    expect(units[3]).toBeGreaterThan(units[2]);
    // a number read out as several words still gives one share for it
    expect(shareOut(["it's", "1984"], "ɪts nˈaɪntiːn ˈeɪɾi fˈɔːɹ")).toHaveLength(2);
    // sounds that don't line up with the words: shared by how long each word is
    expect(shareOut(["a", "b"], "x y z")).toHaveLength(2);
  });

  it("finds each word in what was said, at the quiet between words near where its share puts it", () => {
    const rate = 24_000;
    // three "words" of tone with gaps between, the second gap not where an even share would put it
    const pcm = new Float32Array(rate * 1.2);
    const tone = (from: number, to: number) => { for (let i = Math.round(from * rate); i < to * rate; i++) pcm[i] = 0.4 * Math.sin((i / rate) * 2 * Math.PI * 200); };
    tone(0, 0.35); tone(0.42, 0.75); tone(0.83, 1.2);
    const spans = wordSpans(pcm, rate, [1, 1, 1]);
    expect(spans[0][0]).toBe(0);
    expect(spans[1][0]).toBeGreaterThan(0.35);
    expect(spans[1][0]).toBeLessThan(0.42);
    expect(spans[2][0]).toBeGreaterThan(0.75);
    expect(spans[2][0]).toBeLessThan(0.83);
    expect(spans[2][1]).toBeCloseTo(1.2, 2);
  });
});

describe("drawing a word out", () => {
  it("makes it longer without making it lower", () => {
    const rate = 24_000;
    const hz = 180;
    const pcm = new Float32Array(rate * 0.3).map((_, i) => 0.5 * Math.sin((i / rate) * 2 * Math.PI * hz));
    const out = stretch(pcm, rate, 1.6);
    expect(out.length / pcm.length).toBeGreaterThan(1.5);
    expect(out.length / pcm.length).toBeLessThan(1.7);
    // still 180 Hz: count the rises through zero in the middle of it
    const mid = out.slice(Math.round(out.length * 0.2), Math.round(out.length * 0.8));
    let rises = 0;
    for (let i = 1; i < mid.length; i++) if (mid[i - 1] < 0 && mid[i] >= 0) rises++;
    expect(rises / (mid.length / rate)).toBeGreaterThan(hz * 0.95);
    expect(rises / (mid.length / rate)).toBeLessThan(hz * 1.05);
    // and as loud, not faded by the overlapping
    let e = 0;
    for (const x of mid) e += x * x;
    expect(Math.sqrt(e / mid.length)).toBeGreaterThan(0.3);
    // not stretched at all: as it was
    expect(stretch(pcm, rate, 1)).toBe(pcm);
    // and it doesn't fade in where it starts
    const flat = stretch(new Float32Array(rate * 0.2).fill(0.5), rate, 1.5);
    expect(flat[10]).toBeCloseTo(0.5, 2);
    expect(Math.min(...flat.slice(0, Math.round(rate * 0.25)))).toBeGreaterThan(0.45);
  });
});
