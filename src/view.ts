import type { Message, Person } from "./db.ts";
import { ago, esc, handBadge, hueOf, queueHtml, reactionsHtml, wordHtml, type Word } from "./voice.ts";
import { avatarSvg, REST, type Expression } from "./avatar.ts";
import { COLOURS, EFFECTS, EMOTES, lookFor, MORE_EXTRAS, PARTS, REACTIONS, SLIDERS, STYLES, type ColourPart, type Look, type Part } from "./packs.ts";

// a working title, here so it changes in one place
export const APP = "Said";

// How it works, behind a "?" in the header: everything a newcomer needs,
// out of the way of everyone who doesn't.
const HELP = `<details class="help">
  <summary aria-label="How it works">?</summary>
  <div class="help-body">
    <p>Turn your microphone on and talk. Your words appear for everyone as you say them: louder is heavier, higher sits higher, drawn-out sounds repeat (sooo).</p>
    <p>Tap any of your words (your latest is chosen already) to type over it, delete it, or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> for Impact, Whisper or Glow, live, for everyone.</p>
    <p>Show your face and your avatar pulls the faces you pull and turns as you turn. Your voice and face are read in this browser; only words, how they were said, and a handful of numbers about your face leave it. No recording or picture is kept anywhere.</p>
    <p>Hands too, and your avatar's arms and hands follow yours: a thumbs up, a wave or a peace sign sets off its emote. Raise your hand (<kbd>Shift</kbd> <kbd>R</kbd>) to take a place in the queue to speak.</p>
    <p>Hear voices, and what everyone says is spoken in the voice they chose, the way they said it. Headphones stop it coming back through your microphone.</p>
  </div>
</details>`;

export function layout(title: string, body: string, script = "", help = HELP): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:,">
${script}
</head>
<body>
<header class="top"><a href="/" class="name">${APP}</a><nav><a href="/readme/">About</a>${help}</nav></header>
${body}
</body>
</html>`;
}

const MESSAGES: Record<string, string> = {
  "name-bad": "Pick a name between 1 and 20 characters.",
  "name-taken": "Someone here already goes by that name.",
  "no-person": "Pick a name first.",
  "too-many-joins": "That's a lot of new names from here at once. Try again in a few minutes.",
};

// A person's thread: what they've said lately as text messages, oldest at
// the top, a new bubble after a long silence, a new line inside one at each
// pause. Each word keeps how it was said, and carries where it lives (the
// message and its place in it) so its speaker can change it, live.
const NEW_BUBBLE = 4000; // ms of silence between phrases that starts a new bubble
const NEW_LINE = 0.7; // seconds of pause inside a phrase that starts a new line
type Said = { id: number; words: Word[]; at: number; reactions?: Record<number, Record<string, number>> };
export function phraseHtml(m: Said): string {
  return `<span class="phrase" data-id="${m.id}">${m.words
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
export function spotHtml(name: string, seat: number, look: Look, mine = false, e: Expression = REST, thread: { id: number; words: Word[]; at: number }[] = [], place = 0): string {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  // how their words are drawn: their word style (packs.ts), which the CSS
  // the server makes from it reads off data-words, and its lettering
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)}" data-words="${st.id}" data-font="${st.font}"${"glow" in st ? " data-glow" : ""} data-look="${esc(JSON.stringify(look))}"${place ? ` data-hand="${place}"` : ""}>
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
  { label: "Voice", parts: ["voice"], sliders: "Voice" },
];
const PART_LABELS: Record<Part, string> = { words: "Style", face: "Shape", hair: "Style", brows: "Brows", eyes: "Eyes", nose: "Nose", mouth: "Mouth", ears: "Ears", beard: "Beard", extra: "Wearing", top: "Top", voice: "Voice" };

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
    return `<fieldset class="pick"><legend>${PART_LABELS[k]}</legend>${(PARTS[k] as readonly { id: string; label: string }[])
      .map((c) => `<label><input type="radio" name="${k}" value="${c.id}"${look[k] === c.id ? " checked" : ""}><span>${esc(c.label)}</span></label>`)
      .join("")}</fieldset>`;
  };
  const tune = (look.tune ?? {}) as Record<string, number>;
  const sliders = (group: string): string => {
    const these = SLIDERS.filter((sl) => sl.group === group);
    return these.length
      ? `<fieldset class="sliders"><legend>Shape</legend>${these
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
  const voiceMore = `<div class="voice-try"><button type="button" id="hear-voice">🔊 Hear it</button><p class="hint">How your words sound to anyone with voices on: loud words louder, high words higher, drawn-out words slower. Each device has its own voices, so it sounds a little different on each.</p></div>`;
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
export function studioPage(me: Person, look: Look, saved: (Look | null)[], hue: number): string {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  return layout(
    `${APP}: your avatar`,
    `<main class="studio">
  <h1 class="visually-hidden">Your avatar</h1>
  <section class="stage-3d" aria-label="Preview">
    <div class="preview spot mine" data-name="${esc(me.name)}" style="--hue:${hue}" data-words="${st.id}" data-font="${st.font}" data-look="${esc(JSON.stringify(look))}">
      <span class="spot-avatar preview-head">${avatarSvg(look, REST, `${me.name}'s avatar`)}</span>
      <p class="preview-name"><span class="who">${esc(me.name)}</span></p>
      <p class="preview-words words" aria-hidden="true"></p>
    </div>
    <p class="preview-help">Drag to turn · scroll or pinch to zoom</p>
    <div class="preview-tools">
      <button type="button" id="studio-face" aria-pressed="false">Follow my face</button>
      <button type="button" id="studio-front">Face front</button>
      <select id="studio-emote" aria-label="Try an emote"><option value="">Try an emote…</option>${EMOTES.map((em) => `<option value="${em.id}">${em.burst ? em.burst + " " : ""}${esc(em.label)}</option>`).join("")}</select>
    </div>
  </section>
  <section class="editor" aria-label="Choose how you look">
    <div class="editor-head">
      <a href="/" class="done">Done</a>
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

// One line of the brief record: who, in their colour, what they said, when.
export const lineHtml = (l: { name: string; seat: number; text: string; until: number; face?: string | null }, now = Date.now()): string =>
  `<li style="--hue:${hueOf(l.seat)}" data-name="${esc(l.name)}" data-until="${l.until}"><strong>${l.face ? `${esc(l.face)} ` : ""}${esc(l.name)}</strong> <span class="said-text">${esc(l.text)}</span> <time data-at="${l.until}">${ago(l.until, now)}</time></li>`;

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
): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const myLook = me ? lookOf(me.name) : null;
  const place = (name: string): number => queue.indexOf(name) + 1;
  const mine = me ? spotHtml(me.name, me.seat, myLook!, true, expressions.get(me.name), threads.get(me.name), place(me.name)) : "";
  const others = people
    .filter((p) => p.name !== me?.name)
    .map((p) => spotHtml(p.name, p.seat, lookOf(p.name), false, expressions.get(p.name), threads.get(p.name), place(p.name)))
    .join("");
  const up = me ? queue.includes(me.name) : false;

  // a word of someone else's, tapped, offers these
  const picker = me ? `<div id="react-picker" class="react-picker" role="menu" hidden>${REACTIONS.map((r) => `<button type="button" role="menuitem" data-reaction="${r.id}" title="${r.label}">${r.emoji}</button>`).join("")}</div>` : "";

  // Joined: you on the left (your card, your controls, your avatar), everyone
  // else on the right, and what you've said that's about to go out along the
  // bottom. Not joined: a way in, and the room to watch.
  const centre = me
    ? `<section class="me" aria-label="You">
        <ul class="mine-card">${mine}</ul>
        <div class="controls">
          <button id="talk" type="button" class="talk" aria-pressed="false" disabled><span class="dot"></span><span class="label">Turn on microphone</span></button>
          <button id="face" type="button" class="face-toggle" aria-pressed="false" hidden><span class="label">Show my face</span></button>
          <video id="face-preview" class="face-preview" muted playsinline hidden></video>
          <label class="hands-toggle"><input type="checkbox" id="hands"><span>Hands too</span></label>
          <label class="voices-toggle" hidden><input type="checkbox" id="voices"><span>🔊 Hear voices</span></label>
          <form method="post" action="/hand" class="hand-form"><input type="hidden" name="up" value="${up ? "false" : "true"}"><button id="hand" type="submit" class="hand-toggle" aria-pressed="${up}" title="Raise your hand to speak next (Shift+R)"><span aria-hidden="true">✋</span> <span class="label">${up ? "Lower hand" : "Raise hand"}</span></button></form>
        </div>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
        <div class="emotes" role="toolbar" aria-label="Emotes: your head does it, for everyone">
          ${EMOTES.map((em) => `<button type="button" data-emote="${em.id}" title="${em.label} (Shift+${em.key})"><span aria-hidden="true">${em.burst || (em.head === "nod" ? "🙂" : "🙅")}</span><span class="emote-label">${em.label}</span></button>`).join("")}
        </div>
        <div class="edit-tools" role="toolbar" aria-label="Change the chosen word">
          <p class="edit-hint">Your latest word is chosen; tap any of yours to choose it instead. Type to change it, live, for everyone.</p>
          ${EFFECTS.map((fx) => `<button type="button" data-key="${fx.key}" title="${fx.label}" class="fx-button"><kbd>${fx.key}</kbd><span class="w fx-${fx.id}">${fx.label}</span></button>`).join("")}
          <button type="button" data-key="Backspace" title="Delete"><kbd>⌫</kbd><span>Delete</span></button>
        </div>
        <a class="customise-link" href="/studio">Customise your avatar <span aria-hidden="true">→</span></a>
      </section>`
    : `<section class="me join-card" aria-labelledby="join-h">
        <h2 id="join-h">Join the room</h2>
        <p class="fine">Pick a name and talk. Everyone here sees your words as you say them, drawn the way you said them, and your avatar pulls the faces you pull.</p>
        ${notice}
        <form method="post" action="/join" class="join">
          <label for="name" class="visually-hidden">Your name</label>
          <input id="name" name="name" maxlength="20" required autocomplete="nickname" placeholder="Your name">
          <button>Join</button>
        </form>
      </section>`;


  return layout(
    `${APP}: say it how you mean it`,
    `<main class="room${me ? " joined" : ""}">
  <h1 class="visually-hidden">${APP}: say it how you mean it</h1>
  ${centre}${picker}
  <section class="others" aria-labelledby="others-h">
    <div class="others-head"><h2 id="others-h">In the room</h2><div class="view-switch" role="radiogroup" aria-label="How to see everyone" hidden><label><input type="radio" name="view" value="cards" checked><span>Cards</span></label><label><input type="radio" name="view" value="room"><span>Room</span></label></div><p id="live" class="live" role="status" hidden></p></div>
    <p id="queue" class="queue" aria-live="polite"${queue.length ? "" : " hidden"}>${queueHtml(queue, me?.name)}</p>
    <div id="room3d" class="room3d" hidden><canvas aria-hidden="true"></canvas><div class="room-labels"></div></div>
    <ul id="stage" class="stage">${others}</ul>
    <p id="nobody" class="fine" ${others ? "hidden" : ""}>Nobody else is here yet.</p>
  </section>
  <details class="record-wrap">
    <summary><h2 id="record-h">Lately</h2></summary>
    <ol id="record" class="record">${lines.map((l) => lineHtml(l)).join("")}</ol>
    <p id="record-empty" class="fine" ${lines.length ? "hidden" : ""}>Nothing said yet.</p>
  </details>
  <p id="heard" class="visually-hidden" aria-live="polite"></p>
</main>`,
    `<script type="module" src="/js/client.ts"></script>`,
  );
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`, "", "");
}
