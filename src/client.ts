// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live, plays messages back at
// the pace they were said, and lets people speak.
import { hear, words, type Heard } from "./prosody.ts";
import { ago, renderWords, type Voice, type Word } from "./voice.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

const list = document.getElementById("messages") as HTMLOListElement;
const empty = document.getElementById("empty") as HTMLElement;
const live = document.getElementById("live") as HTMLElement;

// ---- playing a message back at the pace it was said ----

// Each word carries when it was said (data-t, data-d, in seconds into the
// clip). Playing a message hides every word, then shows each when it was
// said, and a drawn-out word's repeated letters one by one across its length.
// A long pause is shortened so nobody waits on one, and someone who has asked
// for less motion sees the message whole.
const LONGEST_PAUSE = 2;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const playing = new WeakMap<HTMLElement, number[]>();

function play(words: HTMLElement): void {
  for (const t of playing.get(words) ?? []) clearTimeout(t);
  const ws = [...words.querySelectorAll<HTMLElement>(".w")];
  if (still.matches || ws.length === 0) return;
  const timers: number[] = [];
  const later = (at: number, fn: () => void): void => void timers.push(window.setTimeout(fn, at * 1000));
  words.classList.add("playing");
  // when each word starts, with long pauses shortened
  let lost = 0;
  let lastEnd = Number(ws[0].dataset.t);
  for (const w of ws) {
    const t = Number(w.dataset.t);
    const d = Number(w.dataset.d);
    lost += Math.max(0, t - lastEnd - LONGEST_PAUSE);
    lastEnd = Math.max(lastEnd, t + d);
    const at = t - Number(ws[0].dataset.t) - lost;
    w.classList.add("unsaid");
    later(at, () => w.classList.remove("unsaid"));
    const held = w.querySelector(".held");
    if (held?.textContent) {
      // the repeats, a letter at a time across the word
      const letters = [...held.textContent];
      held.innerHTML = letters.map((c) => `<span class="unsaid">${c}</span>`).join("");
      letters.forEach((_, k) => later(at + (d * (k + 1)) / (letters.length + 1), () => held.children[k]?.classList.remove("unsaid")));
    }
  }
  later(lastEnd - Number(ws[0].dataset.t) - lost + 0.05, () => words.classList.remove("playing"));
  playing.set(words, timers);
}

// Replay buttons are in the server's markup, hidden, since they need this
// script; one handler serves every message, however it arrived.
function canReplay(root: ParentNode): void {
  if (still.matches) return;
  for (const b of root.querySelectorAll<HTMLButtonElement>(".replay")) b.hidden = false;
}
list.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest(".replay");
  const words = button?.closest(".said")?.querySelector<HTMLElement>(".words");
  if (words) play(words);
});
canReplay(list);

// ---- live: every new message, as it's said ----

// Every new message arrives as ready-made HTML, the same markup the server
// put in the page, and plays as it arrives. The stream starts from the newest
// message the page was drawn with, so anything said while the page loaded
// isn't lost; and a message already on the page is skipped.
//
// The browser reconnects a dropped stream on its own, but gives up for good
// if the server answers with an error (a deploy, a restart, a full room), so
// the page then opens a new one itself, waiting longer each time.
const newest = (): number => Number(list.querySelector(".said")?.id.slice(1) ?? 0);
let lastSeen = newest();
let wait = 1000;

const showLive = (on: boolean, text: string): void => {
  live.hidden = false;
  live.classList.toggle("on", on);
  live.textContent = text;
};

function connect(): void {
  const stream = new EventSource(`/events?after=${lastSeen}`);
  stream.addEventListener("open", () => {
    wait = 1000;
    showLive(true, "Live");
  });
  stream.addEventListener("error", () => {
    if (stream.readyState !== EventSource.CLOSED) return showLive(false, "Reconnecting…");
    showLive(false, "Reconnecting…");
    setTimeout(connect, wait);
    wait = Math.min(wait * 2, 30_000);
  });
  stream.addEventListener("said", (e) => {
    const { id, html } = JSON.parse((e as MessageEvent<string>).data) as { id: number; html: string };
    lastSeen = Math.max(lastSeen, id);
    if (document.getElementById(`m${id}`)) return;
    list.insertAdjacentHTML("afterbegin", html);
    empty.hidden = true;
    const added = list.firstElementChild as HTMLElement;
    canReplay(added);
    play(added.querySelector(".words")!);
  });
}
connect();

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
let heard: ((chunks: Heard[]) => void) | undefined;
let failed: ((error: Error) => void) | undefined;
let state: "idle" | "starting" | "recording" | "working" | "preview" | "sending" = "idle";

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
  // The worker couldn't even start: its import from the CDN failed (a flaky
  // connection, a blocked CDN) or the browser can't run module workers. It's
  // thrown away so the next try starts a fresh one.
  worker.onerror = (e) => {
    e.preventDefault();
    worker?.terminate();
    worker = undefined;
    failed?.(new Error(e.message || "the speech model's worker didn't start"));
  };
  worker.postMessage({ type: "load" } satisfies ToWorker);
  return worker;
}

function transcribe(pcm: Float32Array): Promise<Heard[]> {
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
// since phones only let sound start from one. If anything after the
// microphone opens fails, the microphone is let go again before the error goes
// on, so it doesn't stay on behind a message saying it couldn't start.
async function record(ctx: AudioContext, onLevel: (level: number) => void): Promise<Recording> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const release = (): void => {
    for (const track of mic.getTracks()) track.stop();
  };
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
      release();
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

let recording: Recording | undefined;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let pending: { words: Word[]; voice: Voice | null } | undefined;

function idle(text = ""): void {
  state = "idle";
  pending = undefined;
  talk!.disabled = false;
  talk!.textContent = "Start talking";
  talk!.classList.remove("recording");
  preview.hidden = true;
  say(text);
}

async function start(): Promise<void> {
  if (state !== "idle") return;
  state = "starting";
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
  if (pcm.length / RATE < 0.3) return idle("That was too short to hear anything.");
  let chunks: Heard[];
  try {
    chunks = await transcribe(pcm.slice());
  } catch (err) {
    console.error(err);
    return idle(
      modelReady
        ? "Something went wrong listening back. Try again."
        : "Couldn't download the speech model. Check your connection and try again.",
    );
  }
  const result = hear(pcm, RATE, words(chunks, pcm.length / RATE));
  if (result.words.length === 0) return idle("Didn't catch any words. Try again.");
  pending = result;
  state = "preview";
  talk!.disabled = true;
  previewWords.innerHTML = renderWords(result.words);
  preview.hidden = false;
  say("This is how it will look to everyone.");
  play(previewWords);
  sendButton.focus();
}

// A send that fails keeps the preview, so it can be sent again without saying
// it again; "Say it again" waits while a send is on its way, so an answer
// can't land after a new recording has started.
async function send(): Promise<void> {
  if (state !== "preview" || !pending) return;
  state = "sending";
  sendButton.disabled = true;
  discardButton.disabled = true;
  const keep = (text: string): void => {
    state = "preview";
    say(text);
  };
  try {
    const res = await fetch("/say", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pending),
    });
    if (res.status === 401) return idle("Join the room first.");
    if (res.status === 429) return keep("That's a lot at once. Send it again in a few seconds.");
    if (!res.ok) return keep("That couldn't be sent. Try sending it again.");
    idle("Sent.");
  } catch {
    keep("Couldn't reach the room. Check your connection and send it again.");
  } finally {
    sendButton.disabled = false;
    discardButton.disabled = false;
  }
}

if (talk) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    say("This browser can't record here. You can still read everything live.");
  } else {
    idle("The first time, the speech model downloads (about 80 MB). After that it's cached.");
    talk.addEventListener("click", () => void (state === "recording" ? stop() : start()));
    sendButton.addEventListener("click", () => void send());
    discardButton.addEventListener("click", () => {
      if (state === "preview") idle();
    });
  }
}
