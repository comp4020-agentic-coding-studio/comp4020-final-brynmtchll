// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live and lets people speak.
import { measure } from "./prosody.ts";
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

// An audio worklet that hands the raw samples back in batches. It's tiny, so
// it travels as a string rather than as another file to serve.
const TAP = URL.createObjectURL(
  new Blob(
    [
      `registerProcessor("tap", class extends AudioWorkletProcessor {
        constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
        process([input]) {
          const ch = input[0];
          if (ch) for (let i = 0; i < ch.length; i++) {
            this.buf[this.n++] = ch[i];
            if (this.n === this.buf.length) { this.port.postMessage(this.buf); this.buf = new Float32Array(2048); this.n = 0; }
          }
          return true;
        }
      });`,
    ],
    { type: "text/javascript" },
  ),
);

type Recording = { stop: () => Promise<Float32Array<ArrayBuffer>> };

// Records the microphone as raw samples. The browser's automatic gain and
// noise suppression are turned off: gain control flattens loudness, which is
// half of what this app is trying to hear.
async function record(onLevel: (level: number) => void): Promise<Recording> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(TAP);
  const source = ctx.createMediaStreamSource(mic);
  const tap = new AudioWorkletNode(ctx, "tap");
  const parts: Float32Array[] = [];
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    parts.push(e.data);
    let sum = 0;
    for (const s of e.data) sum += s * s;
    onLevel(Math.min(1, Math.sqrt(sum / e.data.length) * 8));
  };
  source.connect(tap);
  tap.connect(ctx.destination); // the tap outputs silence; this just keeps it running

  return {
    async stop() {
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

async function resample(samples: Float32Array<ArrayBuffer>, from: number): Promise<Float32Array<ArrayBuffer>> {
  if (samples.length === 0) return samples;
  if (from === RATE) return samples;
  const offline = new OfflineAudioContext(1, Math.ceil((samples.length * RATE) / from), RATE);
  const buffer = offline.createBuffer(1, samples.length, from);
  buffer.copyToChannel(samples, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}

// what Whisper heard, as words with how each was said
function toWords(pcm: Float32Array, chunks: Chunk[]): Word[] {
  const seconds = pcm.length / RATE;
  const timed = chunks
    .map((c) => ({ w: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? seconds }))
    .filter((c) => c.w.length > 0);
  return measure(pcm, RATE, timed);
}

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
  whisper(); // start the download now, so it overlaps with talking
  try {
    recording = await record((level) => talk!.style.setProperty("--level", level.toFixed(2)));
  } catch (err) {
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
