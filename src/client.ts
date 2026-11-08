// The room page's script. The server renders the transcript so far, so the
// page reads fine without this; the script keeps it live (each phrase added
// to the transcript as it's said, a faded draft while someone's still
// talking), hears you a phrase at a time while your microphone is on and
// sends each as it's heard, sends what you type, reads typed messages aloud
// for anyone who's asked, and keeps the reader's own settings.
import { canNatural, canSpeak, duck, echoOf, gpuAdapter, hearVoices, naturalSize, naturalVoices, speak, speaking as voicesSpeaking, tryVoice, type Natural, type Spoken, type Voiced } from "./speech.ts";
import { toneOf, typedWords, type Tone } from "./typed.ts";
import { cleanReading, DEFAULT_READING, KEEPS, type Reading } from "./packs.ts";
import { phraser, type Phraser } from "./phrases.ts";
import { hear, invented, near, spoke, voiceLevel, words, type Heard } from "./prosody.ts";
import { esc, type Voice, type Word } from "./voice.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

const main = document.querySelector<HTMLElement>("main.room")!;
const transcript = document.getElementById("transcript") as HTMLOListElement;
const empty = document.getElementById("empty") as HTMLElement;
const drafts = document.getElementById("drafts") as HTMLUListElement;
const jump = document.getElementById("jump") as HTMLButtonElement;
const live = document.getElementById("live") as HTMLElement;
const myName = main.dataset.me ?? "";

// ---- small things kept in this browser ----

const recall = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // (a private window: it just isn't remembered)
  }
};

// ---- the transcript ----

type Line = { html: string; t: number; d: number; say?: [number, number, number, number?] };
type Phrase = { id: number; name: string; hue: number; text: string; at: number; words: Line[]; typed?: true; voice?: { voice: string; pitch: number; speed: number } };

// A run of one person's phrases, with nobody else between and no long gap,
// is one turn: one name, one time, their words flowing on. Same as the
// server draws it (view.ts turnsHtml).
const NEW_TURN = 20_000;
const NEW_LINE = 0.7;
const clock = (at: number): string => new Date(at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
const phraseHtml = (p: Pick<Phrase, "id" | "words" | "typed" | "at">): string =>
  `<span class="phrase${p.typed ? " typed" : ""}" data-id="${p.id}" data-at="${p.at}">${p.words.map((w, i) => `<span class="tw" data-i="${i}">${w.html}</span>${i + 1 < p.words.length && gapAfter(p.words, i) > NEW_LINE ? " <br>" : " "}`).join("")}</span>`;
const gapAfter = (ws: Line[], i: number): number => ws[i + 1].t - (ws[i].t + ws[i].d);
function turnFor(p: Phrase): HTMLElement {
  const last = transcript.lastElementChild as HTMLElement | null;
  const lastAt = Number(last?.dataset.until ?? last?.dataset.at ?? 0);
  if (last && last.dataset.name === p.name && p.at - lastAt < NEW_TURN) return last;
  const li = document.createElement("li");
  li.className = `turn${p.name === myName ? " mine" : ""}`;
  li.dataset.name = p.name;
  li.dataset.at = String(p.at);
  li.style.setProperty("--hue", String(p.hue));
  li.innerHTML = `<p class="turn-head"><span class="who">${esc(p.name)}</span><time datetime="${new Date(p.at).toISOString()}">${clock(p.at)}</time></p><p class="turn-words"></p>`;
  transcript.append(li);
  return li;
}

// Following along: the transcript stays at its newest while you're there; if
// you've scrolled up to read back, it leaves you be and offers a way down.
const scroller = (): HTMLElement => (document.body.classList.contains("presenting") ? transcript : document.scrollingElement as HTMLElement);
const atBottom = (): boolean => {
  const s = scroller();
  return s.scrollHeight - s.scrollTop - s.clientHeight < 120;
};
const toBottom = (smooth = true): void => {
  const s = scroller();
  s.scrollTo({ top: s.scrollHeight, behavior: smooth && !still.matches ? "smooth" : "auto" });
  jump.hidden = true;
};
const still = matchMedia("(prefers-reduced-motion: reduce)");
jump.addEventListener("click", () => toBottom());
addEventListener("scroll", () => {
  if (atBottom()) jump.hidden = true;
}, { passive: true });
transcript.addEventListener("scroll", () => {
  if (atBottom()) jump.hidden = true;
}, { passive: true });

// what each phrase on the page is, to redraw it when it's corrected
const said = new Map<number, Phrase>();

function arrive(p: Phrase, draft?: number): void {
  if (document.querySelector(`.phrase[data-id="${p.id}"]`)) return;
  said.set(p.id, p);
  const follow = atBottom();
  dropDraft(p.name, draft);
  const turn = turnFor(p);
  const words = turn.querySelector(".turn-words")!;
  words.insertAdjacentHTML("beforeend", (words.childElementCount ? " " : "") + phraseHtml(p));
  turn.dataset.until = String(p.at);
  empty.hidden = true;
  if (follow) toBottom();
  else if (p.name !== myName) jump.hidden = false;
  if (p.name === myName) followLatest && chooseLatest();
  // typed, read aloud in its writer's voice for whoever's asked (not your own:
  // you heard it as you sent it)
  if (p.typed && p.name !== myName && aloud()) speak(spokenOf(p.words), voicedOf(p.voice));
}
const spokenOf = (ws: Line[]): Spoken[] => ws.map((w) => ({ text: textOfHtml(w.html), loud: w.say?.[0] ?? 0, pitch: w.say?.[1] ?? 0, stretch: w.say?.[2] ?? 0, rise: w.say?.[3] ?? 0 }));
const textOfHtml = (html: string): string => {
  const d = document.createElement("span");
  d.innerHTML = html;
  d.querySelectorAll(".held").forEach((h) => h.remove());
  return d.textContent ?? "";
};
const voicedOf = (v?: { voice: string; pitch: number; speed: number }): Voiced => ({ voice: v?.voice ?? "warm", tune: { voicePitch: v?.pitch ?? 0, voiceSpeed: v?.speed ?? 0 } });

function edited(p: Phrase | { id: number; removed: true }): void {
  const el = document.querySelector(`.phrase[data-id="${p.id}"]`);
  if (!el) return;
  if ("removed" in p) {
    const turn = el.closest(".turn");
    el.remove();
    if (turn && !turn.querySelector(".phrase")) turn.remove();
    said.delete(p.id);
    empty.hidden = !!transcript.querySelector(".turn");
    return;
  }
  said.set(p.id, p);
  el.outerHTML = phraseHtml(p);
  markChosen();
}

// Someone still talking: what's been heard of the phrase so far, faded, at
// the foot of the transcript, until the real phrase replaces it. Each page
// keeps only the latest for each speaker.
type Draft = { name: string; hue: number; draft: number; words: { html: string }[] };
const DRAFT_FOR = 6000;
const draftTimers = new Map<string, number>();
function showDraft(d: Draft): void {
  const follow = atBottom();
  let el = drafts.querySelector<HTMLElement>(`[data-name="${CSS.escape(d.name)}"]`);
  if (!el) {
    el = document.createElement("li");
    el.className = "draft";
    el.dataset.name = d.name;
    el.style.setProperty("--hue", String(d.hue));
    drafts.append(el);
  }
  el.dataset.draft = String(d.draft);
  el.innerHTML = `<span class="who">${esc(d.name)}</span> <span class="draft-words">${d.words.map((w) => w.html).join(" ")}</span>`;
  if (follow) toBottom(false);
  clearTimeout(draftTimers.get(d.name));
  draftTimers.set(d.name, window.setTimeout(() => dropDraft(d.name), DRAFT_FOR));
}
function dropDraft(name: string, n?: number): void {
  const el = drafts.querySelector<HTMLElement>(`[data-name="${CSS.escape(name)}"]`);
  if (el && (n === undefined || Number(el.dataset.draft) <= n)) el.remove();
}

// ---- who's here, and hands up ----

type Here = { name: string; hue: number };
const hereList = document.getElementById("here-list") as HTMLUListElement;
function showHere(here: Here[]): void {
  hereList.innerHTML = here.length
    ? here.map((p) => `<li style="--hue:${p.hue}"${p.name === myName ? ' class="me"' : ""}><span class="who">${esc(p.name)}</span>${p.name === myName ? " <span class='you-tag'>you</span>" : ""}</li>`).join("")
    : `<li class="nobody">Nobody's here right now</li>`;
}
const queueEl = document.getElementById("queue") as HTMLElement;
let queueNow: string[] = [];
function showQueue(queue: string[]): void {
  queueNow = queue;
  queueEl.hidden = !queue.length;
  queueEl.innerHTML = queue.length ? `<span aria-hidden="true">✋</span> Next to speak: ${queue.map((n) => (n === myName ? "<strong>you</strong>" : esc(n))).join(", then ")}` : "";
  const up = queue.includes(myName);
  const btn = document.querySelector<HTMLButtonElement>(".hand");
  if (btn) {
    btn.classList.toggle("up", up);
    btn.setAttribute("aria-pressed", String(up));
    btn.querySelector(".hand-label")!.textContent = up ? "Lower hand" : "Raise hand";
    (btn.form?.elements.namedItem("up") as HTMLInputElement | null)?.setAttribute("value", String(!up));
  }
}
const handForm = document.querySelector<HTMLFormElement>(".hand-form");
handForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const up = !queueNow.includes(myName);
  showQueue(up ? [...queueNow, myName] : queueNow.filter((n) => n !== myName));
  void fetch("hand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ up }) })
    .then((r) => r.json())
    .then((r: { queue?: string[] }) => r.queue && showQueue(r.queue))
    .catch(() => warn("Your hand didn't go up. Check your connection."));
});

// ---- the room itself changing ----

type RoomShown = { name: string; about: string; keep: string; listed: boolean };
function showRoom(r: RoomShown): void {
  document.querySelector(".room-name")!.textContent = r.name;
  document.title = `${r.name} · Said`;
  const about = document.querySelector<HTMLElement>(".room-about")!;
  about.textContent = r.about;
  about.hidden = !r.about;
  const k = KEEPS.find((x) => x.id === r.keep);
  document.querySelector(".keep-label")!.textContent = r.keep === "always" ? "Kept until it's closed" : `Kept for ${k?.label.toLowerCase() ?? ""}`;
}
// what a room no longer keeps comes off the page too
function forgot(before: number): void {
  for (const t of [...transcript.querySelectorAll<HTMLElement>(".phrase[data-at]")]) if (Number(t.dataset.at) < before) t.remove();
  for (const t of [...transcript.querySelectorAll<HTMLElement>(".turn")]) if (!t.querySelector(".phrase")) t.remove();
  empty.hidden = !!transcript.querySelector(".turn");
}

// ---- live: every phrase, as it's said ----

// A page plays what's said from where it was drawn; if the stream drops, it
// picks up from the last phrase it had. The browser reconnects a dropped
// stream on its own, but gives up for good if the server answers with an
// error (a deploy, a restart), so the page then opens a new one itself,
// waiting longer each time.
let lastSeen = Number(main.dataset.upTo) || 0;
let wait = 1000;
const showLive = (on: boolean, text: string): void => {
  live.hidden = false;
  live.classList.toggle("on", on);
  live.textContent = text;
};
function connect(): void {
  const stream = new EventSource(`events?after=${lastSeen}`);
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
  const on = <T>(name: string, f: (v: T) => void): void => stream.addEventListener(name, (e) => f(JSON.parse((e as MessageEvent<string>).data) as T));
  on<{ upTo: number; queue: string[]; here: Here[] }>("room", (r) => {
    lastSeen = Math.max(lastSeen, r.upTo);
    showQueue(r.queue);
    showHere(r.here);
  });
  on<Phrase & { draft?: number }>("said", (p) => {
    if (p.id <= lastSeen && document.querySelector(`.phrase[data-id="${p.id}"]`)) return;
    lastSeen = Math.max(lastSeen, p.id);
    arrive(p, p.draft);
  });
  on<Phrase | { id: number; removed: true }>("edited", edited);
  on<Draft>("early", (d) => d.name !== myName && showDraft(d));
  on<{ queue: string[] }>("hand", (h) => showQueue(h.queue));
  on<{ here: Here[] }>("here", (h) => showHere(h.here));
  on<RoomShown>("changed", showRoom);
  on<{ before: number }>("forgot", (f) => forgot(f.before));
  on<object>("closed", () => {
    stream.close();
    location.href = "/?m=closed";
  });
}
connect();

// ---- the reader's settings: theirs, in this browser only ----

const READING_KEY = "said-reading";
let reading: Reading = cleanReading(JSON.parse(recall(READING_KEY) ?? "{}"));
const readingForm = document.querySelector<HTMLElement>(".reading .menu-body");
function applyReading(): void {
  for (const [k, v] of Object.entries(reading)) document.documentElement.dataset[k] = v;
  for (const [k, v] of Object.entries(reading)) {
    const input = readingForm?.querySelector<HTMLInputElement>(`input[name="${k}"][value="${v}"]`);
    if (input) input.checked = true;
  }
}
applyReading();
readingForm?.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name in DEFAULT_READING) {
    reading = cleanReading({ ...reading, [t.name]: t.value });
    store(READING_KEY, JSON.stringify(reading));
    applyReading();
  }
});

// Reading typed messages aloud: the device's own voices at once, natural
// ones (Kokoro, a download, once) for anyone who turns them on.
const ALOUD_KEY = "said-aloud";
const NATURAL_KEY = "said-natural";
const aloudBox = readingForm?.querySelector<HTMLInputElement>('input[name="aloud"]') ?? null;
const naturalBox = readingForm?.querySelector<HTMLInputElement>('input[name="natural"]') ?? null;
const aloud = (): boolean => !!aloudBox?.checked;
let gpu = false;
const mb = (bytes: number): string => (bytes / 1e6).toFixed(0);
const naturalNote = (n?: Natural): void => {
  const note = readingForm?.querySelector(".natural-note");
  if (!note) return;
  note.textContent = n?.state === "loading" ? (n.total ? `${mb(n.loaded ?? 0)} of ${mb(n.total)} MB` : "getting ready") : n?.state === "failed" ? "couldn't load here" : recall(NATURAL_KEY + "-had") === "yes" ? "" : `about ${mb(naturalSize(gpu))} MB, once`;
};
const naturalOn = (yes: boolean): void =>
  naturalVoices(yes, true, (n) => {
    naturalNote(n);
    if (n.state === "ready") store(NATURAL_KEY + "-had", "yes");
    if (n.state === "failed" && naturalBox) naturalBox.checked = false;
  });
if (aloudBox && (canSpeak || canNatural)) {
  const naturalRow = naturalBox?.closest<HTMLElement>(".natural-row") ?? null;
  const showNaturalRow = (): void => {
    if (naturalRow) naturalRow.hidden = !canNatural || !aloudBox.checked;
  };
  void gpuAdapter().then((yes) => {
    gpu = yes;
    naturalNote();
  });
  aloudBox.addEventListener("change", () => {
    store(ALOUD_KEY, aloudBox.checked ? "on" : "off");
    hearVoices(aloudBox.checked);
    if (naturalBox?.checked) naturalOn(aloudBox.checked);
    showNaturalRow();
  });
  naturalBox?.addEventListener("change", () => {
    store(NATURAL_KEY, naturalBox.checked ? "on" : "off");
    naturalOn(naturalBox.checked);
  });
  // remembered as on: on from the first tap anywhere (browsers won't speak
  // before one)
  if (recall(ALOUD_KEY) === "on") {
    aloudBox.checked = true;
    if (naturalBox && canNatural && recall(NATURAL_KEY) === "on") naturalBox.checked = true;
    const start = (): void =>
      void setTimeout(() => {
        if (!aloudBox.checked) return;
        hearVoices(true);
        if (naturalBox?.checked) naturalOn(true);
      });
    addEventListener("pointerdown", start, { once: true, capture: true });
    addEventListener("keydown", start, { once: true, capture: true });
  }
  showNaturalRow();
} else aloudBox?.closest("label")?.setAttribute("hidden", "");

// Present: the transcript alone, full screen, large, for a projector or a
// phone propped up on the table. Esc, or the button again, comes back.
const presentBtn = document.querySelector<HTMLButtonElement>("[data-present]");
async function present(on: boolean): Promise<void> {
  document.body.classList.toggle("presenting", on);
  presentBtn?.setAttribute("aria-pressed", String(on));
  if (presentBtn) presentBtn.textContent = on ? "Stop presenting" : "Present";
  if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.().catch(() => undefined);
  if (!on && document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  toBottom(false);
}
presentBtn?.addEventListener("click", () => void present(!document.body.classList.contains("presenting")));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("presenting")) void present(false);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("presenting")) void present(false);
});

document.querySelector("[data-copy-link]")?.addEventListener("click", async (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(location.href.split("?")[0]);
    b.textContent = "Copied";
  } catch {
    b.textContent = location.href.split("?")[0];
  }
  setTimeout(() => (b.textContent = "Copy link"), 1800);
});

// Menus close when you click away from them, and Esc closes the open one.
addEventListener("click", (e) => {
  for (const d of document.querySelectorAll<HTMLDetailsElement>("details.menu[open]")) if (!d.contains(e.target as Node)) d.open = false;
});
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const d of document.querySelectorAll<HTMLDetailsElement>("details.menu[open]")) {
    d.open = false;
    d.querySelector("summary")?.focus();
  }
});

// ---- the room's own settings, for whoever opened it ----

const settings = document.querySelector<HTMLFormElement>("[data-room-settings]");
if (settings) {
  const status = settings.querySelector(".settings-status")!;
  let timer = 0;
  const save = async (): Promise<void> => {
    const f = new FormData(settings);
    status.textContent = "Saving…";
    try {
      const res = await fetch("room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: f.get("name"), about: f.get("about"), keep: f.get("keep"), listed: f.get("listed") === "on" }) });
      status.textContent = res.ok ? "Saved" : "That didn't save. Check the name.";
    } catch {
      status.textContent = "That didn't save. Check your connection.";
    }
  };
  settings.addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = window.setTimeout(save, (e.target as HTMLInputElement).type === "text" ? 700 : 0);
  });
  settings.addEventListener("submit", (e) => e.preventDefault());
  settings.querySelector("[data-close-room]")?.addEventListener("click", async () => {
    if (!confirm("Close this room? Everything said in it is deleted, for everyone.")) return;
    await fetch("room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ close: true }) }).catch(() => undefined);
    location.href = "/?m=closed";
  });
}

// ---- speaking: only for someone who has joined ----

const RATE = 16_000; // what Whisper listens at

const talk = document.getElementById("talk") as HTMLButtonElement | null;
const statusEl = document.getElementById("status");
// The status line. Something gone wrong stays up for a few seconds before
// ordinary news ("Listening.") can replace it, or it'd be gone before anyone
// read it.
let holdUntil = 0;
const say = (text: string): void => {
  if (!statusEl || Date.now() < holdUntil) return;
  statusEl.textContent = text;
};
const warn = (text: string): void => {
  if (!statusEl) return;
  statusEl.textContent = text;
  holdUntil = Date.now() + 6000;
};

// The worker holds Whisper. It's only started once someone who's joined
// opens a room, so people who only read never download the model.
let worker: Worker | undefined;
let modelReady = false;
const MODEL_BYTES = 80e6; // about what the model's files come to
const waiting = new Map<number, { resolve: (chunks: Heard[]) => void; reject: (e: Error) => void }>();
let nextId = 1;
function whisper(): Worker {
  if (worker) return worker;
  worker = new Worker("/js/worker.ts", { type: "module" });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data;
    if (m.type === "loading" && !modelReady && m.total > 1e6) {
      downloaded = `${mb(m.loaded)} of ${mb(Math.max(m.total, MODEL_BYTES))} MB`;
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
      for (const w of waiting.values()) w.reject(new Error(m.error));
      waiting.clear();
      couldntLoad();
    }
  };
  // The worker couldn't even start (a flaky connection, a blocked CDN): it's
  // thrown away so the next try starts a fresh one.
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
function couldntLoad(): void {
  if (modelReady) return;
  downloaded = "";
  warn(on ? "Couldn't download the speech model. It'll try again as you talk." : "Couldn't download the speech model. It'll try again when you turn your microphone on.");
}

// Each transcription is matched to its answer by id. One that takes longer
// than TRANSCRIBE_LIMIT fails, so a phone that quietly kills the worker for
// its memory doesn't hold every later phrase back; the worker starts afresh.
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
// A microphone slower than 16 kHz (a Bluetooth headset on its hands-free
// link runs at 8) is stretched up to it by drawing straight lines between its
// samples; averaging down would hand Whisper half the samples, and speech at
// twice the speed.
function upsampler(from: number): (input: Float32Array) => Float32Array {
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
  if (!modelReady && downloaded) say(on ? `Listening. Downloading the speech model, once: ${downloaded}. Keep talking; it'll catch up.` : `Downloading the speech model, once: ${downloaded}.`);
  else if (on) say(!modelReady ? "Listening. The speech model is downloading, once." : behind > 1 ? `Listening. Catching up on ${behind} phrases…` : "Listening.");
};

// how loud you are, a microphone batch at a time, rings the button; and
// read-aloud voices wait while you talk (not counting the voices
// themselves, heard back through the microphone)
let loudAt = 0;
function onAudio(samples: Float32Array): void {
  for (const phrase of phrases.push(samples)) send(phrase);
  const level = phrases.level();
  talk!.style.setProperty("--level", level.toFixed(2));
  if (phrases.mouth() > 0.35 && !voicesSpeaking()) loudAt = Date.now();
  duck(Date.now() - loudAt < 900);
  maybeEarly();
}

// ---- hearing a phrase early, while it's still being said ----

// Whisper only hears whole phrases well, and a phrase only ends at a pause,
// so what there is of one so far is heard every EARLY_EVERY once it has
// EARLY_AFTER of sound, and goes out at once as a draft: drawn faded, then
// replaced by the real phrase when it ends. A draft is only heard when
// Whisper has nothing else to do, so it never delays a real phrase.
const EARLY_AFTER = 0.9;
const EARLY_EVERY = 900;
let draft = 1;
let earlyAt = 0;
let earlyBusy = false;
function maybeEarly(): void {
  if (!modelReady || earlyBusy || behind > 0 || Date.now() - earlyAt < EARLY_EVERY) return;
  const { pcm, sound } = phrases.sofar();
  if (sound < EARLY_AFTER || !fromHere(pcm)) return;
  earlyBusy = true;
  earlyAt = Date.now();
  const forDraft = draft;
  transcribe(pcm.slice())
    .then(async (chunks) => {
      if (forDraft !== draft) return;
      const ws = hear(pcm, RATE, words(chunks, pcm.length / RATE)).words;
      if (ws.length === 0 || invented(ws.map((w) => w.w).join(" "), true)) return;
      showMyDraft(ws, forDraft);
      await fetch("early", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: ws, draft: forDraft }) });
    })
    .catch(() => {
      // a missed draft is no loss: the real phrase follows
    })
    .finally(() => {
      earlyBusy = false;
    });
}
// your own draft, drawn here as soon as it's heard, plainly (the server
// draws everyone else's)
function showMyDraft(ws: Word[], n: number): void {
  showDraft({ name: myName, hue: Number(document.querySelector<HTMLElement>(".here .me")?.style.getPropertyValue("--hue") || 0), draft: n, words: ws.map((w) => ({ html: `<span class="w">${esc(w.w)}</span>` })) });
}

// A phrase that's mostly a breath, a click or the room is never sent to
// Whisper, which would hear a sentence in it (spoke() says why), nor is a
// voice somewhere else in the room (near() says why). How loud this person
// usually speaks is the median of their last few phrases' voices.
const usualLevels: number[] = [];
const usualLevel = (): number | null => (usualLevels.length >= 2 ? [...usualLevels].sort((a, b) => a - b)[Math.floor(usualLevels.length / 2)] : null);
function fromHere(pcm: Float32Array): boolean {
  if (!spoke(pcm, RATE)) return false;
  return near(voiceLevel(pcm, RATE), phrases.room(), usualLevel());
}
let hearing: Promise<void> = Promise.resolve(); // so phrases go out in the order they were said
function send(pcm: Float32Array): void {
  const forDraft = draft++;
  earlyAt = Date.now();
  if (!fromHere(pcm)) return void dropDraft(myName, forDraft);
  const level = voiceLevel(pcm, RATE);
  if (level !== null) {
    usualLevels.push(level);
    if (usualLevels.length > 8) usualLevels.shift();
  }
  behind++;
  showBehind();
  const heard = transcribe(pcm.slice());
  hearing = hearing.then(async () => {
    try {
      const result = hear(pcm, RATE, words(await heard, pcm.length / RATE));
      // Whisper's inventions for a breath or the room ("Thank you."): a
      // phrase that's only that, with no voice under it, is dropped
      const voiced = result.voice?.pitch != null && result.words.some((w) => w.pitch !== null);
      if (result.words.length === 0 || invented(result.words.map((w) => w.w).join(" "), voiced)) return void dropDraft(myName, forDraft);
      // someone's typed words read aloud here, heard back through the microphone
      if (echoOf(result.words.map((w) => w.w).join(" "))) return void dropDraft(myName, forDraft);
      await post(result.words, result.voice, forDraft);
    } catch (err) {
      console.error(err);
      warn(modelReady ? "Something you said couldn't be heard." : "Couldn't download the speech model. Check your connection and try again.");
    } finally {
      behind--;
      showBehind();
    }
  });
}

// A phrase goes out the moment it's heard. A moment's outage (a redeploy,
// the server waking) is waited out: tried again a few times, still in order.
const RETRY_AFTER = [1000, 2000, 3000];
async function post(ws: Word[], voice: Voice | null, forDraft?: number, typed = false): Promise<void> {
  try {
    let res: Response | null = null;
    for (let i = 0; ; i++) {
      try {
        res = await fetch("say", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ words: ws, voice, draft: forDraft, ...(typed ? { typed } : {}) }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status < 500 || i >= RETRY_AFTER.length) break;
      } catch (err) {
        if (i >= RETRY_AFTER.length) throw err;
      }
      if (i === 0) say("Reconnecting… what you said will go when it can.");
      await new Promise((r) => setTimeout(r, RETRY_AFTER[i]));
    }
    if (!res) return;
    if (res.status === 401) {
      void turnOff();
      warn("You've been signed out. Reload the page and join again.");
    } else if (res.status === 429) warn("That's a lot at once. Some of it didn't send.");
    else if (!res.ok) warn("Something you said couldn't be sent.");
  } catch (err) {
    console.error(err);
    warn("Something you said couldn't be sent. Check your connection.");
  }
}

// ---- typing instead: written here, said like the rest (typed.ts) ----

const typeBox = document.getElementById("type-box") as HTMLFormElement | null;
const myVoice = (): Voiced => {
  const v = JSON.parse(main.dataset.voice ?? "{}") as { voice?: string; pitch?: number; speed?: number };
  return voicedOf({ voice: v.voice ?? "warm", pitch: v.pitch ?? 0, speed: v.speed ?? 0 });
};
if (typeBox) {
  const input = typeBox.elements.namedItem("text") as HTMLInputElement;
  const sendBtn = typeBox.querySelector<HTMLButtonElement>(".send")!;
  const tone = (): Tone => toneOf((document.querySelector<HTMLInputElement>('input[name="tone"]:checked'))?.value);
  input.addEventListener("input", () => (sendBtn.disabled = !input.value.trim()));
  typeBox.addEventListener("submit", (e) => {
    e.preventDefault();
    const ws = typedWords(input.value, tone());
    if (!ws.length) return;
    input.value = "";
    sendBtn.disabled = true;
    void post(ws, null, undefined, true);
    // (read aloud here too, if you read aloud: it's your voice saying it)
    if (aloud()) speak(ws.map((w) => ({ text: w.w, loud: w.loud, pitch: w.pitch ?? 0, stretch: w.stretch, rise: w.rise })), myVoice());
  });
}

// Your voice: kept with you, a moment after you stop changing it, and tried
// out as it'll sound.
const voiceMenu = document.querySelector<HTMLElement>(".your-voice .menu-body");
if (voiceMenu) {
  const now = (): { voice: string; pitch: number; speed: number } => ({
    voice: (voiceMenu.querySelector("select") as HTMLSelectElement).value,
    pitch: Number((voiceMenu.querySelector('input[name="pitch"]') as HTMLInputElement).value),
    speed: Number((voiceMenu.querySelector('input[name="speed"]') as HTMLInputElement).value),
  });
  let saving = 0;
  voiceMenu.addEventListener("change", () => {
    main.dataset.voice = JSON.stringify(now());
    clearTimeout(saving);
    saving = window.setTimeout(async () => {
      try {
        const res = await fetch("/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(now()) });
        if (!res.ok) warn("Your voice didn't save.");
      } catch {
        warn("Your voice didn't save. Check your connection.");
      }
    }, 400);
  });
  voiceMenu.querySelector("[data-try-voice]")?.addEventListener("click", () => {
    const text = (typeBox?.elements.namedItem("text") as HTMLInputElement | null)?.value || "Hi, this is *me*. How do I sound?";
    tryVoice(myVoice(), typedWords(text, "plain").map((w) => ({ text: w.w, loud: w.loud, pitch: w.pitch ?? 0, stretch: w.stretch, rise: w.rise })));
  });
}

// ---- correcting your own words ----

// One of your words is chosen at a time: your latest, unless you've tapped
// another of yours. Type to replace it, Enter to put it in; Backspace with
// nothing typed takes it out; Esc gives up. ← and → choose the word before or
// after. Every correction goes to the server and comes back to everyone as
// the changed phrase; a change to a word that isn't yours is refused there.
let chosen: { id: number; index: number } | null = null;
let followLatest = true;
let typing: string | null = null;
const myWords = (): HTMLElement[] => [...transcript.querySelectorAll<HTMLElement>(".turn.mine .tw")];
function choose(id: number, index: number, follow = false): void {
  chosen = { id, index };
  followLatest = follow;
  typing = null;
  markChosen();
}
function chooseLatest(): void {
  const last = myWords().at(-1);
  const ph = last?.closest<HTMLElement>(".phrase");
  if (last && ph) choose(Number(ph.dataset.id), Number(last.dataset.i), true);
}
function markChosen(): void {
  for (const el of document.querySelectorAll(".tw.chosen")) el.classList.remove("chosen", "typing");
  if (!chosen || !myName) return;
  const el = transcript.querySelector<HTMLElement>(`.turn.mine .phrase[data-id="${chosen.id}"] .tw[data-i="${chosen.index}"]`);
  if (!el) return;
  el.classList.add("chosen");
  if (typing !== null) {
    el.classList.add("typing");
    el.innerHTML = `<span class="w">${esc(typing)}<span class="caret"></span></span>`;
  }
}
async function change(edit: { text?: string; remove?: boolean }): Promise<void> {
  if (!chosen) return;
  try {
    const res = await fetch("edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: chosen.id, index: chosen.index, ...edit }) });
    if (!res.ok) warn("That correction didn't go through.");
  } catch {
    warn("That correction didn't go through. Check your connection.");
  }
}
function key(k: string): boolean {
  if (!chosen || !myName) return false;
  if (typing !== null) {
    if (k === "Enter" || k === " ") {
      const text = typing.trim();
      typing = null;
      if (text) void change({ text });
      else edited(said.get(chosen.id) ?? { id: chosen.id, removed: true });
    } else if (k === "Escape") {
      typing = null;
      const p = said.get(chosen.id);
      if (p) edited(p);
      else location.reload();
    } else if (k === "Backspace") typing = typing.slice(0, -1);
    else if (k.length === 1 && typing.length < 40) typing += k;
    else return false;
    markChosen();
    return true;
  }
  if (k === "Backspace" || k === "Delete") {
    void change({ remove: true });
    return true;
  }
  if (k === "ArrowLeft" || k === "ArrowRight") {
    const all = myWords();
    const at = all.findIndex((el) => el.classList.contains("chosen"));
    const next = all[at + (k === "ArrowLeft" ? -1 : 1)];
    const ph = next?.closest<HTMLElement>(".phrase");
    if (!next || !ph) return at >= 0;
    choose(Number(ph.dataset.id), Number(next.dataset.i));
    return true;
  }
  if (k.length === 1 && k !== " " && /\S/u.test(k)) {
    typing = k;
    markChosen();
    return true;
  }
  return false;
}
// The keyboard is for your chosen word only once you've tapped one of your
// words (not always: typing a message, or using the page, mustn't change
// what you said), and never in a text box.
let editing = false;
addEventListener("keydown", (e) => {
  if (!editing || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest("input, textarea, select, [contenteditable]")) return;
  if ((e.key === " " || e.key === "Enter") && t.closest("button, summary, a")) return;
  if (key(e.key)) e.preventDefault();
  if (e.key === "Escape" && typing === null) stopEditing();
});
function stopEditing(): void {
  editing = false;
  chosen = null;
  typing = null;
  markChosen();
  transcript.classList.remove("editing");
}
transcript.addEventListener("click", (e) => {
  const w = (e.target as HTMLElement).closest<HTMLElement>(".turn.mine .tw");
  const ph = w?.closest<HTMLElement>(".phrase");
  if (!w || !ph) return;
  editing = true;
  transcript.classList.add("editing");
  choose(Number(ph.dataset.id), Number(w.dataset.i));
  say("Type to correct that word, Enter to put it in, Backspace to take it out, Esc when you're done.");
});
addEventListener("click", (e) => {
  if (editing && !(e.target as HTMLElement).closest(".turn.mine .tw")) stopEditing();
});

// ---- the microphone ----

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
  // a call comes in, a headset drops out. Then the page says so.
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
  talk!.querySelector(".label")!.textContent = state ? "Listening — tap to stop" : "Turn on microphone";
  talk!.setAttribute("aria-pressed", String(state));
  talk!.classList.toggle("recording", state);
}
async function turnOn(): Promise<void> {
  if (on || stopRecording) return;
  talk!.disabled = true;
  // made before anything is awaited, while this still counts as the tap
  const ctx = new AudioContext();
  void ctx.resume();
  whisper();
  try {
    stopRecording = await record(ctx);
  } catch (err) {
    void ctx.close();
    const blocked = err instanceof DOMException && err.name === "NotAllowedError";
    say(blocked ? "The microphone is blocked. Allow it for this site in your browser's settings, then try again." : "Couldn't open a microphone in this browser.");
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
  for (const phrase of phrases.end()) send(phrase);
  showOn(false);
  say(behind ? "Hearing the last of it…" : "");
  void hearing.then(() => {
    if (!on) say("");
  });
}
if (talk) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
    say("This browser can't record here. You can still type, and read everything live.");
  } else {
    showOn(false);
    talk.addEventListener("click", () => void (on ? turnOff() : turnOn()));
    // Someone who's joined a room is here to talk, so the speech model
    // starts downloading once the page has settled, rather than when they
    // first press the button.
    say("Getting the speech model ready (about 80 MB, once).");
    const warm = (): void => void setTimeout(() => whisper(), 500);
    if (document.readyState === "complete") warm();
    else addEventListener("load", warm, { once: true });
  }
}

// the page opens at the newest
toBottom(false);
