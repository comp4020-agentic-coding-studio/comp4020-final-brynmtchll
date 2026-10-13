import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hear as hearWhole, measure, words, type Heard } from "../src/prosody.ts";
import { compare, describe as describeVoice, renderWords, type Word } from "../src/voice.ts";

// The hearing, checked on a real voice rather than made-up tones: eleven
// seconds of John F. Kennedy's inaugural address (20 January 1961; a work of
// the US government, so public domain), the clip transformers.js uses in its
// own docs. Whisper (whisper-base.en_timestamped, as the app runs it) was run
// on it once and its output saved beside it, so this checks everything that
// happens after Whisper without running Whisper.
const RATE = 16_000;

// a 16-bit mono WAV as samples
function wav(path: string): Float32Array {
  const b = readFileSync(path);
  let at = 12;
  while (b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const data = b.subarray(at + 8, at + 8 + b.readUInt32LE(at + 4));
  const pcm = new Float32Array(data.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = data.readInt16LE(i * 2) / 32768;
  return pcm;
}

// a vowel held longer, by splicing in copies of its steady middle with short
// crossfades: what someone drawing it out sounds like, in their own voice
function lengthen(pcm: Float32Array, from: number, to: number, times: number): Float32Array {
  const fade = Math.round(0.02 * RATE);
  const piece = pcm.slice(Math.round(from * RATE), Math.round(to * RATE));
  const parts: number[][] = [Array.from(pcm.slice(0, Math.round(to * RATE)))];
  const join = (next: number[]): void => {
    const prev = parts.at(-1)!;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      prev[prev.length - fade + i] = prev[prev.length - fade + i] * (1 - t) + next[i] * t;
    }
    parts.push(next.slice(fade));
  };
  for (let k = 0; k < times; k++) join(Array.from(piece));
  join(Array.from(pcm.slice(Math.round(to * RATE))));
  return Float32Array.from(parts.flat());
}

const fixture = (name: string): string => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const hear = (pcm: Float32Array, whisper: string): Word[] =>
  measure(pcm, RATE, words(JSON.parse(readFileSync(fixture(whisper), "utf8")) as Heard[], pcm.length / RATE));
// what a reader sees
const seen = (ws: Word[]): string => renderWords(ws).replace(/<[^>]+>/g, "");

describe("hearing a real voice (JFK, 1961)", () => {
  const jfk = wav(fixture("jfk-1961.wav"));
  const plain = hear(jfk, "jfk-1961.whisper.json");

  it("draws nothing out that he didn't", () => {
    expect(seen(plain)).toBe(
      "And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.",
    );
  });

  it("puts each word on his voice, not in the silence after it where Whisper put some", () => {
    // Whisper had "Americans," at 2.02-3.12 s and "not" at 4.14-5.46 s, both
    // running deep into the pauses after them
    expect(plain.find((w) => w.w === "Americans,")!.end).toBeLessThanOrEqual(2.1);
    expect(plain.find((w) => w.w === "not")!.end).toBeLessThanOrEqual(4.4);
  });

  it("shows his pause after \"ask not\"", () => {
    const not = plain.findIndex((w) => w.w === "not");
    expect(plain[not + 1].start - plain[not].end).toBeGreaterThan(0.8);
  });

  it("hears his \"so\" held half a second longer as drawn out, and nothing else", () => {
    const drawn = lengthen(jfk, 0.76, 0.9, 4);
    const text = seen(hear(drawn, "jfk-1961-sooo.whisper.json"));
    expect(text).toMatch(/^And so{4,}, my fellow Americans,/);
    expect(text.replace(/^And so+,/, "")).not.toMatch(/(\p{L})\1\1/u);
  });
});

// The voice as a whole, checked on actors saying the same sentence in
// different emotions (CREMA-D; see fixtures/crema-d/README.md). Across 178 of
// its takes (11 actors, six emotions, two sentences) angry was louder than
// the same actor's neutral for every actor and higher for 95%, sad quieter for
// 80%, and pace disagreed with itself however it was measured, which is why
// the app never says "faster" or "slower".
describe("hearing the same sentence said in different moods (CREMA-D)", () => {
  const take = (actor: string, mood: string) => {
    const name = `crema-d/${actor}_TIE_${mood}_XX`;
    const pcm = wav(fixture(`${name}.wav`));
    return hear2(pcm, `${name}.whisper.json`);
  };
  const hear2 = (pcm: Float32Array, whisper: string) =>
    hearWhole(pcm, RATE, words(JSON.parse(readFileSync(fixture(whisper), "utf8")) as Heard[], pcm.length / RATE));

  for (const actor of ["1038", "1020"]) {
    const [neutral, angry, sad] = ["NEU", "ANG", "SAD"].map((m) => take(actor, m));
    const usual = [neutral.voice!, neutral.voice!, neutral.voice!];

    // Whisper's words are Whisper's (it heard 1038's sad "happened" as
    // "happens"); what's the app's is that none of them goes missing
    it(`keeps every word of actor ${actor}'s takes, sad included`, () => {
      for (const t of [neutral, angry, sad]) {
        expect(t.words.map((w) => w.w.toLowerCase().replace(/\W/g, "")).slice(0, 4)).toEqual(["that", "is", "exactly", "what"]);
        expect(t.words).toHaveLength(5);
      }
    });

    it(`says actor ${actor}'s angry take was higher and louder than usual`, () => {
      expect(describeVoice(compare(angry.voice!, usual), "them")).toMatch(/^Higher.* and louder than them usually sounds$/);
    });

    it(`never calls actor ${actor}'s sad take louder, and doesn't draw anything out`, () => {
      expect(describeVoice(compare(sad.voice!, usual), "them") ?? "").not.toMatch(/louder/);
      for (const t of [neutral, angry, sad]) expect(seen(t.words)).not.toMatch(/(\p{L})\1\1/u);
    });
  }
});
