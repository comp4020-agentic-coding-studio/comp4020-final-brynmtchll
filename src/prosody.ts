// How each word was said, measured in the browser from the same clip Whisper
// heard. Whisper says when each word starts and ends; this looks at the audio
// inside those times. Every number comes out relative to the rest of the same
// message (voice.ts says why), so nothing here needs to know whose voice it is.
import type { Word } from "./voice.ts";

export type Timed = { w: string; start: number; end: number };
// active: loud enough to be part of someone speaking rather than a pause
export type Frame = { db: number; hz: number | null; active: boolean };

const HOP = 0.01; // seconds between frames
const WINDOW = 0.04; // seconds of audio each frame looks at
const MIN_HZ = 70; // the range of speaking voices, low men to high children
const MAX_HZ = 450;
const QUIET = 35; // dB below the loudest frame where speech gives way to a pause
const PERIODIC = 0.2; // how periodic a frame must be to count as voiced (YIN's threshold)
const MIN_VOICED = 10; // frames: under a tenth of a second voiced means nobody spoke

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const percentile = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const round = (n: number): number => Math.round(n * 10) / 10;
const letters = (w: string): number => Math.max(1, (w.match(/[\p{L}\p{N}]/gu) ?? []).length);

// The fundamental frequency of one frame, by YIN (de Cheveigné & Kawahara,
// 2002): find the smallest lag at which the signal most nearly repeats
// itself. Null when nothing repeats, which is breath, noise or a consonant.
function pitchAt(pcm: Float32Array, at: number, win: number, rate: number): number | null {
  const minLag = Math.floor(rate / MAX_HZ);
  const maxLag = Math.ceil(rate / MIN_HZ);
  const n = win - maxLag;
  const d = new Float32Array(maxLag + 2).fill(1);
  let running = 0;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const diff = pcm[at + i] - pcm[at + i + lag];
      sum += diff * diff;
    }
    running += sum;
    d[lag] = running > 0 ? (sum * lag) / running : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag] >= PERIODIC) continue;
    while (lag < maxLag && d[lag + 1] < d[lag]) lag++;
    const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
    const bend = a - 2 * b + c;
    return rate / (lag + (bend > 0 ? (a - c) / (2 * bend) : 0));
  }
  return null;
}

// loudness (dB) and pitch (Hz, or null) every hundredth of a second
export function frames(pcm: Float32Array, rate: number): Frame[] {
  const hop = Math.round(rate * HOP);
  const win = Math.round(rate * WINDOW);
  const out: Frame[] = [];
  for (let at = 0; at + win < pcm.length; at += hop) {
    let energy = 0;
    for (let i = at; i < at + win; i++) energy += pcm[i] * pcm[i];
    out.push({ db: 10 * Math.log10(energy / win + 1e-12), hz: null, active: false });
  }
  const loudest = out.reduce((m, f) => Math.max(m, f.db), -Infinity);
  out.forEach((f, k) => {
    f.active = f.db > loudest - QUIET;
    if (f.active) f.hz = pitchAt(pcm, k * hop, win, rate);
  });
  return out;
}

// The words with how each was said, or none at all if the clip has almost
// nothing voiced in it: Whisper invents words for silence ("you", "Thank
// you."), and those shouldn't reach the room.
export function measure(pcm: Float32Array, rate: number, timed: Timed[]): Word[] {
  const fs = frames(pcm, rate);
  if (fs.filter((f) => f.hz !== null).length < MIN_VOICED) return [];

  const raw = timed.map((t) => {
    const from = Math.min(fs.length - 1, Math.floor(t.start / HOP));
    // Whisper tends to let the last word before a pause run on into it, so
    // only the frames where someone was actually speaking count
    const span = fs.slice(from, Math.max(from + 1, Math.ceil(t.end / HOP))).filter((f) => f.active);
    // semitones on an absolute scale, so they can be compared and subtracted
    const semis = span.flatMap((f) => (f.hz === null ? [] : [12 * Math.log2(f.hz)]));
    const third = Math.max(1, Math.floor(semis.length / 3));
    return {
      ...t,
      // how loud the word got, not its average: a word's quiet edges would
      // otherwise drag every word towards the same number
      loud: span.length ? percentile(span.map((f) => f.db), 0.8) : null,
      pitch: semis.length >= 3 ? median(semis) : null,
      rise: semis.length >= 6 ? median(semis.slice(-third)) - median(semis.slice(0, third)) : 0,
      perLetter: (Math.max(1, span.length) * HOP) / letters(t.w),
    };
  });

  const louds = raw.flatMap((r) => (r.loud === null ? [] : [r.loud]));
  const pitches = raw.flatMap((r) => (r.pitch === null ? [] : [r.pitch]));
  const typicalLoud = louds.length ? median(louds) : 0;
  const typicalPitch = pitches.length ? median(pitches) : 0;
  const typicalPace = median(raw.map((r) => r.perLetter));

  return raw.map((r) => ({
    w: r.w,
    start: round(r.start),
    end: round(r.end),
    loud: r.loud === null ? 0 : round(r.loud - typicalLoud),
    pitch: r.pitch === null ? null : round(r.pitch - typicalPitch),
    rise: round(r.rise),
    stretch: round(Math.log2(r.perLetter / typicalPace)),
  }));
}
