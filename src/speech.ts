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
import { stretch } from "./kokoro-text.ts";

// what's needed of someone's look to say their words: their voice, its
// sliders, and any voice mixed into it
export type Voiced = Pick<Look, "voice" | "tune"> & { blend?: string };
import type { Build, FromKokoro, Phrase as KokoroPhrase, ToKokoro } from "./kokoro.ts";

// a word as it comes in a phrase: the word, and how it was said (dB louder
// than their usual, semitones higher, how drawn out), and any effect on it
// (and how far its pitch moved through it, semitones: a phrase's last word
// rising is a question asked, whether or not it was heard with a "?")
export type Spoken = { text: string; loud: number; pitch: number; stretch: number; rise?: number; effect?: string | null };

// how much of how it was said to put into how it's spoken: all of it is too
// much (a word said four semitones up, spoken a whole four up, sounds silly)
const PITCH_SHARE = 0.5;
const STANDS_OUT = { loud: 5, pitch: 3, stretch: 0.8 };
const RISES = 3; // semitones up through a last word: asked
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
// The device's best for a voice: one of its names, in its best-sounding
// form where there's more than one (macOS's Enhanced and Premium, Edge's
// Natural ones, which sound far more like people than the rest); then any of
// those better ones in its accent; then anything in its accent, or English.
const BETTER = /\b(Premium|Enhanced|Natural|Neural)\b/i;
const better = (x: SpeechSynthesisVoice): number => (BETTER.test(x.name) ? 1 : 0) + (x.localService ? 0 : 0.1);
export function bestVoice(v: { names: readonly string[]; lang: string }, all: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const best = (xs: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => xs.sort((a, b) => better(b) - better(a))[0] ?? null;
  for (const n of v.names) {
    const found = best(all.filter((x) => x.name === n || x.name.startsWith(`${n} `) || x.name.startsWith(`Microsoft ${n} Online`)));
    if (found) return found;
  }
  const accent = all.filter((x) => x.lang.replace("_", "-") === v.lang);
  return best(accent.filter((x) => BETTER.test(x.name))) ?? best(accent) ?? best(all.filter((x) => x.lang.startsWith("en"))) ?? null;
}
function deviceVoice(id: string): SpeechSynthesisVoice | null {
  if (!voices.length) load();
  if (chosen.has(id) && voices.length) return chosen.get(id)!;
  const found = bestVoice(voiceOf(id), voices);
  if (voices.length) chosen.set(id, found);
  return found;
}

// ---- how each run is spoken ----

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const tuned = (look: Pick<Look, "tune">, id: string): number => (look.tune as Record<string, number> | undefined)?.[id] ?? 0;

export type Run = { text: string; pitch: number; rate: number; volume: number };

// A phrase as runs, each with what the browser takes: pitch (0 to 2, 1 as
// the voice is), rate (1 as the voice is) and volume (0 to 1).
export function runsOf(words: Spoken[], look: Voiced): Run[] {
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
// faster), how loud; and for each word how it's moved from that: louder or
// quieter (gain), higher or lower (rate, a little: it hurries the word too),
// and drawn out (stretch: longer, at the same pitch, kokoro-text.ts).
export type Shape = { gain: number; rate: number; stretch: number };
export type NaturalPlan = { words: string[]; speed: number; play: number; volume: number; shapes: Shape[]; blend?: { voice: string; mix: number } };
// the model says well between about half and twice its own speed
const SPEED = { lo: 0.6, hi: 1.7 };
export function naturalPlan(words: Spoken[], look: Voiced): NaturalPlan | null {
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
    let longer = 1;
    if (w.loud >= STANDS_OUT.loud) [gain, r] = [Math.min(1.8, 1 + w.loud / 12), 1.03];
    else if (w.loud <= -STANDS_OUT.loud) gain = Math.max(0.45, 1 + w.loud / 16);
    if (Math.abs(w.pitch) >= STANDS_OUT.pitch) r *= 2 ** ((w.pitch * PITCH_SHARE) / 12);
    if (w.stretch >= STANDS_OUT.stretch) longer = 1 + w.stretch * 0.45;
    if (w.effect === "impact") [gain, longer] = [Math.max(gain, 1.6), longer * 1.1];
    if (w.effect === "whisper") gain = Math.min(gain, 0.45);
    if (w.effect === "spooky") [r, longer] = [r * 0.85, longer * 1.25];
    if (w.effect === "sparkle" || w.effect === "rainbow") r *= 1.08;
    return { gain: round2(gain), rate: round2(clamp(r, 0.8, 1.2)), stretch: round2(clamp(longer, 1, 2)) };
  });
  // the whole phrase as loud as its words on average, quieter for a hushed voice
  const volume = round2(hushed ? 0.6 : 0.8);
  // another voice mixed in, up to half and half (past that it's the other)
  const other = look.blend && look.blend !== "none" ? voiceOf(look.blend).kokoro : "";
  const mix = round2(((tuned(look, "voiceBlend") + 1) / 2) * 0.5);
  const blend = other && other !== v.kokoro && mix > 0 ? { voice: other, mix } : undefined;
  // how the phrase ends, for the model to read: rising, asked; loud, said with force
  const out = said.map((w) => w.text);
  const last = said.at(-1)!;
  if (!/[.!?…]["')\]]*$/.test(last.text)) {
    if ((last.rise ?? 0) >= RISES) out[out.length - 1] += "?";
    else if (last.loud >= STANDS_OUT.loud * 1.4) out[out.length - 1] += "!";
  }
  return { words: out, speed: round2(speed), play: round2(play), volume, shapes, ...(blend ? { blend } : {}) };
}
const round2 = (n: number): number => Math.round(n * 100) / 100;

// When each word starts in what's played, once each is played at its own
// rate: the spans (seconds in the sound) through the shapes.
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
// (not a phone's, though it may have one: a third of a gigabyte held in a
// phone's graphics memory is asking for the page to be shut, and a phone's
// download is often paid for)
let adapter: Promise<boolean> | undefined;
const phone = (): boolean => matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
export const gpuAdapter = (): Promise<boolean> =>
  (adapter ??= (async () => {
    if (phone()) return false;
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
  void gpuAdapter().then((gpu) => kokoro?.postMessage({ type: "load", build: fast && gpu ? "fast" : "small" } satisfies ToKokoro));
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
// The sound with each drawn-out word drawn out, and where each word is now.
export function drawOut(made: Made, shapes: Shape[], rate = RATE): Made {
  if (!shapes.some((s) => s.stretch > 1)) return made;
  const parts: Float32Array[] = [];
  const spans: [number, number][] = [];
  let from = 0;
  let at = 0;
  made.spans.forEach(([a, b], i) => {
    const [s, e] = [Math.round(a * rate), Math.round(b * rate)];
    if (s > from) {
      parts.push(made.audio.subarray(from, s));
      at += s - from;
    }
    const word = stretch(made.audio.slice(s, e), rate, shapes[i]?.stretch ?? 1);
    parts.push(word);
    spans.push([at / rate, (at + word.length) / rate]);
    at += word.length;
    from = e;
  });
  if (from < made.audio.length) parts.push(made.audio.subarray(from));
  const audio = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of parts) {
    audio.set(p, k);
    k += p.length;
  }
  return { audio, spans };
}
// How open a mouth saying it is (0 to 1), every MOUTH_EVERY while it plays:
// how loud each moment is against the loudest of the phrase.
const MOUTH_EVERY = 43; // ms, as a microphone's batches (head3d.ts)
function mouthOf(c: AudioContext, from: AudioNode, at: number, length: number, told: (level: number) => void): void {
  const ear = c.createAnalyser();
  ear.fftSize = 1024;
  from.connect(ear);
  const buf = new Float32Array(ear.fftSize);
  let peak = -30;
  const tick = (): void => {
    if (c.currentTime > at + length + 0.1) {
      told(0);
      return void from.disconnect(ear);
    }
    if (c.currentTime >= at) {
      ear.getFloatTimeDomainData(buf);
      let e = 0;
      for (const x of buf) e += x * x;
      const db = 10 * Math.log10(e / buf.length + 1e-12);
      peak = Math.max(peak, db);
      told(Math.min(1, Math.max(0, (db - (peak - 30)) / 26)));
    }
    setTimeout(tick, MOUTH_EVERY);
  };
  setTimeout(tick, Math.max(0, (at - c.currentTime) * 1000));
}
function play(plan: NaturalPlan, sound: Made, look: Pick<Look, "voice">, whenStarts?: (i: number) => void, ended?: () => void, mouth?: (level: number) => void): void {
  const c = audio();
  if (!c || !sound.audio.length) return ended?.();
  const made = drawOut(sound, plan.shapes);
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
    thin.frequency.value = 400;
    gain.connect(thin).connect(c.destination);
  } else gain.connect(c.destination);
  src.start(at);
  playing.add(src);
  if (mouth) mouthOf(c, gain, at, length, mouth);
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
type Waiting = { words: Spoken[]; look: Voiced; whenStarts?: (run: Run) => void; mouth?: (level: number) => void; at: number };
const held: Waiting[] = [];
const HELD_FOR = 20_000; // ms: held longer than this, it's not news any more
export function duck(yes: boolean): void {
  clearTimeout(duckTimer);
  if (yes) duckTimer = setTimeout(() => duck(false), DUCK_FOR) as unknown as number;
  if (ducked === yes) return;
  ducked = yes;
  if (!yes) for (const w of held.splice(0)) if (Date.now() - w.at < HELD_FOR) speak(w.words, w.look, w.whenStarts, w.mouth);
}
// whether it's saying something now (so a microphone hearing it isn't taken
// for the listener talking)
export const speaking = (): boolean => !!synth?.speaking || (!!ctx && ctx.currentTime < playingUntil);

// A phrase, in its speaker's voice, after whatever's being said already.
// `whenStarts` is told as each run starts, and, said in a natural voice,
// `mouth` how open a mouth saying it would be as it plays (to move their
// avatar's with it).
export function speak(words: Spoken[], look: Voiced, whenStarts?: (run: Run) => void, mouth?: (level: number) => void): void {
  if (!on || look.voice === "silent") return;
  if (ducked) {
    held.push({ words, look, whenStarts, mouth, at: Date.now() });
    if (held.length > MOST_WAITING) held.shift();
    return;
  }
  if (natural.state === "ready") return speakNaturally(words, look, whenStarts, mouth);
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
function speakNaturally(words: Spoken[], look: Voiced, whenStarts?: (run: Run) => void, mouth?: (level: number) => void): void {
  const plan = naturalPlan(words, look);
  if (!plan) return;
  const mine: Pending = { gen: naturalGen, dropped: false };
  pending.push(mine);
  const waitingNow = pending.filter((p) => !p.dropped);
  if (waitingNow.length > MOST_WAITING) waitingNow[0].dropped = true;
  waiting++;
  const gen = naturalGen;
  const said: Said = { words: plan.words.flatMap(wordsOf), until: Infinity };
  void generate({ words: plan.words, voice: voiceOf(look.voice).kokoro || "af_heart", speed: plan.speed, ...(plan.blend ? { blend: plan.blend } : {}) }).then((made) => {
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
      mouth,
    );
  });
}

function speakOnDevice(words: Spoken[], look: Voiced, whenStarts?: (run: Run) => void): void {
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
export function tryVoice(look: Voiced, words: Spoken[]): void {
  if (!synth && natural.state !== "ready") return;
  void audio()?.resume();
  hush();
  const was = on;
  on = true;
  ducked = false;
  speak(words, look.voice === "silent" ? { ...look, voice: "warm" } : look);
  on = was;
}
