import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { phraser } from "../src/phrases.ts";

// Cutting speech into phrases as someone talks, checked by feeding recordings
// through in the batches a microphone gives (2048 samples at 48 kHz is about
// 683 at 16 kHz).
const RATE = 16_000;
const BATCH = 683;

function wav(name: string): Float32Array {
  const b = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  let at = 12;
  while (b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const data = b.subarray(at + 8, at + 8 + b.readUInt32LE(at + 4));
  const pcm = new Float32Array(data.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = data.readInt16LE(i * 2) / 32768;
  return pcm;
}

// every phrase, with when (in seconds of audio fed) it came out
function cut(pcm: Float32Array): { seconds: number; at: number }[] {
  const p = phraser();
  const out: { seconds: number; at: number }[] = [];
  for (let i = 0; i < pcm.length; i += BATCH) {
    for (const ph of p.push(pcm.slice(i, i + BATCH))) out.push({ seconds: ph.length / RATE, at: (i + BATCH) / RATE });
  }
  for (const ph of p.end()) out.push({ seconds: ph.length / RATE, at: pcm.length / RATE });
  return out;
}

// a voice-like tone, for speech whose pauses are known exactly
function tone(clip: Float32Array, from: number, to: number, amplitude = 0.1): void {
  for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) {
    const t = i / RATE;
    clip[i] = amplitude * (Math.sin(2 * Math.PI * 150 * t) + 0.5 * Math.sin(2 * Math.PI * 300 * t));
  }
}

describe("cutting speech into phrases as it's said", () => {
  it("cuts JFK at his pauses, so each phrase goes out as soon as he stops", () => {
    // he pauses after "Americans," (about 2.1 s) and after "for you," (about 7.5 s)
    const phrases = cut(wav("jfk-1961.wav"));
    expect(phrases).toHaveLength(3);
    expect(phrases[0].at).toBeLessThan(3);
    expect(phrases[1].at).toBeLessThan(8.5);
  });

  it("cuts someone who never pauses at most every six seconds, at a quiet moment rather than mid-word", () => {
    // 14 s of syllables a quarter-second long with 60 ms between them: no
    // pause long enough to end a phrase
    const c = new Float32Array(RATE * 14);
    for (let t = 0; t < 14; t += 0.31) tone(c, t, t + 0.25);
    const phrases = cut(c);
    for (const ph of phrases.slice(0, -1)) expect(ph.seconds).toBeLessThanOrEqual(6);
    expect(phrases.length).toBeGreaterThanOrEqual(3);
    // nothing is lost to the cuts
    expect(phrases.reduce((n, ph) => n + ph.seconds, 0)).toBeGreaterThan(13.5);
  });

  it("keeps none of the silence before someone starts or between their phrases", () => {
    const c = new Float32Array(RATE * 10);
    tone(c, 3, 4.5);
    tone(c, 7, 8);
    const phrases = cut(c);
    expect(phrases).toHaveLength(2);
    // each is its speech plus a short tail, not the seconds of quiet around it
    expect(phrases[0].seconds).toBeLessThan(2);
    expect(phrases[1].seconds).toBeLessThan(1.5);
  });

  it("hears the pauses of someone already talking when they turn their microphone on", () => {
    // no quiet before the first word to learn the room from
    const c = new Float32Array(RATE * 6);
    tone(c, 0, 1.5);
    tone(c, 2.2, 3.5);
    tone(c, 4.2, 5.5);
    expect(cut(c)).toHaveLength(3);
  });

  it("sends nothing for a microphone that heard only the room", () => {
    let seed = 1;
    const hiss = new Float32Array(RATE * 8).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.004);
    expect(cut(hiss)).toEqual([]);
  });
});
