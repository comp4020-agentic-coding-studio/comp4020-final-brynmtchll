// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live, plays each phrase in its
// speaker's spot, and, while someone's microphone is on, hears them a phrase
// at a time and sends each phrase as it's heard.
import { faceReader, type Face } from "./face.ts";
import { phraser, type Phraser } from "./phrases.ts";
import { hear, spoke, words, type Heard } from "./prosody.ts";
import { queue as wordQueue } from "./queue.ts";
import { ago, wordHtml, type Voice, type Word } from "./voice.ts";
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
// A phrase that's waited longer than STALE to be played is skipped: a tab in
// the background (where browsers slow timers to a crawl) or a reconnect that
// catches up on many phrases would otherwise play minutes of old words.
const STALE = 15_000; // ms
const still = matchMedia("(prefers-reduced-motion: reduce)");

// A spot is "playing" while a phrase's words are going up, "lingering" while
// its last word stays, and idle otherwise. A phrase that arrives while it
// lingers starts at once, rather than waiting the linger out.
type Spot = { el: HTMLElement; word: HTMLElement; queue: (Phrase & { arrived: number })[]; state: "idle" | "playing" | "lingering"; timers: number[] };
const spots = new Map<string, Spot>();

// Someone who joined after the page loaded gets their place when they join.
// Past MOST_SPOTS, the one who's been quiet longest gives theirs up, so a
// page never fills with names.
const MOST_SPOTS = 24;
function spotFor(p: Pick<Phrase, "name" | "hue" | "x" | "y">): Spot {
  const known = spots.get(p.name);
  if (known) {
    // most recently heard from last, so the quietest is first to go
    spots.delete(p.name);
    spots.set(p.name, known);
    return known;
  }
  let el = stage.querySelector<HTMLElement>(`.spot[data-name="${CSS.escape(p.name)}"]`);
  if (!el) {
    // the quietest idle place that isn't this page's own person's
    for (const [name, spot] of spots) {
      if (spots.size < MOST_SPOTS) break;
      if (spot.state !== "idle" || spot.el.classList.contains("mine")) continue;
      spot.el.remove();
      spots.delete(name);
    }
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
  const spot: Spot = { el, word: el.querySelector(".spot-word")!, queue: [], state: "idle", timers: [] };
  spots.set(p.name, spot);
  return spot;
}
for (const el of stage.querySelectorAll<HTMLElement>(".spot")) spotFor({ name: el.dataset.name!, hue: 0, x: 0, y: 0 });

function play(spot: Spot): void {
  for (const t of spot.timers) clearTimeout(t);
  spot.timers = [];
  while (spot.queue.length && Date.now() - spot.queue[0].arrived > STALE) spot.queue.shift();
  const phrase = spot.queue.shift();
  if (!phrase) {
    spot.state = "idle";
    spot.el.classList.remove("speaking");
    return;
  }
  spot.state = "playing";
  spot.el.classList.add("speaking");
  const later = (at: number, fn: () => void): void => void spot.timers.push(window.setTimeout(fn, at * 1000));
  const show = (html: string): void => {
    spot.word.classList.remove("fading");
    spot.word.innerHTML = html;
  };
  // `at` is when each word goes up on the page; `due` is when it was said,
  // pauses shortened. A word goes up when it was said or once the last has
  // had its SHORTEST_WORD, whichever is later. Someone who has asked for less
  // motion sees the phrase's last word only.
  let at = 0;
  if (still.matches) {
    show(phrase.words.at(-1)?.html ?? "");
  } else {
    let due = 0;
    phrase.words.forEach((w, i) => {
      at = Math.max(at, due);
      later(at, () => show(w.html));
      at += SHORTEST_WORD;
      due += i + 1 < phrase.words.length ? w.d + Math.min(Math.max(0, w.gap), LONGEST_PAUSE) : w.d;
    });
    at = Math.max(at, due);
  }
  // then the next phrase, if one's waiting; if not, the last word lingers
  // and goes
  later(at, () => {
    if (spot.queue.length) return play(spot);
    spot.state = "lingering";
    later(LINGER, () => {
      spot.word.classList.add("fading");
      play(spot);
    });
  });
}

// A screen reader hears each phrase whole, with who said it, rather than a
// word at a time from the stage.
// The brief record: a word joins its speaker's last line if they were the
// last to speak and haven't paused long; otherwise it starts a new line.
// Only the last RECORD_LINES are kept.
const lately = document.getElementById("record") as HTMLOListElement;
const recordEmpty = document.getElementById("record-empty") as HTMLElement;
const RECORD_LINES = 12;
const LINE_BREAK = 8_000;
function remember(p: Phrase): void {
  const last = lately.lastElementChild as HTMLElement | null;
  if (last && last.dataset.name === p.name && p.at - Number(last.dataset.until) < LINE_BREAK) {
    last.querySelector(".said-text")!.append(` ${p.text}`);
    last.dataset.until = String(p.at);
  } else {
    const li = document.createElement("li");
    li.dataset.name = p.name;
    li.dataset.until = String(p.at);
    li.style.setProperty("--hue", String(p.hue));
    const who = document.createElement("strong");
    const face = stage.querySelector(`.spot[data-name="${CSS.escape(p.name)}"] .spot-face`)?.textContent;
    who.textContent = face ? `${face} ${p.name}` : p.name;
    const text = document.createElement("span");
    text.className = "said-text";
    text.textContent = p.text;
    const when = document.createElement("time");
    when.dataset.at = String(p.at);
    when.textContent = "just now";
    li.append(who, " ", text, " ", when);
    lately.append(li);
    while (lately.children.length > RECORD_LINES) lately.firstElementChild!.remove();
  }
  recordEmpty.hidden = true;
}
setInterval(() => {
  for (const t of lately.querySelectorAll<HTMLTimeElement>("time[data-at]")) t.textContent = ago(Number(t.dataset.at));
}, 15_000);

function arrive(p: Phrase): void {
  remember(p);
  heardAloud.textContent = `${p.name}: ${p.text}`;
  const spot = spotFor(p);
  spot.queue.push({ ...p, arrived: Date.now() });
  if (spot.state !== "playing") play(spot);
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
  stream.addEventListener("face", (e) => {
    const { name, face } = JSON.parse((e as MessageEvent<string>).data) as { name: string; face: Face | null };
    const el = stage.querySelector(`.spot[data-name="${CSS.escape(name)}"] .spot-face`);
    if (el) {
      el.textContent = face ?? "";
      el.setAttribute("aria-label", face ? `${name}'s face` : "");
    }
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
// The status line. Something gone wrong stays up for a few seconds before
// ordinary news ("Listening.") can replace it, or it'd be gone before anyone
// read it.
let holdUntil = 0;
const say = (text: string): void => {
  if (Date.now() < holdUntil) return;
  status.textContent = text;
};
const warn = (text: string): void => {
  status.textContent = text;
  holdUntil = Date.now() + 6000;
};
const mb = (bytes: number): string => (bytes / 1e6).toFixed(0);

// The worker holds Whisper. It's only started once someone first turns their
// microphone on, so people who only read never download the model.
let worker: Worker | undefined;
let modelReady = false;
// what each transcription asked for is waiting on, by its id
const waiting = new Map<number, { resolve: (chunks: Heard[]) => void; reject: (e: Error) => void }>();
let nextId = 1;

function whisper(): Worker {
  if (worker) return worker;
  worker = new Worker("/js/worker.ts", { type: "module" });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === "loading" && !modelReady && m.total > 1e6) {
      downloaded = `${mb(m.loaded)} of ${mb(m.total)} MB`;
      showBehind();
    } else if (m.type === "ready") {
      modelReady = true;
      if (on) showBehind();
      else say("Ready. Turn your microphone on to talk.");
    } else if (m.type === "heard") {
      modelReady = true;
      waiting.get(m.id)?.resolve(m.chunks);
      waiting.delete(m.id);
    } else if (m.type === "failed" && m.id !== null) {
      waiting.get(m.id)?.reject(new Error(m.error));
      waiting.delete(m.id);
    } else if (m.type === "failed") {
      // the model itself didn't load: everything waiting on it fails
      for (const w of waiting.values()) w.reject(new Error(m.error));
      waiting.clear();
    }
  };
  // The worker couldn't even start: its import from the CDN failed (a flaky
  // connection, a blocked CDN) or the browser can't run module workers. It's
  // thrown away so the next try starts a fresh one.
  worker.onerror = (e) => {
    e.preventDefault();
    worker?.terminate();
    worker = undefined;
    for (const w of waiting.values()) w.reject(new Error(e.message || "the speech model's worker didn't start"));
    waiting.clear();
  };
  worker.postMessage({ type: "load" } satisfies ToWorker);
  return worker;
}

// Each transcription is matched to its answer by id. One that takes longer
// than TRANSCRIBE_LIMIT fails, so a phone that quietly kills the worker for
// its memory doesn't hold every later phrase back for good; the worker is
// started afresh for the next.
const TRANSCRIBE_LIMIT = 60_000;
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
    waiting.set(id, {
      resolve: (c) => (clearTimeout(timer), resolve(c)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    whisper().postMessage({ type: "transcribe", id, pcm } satisfies ToWorker, [pcm.buffer]);
  });
}

// Whisper listens at 16 kHz and microphones record at 44.1 or 48. Each batch
// of samples is averaged down as it comes, so a phrase is ready the moment
// it ends; averaging also keeps sounds too high for 16 kHz from folding down
// into the speech.
function downsampler(from: number): (input: Float32Array) => Float32Array {
  if (from < RATE) return upsampler(from);
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

// A microphone slower than 16 kHz (a Bluetooth headset on its hands-free
// link runs at 8) is stretched up to it by drawing straight lines between its
// samples; averaging down would hand Whisper half the samples, and speech at
// twice the speed.
function upsampler(from: number): (input: Float32Array) => Float32Array {
  const step = from / RATE; // input samples per output sample, under 1
  let pos = 0; // where the next output sample falls, in input samples, from the last one kept
  let last = 0; // the last input sample of the previous batch
  return (input) => {
    const out: number[] = [];
    // positions are measured from `last`, at -1, then this batch's 0, 1, ...
    while (pos < input.length - 1 + 1) {
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

type FromTap = { samples: Float32Array } | { last: Float32Array };

// While the microphone is on, phrases.ts cuts what's said into phrases, and
// each goes off to be heard and sent in the order it was said. How many are
// still waiting shows when a slow phone falls behind someone talking.
let on = false;
let stopRecording: (() => Promise<void>) | undefined;
let phrases: Phraser = phraser();
let behind = 0;

let downloaded = "";
const showBehind = (): void => {
  if (!modelReady && downloaded) {
    say(on ? `Listening. Downloading the speech model, once: ${downloaded}. Keep talking; it'll catch up.` : `Downloading the speech model, once: ${downloaded}.`);
  } else if (on) {
    say(!modelReady ? "Listening. The speech model is downloading, once." : behind > 1 ? `Listening. Catching up on ${behind} phrases…` : "Listening.");
  }
};

function onAudio(samples: Float32Array): void {
  for (const phrase of phrases.push(samples)) send(phrase);
  talk!.style.setProperty("--level", phrases.level().toFixed(2));
}

// A phrase that's mostly a breath, a click or the room is never sent to
// Whisper, which would hear a sentence in it (spoke() says why). What's heard
// goes into the speaker's queue, in the order it was said.
function send(pcm: Float32Array): void {
  if (!spoke(pcm, RATE)) return;
  behind++;
  showBehind();
  const heard = transcribe(pcm.slice());
  hearing = hearing.then(async () => {
    try {
      const result = hear(pcm, RATE, words(await heard, pcm.length / RATE));
      if (result.words.length === 0) return;
      // the phrase's voice goes with its first word, for the usual-voice
      // comparison; the words keep their own timing within it
      voiceFor.set(result.words[0], result.voice);
      mine.add(result.words, Date.now());
      showQueue();
    } catch (err) {
      console.error(err);
      warn(modelReady ? "Something you said couldn't be heard." : "Couldn't download the speech model. Check your connection and try again.");
    } finally {
      behind--;
      showBehind();
    }
  });
}

// ---- the queue: your words, before anyone else sees them ----

const queueEl = document.getElementById("queue") as HTMLElement | null;
const queueWords = document.getElementById("queue-words") as HTMLOListElement | null;
const mine = wordQueue();
// the queue is in your colour, as your place is
const myHue = stage.querySelector<HTMLElement>(".spot.mine")?.style.getPropertyValue("--hue");
if (queueEl && myHue) queueEl.style.setProperty("--hue", myHue);
const voiceFor = new WeakMap<Word, Voice | null>();
let hearing: Promise<void> = Promise.resolve(); // so phrases queue in order
let posting: Promise<void> = Promise.resolve(); // so words go out in order

// the page keeps room at its foot for the dock, however tall it is now
const dock = document.querySelector<HTMLElement>(".dock");
if (dock) new ResizeObserver(() => document.body.style.setProperty("--dock-h", `${dock.offsetHeight}px`)).observe(dock);

// What's waiting, top first: the top word as it'll look (or as it's being
// typed over), and a countdown to when it goes.
function showQueue(): void {
  if (!queueEl || !queueWords) return;
  const ws = mine.words();
  queueEl.hidden = ws.length === 0;
  const typing = mine.typing();
  queueWords.innerHTML = ws
    .map((w, i) => {
      const html = i === 0 && typing !== null ? `<span class="w typing">${typing.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}<span class="caret"></span></span>` : wordHtml(w);
      return `<li${i === 0 ? ` class="next"` : ""}>${html}</li>`;
    })
    .join("");
  const due = mine.due();
  queueWords.style.setProperty("--wait", due === null ? "0" : `${Math.max(0, due - Date.now())}ms`);
  queueWords.firstElementChild?.classList.toggle("held", typing !== null);
}

// Each word goes out on its own as it leaves the queue, in order: it plays in
// your place for everyone the moment it does.
function post(w: Word): void {
  const voice = voiceFor.get(w) ?? null;
  posting = posting.then(async () => {
    try {
      const res = await fetch("/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ words: [{ ...w, start: 0, end: w.end - w.start }], voice }),
        // a send that hangs mustn't hold up every word after it
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) {
        void turnOff();
        warn("You've been signed out. Reload the page and join again.");
      } else if (res.status === 429) {
        warn("That's a lot at once. Some of it didn't send.");
      } else if (!res.ok) {
        warn("A word couldn't be sent.");
      }
    } catch (err) {
      console.error(err);
      warn("A word couldn't be sent. Check your connection.");
    }
  });
}

// the queue's clock: words go out as they come due
setInterval(() => {
  let w: Word | null;
  let changed = false;
  while ((w = mine.release(Date.now()))) {
    post(w);
    changed = true;
  }
  if (changed) showQueue();
}, 100);

// While you have words waiting, the keyboard is theirs, except in a text box.
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest("input, textarea, [contenteditable]")) return;
  // Space and Enter on a focused button press the button, as they should
  if ((e.key === " " || e.key === "Enter") && t.closest("button")) return;
  if (mine.key(e.key, Date.now())) {
    e.preventDefault();
    showQueue();
  }
});
queueEl?.querySelector(".queue-tools")?.addEventListener("click", (e) => {
  const key = (e.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
  if (key && mine.key(key, Date.now())) showQueue();
});

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
  // The microphone can stop without anyone turning it off: the phone locks,
  // a call comes in, a headset drops out. Then the page says so rather than
  // go on saying "Listening." to nothing.
  for (const track of mic.getAudioTracks()) {
    track.addEventListener("ended", () => {
      if (!on) return;
      void turnOff().then(() => warn("Your microphone stopped. Turn it on again to carry on."));
    });
  }
  ctx.addEventListener("statechange", () => {
    if (on && (ctx.state as string) === "interrupted") warn("Your microphone's paused by your phone. It'll carry on when it can.");
  });
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
  say(behind ? "Hearing the last of it…" : "");
  void hearing.then(() => {
    if (!on) say("");
  });
}

if (talk) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    say("This browser can't record here. You can still watch and read everything live.");
  } else {
    showOn(false);
    talk.addEventListener("click", () => void (on ? turnOff() : turnOn()));
    // Someone who's joined is here to talk, so the speech model starts
    // downloading now rather than when they first press the button: the
    // first time, on a slow connection, that's the difference between
    // talking straight away and waiting most of a minute. It waits until the
    // page has loaded and settled, so it doesn't hold the page itself up.
    say("Getting the speech model ready (about 80 MB, once).");
    const warm = (): void => void setTimeout(() => whisper(), 500);
    if (document.readyState === "complete") warm();
    else addEventListener("load", warm, { once: true });
  }
}

// ---- your face, as an emoji: only for someone who has joined, only if they ask ----

// MediaPipe's face landmarker runs in this page on a small, hidden copy of
// the camera, a few times a second; face.ts turns its expression scores into
// an emoji. Only the emoji is sent, and only when it changes: no picture and
// no scores leave the browser. The model (about 4 MB) loads the first time
// someone turns it on.
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_EVERY = 125; // ms between readings

type Landmarker = {
  detectForVideo(video: HTMLVideoElement, at: number): { faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] };
  close(): void;
};

const faceButton = document.getElementById("face") as HTMLButtonElement | null;
let faceOn = false;
let stopFace: (() => void) | undefined;
let lastSentFace: Face | null | undefined;
let currentFace: Face | null = null;

async function sendFace(face: Face | null): Promise<void> {
  if (face === lastSentFace) return;
  lastSentFace = face;
  try {
    await fetch("/face", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ face }) });
  } catch {
    // a missed face is soon replaced by the next
  }
}

async function faceStart(): Promise<void> {
  faceButton!.disabled = true;
  let camera: MediaStream;
  try {
    camera = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
  } catch (err) {
    faceButton!.disabled = false;
    const blocked = err instanceof DOMException && err.name === "NotAllowedError";
    return warn(blocked ? "The camera is blocked. Allow it for this site to show your face as an emoji." : "Couldn't open a camera in this browser.");
  }
  say("Reading your face: only an emoji is sent, never a picture.");
  let landmarker: Landmarker;
  try {
    const { FaceLandmarker, FilesetResolver } = await import(`${VISION}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    landmarker = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_MODEL },
      runningMode: "VIDEO",
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  } catch (err) {
    console.error(err);
    for (const t of camera.getTracks()) t.stop();
    faceButton!.disabled = false;
    return warn("Couldn't load the face reader. Check your connection and try again.");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = camera;
  await video.play();
  const read = faceReader();
  const timer = setInterval(() => {
    if (document.hidden || video.readyState < 2) return;
    const shapes = landmarker.detectForVideo(video, performance.now()).faceBlendshapes?.[0]?.categories;
    const face = read(shapes ? Object.fromEntries(shapes.map((c) => [c.categoryName, c.score])) : {});
    if (face !== currentFace) {
      currentFace = face;
      const mine = stage.querySelector(".spot.mine .spot-face");
      if (mine) mine.textContent = face ?? "";
      void sendFace(face);
    }
  }, FACE_EVERY);
  stopFace = () => {
    clearInterval(timer);
    for (const t of camera.getTracks()) t.stop();
    landmarker.close();
    video.srcObject = null;
  };
  faceOn = true;
  faceButton!.disabled = false;
  faceButton!.setAttribute("aria-pressed", "true");
  faceButton!.textContent = "Stop showing my face";
}

function faceStop(): void {
  stopFace?.();
  stopFace = undefined;
  faceOn = false;
  currentFace = null;
  const mine = stage.querySelector(".spot.mine .spot-face");
  if (mine) mine.textContent = "";
  void sendFace(null);
  faceButton!.setAttribute("aria-pressed", "false");
  faceButton!.textContent = "Show my face as an emoji";
}

if (faceButton && "mediaDevices" in navigator) {
  faceButton.hidden = false;
  faceButton.addEventListener("click", () => void (faceOn ? faceStop() : faceStart()));
  // a face showing when you've left the page would be a lie
  addEventListener("pagehide", () => {
    if (faceOn) navigator.sendBeacon("/face", new Blob([JSON.stringify({ face: null })], { type: "application/json" }));
  });
}
