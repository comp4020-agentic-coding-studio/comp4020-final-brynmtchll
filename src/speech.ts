// Hearing what people say, for whoever turns voices on: each phrase spoken
// as it goes up, in its speaker's chosen voice (packs.ts VOICES, and their
// pitch and speed), and the way it was said: a loud word louder, a high one
// higher, a drawn-out one slower, a whispered one quiet. Spoken here, in
// this browser: nothing about it goes anywhere, and nobody's actual voice is
// ever kept or sent.
//
// Two ways to say it. The device's own voices (speechSynthesis), at once,
// for everyone, sounding different on each device. Or, for someone who
// turns them on, natural ones (Kokoro, kokoro.ts, a download the first
// time), the same everywhere; until they're ready, or if they can't be,
// the device's say it.
//
// The device's voices say a phrase in runs: a word that stands out on its
// own, the words between it together, each run at its own pitch, speed and
// loudness. A natural voice says a phrase whole (said in pieces it sounded
// like someone reading out a list, and a word on its own came out garbled),
// reading its punctuation for how it goes, and a word that stood out is
// made to stand out in what it said: louder, higher, or drawn out, where
// that word is.
import { voiceOf, type Look } from "./packs.ts";
import type { Build, FromKokoro, Phrase as KokoroPhrase, ToKokoro } from "./kokoro.ts";

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
  const basePitch = v.device.pitch * 2 ** (tuned(look, "voicePitch") * 0.5);
  const baseRate = v.device.rate * 2 ** (tuned(look, "voiceSpeed") * 0.45);
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

// ---- a phrase for a natural voice ----

// How a natural voice says a phrase: its words, how fast to ask the model to
// say them, how fast to play what it says (which moves its pitch too: so to
// raise a voice without speeding it up, it's asked for slower and played
// faster), how loud; and for each word how it's moved from that, louder or
// quieter (gain) and faster or slower (rate: higher and quicker, or lower and
// drawn out, as a word said that way is).
export type Shape = { gain: number; rate: number };
export type NaturalPlan = { words: string[]; speed: number; play: number; volume: number; shapes: Shape[] };
// the model says well between about half and twice its own speed
const SPEED = { lo: 0.6, hi: 1.7 };
export function naturalPlan(words: Spoken[], look: Pick<Look, "voice" | "tune">): NaturalPlan | null {
  const said = words.filter((w) => w.text.trim());
  if (!said.length) return null;
  const v = voiceOf(look.voice);
  const pitch = v.pitch * 2 ** (tuned(look, "voicePitch") * 0.5);
  const rate = v.rate * 2 ** (tuned(look, "voiceSpeed") * 0.45);
  const play = clamp(pitch, 0.6, 1.6);
  const speed = clamp(rate / play, SPEED.lo, SPEED.hi);
  const hushed = "hushed" in v && v.hushed;
  const shapes = said.map((w): Shape => {
    let gain = 1;
    let r = 1;
    if (w.loud >= STANDS_OUT.loud) [gain, r] = [Math.min(1.8, 1 + w.loud / 12), 1.05];
    else if (w.loud <= -STANDS_OUT.loud) gain = Math.max(0.45, 1 + w.loud / 16);
    if (Math.abs(w.pitch) >= STANDS_OUT.pitch) r *= 2 ** ((w.pitch * PITCH_SHARE) / 12);
    if (w.stretch >= STANDS_OUT.stretch) r *= 1 / (1 + w.stretch * 0.3);
    if (w.effect === "impact") [gain, r] = [Math.max(gain, 1.6), r * 0.94];
    if (w.effect === "whisper") gain = Math.min(gain, 0.45);
    if (w.effect === "spooky") r *= 0.8;
    if (w.effect === "sparkle" || w.effect === "rainbow") r *= 1.1;
    return { gain: round2(gain), rate: round2(clamp(r, 0.6, 1.4)) };
  });
  // the whole phrase as loud as its words on average, quieter for a hushed voice
  const volume = round2(hushed ? 0.45 : 0.8);
  return { words: said.map((w) => w.text), speed: round2(speed), play: round2(play), volume, shapes };
}
const round2 = (n: number): number => Math.round(n * 100) / 100;

// When each word starts in what's played, once each is played at its own
// rate: the model's spans (seconds in what it made) through the shapes.
export function playedSpans(spans: [number, number][], shapes: Shape[], play: number): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  let from = 0;
  spans.forEach(([a, b], i) => {
    // (the bit between words, if any, at the phrase's own rate)
    at += Math.max(0, a - from) / play;
    const start = at;
    at += (b - a) / (play * (shapes[i]?.rate ?? 1));
    out.push([start, at]);
    from = b;
  });
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
  stopNatural();
  const now = Date.now();
  for (const s of spokenLately) s.until = Math.min(s.until, now);
}

// Voices on or off, for this page. On needs a tap (browsers won't speak
// before one): this is called from the switch's own click.
export function hearVoices(yes: boolean): void {
  on = yes && (canSpeak || canNatural);
  if (!on) hush();
  else {
    // a silent word, so the browser counts the tap as leave to speak
    if (synth) {
      const hello = new SpeechSynthesisUtterance(" ");
      hello.volume = 0;
      synth.speak(hello);
    }
    void audio()?.resume();
  }
}

// ---- natural voices (Kokoro) ----

// Off until asked for, then downloading, then ready (or failed, and the
// device's voices go on saying it). Told to the page as it changes.
export type Natural = { state: "off" | "loading" | "ready" | "failed"; loaded?: number; total?: number; build?: Build };
// whether this device's graphics can run the bigger, faster build (and so
// which one turning natural voices on would download)
let adapter: Promise<boolean> | undefined;
export const gpuAdapter = (): Promise<boolean> =>
  (adapter ??= (async () => {
    try {
      return !!(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter());
    } catch {
      return false;
    }
  })());
export const canNatural = typeof Worker !== "undefined" && typeof AudioContext !== "undefined" && typeof WebAssembly !== "undefined";
let natural: Natural = { state: "off" };
let tell: (n: Natural) => void = () => {};
let kokoro: Worker | null = null;
const asked = new Map<number, (made: { audio: Float32Array; spans: [number, number][] } | null) => void>();
let nextAsk = 1;
const RATE = 24_000;
// (as kokoro.ts SIZE: a type-only import keeps the worker's CDN imports out)
const SIZES: Record<Build, number> = { fast: 330e6, small: 92e6 };
export const naturalSize = (fast: boolean): number => SIZES[fast ? "fast" : "small"];
export const naturalNow = (): Natural => natural;
const set = (n: Natural): void => {
  natural = n;
  tell(n);
};
// Natural voices on (downloading them the first time; `fast` for the bigger,
// quicker GPU build where there is one) or off, and who to tell how it goes.
export function naturalVoices(yes: boolean, fast = false, told?: (n: Natural) => void): void {
  if (told) tell = told;
  if (!yes || !canNatural) {
    kokoro?.terminate();
    kokoro = null;
    for (const done of asked.values()) done(null);
    asked.clear();
    stopNatural();
    return set({ state: "off" });
  }
  if (kokoro) return tell(natural);
  kokoro = new Worker(new URL("./kokoro.ts", import.meta.url), { type: "module" });
  set({ state: "loading", loaded: 0, total: 0 });
  kokoro.onmessage = (e: MessageEvent<FromKokoro>) => {
    const m = e.data;
    if (m.type === "loading" && natural.state === "loading") set({ state: "loading", loaded: m.loaded, total: Math.max(m.total, SIZES[m.build]), build: m.build });
    else if (m.type === "ready") set({ state: "ready", build: m.build });
    else if (m.type === "said") {
      asked.get(m.id)?.({ audio: m.audio, spans: m.spans });
      asked.delete(m.id);
    } else if (m.type === "failed") {
      if (m.id === null) {
        set({ state: "failed" });
        kokoro?.terminate();
        kokoro = null;
      }
      if (m.id !== null) asked.get(m.id)?.(null);
      if (m.id !== null) asked.delete(m.id);
    }
  };
  kokoro.onerror = () => {
    set({ state: "failed" });
    for (const done of asked.values()) done(null);
    asked.clear();
    kokoro = null;
  };
  kokoro.postMessage({ type: "load", build: fast ? "fast" : "small" } satisfies ToKokoro);
}
type Made = { audio: Float32Array; spans: [number, number][] };
function generate(phrase: KokoroPhrase): Promise<Made | null> {
  if (!kokoro || natural.state !== "ready") return Promise.resolve(null);
  const id = nextAsk++;
  return new Promise((resolve) => {
    asked.set(id, resolve);
    kokoro!.postMessage({ type: "say", id, phrase } satisfies ToKokoro);
  });
}

// What a natural voice says is played here, each phrase after the last.
let ctx: AudioContext | null = null;
const audio = (): AudioContext | null => (canNatural ? (ctx ??= new AudioContext()) : null);
let playingUntil = 0; // in the audio clock: when what's queued ends
const playing = new Set<AudioScheduledSourceNode>();
let naturalGen = 0; // bumped by a hush, so what was being made for before it isn't played
function stopNatural(): void {
  naturalGen++;
  pending.length = 0;
  for (const n of playing) {
    try {
      n.stop();
    } catch {
      // not started
    }
  }
  playing.clear();
  playingUntil = 0;
}
// a robot: the voice ring-modulated by a hum, which is what made voices
// robots in old films
function robotise(c: AudioContext, input: AudioNode, out: AudioNode, at: number, until: number): void {
  const hum = c.createOscillator();
  hum.frequency.value = 55;
  const ring = c.createGain();
  ring.gain.value = 0;
  hum.connect(ring.gain);
  input.connect(ring).connect(out);
  hum.start(at);
  hum.stop(until);
  playing.add(hum);
  hum.onended = () => playing.delete(hum);
}
// A phrase played after what's playing: one sound, each word that stood
// out moved where it is (its rate and loudness changed at its edges, eased
// over a few milliseconds so nothing clicks). Told as each word starts, and
// when it ends.
const EASE = 0.015; // s
function play(plan: NaturalPlan, made: Made, look: Pick<Look, "voice">, whenStarts?: (i: number) => void, ended?: () => void): void {
  const c = audio();
  if (!c || !made.audio.length) return ended?.();
  const v = voiceOf(look.voice);
  const at = Math.max(c.currentTime + 0.05, playingUntil);
  const buf = c.createBuffer(1, made.audio.length, RATE);
  buf.copyToChannel(made.audio as Float32Array<ArrayBuffer>, 0);
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  src.connect(gain);
  const spans = playedSpans(made.spans, plan.shapes, plan.play);
  src.playbackRate.setValueAtTime(plan.play, at);
  gain.gain.setValueAtTime(plan.volume, at);
  plan.shapes.forEach((shape, i) => {
    const span = spans[i];
    if (!span || (shape.gain === 1 && shape.rate === 1)) return;
    const [a, b] = span;
    src.playbackRate.setValueAtTime(plan.play, at + Math.max(0, a - EASE));
    src.playbackRate.linearRampToValueAtTime(plan.play * shape.rate, at + a + EASE);
    src.playbackRate.setValueAtTime(plan.play * shape.rate, at + Math.max(a + EASE, b - EASE));
    src.playbackRate.linearRampToValueAtTime(plan.play, at + b + EASE);
    gain.gain.setValueAtTime(plan.volume, at + Math.max(0, a - EASE));
    gain.gain.linearRampToValueAtTime(Math.min(1, plan.volume * shape.gain), at + a + EASE);
    gain.gain.setValueAtTime(Math.min(1, plan.volume * shape.gain), at + Math.max(a + EASE, b - EASE));
    gain.gain.linearRampToValueAtTime(plan.volume, at + b + EASE);
  });
  const length = spans.length ? Math.max(spans.at(-1)![1], made.audio.length / RATE / plan.play) : made.audio.length / RATE / plan.play;
  if ("robot" in v && v.robot) robotise(c, gain, c.destination, at, at + length + 0.1);
  else if ("hushed" in v && v.hushed) {
    // breathier: the low end taken off
    const thin = c.createBiquadFilter();
    thin.type = "highpass";
    thin.frequency.value = 700;
    gain.connect(thin).connect(c.destination);
  } else gain.connect(c.destination);
  src.start(at);
  playing.add(src);
  spans.forEach(([a], i) => setTimeout(() => whenStarts?.(i), Math.max(0, (at + a - c.currentTime) * 1000)));
  src.onended = () => {
    playing.delete(src);
    ended?.();
  };
  playingUntil = at + length + 0.12;
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
export const speaking = (): boolean => !!synth?.speaking || (!!ctx && ctx.currentTime < playingUntil);

// A phrase, in its speaker's voice, after whatever's being said already.
// `whenStarts` is told as each run starts (to move their avatar, say).
export function speak(words: Spoken[], look: Pick<Look, "voice" | "tune">, whenStarts?: (run: Run) => void): void {
  if (!on || look.voice === "silent") return;
  if (ducked) {
    held.push({ words, look, whenStarts, at: Date.now() });
    if (held.length > MOST_WAITING) held.shift();
    return;
  }
  if (natural.state === "ready") return speakNaturally(words, look, whenStarts);
  // too far behind: start again from this one
  if (waiting >= MOST_WAITING) hush();
  if (!synth) return;
  speakOnDevice(words, look, whenStarts);
}

// In a natural voice: made by the model (in order, one phrase at a time),
// then played after what's playing. One the model can't make is said by the
// device instead.
// Too far behind (more than MOST_WAITING phrases made or playing), the
// oldest not yet playing is let go rather than everything.
type Pending = { gen: number; dropped: boolean };
const pending: Pending[] = [];
function speakNaturally(words: Spoken[], look: Pick<Look, "voice" | "tune">, whenStarts?: (run: Run) => void): void {
  const plan = naturalPlan(words, look);
  if (!plan) return;
  const mine: Pending = { gen: naturalGen, dropped: false };
  pending.push(mine);
  const waitingNow = pending.filter((p) => !p.dropped);
  if (waitingNow.length > MOST_WAITING) waitingNow[0].dropped = true;
  waiting++;
  const gen = naturalGen;
  const said: Said = { words: plan.words.flatMap(wordsOf), until: Infinity };
  void generate({ words: plan.words, voice: voiceOf(look.voice).kokoro || "af_heart", speed: plan.speed }).then((made) => {
    pending.splice(pending.indexOf(mine), 1);
    if (gen !== naturalGen || mine.dropped) return void (waiting = Math.max(0, waiting - 1));
    if (!made) {
      waiting = Math.max(0, waiting - 1);
      if (synth) speakOnDevice(words, look, whenStarts);
      return;
    }
    keep(said);
    play(
      plan,
      made,
      look,
      (i) => whenStarts?.({ text: plan.words[i], pitch: plan.play * plan.shapes[i].rate, rate: plan.speed * plan.play * plan.shapes[i].rate, volume: plan.volume * plan.shapes[i].gain }),
      () => {
        waiting = Math.max(0, waiting - 1);
        said.until = Date.now();
      },
    );
  });
}

function speakOnDevice(words: Spoken[], look: Pick<Look, "voice" | "tune">, whenStarts?: (run: Run) => void): void {
  if (!synth) return;
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
  if (!synth && natural.state !== "ready") return;
  void audio()?.resume();
  hush();
  const was = on;
  on = true;
  ducked = false;
  speak(words, look.voice === "silent" ? { ...look, voice: "warm" } : look);
  on = was;
}
