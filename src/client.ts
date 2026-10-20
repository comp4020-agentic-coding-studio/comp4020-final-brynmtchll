// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live, plays each phrase in its
// speaker's spot, and, while someone's microphone is on, hears them a phrase
// at a time and sends each phrase as it's heard.
import { avatarSvg, fromShapes, placed, poseFrom, resting, REST, smoother, STILL, type Expression, type Look, type Placed, type Pose } from "./avatar.ts";
import { head3d, sayWord, speaking, voiceLevels, webgl } from "./head3d.ts";
import { EFFECTS, randomLook, STYLES, type Look as PackLook } from "./packs.ts";
import { phraser, type Phraser } from "./phrases.ts";
import { hear, invented, near, spoke, voiceLevel, words, type Heard } from "./prosody.ts";
import { ago, vowels, wordHtml, type Voice, type Word } from "./voice.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

const stage = document.getElementById("stage") as HTMLUListElement;
const nobody = document.getElementById("nobody") as HTMLElement;
const live = document.getElementById("live") as HTMLElement;
const heardAloud = document.getElementById("heard") as HTMLElement;

// ---- the stage: each person's words, one at a time, in their spot ----

type StageWord = { html: string; t: number; d: number; gap: number };
type Phrase = { id: number; name: string; hue: number; look?: Look; text: string; at: number; words: StageWord[] };

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
type Spot = {
  el: HTMLElement;
  word: HTMLElement;
  queue: (Phrase & { arrived: number })[];
  state: "idle" | "playing" | "lingering";
  timers: number[];
};

const spots = new Map<string, Spot>();

// Someone who joined after the page loaded gets a card when they join.
// Past MOST_SPOTS, the one who's been quiet longest gives theirs up, so a
// page never fills with names. Your own card is in the middle, not the stack.
const MOST_SPOTS = 24;
const cardOf = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`.spot[data-name="${CSS.escape(name)}"]`);
function spotFor(p: Pick<Phrase, "name" | "hue">, look?: Look): Spot {
  const known = spots.get(p.name);
  if (known) {
    // most recently heard from last, so the quietest is first to go
    spots.delete(p.name);
    spots.set(p.name, known);
    if (look && !known.el.dataset.look) {
      known.el.dataset.look = JSON.stringify(look);
      drawAvatar(p.name, expressionOf.get(p.name) ?? REST);
    }
    return known;
  }
  let el = cardOf(p.name);
  if (!el) {
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
    if (look) el.dataset.look = JSON.stringify(look);
    const head = document.createElement("div");
    head.className = "spot-head";
    const avatar = document.createElement("span");
    avatar.className = "spot-avatar";
    const label = document.createElement("p");
    label.className = "spot-name";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = p.name;
    label.append(who);
    head.append(avatar, label);
    const word = document.createElement("p");
    word.className = "spot-word";
    word.setAttribute("aria-hidden", "true");
    const thread = document.createElement("ol");
    thread.className = "thread";
    thread.setAttribute("aria-label", `What ${p.name} said lately`);
    el.append(head, word, thread);
    stage.append(el);
    nobody.hidden = true;
  }
  const spot: Spot = { el, word: el.querySelector(".spot-word")!, queue: [], state: "idle", timers: [] };
  spots.set(p.name, spot);
  // a card the server drew becomes a 3D head; one just made gets its first face
  if (look || (webgl && el.dataset.look)) drawAvatar(p.name, REST);
  return spot;
}

// Each avatar is redrawn from its person's look (kept on their card), latest
// expression and, while their camera's on, which way their head is turned.
// Where the browser can, it's a 3D head (head3d.ts), which eases between
// expressions itself; the flat one the server drew stays until that's ready,
// and for good where it can't be.
const expressionOf = new Map<string, Expression>();
// how someone's words are drawn follows their look (view.ts styleVars)
function styleWords(card: HTMLElement, look: PackLook): void {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  card.dataset.words = st.id;
  card.dataset.font = st.font;
  card.toggleAttribute("data-glow", "glow" in st);
}
function drawAvatar(name: string, e: Expression, pose: Pose | null = null): void {
  expressionOf.set(name, e);
  const card = cardOf(name);
  const look = card?.dataset.look ? (JSON.parse(card.dataset.look) as Look) : null;
  if (card && look) styleWords(card, look as unknown as PackLook);
  const slot = card?.querySelector<HTMLElement>(".spot-avatar");
  if (!look || !slot) return;
  if (!slot.querySelector(".head3d")) slot.innerHTML = avatarSvg(look, e, `${name}'s avatar`);
  if (webgl) void head3d(slot, look, e, pose);
}
const slotOf = (spot: Spot): HTMLElement | null => spot.el.querySelector<HTMLElement>(".spot-avatar");
for (const el of document.querySelectorAll<HTMLElement>(".spot")) spotFor({ name: el.dataset.name!, hue: 0 });

// The word being said goes up large (the thread underneath has the rest).
function showWord(spot: Spot, html: string): void {
  spot.word.classList.remove("fading");
  spot.word.innerHTML = html;
  // restart the arrival animation on the new word
  spot.word.classList.remove("arrive");
  void spot.word.offsetWidth;
  spot.word.classList.add("arrive");
}

function play(spot: Spot): void {
  for (const t of spot.timers) clearTimeout(t);
  spot.timers = [];
  while (spot.queue.length && Date.now() - spot.queue[0].arrived > STALE) spot.queue.shift();
  const phrase = spot.queue.shift();
  const slot = slotOf(spot);
  if (!phrase) {
    spot.state = "idle";
    spot.el.classList.remove("speaking");
    if (slot) speaking(slot, false);
    return;
  }
  spot.state = "playing";
  spot.el.classList.add("speaking");
  if (slot) speaking(slot, true);
  const later = (at: number, fn: () => void): void => void spot.timers.push(window.setTimeout(fn, at * 1000));
  // each word goes up large, and their head says it, the way it was said
  const show = (w: StageWord): void => {
    showWord(spot, w.html);
    const shown = spot.word.querySelector<HTMLElement>(".w");
    if (!slot || !shown) return;
    const n = (v: string): number => Number(shown.style.getPropertyValue(v)) || 0;
    sayWord(slot, {
      seconds: w.d,
      loud: n("--loud"),
      pitch: n("--pitch"),
      syllables: vowels(shown.textContent ?? "").length,
      effect: /fx-(\w+)/.exec(shown.className)?.[1] ?? null,
    });
  };
  // `at` is when each word goes up on the page; `due` is when it was said,
  // pauses shortened. A word goes up when it was said or once the last has
  // had its SHORTEST_WORD, whichever is later. Someone who has asked for less
  // motion sees the phrase's last word only.
  let at = 0;
  if (still.matches) {
    const lastWord = phrase.words.at(-1);
    if (lastWord) showWord(spot, lastWord.html);
  } else {
    let due = 0;
    phrase.words.forEach((w, i) => {
      at = Math.max(at, due);
      later(at, () => show(w));
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
    who.textContent = p.name;
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
// once someone opens or closes it themselves, it stays how they left it
lately.closest("details")?.addEventListener("toggle", (e) => {
  if (e.isTrusted) (e.currentTarget as HTMLElement).dataset.touched = "1";
});
setInterval(() => {
  for (const t of lately.querySelectorAll<HTMLTimeElement>("time[data-at]")) t.textContent = ago(Number(t.dataset.at));
}, 15_000);

function arrive(p: Phrase & { draft?: number }): void {
  // the real phrase replaces its draft
  dropDraft(p.name, p.draft);
  remember(p);
  heardAloud.textContent = `${p.name}: ${p.text}`;
  const spot = spotFor(p, p.look);
  addToThread(spot, p);
  spot.queue.push({ ...p, arrived: Date.now() });
  if (spot.state !== "playing") play(spot);
  // your latest word is the one chosen, unless you've chosen another
  if (spot.el.classList.contains("mine") && (followLatest || !chosen) && typing === null) choose(p.id, p.words.length - 1, true);
}

// ---- each person's thread: what they've said lately, as text messages ----

// A phrase joins its speaker's latest bubble if it came soon after it, or
// starts a new one; a pause inside it breaks the line, as in the server's
// drawing (view.ts threadHtml). Newest first: a new bubble goes at the top,
// and a new phrase at the top of its bubble. The thread keeps to the top as
// it grows, unless someone has scrolled down to read back.
const NEW_BUBBLE = 4000;
const NEW_LINE = 0.7;
const THREAD_BUBBLES = 40;
const phraseHtml = (p: Phrase): string =>
  `<span class="phrase" data-id="${p.id}">${p.words.map((w, i) => `<span class="tw" data-i="${i}">${w.html}</span>${w.gap > NEW_LINE && i + 1 < p.words.length ? "<br>" : " "}`).join("")}</span>`;
const said = new Map<number, Phrase>(); // each phrase on the page, by id, for redrawing

function addToThread(spot: Spot, p: Phrase): void {
  const thread = spot.el.querySelector<HTMLOListElement>(".thread");
  if (!thread || thread.querySelector(`.phrase[data-id="${p.id}"]`)) return;
  said.set(p.id, p);
  const atTop = thread.scrollTop < 40;
  const latest = thread.firstElementChild as HTMLElement | null;
  if (latest && p.at - Number(latest.dataset.at) < NEW_BUBBLE) {
    latest.insertAdjacentHTML("afterbegin", `${phraseHtml(p)}<br>`);
  } else {
    const li = document.createElement("li");
    li.className = "bubble";
    li.innerHTML = phraseHtml(p);
    thread.prepend(li);
    while (thread.children.length > THREAD_BUBBLES) thread.lastElementChild!.remove();
  }
  (thread.firstElementChild as HTMLElement).dataset.at = String(p.at);
  if (atTop) thread.scrollTop = 0;
}

// A draft: the words of a phrase still being said, faded, at the top of its
// speaker's thread, each new draft of the same phrase in place of the last.
// The real phrase, when it comes, takes its place; one that never comes is
// taken down after DRAFT_FOR.
const DRAFT_FOR = 8000;
type Draft = { name: string; hue: number; look?: Look; draft: number; words: StageWord[] };
const draftTimers = new Map<string, number>();
function showDraft(d: Draft): void {
  const spot = spotFor(d, d.look);
  const thread = spot.el.querySelector<HTMLOListElement>(".thread");
  if (!thread) return;
  let el = thread.querySelector<HTMLElement>(".draft");
  if (!el || Number(el.dataset.draft) !== d.draft) {
    el?.remove();
    el = document.createElement("li");
    el.className = "bubble draft";
    el.dataset.draft = String(d.draft);
    thread.prepend(el);
  }
  el.innerHTML = d.words.map((w, i) => `${w.html}${w.gap > NEW_LINE && i + 1 < d.words.length ? "<br>" : " "}`).join("");
  if (thread.scrollTop < 40) thread.scrollTop = 0;
  // the big word shows the newest heard word straight away
  if (spot.state !== "playing") showWord(spot, d.words.at(-1)?.html ?? "");
  clearTimeout(draftTimers.get(d.name));
  draftTimers.set(d.name, window.setTimeout(() => dropDraft(d.name), DRAFT_FOR));
}
function dropDraft(name: string, n?: number): void {
  const el = cardOf(name)?.querySelector<HTMLElement>(".thread .draft");
  if (el && (n === undefined || Number(el.dataset.draft) <= n)) el.remove();
}

// a phrase changed by its speaker, drawn again in place, everywhere it is
function redrawPhrase(id: number): void {
  const p = said.get(id);
  const el = document.querySelector(`.phrase[data-id="${id}"]`);
  if (!el) return;
  if (p) el.outerHTML = phraseHtml(p);
  markChosen();
}
function edited(p: Phrase | { id: number; removed: true }): void {
  if ("removed" in p) {
    const el = document.querySelector(`.phrase[data-id="${p.id}"]`);
    const next = el?.nextSibling;
    const prev = el?.previousSibling;
    if (next?.nodeName === "BR") next.remove();
    else if (prev?.nodeName === "BR") prev.remove();
    const bubble = el?.closest(".bubble");
    el?.remove();
    if (bubble && !bubble.querySelector(".phrase")) bubble.remove();
    said.delete(p.id);
    if (chosen?.id === p.id) chosen = null;
  } else {
    said.set(p.id, p);
    // the chosen word stays chosen if it's still there, or moves back one
    if (chosen?.id === p.id && chosen.index >= p.words.length) chosen.index = p.words.length - 1;
    redrawPhrase(p.id);
  }
}
// the threads the server drew: each phrase known by its id (from the words
// as drawn, with their pauses), so a change to it can be drawn again; and
// each thread scrolled to the latest
for (const el of document.querySelectorAll<HTMLElement>(".thread .phrase")) {
  const tws = [...el.querySelectorAll<HTMLElement>(".tw")];
  said.set(Number(el.dataset.id), {
    id: Number(el.dataset.id),
    name: el.closest<HTMLElement>(".spot")?.dataset.name ?? "",
    hue: 0,
    text: tws.map((t) => t.textContent).join(" "),
    at: 0,
    words: tws.map((t) => ({ html: t.innerHTML, t: 0, d: 0, gap: t.nextElementSibling?.nodeName === "BR" ? 1 : 0 })),
  });
}
for (const thread of document.querySelectorAll<HTMLOListElement>(".thread")) thread.scrollTop = 0;


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
    const p = JSON.parse((e as MessageEvent<string>).data) as Pick<Phrase, "name" | "hue"> & { look: Look };
    spotFor(p, p.look);
  });
  stream.addEventListener("face", (e) => {
    const { name, e: expression, pose } = JSON.parse((e as MessageEvent<string>).data) as { name: string; e: Expression; pose?: Pose | null };
    // your own avatar follows your face here, not the server's echo of it
    if (cardOf(name)?.classList.contains("mine") && faceOn) return;
    drawAvatar(name, expression, pose ?? null);
  });
  stream.addEventListener("voice", (e) => {
    const { name, levels } = JSON.parse((e as MessageEvent<string>).data) as { name: string; levels: number[] };
    // your own head moves with your voice here, as you talk
    if (name === myName) return;
    const slot = cardOf(name)?.querySelector<HTMLElement>(".spot-avatar");
    if (slot) voiceLevels(slot, levels);
  });
  stream.addEventListener("look", (e) => {
    const { name, look } = JSON.parse((e as MessageEvent<string>).data) as { name: string; look: Look };
    const card = cardOf(name);
    if (!card) return;
    card.dataset.look = JSON.stringify(look);
    drawAvatar(name, expressionOf.get(name) ?? REST);
  });
  stream.addEventListener("said", (e) => {
    const p = JSON.parse((e as MessageEvent<string>).data) as Phrase;
    if (typeof lastSeen === "number" && p.id <= lastSeen) return;
    lastSeen = p.id;
    arrive(p);
  });
  stream.addEventListener("edited", (e) => edited(JSON.parse((e as MessageEvent<string>).data)));
  stream.addEventListener("early", (e) => showDraft(JSON.parse((e as MessageEvent<string>).data) as Draft));
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
  sendVoice(phrases.mouth());
  maybeEarly();
}

// ---- your voice, on your avatar's mouth, as you talk ----

// How loud you are, a microphone batch at a time (0 to 1, above the room),
// moves your avatar's mouth here at once and on everyone else's page a
// moment later, so heads talk as people do, before their words are heard.
// Sent VOICE_EVERY in a batch, and only while there's something to send: a
// loudness, never the sound.
const VOICE_EVERY = 120; // ms
let voiceBatch: number[] = [];
let voiceSentAt = 0;
let voiceQuiet = 0;
function sendVoice(level: number): void {
  const slot = cardOf(myName)?.querySelector<HTMLElement>(".spot-avatar");
  if (slot) voiceLevels(slot, [level], true);
  voiceBatch.push(Math.round(level * 100) / 100);
  if (Date.now() - voiceSentAt < VOICE_EVERY) return;
  const levels = voiceBatch;
  voiceBatch = [];
  voiceSentAt = Date.now();
  // silence goes once, then nothing until there's sound again
  voiceQuiet = levels.every((l) => l < 0.08) ? voiceQuiet + 1 : 0;
  if (voiceQuiet > 1) return;
  void fetch("/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ levels }) }).catch(() => {});
}

// ---- hearing a phrase early, while it's still being said ----

// a draft whose phrase came to nothing (silence, or one of Whisper's
// inventions) is taken down here; other pages take theirs down when the
// speaker's next phrase arrives, or after DRAFT_FOR
function clearDraft(n: number): void {
  const mineName = document.querySelector<HTMLElement>(".spot.mine")?.dataset.name;
  if (mineName) dropDraft(mineName, n);
}

// Whisper only hears whole phrases well, and a phrase only ends at a pause,
// so the first words of one used to reach everyone a second after it ended.
// Now, while a phrase is under way, what there is of it so far is heard
// every EARLY_EVERY once it has EARLY_AFTER of sound, and goes out at once
// as a draft: drawn faded, then replaced by the real phrase when it ends.
// A draft is only heard when Whisper has nothing else to do, so it never
// delays a real phrase: a phone too slow to keep up simply sends fewer.
const EARLY_AFTER = 0.9; // seconds of sound in the phrase
const EARLY_EVERY = 900; // ms
let draft = 1; // the number of the phrase now being said
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
      // the phrase may have ended (and been sent for real) while this was heard
      if (forDraft !== draft) return;
      const ws = hear(pcm, RATE, words(chunks, pcm.length / RATE)).words;
      if (ws.length === 0 || invented(ws.map((w) => w.w).join(" "), true)) return;
      await fetch("/early", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: ws, draft: forDraft }) });
    })
    .catch(() => {
      // a missed draft is no loss: the real phrase follows
    })
    .finally(() => {
      earlyBusy = false;
    });
}

// A phrase that's mostly a breath, a click or the room is never sent to
// Whisper, which would hear a sentence in it (spoke() says why), nor is a
// voice somewhere else in the room, a television or the next room (near()
// says why). How loud this person usually speaks is the median of their
// last few phrases' voices. What's heard goes out in the order it was said.
const usualLevels: number[] = [];
const usualLevel = (): number | null => (usualLevels.length >= 2 ? [...usualLevels].sort((a, b) => a - b)[Math.floor(usualLevels.length / 2)] : null);
function fromHere(pcm: Float32Array): boolean {
  if (!spoke(pcm, RATE)) return false;
  const level = voiceLevel(pcm, RATE);
  return near(level, phrases.room(), usualLevel());
}
function send(pcm: Float32Array): void {
  const forDraft = draft++;
  earlyAt = Date.now();
  if (!fromHere(pcm)) return void clearDraft(forDraft);
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
      if (result.words.length === 0 || invented(result.words.map((w) => w.w).join(" "), voiced)) return void clearDraft(forDraft);
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

// ---- sending what you said, and changing it live ----

let hearing: Promise<void> = Promise.resolve(); // so phrases go out in the order they were said

// A phrase goes out the moment it's heard, whole: it plays in your place and
// joins your thread for everyone.
async function post(words: Word[], voice: Voice | null, forDraft?: number): Promise<void> {
  try {
    const res = await fetch("/say", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words, voice, draft: forDraft }),
      // a send that hangs mustn't hold up every phrase after it
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      void turnOff();
      warn("You've been signed out. Reload the page and join again.");
    } else if (res.status === 429) {
      warn("That's a lot at once. Some of it didn't send.");
    } else if (!res.ok) {
      warn("Something you said couldn't be sent.");
    }
  } catch (err) {
    console.error(err);
    warn("Something you said couldn't be sent. Check your connection.");
  }
}

// One of your words is chosen at a time: your latest, unless you've tapped
// another of yours in your thread. Whatever you do goes to the server at once
// and comes back to everyone (yourself included) as the changed phrase; a
// change to a word that isn't yours is refused there, not just here.
let chosen: { id: number; index: number } | null = null;
let followLatest = true;
let typing: string | null = null;
const myThread = (): HTMLOListElement | null => document.querySelector(".spot.mine .thread");

function choose(id: number, index: number, follow = false): void {
  chosen = { id, index };
  followLatest = follow;
  typing = null;
  markChosen();
}
function markChosen(): void {
  for (const el of document.querySelectorAll(".tw.chosen")) el.classList.remove("chosen", "typing");
  if (!chosen) return;
  const el = myThread()?.querySelector(`.phrase[data-id="${chosen.id}"] .tw[data-i="${chosen.index}"]`);
  if (!el) return;
  el.classList.add("chosen");
  if (typing !== null) {
    el.classList.add("typing");
    el.innerHTML = `<span class="w">${typing.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}<span class="caret"></span></span>`;
  }
}

async function change(edit: { text?: string; effect?: string | null; remove?: boolean }): Promise<void> {
  if (!chosen) return;
  const target = chosen;
  try {
    const res = await fetch("/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: target.id, index: target.index, ...edit }),
    });
    if (!res.ok) warn("That change didn't go through.");
  } catch {
    warn("That change didn't go through. Check your connection.");
  }
}

// What a key does to the chosen word: a letter starts (or carries on) typing
// over it, and Enter or Space puts what's typed in its place; Escape gives
// up; 1, 2, 3 put on or take off Impact, Whisper, Glow; Backspace mends
// what's being typed, or with nothing typed, takes the word away.
function key(k: string): boolean {
  if (!chosen) return false;
  if (typing !== null) {
    if (k === "Enter" || k === " ") {
      const text = typing.trim();
      typing = null;
      if (text) void change({ text });
      markChosen();
    } else if (k === "Escape") {
      typing = null;
      // put the word back as it was
      const ph = myThread()?.querySelector<HTMLElement>(`.phrase[data-id="${chosen.id}"]`);
      if (ph) redrawPhrase(Number(ph.dataset.id));
    } else if (k === "Backspace") typing = typing.slice(0, -1);
    else if (k.length === 1 && typing.length < 40) typing += k;
    else return false;
    markChosen();
    return true;
  }
  const fx = EFFECTS.find((x) => x.key === k)?.id;
  if (fx) {
    const on = myThread()?.querySelector(`.phrase[data-id="${chosen.id}"] .tw[data-i="${chosen.index}"] .w`)?.classList.contains(`fx-${fx}`);
    void change({ effect: on ? null : fx });
    return true;
  }
  if (k === "Backspace" || k === "Delete") {
    void change({ remove: true });
    return true;
  }
  if (k.length === 1 && k !== " " && /\S/u.test(k)) {
    typing = k;
    markChosen();
    return true;
  }
  return false;
}

// While you've something chosen, the keyboard is for it, except in a text box.
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest("input, textarea, [contenteditable]")) return;
  // Space and Enter on a focused button press the button, as they should
  if ((e.key === " " || e.key === "Enter") && t.closest("button")) return;
  if (key(e.key)) e.preventDefault();
});
document.querySelector(".edit-tools")?.addEventListener("click", (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
  if (k) key(k);
});
// your latest word starts out chosen
{
  const last = myThread()?.querySelector<HTMLElement>(".bubble:first-child .phrase");
  const n = last?.querySelectorAll(".tw").length ?? 0;
  if (last && n) choose(Number(last.dataset.id), n - 1, true);
}

// tap one of your own words to choose it; tap it again to go back to following your latest
myThread()?.addEventListener("click", (e) => {
  const w = (e.target as HTMLElement).closest<HTMLElement>(".tw");
  const ph = w?.closest<HTMLElement>(".phrase");
  if (!w || !ph) return;
  const [id, index] = [Number(ph.dataset.id), Number(w.dataset.i)];
  if (chosen?.id === id && chosen.index === index && !followLatest) {
    const last = myThread()?.querySelector<HTMLElement>(".bubble:first-child .phrase");
    const lastIndex = last ? last.querySelectorAll(".tw").length - 1 : -1;
    if (last && lastIndex >= 0) choose(Number(last.dataset.id), lastIndex, true);
  } else choose(id, index);
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
  talk!.querySelector(".label")!.textContent = state ? "Microphone on" : "Turn on microphone";
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

// ---- your face, on your avatar: only for someone who has joined, only if they ask ----

// MediaPipe's face landmarker runs in this page on a small copy of the
// camera, every frame it can keep up with; avatar.ts turns its expression
// scores and head position into a few numbers, smoothed so they hold steady
// without lagging, which draw your avatar here at once and go to everyone
// else's up to SEND_EVERY. Only those numbers leave the browser: no picture.
// The model (about 4 MB) loads the first time someone turns it on.
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const READ_EVERY = 30; // ms: at most this often, slower if reading takes long
const SEND_EVERY = 50; // ms

type Landmarker = {
  detectForVideo(
    video: HTMLVideoElement,
    at: number,
  ): { faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[]; facialTransformationMatrixes?: { data: number[] }[] };
  close(): void;
};

const faceButton = document.getElementById("face") as HTMLButtonElement | null;
let faceOn = false;
let stopFace: (() => void) | undefined;
let myName = document.querySelector<HTMLElement>(".spot.mine")?.dataset.name ?? "";

// Sent as it changes, at most every SEND_EVERY, one at a time (a slow
// connection drops readings rather than queueing them), and again now and
// then while still: the server puts back to rest a face it stops hearing of.
// A change too small to see isn't sent.
let sendingFace = false;
let lastSent = "";
let lastSentAt = 0;
const coarse = (o: Record<string, number> | null): string => (o ? Object.values(o).map((v) => Math.round(v * 40)).join(",") : "-");
async function sendFace(e: Expression | null, pose: Pose | null = null): Promise<void> {
  const key = coarse(e) + "|" + coarse(pose);
  const since = Date.now() - lastSentAt;
  if (sendingFace || since < SEND_EVERY || (key === lastSent && since < 2000)) return;
  sendingFace = true;
  lastSent = key;
  lastSentAt = Date.now();
  try {
    await fetch("/face", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ e, pose }) });
  } catch {
    // a missed reading is soon replaced by the next
  } finally {
    sendingFace = false;
  }
}
// a face lost from view eases back to rest
const ease = <O extends Record<string, number>>(from: O, to: O, k: number): O =>
  Object.fromEntries(Object.keys(to).map((key) => [key, Math.round((from[key] * (1 - k) + to[key] * k) * 100) / 100])) as O;
// Where someone's head usually is, learned slowly (HOME_OVER seconds), so a
// camera off to one side or below the screen reads as facing it, and a
// lean or a turn that's held long enough becomes the new usual.
const HOME_OVER = 15;

async function faceStart(): Promise<void> {
  faceButton!.disabled = true;
  let camera: MediaStream;
  try {
    // big enough to find a face across a desk in a dim room, small enough
    // to read quickly
    camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" } });
  } catch (err) {
    faceButton!.disabled = false;
    const blocked = err instanceof DOMException && err.name === "NotAllowedError";
    return warn(blocked ? "The camera is blocked. Allow it for this site to show your face on your avatar." : "Couldn't open a camera in this browser.");
  }
  say("Looking for your face…");
  let landmarker: Landmarker;
  try {
    const { FaceLandmarker, FilesetResolver } = await import(`${VISION}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    // a stalled download mustn't leave the button stuck
    landmarker = await Promise.race([
      FaceLandmarker.createFromOptions(files, {
        // On the processor: on an M4 Pro it read a face in 12 ms, and on the
        // graphics card in 143 (each frame goes through WebGL to get there).
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
        // found in poorer light, and kept hold of as a face turns, rather
        // than lost and searched for again
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        runningMode: "VIDEO",
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("the face reader took too long to load")), 30_000)),
    ]);
  } catch (err) {
    console.error(err);
    for (const t of camera.getTracks()) t.stop();
    faceButton!.disabled = false;
    return warn("Couldn't load the face reader. Check your connection and try again.");
  }
  // the small preview by the controls, so you can see what it's reading
  const video = (document.getElementById("face-preview") as HTMLVideoElement | null) ?? document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = camera;
  video.hidden = false;
  try {
    await video.play();
  } catch {
    for (const t of camera.getTracks()) t.stop();
    landmarker.close();
    faceButton!.disabled = false;
    return warn("Couldn't start the camera. Try again.");
  }
  const started = Date.now();
  let seenFace = false;
  // whether it can see a face right now, on the preview (a ring) and the
  // button, where the speech model's progress can't write over it
  const label = faceButton!.querySelector(".label")!;
  let showing: boolean | null = null;
  const found = (yes: boolean): void => {
    if (showing === yes) return;
    showing = yes;
    video.classList.toggle("found", yes);
    label.textContent = yes ? "Following your face" : "Looking for your face…";
  };
  found(false);
  let shown: Expression = REST;
  let turned: Pose = STILL;
  const steadyFace = smoother<Expression>(1.2, 0.6);
  const steadyPose = smoother<Pose>(1, 0.8);
  const rest = resting();
  let restNow = rest.rest();
  let home: Placed | undefined;
  let readings = 0;
  let lastAt = 0;
  let wait = READ_EVERY;
  let running = true;
  let lastFrame = -1;
  const read = (): void => {
    if (!running) return;
    schedule();
    // a hidden page (a phone put away) isn't reading anyone's face
    if (document.hidden) return void sendFace(null);
    const now = performance.now();
    if (video.readyState < 2 || now - lastAt < wait || video.currentTime === lastFrame) return;
    lastFrame = video.currentTime;
    const dt = now - lastAt;
    lastAt = now;
    let shapes: { categoryName: string; score: number }[] | undefined;
    let matrix: number[] | undefined;
    try {
      const seen = landmarker.detectForVideo(video, now);
      shapes = seen.faceBlendshapes?.[0]?.categories;
      matrix = seen.facialTransformationMatrixes?.[0]?.data;
    } catch (err) {
      console.error(err);
      return faceStop();
    }
    // a slow device reads less often rather than falling behind: reading
    // takes at most about half the page's time
    const took = performance.now() - now;
    wait = took > 25 ? took * 1.8 : READ_EVERY;
    found(!!shapes);
    if (!shapes) {
      if (Date.now() - started > 4000 && !seenFace) warn("Can't see a face. Face the camera, with light on your face rather than behind you.");
      const k = 1 - Math.exp(-dt / 250);
      shown = ease(shown, REST, k);
      turned = ease(turned, STILL, k);
    } else {
      if (!seenFace) {
        seenFace = true;
        say("Your avatar's following your face. Only numbers about it are sent, never a picture.");
      }
      const scores = Object.fromEntries(shapes.map((c) => [c.categoryName, c.score]));
      rest.add(scores);
      if (++readings % 15 === 0) restNow = rest.rest();
      shown = steadyFace(fromShapes(scores, restNow), now / 1000);
      if (matrix) {
        const at = placed(matrix);
        const k = home ? 1 - Math.exp(-dt / 1000 / HOME_OVER) : 1;
        home = home ? ease(home, at, k) : { ...at };
        turned = steadyPose(poseFrom(matrix, home), now / 1000);
      }
    }
    drawAvatar(myName, shown, turned);
    void sendFace(shown, turned);
  };
  // each new camera frame where the browser says when there is one, the
  // screen's frames where it doesn't
  const schedule = (): void => {
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(read);
    else requestAnimationFrame(read);
  };
  schedule();
  // the camera itself can stop (unplugged, taken by another app)
  for (const t of camera.getVideoTracks()) t.addEventListener("ended", () => faceOn && faceStop());
  stopFace = () => {
    running = false;
    for (const t of camera.getTracks()) t.stop();
    landmarker.close();
    video.srcObject = null;
    video.hidden = true;
    video.classList.remove("found");
  };
  faceOn = true;
  faceButton!.disabled = false;
  faceButton!.setAttribute("aria-pressed", "true");
}

function faceStop(): void {
  stopFace?.();
  stopFace = undefined;
  faceOn = false;
  drawAvatar(myName, REST);
  lastSent = "";
  void sendFace(null);
  faceButton!.setAttribute("aria-pressed", "false");
  faceButton!.querySelector(".label")!.textContent = "Show my face";
}

if (faceButton && "mediaDevices" in navigator) {
  faceButton.hidden = false;
  faceButton.addEventListener("click", () => void (faceOn ? faceStop() : faceStart()));
  // a face showing when you've left the page would be a lie
  addEventListener("pagehide", () => {
    if (faceOn) navigator.sendBeacon("/face", new Blob([JSON.stringify({ e: null })], { type: "application/json" }));
  });
}

// ---- your avatar's look ----

// Each change is saved as it's made, and shows on every open page: drawn
// here at once, sent at most every LOOK_EVERY (a colour picker sends a
// change for every step of a drag).
const LOOK_EVERY = 250; // ms
const lookForm = document.getElementById("look") as HTMLFormElement | null;
let lookTimer: number | undefined;
function lookNow(): Record<string, string> {
  const data = new FormData(lookForm!);
  const look: Record<string, string> = {};
  for (const [k, v] of data) if (k !== "look-tab" && typeof v === "string") look[k] = v;
  return look;
}
function changeLook(): void {
  const look = lookNow();
  const card = cardOf(myName);
  if (card) {
    card.dataset.look = JSON.stringify({ ...(card.dataset.look ? JSON.parse(card.dataset.look) : {}), ...look });
    drawAvatar(myName, expressionOf.get(myName) ?? REST);
  }
  clearTimeout(lookTimer);
  lookTimer = window.setTimeout(async () => {
    try {
      const res = await fetch("/look", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ look }) });
      if (!res.ok) warn("Couldn't save your avatar. Try again.");
    } catch {
      warn("Couldn't save your avatar. Check your connection.");
    }
  }, LOOK_EVERY);
}
lookForm?.addEventListener("change", (e) => {
  if ((e.target as HTMLInputElement).name === "look-tab") return;
  changeLook();
});
// a colour from the picker becomes its row's choice
lookForm?.addEventListener("input", (e) => {
  const picker = e.target as HTMLInputElement;
  if (picker.type !== "color") return;
  const radio = picker.closest("label")?.querySelector<HTMLInputElement>("input[type=radio]");
  if (!radio) return;
  radio.value = picker.value;
  radio.checked = true;
  changeLook();
});
document.getElementById("surprise")?.addEventListener("click", () => {
  const look = randomLook();
  for (const [k, v] of Object.entries(look)) {
    const radio = lookForm?.querySelector<HTMLInputElement>(`input[name="${k}"][value="${v}"]`);
    if (radio) radio.checked = true;
  }
  changeLook();
});
