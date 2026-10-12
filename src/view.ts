import type { Message, Person } from "./db.ts";
import { ago, esc, renderWords } from "./voice.ts";

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
export function messageHtml(m: Message, now = Date.now()): string {
  return `<li id="m${m.id}" class="said">
    <p class="who"><strong>${esc(m.name)}</strong> <time datetime="${new Date(m.at).toISOString()}" data-at="${m.at}">${ago(m.at, now)}</time></p>
    <p class="words">${renderWords(m.words)}</p>
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

  const list = messages.map((m) => messageHtml(m)).join("");
  return layout(
    `${APP}: say it how you mean it`,
    `<main class="room">
  <p class="lede">Everything here was spoken. Louder words are heavier, higher words sit higher, rising words tilt up, and drawn-out words spread out.</p>
  ${speak}
  <section aria-labelledby="room-h">
    <h2 id="room-h">The room</h2>
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
