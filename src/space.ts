// Space's script (view.ts spacePage). Everyone here is their words: each
// "being" on the field is someone's latest phrase, under their name, in
// their colour, where they last put it. You move yours (drag it, or the
// arrow keys and W A S D) toward whoever you want to talk to; where you are
// goes to everyone, and others' words are as clear as you are close
// (hearing.ts: a loud word carries further, too far and you only see that
// someone's talking). What's said is read as words, as colour or as emoji.
import "./popout.ts";
import { apart, clarity, FLOOR, reach, scaleAt, SEEN_AT } from "./hearing.ts";
import { listener } from "./listen.ts";
import { play, tonesAreOn, tonesOn } from "./tones.ts";
import { colourOf, emojiWord, type Lens, type Said as LensSaid, savedLens, saveLens } from "./lens.ts";
import type { Look } from "./packs.ts";
import { canSpeak, hearVoices, speak, type Spoken } from "./speech.ts";
import { KEEP_AFTER, toneOf, typedWords, typing } from "./typed.ts";
import { esc, wordHtml, type Voice, type Word } from "./voice.ts";

const main = document.querySelector<HTMLElement>("main.space-page")!;
const field = document.getElementById("field") as HTMLElement;
const live = document.getElementById("live") as HTMLElement;
const myName = main.dataset.me ?? "";
const heard = document.getElementById("heard") as HTMLElement;

// Where everyone is: 0 to 1 across and down Space's floor (hearing.ts
// FLOOR), the same floor for everyone. On a screen taller than it's wide (a
// phone held upright) it's shown turned a quarter, so it still fills it:
// across the floor is down the screen.
const beings = new Map<string, HTMLElement>();
for (const el of field.querySelectorAll<HTMLElement>(".being")) beings.set(el.dataset.name!, el);
const posOf = (el: HTMLElement): { x: number; y: number } => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) });
const turned = (): boolean => field.clientHeight > field.clientWidth;
// where a place on the floor is on the screen, 0 to 1 each way, and back
const onScreen = (p: { x: number; y: number }): { x: number; y: number } => (turned() ? { x: 1 - p.y, y: p.x } : p);
const onFloor = (p: { x: number; y: number }): { x: number; y: number } => (turned() ? { x: p.y, y: 1 - p.x } : p);
const SPREAD = 10; // px between two beings drawn too close to read

// Each being drawn where it is, unless it would sit on someone else's
// words: then the two are drawn a little apart (only drawn: where they are,
// and how far apart for hearing, doesn't change). Yours stays put.
function layOut(): void {
  const w = field.clientWidth;
  const h = field.clientHeight;
  const boxes = [...beings].map(([name, el]) => {
    const s = onScreen(posOf(el));
    const far = Number(el.style.getPropertyValue("--far")) || 1;
    return { name, el, x: s.x * w, y: s.y * h, bw: el.offsetWidth * far, bh: el.offsetHeight * far, dx: 0, dy: 0, fixed: name === myName };
  });
  for (let round = 0; round < 16; round++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ox = (a.bw + b.bw) / 2 + SPREAD - Math.abs(a.x + a.dx - (b.x + b.dx));
        const oy = (a.bh + b.bh) / 2 + SPREAD - Math.abs(a.y + a.dy - (b.y + b.dy));
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // (apart the shorter way: up and down, usually, as words are wide;
        // but never into the field's edge, where they'd only be put back:
        // the other way, or across, whichever has the room)
        // (half each, or all of it one of them, if the other's against an edge)
        const shares = a.fixed ? [[0, 1]] : b.fixed ? [[1, 0]] : [[0.5, 0.5], [1, 0], [0, 1]];
        const ys = a.y + a.dy <= b.y + b.dy ? -1 : 1;
        const xs = a.x + a.dx <= b.x + b.dx ? -1 : 1;
        const ways: ["x" | "y", number, number][] = oy < ox ? [["y", ys, oy], ["y", -ys, oy], ["x", xs, ox], ["x", -xs, ox]] : [["x", xs, ox], ["x", -xs, ox], ["y", ys, oy], ["y", -ys, oy]];
        const tries = ways.flatMap((way) => shares.map((sh) => [way, sh] as const));
        const [[axis, sign, by], share] = tries.find(([[ax, sg, n], sh]) => fits(a, ax, sg * n * sh[0], w, h) && fits(b, ax, -sg * n * sh[1], w, h)) ?? tries[0];
        if (axis === "y") {
          a.dy += sign * by * share[0];
          b.dy -= sign * by * share[1];
        } else {
          a.dx += sign * by * share[0];
          b.dx -= sign * by * share[1];
        }
      }
    // (kept on the field each round, so two pushed into a corner come apart
    // along its edge, rather than being put back on each other at the end)
    for (const b of boxes) {
      b.dx = within(b.x + b.dx, b.bw, w) - b.x;
      b.dy = within(b.y + b.dy, b.bh, h) - b.y;
    }
    if (!moved) break;
  }
  for (const b of boxes) {
    b.el.style.setProperty("--x", ((b.x + b.dx) / w).toFixed(4));
    b.el.style.setProperty("--y", ((b.y + b.dy) / h).toFixed(4));
  }
}
// a place across the field, kept so a box that wide is all on it
const within = (at: number, size: number, of: number): number => Math.min(Math.max(at, size / 2 + 4), of - size / 2 - 4);
type Box = { x: number; y: number; bw: number; bh: number; dx: number; dy: number };
// whether a box moved that far that way stays on the field
const fits = (b: Box, axis: "x" | "y", by: number, w: number, h: number): boolean => {
  if (!by) return true;
  const at = axis === "x" ? b.x + b.dx + by : b.y + b.dy + by;
  const size = axis === "x" ? b.bw : b.bh;
  return Math.abs(within(at, size, axis === "x" ? w : h) - at) < 0.5;
};
const setAt = (el: HTMLElement, p: { x: number; y: number }): void => {
  el.dataset.x = String(p.x);
  el.dataset.y = String(p.y);
};

function beingFor(name: string, hue: number): HTMLElement {
  let el = beings.get(name);
  if (el) return el;
  el = document.createElement("div");
  el.className = `being${name === myName ? " mine" : ""}`;
  el.dataset.name = name;
  el.style.setProperty("--hue", String(hue));
  setAt(el, { x: 0.5, y: 0.5 });
  el.innerHTML = `<span class="being-words"></span><span class="being-name">${esc(name)}</span>`;
  field.append(el);
  beings.set(name, el);
  return el;
}

// ---- reading: what you can make out of each, from where you are ----

let lens: Lens = savedLens();
// each being's words as said (kept as their numbers, so any lens can draw them)
type Said = LensSaid & { html: string };
const saidOf = new Map<string, Said[]>();
function draw(name: string): void {
  const el = beings.get(name);
  const ws = saidOf.get(name);
  if (!el || !ws) return;
  const box = el.querySelector(".being-words")!;
  box.innerHTML = lens === "words" ? ws.map((w) => w.html).join(" ") : ws.map(lens === "colour" ? colourOf : emojiWord).join("");
  // (a word said high sits higher than the line, and rose out of the top
  // of its pill: the pill grows up as far as the highest goes, and down as
  // far as the lowest)
  const lift = lens === "words" ? 0.07 : 0;
  const hi = Math.max(0, ...ws.map((w) => w.pitch)) * lift;
  const lo = Math.max(0, ...ws.map((w) => -w.pitch)) * lift;
  (box as HTMLElement).style.setProperty("--up", `${Math.min(1.2, hi).toFixed(2)}em`);
  (box as HTMLElement).style.setProperty("--down", `${Math.min(1.2, lo).toFixed(2)}em`);
  hearFrom();
}
const lenses = document.querySelector<HTMLFieldSetElement>(".lenses");
for (const i of lenses?.querySelectorAll<HTMLInputElement>("input") ?? []) i.checked = i.value === lens;
field.dataset.lens = lens;
lenses?.addEventListener("change", (e) => {
  lens = (e.target as HTMLInputElement).value as Lens;
  field.dataset.lens = lens;
  saveLens(lens);
  for (const name of saidOf.keys()) draw(name);
});

// How clear everyone's words are, from where you are: each word's own
// clarity (how loud it was carries it), the being smaller further off, and
// past seeing, only a mark that they're there. Without a place of your own
// (not joined), from the middle.
function hearFrom(): void {
  const mine = beings.get(myName);
  const at = mine ? posOf(mine) : { x: 0.5, y: 0.5 };
  for (const [name, el] of beings) {
    const d = name === myName ? 0 : apart(at, posOf(el));
    el.style.setProperty("--far", scaleAt(d).toFixed(2));
    el.classList.toggle("out", d > SEEN_AT);
    const ws = saidOf.get(name) ?? [];
    const parts = el.querySelectorAll<HTMLElement>(".being-words > *");
    let any = 0;
    parts.forEach((p, i) => {
      const c = clarity(d, ws[i]?.loud ?? 0);
      p.style.setProperty("--clear", c.toFixed(2));
      if (c > 0.08) any++;
    });
    el.classList.toggle("murmur", parts.length > 0 && any === 0);
  }
  layOut();
}
addEventListener("resize", hearFrom);

// tones, on and off (tones.ts): only on a tap, as browsers need for sound
const tonesButton = document.getElementById("tones") as HTMLButtonElement | null;
tonesButton?.addEventListener("click", () => {
  const on = !tonesAreOn();
  tonesOn(on);
  tonesButton.setAttribute("aria-pressed", String(on));
});

// ---- what's said, as it's said ----

type WordOut = { html: string; t: number; d: number; say?: [number, number, number, number?] };
type Phrase = { id: number; name: string; hue: number; text: string; at: number; words: WordOut[]; typed?: true; look?: Look };
const numbersOf = (html: string): { loud: number; pitch: number } => {
  const m = /--loud:(-?[\d.]+);--pitch:(-?[\d.]+)/.exec(html);
  return { loud: Number(m?.[1] ?? 0), pitch: Number(m?.[2] ?? 0) };
};
const textOf = (html: string): string => {
  const s = document.createElement("span");
  s.innerHTML = html;
  s.querySelector(".held")?.remove();
  return s.textContent ?? "";
};
// A phrase said sends a ring out from whoever said it, as far as its
// loudest word carries (hearing.ts reach): how far a word carries shows
// without anyone reading it, the way you'd hear a laugh across a room.
function ripple(el: HTMLElement, loud: number): void {
  const at = onScreen(posOf(el));
  const r = (reach(loud) / FLOOR.w) * (turned() ? field.clientHeight : field.clientWidth);
  const ring = document.createElement("span");
  ring.className = "ripple";
  ring.style.cssText = `left:${(at.x * 100).toFixed(2)}%;top:${(at.y * 100).toFixed(2)}%;--r:${Math.round(r)}px;--hue:${el.style.getPropertyValue("--hue")}`;
  field.prepend(ring);
  ring.addEventListener("animationend", () => ring.remove());
  setTimeout(() => ring.remove(), 3000);
}
// a being keeps its latest phrase up for a while, then quietens to a dot,
// so a field of people who said something an hour ago isn't a wall of words
const QUIET_AFTER = 45_000;
function show(p: { name: string; hue: number; words: WordOut[] }, draft = false): void {
  const el = beingFor(p.name, p.hue);
  saidOf.set(
    p.name,
    p.words.map((w) => ({ ...numbersOf(w.html), w: textOf(w.html), stretch: w.say?.[2] ?? (/class="held"/.test(w.html) ? 1.5 : 0), html: w.html })),
  );
  el.classList.toggle("draft", draft);
  if (!draft) {
    const ws = saidOf.get(p.name)!;
    ripple(el, Math.max(0, ...ws.map((w) => w.loud)));
    // (heard as notes, if tones are on: as clear as the words would be)
    if (tonesAreOn() && p.name !== myName) {
      const mine = beings.get(myName);
      const d = apart(mine ? posOf(mine) : { x: 0.5, y: 0.5 }, posOf(el));
      const hue = Number(el.style.getPropertyValue("--hue")) || 0;
      play(p.words.map((w, i) => ({ t: w.t, d: w.d, loud: ws[i]?.loud ?? 0, pitch: ws[i]?.pitch ?? 0, stretch: ws[i]?.stretch ?? 0 })), Math.max(...ws.map((w) => clarity(d, w.loud)), 0), hue);
    }
  }
  el.dataset.at = String(Date.now());
  el.classList.remove("quiet");
  el.classList.remove("speaking");
  void el.offsetWidth;
  el.classList.add("speaking");
  draw(p.name);
}
setInterval(() => {
  for (const el of beings.values()) el.classList.toggle("quiet", Date.now() - Number(el.dataset.at ?? 0) > QUIET_AFTER);
}, 5000);
// (what the server drew the page with, as numbers too)
for (const el of beings.values()) {
  const words = [...el.querySelectorAll<HTMLElement>(".being-words .w")].map((w) => ({ html: w.outerHTML, t: 0, d: 0 }));
  if (words.length) {
    saidOf.set(el.dataset.name!, words.map((w) => ({ ...numbersOf(w.html), w: textOf(w.html), stretch: /class="held"/.test(w.html) ? 1.5 : 0, html: w.html })));
    draw(el.dataset.name!);
  }
  const at = Number(el.dataset.at ?? 0);
  el.dataset.at = String(at || 0);
  el.classList.toggle("quiet", Date.now() - at > QUIET_AFTER);
}
hearFrom();

// Typed words read aloud, for anyone who turns voices on (in their writer's
// voice, the way they were typed), if they're near enough to hear them.
const spoken = (ws: WordOut[]): Spoken[] => ws.map((w) => ({ text: textOf(w.html), loud: w.say?.[0] ?? 0, pitch: w.say?.[1] ?? 0, stretch: w.say?.[2] ?? 0, rise: w.say?.[3] ?? 0 }));

// ---- live ----

let lastSeen = Number(main.dataset.upTo) || "now";
let wait = 1000;
function connect(): void {
  const stream = new EventSource(`events?after=${lastSeen}`);
  stream.addEventListener("open", () => {
    wait = 1000;
    live.hidden = false;
    live.classList.add("on");
    live.textContent = "Live";
  });
  stream.addEventListener("error", () => {
    live.classList.remove("on");
    live.textContent = "Reconnecting…";
    if (stream.readyState !== EventSource.CLOSED) return;
    setTimeout(connect, wait);
    wait = Math.min(wait * 2, 30_000);
  });
  const on = <T>(name: string, f: (v: T) => void): void => stream.addEventListener(name, (e) => f(JSON.parse((e as MessageEvent<string>).data) as T));
  on<Phrase>("said", (p) => {
    if (typeof lastSeen === "number" && p.id <= lastSeen) return;
    lastSeen = p.id;
    show(p);
    heard.textContent = `${p.name}${p.typed ? " (typed)" : ""}: ${p.text}`;
    const el = beings.get(p.name);
    const mine = beings.get(myName);
    if (p.typed && p.name !== myName && p.look && el && mine && apart(posOf(el), posOf(mine)) < SEEN_AT / 2) speak(spoken(p.words), p.look);
  });
  on<{ name: string; hue: number; words: WordOut[] }>("early", (d) => d.name !== myName && show(d, true));
  on<{ name: string; hue: number; x: number; y: number }>("spot", (s) => {
    if (s.name === myName && dragging) return;
    setAt(beingFor(s.name, s.hue), s);
    hearFrom();
  });
  on<{ name: string; hue: number; look: Look; x?: number; y?: number }>("joined", (j) => {
    const el = beingFor(j.name, j.hue);
    if (j.x !== undefined && j.y !== undefined) setAt(el, { x: j.x, y: j.y });
    hearFrom();
  });
}
connect();

// ---- moving yourself ----

const me = beings.get(myName);
let dragging = false;
let sendAt = 0;
let pending: number | undefined;
// where you are goes out as you move, a few times a second, and once more
// where you stop
function place(x: number, y: number): void {
  if (!me) return;
  const c = (n: number): number => Math.round(Math.min(0.97, Math.max(0.03, n)) * 1000) / 1000;
  setAt(me, { x: c(x), y: c(y) });
  hearFrom();
  clearTimeout(pending);
  const go = (): void => {
    sendAt = Date.now();
    void fetch("spot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(posOf(me)) }).catch(() => {});
  };
  if (Date.now() - sendAt > 150) go();
  else pending = window.setTimeout(go, 160);
}
const placeOnScreen = (x: number, y: number): void => {
  const p = onFloor({ x, y });
  place(p.x, p.y);
};
if (me) {
  me.addEventListener("pointerdown", (e) => {
    dragging = true;
    me.setPointerCapture(e.pointerId);
    me.classList.add("held");
    const r = field.getBoundingClientRect();
    const start = onScreen(posOf(me));
    const [x0, y0] = [e.clientX, e.clientY];
    const move = (ev: PointerEvent): void => placeOnScreen(start.x + (ev.clientX - x0) / r.width, start.y + (ev.clientY - y0) / r.height);
    const up = (): void => {
      dragging = false;
      me.classList.remove("held");
      me.removeEventListener("pointermove", move);
      me.removeEventListener("pointerup", up);
      me.removeEventListener("pointercancel", up);
    };
    me.addEventListener("pointermove", move);
    me.addEventListener("pointerup", up);
    me.addEventListener("pointercancel", up);
  });
  // a tap on the field (not on anyone) takes you there
  field.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".being")) return;
    const r = field.getBoundingClientRect();
    me.classList.add("gliding");
    placeOnScreen((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    setTimeout(() => me.classList.remove("gliding"), 500);
  });
  // the keys, held, move you smoothly
  const keys = new Set<string>();
  const STEP = 0.3; // of the field's longer side a second
  let last = 0;
  const tick = (t: number): void => {
    if (!keys.size) return void (last = 0);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    const p = onScreen(posOf(me));
    const dx = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    const dy = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    // (right on the screen is right, whichever way the floor's shown)
    const long = Math.max(field.clientWidth, field.clientHeight);
    placeOnScreen(p.x + (dx * STEP * dt * long) / field.clientWidth, p.y + (dy * STEP * dt * long) / field.clientHeight);
    requestAnimationFrame(tick);
  };
  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) return;
    e.preventDefault();
    if (!keys.size) requestAnimationFrame(tick);
    keys.add(k);
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());
}

// ---- saying something: talking or typing ----

const status = document.getElementById("status");
let holdUntil = 0;
const say = (t: string): void => {
  if (status && Date.now() > holdUntil) status.textContent = t;
};
const warn = (t: string): void => {
  if (!status) return;
  status.textContent = t;
  holdUntil = Date.now() + 6000;
};
async function post(words: Word[], voice: Voice | null, draft?: number, typed = false): Promise<void> {
  try {
    const res = await fetch("say", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words, voice, draft, ...(typed ? { typed } : {}) }) });
    if (res.status === 429) warn("That's a lot at once. Some of it didn't send.");
    else if (!res.ok) warn("That didn't send.");
  } catch {
    warn("That didn't send. Check your connection.");
  }
}
// your own words show on you at once, before the round trip
const showMine = (ws: Word[], draft = false): void => show({ name: myName, hue: 0, words: ws.map((w) => ({ html: wordHtml(w), t: w.start, d: w.end - w.start, say: [w.loud, w.pitch ?? 0, w.stretch, w.rise] })) }, draft);

const typeBox = document.getElementById("type-box") as HTMLFormElement | null;
if (typeBox && me) {
  const input = typeBox.elements.namedItem("text") as HTMLInputElement;
  const tone = (): ReturnType<typeof toneOf> => toneOf((typeBox.elements.namedItem("tone") as HTMLSelectElement).value);
  // each word out as it's finished with a space, the line kept on Enter or
  // a pause (typed.ts typing), as in a room
  const typed = typing();
  const draftNo = (): number => 1_000_000 + typed.line();
  let keepTimer = 0;
  const keep = (): void => {
    clearTimeout(keepTimer);
    const forDraft = draftNo();
    const text = typed.done(input.value);
    input.value = "";
    const ws = text ? typedWords(text, tone()) : [];
    if (!ws.length) return void me.classList.remove("draft");
    showMine(ws);
    void post(ws, null, forDraft, true);
  };
  input.addEventListener("input", () => {
    clearTimeout(keepTimer);
    const sofar = typed.changed(input.value);
    if (sofar !== null) {
      const ws = typedWords(sofar, tone());
      if (ws.length) {
        showMine(ws, true);
        void fetch("early", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: ws, draft: draftNo() }) }).catch(() => {});
      }
    }
    if (input.value.trim() && /\s$/.test(input.value)) keepTimer = window.setTimeout(keep, KEEP_AFTER);
  });
  typeBox.addEventListener("submit", (e) => {
    e.preventDefault();
    keep();
  });
  const talk = document.getElementById("talk") as HTMLButtonElement;
  const mic = listener({
    say,
    warn,
    level: (l) => talk.style.setProperty("--level", l.toFixed(2)),
    phrase: async (ws, voice, draft) => {
      showMine(ws);
      await post(ws, voice, draft);
    },
    early: (ws, draft) => {
      showMine(ws, true);
      void fetch("early", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: ws, draft }) }).catch(() => {});
    },
    dropped: () => me.classList.remove("draft"),
    on: (state) => {
      talk.disabled = false;
      talk.classList.toggle("recording", state);
      talk.setAttribute("aria-pressed", String(state));
      talk.querySelector(".label")!.textContent = state ? "Listening" : "Talk";
    },
  });
  if (mic.can) {
    talk.disabled = false;
    talk.addEventListener("click", () => mic.toggle());
    say("Getting the speech model ready (about 80 MB, once). You can type meanwhile.");
    const warm = (): void => void setTimeout(() => mic.warm(), 600);
    if (document.readyState === "complete") warm();
    else addEventListener("load", warm, { once: true });
  } else {
    talk.hidden = true;
    say("This browser can't record here. You can type.");
  }
  // typed words from others read aloud, once someone's tapped anywhere
  // (browsers won't speak before one)
  if (canSpeak) addEventListener("pointerdown", () => hearVoices(true), { once: true });
}
