import type { Message, Person } from "./db.ts";
import { esc, hueOf, spotAt } from "./voice.ts";

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
};

// A person's spot on the stage, where their words appear one at a time as
// they're said: at the place their seat gives them, in their colour. The live
// word is hidden from screen readers, which hear each whole phrase from the
// page's one live region instead.
export function spotHtml(name: string, seat: number, mine = false): string {
  const { x, y } = spotAt(seat);
  return `<li class="spot${mine ? " mine" : ""}" data-name="${esc(name)}" style="--hue:${hueOf(seat)};--x:${x};--y:${y}">
    <span class="spot-word" aria-hidden="true"></span>
    <span class="spot-name">${esc(name)}${mine ? " (you)" : ""}</span>
  </li>`;
}

export function roomPage(people: { name: string; seat: number }[], me: (Person & { seat: number }) | undefined, msg: string | undefined): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const speak = me
    ? `<div class="speak">
        <button id="talk" type="button" class="talk" aria-pressed="false" disabled>Turn on microphone</button>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
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
  const stage = here.map((p) => spotHtml(p.name, p.seat, p.name === me?.name)).join("");
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
  <p class="fine">Your voice is turned into words in this browser. Only the words, and how loud, high and drawn-out each one was, leave it. No recording is kept anywhere.</p>
</main>`,
    `<script type="module" src="/js/client.ts"></script>`,
  );
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`);
}
