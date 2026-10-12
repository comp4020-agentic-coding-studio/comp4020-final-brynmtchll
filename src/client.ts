// The page's script. The server renders everything already said, so the page
// reads fine without this; the script keeps it live.
import { ago } from "./voice.ts";

const list = document.getElementById("messages") as HTMLOListElement;
const empty = document.getElementById("empty") as HTMLElement;

// Every new message arrives as ready-made HTML, the same markup the server
// put in the page. The browser reconnects on its own if the stream drops,
// and the server replays whatever was said in between, so a message already
// on the page is skipped.
const stream = new EventSource("/events");
stream.addEventListener("said", (e) => {
  const { id, html } = JSON.parse((e as MessageEvent<string>).data) as { id: number; html: string };
  if (document.getElementById(`m${id}`)) return;
  list.insertAdjacentHTML("afterbegin", html);
  empty.hidden = true;
});

// "just now" goes stale, so the times keep counting
setInterval(() => {
  for (const t of document.querySelectorAll<HTMLTimeElement>("time[data-at]")) {
    t.textContent = ago(Number(t.dataset.at));
  }
}, 15_000);
