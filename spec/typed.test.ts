import { describe, expect, it } from "vitest";
import { TONES, typedWords } from "../src/typed.ts";
import { clean, hueOf, LIMITS } from "../src/voice.ts";

// A message typed instead of said, given the shape of a spoken one: what the
// writing and the tone picked make of each word, and that it's always a
// message the server takes as it is.
const byWord = (text: string, tone?: Parameters<typeof typedWords>[1]) => Object.fromEntries(typedWords(text, tone).map((w) => [w.w, w]));

describe("a typed message, shaped the way it's written", () => {
  it("goes word by word, in order, with time to say each and a pause at a comma or a full stop", () => {
    const words = typedWords("well, I think so. Maybe");
    expect(words.map((w) => w.w)).toEqual(["well,", "I", "think", "so.", "Maybe"]);
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end);
    const gap = (i: number): number => words[i + 1].start - words[i].end;
    // a full stop past the 0.7 s that starts a new line; a comma less; between words little
    expect(gap(3)).toBeGreaterThan(0.7);
    expect(gap(0)).toBeGreaterThan(gap(1));
    expect(gap(0)).toBeLessThan(0.7);
  });

  it("makes *marked*, CAPS and ! words stand out, without the stars", () => {
    const w = byWord("I *really* mean it NOW stop!");
    expect(w.really.loud).toBeGreaterThan(0);
    expect(w.NOW.loud).toBeGreaterThan(0);
    expect(w["stop!"].loud).toBeGreaterThan(0);
    expect(w.mean.loud).toBe(0);
    expect(Object.keys(w)).not.toContain("*really*");
    // "I" alone isn't shouting
    expect(w.I.loud).toBe(0);
  });

  it("draws out a word typed drawn out, and says (an aside) quieter", () => {
    const w = byWord("sooo good (honestly) yes");
    expect(w.so.stretch).toBeGreaterThanOrEqual(1);
    expect(w.so.end - w.so.start).toBeGreaterThan(w.yes.end - w.yes.start);
    expect(w.honestly.loud).toBeLessThan(0);
    expect(w.yes.loud).toBe(0);
  });

  it("lifts a question's last word at the end, asked with ? or in the asking tone", () => {
    const asked = typedWords("are you coming?").at(-1)!;
    expect(asked.rise).toBeGreaterThan(0);
    expect(asked.pitch).toBeGreaterThan(0);
    const toned = typedWords("you are coming", "question").at(-1)!;
    expect(toned.rise).toBeGreaterThan(0);
  });

  it("gives each tone its own shape: excited up, sad and calm down and slower, whispered, sarcastic drawn out", () => {
    const say = "that is great";
    const last = (tone: Parameters<typeof typedWords>[1]) => typedWords(say, tone).at(-1)!;
    const span = (tone: Parameters<typeof typedWords>[1]) => typedWords(say, tone).at(-1)!.end;
    expect(last("excited").pitch).toBeGreaterThan(last("plain").pitch!);
    expect(last("sad").pitch).toBeLessThan(last("plain").pitch!);
    expect(last("calm").rise).toBeLessThan(0);
    expect(span("sad")).toBeGreaterThan(span("plain"));
    expect(span("calm")).toBeGreaterThan(span("plain"));
    expect(typedWords(say, "whisper").every((w) => w.effect === "whisper")).toBe(true);
    expect(typedWords(say, "sarcastic").some((w) => w.stretch >= 1)).toBe(true);
  });

  it("is always a message the server takes as it is, whatever's typed", () => {
    const texts = ["hi", "*", "!!! ???", "a ".repeat(400), "x".repeat(300), "🙂 ok", "(((nested)))", "*bold* (aside *marked*) END?!", "  \n\t spaced   out  "];
    for (const tone of TONES.map((t) => t.id)) {
      for (const text of texts) {
        const words = typedWords(text, tone);
        if (!words.length) continue;
        expect(words.length).toBeLessThanOrEqual(LIMITS.words);
        // the server would store exactly this: nothing pulled into range or refused
        expect(clean(words), `${tone}: ${text.slice(0, 20)}`).toEqual(words);
      }
    }
    // nothing to say, nothing to send
    expect(typedWords("  ")).toEqual([]);
    expect(typedWords("*** ... !!!")).toEqual([]);
  });
});

// (a seat's colour, however long the room has been going: once rounded, the
// 602nd seat's came to 360, past the end of the wheel)
it("gives every seat a hue from 0 to 359", () => {
  for (let seat = 0; seat < 5000; seat++) {
    const h = hueOf(seat);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(Number.isInteger(h)).toBe(true);
  }
});
