// What a spoken message is, shared by the server and the browser (the server
// serves this file to the page with its types stripped).
//
// A message is kept as its words and a few numbers about how each one was
// said, never as audio. Every number is relative to the speaker's own voice in
// that same message, so a deep voice doesn't read as a sad one and a quiet
// room doesn't read as a whisper.
export type Word = {
  w: string; // the word as it was heard, punctuation and all
  start: number; // seconds into the clip
  end: number;
  loud: number; // dB above (+) or below (-) this message's typical word
  pitch: number | null; // semitones above or below this message's typical pitch; null if nothing was voiced
  rise: number; // semitones the pitch moved from the start of the word to its end
  stretch: number; // log2 of how long its longest held sound lasted, against this message's typical one; 0 if it held none
  held: number | null; // how far through the word (0 to 1) that sound sat; null if it held none
};

export const LIMITS = { words: 120, seconds: 20, letters: 40 } as const;

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
    });
  }
  return words;
}

export const textOf = (words: Word[]): string => words.map((x) => x.w).join(" ");

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const letterCount = (w: string): number => Math.max(1, (w.match(/[\p{L}\p{N}]/gu) ?? []).length);

// index of the last letter, so trailing punctuation ("so.") is skipped
const lastLetter = (w: string): number => w.search(/\p{L}(?=\P{L}*$)/u);

// The vowel sounds in a word's spelling, as [first, last] letter indexes. y
// counts as a vowel unless it starts the word or comes before another vowel
// ("yes", "beyond"), and a lone e ending a word with other vowels is silent
// ("please", "time").
export function vowels(w: string): [number, number][] {
  const lower = w.toLowerCase();
  const isVowel = (i: number): boolean =>
    "aeiou".includes(lower[i]) || (lower[i] === "y" && i > 0 && !"aeiou".includes(lower[i + 1] ?? ""));
  const groups: [number, number][] = [];
  for (let i = 0; i < lower.length; i++) {
    if (!isVowel(i)) continue;
    const prev = groups.at(-1);
    if (prev && prev[1] === i - 1) prev[1] = i;
    else groups.push([i, i]);
  }
  const tail = groups.at(-1);
  if (groups.length > 1 && tail && tail[0] === tail[1] && lower[tail[0]] === "e" && tail[0] === lastLetter(w)) groups.pop();
  return groups;
}

// The letter a drawn-out word repeats: the vowel nearest to where the voice
// held steadiest, or, when it held nothing in particular, the last vowel
// that's sounded. A word with no vowel at all ("hmm", "shh") repeats its last
// letter. A vowel pair repeats its second letter ("pleaaase", "goooood").
export function holdLetter(w: string, held: number | null): number | null {
  const groups = vowels(w);
  const end = lastLetter(w);
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

// The words as HTML. Each word carries its numbers as CSS custom properties
// and style.css decides what they look like, so how loud becomes how heavy is
// tuned in one place. A pause hangs off the end of the word before it, so a
// pause that falls at a line break doesn't indent the next line. A drawn-out word repeats a letter the way people type it ("sooo");
// the repeats are hidden from screen readers, which read the word as said.
export function renderWords(words: Word[]): string {
  return words
    .map((x, i) => {
      const gap = i + 1 < words.length ? clamp(words[i + 1].start - x.end, 0, 3) : 0;
      const vars = `--loud:${x.loud};--pitch:${x.pitch ?? 0};--rise:${x.rise};--gap:${round(gap)}`;
      const n = repeats(x);
      const at = n > 0 ? holdLetter(x.w, x.held ?? null) : null;
      const shown =
        at === null
          ? esc(x.w)
          : `${esc(x.w.slice(0, at + 1))}<span class="held" aria-hidden="true">${esc(x.w[at].repeat(n))}</span>${esc(x.w.slice(at + 1))}`;
      return `<span class="w" style="${vars}">${shown}</span>`;
    })
    .join(" ");
}

export const ago = (at: number, now: number = Date.now()): string => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
