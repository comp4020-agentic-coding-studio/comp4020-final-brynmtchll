import type { Message, Person } from "./db.ts";
import { ago, esc, hueOf, spotAt } from "./voice.ts";

// a working title, here so it changes in one place
export const APP = "Said";

export function layout(title: string, body: string, script = ""): string {
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
<header class="top"><a href="/" class="name">${APP}</a><nav><a href="/">Room</a><a href="/readme/">About</a></nav></header>
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

// A person's spot on the stage, where their words appear one at a time as
// they're said: at the place their seat gives them, in their colour. The live
// word is hidden from screen readers, which hear each whole phrase from the
// page's one live region instead.
export function spotHtml(name: string, seat: number, mine = false, face: string | null = null): string {
  const { x, y } = spotAt(seat);
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)};--x:${x};--y:${y}">
    <span class="spot-word" aria-hidden="true"></span>
    <span class="spot-name"><span class="spot-face" role="img" aria-label="${face ? "their face" : ""}">${face ?? ""}</span>${esc(name)}${mine ? " (you)" : ""}</span>
  </li>`;
}

// One line of the brief record: who, in their colour, what they said, when.
export const lineHtml = (l: { name: string; seat: number; text: string; until: number; face?: string | null }, now = Date.now()): string =>
  `<li style="--hue:${hueOf(l.seat)}" data-name="${esc(l.name)}" data-until="${l.until}"><strong>${l.face ? `${esc(l.face)} ` : ""}${esc(l.name)}</strong> <span class="said-text">${esc(l.text)}</span> <time data-at="${l.until}">${ago(l.until, now)}</time></li>`;

export function roomPage(
  people: { name: string; seat: number }[],
  me: (Person & { seat: number }) | undefined,
  msg: string | undefined,
  lines: { name: string; seat: number; text: string; until: number; face?: string | null }[] = [],
  faces: Map<string, string | null> = new Map(),
): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  // The queue is where your words wait before anyone else sees them, with
  // what you can do to the top one. Only you see it.
  const speak = me
    ? `<div class="dock">
      <section id="queue" class="queue" aria-labelledby="queue-h" hidden>
        <h2 id="queue-h" class="visually-hidden">Your words, before they're sent</h2>
        <ol id="queue-words" class="queue-words"></ol>
        <div class="queue-tools" role="toolbar" aria-label="The next word">
          <button type="button" data-key="1"><kbd>1</kbd> Impact</button>
          <button type="button" data-key="2"><kbd>2</kbd> Whisper</button>
          <button type="button" data-key="3"><kbd>3</kbd> Glow</button>
          <button type="button" data-key="Backspace"><kbd>⌫</kbd> Delete</button>
          <button type="button" data-key="Enter"><kbd>↵</kbd> Send now</button>
        </div>
        <p class="fine">Your words go out at the pace you said them, a second behind you. Type to change the next one, or use the keys above; the rest wait for you.</p>
      </section>
      <div class="speak">
        <button id="talk" type="button" class="talk" aria-pressed="false" disabled>Turn on microphone</button>
        <button id="face" type="button" class="face-toggle" aria-pressed="false" hidden>Show my face as an emoji</button>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
      </div>
      </div>`
    : `<section class="speak" aria-labelledby="join-h">
        <h2 id="join-h">Join the room</h2>
        ${notice}
        <form method="post" action="/join" class="join">
          <label for="name">Your name</label>
          <input id="name" name="name" maxlength="20" required autocomplete="nickname">
          <button>Join</button>
        </form>
      </section>`;

  const here = me && !people.some((p) => p.name === me.name) ? [{ name: me.name, seat: me.seat }, ...people] : people;
  const stage = here.map((p) => spotHtml(p.name, p.seat, p.name === me?.name, faces.get(p.name) ?? null)).join("");
  return layout(
    `${APP}: say it how you mean it`,
    `<main class="room">
  <div class="intro">
    <h1>Say it how you mean it</h1>
    <p class="lede">Turn your microphone on and talk. Your words appear where you are, as you say them, for everyone here: louder is heavier, higher sits higher, drawn-out sounds repeat (sooo).</p>
  </div>
  <section class="stage-wrap" aria-labelledby="stage-h">
    <div class="room-head"><h2 id="stage-h">In the room</h2><p id="live" class="live" role="status" hidden></p></div>
    ${speak}
    <ul id="stage" class="stage">${stage}</ul>
    <p id="nobody" class="fine" ${stage ? "hidden" : ""}>Nobody's here yet.</p>
    <p id="heard" class="visually-hidden" aria-live="polite"></p>
  </section>
  <section class="record-wrap" aria-labelledby="record-h">
    <h2 id="record-h">Lately</h2>
    <ol id="record" class="record">${lines.map((l) => lineHtml(l)).join("")}</ol>
    <p id="record-empty" class="fine" ${lines.length ? "hidden" : ""}>Nothing said yet.</p>
  </section>
  <p class="fine">Your voice is turned into words in this browser. Only the words, and how loud, high and drawn-out each one was, leave it. If you show your face, it's read in this browser too, and only an emoji leaves it. No recording or picture is kept anywhere.</p>
</main>`,
    `<script type="module" src="/js/client.ts"></script>`,
  );
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`);
}
