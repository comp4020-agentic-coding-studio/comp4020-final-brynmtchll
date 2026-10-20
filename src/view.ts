import type { Message, Person } from "./db.ts";
import { ago, esc, hueOf, wordHtml, type Word } from "./voice.ts";
import { avatarSvg, LOOKS, lookFor, REST, type Expression, type Look } from "./avatar.ts";

// a working title, here so it changes in one place
export const APP = "Said";

// How it works, behind a "?" in the header: everything a newcomer needs,
// out of the way of everyone who doesn't.
const HELP = `<details class="help">
  <summary aria-label="How it works">?</summary>
  <div class="help-body">
    <p>Turn your microphone on and talk. Your words appear for everyone as you say them: louder is heavier, higher sits higher, drawn-out sounds repeat (sooo).</p>
    <p>Before each word goes out you can type over it, delete it, or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> for Impact, Whisper or Glow.</p>
    <p>Show your face and it's an emoji by your name. Your voice and face are read in this browser; only words, how they were said, and an emoji leave it. No recording or picture is kept anywhere.</p>
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
export function phraseHtml(m: { id: number; words: Word[] }): string {
  return `<span class="phrase" data-id="${m.id}">${m.words
    .map((w, i) => {
      const gap = i + 1 < m.words.length ? m.words[i + 1].start - w.end : 0;
      return `<span class="tw" data-i="${i}">${wordHtml(w)}</span>${gap > NEW_LINE ? "<br>" : " "}`;
    })
    .join("")}</span>`;
}
export function threadHtml(messages: { id: number; words: Word[]; at: number }[]): string {
  let out = "";
  let last = -Infinity;
  for (const m of messages) {
    if (m.at - last > NEW_BUBBLE) out += `${out ? "</li>" : ""}<li class="bubble" data-at="${m.at}">`;
    else out += "<br>";
    out += phraseHtml(m);
    last = m.at;
  }
  return out ? `${out}</li>` : "";
}

// A person's card: their avatar (pulling the expression they're pulling, if
// they're showing their face) and name; the word they're saying, large; and
// their thread underneath, scrolled to the latest. The live word is hidden
// from screen readers, which hear each whole phrase from the page's one live
// region instead.
export function spotHtml(name: string, seat: number, look: Look, mine = false, e: Expression = REST, thread: { id: number; words: Word[]; at: number }[] = []): string {
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)}" data-look="${esc(JSON.stringify(look))}">
    <div class="spot-head"><span class="spot-avatar">${avatarSvg(look, e, `${esc(name)}'s avatar`)}</span><p class="spot-name"><span class="who">${esc(name)}</span>${mine ? '<span class="you">you</span>' : ""}</p></div>
    <p class="spot-word" aria-hidden="true"></p>
    <ol class="thread" aria-label="What ${esc(name)} said lately">${threadHtml(thread)}</ol>
  </li>`;
}

// What someone can choose about their avatar, as a row of options each.
function lookPicker(look: Look): string {
  const row = (part: keyof typeof LOOKS, label: string, show: (v: string) => string): string =>
    `<fieldset class="pick"><legend>${label}</legend>${LOOKS[part]
      .map((v) => `<label><input type="radio" name="${part}" value="${esc(v)}"${look[part] === v ? " checked" : ""}><span>${show(v)}</span></label>`)
      .join("")}</fieldset>`;
  return `<details class="customise">
    <summary>Customise your avatar</summary>
    <form id="look" class="look-form">
      ${row("skin", "Colour", (v) => `<span class="swatch" style="background:${v}"></span><span class="visually-hidden">${v}</span>`)}
      ${row("eyes", "Eyes", (v) => v)}
      ${row("mouth", "Mouth", (v) => v)}
      ${row("extra", "Extra", (v) => v)}
    </form>
  </details>`;
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
  threads: Map<string, { id: number; words: Word[]; at: number }[]> = new Map(),
): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const myLook = me ? lookOf(me.name) : null;
  const mine = me ? spotHtml(me.name, me.seat, myLook!, true, expressions.get(me.name), threads.get(me.name)) : "";
  const others = people
    .filter((p) => p.name !== me?.name)
    .map((p) => spotHtml(p.name, p.seat, lookOf(p.name), false, expressions.get(p.name), threads.get(p.name)))
    .join("");

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
        </div>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
        <div class="edit-tools" role="toolbar" aria-label="Change the chosen word">
          <p class="edit-hint">Your latest word is chosen; tap any of yours to choose it instead. Type to change it, live, for everyone.</p>
          <button type="button" data-key="1" title="Impact"><kbd>1</kbd><span>Impact</span></button>
          <button type="button" data-key="2" title="Whisper"><kbd>2</kbd><span>Whisper</span></button>
          <button type="button" data-key="3" title="Glow"><kbd>3</kbd><span>Glow</span></button>
          <button type="button" data-key="Backspace" title="Delete"><kbd>⌫</kbd><span>Delete</span></button>
        </div>
        ${lookPicker(myLook!)}
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
  ${centre}
  <section class="others" aria-labelledby="others-h">
    <div class="others-head"><h2 id="others-h">In the room</h2><p id="live" class="live" role="status" hidden></p></div>
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
