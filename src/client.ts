// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live, plays each phrase in its
// speaker's spot, and, while someone's microphone is on, hears them a phrase
// at a time and sends each phrase as it's heard.
import { phraser, type Phraser } from "./phrases.ts";
import { hear, spoke, words, type Heard } from "./prosody.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

const stage = document.getElementById("stage") as HTMLUListElement;
const nobody = document.getElementById("nobody") as HTMLElement;
const live = document.getElementById("live") as HTMLElement;
const heardAloud = document.getElementById("heard") as HTMLElement;

// ---- the stage: each person's words, one at a time, in their spot ----

type StageWord = { html: string; t: number; d: number; gap: number };
type Phrase = { id: number; name: string; hue: number; x: number; y: number; text: string; at: number; words: StageWord[] };

// Each word appears when it was said, but stays up at least SHORTEST_WORD so
// it can be read: fast speech has words a tenth of a second long, gone before
// anyone sees them. Running behind like that is made up in the pauses. A long
// pause is shortened so nobody waits on it; the last word stays up for
// LINGER after it's said, then fades. A phrase that arrives while the last
// one is still playing waits its turn, so nobody's words overlap themselves.
const SHORTEST_WORD = 0.25;
const LONGEST_PAUSE = 1.5;
const LINGER = 2;
const still = matchMedia("(prefers-reduced-motion: reduce)");

type Spot = { el: HTMLElement; word: HTMLElement; queue: Phrase[]; playing: boolean; timers: number[] };
const spots = new Map<string, Spot>();

// someone who joined after the page loaded gets their spot when they first speak
function spotFor(p: Pick<Phrase, "name" | "hue" | "x" | "y">): Spot {
  const known = spots.get(p.name);
  if (known) return known;
  let el = stage.querySelector<HTMLElement>(`.spot[data-name="${CSS.escape(p.name)}"]`);
  if (!el) {
    el = document.createElement("li");
    el.className = "spot";
    el.dataset.name = p.name;
    el.style.setProperty("--hue", String(p.hue));
    el.style.setProperty("--x", String(p.x));
    el.style.setProperty("--y", String(p.y));
    const word = document.createElement("span");
    word.className = "spot-word";
    word.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "spot-name";
    label.textContent = p.name;
    el.append(word, label);
    stage.append(el);
    nobody.hidden = true;
  }
  const spot: Spot = { el, word: el.querySelector(".spot-word")!, queue: [], playing: false, timers: [] };
  spots.set(p.name, spot);
  return spot;
}
for (const el of stage.querySelectorAll<HTMLElement>(".spot")) spotFor({ name: el.dataset.name!, hue: 0, x: 0, y: 0 });

function play(spot: Spot): void {
  const phrase = spot.queue.shift();
  if (!phrase) {
    spot.playing = false;
    spot.el.classList.remove("speaking");
    return;
  }
  spot.playing = true;
  spot.el.classList.add("speaking");
  const later = (at: number, fn: () => void): void => void spot.timers.push(window.setTimeout(fn, at * 1000));
  const show = (html: string): void => {
    spot.word.classList.remove("fading");
    spot.word.innerHTML = html;
  };
  // someone who has asked for less motion sees the phrase's last word only
  if (still.matches) {
    show(phrase.words.at(-1)?.html ?? "");
  } else {
    // `at` is when each word goes up on the page; `due` is when it was said,
    // pauses shortened. A word goes up when it was said or once the last has
    // had its SHORTEST_WORD, whichever is later.
    let at = 0;
    let due = 0;
    phrase.words.forEach((w, i) => {
      at = Math.max(at, due);
      later(at, () => show(w.html));
      at += SHORTEST_WORD;
      due += i + 1 < phrase.words.length ? w.d + Math.min(Math.max(0, w.gap), LONGEST_PAUSE) : w.d;
    });
    at = Math.max(at, due);
    // the next phrase, if one's waiting, carries straight on; if not, the last
    // word lingers and goes
    later(at, () => {
      if (spot.queue.length) return play(spot);
      later(LINGER, () => {
        if (spot.queue.length) return play(spot);
        spot.word.classList.add("fading");
        play(spot);
      });
    });
    return;
  }
  later(LINGER, () => {
    spot.word.classList.add("fading");
    play(spot);
  });
}

// A screen reader hears each phrase whole, with who said it, rather than a
// word at a time from the stage.
function arrive(p: Phrase): void {
  heardAloud.textContent = `${p.name}: ${p.text}`;
  const spot = spotFor(p);
  spot.queue.push(p);
  if (!spot.playing) play(spot);
}

// ---- live: every phrase, as it's said ----

// Each phrase arrives with what the stage needs to play it. A page plays
// what's said from when it opened: words are for the moment they're said,
// not for catching up on. If the stream drops, it picks up from the last
// phrase it had, so a moment's lost connection doesn't lose a phrase.
//
// The browser reconnects a dropped stream on its own, but gives up for good
// if the server answers with an error (a deploy, a restart, a full room), so
// the page then opens a new one itself, waiting longer each time.
let lastSeen: number | "now" = "now";
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
    showLive(false, "Reconnecting…");
    if (stream.readyState !== EventSource.CLOSED) return;
    setTimeout(connect, wait);
    wait = Math.min(wait * 2, 30_000);
  });
  stream.addEventListener("joined", (e) => {
    spotFor(JSON.parse((e as MessageEvent<string>).data) as Pick<Phrase, "name" | "hue" | "x" | "y">);
  });
  stream.addEventListener("said", (e) => {
    const p = JSON.parse((e as MessageEvent<string>).data) as Phrase;
    if (typeof lastSeen === "number" && p.id <= lastSeen) return;
    lastSeen = p.id;
    arrive(p);
  });
}
connect();

// ---- speaking: only for someone who has joined ----

const RATE = 16_000; // what Whisper listens at

const talk = document.getElementById("talk") as HTMLButtonElement | null;
const status = document.getElementById("status") as HTMLElement;
const say = (text: string): void => {
  status.textContent = text;
};
const mb = (bytes: number): string => (bytes / 1e6).toFixed(0);

// The worker holds Whisper. It's only started once someone first turns their
// microphone on, so people who only read never download the model.
let worker: Worker | undefined;
let modelReady = false;
let waiting: { resolve: (chunks: Heard[]) => void; reject: (e: Error) => void }[] = [];

function whisper(): Worker {
  if (worker) return worker;
  worker = new Worker("/js/worker.ts", { type: "module" });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === "loading" && !modelReady && m.total > 0) {
      say(`Downloading the speech model, once: ${mb(m.loaded)} of ${mb(m.total)} MB. Keep talking; it'll catch up.`);
    } else if (m.type === "ready") {
      modelReady = true;
      showBehind();
    } else if (m.type === "heard") {
      modelReady = true;
      waiting.shift()?.resolve(m.chunks);
    } else if (m.type === "failed") {
      waiting.shift()?.reject(new Error(m.error));
    }
  };
  // The worker couldn't even start: its import from the CDN failed (a flaky
  // connection, a blocked CDN) or the browser can't run module workers. It's
  // thrown away so the next try starts a fresh one.
  worker.onerror = (e) => {
    e.preventDefault();
    worker?.terminate();
    worker = undefined;
    for (const w of waiting) w.reject(new Error(e.message || "the speech model's worker didn't start"));
    waiting = [];
  };
  worker.postMessage({ type: "load" } satisfies ToWorker);
  return worker;
}

// The worker answers in the order it was asked, so answers are matched to
// questions in order.
function transcribe(pcm: Float32Array): Promise<Heard[]> {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    whisper().postMessage({ type: "transcribe", pcm } satisfies ToWorker, [pcm.buffer]);
  });
}

// Whisper listens at 16 kHz and microphones record at 44.1 or 48. Each batch
// of samples is averaged down as it comes, so a phrase is ready the moment
// it ends; averaging also keeps sounds too high for 16 kHz from folding down
// into the speech.
function downsampler(from: number): (input: Float32Array) => Float32Array {
  const ratio = from / RATE;
  let carry = 0; // where the next output sample starts, in input samples, relative to this batch
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

type FromTap = { samples: Float32Array } | { last: Float32Array };

// While the microphone is on, phrases.ts cuts what's said into phrases, and
// each goes off to be heard and sent in the order it was said. How many are
// still waiting shows when a slow phone falls behind someone talking.
let on = false;
let stopRecording: (() => Promise<void>) | undefined;
let phrases: Phraser = phraser();
let sending: Promise<void> = Promise.resolve();
let behind = 0;

const showBehind = (): void => {
  if (!on) return;
  say(!modelReady ? "Listening. The speech model is downloading, once." : behind > 1 ? `Listening. Catching up on ${behind} phrases…` : "Listening.");
};

function onAudio(samples: Float32Array): void {
  for (const phrase of phrases.push(samples)) send(phrase);
  talk!.style.setProperty("--level", phrases.level().toFixed(2));
}

// A phrase that's mostly a breath, a click or the room is never sent to
// Whisper, which would hear a sentence in it (spoke() says why).
function send(pcm: Float32Array): void {
  if (!spoke(pcm, RATE)) return;
  behind++;
  showBehind();
  const heard = transcribe(pcm.slice());
  sending = sending.then(async () => {
    try {
      const result = hear(pcm, RATE, words(await heard, pcm.length / RATE));
      if (result.words.length === 0) return;
      const res = await fetch("/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      });
      if (res.status === 401) {
        say("You've been signed out. Reload the page and join again.");
        void turnOff();
      } else if (res.status === 429) {
        say("That's a lot at once. Some of it didn't send.");
      } else if (!res.ok) {
        say("Something you said couldn't be sent.");
      }
    } catch (err) {
      console.error(err);
      say(modelReady ? "Something you said couldn't be heard or sent." : "Couldn't download the speech model. Check your connection and try again.");
    } finally {
      behind--;
      showBehind();
    }
  });
}

// Records the microphone through tap.ts. The browser's automatic gain and
// noise suppression are turned off: gain control flattens loudness, which is
// half of what this app is trying to hear. The audio context is made by the
// caller, inside the tap or click that started it, since phones only let
// sound start from one. If anything after the microphone opens fails, the
// microphone is let go again before the error goes on.
async function record(ctx: AudioContext): Promise<() => Promise<void>> {
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
  const down = downsampler(ctx.sampleRate);
  let flushed: (() => void) | undefined;
  tap.port.onmessage = (e: MessageEvent<FromTap>) => {
    if ("last" in e.data) {
      if (e.data.last.length) onAudio(down(e.data.last));
      return flushed?.();
    }
    onAudio(down(e.data.samples));
  };
  source.connect(tap);
  tap.connect(ctx.destination); // the tap outputs silence; this just keeps it running
  return async () => {
    // the last partial batch, but don't wait long for it
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

function showOn(state: boolean): void {
  talk!.disabled = false;
  talk!.textContent = state ? "Turn off microphone" : "Turn on microphone";
  talk!.setAttribute("aria-pressed", String(state));
  talk!.classList.toggle("recording", state);
}

async function turnOn(): Promise<void> {
  if (on || stopRecording) return;
  talk!.disabled = true;
  // made before anything is awaited, while this still counts as the tap
  const ctx = new AudioContext();
  void ctx.resume();
  whisper(); // start the download now, so it overlaps with talking
  try {
    stopRecording = await record(ctx);
  } catch (err) {
    void ctx.close();
    const blocked = err instanceof DOMException && err.name === "NotAllowedError";
    say(
      blocked
        ? "The microphone is blocked. Allow it for this site in your browser's settings, then try again."
        : "Couldn't open a microphone in this browser.",
    );
    talk!.disabled = false;
    return;
  }
  on = true;
  phrases = phraser();
  showOn(true);
  showBehind();
}

async function turnOff(): Promise<void> {
  if (!on || !stopRecording) return;
  on = false;
  talk!.disabled = true;
  const stop = stopRecording;
  stopRecording = undefined;
  await stop();
  for (const phrase of phrases.end()) send(phrase); // whatever was said last
  showOn(false);
  say(behind ? "Sending the last of it…" : "");
  void sending.then(() => {
    if (!on) say("");
  });
}

if (talk) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    say("This browser can't record here. You can still watch and read everything live.");
  } else {
    showOn(false);
    say("The first time, the speech model downloads (about 80 MB). After that it's cached.");
    talk.addEventListener("click", () => void (on ? turnOff() : turnOn()));
  }
}
