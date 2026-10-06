import { affordable, coins, span } from "./market.ts";
import type { Snapshot } from "./db.ts";

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="top"><a href="/" class="ticker">AIR</a><nav><a href="/">Market</a><a href="/readme/">About</a></nav></header>
${body}
</body>
</html>`;
}

const ago = (at: number): string => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const MESSAGES: Record<string, string> = {
  "name-bad": "Pick a name between 1 and 20 characters.",
  "name-taken": "Someone already trades under that name.",
  broke: "You can't afford that.",
  "no-shares": "You don't hold that many shares.",
  "bad-qty": "That isn't a number of shares.",
  "no-player": "Join the market first.",
};

// the price line, drawn server-side so it's there without any script
function chart(history: number[]): string {
  const pts = [100, ...history];
  const w = 600;
  const h = 160;
  const max = Math.max(...pts, 200);
  const x = (i: number) => (pts.length === 1 ? 0 : (i / (pts.length - 1)) * w);
  const y = (p: number) => h - (p / max) * (h - 8);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
    aria-label="Price of the next share over the last ${pts.length - 1} trades, now ${coins(pts.at(-1)!)}">
    <polyline points="0,${h} ${line} ${w},${h}" class="fill" />
    <polyline points="${line}" class="line" vector-effect="non-scaling-stroke" />
  </svg>`;
}

function tradeForms(m: Snapshot): string {
  const me = m.me!;
  const buy = (q: number) => (span(m.supply, q) <= me.coins ? span(m.supply, q) : null);
  const sell = (q: number) => (q <= me.shares ? span(m.supply - q, q) : null);
  const most = affordable(m.supply, me.coins);
  const btn = (side: string, qty: string, label: string, amount: number | null) =>
    `<form method="post" action="/trade"><input type="hidden" name="side" value="${side}"><input type="hidden" name="qty" value="${qty}">
      <button class="${side}" ${amount === null ? "disabled" : ""}>${label}<small>${amount === null ? "—" : coins(amount)}</small></button></form>`;
  return `<div class="trade">
    <div class="side">${btn("buy", "1", "Buy 1", buy(1))}${btn("buy", "10", "Buy 10", buy(10))}${btn("buy", "max", `Buy ${most || "all you can"}`, most > 0 ? span(m.supply, most) : null)}</div>
    <div class="side">${btn("sell", "1", "Sell 1", sell(1))}${btn("sell", "10", "Sell 10", sell(10))}${btn("sell", "max", "Sell everything", me.shares > 0 ? sell(me.shares) : null)}</div>
  </div>`;
}

// minutes and seconds, for the countdown
const mmss = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The countdown is rendered by the server, so it reads right without
// JavaScript; the script only keeps it ticking and reloads the page once it
// runs out, when the server will have popped the bubble.
function clock(m: Snapshot): string {
  if (m.bubble.popsIn === null) {
    return `<p class="clock idle">Nobody is holding. The next buy starts the clock.</p>`;
  }
  return `<p class="clock">Pops in <time role="timer" id="clock" data-ms="${m.bubble.popsIn}">${mmss(m.bubble.popsIn)}</time> unless someone buys.</p>
    <script>
      (() => {
        const el = document.getElementById("clock");
        const end = performance.now() + Number(el.dataset.ms);
        const tick = () => {
          const left = end - performance.now();
          if (left <= 0) return location.replace("/");
          const s = Math.ceil(left / 1000);
          el.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
          setTimeout(tick, 250);
        };
        tick();
      })();
    </script>`;
}

export function marketPage(m: Snapshot, msg: string | undefined): string {
  const air = m.paper - m.pot;
  const notice = msg && MESSAGES[msg] ? `<p class="notice" role="alert">${MESSAGES[msg]}</p>` : "";
  const you = m.me
    ? `<section class="you" aria-labelledby="you-h">
        <h2 id="you-h">${esc(m.me.name)}</h2>
        <dl>
          <div><dt>Coins</dt><dd>${coins(m.me.coins)}</dd></div>
          <div><dt>Shares</dt><dd>${m.me.shares}</dd></div>
          <div><dt>On paper</dt><dd>${coins(m.me.shares * m.lastPrice)}</dd></div>
          <div><dt>If you sold everything now</dt><dd>${coins(m.me.cashOut - m.me.coins)}</dd></div>
        </dl>
        ${
          m.me.bags.length
            ? `<p class="bagged">You were holding ${m.me.bags[0].shares} share${m.me.bags[0].shares === 1 ? "" : "s"} when bubble #${m.me.bags[0].bubble} popped ${ago(m.me.bags[0].at)}${
                m.me.bags.length > 1 ? `. Caught in ${m.me.bags.length} pops, ${coins(m.me.bags.reduce((sum, g) => sum + g.lost, 0))} gone in all.` : "."
              }</p>`
            : ""
        }
        ${notice}
        ${tradeForms(m)}
      </section>`
    : `<section class="you" aria-labelledby="join-h">
        <h2 id="join-h">Join the market</h2>
        <p>You get 100 coins. There is one thing to buy.</p>
        ${notice}
        <form method="post" action="/join" class="join">
          <label for="name">Trading name</label>
          <input id="name" name="name" maxlength="20" required autocomplete="nickname">
          <button>Join</button>
        </form>
      </section>`;

  const board = m.players
    .slice(0, 15)
    .map(
      (p, i) =>
        `<tr${m.me && p.name === m.me.name ? ' class="mine"' : ""}><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.shares}</td><td>${coins(p.coins)}</td><td>${coins(p.cashOut)}</td></tr>`,
    )
    .join("");

  const tape = m.tape
    .map((t) =>
      t.kind === "pop"
        ? `<li class="pop"><strong>Bubble #${t.bubble} popped.</strong> ${coins(t.burned)} vanished. <time>${ago(t.at)}</time></li>`
        : `<li><span class="${t.side}">${esc(t.name)} ${t.side === "buy" ? "bought" : "sold"} ${t.qty}</span> for ${coins(t.amount)} <time>${ago(t.at)}</time></li>`,
    )
    .join("");

  const past = m.past
    .map(
      (b) =>
        `<tr><td>#${b.number}</td><td>${mmss(b.poppedAt - b.startedAt)}</td><td>${coins(b.peakPrice)}</td><td>${coins(b.burned)}</td><td>${
          b.bag ? `${esc(b.bag.name)} (${b.bag.shares})` : "—"
        }</td></tr>`,
    )
    .join("");

  return layout(
    "AIR — shares in nothing",
    `<main>
  <section class="quote" aria-labelledby="price-h">
    <p class="label">Bubble #${m.bubble.number}</p>
    <h1 id="price-h"><span class="label">Next share</span> <span class="price">${coins(m.nextPrice)}</span></h1>
    ${clock(m)}
    <p class="sub">Every share costs 0.10 more than the one before, and selling walks the price back down. If nobody buys for five minutes, it pops: every share is wiped and the money in the pot is gone.</p>
    ${chart(m.history)}
  </section>

  <section class="air" aria-labelledby="air-h">
    <h2 id="air-h" class="visually-hidden">The market</h2>
    <dl>
      <div><dt>Shares in existence</dt><dd>${m.supply}</dd></div>
      <div><dt>Worth on paper</dt><dd>${coins(m.paper)}</dd></div>
      <div><dt>Money actually in the pot</dt><dd>${coins(m.pot)}</dd></div>
      <div class="gap"><dt>Air</dt><dd>${coins(air)}</dd></div>
      <div><dt>Lost in pops so far</dt><dd>${coins(m.burnedTotal)}</dd></div>
    </dl>
  </section>

  ${you}

  <section aria-labelledby="board-h">
    <h2 id="board-h">Holders</h2>
    ${
      board
        ? `<div class="scroll"><table><thead><tr><th>#</th><th>Name</th><th>Shares</th><th>Coins</th><th>Cash-out</th></tr></thead><tbody>${board}</tbody></table></div>
           <p class="fine">Cash-out is what they'd walk away with if they sold everything first, before anyone else.</p>`
        : "<p>Nobody yet.</p>"
    }
  </section>

  <section aria-labelledby="tape-h">
    <h2 id="tape-h">Tape</h2>
    ${tape ? `<ol class="tape">${tape}</ol>` : "<p>No trades yet.</p>"}
  </section>

  <section class="wide" aria-labelledby="past-h">
    <h2 id="past-h">Past bubbles</h2>
    ${
      past
        ? `<div class="scroll"><table><thead><tr><th>Bubble</th><th>Lasted</th><th>Peak</th><th>Vanished</th><th>Biggest bag</th></tr></thead><tbody>${past}</tbody></table></div>`
        : "<p>None yet. This is the first.</p>"
    }
  </section>
</main>`,
  );
}

export function readmePage(html: string): string {
  return layout("About AIR", `<main class="prose">${html}</main>`);
}
