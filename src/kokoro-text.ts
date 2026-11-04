// What Kokoro (kokoro.ts) is given to say, worked out from the words: the
// text as it's to be read aloud, split around its punctuation (the model
// reads ? ! , . for how the words around them go, so it's kept between the
// words rather than turned into sounds), the sounds fixed up the way the
// model was trained on them, and which slice of a voice suits a phrase that
// long. Pure, so the checks can try it without the model.
//
// Adapted from kokoro-js 1.2.1 (Apache-2.0, hexgrad and Xenova), its text
// normalising and phoneme fix-ups, for English only.

// The text as it's read: curly quotes plain, titles spelt out, times,
// years, money and decimals said the way people say them.
export function normalise(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[^\S \n]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, timesAndYears)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, money)
    .replace(/\d*\.\d+/g, decimal)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}
function timesAndYears(s: string): string {
  if (s.includes(".")) return s;
  if (s.includes(":")) {
    const [h, m] = s.split(":").map(Number);
    return m === 0 ? `${h} o'clock` : m < 10 ? `${h} oh ${m}` : `${h} ${m}`;
  }
  const year = parseInt(s.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return s;
  const left = s.slice(0, 2);
  const right = parseInt(s.slice(2, 4), 10);
  const plural = s.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${plural}`;
    if (right < 10) return `${left} oh ${right}${plural}`;
  }
  return `${left} ${right}${plural}`;
}
function money(s: string): string {
  const unit = s[0] === "$" ? "dollar" : "pound";
  const n = s.slice(1);
  if (Number.isNaN(Number(n))) return `${n} ${unit}s`;
  if (!n.includes(".")) return `${n} ${unit}${n === "1" ? "" : "s"}`;
  const [whole, part] = n.split(".");
  const cents = parseInt(part.padEnd(2, "0"), 10);
  const small = s[0] === "$" ? (cents === 1 ? "cent" : "cents") : cents === 1 ? "penny" : "pence";
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${cents} ${small}`;
}
function decimal(s: string): string {
  const [whole, part] = s.split(".");
  return `${whole} point ${part.split("").join(" ")}`;
}

// The text in pieces: words to turn into sounds, and the punctuation
// between them kept as it is.
const PUNCT = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;
export function pieces(text: string): { say: boolean; text: string }[] {
  const out: { say: boolean; text: string }[] = [];
  let at = 0;
  for (const m of text.matchAll(PUNCT)) {
    if (m.index! > at) out.push({ say: true, text: text.slice(at, m.index) });
    out.push({ say: false, text: m[0] });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ say: true, text: text.slice(at) });
  return out;
}

// The sounds as eSpeak gives them, fixed up the way Kokoro learnt them.
export function fixSounds(sounds: string, american: boolean): string {
  let s = sounds
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (american) s = s.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return s.trim();
}

// Each voice is a table of styles, one for each length of phrase (in
// tokens): the one for this phrase's length.
export const STYLE = 256;
export const MOST_TOKENS = 509;
export const styleAt = (tokens: number): number => STYLE * Math.min(Math.max(tokens - 2, 0), MOST_TOKENS);

// The quiet Kokoro leaves either side of what it says (about 0.4 s each),
// trimmed to the speech, a few milliseconds of fade at each end so it
// doesn't click: where several runs make a phrase, they join up as one.
export function trim(audio: Float32Array, rate: number, keep = 0.03): Float32Array {
  const win = Math.round(rate * 0.01);
  const level: number[] = [];
  for (let i = 0; i + win <= audio.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += audio[j] * audio[j];
    level.push(10 * Math.log10(e / win + 1e-12));
  }
  if (!level.length) return audio;
  const top = Math.max(...level);
  // nothing in it worth hearing
  if (top < -60) return new Float32Array(0);
  const on = level.findIndex((d) => d > top - 35);
  const off = level.length - 1 - [...level].reverse().findIndex((d) => d > top - 35);
  if (on < 0) return new Float32Array(0);
  const from = Math.max(0, on * win - Math.round(rate * keep));
  const to = Math.min(audio.length, (off + 1) * win + Math.round(rate * keep));
  const out = audio.slice(from, to);
  const fade = Math.min(Math.round(rate * 0.008), out.length >> 1);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

// Where each word falls in what the model said. It gives the sound of a
// phrase whole, not when each word starts, but it says each sound in about
// the same time, and pauses at punctuation: so each word's share of the
// sounds (a pause counted as a few) says roughly where it is, and the quiet
// moment nearest each guessed boundary, if there's one close by, says
// exactly. Measured on a nine-word phrase, the guesses landed within a
// tenth of a second of the gaps between words.
const PAUSE_UNITS = { comma: 4, stop: 6 };
export function unitsOf(sounds: string): number {
  const said = sounds.replace(/[ˈˌ]/g, "").replace(/[;:,.!?¡¿—…"«»“”(){}[\]\s]/g, "").length;
  const pause = /[.!?…]/.test(sounds) ? PAUSE_UNITS.stop : /[,;:—]/.test(sounds) ? PAUSE_UNITS.comma : 0;
  return said + pause + 1;
}
// The sounds of a whole phrase, shared out among the words it was made from:
// one stretch of sounds for each, when eSpeak gave one for each word it was
// given (after reading numbers out, a word can be several), or by how long
// each word is when it didn't.
export function shareOut(words: string[], sounds: string): number[] {
  const tokens = sounds.split(/\s+/).filter(Boolean);
  const each = words.map((w) => normalise(w).split(/\s+/).filter(Boolean).length || 1);
  if (tokens.length === each.reduce((a, b) => a + b, 0)) {
    let at = 0;
    return each.map((k) => {
      const mine = tokens.slice(at, at + k);
      at += k;
      return mine.reduce((a, t) => a + unitsOf(t), 0);
    });
  }
  return words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + (/[.!?…]$/.test(w) ? PAUSE_UNITS.stop : /[,;:]$/.test(w) ? PAUSE_UNITS.comma : 0) + 1);
}
// Each word's start and end (seconds) in the trimmed sound, from its share,
// a boundary moved to a real gap (much quieter than the speech) if there's
// one just by it, but never so far that a word loses much of its share:
// short words have no gaps to go by, and the quietest moment near one was
// often inside the next word, leaving a word a few hundredths of a second.
const SNAP = 0.06; // s either side of a guess to look for a gap
const GAP_DB = 20; // a gap is this far under the loudest of the phrase
const KEEPS = 0.6; // of its share, at least, each word keeps
export function wordSpans(audio: Float32Array, rate: number, units: number[]): [number, number][] {
  const seconds = audio.length / rate;
  const win = Math.round(rate * 0.01);
  const level: number[] = [];
  for (let i = 0; i + win <= audio.length; i += win) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += audio[j] * audio[j];
    level.push(10 * Math.log10(e / win + 1e-12));
  }
  const top = level.length ? Math.max(...level) : 0;
  const total = units.reduce((a, b) => a + b, 0) || 1;
  const guesses = [0];
  let at = 0;
  for (const u of units) guesses.push(((at += u) / total) * seconds);
  const bounds = [0];
  for (let i = 1; i < units.length; i++) {
    const guess = guesses[i];
    const from = Math.max(0, Math.round((guess - SNAP) * 100));
    const to = Math.min(level.length - 1, Math.round((guess + SNAP) * 100));
    let best = -1;
    for (let k = from; k <= to; k++) if (level[k] < top - GAP_DB && (best < 0 || level[k] < level[best])) best = k;
    let b = best >= 0 ? (best + 0.5) / 100 : guess;
    // (each side keeps most of its share)
    b = Math.max(b, bounds[i - 1] + (guess - guesses[i - 1]) * KEEPS, guess - (guess - guesses[i - 1]) * (1 - KEEPS));
    b = Math.min(b, guess + (guesses[i + 1] - guess) * (1 - KEEPS));
    bounds.push(Math.min(seconds, b));
  }
  bounds.push(seconds);
  return units.map((_, i) => [Math.round(bounds[i] * 1000) / 1000, Math.round(bounds[i + 1] * 1000) / 1000]);
}

// A stretch of sound made longer without making it lower: WSOLA (waveform
// similarity overlap-add). Windows of it are laid down further apart than
// they were taken, each one taken from wherever, near where it should come
// from, its start best continues what's been laid down already, and
// crossfaded into it; so the pitch stays as it was and only the time grows.
// `by` is how many times longer (1.6 is 60% longer).
export function stretch(audio: Float32Array, rate: number, by: number): Float32Array {
  if (by <= 1.01 || audio.length < rate * 0.04) return audio;
  const win = Math.round(rate * 0.03); // 30 ms windows
  const hop = win >> 1; // laid down every half window
  const seek = Math.round(rate * 0.012); // looked for within 12 ms
  const out = new Float32Array(Math.ceil(audio.length * by) + win);
  const fade = new Float32Array(win).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win));
  let taken = 0; // where the last window was taken from
  let at = 0;
  const last = audio.length - win;
  for (; at + win < out.length; at += hop) {
    const want = Math.min(last, Math.round(at / by));
    // where near `want` carries on best from the last window's next hop
    let best = want;
    if (at > 0 && taken + hop + hop <= audio.length) {
      let bestScore = -Infinity;
      const follows = taken + hop;
      for (let k = Math.max(0, want - seek); k <= Math.min(last, want + seek); k++) {
        let score = 0;
        for (let i = 0; i < hop; i += 2) score += audio[k + i] * audio[follows + i];
        if (score > bestScore) [bestScore, best] = [score, k];
      }
    }
    for (let i = 0; i < win; i++) out[at + i] += audio[best + i] * fade[i];
    taken = best;
  }
  return out.slice(0, Math.min(out.length, Math.round(audio.length * by)));
}
