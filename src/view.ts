import type { Message, RoomInfo } from "./db.ts";
import { ago, esc, wordHtml, type Word } from "./voice.ts";
import { KEEPS, READING, VOICES_IN_ORDER, type Keep, type VoiceId } from "./packs.ts";
import { TONES } from "./typed.ts";

// a working title, here so it changes in one place
export const APP = "Said";

export function layout(title: string, body: string, opts: { script?: string; bodyClass?: string; nav?: string } = {}): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23101114'/%3E%3Cpath d='M9 12h14M9 17h9M9 22h12' stroke='%23f4f1ea' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E">
<script>try{const r=JSON.parse(localStorage.getItem("said-reading")||"{}");for(const k of ["size","feeling","contrast"])if(r[k])document.documentElement.dataset[k]=r[k]}catch{}</script>
${opts.script ?? ""}
</head>
<body${opts.bodyClass ? ` class="${opts.bodyClass}"` : ""}>
<a class="skip" href="#main">Skip to the conversation</a>
<header class="top"><a href="/" class="brand"><span class="mark" aria-hidden="true"></span>${APP}</a>${opts.nav ?? ""}<nav class="site-nav"><a href="/">Rooms</a><a href="/readme/">About</a></nav></header>
${body}
</body>
</html>`;
}

const MESSAGES: Record<string, string> = {
  "name-bad": "Pick a name between 1 and 20 characters.",
  "name-taken": "Someone already goes by that name.",
  "no-person": "Pick a name first.",
  "too-many-joins": "That's a lot of new names from here at once. Try again in a few minutes.",
  "room-name-bad": "Give the room a name between 1 and 40 characters.",
  "about-too-long": "Keep what it's about to a line (140 characters).",
  "too-many-rooms": "You've opened a lot of rooms. Use one of yours, or close one.",
  "not-a-keep": "That's not one of the choices for how long it keeps things.",
};
const notice = (m?: string): string => (m && MESSAGES[m] ? `<p class="notice" role="alert">${MESSAGES[m]}</p>` : "");

// The join form: a name, and you're someone on this browser, in every room.
const joinForm = (action: string, label = "Join"): string => `<form class="join" method="post" action="${action}">
  <label class="field-label" for="name">Your name</label>
  <div class="join-row"><input id="name" name="name" maxlength="20" autocomplete="nickname" required placeholder="What people call you"><button type="submit" class="primary">${label}</button></div>
</form>`;

const keepLabel = (k: Keep): string => (k === "always" ? "Kept until it's closed" : `Kept for ${KEEPS.find((x) => x.id === k)!.label.toLowerCase().replace(/^an? /, "a ")}`.replace("a hour", "an hour"));
const lastTalked = (last: number | null): string => (last === null ? "Nothing said yet" : `Last talked in ${ago(last)}`);

// ---- the front page: what it is, every room, and opening one ----

type Listed = Omit<RoomInfo, "maker"> & { here: number; mine: boolean; lately: number; last: number | null };
export function homePage(me: { name: string; hue: number } | undefined, rooms: Listed[], msg?: string): string {
  const card = (r: Listed): string => `<li><a class="room-card" href="/r/${esc(r.slug)}/">
    <span class="room-card-head"><span class="room-card-name">${esc(r.name)}</span>${r.here ? `<span class="live-dot" aria-label="${r.here} here now"><span aria-hidden="true"></span>${r.here} here</span>` : ""}</span>
    ${r.about ? `<span class="room-card-about">${esc(r.about)}</span>` : ""}
    <span class="room-card-meta">${lastTalked(r.last)} · ${keepLabel(r.keep)}${r.listed ? "" : " · Link only"}${r.mine ? " · Yours" : ""}</span>
  </a></li>`;
  const open = me
    ? `<form class="open-room" method="post" action="/rooms">
    <h2 id="open-h">Open a room</h2>
    <p class="hint">For a tutorial, a meeting, a table at dinner: everyone in it talks into their own phone or laptop, and everyone reads one transcript.</p>
    <label class="field-label" for="room-name">Name</label>
    <input id="room-name" name="name" maxlength="40" required placeholder="COMP4020 tutorial, Thursday stand-up…">
    <label class="field-label" for="room-about">What it's about <span class="optional">(optional)</span></label>
    <input id="room-about" name="about" maxlength="140" placeholder="One line, so people know they're in the right place">
    <fieldset class="choices"><legend class="field-label">Keep what's said for</legend>
      ${KEEPS.map((k) => `<label><input type="radio" name="keep" value="${k.id}"${k.id === "week" ? " checked" : ""}><span>${k.label}</span></label>`).join("")}
    </fieldset>
    <p class="hint">After that it's deleted, not hidden.</p>
    <fieldset class="choices"><legend class="field-label">Who can find it</legend>
      <label><input type="radio" name="listed" value="yes" checked><span>Anyone, listed here</span></label>
      <label><input type="radio" name="listed" value="no"><span>Only people with the link</span></label>
    </fieldset>
    <button type="submit" class="primary">Open it</button>
  </form>`
    : `<section class="join-card" aria-labelledby="join-h"><h2 id="join-h">Join to talk or open a room</h2><p class="hint">Just a name. No account, no email. Anyone can read without one.</p>${joinForm("/join")}</section>`;
  return layout(
    APP,
    `<main id="main" class="home">
  <section class="intro">
    <h1>Live captions for a room, that keep <em>how</em> it was said.</h1>
    <p class="lede">Everyone talks into their own phone or laptop. Everyone reads one transcript, as it's said: <span class="demo"><span class="w" style="--loud:9;--pitch:0">louder</span> words heavier, <span class="w" style="--loud:0;--pitch:7">higher</span> ones raised, drawn-out ones <span class="w" style="--loud:0;--pitch:0">sooo<span class="held">ooo</span></span> drawn out.</span> Type instead and it's read aloud in your voice. Your speech is heard in your own browser: no audio leaves it.</p>
    ${me ? `<p class="you">You're <strong style="--hue:${me.hue}" class="who">${esc(me.name)}</strong> on this browser.</p>` : ""}
  </section>
  ${notice(msg)}
  <section class="rooms" aria-labelledby="rooms-h">
    <h2 id="rooms-h">Rooms</h2>
    <ul class="room-list">${rooms.map(card).join("")}</ul>
  </section>
  ${open}
</main>`,
  );
}

// ---- a room: its transcript, and saying something ----

// One entry in the transcript: a run of what one person said, one after
// another, with no long gap and nobody else between. Each phrase in it keeps
// its id (so its speaker can correct a word in it, live) and each word how
// it was said.
const NEW_TURN = 20_000; // ms: a gap this long starts a new turn, even from the same person
const NEW_LINE = 0.7; // seconds of pause inside a phrase that starts a new line
type Said = { id: number; words: Word[]; at: number; typed?: true };
export function phraseHtml(m: Said): string {
  return `<span class="phrase${m.typed ? " typed" : ""}" data-id="${m.id}" data-at="${m.at}">${m.words
    .map((w, i) => {
      const gap = i + 1 < m.words.length ? m.words[i + 1].start - w.end : 0;
      return `<span class="tw" data-i="${i}">${wordHtml(w, gap)}</span>${gap > NEW_LINE ? " <br>" : " "}`;
    })
    .join("")}</span>`;
}
const clock = (at: number): string => new Date(at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
export function turnsHtml(messages: Message[], hueOf: (name: string) => number, me?: string): string {
  const turns: { name: string; at: number; until: number; phrases: Message[] }[] = [];
  for (const m of messages) {
    const last = turns.at(-1);
    if (last && last.name === m.name && m.at - last.until < NEW_TURN) {
      last.phrases.push(m);
      last.until = m.at;
    } else turns.push({ name: m.name, at: m.at, until: m.at, phrases: [m] });
  }
  return turns.map((t) => turnHtml(t.name, hueOf(t.name), t.at, t.phrases.map(phraseHtml).join(" "), t.name === me, t.until)).join("");
}
export const turnHtml = (name: string, hue: number, at: number, phrases: string, mine = false, until?: number): string =>
  `<li class="turn${mine ? " mine" : ""}" data-name="${esc(name)}" data-at="${at}" data-until="${until ?? at}" style="--hue:${hue}"><p class="turn-head"><span class="who">${esc(name)}</span><time datetime="${new Date(at).toISOString()}">${clock(at)}</time></p><p class="turn-words">${phrases}</p></li>`;

type Here = { name: string; hue: number };
export const hereHtml = (here: Here[], me?: string): string =>
  here.length ? here.map((p) => `<li style="--hue:${p.hue}"${p.name === me ? ' class="me"' : ""}><span class="who">${esc(p.name)}</span>${p.name === me ? " <span class='you-tag'>you</span>" : ""}</li>`).join("") : `<li class="nobody">Nobody's here right now</li>`;
export const queueHtml = (queue: string[], me?: string): string =>
  queue.length ? `<span aria-hidden="true">✋</span> Next to speak: ${queue.map((n) => (n === me ? "<strong>you</strong>" : esc(n))).join(", then ")}` : "";

// The reader's own settings: size, how strongly how it was said shows,
// contrast, and reading typed messages aloud. Kept in this browser only.
const readingHtml = (): string => `<details class="menu reading">
  <summary><span aria-hidden="true">Aa</span> <span class="menu-label">Reading</span></summary>
  <div class="menu-body" role="group" aria-label="How you read it">
    <fieldset class="seg"><legend>Text size</legend>${READING.size.map((c) => `<label><input type="radio" name="size" value="${c.id}"><span>${c.label}</span></label>`).join("")}</fieldset>
    <fieldset class="seg"><legend>How it was said</legend>${READING.feeling.map((c) => `<label><input type="radio" name="feeling" value="${c.id}"><span>${c.label}</span></label>`).join("")}</fieldset>
    <p class="hint">How strongly loud, high and drawn-out words show. None is plain captions.</p>
    <fieldset class="seg"><legend>Contrast</legend>${READING.contrast.map((c) => `<label><input type="radio" name="contrast" value="${c.id}"><span>${c.label}</span></label>`).join("")}</fieldset>
    <label class="switch"><input type="checkbox" name="aloud"><span>Read typed messages aloud</span></label>
    <label class="switch natural-row" hidden><input type="checkbox" name="natural"><span>Natural voices <span class="hint natural-note"></span></span></label>
  </div>
</details>`;

// The maker's settings for their room: name, what it's about, how long it
// keeps what's said, who can find it, and closing it.
const settingsHtml = (r: Omit<RoomInfo, "maker">): string => `<details class="menu room-settings">
  <summary><span aria-hidden="true">⚙</span> <span class="menu-label">Room</span></summary>
  <form class="menu-body" data-room-settings>
    <label class="field-label" for="set-name">Name</label>
    <input id="set-name" name="name" maxlength="40" value="${esc(r.name)}" required>
    <label class="field-label" for="set-about">What it's about</label>
    <input id="set-about" name="about" maxlength="140" value="${esc(r.about)}" placeholder="One line">
    <fieldset class="seg"><legend>Keep what's said for</legend>${KEEPS.map((k) => `<label><input type="radio" name="keep" value="${k.id}"${k.id === r.keep ? " checked" : ""}><span>${k.label}</span></label>`).join("")}</fieldset>
    <p class="hint">Keeping less deletes what's older straight away.</p>
    <label class="switch"><input type="checkbox" name="listed"${r.listed ? " checked" : ""}><span>Listed for anyone to find</span></label>
    <p class="settings-status" role="status"></p>
    <button type="button" class="danger" data-close-room>Close the room</button>
  </form>
</details>`;

type Mine = { name: string; hue: number; voice: { voice: VoiceId; pitch: number; speed: number } };
type ShownRoom = Omit<RoomInfo, "maker"> & { mine: boolean };
export function roomPage(r: ShownRoom, me: Mine | undefined, transcript: Message[], hueOf: (name: string) => number, queue: string[], here: Here[], upTo: number, msg?: string): string {
  const talk = me
    ? `<section class="composer" aria-label="Say something">
    <div class="composer-row">
      <button type="button" class="talk" id="talk" aria-pressed="false" disabled><span class="dot" aria-hidden="true"></span><span class="label">Turn on microphone</span></button>
      <form id="type-box" class="type-box" autocomplete="off">
        <input name="text" maxlength="500" placeholder="Or type… *this* stands out" aria-label="Type something to say" enterkeyhint="send">
        <button type="submit" class="send" disabled>Send</button>
      </form>
    </div>
    <div class="composer-more">
      <fieldset class="tones" aria-label="How it's said">${TONES.map((t, i) => `<label><input type="radio" name="tone" value="${t.id}" form="type-box"${i === 0 ? " checked" : ""}><span>${t.label}</span></label>`).join("")}</fieldset>
      <form class="hand-form" method="post" action="hand"><input type="hidden" name="up" value="${queue.includes(me.name) ? "false" : "true"}"><button type="submit" class="hand${queue.includes(me.name) ? " up" : ""}" aria-pressed="${queue.includes(me.name)}"><span aria-hidden="true">✋</span> <span class="hand-label">${queue.includes(me.name) ? "Lower hand" : "Raise hand"}</span></button></form>
      <details class="menu your-voice">
        <summary><span class="menu-label">Your voice</span></summary>
        <div class="menu-body">
          <p class="hint">What you type is read aloud in this, for anyone who has reading aloud on.</p>
          <label class="field-label" for="voice-pick">Voice</label>
          <select id="voice-pick" name="voice">${VOICES_IN_ORDER.map((v) => `<option value="${v.id}"${v.id === me.voice.voice ? " selected" : ""}>${esc(v.label)}, ${esc(v.about)}</option>`).join("")}</select>
          <label class="slider"><span>Pitch</span><input type="range" name="pitch" min="-1" max="1" step="0.05" value="${me.voice.pitch}"></label>
          <label class="slider"><span>Speed</span><input type="range" name="speed" min="-1" max="1" step="0.05" value="${me.voice.speed}"></label>
          <button type="button" class="ghost" data-try-voice>Hear it</button>
        </div>
      </details>
    </div>
    <p class="status" id="status" role="status"></p>
  </section>`
    : `<section class="composer join-card" aria-labelledby="join-h"><h2 id="join-h">Join to talk</h2><p class="hint">Just a name. You can read along without one.</p>${joinForm("join")}</section>`;
  return layout(
    `${r.name} · ${APP}`,
    `<main id="main" class="room" data-room="${esc(r.slug)}" data-up-to="${upTo}"${me ? ` data-me="${esc(me.name)}" data-voice="${esc(JSON.stringify(me.voice))}"` : ""}>
  <div class="room-head">
    <div class="room-title-row">
      <h1 class="room-name">${esc(r.name)}</h1>
      <p class="live" id="live" hidden></p>
    </div>
    ${r.about ? `<p class="room-about">${esc(r.about)}</p>` : `<p class="room-about" hidden></p>`}
    <p class="room-meta"><span class="keep-label">${keepLabel(r.keep)}</span>${r.listed ? "" : " · <span>Link only</span>"} · <a href="transcript.txt" download>Download transcript</a></p>
  </div>
  <div class="room-tools">
    <button type="button" class="ghost" data-copy-link>Copy link</button>
    <button type="button" class="ghost" data-present aria-pressed="false">Present</button>
    ${readingHtml()}
    ${r.mine ? settingsHtml(r) : ""}
  </div>
  ${notice(msg)}
  <p class="queue" id="queue" aria-live="polite"${queue.length ? "" : " hidden"}>${queueHtml(queue, me?.name)}</p>
  <div class="room-body">
    <section class="transcript-wrap" aria-labelledby="transcript-h">
      <h2 id="transcript-h" class="visually-hidden">Transcript</h2>
      <ol class="transcript" id="transcript" aria-live="polite" aria-relevant="additions">${turnsHtml(transcript, hueOf, me?.name)}</ol>
      <p class="empty" id="empty"${transcript.length ? " hidden" : ""}>Nothing's been said here yet${r.keep === "always" ? "" : ` (or not in the last ${KEEPS.find((k) => k.id === r.keep)!.label.toLowerCase().replace(/^an? /, "")})`}. ${me ? "Turn your microphone on, or type, to start." : "Join to start, or wait for someone to talk."}</p>
      <ul class="drafts" id="drafts" aria-hidden="true"></ul>
      <button type="button" class="jump" id="jump" hidden>New words ↓</button>
    </section>
    <aside class="here" aria-labelledby="here-h">
      <h2 id="here-h">Here now</h2>
      <ul id="here-list">${hereHtml(here, me?.name)}</ul>
    </aside>
  </div>
  ${talk}
</main>`,
    { script: `<script type="module" src="/js/client.ts"></script>`, bodyClass: "in-room" },
  );
}

// ---- a room's transcript to take away ----

export function transcriptText(r: RoomInfo, messages: Message[]): string {
  const lines = [`${r.name}${r.about ? ` — ${r.about}` : ""}`, `Transcript from ${APP}, ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}. ${keepLabel(r.keep)}.`, ""];
  let last = "";
  for (const m of messages) {
    const head = `[${new Date(m.at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" })}] ${m.name}${m.typed ? " (typed)" : ""}`;
    if (head !== last) lines.push("", head);
    lines.push(m.text);
    last = head;
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

export function notFoundPage(): string {
  return layout(`Not found · ${APP}`, `<main id="main" class="home"><section class="intro"><h1>There's no room here.</h1><p class="lede">It may have been closed, or the link is mistyped.</p><p><a class="primary-link" href="/">See the rooms</a></p></section></main>`);
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main id="main" class="prose">${html}</main>`);
}
