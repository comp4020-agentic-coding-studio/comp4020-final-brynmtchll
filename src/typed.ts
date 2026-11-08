// Typed instead of said: a message someone writes, given the shape of one
// that was spoken, so it goes up word by word, drawn and spoken the way it
// was meant, like everyone else's. Shared by the page (which makes it) and
// the checks.
//
// How it's meant comes from two places. The writing itself, the way people
// write how they'd say something: *this* or ALL CAPS stands out, a word
// with ! is louder, "sooo" is drawn out, a ? lifts the last word, (this) is
// said aside, quieter. And a tone for the whole message, picked beside the
// box (TONES): which words it lifts and how, as a person saying it that way
// would. Every number is relative to the message's own words, as heard
// speech's are (voice.ts Word), so a tone is a shape, not a volume.
import { LIMITS, type Word } from "./voice.ts";

export const TONES = [
  { id: "plain", label: "Plain", emoji: "💬" },
  { id: "excited", label: "Excited", emoji: "🤩" },
  { id: "calm", label: "Calm", emoji: "😌" },
  { id: "question", label: "Asking", emoji: "🤔" },
  { id: "sad", label: "Sad", emoji: "😔" },
  { id: "whisper", label: "Whisper", emoji: "🤫" },
  { id: "sarcastic", label: "Sarcastic", emoji: "🙄" },
] as const;
export type Tone = (typeof TONES)[number]["id"];
export const toneOf = (id: unknown): Tone => TONES.find((t) => t.id === id)?.id ?? "plain";

// how long a word takes to say, by its letters, and the pauses after one
const SECONDS_PER_LETTER = 0.065;
const SHORTEST = 0.18;
const GAP = 0.08;
const COMMA = 0.35;
const STOP = 0.8; // past NEW_LINE: a new line in the bubble, as a pause would

// what each tone does: how much its standout words stand out (dB louder,
// semitones higher), how slow its words go (a multiple of their time), and
// what's done to the last word
type Shape = { lift: number; up: number; slow: number; last?: { loud?: number; pitch?: number; rise?: number; stretch?: number } };
const SHAPES: Record<Tone, Shape> = {
  plain: { lift: 6, up: 3, slow: 1 },
  excited: { lift: 9, up: 5, slow: 0.9, last: { loud: 6, pitch: 4, rise: 3 } },
  calm: { lift: 3, up: 1, slow: 1.25, last: { loud: -3, pitch: -2, rise: -2 } },
  question: { lift: 5, up: 3, slow: 1, last: { pitch: 3, rise: 6 } },
  sad: { lift: 3, up: -1, slow: 1.35, last: { loud: -4, pitch: -3, rise: -3, stretch: 1.2 } },
  whisper: { lift: 3, up: 1, slow: 1.1 },
  sarcastic: { lift: 7, up: -2, slow: 1.15 },
};

// A typed message as words to send, or none for nothing worth sending.
// Too many words, or a word too long, is cut to what a message may hold.
export function typedWords(text: string, tone: Tone = "plain"): Word[] {
  const shape = SHAPES[tone];
  const words: Word[] = [];
  let t = 0;
  let aside = false;
  for (const raw of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (words.length >= LIMITS.words || t >= LIMITS.seconds - 1) break;
    // (said aside) is quieter; *marked* stands out; the marks aren't said
    const opens = raw.startsWith("(");
    if (opens) aside = true;
    const marked = /^\(?\*+[^*]+\*+[^\p{L}\p{N}]*\)?$/u.test(raw);
    let w = raw.replace(/\*/g, "");
    if (aside) w = w.replace(/^\(|\)(?=[^\p{L}\p{N}]*$)/gu, "");
    w = w.slice(0, LIMITS.letters);
    const letters = w.replace(/[^\p{L}\p{N}]/gu, "");
    if (!letters) {
      if (raw.includes(")")) aside = false;
      continue;
    }
    const shouted = letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    const bang = /!+[^\p{L}\p{N}]*$/u.test(w);
    // a letter three or more times over is drawn out, as it's typed
    const drawn = /(\p{L})\1\1/u.test(w);
    const word = drawn ? w.replace(/(\p{L})\1{2,}/gu, "$1") : w;
    const standsOut = marked || shouted || bang;
    let loud = standsOut ? shape.lift * (shouted && bang ? 1.4 : 1) : 0;
    let pitch = standsOut ? shape.up : 0;
    if (aside) [loud, pitch] = [loud - 6, pitch - 1.5];
    const stretch = drawn ? 1.6 : 0;
    const seconds = Math.max(SHORTEST, letters.length * SECONDS_PER_LETTER) * shape.slow * (drawn ? 1.8 : 1);
    words.push({
      w: word,
      start: t,
      end: t + seconds,
      loud,
      pitch,
      rise: 0,
      stretch,
      held: drawn ? 0.5 : null,
      contour: [],
      ...(tone === "whisper" ? { effect: "whisper" as const } : {}),
    });
    const end = /[.!?…]+["')\]]*$/u.test(w) ? STOP : /[,;:—–-]+["')\]]*$/u.test(w) ? COMMA : GAP;
    t += seconds + end * shape.slow;
    if (raw.includes(")")) aside = false;
  }
  if (!words.length) return [];
  // the last word, the way the tone ends it; a question lifts it, asked or not
  const last = words.at(-1)!;
  const end = { ...shape.last };
  if (/\?["')\]]*$/u.test(last.w) && tone !== "question") Object.assign(end, SHAPES.question.last);
  last.loud += end.loud ?? 0;
  last.pitch = (last.pitch ?? 0) + (end.pitch ?? 0);
  last.rise += end.rise ?? 0;
  if (end.stretch) {
    last.stretch = Math.max(last.stretch, end.stretch);
    last.held ??= 0.5;
    last.end += (last.end - last.start) * 0.5;
  }
  // sarcastic: the word it's about (the longest, or the marked one) drawn
  // out and lowered, the way "suuure" is said
  if (tone === "sarcastic") {
    const lifted = words.filter((x) => x.loud > 0);
    const target = lifted[0] ?? words.reduce((a, b) => (b.w.length > a.w.length ? b : a));
    target.stretch = Math.max(target.stretch, 1.2);
    target.held ??= 0.5;
    target.pitch = (target.pitch ?? 0) - 2;
    target.rise -= 3;
  }
  // (to a tenth, and within what a word may be, as the server keeps them)
  const round = (n: number, most = Infinity): number => Math.round(Math.min(most, Math.max(-most, n)) * 10) / 10;
  return words.map((x) => ({ ...x, start: round(x.start), end: round(x.end), loud: round(x.loud, 18), pitch: round(x.pitch ?? 0, 12), rise: round(x.rise, 12), stretch: round(x.stretch, 2), held: x.held === null ? null : round(x.held) }));
}

// Typing that goes out as it's typed, a word at a time, the way talking does
// ("text should send on hitting space bar", 8 Nov): each space sends the
// words so far, live, as a draft (faded, as a phrase still being said is),
// and the line is kept as said on Enter or once typing stops for a moment
// with nothing half-typed. The page wires it to its box (client.ts, space.ts);
// this is the deciding, so it can be checked.
export const KEEP_AFTER = 2500; // ms after the last space with nothing more typed
export type Typing = {
  // what to send now, if anything, after the box changed to `text`: a draft
  // of the whole words so far, when a word has just been finished
  changed: (text: string) => string | null;
  // the line to keep, on Enter or a pause: everything typed, and the box is
  // empty again
  done: (text: string) => string | null;
  // the number of the line now being typed, for its drafts
  line: () => number;
};
export function typing(): Typing {
  let line = 1;
  let sent = "";
  return {
    changed(text) {
      // (a word's finished when a space follows it; the words before the
      // last space, if they're more than were last sent)
      const cut = text.lastIndexOf(" ");
      const whole = cut < 0 ? "" : text.slice(0, cut).replace(/\s+/g, " ").trim();
      if (!whole || whole === sent) return null;
      sent = whole;
      return whole;
    },
    done(text) {
      const all = text.replace(/\s+/g, " ").trim();
      sent = "";
      if (!all) return null;
      line++;
      return all;
    },
    line: () => line,
  };
}
