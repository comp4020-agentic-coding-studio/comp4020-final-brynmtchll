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
  stretch: number; // log2 of how long it took per letter, against this message's typical word
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
    });
  }
  return words;
}

export const textOf = (words: Word[]): string => words.map((x) => x.w).join(" ");

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// The words as HTML. Each word carries its numbers as CSS custom properties
// and style.css decides what they look like, so how loud becomes how heavy is
// tuned in one place. The pause before a word is the gap since the last one
// ended.
export function renderWords(words: Word[]): string {
  return words
    .map((x, i) => {
      const gap = i === 0 ? 0 : clamp(x.start - words[i - 1].end, 0, 3);
      const vars = `--loud:${x.loud};--pitch:${x.pitch ?? 0};--rise:${x.rise};--stretch:${x.stretch};--gap:${round(gap)}`;
      return `<span class="w" style="${vars}">${esc(x.w)}</span>`;
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
