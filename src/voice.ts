// What a spoken message is, shared by the server and the browser (the server
// serves this file to the page with its types stripped).
//
// A message is kept as its words and a few numbers about how each one was
// said, never as audio. Every number on a word is relative to the speaker's
// own voice in that same message, so a deep voice doesn't read as a sad one
// and a quiet room doesn't read as a whisper. The message as a whole also
// keeps a few absolute numbers (Voice), so the server can say how it compares
// with how that person usually sounds.
export type Word = {
  w: string; // the word as it was heard, punctuation and all
  start: number; // seconds into the clip
  end: number;
  loud: number; // dB above (+) or below (-) this message's typical word
  pitch: number | null; // semitones above or below this message's typical pitch; null if nothing was voiced
  rise: number; // semitones the pitch moved from the start of the word to its end
  stretch: number; // log2 of how long its longest held sound lasted, against this message's typical one; 0 if it held none
  held: number | null; // how far through the word (0 to 1) that sound sat; null if it held none
  // the word's pitch as it went, evenly spaced through the word, in semitones
  // against this message's typical pitch; null where nothing was voiced
  contour: (number | null)[];
  // an effect its speaker put on it before it went out, if any
  effect?: Effect;
};

// What a speaker can do to a word while it waits in their queue, each on a
// number key. style.css says what each looks like.
export const EFFECTS = ["impact", "whisper", "glow"] as const;
export type Effect = (typeof EFFECTS)[number];

// the whole message's voice, on absolute scales so messages can be compared
export type Voice = {
  pitch: number | null; // typical pitch, in semitones above 55 Hz (A1); null if nothing was voiced
  range: number; // how widely the pitch moved: semitones between its 10th and 90th percentiles
  loud: number; // typical loudness of its words, dB against digital full scale
  pace: number; // letters per second of speaking: how fast the words came
};

// How a message compares with how its speaker usually sounds, worked out by
// the server when it's said and kept with it: the gap on each scale, or null
// while there's too little history to say. Positive is higher, wider, louder,
// faster.
export type Usual = { pitch: number; range: number; loud: number; pace: number };

export const LIMITS = { words: 120, seconds: 20, letters: 40, contour: 8 } as const;

// the furthest each number may stray from typical, so one shout or one squeak
// can't take over the page
const RANGE = { loud: 18, pitch: 12, rise: 12, stretch: 2 } as const;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number): number => Math.round(n * 10) / 10;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Accepts whatever a client sent and returns the words in a shape the app
// will store and draw, or null if it isn't a message. Out-of-range numbers are
// pulled into range rather than refused, and anything that isn't one of the
// fields above is dropped, so nothing else (audio included) can ride along.
export function clean(input: unknown): Word[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > LIMITS.words) return null;
  const words: Word[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    if (typeof raw !== "object" || raw === null) return null;
    const w = typeof raw.w === "string" ? raw.w.replace(/\s+/g, " ").trim() : "";
    if (w.length < 1 || w.length > LIMITS.letters) return null;
    if (!finite(raw.start) || !finite(raw.end)) return null;
    const start = clamp(raw.start, 0, LIMITS.seconds);
    words.push({
      w,
      start: round(start),
      end: round(clamp(raw.end, start, LIMITS.seconds)),
      loud: round(finite(raw.loud) ? clamp(raw.loud, -RANGE.loud, RANGE.loud) : 0),
      pitch: finite(raw.pitch) ? round(clamp(raw.pitch, -RANGE.pitch, RANGE.pitch)) : null,
      rise: round(finite(raw.rise) ? clamp(raw.rise, -RANGE.rise, RANGE.rise) : 0),
      stretch: round(finite(raw.stretch) ? clamp(raw.stretch, -RANGE.stretch, RANGE.stretch) : 0),
      held: finite(raw.held) ? round(clamp(raw.held, 0, 1)) : null,
      contour: Array.isArray(raw.contour)
        ? (raw.contour as unknown[]).slice(0, LIMITS.contour).map((p) => (finite(p) ? round(clamp(p, -RANGE.pitch, RANGE.pitch)) : null))
        : [],
      ...((EFFECTS as readonly unknown[]).includes(raw.effect) ? { effect: raw.effect as Effect } : {}),
    });
  }
  return words;
}

// the voice summary as a client sent it, pulled into plausible ranges, or
// null if it isn't one; a message without one simply isn't compared
export function cleanVoice(input: unknown): Voice | null {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;
  if (!finite(v.range) || !finite(v.loud) || !finite(v.pace)) return null;
  return {
    pitch: finite(v.pitch) ? round(clamp(v.pitch, 0, 60)) : null,
    range: round(clamp(v.range, 0, 36)),
    loud: round(clamp(v.loud, -100, 0)),
    pace: round(clamp(v.pace, 0, 40)),
  };
}

// The few messages before this one are someone's usual. Fewer than
// USUAL_AFTER and there's no usual yet; past USUAL_OVER, older ones stop
// counting, so a usual can drift as someone settles in.
export const USUAL_AFTER = 3;
export const USUAL_OVER = 20;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// how a voice compares with the ones before it, or null with too few before it
export function compare(voice: Voice, before: Voice[]): Usual | null {
  const recent = before.slice(-USUAL_OVER);
  if (recent.length < USUAL_AFTER) return null;
  const pitches = recent.flatMap((v) => (v.pitch === null ? [] : [v.pitch]));
  return {
    pitch: voice.pitch === null || pitches.length === 0 ? 0 : round(voice.pitch - median(pitches)),
    range: round(voice.range - median(recent.map((v) => v.range))),
    loud: round(voice.loud - median(recent.map((v) => v.loud))),
    // as a ratio, in log2: 1 is twice as fast
    pace: round(Math.log2(Math.max(0.1, voice.pace) / Math.max(0.1, median(recent.map((v) => v.pace))))),
  };
}

// How far off usual counts as noticeably different on each scale, and the
// words that say which way. Someone's own voice varies a semitone or two and
// a few dB from one message to the next, and mic distance moves loudness, so
// the bars are set past that.
//
// Pace is measured and kept but never said or drawn. On 178 of CREMA-D's
// actors' takes (one sentence in six emotions each), four ways of measuring it
// disagreed about whether angry and happy were faster or slower than neutral,
// and none agreed with the next; pitch and loudness separated cleanly (angry
// was louder than the same actor's neutral for all of them, higher for 95%).
// Playback shows pace as it was, word by word, which needs no measure.
const NOTICE = { pitch: 2.5, range: 4, loud: 5 } as const;
const SAYS: Record<keyof typeof NOTICE, [string, string]> = {
  pitch: ["higher", "lower"],
  range: ["more animated", "flatter"],
  loud: ["louder", "quieter"],
};

// "higher and faster than sam usually sounds", or null when it's within usual
export function describe(usual: Usual | null, name: string): string | null {
  if (!usual) return null;
  const ways = (Object.keys(SAYS) as (keyof typeof NOTICE)[])
    .filter((k) => Math.abs(usual[k]) >= NOTICE[k])
    .map((k) => SAYS[k][usual[k] > 0 ? 0 : 1]);
  if (ways.length === 0) return null;
  const list = ways.length === 1 ? ways[0] : `${ways.slice(0, -1).join(", ")} and ${ways.at(-1)}`;
  return `${list[0].toUpperCase()}${list.slice(1)} than ${name} usually sounds`;
}

// The message as a whole, as CSS custom properties, from how it compares with
// usual: --u-loud, --u-range and --u-pitch, each pulled to -1..1 at about
// twice the notice bar. Nothing is set without a usual, so a newcomer's
// messages draw plain.
export function usualVars(usual: Usual | null): string {
  if (!usual) return "";
  return (Object.keys(NOTICE) as (keyof typeof NOTICE)[])
    .map((k) => `--u-${k}:${round(clamp(usual[k] / (NOTICE[k] * 2), -1, 1))}`)
    .join(";");
}

export const textOf = (words: Word[]): string => words.map((x) => x.w).join(" ");

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const letterCount = (w: string): number => Math.max(1, (w.match(/[\p{L}\p{N}]/gu) ?? []).length);

// A word's characters, whole: a letter outside the basic plane ("𝐚") is two
// UTF-16 units, and splitting it would draw half a character. Every index
// below counts these, never UTF-16 units.
const chars = (w: string): string[] => Array.from(w);

// index of the last letter, so trailing punctuation ("so.") is skipped
const lastLetter = (cs: string[]): number => cs.findLastIndex((c) => /\p{L}/u.test(c));

// Matched one character at a time, case-insensitively, rather than by
// lowercasing the word: some letters change length when lowercased ("İ" is
// two characters lower), which would shift every index after them.
const VOWEL = /^[aeiou]$/i;
const Y = /^y$/i;
const E = /^e$/i;

// The vowel sounds in a word's spelling, as [first, last] character indexes.
// y counts as a vowel unless it starts the word or comes before another vowel
// ("yes", "beyond"), and a lone e ending a word with other vowels is silent
// ("please", "time").
export function vowels(w: string): [number, number][] {
  const cs = chars(w);
  const isVowel = (i: number): boolean => VOWEL.test(cs[i]) || (Y.test(cs[i]) && i > 0 && !VOWEL.test(cs[i + 1] ?? ""));
  const groups: [number, number][] = [];
  for (let i = 0; i < cs.length; i++) {
    if (!isVowel(i)) continue;
    const prev = groups.at(-1);
    if (prev && prev[1] === i - 1) prev[1] = i;
    else groups.push([i, i]);
  }
  const tail = groups.at(-1);
  if (groups.length > 1 && tail && tail[0] === tail[1] && E.test(cs[tail[0]]) && tail[0] === lastLetter(cs)) groups.pop();
  return groups;
}

// The character a drawn-out word repeats: the vowel nearest to where the
// voice held steadiest, or, when it held nothing in particular, the last vowel
// that's sounded. A word with no vowel at all ("hmm", "shh") repeats its last
// letter. A vowel pair repeats its second letter ("pleaaase", "goooood").
export function holdLetter(w: string, held: number | null): number | null {
  const groups = vowels(w);
  const end = lastLetter(chars(w));
  if (groups.length === 0) return end >= 0 ? end : null;
  if (held === null) return groups.at(-1)![1];
  const where = (g: [number, number]): number => Math.abs((g[0] + g[1] + 1) / 2 / (end + 1) - held);
  return groups.reduce((best, g) => (where(g) < where(best) ? g : best))[1];
}

// A word counts as drawn out when it held a sound at least twice as long as
// its message usually holds one (a stressed vowel alone is longer than
// typical, but rarely twice), and repeats two letters for each typical sound's
// worth of extra time, up to a point. A one-letter word never repeats: "II"
// reads as a numeral.
const DRAWN_OUT = 1;
const MOST_REPEATS = 5;

export function repeats(x: Word): number {
  if (x.stretch < DRAWN_OUT || letterCount(x.w) < 2) return 0;
  return Math.min(MOST_REPEATS, Math.max(1, Math.round(2 * (2 ** x.stretch - 1))));
}

// One word as HTML, styled by how it was said: its numbers go on as CSS
// custom properties and style.css decides what they look like, so how loud
// becomes how heavy is tuned in one place. A drawn-out word repeats a letter
// the way people type it ("sooo"); the repeats are hidden from screen
// readers, which read the word as said.
export function wordHtml(x: Word, gap = 0): string {
  const vars = `--loud:${x.loud};--pitch:${x.pitch ?? 0};--rise:${x.rise};--gap:${round(clamp(gap, 0, 3))}`;
  const n = repeats(x);
  const at = n > 0 ? holdLetter(x.w, x.held ?? null) : null;
  const cs = chars(x.w);
  const shown =
    at === null || cs[at] === undefined
      ? esc(x.w)
      : `${esc(cs.slice(0, at + 1).join(""))}<span class="held" aria-hidden="true">${esc(cs[at].repeat(n))}</span>${esc(cs.slice(at + 1).join(""))}`;
  return `<span class="w${x.effect ? ` fx-${x.effect}` : ""}" style="${vars}">${shown}</span>`;
}

// A message's words as HTML, a pause hanging off the end of the word before
// it (so a pause at a line break doesn't indent the next line).
export function renderWords(words: Word[]): string {
  return words.map((x, i) => wordHtml(x, i + 1 < words.length ? words[i + 1].start - x.end : 0)).join(" ");
}

// Where the i-th person stands on the stage, as 0-100 across and down it.
// The R2 sequence (Roberts, 2018) spreads its first n points well for any n,
// so the stage looks scattered with two people or twelve, and nobody moves
// when someone new arrives. Starting it at 0.67 rather than the usual 0.5
// leaves the largest empty patch about a fifth smaller with two to eight
// people, the usual size of a room.
const PLASTIC = 1.324717957244746;
const R2_START = 0.67;
export function spotAt(i: number): { x: number; y: number } {
  const x = (R2_START + (i + 1) / PLASTIC) % 1;
  const y = (R2_START + (i + 1) / (PLASTIC * PLASTIC)) % 1;
  return { x: round(x * 100), y: round(y * 100) };
}

// Each person's colour, from their seat like their place, so it's the same
// on every page and nobody's changes when someone arrives. Seats step round
// the colour wheel by the golden angle, so people who join one after another
// never share a colour: a hue from each name's letters gave two of the first
// two people in a test room the same pink. Saturation and lightness are
// style.css's, set per theme so every hue reads against the background.
const GOLDEN_ANGLE = 137.508;
export const hueOf = (seat: number): number => Math.round((20 + seat * GOLDEN_ANGLE) % 360);


export const ago = (at: number, now: number = Date.now()): string => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
