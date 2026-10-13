// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live and lets people speak.
import { measure, words } from "./prosody.ts";
import { ago, renderWords, type Word } from "./voice.ts";
import type { Chunk, FromWorker, ToWorker } from "./worker.ts";

const list = document.getElementById("messages") as HTMLOListElement;
const empty = document.getElementById("empty") as HTMLElement;

// Every new message arrives as ready-made HTML, the same markup the server
// put in the page. The browser reconnects on its own if the stream drops,
// and the server replays whatever was said in between, so a message already
// on the page is skipped.
const stream = new EventSource("/events");
stream.addEventListener("said", (e) => {
  const { id, html } = JSON.parse((e as MessageEvent<string>).data) as { id: number; html: string };
  if (document.getElementById(`m${id}`)) return;
  list.insertAdjacentHTML("afterbegin", html);
  empty.hidden = true;
});

// "just now" goes stale, so the times keep counting
setInterval(() => {
  for (const t of document.querySelectorAll<HTMLTimeElement>("time[data-at]")) {
    t.textContent = ago(Number(t.dataset.at));
  }
}, 15_000);

// ---- speaking: only for someone who has joined ----

const RATE = 16_000; // what Whisper listens at
const MAX_SECONDS = 15;

const talk = document.getElementById("talk") as HTMLButtonElement | null;
const status = document.getElementById("status") as HTMLElement;
const preview = document.getElementById("preview") as HTMLElement;
const previewWords = document.getElementById("preview-words") as HTMLElement;
const sendButton = document.getElementById("send") as HTMLButtonElement;
const discardButton = document.getElementById("discard") as HTMLButtonElement;

const say = (text: string): void => {
  status.textContent = text;
};
const mb = (bytes: number): string => (bytes / 1e6).toFixed(0);

// The worker holds Whisper. It's only started once someone first presses
// talk, so people who only read never download the model.
let worker: Worker | undefined;
let modelReady = false;
let heard: ((chunks: Chunk[]) => void) | undefined;
let failed: ((error: Error) => void) | undefined;
let state: "idle" | "recording" | "working" | "preview" = "idle";

function whisper(): Worker {
  if (worker) return worker;
  worker = new Worker("/js/worker.ts", { type: "module" });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === "loading" && !modelReady && m.total > 0 && state !== "recording") {
      say(`Downloading the speech model, once: ${mb(m.loaded)} of ${mb(m.total)} MB`);
    } else if (m.type === "ready") {
      modelReady = true;
    } else if (m.type === "heard") {
      modelReady = true;
      heard?.(m.chunks);
    } else if (m.type === "failed") {
      failed?.(new Error(m.error));
    }
  };
  worker.postMessage({ type: "load" } satisfies ToWorker);
  return worker;
}

function transcribe(pcm: Float32Array): Promise<Chunk[]> {
  return new Promise((resolve, reject) => {
    heard = resolve;
    failed = reject;
    whisper().postMessage({ type: "transcribe", pcm } satisfies ToWorker, [pcm.buffer]);
  });
}

type Recording = { stop: () => Promise<Float32Array<ArrayBuffer>> };
type FromTap = { samples: Float32Array } | { last: Float32Array };

// Records the microphone as raw samples, through tap.ts. The browser's
// automatic gain and noise suppression are turned off: gain control flattens
// loudness, which is half of what this app is trying to hear. The audio
// context is made by the caller, inside the tap or click that started it,
// since phones only let sound start from one.
async function record(ctx: AudioContext, onLevel: (level: number) => void): Promise<Recording> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  await ctx.audioWorklet.addModule("/js/tap.ts");
  const source = ctx.createMediaStreamSource(mic);
  const tap = new AudioWorkletNode(ctx, "tap");
  const parts: Float32Array[] = [];
  let finished: (() => void) | undefined;
  tap.port.onmessage = (e: MessageEvent<FromTap>) => {
    if ("last" in e.data) {
      parts.push(e.data.last);
      return finished?.();
    }
    parts.push(e.data.samples);
    let sum = 0;
    for (const s of e.data.samples) sum += s * s;
    onLevel(Math.min(1, Math.sqrt(sum / e.data.samples.length) * 8));
  };
  source.connect(tap);
  tap.connect(ctx.destination); // the tap outputs silence; this just keeps it running

  return {
    async stop() {
      // ask for the last partial batch, but don't wait long for it
      await new Promise<void>((done) => {
        finished = done;
        tap.port.postMessage("flush");
        setTimeout(done, 300);
      });
      tap.port.onmessage = null;
      source.disconnect();
      tap.disconnect();
      for (const track of mic.getTracks()) track.stop();
      const rate = ctx.sampleRate;
      await ctx.close();
      const length = parts.reduce((n, p) => n + p.length, 0);
      const all = new Float32Array(length);
      let at = 0;
      for (const p of parts) {
        all.set(p, at);
        at += p.length;
      }
      return resample(all, rate);
    },
  };
}

// Whisper listens at 16 kHz and microphones record at 44.1 or 48. The
// browser's own resampler does it best, but some (older Safari) won't run an
// offline audio context that slow, so there's a plain one to fall back on.
async function resample(samples: Float32Array<ArrayBuffer>, from: number): Promise<Float32Array<ArrayBuffer>> {
  if (samples.length === 0 || from === RATE) return samples;
  try {
    const offline = new OfflineAudioContext(1, Math.ceil((samples.length * RATE) / from), RATE);
    const buffer = offline.createBuffer(1, samples.length, from);
    buffer.copyToChannel(samples, 0);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } catch {
    return resampleByHand(samples, from);
  }
}

// each output sample is the average of the input it spans, which also keeps
// sounds too high for 16 kHz from folding down into the speech
function resampleByHand(samples: Float32Array, from: number): Float32Array<ArrayBuffer> {
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(samples.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let k = a; k < b; k++) sum += samples[k];
    out[i] = sum / (b - a);
  }
  return out;
}

// what Whisper heard, as words with how each was said
const toWords = (pcm: Float32Array, chunks: Chunk[]): Word[] => measure(pcm, RATE, words(chunks, pcm.length / RATE));

let recording: Recording | undefined;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let pending: Word[] = [];

function idle(text = ""): void {
  state = "idle";
  talk!.disabled = false;
  talk!.textContent = "Start talking";
  talk!.classList.remove("recording");
  preview.hidden = true;
  say(text);
}

async function start(): Promise<void> {
  talk!.disabled = true;
  // made before anything is awaited, while this still counts as the tap
  const ctx = new AudioContext();
  void ctx.resume();
  whisper(); // start the download now, so it overlaps with talking
  try {
    recording = await record(ctx, (level) => talk!.style.setProperty("--level", level.toFixed(2)));
  } catch (err) {
    void ctx.close();
    const blocked = err instanceof DOMException && err.name === "NotAllowedError";
    return idle(
      blocked
        ? "The microphone is blocked. Allow it for this site in your browser's settings, then try again."
        : "Couldn't open a microphone in this browser.",
    );
  }
  state = "recording";
  talk!.disabled = false;
  talk!.textContent = "Stop";
  talk!.classList.add("recording");
  say(`Listening. Up to ${MAX_SECONDS} seconds.`);
  stopTimer = setTimeout(() => void stop(), MAX_SECONDS * 1000);
}

async function stop(): Promise<void> {
  if (state !== "recording" || !recording) return;
  clearTimeout(stopTimer);
  state = "working";
  talk!.disabled = true;
  talk!.textContent = "Working";
  talk!.classList.remove("recording");
  say(modelReady ? "Listening back…" : "Listening back, once the speech model has downloaded…");
  const pcm = await recording.stop();
  recording = undefined;
  const seconds = pcm.length / RATE;
  if (seconds < 0.3) return idle("That was too short to hear anything.");
  let chunks: Chunk[];
  try {
    chunks = await transcribe(pcm.slice());
  } catch (err) {
    console.error(err);
    return idle("Something went wrong listening back. Try again.");
  }
  pending = toWords(pcm, chunks);
  if (pending.length === 0) return idle("Didn't catch any words. Try again.");
  state = "preview";
  talk!.disabled = true;
  previewWords.innerHTML = renderWords(pending);
  preview.hidden = false;
  say("This is how it will look to everyone.");
  sendButton.focus();
}

async function send(): Promise<void> {
  sendButton.disabled = true;
  try {
    const res = await fetch("/say", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words: pending }),
    });
    if (res.status === 401) return idle("Join the room first.");
    if (res.status === 429) return idle("That's a lot at once. Try again in a few seconds.");
    if (!res.ok) return idle("That couldn't be sent. Try saying it again.");
    pending = [];
    idle("Sent.");
  } catch {
    idle("Couldn't reach the room. Check your connection and try again.");
  } finally {
    sendButton.disabled = false;
  }
}

if (talk) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    say("This browser can't record here. You can still read everything live.");
  } else {
    idle("The first time, the speech model downloads (about 90 MB). After that it's cached.");
    talk.addEventListener("click", () => void (state === "recording" ? stop() : start()));
    sendButton.addEventListener("click", () => void send());
    discardButton.addEventListener("click", () => idle());
  }
}
