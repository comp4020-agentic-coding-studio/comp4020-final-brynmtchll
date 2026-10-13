// How each word was said, measured in the browser from the same clip Whisper
// heard. Whisper says roughly when each word starts and ends; this moves each
// word onto the speech it belongs to and looks at the audio there. Every
// number comes out relative to the rest of the same message (voice.ts says
// why), so nothing here needs to know whose voice it is.
import { LIMITS, letterCount, type Voice, type Word } from "./voice.ts";

export type Timed = { w: string; start: number; end: number };
// a word as Whisper hands it over: leading space, and no end on the last one
export type Heard = { text: string; timestamp: [number, number | null] };
// active: loud enough to be part of someone speaking rather than a pause;
// clear: voiced outright rather than followed through noise, which is what a
// held sound has to be
export type Frame = { db: number; hz: number | null; active: boolean; clear: boolean };
// a run of speech between two pauses, in frames (to is exclusive)
export type Phrase = { from: number; to: number };

const HOP = 0.01; // seconds between frames
const WINDOW = 0.04; // seconds of audio each frame looks at
const MIN_HZ = 70; // the range of speaking voices, low men to high children
const MAX_HZ = 450;
// Speech is whatever stands clear of the room's background (the quietest
// tenth of the clip): NOISE dB above it, but never asking for more than
// NEAR_LOUDEST below the loudest frame (a clip with no pauses has no
// background to measure), and never counting anything QUIET below it.
const NOISE = 12;
const NEAR_LOUDEST = 20;
const QUIET = 35;
// A gap in speech shorter than this is a consonant, not a pause (frames), and
// a burst of sound shorter than SPECK is a click or a knock, not speech.
const BRIDGE = 15;
const SPECK = 5;
// Matching words to phrases: moving a word earlier than Whisper put it costs
// LATE times as much as moving it later, since Whisper runs late, and a phrase
// left with no words costs UNSPOKEN per second of it.
const LATE = 0.5;
const UNSPOKEN = 0.5;
// the least time a word can be given, per letter, at the end of a phrase
const LEAST_PACE = 0.04;

// How periodic a frame must be to count as voiced (YIN's threshold, lower is
// stricter). A frame under PERIODIC is voiced outright; one under LOOSELY
// only if its pitch carries on from a voiced neighbour's, within CARRIES
// semitones. A real voice makes a continuous pitch track and noise doesn't, so
// this follows a voice through the noise of a quiet, breathy or creaky take
// (sad speech, in CREMA-D's actors, mostly measured 0.3 to 0.5) without
// finding voices in noise.
const PERIODIC = 0.2;
const LOOSELY = 0.45;
const CARRIES = 1.5;
// Somebody spoke if a tenth of a second was voiced, or, for a voice the pitch
// tracker can barely follow, if MIN_SPOKEN of sound stood clear of the
// background in phrases. Silence and steady room noise do neither: noise has
// no pauses to make phrases of, and its level sets the background.
const MIN_VOICED = 10; // frames
const MIN_SPOKEN = 30; // frames
// A held sound is a stretch of voice that doesn't jump in pitch from one frame
// to the next or dip in loudness; a consonant between syllables does one or
// the other. It may slide in pitch while it's held ("whyyy?").
const JUMP = 1; // semitones from one frame to the next
const DIP = 8; // dB below the loudest point of the stretch so far
const MIN_HOLD = 5; // frames: anything shorter is a transition, not a sound
// How long a held sound usually lasts, as the yardstick for drawn out: the
// long end of ordinary (the 75th percentile of the message's held sounds),
// since half of them are fragments where the pitch broke up and a stressed
// vowel is ordinary too. In recorded speeches (JFK, MLK) these came to 0.2 to
// 0.25 s and nothing was held past 0.37 s. It's kept between TYPICAL_HOLD's
// bounds, so a fast talker's stressed vowel isn't drawn out and a message
// that's mostly drawn out ("sooo goood") isn't its own yardstick; with fewer
// than FEW_HOLDS ("nooo" alone has one) there's too little to measure, and
// USUAL_HOLD stands in.
const FEW_HOLDS = 3;
const USUAL_HOLD = 0.2;
const TYPICAL_HOLD = [0.15, 0.25] as const;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const percentile = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const round = (n: number): number => Math.round(n * 10) / 10;

// The fundamental frequency of one frame, by YIN (de Cheveigné & Kawahara,
// 2002): find the smallest lag at which the signal most nearly repeats
// itself, and how nearly (0 is exactly). Null when nothing repeats even
// loosely, which is breath, noise or a consonant.
function pitchAt(pcm: Float32Array, at: number, win: number, rate: number): { hz: number; dip: number } | null {
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
  const at_ = (lag: number): { hz: number; dip: number } => {
    while (lag < maxLag && d[lag + 1] < d[lag]) lag++;
    const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
    const bend = a - 2 * b + c;
    return { hz: rate / (lag + (bend > 0 ? (a - c) / (2 * bend) : 0)), dip: b };
  };
  // the first lag under each threshold: YIN takes the first, not the deepest,
  // so a voice isn't read an octave low
  for (const threshold of [PERIODIC, LOOSELY]) {
    for (let lag = minLag; lag <= maxLag; lag++) if (d[lag] < threshold) return at_(lag);
  }
  return null;
}

// loudness (dB), pitch (Hz, or null) and whether it's speech, every hundredth
// of a second
export function frames(pcm: Float32Array, rate: number): Frame[] {
  const hop = Math.round(rate * HOP);
  const win = Math.round(rate * WINDOW);
  const out: Frame[] = [];
  for (let at = 0; at + win < pcm.length; at += hop) {
    let energy = 0;
    for (let i = at; i < at + win; i++) energy += pcm[i] * pcm[i];
    out.push({ db: 10 * Math.log10(energy / win + 1e-12), hz: null, active: false, clear: false });
  }
  const loudest = out.reduce((m, f) => Math.max(m, f.db), -Infinity);
  const background = out.length ? percentile(out.map((f) => f.db), 0.1) : loudest;
  const speech = Math.max(loudest - QUIET, Math.min(background + NOISE, loudest - NEAR_LOUDEST));
  const found = out.map((f, k) => {
    f.active = f.db > speech;
    return f.active ? pitchAt(pcm, k * hop, win, rate) : null;
  });
  // voiced outright, then outward from there while the pitch carries on
  out.forEach((f, k) => {
    if (found[k] && found[k]!.dip < PERIODIC) {
      f.hz = found[k]!.hz;
      f.clear = true;
    }
  });
  const carries = (k: number, from: number): boolean =>
    out[from]?.hz != null && Math.abs(12 * Math.log2(found[k]!.hz / out[from].hz!)) < CARRIES;
  for (let grew = true; grew; ) {
    grew = false;
    out.forEach((f, k) => {
      if (f.hz !== null || !found[k] || !(carries(k, k - 1) || carries(k, k + 1))) return;
      f.hz = found[k]!.hz;
      grew = true;
    });
  }
  return out;
}

// the runs of speech between pauses
export function phrases(fs: Frame[]): Phrase[] {
  const out: Phrase[] = [];
  let k = 0;
  while (k < fs.length) {
    if (!fs[k].active) {
      k++;
      continue;
    }
    let to = k;
    for (;;) {
      while (to < fs.length && fs[to].active) to++;
      let next = to;
      while (next < fs.length && !fs[next].active) next++;
      if (next >= fs.length || next - to >= BRIDGE) break;
      to = next;
    }
    if (to - k >= SPECK) out.push({ from: k, to });
    k = to;
  }
  return out;
}

// Moves each word onto the speech it belongs to. Whisper's word times run
// late, most of all before a pause, sometimes putting a word wholly in the
// silence after it; the pauses in the audio are reliable. So the words are
// matched, in order, to the phrases between pauses: each to the phrase nearest
// where Whisper put it, leaning earlier, with any phrase left wordless counting
// against the match. Within a phrase, Whisper's timing of its words relative to
// each other is kept: they're moved back so the first starts when the phrase
// does, squeezed only if they'd run past its end, and the last word ends with
// the phrase (Whisper stretches a word before a pause into the silence).
export function align(timed: Timed[], ps: Phrase[]): Timed[] {
  if (timed.length === 0 || ps.length === 0) return timed;
  const n = timed.length;
  const m = ps.length;
  const sec = (p: Phrase): [number, number] => [p.from * HOP, p.to * HOP];
  const before = [0];
  for (const p of ps) before.push(before.at(-1)! + (p.to - p.from) * HOP);
  // the cost of leaving phrases a..b-1 without a word
  const skip = (a: number, b: number): number => (b > a ? UNSPOKEN * (before[b] - before[a]) : 0);
  const far = (i: number, j: number): number => {
    const mid = (timed[i].start + timed[i].end) / 2;
    const [from, to] = sec(ps[j]);
    return mid > to ? LATE * (mid - to) : mid < from ? from - mid : 0;
  };

  // cost[i][j]: the best match of words 0..i with word i in phrase j
  const cost = Array.from({ length: n }, () => new Array<number>(m).fill(Infinity));
  const came = Array.from({ length: n }, () => new Array<number>(m).fill(-1));
  for (let j = 0; j < m; j++) cost[0][j] = far(0, j) + skip(0, j);
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k <= j; k++) {
        const c = cost[i - 1][k] + skip(k + 1, j) + far(i, j);
        if (c < cost[i][j]) {
          cost[i][j] = c;
          came[i][j] = k;
        }
      }
    }
  }
  let j = 0;
  for (let k = 1; k < m; k++) if (cost[n - 1][k] + skip(k + 1, m) < cost[n - 1][j] + skip(j + 1, m)) j = k;
  const home = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    home[i] = j;
    j = came[i][j];
  }

  const out = timed.map((t) => ({ ...t }));
  for (let p = 0; p < m; p++) {
    const mine = home.flatMap((h, i) => (h === p ? [i] : []));
    if (mine.length === 0) continue;
    const [from, to] = sec(ps[p]);
    const late = timed[mine[0]].start - from;
    const starts = mine.map((i) => timed[i].start - late);
    // the last word needs room for at least its letters
    const room = to - from - letterCount(timed[mine.at(-1)!].w) * LEAST_PACE;
    const span = starts.at(-1)! - from;
    const squeeze = span > room && span > 0 ? Math.max(0, room) / span : 1;
    mine.forEach((i, k) => {
      out[i].start = from + (starts[k] - from) * squeeze;
      out[i].end = k + 1 < mine.length ? from + (starts[k + 1] - from) * squeeze : to;
    });
  }
  return out;
}

// The sounds the voice held, roughly one per syllable: the vowels, mostly,
// and the hummed consonants that run into them. Only clearly voiced frames
// count: a held vowel is clear, and a pitch followed through noise would make
// ordinary sounds look held for longer.
export function holds(fs: Frame[]): Phrase[] {
  const out: Phrase[] = [];
  let from = -1;
  let peak = -Infinity;
  const clearHz = (f: Frame | undefined): number | null => (f?.clear ? f.hz : null);
  for (let k = 0; k <= fs.length; k++) {
    const f = fs[k] as Frame | undefined;
    const hz = clearHz(f);
    const before = clearHz(fs[k - 1]);
    if (f && hz !== null && from >= 0 && before !== null && Math.abs(12 * Math.log2(hz / before)) < JUMP && f.db > peak - DIP) {
      peak = Math.max(peak, f.db);
      continue;
    }
    if (from >= 0 && k - from >= MIN_HOLD) out.push({ from, to: k });
    from = hz === null ? -1 : k;
    peak = f?.db ?? -Infinity;
  }
  return out;
}

// What Whisper heard, as timed words. It labels sounds it can't make words of
// ("[BLANK_AUDIO]", "(upbeat music)", "♪", "*laughs*") and those aren't
// anything anyone said, so they're dropped, along with anything left with no
// letters or digits. A label of several words arrives split ("(upbeat",
// "music)"), so everything from an opening bracket to its closing one goes.
const OPENS: Record<string, string> = { "[": "]", "(": ")", "*": "*", "♪": "♪" };
export function words(chunks: Heard[], seconds: number): Timed[] {
  const out: Timed[] = [];
  let closing: string | null = null;
  for (const c of chunks) {
    const w = c.text.trim();
    if (closing === null && w && w[0] in OPENS) {
      closing = OPENS[w[0]];
      // a label that opens and closes in one piece ("[BLANK_AUDIO]"); a lone
      // "♪" or "*" opens, since singing between notes isn't speech either
      if (w.length > 1 && w.endsWith(closing)) closing = null;
      continue;
    }
    if (closing !== null) {
      if (w.endsWith(closing)) closing = null;
      continue;
    }
    if (/[\p{L}\p{N}]/u.test(w)) out.push({ w, start: c.timestamp[0], end: c.timestamp[1] ?? seconds });
  }
  return out;
}

// The words with how each was said, or none at all if the clip has almost
// nothing voiced in it: Whisper invents words for silence ("you", "Thank
// you."), and those shouldn't reach the room.
export function measure(pcm: Float32Array, rate: number, timed: Timed[]): Word[] {
  return hear(pcm, rate, timed).words;
}

// A pitch track sampled at up to n evenly spaced points: the median of the
// voiced frames around each, or null where none were voiced. A point that
// leaps from both its neighbours and lands back is the pitch tracker jumping
// an octave for a frame or two, not the voice, so it's smoothed over.
const LEAP = 4; // semitones
function contourOf(span: Frame[], n: number): (number | null)[] {
  if (span.length === 0) return [];
  const points = Math.min(n, Math.max(2, Math.round(span.length / 4)));
  const out = Array.from({ length: points }, (_, k) => {
    const a = Math.floor((k * span.length) / points);
    const b = Math.max(a + 1, Math.floor(((k + 1) * span.length) / points));
    const semis = span.slice(a, b).flatMap((f) => (f.hz === null ? [] : [12 * Math.log2(f.hz)]));
    return semis.length ? median(semis) : null;
  });
  for (let k = 1; k + 1 < out.length; k++) {
    const [a, b, c] = [out[k - 1], out[k], out[k + 1]];
    if (a !== null && b !== null && c !== null && Math.abs(b - a) > LEAP && Math.abs(b - c) > LEAP && Math.abs(a - c) < LEAP) {
      out[k] = (a + c) / 2;
    }
  }
  return out;
}

// The words, and the message's voice as a whole (null with no words). The
// voice is on absolute scales so the server can compare it with the same
// person's other messages.
export function hear(pcm: Float32Array, rate: number, timed: Timed[]): { words: Word[]; voice: Voice | null } {
  const fs = frames(pcm, rate);
  const voicedFrames = fs.filter((f) => f.hz !== null).length;
  const spoken = phrases(fs).reduce((n, p) => n + p.to - p.from, 0);
  const anyone = voicedFrames >= MIN_VOICED || (spoken >= MIN_SPOKEN && spoken < fs.length * 0.95);
  if (!anyone || timed.length === 0) return { words: [], voice: null };

  const sounds = holds(fs);
  const lengths = sounds.map((h) => (h.to - h.from) * HOP);
  const measured = lengths.length >= FEW_HOLDS ? percentile(lengths, 0.75) : USUAL_HOLD;
  const typicalHold = Math.min(TYPICAL_HOLD[1], Math.max(TYPICAL_HOLD[0], measured));

  const raw = align(timed, phrases(fs)).map((t) => {
    const from = Math.min(fs.length - 1, Math.floor(t.start / HOP));
    // a phrase bridges the short silences of consonants, and only the frames
    // where someone was actually making a sound count
    const span = fs.slice(from, Math.max(from + 1, Math.round(t.end / HOP))).filter((f) => f.active);
    // the longest sound held in this word, and where in the word it sat
    const longest = sounds
      .filter((h) => ((h.from + h.to) / 2) * HOP >= t.start && ((h.from + h.to) / 2) * HOP < t.end)
      .reduce<Phrase | null>((best, h) => (!best || h.to - h.from > best.to - best.from ? h : best), null);
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
      hold: longest ? (longest.to - longest.from) * HOP : null,
      held: longest ? (((longest.from + longest.to) / 2) * HOP - t.start) / Math.max(HOP, t.end - t.start) : null,
      contour: contourOf(span, LIMITS.contour),
    };
  });

  const louds = raw.flatMap((r) => (r.loud === null ? [] : [r.loud]));
  const pitches = raw.flatMap((r) => (r.pitch === null ? [] : [r.pitch]));
  const typicalLoud = louds.length ? median(louds) : 0;
  const typicalPitch = pitches.length ? median(pitches) : 0;

  const words = raw.map((r) => ({
    w: r.w,
    start: round(r.start),
    end: round(r.end),
    loud: r.loud === null ? 0 : round(r.loud - typicalLoud),
    pitch: r.pitch === null ? null : round(r.pitch - typicalPitch),
    rise: round(r.rise),
    stretch: r.hold === null ? 0 : round(Math.log2(r.hold / typicalHold)),
    held: r.held === null ? null : round(r.held),
    contour: r.contour.map((p) => (p === null || pitches.length === 0 ? null : round(p - typicalPitch))),
  }));

  // the whole message's voice: pitch above A1 (55 Hz) so it's never negative,
  // and pace as letters per second from the first word's start to the last
  // one's end as Whisper heard them, less any pause over half a second (a
  // pause isn't speed). Whisper's own times, not the ones moved onto the
  // speech: three measures built on the speech frames all read loud as fast
  // on CREMA-D's actors (a quiet take counts its breath and hiss as speech and
  // a loud one doesn't), and held sounds per second read every emotion as
  // faster (an emotional voice holds steadier). Whisper's times don't move
  // with loudness; they're late before a pause, but a pause isn't counted.
  const voiced = fs.flatMap((f) => (f.active && f.hz !== null ? [12 * Math.log2(f.hz / 55)] : []));
  const placed = timed.filter((w) => w.end > w.start);
  let speaking = 0;
  placed.forEach((w, i) => {
    speaking += Math.min(w.end - w.start, 1);
    const gap = i + 1 < placed.length ? placed[i + 1].start - w.end : 0;
    if (gap > 0) speaking += Math.min(gap, 0.5);
  });
  const voice: Voice = {
    pitch: voiced.length ? round(median(voiced)) : null,
    range: voiced.length ? round(percentile(voiced, 0.9) - percentile(voiced, 0.1)) : 0,
    loud: louds.length ? round(typicalLoud) : -100,
    pace: speaking > 0 ? round(timed.reduce((n, t) => n + letterCount(t.w), 0) / speaking) : 0,
  };
  return { words, voice };
}
