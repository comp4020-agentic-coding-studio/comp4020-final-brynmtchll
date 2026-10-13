import type { Message, Person } from "./db.ts";
import { ago, describe, esc, renderWords, usualVars } from "./voice.ts";

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

// One message. The same markup goes into the page and down the live stream,
// so a message that arrives live looks exactly like one that was already there.
// The words as drawn play back a word at a time, which a screen reader would
// announce in pieces, so they're hidden from it and it reads the plain text.
// How it compared with how its speaker usually sounds sets the whole
// message's style (style.css says how) and, past a noticeable difference, a
// line that says so. The replay button needs the page's script, so it's
// hidden until the script shows it.
export function messageHtml(m: Message, now = Date.now()): string {
  const usual = describe(m.usual, m.name);
  return `<li id="m${m.id}" class="said" style="${usualVars(m.usual)}">
    <p class="who"><strong>${esc(m.name)}</strong> <time datetime="${new Date(m.at).toISOString()}" data-at="${m.at}">${ago(m.at, now)}</time>
      <button type="button" class="replay" aria-label="Replay ${esc(m.name)}'s message" hidden>Replay</button></p>
    <p class="words" aria-hidden="true">${renderWords(m.words)}</p>
    <p class="visually-hidden">${esc(m.text)}</p>
    ${usual ? `<p class="usual">${esc(usual)}</p>` : ""}
  </li>`;
}

export function roomPage(messages: Message[], me: Person | undefined, msg: string | undefined): string {
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const speak = me
    ? `<section class="speak" aria-labelledby="speak-h">
        <h2 id="speak-h">Say something, ${esc(me.name)}</h2>
        <button id="talk" type="button" class="talk" disabled>Start talking</button>
        <p id="status" class="status" aria-live="polite">Speaking needs JavaScript and a microphone.</p>
        <div id="preview" class="preview" hidden>
          <p class="words" id="preview-words"></p>
          <div class="actions"><button id="send" type="button">Send</button><button id="discard" type="button" class="quiet">Say it again</button></div>
        </div>
        <p class="fine">Your voice is turned into words in this browser. Only the words, and how loud, high and drawn-out each one was, leave it. No recording is kept anywhere.</p>
      </section>`
    : `<section class="speak" aria-labelledby="join-h">
        <h2 id="join-h">Join the room</h2>
        ${notice}
        <form method="post" action="/join" class="join">
          <label for="name">Your name</label>
          <input id="name" name="name" maxlength="20" required autocomplete="nickname">
          <button>Join</button>
        </form>
      </section>`;

  // one message that can't be drawn mustn't take the page down with it
  const list = messages
    .map((m) => {
      try {
        return messageHtml(m);
      } catch (err) {
        console.error(`message ${m.id} couldn't be drawn`, err);
        return "";
      }
    })
    .join("");
  return layout(
    `${APP}: say it how you mean it`,
    `<main class="room">
  <div class="intro">
    <h1>Say it how you mean it</h1>
    <p class="lede">Everything here was spoken, and plays back at the pace it was said. Louder words are heavier, drawn-out sounds repeat (sooo), and the line underneath follows the voice up and down.</p>
  </div>
  ${speak}
  <section aria-labelledby="room-h">
    <div class="room-head"><h2 id="room-h">The room</h2><p id="live" class="live" role="status" hidden></p></div>
    <p id="empty" ${list ? "hidden" : ""}>Nobody has said anything yet.</p>
    <ol id="messages" class="messages" aria-live="polite">${list}</ol>
  </section>
</main>`,
    `<script type="module" src="/js/client.ts"></script>`,
  );
}

export function readmePage(html: string): string {
  return layout(`About ${APP}`, `<main class="prose">${html}</main>`);
}
