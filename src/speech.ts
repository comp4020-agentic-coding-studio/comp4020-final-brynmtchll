// Hearing what people say, for whoever turns voices on: each phrase spoken
// as it goes up, in its speaker's chosen voice (packs.ts VOICES, and their
// pitch and speed), and the way it was said: a loud word louder, a high one
// higher, a drawn-out one slower, a whispered one quiet. Spoken here, by
// this browser's own speech (speechSynthesis): nothing about it goes
// anywhere, and nobody's actual voice is ever kept or sent.
//
// The browser speaks one thing at a time, at one pitch, speed and loudness,
// so a phrase is spoken in runs: a word that stands out on its own, the
// words between it together, each run at its own settings.
import { voiceOf, type Look } from "./packs.ts";

// a word as it comes in a phrase: the word, and how it was said (dB louder
// than their usual, semitones higher, how drawn out), and any effect on it
export type Spoken = { text: string; loud: number; pitch: number; stretch: number; effect?: string | null };

// how much of how it was said to put into how it's spoken: all of it is too
// much (a word said four semitones up, spoken a whole four up, sounds silly)
const PITCH_SHARE = 0.5;
const STANDS_OUT = { loud: 5, pitch: 3, stretch: 0.8 };
const MOST_RUN = 6; // words spoken together
const MOST_WAITING = 3; // phrases: more than this behind, the oldest goes

const synth = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
export const canSpeak = synth !== null;

// ---- which of this device's voices ----

let voices: SpeechSynthesisVoice[] = [];
const load = (): void => void (voices = synth?.getVoices() ?? []);
load();
synth?.addEventListener?.("voiceschanged", load);
const chosen = new Map<string, SpeechSynthesisVoice | null>();
function deviceVoice(id: string): SpeechSynthesisVoice | null {
  if (!voices.length) load();
  if (chosen.has(id) && voices.length) return chosen.get(id)!;
  const v = voiceOf(id);
  const found =
    v.names.map((n) => voices.find((x) => x.name === n || x.name.startsWith(`${n} `))).find(Boolean) ??
    voices.find((x) => x.lang === v.lang) ??
    voices.find((x) => x.lang.startsWith("en")) ??
    null;
  if (voices.length) chosen.set(id, found);
  return found;
}

// ---- how each run is spoken ----

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const tuned = (look: Pick<Look, "tune">, id: string): number => (look.tune as Record<string, number> | undefined)?.[id] ?? 0;

export type Run = { text: string; pitch: number; rate: number; volume: number };

// A phrase as runs, each with what the browser takes: pitch (0 to 2, 1 as
// the voice is), rate (1 as the voice is) and volume (0 to 1).
export function runsOf(words: Spoken[], look: Pick<Look, "voice" | "tune">): Run[] {
  const v = voiceOf(look.voice);
  // their pitch and speed sliders: each an octave's quarter either way, a
  // third faster or slower
  const basePitch = v.pitch * 2 ** (tuned(look, "voicePitch") * 0.5);
  const baseRate = v.rate * 2 ** (tuned(look, "voiceSpeed") * 0.45);
  const out: Run[] = [];
  let run: Spoken[] = [];
  const standsOut = (w: Spoken): boolean => Math.abs(w.loud) >= STANDS_OUT.loud || Math.abs(w.pitch) >= STANDS_OUT.pitch || w.stretch >= STANDS_OUT.stretch || !!w.effect;
  const flush = (): void => {
    if (!run.length) return;
    const avg = (k: "loud" | "pitch" | "stretch"): number => run.reduce((a, w) => a + w[k], 0) / run.length;
    const effect = run.length === 1 ? run[0].effect : null;
    let volume = clamp(0.8 + avg("loud") / 20, 0.3, 1);
    let rate = baseRate / (1 + Math.max(0, avg("stretch")) * 0.35);
    let pitch = basePitch * 2 ** ((avg("pitch") * PITCH_SHARE) / 12);
    if (effect === "whisper") volume = Math.min(volume, 0.35);
    if (effect === "impact") [volume, rate] = [1, rate * 0.88];
    if (effect === "spooky") [pitch, rate] = [pitch * 0.7, rate * 0.8];
    if (effect === "sparkle" || effect === "rainbow") pitch *= 1.15;
    out.push({ text: run.map((w) => w.text).join(" "), pitch: Math.round(clamp(pitch, 0.1, 2) * 100) / 100, rate: Math.round(clamp(rate, 0.3, 3) * 100) / 100, volume: Math.round(volume * 100) / 100 });
    run = [];
  };
  for (const w of words) {
    if (!w.text.trim()) continue;
    if (standsOut(w)) {
      flush();
      run = [w];
      flush();
    } else {
      run.push(w);
      if (run.length >= MOST_RUN) flush();
    }
  }
  flush();
  return out;
}

// ---- speaking ----

let on = false;
let ducked = false;
let waiting = 0;

// Everything stopped: what was being said counts as ended now.
function hush(): void {
  synth?.cancel();
  waiting = 0;
  held.length = 0;
  const now = Date.now();
  for (const s of spokenLately) s.until = Math.min(s.until, now);
}

// Voices on or off, for this page. On needs a tap (browsers won't speak
// before one): this is called from the switch's own click.
export function hearVoices(yes: boolean): void {
  on = yes && canSpeak;
  if (!on) hush();
  else {
    // a silent word, so the browser counts the tap as leave to speak
    const hello = new SpeechSynthesisUtterance(" ");
    hello.volume = 0;
    synth?.speak(hello);
  }
}

// Held while you talk, so it doesn't talk over you: what arrives meanwhile
// waits (the latest MOST_WAITING of it) and is said once you stop. What's
// being said already finishes rather than stop mid-word. Asked for again and
// again while you are, so it lifts by itself DUCK_FOR after the last ask (a
// microphone turned off mid-word doesn't leave it held for good).
const DUCK_FOR = 1500; // ms
let duckTimer = 0;
type Waiting = { words: Spoken[]; look: Pick<Look, "voice" | "tune">; whenStarts?: (run: Run) => void; at: number };
const held: Waiting[] = [];
const HELD_FOR = 20_000; // ms: held longer than this, it's not news any more
export function duck(yes: boolean): void {
  clearTimeout(duckTimer);
  if (yes) duckTimer = setTimeout(() => duck(false), DUCK_FOR) as unknown as number;
  if (ducked === yes) return;
  ducked = yes;
  if (!yes) for (const w of held.splice(0)) if (Date.now() - w.at < HELD_FOR) speak(w.words, w.look, w.whenStarts);
}
// whether it's saying something now (so a microphone hearing it isn't taken
// for the listener talking)
export const speaking = (): boolean => !!synth?.speaking;

// A phrase, in its speaker's voice, after whatever's being said already.
// `whenStarts` is told as each run starts (to move their avatar, say).
export function speak(words: Spoken[], look: Pick<Look, "voice" | "tune">, whenStarts?: (run: Run) => void): void {
  if (!on || !synth || look.voice === "silent") return;
  if (ducked) {
    held.push({ words, look, whenStarts, at: Date.now() });
    if (held.length > MOST_WAITING) held.shift();
    return;
  }
  // too far behind: start again from this one
  if (waiting >= MOST_WAITING) hush();
  const runs = runsOf(words, look);
  if (!runs.length) return;
  waiting++;
  const voice = deviceVoice(look.voice);
  // the whole phrase, kept from when it starts being said until a while
  // after it ends, so it isn't taken for the listener's own words
  const said: Said = { words: runs.flatMap((r) => wordsOf(r.text)), until: Infinity };
  runs.forEach((run, i) => {
    const u = new SpeechSynthesisUtterance(run.text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? voiceOf(look.voice).lang;
    u.pitch = run.pitch;
    u.rate = run.rate;
    u.volume = run.volume;
    u.onstart = () => {
      if (i === 0) keep(said);
      whenStarts?.(run);
    };
    if (i === runs.length - 1)
      u.onend = u.onerror = () => {
        waiting = Math.max(0, waiting - 1);
        said.until = Date.now();
      };
    synth.speak(u);
  });
}

// What was spoken lately, so a microphone that hears it (laptop speakers,
// no headphones) doesn't send it back as the listener's own words. Heard
// within ECHO_AFTER of something ending (time enough for the pause that
// ends a phrase and Whisper's hearing of it), a phrase is an echo when
// nearly all its words come in one thing that was spoken, in the same order
// (Whisper hears speakers a little wrong, so not all). Sharing words isn't
// enough: "yes I want to get lunch" answering "do you want to get lunch" is
// a reply, and a word or two back is an echo only if it was all that was said.
const ECHO_AFTER = 8_000; // ms
const ECHO_SHARE = 0.8;
type Said = { words: string[]; until: number };
const spokenLately: Said[] = [];
const wordsOf = (text: string): string[] => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
// how many of a's words come in b, in order (the longest common subsequence)
function inOrder(a: string[], b: string[]): number {
  let row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    const next = [0];
    for (let j = 0; j < b.length; j++) next.push(x === b[j] ? row[j] + 1 : Math.max(row[j + 1], next[j]));
    row = next;
  }
  return row[b.length];
}
const forget = (now: number): void => {
  for (let i = spokenLately.length - 1; i >= 0; i--) if (now - spokenLately[i].until > ECHO_AFTER) spokenLately.splice(i, 1);
};
export function echoOf(text: string, now = Date.now()): boolean {
  forget(now);
  const heard = wordsOf(text);
  if (!heard.length) return false;
  if (heard.length <= 2) return spokenLately.some((s) => s.words.join(" ") === heard.join(" "));
  return spokenLately.some((s) => inOrder(heard, s.words) / heard.length >= ECHO_SHARE);
}
const keep = (said: Said): void => {
  forget(Date.now());
  spokenLately.push(said);
};
// (for the checks: as if this had just been spoken)
export const remember = (text: string, now = Date.now()): void => keep({ words: wordsOf(text), until: now });

// For trying a voice out (the studio): this said in it, now, voices on or not.
export function tryVoice(look: Pick<Look, "voice" | "tune">, words: Spoken[]): void {
  if (!synth) return;
  hush();
  const was = on;
  on = true;
  ducked = false;
  speak(words, look.voice === "silent" ? { ...look, voice: "warm" } : look);
  on = was;
}
