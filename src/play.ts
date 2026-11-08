// The game at the room's table (rounds.ts), on the room's page: a card over
// the room with what the round asks, how long's left, everyone's takes drawn
// the way they were said, and a way to pick the one that nailed it (or guess
// how it was said); and, when the table's free, the games to start one.
// What you say is your take: there's nothing to press to take part but the
// microphone (or typing).
import { GAMES, WAYS, type GameId, type WayId } from "./rounds.ts";
import { esc } from "./voice.ts";

type Take = { name: string; id: number; html: string };
type Result = { counts: Record<string, number>; winners: string[]; right: string[] };
export type RoundShown = {
  n: number;
  game: GameId;
  by: string;
  line: string;
  way: WayId | null;
  sayer: string | null;
  choices: WayId[];
  phase: "say" | "vote" | "done";
  left: number; // when this part ends (server time, ms)
  takes: Take[];
  voted: number;
  mine?: string;
  result?: Result;
};

const wayOf = (id: WayId | null) => WAYS.find((w) => w.id === id);
const gameOf = (id: GameId) => GAMES.find((g) => g.id === id)!;

export function play(opts: { me: string; card: HTMLElement; starter: HTMLElement | null; hueOf: (name: string) => string; announce: (text: string) => void; sign?: (html: string) => void; chime?: (phase: RoundShown["phase"]) => void }): (r: RoundShown | null) => void {
  const { me, card, starter } = opts;
  let shown: RoundShown | null = null;
  let skew = 0; // server clock minus this one, from when each round's sent
  let timer = 0;

  const post = (body: unknown): Promise<Response> => fetch("round", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  // the games, to start one (only when the table's free, and only once joined)
  if (starter) {
    starter.innerHTML = GAMES.map((g) => `<button type="button" class="game-start" data-game="${g.id}"><strong>${g.label}</strong><small>${g.blurb}</small></button>`).join("");
    starter.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-game]");
      if (!b) return;
      b.disabled = true;
      const res = await post({ start: b.dataset.game }).catch(() => null);
      b.disabled = false;
      if (res?.status === 409) opts.announce("A round's already going.");
    });
  }

  const secondsLeft = (): number => (shown ? Math.max(0, Math.ceil((shown.left - (Date.now() + skew)) / 1000)) : 0);
  function clock(): void {
    const el = card.querySelector(".round-clock");
    if (el) el.textContent = shown?.phase === "done" ? "" : `${secondsLeft()}s`;
    const bar = card.querySelector<HTMLElement>(".round-bar");
    if (bar && shown) bar.style.setProperty("--left", String(secondsLeft()));
  }

  // what the round's asking of you, now
  function ask(r: RoundShown): string {
    const way = wayOf(r.way);
    if (r.game === "question") return r.phase === "say" ? "Answer by talking (or typing)." : "What everyone said.";
    if (r.game === "guess-how") {
      if (r.phase === "say") return r.sayer === me ? `Say it ${way?.label ?? ""} ${way?.emoji ?? ""}. Only you know.` : `${esc(r.sayer ?? "")} is about to say it a secret way. Watch how it comes out.`;
      if (r.phase === "vote") return r.sayer === me ? "Everyone's guessing how you said it." : "How did they say it?";
      return `${r.sayer === me ? "You" : esc(r.sayer ?? "")} said it: ${way?.short ?? ""} ${way?.emoji ?? ""}`;
    }
    if (r.phase === "say") return r.takes.some((t) => t.name === me) ? "Got your take. Waiting for everyone else's." : `Say it ${way?.label ?? ""} ${way?.emoji ?? ""}`;
    if (r.phase === "vote") return r.mine ? "Picked. You can change your mind." : "Tap the take that nailed it.";
    return r.result?.winners.length ? "Nailed it:" : r.takes.length < 2 ? "Not enough takes to pick from this time." : "Nobody picked.";
  }

  function takesHtml(r: RoundShown): string {
    if (r.game === "guess-how") {
      const take = r.takes[0];
      const said = take ? `<div class="take solo" style="--hue:${opts.hueOf(take.name)}"><span class="take-words words">${take.html}</span></div>` : `<p class="take-wait">Waiting for ${esc(r.sayer ?? "")}…</p>`;
      if (r.phase === "say") return said;
      const choices = r.choices
        .map((c) => {
          const w = wayOf(c)!;
          const n = r.result?.counts[c] ?? 0;
          const right = r.phase === "done" && c === r.way;
          return `<button type="button" class="guess${r.mine === c ? " picked" : ""}${right ? " right" : ""}" data-vote="${c}"${r.phase !== "vote" || r.sayer === me ? " disabled" : ""}><span aria-hidden="true">${w.emoji}</span> ${w.short}${r.phase === "done" ? ` <b>${n}</b>` : ""}</button>`;
        })
        .join("");
      const right = r.phase === "done" ? `<p class="round-note">${r.result?.right.length ? `${r.result.right.map(esc).join(", ")} guessed it.` : "Nobody guessed it."}</p>` : "";
      return `${said}<div class="guesses">${choices}</div>${right}`;
    }
    if (!r.takes.length) return `<p class="take-wait">${r.game === "question" ? "Nobody's answered yet." : "Nobody's said it yet."}</p>`;
    return `<ol class="takes">${r.takes
      .map((t) => {
        const votes = r.result?.counts[t.name] ?? 0;
        const won = r.result?.winners.includes(t.name);
        const can = r.game === "say-it-like" && r.phase === "vote" && t.name !== me;
        return `<li class="take${won ? " won" : ""}${r.mine === t.name ? " picked" : ""}" style="--hue:${opts.hueOf(t.name)}">
          <span class="take-name">${esc(t.name)}${t.name === me ? " · you" : ""}</span>
          <span class="take-words words">${t.html}</span>
          ${can ? `<button type="button" class="take-pick" data-vote="${esc(t.name)}" aria-pressed="${r.mine === t.name}">${r.mine === t.name ? "Picked" : "Nailed it"}</button>` : ""}
          ${r.phase === "done" && r.game === "say-it-like" ? `<span class="take-votes">${votes} ${votes === 1 ? "pick" : "picks"}</span>` : ""}
        </li>`;
      })
      .join("")}</ol>`;
  }

  function draw(r: RoundShown | null): void {
    const was = shown;
    shown = r;
    document.body.classList.toggle("round-on", !!r);
    if (starter) starter.hidden = !!r;
    opts.sign?.(r ? `<span class="table-sign-game">${gameOf(r.game).label}</span><span class="table-sign-line">${esc(r.line)}</span>${r.phase === "done" && r.result?.winners.length ? `<span class="table-sign-win">🏆 ${r.result.winners.map(esc).join(", ")}</span>` : ""}` : "");
    if (!r) {
      clearInterval(timer);
      card.hidden = true;
      card.innerHTML = "";
      delete card.dataset.key;
      return;
    }
    // (said aloud once each time the round moves on, not on every vote)
    if (!was || was.n !== r.n || was.phase !== r.phase) opts.chime?.(r.phase);
    if (!was || was.n !== r.n || was.phase !== r.phase) opts.announce(`${gameOf(r.game).label} ${r.phase === "say" ? "started" : r.phase === "vote" ? "time to pick" : "done"}: ${r.line}`);
    card.hidden = false;
    card.dataset.phase = r.phase;
    card.dataset.game = r.game;
    const total = r.phase === "say" ? 45 : r.phase === "vote" ? 25 : 12;
    // (only redrawn when what's shown changes: a vote's count arriving
    // mustn't pull a button out from under a finger)
    const key = JSON.stringify([r.n, r.phase, r.takes.map((t) => t.id), r.mine, r.result, r.way]);
    if (card.dataset.key === key) return void clock();
    card.dataset.key = key;
    card.innerHTML = `
      <div class="round-head"><span class="round-game">${gameOf(r.game).label}</span><span class="round-by">started by ${esc(r.by)}</span><span class="round-clock" aria-hidden="true"></span></div>
      <div class="round-bar" style="--total:${total}" aria-hidden="true"></div>
      <p class="round-line">${r.game === "question" ? "" : "“"}${esc(r.line)}${r.game === "question" ? "" : "”"}</p>
      <p class="round-ask">${ask(r)}</p>
      ${takesHtml(r)}`;
    clock();
    clearInterval(timer);
    timer = window.setInterval(clock, 500);
  }

  card.addEventListener("click", async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-vote]");
    if (!b || !shown || b.disabled) return;
    await post({ vote: b.dataset.vote, n: shown.n }).catch(() => null);
  });

  return (r) => {
    if (r) skew = 0; // (the server's clock is close enough to the page's: times are whole seconds)
    draw(r);
  };
}
