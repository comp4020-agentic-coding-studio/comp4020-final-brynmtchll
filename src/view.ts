import type { Message, Person } from "./db.ts";
import { ago, esc, hueOf } from "./voice.ts";

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

// A person's card: their face (as an emoji, if they're showing it) and name,
// their latest word large, and the last few before it underneath, pushed
// along as each new one comes. Yours sits on its own on the left; everyone
// else's stack on the right. The live words are hidden from screen readers,
// which hear each whole phrase from the page's one live region instead.
export function spotHtml(name: string, seat: number, mine = false, face: string | null = null): string {
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)}">
    <p class="spot-name"><span class="spot-face" role="img" aria-label="${face ? `${esc(name)}'s face` : ""}">${face ?? ""}</span><span class="who">${esc(name)}</span>${mine ? '<span class="you">you</span>' : ""}</p>
    <p class="spot-word" aria-hidden="true"></p>
    <ol class="spot-trail" aria-hidden="true"></ol>
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
  const mine = me ? spotHtml(me.name, me.seat, true, faces.get(me.name) ?? null) : "";
  const others = people
    .filter((p) => p.name !== me?.name)
    .map((p) => spotHtml(p.name, p.seat, false, faces.get(p.name) ?? null))
    .join("");

  // Joined: your queue down the left, your card and controls in the middle,
  // everyone else on the right. Not joined: a way in, and the room to watch.
  const left = me
    ? `<section id="queue" class="queue" aria-labelledby="queue-h">
        <h2 id="queue-h">Up next</h2>
        <ol id="queue-words" class="queue-words"></ol>
        <p id="queue-empty" class="queue-empty">What you say waits here a moment before it goes. Type to change the top word.</p>
        <div class="queue-tools" role="toolbar" aria-label="The next word">
          <button type="button" data-key="1" title="Impact"><kbd>1</kbd><span>Impact</span></button>
          <button type="button" data-key="2" title="Whisper"><kbd>2</kbd><span>Whisper</span></button>
          <button type="button" data-key="3" title="Glow"><kbd>3</kbd><span>Glow</span></button>
          <button type="button" data-key="Backspace" title="Delete"><kbd>⌫</kbd><span>Delete</span></button>
          <button type="button" data-key="Enter" title="Send now"><kbd>↵</kbd><span>Send</span></button>
        </div>
      </section>`
    : "";
  const centre = me
    ? `<section class="me" aria-label="You">
        <ul class="mine-card">${mine}</ul>
        <div class="controls">
          <button id="talk" type="button" class="talk" aria-pressed="false" disabled><span class="dot"></span><span class="label">Turn on microphone</span></button>
          <button id="face" type="button" class="face-toggle" aria-pressed="false" hidden><span class="label">Show my face</span></button>
          <video id="face-preview" class="face-preview" muted playsinline hidden></video>
        </div>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
      </section>`
    : `<section class="me join-card" aria-labelledby="join-h">
        <h2 id="join-h">Join the room</h2>
        <p class="fine">Pick a name and talk. Everyone here sees your words as you say them, drawn the way you said them.</p>
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
  ${left}
  ${centre}
  <section class="others" aria-labelledby="others-h">
    <div class="others-head"><h2 id="others-h">In the room</h2><p id="live" class="live" role="status" hidden></p></div>
    <ul id="stage" class="stage">${others}</ul>
    <p id="nobody" class="fine" ${others ? "hidden" : ""}>Nobody else is here yet.</p>
  </section>
  <details class="record-wrap"${lines.length ? " open" : ""}>
    <summary><h2 id="record-h">Lately</h2></summary>
    <ol id="record" class="record">${lines.map((l) => lineHtml(l)).join("")}</ol>
    <p id="record-empty" class="fine" ${lines.length ? "hidden" : ""}>Nothing said yet.</p>
  </details>
  <p id="heard" class="visually-hidden" aria-live="polite"></p>
</main>
`,
    `<script type="module" src="/js/client.ts"></script>`,
  );
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`, "", "");
}
