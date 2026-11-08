import type { Message, Person, RoomInfo } from "./db.ts";
import { ago, esc, handBadge, hueOf, queueHtml, reactionsHtml, wordHtml, type Word } from "./voice.ts";
import { avatarSvg, REST, type Expression } from "./avatar.ts";
import { COLOURS, EFFECTS, EMOTES, lookFor, MORE_EXTRAS, PARTS, REACTIONS, SCENE_PARTS, SCENES, SLIDERS, STYLES, VOICES_IN_ORDER, type ColourPart, type Look, type Part, type Scene } from "./packs.ts";
import { TONES } from "./typed.ts";

// a working title, here so it changes in one place
export const APP = "Said";

// three.js, one copy for the page and its add-ons (the room's lighting and
// camera), which ask for it as "three"
export const THREE = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
const THREE_ADDONS = "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/";

// How it works, behind a "?" in the header: everything a newcomer needs,
// out of the way of everyone who doesn't.
const HELP = `<details class="help">
  <summary aria-label="How it works">?</summary>
  <div class="help-body">
    <p>Turn your microphone on and talk. Your words appear for everyone as you say them: louder is heavier, higher sits higher, drawn-out sounds repeat (sooo).</p>
    <p>Tap any of your words (your latest is chosen already) to type over it, delete it, or press <kbd>1</kbd> to <kbd>${EFFECTS.length}</kbd> for an effect (${EFFECTS.map((e) => e.label).join(", ")}), live, for everyone.</p>
    <p>Show your face and your avatar pulls the faces you pull and turns as you turn. Your voice and face are read in this browser; only words, how they were said, and a handful of numbers about your face leave it. No recording or picture is kept anywhere.</p>
    <p>Hands too, and your avatar's arms and hands follow yours: a thumbs up, a wave or a peace sign sets off its emote. Raise your hand (<kbd>Shift</kbd> <kbd>R</kbd>) to take a place in the queue to speak.</p>
    <p>Hear voices, and what everyone says is spoken in the voice they chose, the way they said it. ✨ Natural voices sound like people and the same on every device (a download, once, made and played in this browser). Pick yours in Customise. Headphones stop it coming back through your microphone.</p>
    <p>Or type it instead: pick how it's said (excited, calm, asking, sarcastic…) and it goes up like anything said, a word at a time as you type (each space sends the words so far; Enter, or a pause, finishes the line), spoken in your voice. <kbd>*stars*</kbd> or CAPS make a word stand out. Typed messages are marked ⌨.</p>
  </div>
</details>`;

// Ways to read what's said (lens.ts): in Space, and over heads in the room
const LENSES = [
  { id: "words", label: "Words", icon: "Aa" },
  { id: "colour", label: "Colour", icon: "🎨" },
  { id: "emoji", label: "Emoji", icon: "😀" },
] as const;

export function layout(title: string, body: string, script = "", help = HELP, middle = ""): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:,">
<script type="importmap">{"imports":{"three":"${THREE}","three/addons/":"${THREE_ADDONS}"}}</script>
<script>/* the fade from one page to the next (style.css @view-transition) is
skipped by the browser now and then (after a form is sent, on a phone);
skipped is fine, but its promises then fail with no one to hear it */
for (const t of ["pagereveal", "pageswap"]) addEventListener(t, (e) => { const v = e.viewTransition; if (v) for (const p of [v.ready, v.finished, v.updateCallbackDone]) p?.catch(() => {}); });</script>
${script}
</head>
<body>
<header class="top"><a href="/" class="name">${APP}</a>${middle}<nav><a href="/rooms">Rooms</a><a href="/r/space/">Space</a><a href="/readme/">About</a>${help}</nav></header>
${body}
</body>
</html>`;
}

const MESSAGES: Record<string, string> = {
  "name-bad": "Pick a name between 1 and 20 characters.",
  "name-taken": "Someone here already goes by that name.",
  "no-person": "Pick a name first.",
  "too-many-joins": "That's a lot of new names from here at once. Try again in a few minutes.",
  "room-name-bad": "Give the room a name between 1 and 40 characters.",
  "too-many-rooms": "You've made a lot of rooms. Use one of yours, or try again later.",
  "not-a-scene": "That's not one of the looks on offer.",
};

// A person's thread: what they've said lately as text messages, oldest at
// the top, a new bubble after a long silence, a new line inside one at each
// pause. Each word keeps how it was said, and carries where it lives (the
// message and its place in it) so its speaker can change it, live.
const NEW_BUBBLE = 4000; // ms of silence between phrases that starts a new bubble
const NEW_LINE = 0.7; // seconds of pause inside a phrase that starts a new line
// (one typed rather than said is marked as typed: style.css)
type Said = { id: number; words: Word[]; at: number; reactions?: Record<number, Record<string, number>>; typed?: true };
export function phraseHtml(m: Said): string {
  return `<span class="phrase${m.typed ? " typed" : ""}" data-id="${m.id}"${m.typed ? ' title="Typed"' : ""}>${m.words
    .map((w, i) => {
      const gap = i + 1 < m.words.length ? m.words[i + 1].start - w.end : 0;
      return `<span class="tw" data-i="${i}">${wordHtml(w)}${reactionsHtml(m.reactions?.[i])}</span>${gap > NEW_LINE ? "<br>" : " "}`;
    })
    .join("")}</span>`;
}
// Newest first, top down: the latest bubble at the top, and in each bubble
// the latest phrase at the top, so what was just said is always where the
// eye lands, under the word being said.
export function threadHtml(messages: Said[]): string {
  const bubbles: { at: number; phrases: string[] }[] = [];
  for (const m of messages) {
    const last = bubbles.at(-1);
    if (last && m.at - last.at <= NEW_BUBBLE) {
      last.phrases.unshift(phraseHtml(m));
      last.at = m.at;
    } else bubbles.push({ at: m.at, phrases: [phraseHtml(m)] });
  }
  return bubbles
    .reverse()
    .map((b) => `<li class="bubble" data-at="${b.at}">${b.phrases.join("<br>")}</li>`)
    .join("");
}

// A person's card: their avatar (pulling the expression they're pulling, if
// they're showing their face) and name; the word they're saying, large; and
// their thread underneath, scrolled to the latest. The live word is hidden
// from screen readers, which hear each whole phrase from the page's one live
// region instead.
export function spotHtml(name: string, seat: number, look: Look, mine = false, e: Expression = REST, thread: { id: number; words: Word[]; at: number }[] = [], place = 0, gone = false): string {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  // how their words are drawn: their word style (packs.ts), which the CSS
  // the server makes from it reads off data-words, and its lettering
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)}" data-words="${st.id}" data-font="${st.font}"${"glow" in st ? " data-glow" : ""} data-look="${esc(JSON.stringify(look))}"${place ? ` data-hand="${place}"` : ""}${gone ? " data-away" : ""}>
    <div class="spot-head"><span class="spot-avatar">${avatarSvg(look, e, `${name}'s avatar`)}</span><p class="spot-name"><span class="who">${esc(name)}</span>${handBadge(place)}${mine ? '<span class="you">you</span>' : ""}</p></div>
    <p class="spot-word" aria-hidden="true"></p>
    <ol class="thread" aria-label="What ${esc(name)} said lately">${threadHtml(thread)}</ol>
  </li>`;
}

// What someone can choose about their avatar, from packs.ts: a row of
// choices for each part, grouped into tabs, and for each colour a row of
// swatches and a picker for any colour at all. Plain radio buttons, so it
// works and reads the same to a screen reader without the page's script.
const SECTIONS: { label: string; parts: (Part | ColourPart)[]; sliders?: string }[] = [
  { label: "Face", parts: ["face", "skin", "ears", "nose"], sliders: "Face" },
  { label: "Hair", parts: ["hair", "hairColour", "brows", "beard"], sliders: "Hair" },
  { label: "Eyes", parts: ["eyes", "eyeColour"], sliders: "Eyes" },
  { label: "Mouth", parts: ["mouth"], sliders: "Mouth" },
  { label: "Wearing", parts: ["extra", "extraColour"] },
  { label: "Body", parts: ["top", "topColour"], sliders: "Body" },
  { label: "Words", parts: ["words"] },
  { label: "Voice", parts: ["voice", "blend"] },
];
const PART_LABELS: Record<Part, string> = { words: "Style", face: "Shape", hair: "Style", brows: "Brows", eyes: "Eyes", nose: "Nose", mouth: "Mouth", ears: "Ears", beard: "Beard", extra: "Wearing", top: "Top", voice: "Voice", blend: "Mix in" };

// Everything someone can choose about how they look, in tabs: for each
// part a row of choices, for each colour a row of swatches and a picker for
// any colour, the part's sliders, and what else to wear. Plain inputs in a
// form, so it works and reads the same to a screen reader without script;
// the studio's script makes it live.
function lookEditor(look: Look): string {
  const isColour = (k: string): k is ColourPart => k in COLOURS;
  const row = (k: Part | ColourPart): string => {
    if (isColour(k)) {
      const c = COLOURS[k];
      const custom = !(c.swatches as readonly string[]).includes(look[k]);
      return `<fieldset class="pick"><legend>${c.label}</legend>${c.swatches
        .map((v) => `<label><input type="radio" name="${k}" value="${v}"${look[k] === v ? " checked" : ""}><span><span class="swatch" style="background:${v}"></span><span class="visually-hidden">${v}</span></span></label>`)
        .join("")}<label class="any-colour" title="Any colour"><input type="radio" name="${k}" value="${esc(look[k])}"${custom ? " checked" : ""} data-custom><span><input type="color" value="${esc(look[k])}" data-for="${k}" aria-label="Any ${c.label.toLowerCase()} colour"></span></label></fieldset>`;
    }
    // another voice mixed in, and how much (natural voices only)
    if (k === "blend")
      return `<fieldset class="pick blends"><legend>Mixed with another voice <small>(natural voices only)</small></legend>${PARTS.blend.map((c) => `<label><input type="radio" name="blend" value="${c.id}"${look.blend === c.id ? " checked" : ""}><span>${esc(c.label)}</span></label>`).join("")}</fieldset>${sliders("Blend")}`;
    // voices, with how each sounds under its name
    if (k === "voice")
      return `<fieldset class="pick voices"><legend>Voice <small>(highest first)</small></legend>${VOICES_IN_ORDER.map((v) => `<label><input type="radio" name="voice" value="${v.id}"${look.voice === v.id ? " checked" : ""}><span><b>${esc(v.label)}</b><small>${esc(v.about)}</small></span></label>`).join("")}</fieldset>${sliders("Voice")}`;
    return `<fieldset class="pick"><legend>${PART_LABELS[k]}</legend>${(PARTS[k] as readonly { id: string; label: string }[])
      .map((c) => `<label><input type="radio" name="${k}" value="${c.id}"${look[k] === c.id ? " checked" : ""}><span>${esc(c.label)}</span></label>`)
      .join("")}</fieldset>`;
  };
  const tune = (look.tune ?? {}) as Record<string, number>;
  const sliders = (group: string): string => {
    const these = SLIDERS.filter((sl) => sl.group === group);
    return these.length
      ? `<fieldset class="sliders">${group === "Blend" || group === "Voice" ? "" : "<legend>Shape</legend>"}${these
          .map((sl) => `<label class="slider"><span>${esc(sl.label)}</span><input type="range" name="tune.${sl.id}" min="-1" max="1" step="0.05" value="${tune[sl.id] ?? 0}"><button type="button" class="reset" data-reset="${sl.id}" aria-label="Reset ${esc(sl.label.toLowerCase())}">↺</button></label>`)
          .join("")}</fieldset>`
      : "";
  };
  const more = new Set(look.more ?? []);
  const wearMore = `<fieldset class="pick more"><legend>As well</legend>${PARTS.extra
    .filter((c) => c.id !== "none")
    .map((c) => `<label><input type="checkbox" name="more" value="${c.id}"${more.has(c.id) ? " checked" : ""}><span>${esc(c.label)}</span></label>`)
    .join("")}<p class="hint">Up to ${MORE_EXTRAS} besides the one above.</p></fieldset>`;
  // how it sounds: tried out here, and said honestly to sound a little
  // different on each device (each has its own voices)
  const voiceMore = `<div class="voice-try"><button type="button" id="hear-voice">🔊 Hear it</button>
        <label class="natural-pick" hidden><input type="checkbox" id="studio-natural"> <span>✨ Natural voices: the same on every device (a download, once)</span></label>
        <label class="natural-pick fast-pick" hidden><input type="checkbox" id="studio-small"> <span>The smaller download (90 MB instead of 330), slower: for a device short of space</span></label>
        <p id="voice-status" class="hint" aria-live="polite"></p>
        <p class="hint">How your words sound to anyone with voices on: loud words louder, high words higher, drawn-out words slower. With natural voices on, they hear this voice; without, their device's nearest, which differs a little on each.</p></div>`;
  return `<form id="look" class="look-form">
      <div class="look-tabs" role="tablist">${SECTIONS.map((sec, i) => `<label class="look-tab"><input type="radio" name="look-tab" value="${i}"${i === 0 ? " checked" : ""}><span>${sec.label}</span></label>`).join("")}</div>
      ${SECTIONS.map((sec, i) => `<div class="look-section" data-section="${i}">${sec.parts.map(row).join("")}${sec.sliders ? sliders(sec.sliders) : ""}${sec.label === "Wearing" ? wearMore : ""}${sec.label === "Voice" ? voiceMore : ""}</div>`).join("")}
    </form>`;
}

// looks someone has saved, to wear again in a tap (a flat face of each)
const savedSlots = (saved: (Look | null)[]): string =>
  saved
    .map(
      (l, i) =>
        `<div class="saved-look"><button type="button" class="wear" data-slot="${i}"${l ? ` data-look="${esc(JSON.stringify(l))}"` : " disabled"} aria-label="${l ? `Wear saved look ${i + 1}` : `Slot ${i + 1} is empty`}">${l ? avatarSvg(l, REST, "") : `<span class="empty">${i + 1}</span>`}</button><button type="button" class="keep" data-slot="${i}" title="Save how you look now to slot ${i + 1}">Save</button></div>`,
    )
    .join("");

// The studio: making your avatar, on a screen of its own. Your head large,
// live (turn it, zoom it, have it follow your face, try an emote), and
// everything about it beside it. Each change shows at once and is saved
// for everyone a moment later.
export function studioPage(me: Person, look: Look, saved: (Look | null)[], hue: number, from = "/"): string {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  return layout(
    `${APP}: your avatar`,
    `<main class="studio">
  <h1 class="visually-hidden">Your avatar</h1>
  <section class="stage-3d" aria-label="Preview" style="--hue:${hue}">
    <div class="preview spot mine" data-name="${esc(me.name)}" style="--hue:${hue}" data-words="${st.id}" data-font="${st.font}" data-look="${esc(JSON.stringify(look))}">
      <span class="spot-avatar preview-head">${avatarSvg(look, REST, `${me.name}'s avatar`)}</span>
      <p class="preview-name"><span class="who">${esc(me.name)}</span></p>
      <p class="preview-words words" aria-hidden="true"></p>
    </div>
    <p class="preview-help">Drag to turn · scroll or pinch to zoom</p>
    <div class="preview-tools">
      <button type="button" id="studio-face" aria-pressed="false">Follow my face</button>
      <button type="button" id="studio-hands" aria-pressed="false" hidden>Hands too</button>
      <button type="button" id="studio-front">Face front</button>
      <button type="button" id="studio-faces" aria-pressed="false">Pull faces</button>
      <select id="studio-emote" aria-label="Try an emote"><option value="">Try an emote…</option>${EMOTES.map((em) => `<option value="${em.id}">${em.burst ? em.burst + " " : ""}${esc(em.label)}</option>`).join("")}</select>
    </div>
  </section>
  <section class="editor" aria-label="Choose how you look">
    <div class="editor-head">
      <a href="${esc(from)}" class="done">Done</a>
      <div class="history"><button type="button" id="undo" disabled aria-label="Undo">↶ Undo</button><button type="button" id="redo" disabled aria-label="Redo">Redo ↷</button></div>
      <button type="button" class="surprise" id="surprise">Surprise me</button>
    </div>
    <p id="status" class="status" aria-live="polite"></p>
    <div class="saved-looks" aria-label="Saved looks">${savedSlots(saved)}</div>
    ${lookEditor(look)}
  </section>
</main>`,
    `<script type="module" src="/js/studio.ts"></script>`,
  );
}

// Typing instead of talking: a message written here goes up word by word
// and is spoken (for anyone with voices on) like a spoken one, in your
// voice, the way it's written and in the tone picked (typed.ts). Your voice
// is the one from the studio, changeable here too. Needs the page's script.
function typeBox(look: Look): string {
  const tune = (look.tune ?? {}) as Record<string, number>;
  const slider = (id: string, label: string): string =>
    `<label class="slider"><span>${label}</span><input type="range" name="tune.${id}" min="-1" max="1" step="0.05" value="${tune[id] ?? 0}"></label>`;
  return `<form id="type-box" class="type-box" hidden>
          <label for="typed" class="visually-hidden">Type instead of talking</label>
          <div class="type-row"><input id="typed" name="text" type="text" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Or type here…"><button type="submit" class="type-send" disabled>Say it</button></div>
          <fieldset class="tones"><legend class="visually-hidden">How it's said</legend>${TONES.map((t, i) => `<label><input type="radio" name="tone" value="${t.id}"${i === 0 ? " checked" : ""}><span><span aria-hidden="true">${t.emoji}</span> ${t.label}</span></label>`).join("")}</fieldset>
          <details class="type-voice"><summary>Your voice</summary>
            <div class="type-voice-body">
              <label class="voice-pick"><span>Voice</span><select name="voice">${VOICES_IN_ORDER.map((v) => `<option value="${v.id}"${look.voice === v.id ? " selected" : ""}>${esc(v.label)}: ${esc(v.about)}</option>`).join("")}</select></label>
              ${slider("voicePitch", "Pitch")}${slider("voiceSpeed", "Speed")}
              <button type="button" class="type-hear">🔊 Hear it first</button>
              <p class="hint">*Stars* or CAPS make a word stand out, ! makes it louder, sooo draws it out, (brackets) say it aside, and a ? asks. Everyone with voices on hears it in this voice; it's marked as typed.</p>
            </div>
          </details>
        </form>`;
}

// The welcome, said the way the app draws what's said: "say it how you
// MEAN it", the "say" a little up, "mean" loud and high, "it" drawn out.
const w = (word: string, loud: number, pitch: number, stretch = 0): Word => ({ w: word, start: 0, end: 0, loud, pitch, rise: 0, stretch, held: stretch ? 0.5 : null, contour: [] });
// (on two lines, "mean it" on its own)
const HERO = [[w("say", 2, 2), w("it", -2, 0), w("how", -1, -1), w("you", -2, -1)], [w("mean", 9, 5), w("it", 3, 2, 0.8)]].map((line) => `<span class="hero-line">${line.map((x) => wordHtml(x)).join(" ")}</span>`).join(" ");

// One line of the brief record: who, in their colour, what they said, when.
export const lineHtml = (l: { name: string; seat: number; text: string; until: number; face?: string | null }, now = Date.now()): string =>
  `<li style="--hue:${hueOf(l.seat)}" data-name="${esc(l.name)}" data-until="${l.until}"><strong>${l.face ? `${esc(l.face)} ` : ""}${esc(l.name)}</strong> <span class="said-text">${esc(l.text)}</span> <time data-at="${l.until}">${ago(l.until, now)}</time></li>`;

// The room someone's in, as the switcher at the top shows it: its name,
// and a menu of the others to go to, and a way to make one.
type Here = RoomInfo & { mine: boolean };
const roomHref = (r: { id: number; slug: string }): string => (r.id === 1 ? "/" : `/r/${r.slug}/`);
function switcher(here: Here, rooms: (RoomInfo & { lately: number })[]): string {
  const others = rooms.filter((r) => r.id !== here.id).slice(0, 8);
  return `<details class="room-switch">
    <summary><span class="room-switch-name">${esc(here.name)}</span><span class="room-switch-caret" aria-hidden="true"></span></summary>
    <div class="room-switch-menu" role="menu">
      ${others.map((r) => `<a role="menuitem" href="${roomHref(r)}"><span>${esc(r.name)}</span>${r.lately ? `<small>${r.lately} lately</small>` : ""}</a>`).join("")}
      <a role="menuitem" class="all" href="/rooms">All rooms · make one</a>
    </div>
  </details>`;
}

// A room's own settings, for whoever made it: its name, its look, whether
// it's listed. Changes go to everyone in it at once.
function roomSettings(here: Here): string {
  if (!here.mine) return "";
  const part = (p: keyof typeof SCENE_PARTS, label: string): string =>
    `<fieldset class="pick scene-pick"><legend>${label}</legend>${(SCENE_PARTS[p] as readonly { id: string; label: string; emoji?: string; colour?: string; colours?: readonly string[] }[])
      .map(
        (o) =>
          `<label><input type="radio" name="${p}" value="${o.id}"${here.scene[p] === o.id ? " checked" : ""}><span${o.colour ? ` class="tint" style="--c:${o.colour}"` : o.colours ? ` class="tint" style="--c:${o.colours[0] ?? "transparent"};--c2:${o.colours[1] ?? "transparent"}"` : ""}>${o.emoji ? `<span aria-hidden="true">${o.emoji}</span> ` : ""}${esc(o.label)}</span></label>`,
      )
      .join("")}</fieldset>`;
  return `<details class="room-settings">
    <summary>Room settings</summary>
    <form class="room-settings-body" data-room-settings>
      <label class="field"><span>Name</span><input name="name" maxlength="40" value="${esc(here.name)}" required></label>
      <fieldset class="pick scene-pick themes"><legend>Start from</legend>${SCENES.map((t) => `<label><input type="radio" name="theme" value="${t.id}" data-scene="${esc(JSON.stringify(t.scene))}"><span><span aria-hidden="true">${t.emoji}</span> ${esc(t.label)}</span></label>`).join("")}</fieldset>
      ${part("sky", "Outside")}${part("walls", "Walls")}${part("floor", "Floor")}${part("rug", "Rug")}
      <label class="check"><input type="checkbox" name="listed"${here.listed ? " checked" : ""}><span>Listed for anyone to find (otherwise only those with the link)</span></label>
      <p class="fine room-link">Link: <code>${esc(roomHref(here))}</code> <button type="button" class="copy-link">Copy link</button></p>
    </form>
  </details>`;
}

export function roomPage(
  people: { name: string; seat: number }[],
  me: (Person & { seat: number }) | undefined,
  msg: string | undefined,
  lines: { name: string; seat: number; text: string; until: number; face?: string | null }[] = [],
  expressions: Map<string, Expression> = new Map(),
  lookOf: (name: string) => Look = () => lookFor(0),
  threads: Map<string, Said[]> = new Map(),
  saved: (Look | null)[] = [],
  queue: string[] = [],
  away: string[] = [],
  upTo = 0,
  here: Here = { id: 1, slug: "main", name: "The main room", scene: SCENES[0].scene, listed: true, maker: null, made_at: 0, mine: false },
  rooms: (RoomInfo & { lately: number })[] = [],
): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const myLook = me ? lookOf(me.name) : null;
  const place = (name: string): number => queue.indexOf(name) + 1;
  const mine = me ? spotHtml(me.name, me.seat, myLook!, true, expressions.get(me.name), threads.get(me.name), place(me.name)) : "";
  const others = people
    .filter((p) => p.name !== me?.name)
    .map((p) => spotHtml(p.name, p.seat, lookOf(p.name), false, expressions.get(p.name), threads.get(p.name), place(p.name), away.includes(p.name)))
    .join("");
  const up = me ? queue.includes(me.name) : false;
  const count = people.filter((p) => !away.includes(p.name)).length;

  // a word of someone else's, tapped, offers these
  const picker = me ? `<div id="react-picker" class="react-picker" role="menu" hidden>${REACTIONS.map((r) => `<button type="button" role="menuitem" data-reaction="${r.id}" title="${r.label}">${r.emoji}</button>`).join("")}</div>` : "";

  // Joined: the room (or everyone as cards) on the wide side, and you on the
  // narrow one: your card, a panel to say something, and the rest of what
  // you can do in tabs under it. The same in either view. Not joined: a way
  // in, and the room to watch.
  const tab = (id: string, label: string, on = false): string => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${on}"${on ? "" : ' tabindex="-1"'}>${label}</button>`;
  const centre = me
    ? `<section class="me" aria-label="You">
        <ul class="mine-card">${mine}</ul>
        <div class="say-panel">
          <div class="controls">
            <button id="talk" type="button" class="talk" aria-pressed="false" disabled><span class="dot"></span><span class="label">Turn on microphone</span></button>
            <form method="post" action="hand" class="hand-form"><input type="hidden" name="up" value="${up ? "false" : "true"}"><button id="hand" type="submit" class="hand-toggle" aria-pressed="${up}" title="Raise your hand to speak next (Shift+R)"><span aria-hidden="true">✋</span> <span class="label">${up ? "Lower hand" : "Raise hand"}</span></button></form>
          </div>
          <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
          ${typeBox(myLook!)}
        </div>
        <div class="me-tabs">
          <div class="tabs" role="tablist" aria-label="More you can do">${tab("emotes", "Emotes", true)}${tab("words", "Your words")}${tab("you", "You")}</div>
          <div class="tab-panel" role="tabpanel" id="panel-emotes" aria-labelledby="tab-emotes">
            <div class="emotes" role="toolbar" aria-label="Emotes: your head does it, for everyone">
              ${EMOTES.map((em) => `<button type="button" data-emote="${em.id}" title="${em.label} (Shift+${em.key})"><span aria-hidden="true">${em.burst || (em.head === "nod" ? "🙂" : "🙅")}</span><span class="emote-label">${em.label}</span></button>`).join("")}
            </div>
          </div>
          <div class="tab-panel" role="tabpanel" id="panel-words" aria-labelledby="tab-words" hidden>
            <div class="edit-tools" role="toolbar" aria-label="Change the chosen word">
              <p class="edit-hint">Your latest word is chosen; tap any of yours <span class="keys">(or press <kbd>←</kbd> <kbd>→</kbd>)</span> to choose it instead. Type to change it, live, for everyone.</p>
              ${EFFECTS.map((fx) => `<button type="button" data-key="${fx.key}" title="${fx.label}" class="fx-button"><kbd>${fx.key}</kbd><span class="w fx-${fx.id}">${fx.label}</span></button>`).join("")}
              <button type="button" data-key="Backspace" title="Delete"><kbd>⌫</kbd><span>Delete</span></button>
            </div>
          </div>
          <div class="tab-panel" role="tabpanel" id="panel-you" aria-labelledby="tab-you" hidden>
            <div class="you-tools">
              <button id="face" type="button" class="face-toggle" aria-pressed="false" hidden><span class="label">Show my face</span></button>
              <video id="face-preview" class="face-preview" muted playsinline hidden></video>
              <label class="hands-toggle"><input type="checkbox" id="hands"><span>Hands too</span></label>
              <label class="voices-toggle" hidden><input type="checkbox" id="voices"><span>🔊 Hear voices</span></label>
              <label class="voices-toggle natural-toggle" hidden title="Natural-sounding voices, the same on every device: a download, once"><input type="checkbox" id="natural"><span>✨ Natural <small class="natural-size"></small></span></label>
            </div>
            <a class="customise-link" href="/studio${here.id === 1 ? "" : `?from=${encodeURIComponent(here.slug)}`}">Customise your avatar <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>`
    : `<section class="me join-card" aria-labelledby="join-h">
        <p class="hero-words words" aria-hidden="true">${HERO}</p>
        <h2 id="join-h">${here.id === 1 ? "Join the room" : `Join ${esc(here.name)}`}</h2>
        <p class="fine">Pick a name and talk. Everyone here sees your words as you say them, drawn the way you said them, and your avatar pulls the faces you pull.</p>
        ${notice}
        <form method="post" action="join" class="join">
          <label for="name" class="visually-hidden">Your name</label>
          <input id="name" name="name" maxlength="20" required autocomplete="nickname" placeholder="Your name">
          <button>Join</button>
        </form>
      </section>`;

  return layout(
    here.id === 1 ? `${APP}: say it how you mean it` : `${here.name} · ${APP}`,
    `<main class="room${me ? " joined" : ""}" data-room="${here.id}" data-scene="${esc(JSON.stringify(here.scene))}">
  <h1 class="visually-hidden">${here.id === 1 ? `${APP}: say it how you mean it` : `${esc(here.name)}, in ${APP}`}</h1>
  ${centre}${picker}
  <section class="others" aria-labelledby="others-h">
    <div class="others-head">
      <h2 id="others-h"><span class="room-title">${esc(here.name)}</span> <span class="room-count" id="room-count">${count ? `${count} here` : ""}</span></h2>
      <div class="view-switch" role="radiogroup" aria-label="How to see everyone" hidden><label><input type="radio" name="view" value="cards" checked><span>Cards</span></label><label><input type="radio" name="view" value="room"><span>Room</span></label></div><p id="live" class="live" role="status" hidden></p>
    </div>
    ${roomSettings(here)}
    <p id="queue" class="queue" aria-live="polite"${queue.length ? "" : " hidden"}>${queueHtml(queue, me?.name)}</p>
    <div id="room3d" class="room3d" tabindex="0" aria-label="The room, drawn. W, A, S and D, or a tap on the floor, walk you about it. Drag or use the arrow keys to look round, scroll, pinch or press plus and minus to zoom, 0 to put it back." hidden><canvas aria-hidden="true"></canvas><div class="room-labels"></div>
      <div class="room-bar"><div class="room-views" role="radiogroup" aria-label="Look at the room">${[["follow", "Everyone"], ["speaker", "Speaker"], ["wide", "Wide"], ["above", "Above"], ["me", "Me"]].map(([v, l]) => `<label${v === "me" ? ' class="room-me"' : ""}><input type="radio" name="room-view" value="${v}"${v === "follow" ? " checked" : ""}><span>${l}</span></label>`).join("")}</div><button type="button" class="room-reset" title="Put the camera back">Reset</button><button type="button" class="room-sit" title="Back to your chair">Sit</button></div>
      <div class="room-lens" role="radiogroup" aria-label="Read what's said as">${LENSES.map((l) => `<label title="Read it as ${l.label.toLowerCase()}"><input type="radio" name="room-lens" value="${l.id}"${l.id === "words" ? " checked" : ""}><span aria-hidden="true">${l.icon}</span><span class="visually-hidden">${l.label}</span></label>`).join("")}</div>
      <button type="button" class="room-full" aria-pressed="false" title="Full screen (Esc to come back)"><svg viewBox="0 0 20 20" aria-hidden="true"><path class="grow" d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"/><path class="shrink" d="M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5"/></svg><span class="visually-hidden">Full screen</span></button>
      <div class="room-stick" aria-hidden="true"><span class="room-knob"></span></div>
      <div class="room-dock" aria-label="Talk from the room">
        <button type="button" class="dock-talk" aria-pressed="false" title="Microphone"><span class="dot"></span><span class="visually-hidden">Microphone</span></button>
        <form class="dock-type"><input type="text" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Say something…" aria-label="Type something to say"></form>
        <div class="dock-emotes">${["hi", "laugh", "love", "yes", "wow"].map((id) => { const em = EMOTES.find((e) => e.id === id)!; return `<button type="button" data-dock-emote="${id}" title="${em.label}"><span aria-hidden="true">${em.burst}</span><span class="visually-hidden">${em.label}</span></button>`; }).join("")}</div>
      </div>
      <p class="room-hint" aria-hidden="true">Walk up to a group to read them: W A S D or tap the floor · drag to look round</p>
    </div>
    <ul id="stage" class="stage" data-up-to="${upTo}">${others}</ul>
    <p id="nobody" class="fine" ${others ? "hidden" : ""}>${here.id === 1 ? "Nobody else is here yet." : `Nobody else is here yet. <button type="button" class="copy-link">Copy the link</button> to bring someone.`}</p>
  </section>
  <details class="record-wrap">
    <summary><h2 id="record-h">Lately</h2><span class="near-note">In the room, what's said near you; further off, fainter</span></summary>
    <ol id="record" class="record">${lines.map((l) => lineHtml(l)).join("")}</ol>
    <p id="record-empty" class="fine" ${lines.length ? "hidden" : ""}>Nothing said yet.</p>
  </details>
  <p id="heard" class="visually-hidden" aria-live="polite"></p>
</main>`,
    `<script type="module" src="/js/client.ts"></script>`,
    HELP,
    switcher(here, rooms),
  );
}

// Every room: the ones anyone can find (and yours that aren't), each with
// how it looks and who's in it, and a way to make another.
export function roomsPage(rooms: (RoomInfo & { lately: number; here: number; mine: boolean })[], joined: boolean, msg?: string): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const card = (r: (typeof rooms)[number]): string => {
    const wall = SCENE_PARTS.walls.find((x) => x.id === r.scene.walls)?.colour ?? "#434c66";
    const floor = SCENE_PARTS.floor.find((x) => x.id === r.scene.floor)?.colour ?? "#a8774c";
    const rug = SCENE_PARTS.rug.find((x) => x.id === r.scene.rug)?.colours[0] ?? "transparent";
    const sky = SCENE_PARTS.sky.find((x) => x.id === r.scene.sky);
    return `<li><a class="room-card" href="${roomHref(r)}" style="--wall:${wall};--floor:${floor};--rug:${rug}" data-sky="${r.scene.sky}">
      <span class="room-card-art" aria-hidden="true"><span class="win"></span><span class="rugdot"></span><span class="sky-emoji">${sky?.emoji ?? ""}</span></span>
      <span class="room-card-text"><strong>${esc(r.name)}</strong><small>${r.here ? `${r.here} here now` : r.lately ? `${r.lately} talked lately` : "Quiet"}${r.listed ? "" : " · link only"}${r.mine ? " · yours" : ""}</small></span>
    </a></li>`;
  };
  const make = joined
    ? `<form method="post" action="/rooms" class="make-room">
        <h2>Make a room</h2>
        ${notice}
        <label class="field"><span>Name</span><input name="name" maxlength="40" required placeholder="Book club, Team stand-up…"></label>
        <fieldset class="pick scene-pick themes"><legend>Looks like</legend>${SCENES.map((t, i) => `<label><input type="radio" name="theme" value="${t.id}"${i === 0 ? " checked" : ""}><span><span aria-hidden="true">${t.emoji}</span> ${esc(t.label)}</span></label>`).join("")}</fieldset>
        <fieldset class="pick"><legend>Who finds it</legend><label><input type="radio" name="listed" value="yes" checked><span>Anyone, listed here</span></label><label><input type="radio" name="listed" value="no"><span>Only those with the link</span></label></fieldset>
        <button class="primary">Make it</button>
        <p class="fine">You can change how it looks once you're in it. Everyone in it sees what's said there, and only there.</p>
      </form>`
    : `<div class="make-room"><h2>Make a room</h2>${notice}<p class="fine">Join first (pick a name in <a href="/">the main room</a>), then make one of your own here.</p></div>`;
  return layout(
    `Rooms · ${APP}`,
    `<main class="rooms-page">
  <h1>Rooms</h1>
  <p class="lede">Each room is its own space: its own people, its own look, and what's said there stays there.</p>
  <ul class="room-cards">${rooms.map(card).join("")}</ul>
  ${make}
</main>`,
  );
}

// ---- Space: you are your words ----

// A plain field with nobody in it but what people say. Each person is
// their latest words, in their colour, under their name; you move yours
// toward whoever you want to talk to, and others' words are as clear as
// they'd be heard from where you are (hearing.ts). Three ways to read it:
// the words, as colour (each word a shape: how high it was said is its
// hue and height, how loud its size, how drawn out its length), or as
// emoji (words that have one become it, the rest a dot each, so the rhythm
// stays). Talk or type, as in a room.
type InSpace = { name: string; hue: number; x: number; y: number };

const SPACE_HELP = `<details class="help">
  <summary aria-label="How Space works">?</summary>
  <div class="help-body">
    <p>You are your words. Drag yours, or use the arrow keys, to move toward whoever you want to talk to.</p>
    <p>Others' words are as clear as you are close: up close you can read them, further off they blur, too far and you only see that they're talking. A loud word carries further than a quiet one.</p>
    <p>Talk, or type: each word goes as you finish it with a space, and the line's kept on Enter or a pause. How you said it shows in your words, and in Colour and Emoji, in other ways.</p>
    <p>Read it as Words, as Colour (higher is warmer and higher up, louder is bigger, drawn out is longer) or as Emoji.</p>
    <p>Or hear it as ♪ Tones: each word a note, higher if it was said higher, louder if it was said louder or nearer you, held if drawn out. Only the numbers make them; nobody's voice is played.</p>
    <p>A ring goes out from whoever speaks, as far as what they said carries.</p>
  </div>
</details>`;
export function spacePage(me: (InSpace & { look: Look }) | undefined, people: (InSpace & { look: Look })[], said: Message[], upTo: number, msg?: string): string {
  const last = new Map<string, Message>();
  for (const m of said) last.set(m.name, m);
  const body = (p: InSpace): string => {
    const m = last.get(p.name);
    return `<div class="being${me && p.name === me.name ? " mine" : ""}" data-name="${esc(p.name)}" data-x="${p.x}" data-y="${p.y}" style="--hue:${p.hue};--x:${p.x};--y:${p.y}"${m ? ` data-at="${m.at}"` : ""}><span class="being-words">${m ? m.words.map((w) => wordHtml(w)).join(" ") : ""}</span><span class="being-name">${esc(p.name)}</span></div>`;
  };
  return layout(
    `Space · ${APP}`,
    `<main class="space-page" data-up-to="${upTo}"${me ? ` data-me="${esc(me.name)}" data-look="${esc(JSON.stringify(me.look))}"` : ""}>
  <h1 class="visually-hidden">Space</h1>
  <div class="space-bar">
    <p class="space-lede">You are your words. Move toward someone to read them.</p>
    <fieldset class="lenses" aria-label="Read it as">${LENSES.map((l, i) => `<label><input type="radio" name="lens" value="${l.id}"${i === 0 ? " checked" : ""}><span>${l.label}</span></label>`).join("")}</fieldset>
    <button type="button" class="tones-toggle" id="tones" aria-pressed="false" title="Hear what's said as notes: higher said, higher note; louder, and nearer, louder">♪ <span>Tones</span></button>
    <p class="live" id="live" hidden></p>
  </div>
  ${msg && MESSAGES[msg] ? `<p class="notice">${MESSAGES[msg]}</p>` : ""}
  <div class="space-field" id="field" tabindex="0" aria-label="Space: everyone here, as their words. Arrow keys move you.">${people.map(body).join("")}</div>
  ${
    me
      ? `<form class="space-say" id="type-box" autocomplete="off">
    <button type="button" class="talk" id="talk" aria-pressed="false" disabled><span class="dot" aria-hidden="true"></span><span class="label">Talk</span></button>
    <input name="text" maxlength="300" placeholder="Or type here…" aria-label="Type something to say: each word goes to everyone as you finish it" enterkeyhint="send">
    <select name="tone" aria-label="How it's said">${TONES.map((t) => `<option value="${t.id}">${t.emoji} ${t.label}</option>`).join("")}</select>
    <button type="submit" class="type-send">Say</button>
  </form>
  <p class="status space-status" id="status" role="status"></p>`
      : `<form class="join space-join" method="post" action="join"><label class="visually-hidden" for="name">Your name</label><input id="name" name="name" maxlength="20" autocomplete="nickname" placeholder="Your name, to join in" required><button type="submit">Join</button></form>`
  }
  <p id="heard" class="visually-hidden" aria-live="polite"></p>
</main>`,
    `<script type="module" src="/js/space.ts"></script>`,
    SPACE_HELP,
  );
}

export function notFoundPage(): string {
  return layout(`Not here · ${APP}`, `<main class="prose"><h1>No room here</h1><p>There's no room at this address. It may have been a typo, or the link's from somewhere else. <a href="/rooms">See every room</a>.</p></main>`);
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`, "", "");
}
