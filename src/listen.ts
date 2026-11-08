// Hearing someone through their microphone, a phrase at a time, for a page
// that wants it (space.ts; the room's page, client.ts, has its own copy of
// the same steps, woven through its cards). Whisper runs in a worker in this
// browser; a phrase that's mostly silence, breath, the room or someone
// else's voice is never sent to it (prosody.ts, phrases.ts); what's heard
// goes out as words with how each was said, never as sound. A draft of a
// phrase still being said goes out as it's heard, for others to see faded.
import { phraser, type Phraser } from "./phrases.ts";
import { hear, invented, near, spoke, voiceLevel, words, type Heard } from "./prosody.ts";
import { duck, echoOf, speaking as voicesSpeaking } from "./speech.ts";
import type { Voice, Word } from "./voice.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

export type Hooks = {
  say: (text: string) => void; // ordinary news for the status line
  warn: (text: string) => void; // something gone wrong
  level: (level: number) => void; // how loud, 0 to 1, as it comes
  phrase: (words: Word[], voice: Voice | null, draft: number) => Promise<void>; // a phrase heard, to send
  early: (words: Word[], draft: number) => void; // a draft of one still being said
  dropped: (draft: number) => void; // a phrase that came to nothing
  on: (state: boolean) => void; // the microphone on or off
};

const RATE = 16_000; // what Whisper listens at
const MODEL_BYTES = 80e6;
const TRANSCRIBE_LIMIT = 60_000;
const EARLY_AFTER = 0.9; // seconds of sound in a phrase before a draft
const EARLY_EVERY = 900; // ms between drafts
const mb = (bytes: number): string => (bytes / 1e6).toFixed(0);

export function listener(h: Hooks) {
  let worker: Worker | undefined;
  let modelReady = false;
  let downloaded = "";
  const waiting = new Map<number, { resolve: (c: Heard[]) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let on = false;
  let stop: (() => Promise<void>) | undefined;
  let phrases: Phraser = phraser();
  let behind = 0;
  let hearing: Promise<void> = Promise.resolve();
  let draft = 1;
  let earlyAt = 0;
  let earlyBusy = false;
  let loudAt = 0;
  const usualLevels: number[] = [];

  const status = (): void => {
    if (!modelReady && downloaded) h.say(on ? `Listening. Downloading the speech model, once: ${downloaded}. Keep talking; it'll catch up.` : `Downloading the speech model, once: ${downloaded}.`);
    else if (on) h.say(!modelReady ? "Listening. The speech model is downloading, once." : behind > 1 ? `Listening. Catching up on ${behind} phrases…` : "Listening.");
  };
  const couldntLoad = (): void => {
    if (modelReady) return;
    downloaded = "";
    h.warn("Couldn't download the speech model. It'll try again when you talk.");
  };
  function whisper(): Worker {
    if (worker) return worker;
    worker = new Worker("/js/worker.ts", { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === "loading" && !modelReady && m.total > 1e6) {
        downloaded = `${mb(m.loaded)} of ${mb(Math.max(m.total, MODEL_BYTES))} MB`;
        status();
      } else if (m.type === "ready") {
        modelReady = true;
        if (on) status();
        else h.say("Ready. Talk, or type.");
      } else if (m.type === "heard") {
        modelReady = true;
        waiting.get(m.id)?.resolve(m.chunks);
        waiting.delete(m.id);
      } else if (m.type === "failed" && m.id !== null) {
        waiting.get(m.id)?.reject(new Error(m.error));
        waiting.delete(m.id);
      } else if (m.type === "failed") {
        for (const w of waiting.values()) w.reject(new Error(m.error));
        waiting.clear();
        couldntLoad();
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      worker?.terminate();
      worker = undefined;
      for (const w of waiting.values()) w.reject(new Error(e.message || "the speech model's worker didn't start"));
      waiting.clear();
      couldntLoad();
    };
    worker.postMessage({ type: "load" } satisfies ToWorker);
    return worker;
  }
  function transcribe(pcm: Float32Array): Promise<Heard[]> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!waiting.has(id)) return;
        waiting.delete(id);
        worker?.terminate();
        worker = undefined;
        for (const w of waiting.values()) w.reject(new Error("the speech model stopped answering"));
        waiting.clear();
        reject(new Error("the speech model stopped answering"));
      }, TRANSCRIBE_LIMIT);
      waiting.set(id, { resolve: (c) => (clearTimeout(timer), resolve(c)), reject: (e) => (clearTimeout(timer), reject(e)) });
      whisper().postMessage({ type: "transcribe", id, pcm } satisfies ToWorker, [pcm.buffer]);
    });
  }
  // averaged down to 16 kHz as it comes (or, from a slower microphone,
  // stretched up to it), so a phrase is ready the moment it ends
  function resampler(from: number): (input: Float32Array) => Float32Array {
    if (from >= RATE) {
      const ratio = from / RATE;
      let carry = 0;
      let sum = 0;
      let n = 0;
      return (input) => {
        const out: number[] = [];
        for (let i = 0; i < input.length; i++) {
          sum += input[i];
          n++;
          if (i + 1 >= carry + ratio) {
            out.push(sum / n);
            sum = 0;
            n = 0;
            carry += ratio;
          }
        }
        carry -= input.length;
        return Float32Array.from(out);
      };
    }
    const step = from / RATE;
    let pos = 0;
    let last = 0;
    return (input) => {
      const out: number[] = [];
      while (pos < input.length) {
        const i = Math.floor(pos) - 1;
        const a = i < 0 ? last : input[i];
        const b = input[i + 1];
        if (b === undefined) break;
        out.push(a + (b - a) * (pos - Math.floor(pos)));
        pos += step;
      }
      pos -= input.length;
      last = input[input.length - 1] ?? last;
      return Float32Array.from(out);
    };
  }
  const usualLevel = (): number | null => (usualLevels.length >= 2 ? [...usualLevels].sort((a, b) => a - b)[Math.floor(usualLevels.length / 2)] : null);
  const fromHere = (pcm: Float32Array): boolean => spoke(pcm, RATE) && near(voiceLevel(pcm, RATE), phrases.room(), usualLevel());
  function maybeEarly(): void {
    if (!modelReady || earlyBusy || behind > 0 || Date.now() - earlyAt < EARLY_EVERY) return;
    const { pcm, sound } = phrases.sofar();
    if (sound < EARLY_AFTER || !fromHere(pcm)) return;
    earlyBusy = true;
    earlyAt = Date.now();
    const forDraft = draft;
    transcribe(pcm.slice())
      .then((chunks) => {
        if (forDraft !== draft) return;
        const ws = hear(pcm, RATE, words(chunks, pcm.length / RATE)).words;
        if (ws.length && !invented(ws.map((w) => w.w).join(" "), true)) h.early(ws, forDraft);
      })
      .catch(() => {})
      .finally(() => (earlyBusy = false));
  }
  function send(pcm: Float32Array): void {
    const forDraft = draft++;
    earlyAt = Date.now();
    if (!fromHere(pcm)) return void h.dropped(forDraft);
    const level = voiceLevel(pcm, RATE);
    if (level !== null) {
      usualLevels.push(level);
      if (usualLevels.length > 8) usualLevels.shift();
    }
    behind++;
    status();
    const heard = transcribe(pcm.slice());
    hearing = hearing.then(async () => {
      try {
        const result = hear(pcm, RATE, words(await heard, pcm.length / RATE));
        const voiced = result.voice?.pitch != null && result.words.some((w) => w.pitch !== null);
        const text = result.words.map((w) => w.w).join(" ");
        if (result.words.length === 0 || invented(text, voiced) || echoOf(text)) return void h.dropped(forDraft);
        await h.phrase(result.words, result.voice, forDraft);
      } catch (err) {
        console.error(err);
        h.warn(modelReady ? "Something you said couldn't be heard." : "Couldn't download the speech model. Check your connection and try again.");
      } finally {
        behind--;
        status();
      }
    });
  }
  function onAudio(samples: Float32Array): void {
    for (const p of phrases.push(samples)) send(p);
    h.level(phrases.level());
    if (phrases.mouth() > 0.35 && !voicesSpeaking()) loudAt = Date.now();
    duck(Date.now() - loudAt < 900);
    maybeEarly();
  }
  // the microphone, through tap.ts, with the browser's gain control and
  // noise suppression off (gain control flattens loudness, which is half
  // of what's being heard)
  async function record(ctx: AudioContext): Promise<() => Promise<void>> {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    const release = (): void => mic.getTracks().forEach((t) => t.stop());
    let source: MediaStreamAudioSourceNode;
    let tap: AudioWorkletNode;
    try {
      await ctx.audioWorklet.addModule("/js/tap.ts");
      source = ctx.createMediaStreamSource(mic);
      tap = new AudioWorkletNode(ctx, "tap");
    } catch (err) {
      release();
      throw err;
    }
    for (const track of mic.getAudioTracks()) track.addEventListener("ended", () => on && void turnOff().then(() => h.warn("Your microphone stopped. Turn it on again to carry on.")));
    const down = resampler(ctx.sampleRate);
    let flushed: (() => void) | undefined;
    tap.port.onmessage = (e: MessageEvent<{ samples: Float32Array } | { last: Float32Array }>) => {
      if ("last" in e.data) {
        if (e.data.last.length) onAudio(down(e.data.last));
        return flushed?.();
      }
      onAudio(down(e.data.samples));
    };
    source.connect(tap);
    tap.connect(ctx.destination);
    return async () => {
      await new Promise<void>((done) => {
        flushed = done;
        tap.port.postMessage("flush");
        setTimeout(done, 300);
      });
      tap.port.onmessage = null;
      source.disconnect();
      tap.disconnect();
      release();
      await ctx.close();
    };
  }
  async function turnOn(): Promise<void> {
    if (on || stop) return;
    const ctx = new AudioContext(); // made inside the tap, as phones need
    void ctx.resume();
    whisper();
    try {
      stop = await record(ctx);
    } catch (err) {
      void ctx.close();
      h.warn(err instanceof DOMException && err.name === "NotAllowedError" ? "The microphone is blocked. Allow it for this site in your browser's settings." : "Couldn't open a microphone in this browser.");
      h.on(false);
      return;
    }
    on = true;
    phrases = phraser();
    h.on(true);
    status();
  }
  async function turnOff(): Promise<void> {
    if (!on || !stop) return;
    on = false;
    const s = stop;
    stop = undefined;
    await s();
    for (const p of phrases.end()) send(p);
    h.on(false);
    h.say(behind ? "Hearing the last of it…" : "");
    void hearing.then(() => !on && h.say(""));
  }
  const can = !!navigator.mediaDevices?.getUserMedia && !!window.AudioWorkletNode;
  return { can, toggle: () => void (on ? turnOff() : turnOn()), warm: () => void whisper(), isOn: () => on };
}
