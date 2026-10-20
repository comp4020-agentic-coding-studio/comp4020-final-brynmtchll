import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frames, hear as hearWhole, invented, measure, near, spoke, voiceLevel, words, type Heard } from "../src/prosody.ts";
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

// Someone speaking into the microphone against a voice elsewhere in the
// room: JFK at his own level and softly (15 dB down), and a CREMA-D actor
// at television (20 dB down) and next-room (30 dB down) levels, each over
// pink room noise at -60, -50 and -42 dB. The room's level is the quietest
// tenth of a stretch of it alone, as the phraser measures it.
describe("telling someone at the microphone from a voice elsewhere in the room", () => {
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const db = (x: Float32Array): number => 10 * Math.log10(x.reduce((n, v) => n + v * v, 0) / x.length + 1e-12);
  function pink(n: number, level: number): Float32Array {
    const out = new Float32Array(n);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0527;
      out[i] = b0 + b1 + b2 + w * 0.1848;
    }
    const g = 10 ** ((level - db(out)) / 20);
    return out.map((v) => v * g);
  }
  const over = (voice: Float32Array, dB: number, room: number): Float32Array => {
    const noise = pink(voice.length, room);
    return voice.map((v, i) => v * 10 ** (dB / 20) + noise[i]);
  };
  const levelOf = (room: number): number => {
    const fs = frames(pink(RATE * 3, room), RATE).map((f) => f.db).sort((a, b) => a - b);
    return fs[Math.floor(fs.length * 0.1)];
  };
  const jfk = wav(new URL("./fixtures/jfk-1961.wav", import.meta.url).pathname).slice(0, Math.round(2.2 * RATE));
  const actor = wav(new URL("./fixtures/crema-d/1020_TIE_ANG_XX.wav", import.meta.url).pathname);
  const passes = (pcm: Float32Array, room: number, usual: number | null): boolean => spoke(pcm, RATE) && near(voiceLevel(pcm, RATE), { db: levelOf(room), sure: true }, usual);

  for (const room of [-60, -50, -42]) {
    it(`lets through someone speaking, loud or soft, and not a television or the next room, in a room at ${room} dB`, () => {
      const usual = voiceLevel(over(jfk, 0, room), RATE);
      expect(passes(over(jfk, 0, room), room, usual)).toBe(true);
      expect(passes(over(jfk, -15, room), room, usual)).toBe(true);
      // a voice elsewhere, once this person's usual level is known
      expect(passes(over(actor, -20, room), room, usual)).toBe(false);
      expect(passes(over(actor, -30, room), room, usual)).toBe(false);
    });
  }

  it("lets through the first things someone says, before their usual level is known, unless they're lost in the room", () => {
    expect(passes(over(jfk, 0, -50), -50, null)).toBe(true);
    expect(passes(over(actor, -30, -50), -50, null)).toBe(false);
  });
});

describe("dropping what Whisper invents", () => {
  // what it wrote, live, for one person's room between things they said
  it("drops the end of a video and sounds written out however they're voiced, and repeats of what it invents", () => {
    for (const t of ["Thanks for watching!", "pfft", "[Music]", "(sighs)", "Please subscribe."]) expect(invented(t, true), t).toBe(true);
    for (const t of ["Mm-hmm.", "Heh, heh.", "Bye.", "Oh.", "Thank you. Thank you."]) expect(invented(t, false), t).toBe(true);
    // but not things people say
    for (const t of ["Bye!", "Thank you.", "Okay. Let's go."]) expect(invented(t, true), t).toBe(false);
    expect(invented("I'm going to go.", false)).toBe(false);
  });
});
