// Every choice the app offers, as data: the voices typed words can be read
// out in, how long a room keeps what's said in it, and how a reader can set
// the page to read it. Each is a list of choices with an id (what's stored
// and sent) and a label (what's shown); adding one is adding an entry here.
// The pickers, the checks on what's sent and the drawing all read these.
//
// Shared by the server (which checks every choice against them) and the
// browser (which draws them).

export type Choice = { id: string; label: string };

// ---- voices ----

// The voices someone's typed words are read out in, for whoever has read-
// aloud on. `kokoro` is the natural voice (kokoro.ts); `names` the device's
// own voices to try, best first; `pitch` and `rate` move the natural voice,
// `device` the device's. `hz` is about where it sits (decisions-log), to
// list them highest first. "Silent" is never read out. Ids never go: a
// person keeps the one they chose.
export const VOICES = [
  { id: "warm", hz: 200, label: "Heart", about: "warm, American", kokoro: "af_heart", names: ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Zira", "Karen"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1, rate: 1 } },
  { id: "bright", hz: 192, label: "Bella", about: "bright, American", kokoro: "af_bella", names: ["Karen", "Tessa", "Google UK English Female", "Microsoft Jenny", "Samantha"], lang: "en-US", pitch: 1, rate: 1.04, device: { pitch: 1.3, rate: 1.06 } },
  { id: "soft", hz: 161, label: "Nicole", about: "soft and close, American", kokoro: "af_nicole", names: ["Samantha", "Microsoft Aria", "Google US English"], lang: "en-US", pitch: 1, rate: 1.1, device: { pitch: 1.05, rate: 0.92 } },
  { id: "lively", hz: 151, label: "Kore", about: "lively, American", kokoro: "af_kore", names: ["Allison", "Microsoft Jenny", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1.15, rate: 1.05 } },
  { id: "easy", hz: 185, label: "Sarah", about: "easygoing, American", kokoro: "af_sarah", names: ["Susan", "Microsoft Michelle", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1.05, rate: 1 } },
  { id: "emma", hz: 180, label: "Emma", about: "clear, British", kokoro: "bf_emma", names: ["Serena", "Kate", "Google UK English Female", "Microsoft Libby", "Microsoft Hazel"], lang: "en-GB", pitch: 1, rate: 1, device: { pitch: 1.05, rate: 1 } },
  { id: "isabella", hz: 201, label: "Isabella", about: "high, British", kokoro: "bf_isabella", names: ["Stephanie", "Google UK English Female", "Microsoft Sonia"], lang: "en-GB", pitch: 1, rate: 1, device: { pitch: 1.25, rate: 1 } },
  { id: "deep", hz: 87, label: "Onyx", about: "deep, American", kokoro: "am_onyx", names: ["Daniel", "Google UK English Male", "Microsoft Guy", "Microsoft David", "Rishi", "Fred"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.75, rate: 0.95 } },
  { id: "steady", hz: 117, label: "Michael", about: "steady, American", kokoro: "am_michael", names: ["Alex", "Tom", "Microsoft Guy", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.9, rate: 1 } },
  { id: "firm", hz: 136, label: "Fenrir", about: "firm, American", kokoro: "am_fenrir", names: ["Aaron", "Microsoft Davis", "Microsoft David"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.95, rate: 1.02 } },
  { id: "quick", hz: 113, label: "Puck", about: "quick, American", kokoro: "am_puck", names: ["Rishi", "Reed (English (United States))", "Microsoft Mark", "Google US English"], lang: "en-US", pitch: 1, rate: 1.15, device: { pitch: 1.05, rate: 1.25 } },
  { id: "story", hz: 113, label: "Fable", about: "a storyteller, British", kokoro: "bm_fable", names: ["Moira", "Daniel", "Google UK English Female", "Microsoft Libby", "Microsoft Hazel"], lang: "en-GB", pitch: 1, rate: 0.95, device: { pitch: 0.95, rate: 0.88 } },
  { id: "george", hz: 144, label: "George", about: "low, British", kokoro: "bm_george", names: ["Arthur", "Daniel", "Google UK English Male", "Microsoft Ryan"], lang: "en-GB", pitch: 1, rate: 1, device: { pitch: 0.9, rate: 0.98 } },
  { id: "grand", hz: 88, label: "Lewis", about: "deep and slow, British", kokoro: "bm_lewis", names: ["Grandpa (English (United Kingdom))", "Grandpa (English (United States))", "Microsoft George", "Daniel"], lang: "en-GB", pitch: 1, rate: 0.88, device: { pitch: 0.7, rate: 0.85 } },
  { id: "aoede", hz: 172, label: "Aoede", about: "gentle, American", kokoro: "af_aoede", names: ["Allison", "Microsoft Jenny", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1.1, rate: 0.97 } },
  { id: "river", hz: 177, label: "River", about: "calm and even, American", kokoro: "af_river", names: ["Ava", "Microsoft Aria", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1.05, rate: 0.95 } },
  { id: "nova", hz: 160, label: "Nova", about: "middling, American", kokoro: "af_nova", names: ["Zoe", "Microsoft Michelle", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1, rate: 1 } },
  { id: "alloy", hz: 140, label: "Alloy", about: "low and level, American", kokoro: "af_alloy", names: ["Susan", "Microsoft Aria", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.9, rate: 1 } },
  { id: "alice", hz: 230, label: "Alice", about: "high and lively, British", kokoro: "bf_alice", names: ["Kate", "Google UK English Female", "Microsoft Sonia"], lang: "en-GB", pitch: 1, rate: 1, device: { pitch: 1.3, rate: 1.02 } },
  { id: "eric", hz: 151, label: "Eric", about: "light, American", kokoro: "am_eric", names: ["Tom", "Microsoft Andrew", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 1, rate: 1 } },
  { id: "liam", hz: 117, label: "Liam", about: "brisk, American", kokoro: "am_liam", names: ["Evan", "Microsoft Brian", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.9, rate: 1.08 } },
  { id: "adam", hz: 115, label: "Adam", about: "flat, American", kokoro: "am_adam", names: ["Alex", "Microsoft Guy", "Google US English"], lang: "en-US", pitch: 1, rate: 1, device: { pitch: 0.85, rate: 1 } },
  { id: "daniel", hz: 125, label: "Daniel", about: "plain, British", kokoro: "bm_daniel", names: ["Daniel", "Google UK English Male", "Microsoft Ryan"], lang: "en-GB", pitch: 1, rate: 1, device: { pitch: 0.9, rate: 1 } },
  { id: "silent", label: "Silent", about: "not read out", kokoro: "", names: [], lang: "", pitch: 1, rate: 1, device: { pitch: 1, rate: 1 } },
] as const satisfies readonly (Choice & { hz?: number; about: string; kokoro: string; names: readonly string[]; lang: string; pitch: number; rate: number; device: { pitch: number; rate: number }; robot?: true; hushed?: true })[];
export type VoiceChoice = (typeof VOICES)[number];
export type VoiceId = VoiceChoice["id"];
// to choose from: highest first, silent last
export const VOICES_IN_ORDER = [...VOICES].sort((a, b) => ("hz" in b ? b.hz : -1) - ("hz" in a ? a.hz : -1));
export const voiceOf = (id: unknown): VoiceChoice => VOICES.find((v) => v.id === id) ?? VOICES[0];
export const isVoice = (id: unknown): id is VoiceId => VOICES.some((v) => v.id === id);

// Someone who hasn't chosen a voice gets one from their seat, every voice but
// silent in turn by a step sharing no factor with how many there are, so two
// people who joined one after the other sound different.
const SPEAKING = VOICES.filter((v) => v.id !== "silent");
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const STEP = [5, 7, 4, 3, 1].find((n) => gcd(n, SPEAKING.length) === 1)!;
export const voiceFor = (seat: number): VoiceId => SPEAKING[(((seat * STEP) % SPEAKING.length) + SPEAKING.length) % SPEAKING.length].id;

// ---- rooms ----

// How long a room keeps what's said in it, as its maker chose. What's past
// it is deleted for good, not hidden: a tutorial that keeps nothing past
// today means what was said there is gone tomorrow. `ms` is how long; null
// is for as long as the room lasts. The main room keeps a day.
export const KEEPS = [
  { id: "hour", label: "An hour", ms: 60 * 60_000 },
  { id: "day", label: "A day", ms: 24 * 60 * 60_000 },
  { id: "week", label: "A week", ms: 7 * 24 * 60 * 60_000 },
  { id: "always", label: "Until it's closed", ms: null },
] as const satisfies readonly (Choice & { ms: number | null })[];
export type Keep = (typeof KEEPS)[number]["id"];
export const keepOf = (id: unknown): Keep | null => KEEPS.find((k) => k.id === id)?.id ?? null;
export const keepMs = (id: Keep): number | null => KEEPS.find((k) => k.id === id)!.ms;
export const MAIN_KEEP: Keep = "day";

// ---- reading ----

// How a reader sets the page for themselves: theirs alone, kept in their own
// browser, never sent. `size` scales the transcript's type; `feeling` how
// strongly how a word was said shows in it (none is plain captions; more
// for a reader who wants it unmistakable); `contrast` more for low vision.
export const READING = {
  size: [
    { id: "s", label: "Small", scale: 0.85 },
    { id: "m", label: "Medium", scale: 1 },
    { id: "l", label: "Large", scale: 1.3 },
    { id: "xl", label: "Huge", scale: 1.75 },
  ],
  feeling: [
    { id: "none", label: "None", scale: 0 },
    { id: "some", label: "Some", scale: 0.6 },
    { id: "full", label: "Full", scale: 1 },
    { id: "more", label: "More", scale: 1.5 },
  ],
  contrast: [
    { id: "normal", label: "Normal" },
    { id: "high", label: "High" },
  ],
} as const satisfies Record<string, readonly (Choice & { scale?: number })[]>;
export type ReadingPart = keyof typeof READING;
export type Reading = { [P in ReadingPart]: (typeof READING)[P][number]["id"] };
export const DEFAULT_READING: Reading = { size: "m", feeling: "full", contrast: "normal" };
export function cleanReading(input: unknown): Reading {
  const out = { ...DEFAULT_READING } as Record<ReadingPart, string>;
  if (input && typeof input === "object")
    for (const part of Object.keys(READING) as ReadingPart[]) {
      const v = (input as Record<string, unknown>)[part];
      if (READING[part].some((c) => c.id === v)) out[part] = v as string;
    }
  return out as Reading;
}
