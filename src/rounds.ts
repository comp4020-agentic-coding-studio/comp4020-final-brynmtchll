// Something to do in a room: a round of a game everyone plays by talking,
// and that's only fun because everyone can see *how* each thing was said
// (Brynly, 8 Nov: "a feeling of purpose to the original site, or something
// like a task to make it engaging and give users a reason to visit it").
//
// Say it like…: the room's given a line and a way to say it; everyone says
// it; each take shows drawn the way it was said, side by side; everyone taps
// the one that nailed it (not their own), and the most taps wins.
//
// Guess how: one person's given a secret way to say a line and says it;
// everyone else guesses the way from how it's drawn alone (four choices).
// The "emotion inferable, not labelled" position (decisions log 4) as a game.
//
// The question: a question for the room, answered by talking, the answers
// kept together for the round. For a group that just wants to talk.
//
// A round lives in memory, per room, as hands and walking do: a restart
// forgetting it is right. Only words and numbers are in it, as everywhere.
// The deciding is here, apart from the server, so it can be checked with a
// clock that's moved by hand.

export const LINES = [
  "I can't believe you did that",
  "We need to talk",
  "That's the best idea I've ever heard",
  "Oh, it's you",
  "I'll be there in five minutes",
  "Nobody told me about this",
  "Well, that went well",
  "Is this seat taken?",
  "I've got something to tell you",
  "You're not going to like this",
  "I made dinner",
  "It's raining again",
  "Guess what happened today",
  "Don't look now",
  "This changes everything",
  "I think we're lost",
  "Did you hear that?",
  "That's not what I said",
  "We won",
  "Okay, your turn",
] as const;

// ways to say a line: what the room's asked for, and the four choices a
// guess is made from (so each needs to sound unlike the others)
// (`label` asks you, "Say it …"; `short` names it, for guessing and saying
// how someone else said it)
export const WAYS = [
  { id: "thrilled", label: "like it's the best news ever", short: "thrilled", emoji: "🤩" },
  { id: "secret", label: "like it's a secret", short: "as a secret", emoji: "🤫" },
  { id: "furious", label: "like you're furious", short: "furious", emoji: "😠" },
  { id: "bored", label: "like you couldn't care less", short: "bored stiff", emoji: "🥱" },
  { id: "scared", label: "like you're scared", short: "scared", emoji: "😨" },
  { id: "sarcastic", label: "sarcastically", short: "sarcastic", emoji: "🙄" },
  { id: "sleepy", label: "like you've just woken up", short: "half asleep", emoji: "😴" },
  { id: "announcer", label: "like a sports announcer", short: "sports announcer", emoji: "📣" },
  { id: "asking", label: "like you're not sure", short: "not sure", emoji: "🤔" },
  { id: "heartbroken", label: "like your heart's breaking", short: "heartbroken", emoji: "💔" },
] as const;
export type WayId = (typeof WAYS)[number]["id"];

export const QUESTIONS = [
  "What's the best thing that happened this week?",
  "What's something you could talk about for an hour?",
  "What did you have for breakfast, and would you again?",
  "What's a small thing that annoys you more than it should?",
  "Where would you go tomorrow, if you could go anywhere?",
  "What's the last thing that made you laugh?",
  "What's a song you'd put on right now?",
  "What were you like at ten years old?",
  "What's overrated?",
  "What's something you're looking forward to?",
] as const;

export const GAMES = [
  { id: "say-it-like", label: "Say it like…", blurb: "Everyone says the same line the same way. Pick the take that nailed it." },
  { id: "guess-how", label: "Guess how", blurb: "One of you says a line a secret way. Everyone else guesses how, from the words alone." },
  { id: "question", label: "The question", blurb: "One question for the room. Answer by talking." },
] as const;
export type GameId = (typeof GAMES)[number]["id"];

// how long each part of a round lasts
export const SAY_FOR = 45_000; // to say your take (or the line, or answer)
export const VOTE_FOR = 25_000; // to pick the take that nailed it, or guess
export const SHOW_FOR = 12_000; // the result, before the table's free again
export const MOST_TAKES = 12;

export type Take = { name: string; id: number }; // whose, and the phrase (a message id)
export type Round = {
  n: number; // the room's round number, so a page can tell one from the next
  game: GameId;
  by: string; // who started it
  line: string; // the line to say (or the question)
  way: WayId | null; // how to say it (Say it like…); the secret way (Guess how), told only to the sayer
  sayer: string | null; // who says it (Guess how)
  choices: WayId[]; // what to guess from (Guess how)
  phase: "say" | "vote" | "done";
  until: number; // when this phase ends
  takes: Take[];
  votes: Map<string, string | WayId>; // voter, whose take (or which way, guessing)
};

export type Pick = <T>(xs: readonly T[]) => T;
const anyOf: Pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// A new round, started by `by`, with `here` the people in the room now.
// Guess how needs someone to say it and at least one to guess: the sayer is
// whoever started it (they know the secret; it's their turn).
export function startRound(game: GameId, by: string, n: number, now: number, pick: Pick = anyOf): Round {
  const way = pick(WAYS).id;
  // (three others, each drawn from those not yet chosen, so it always ends)
  const choices: WayId[] = [way];
  while (choices.length < 4) choices.push(pick(WAYS.filter((w) => !choices.includes(w.id))).id);
  choices.sort();
  return {
    n,
    game,
    by,
    line: game === "question" ? pick(QUESTIONS) : pick(LINES),
    way: game === "question" ? null : way,
    sayer: game === "guess-how" ? by : null,
    choices: game === "guess-how" ? choices : [],
    phase: "say",
    until: now + SAY_FOR,
    takes: [],
    votes: new Map(),
  };
}

// Someone's phrase, said while a round's taking takes: whether it's theirs
// for the round. Your first phrase in the round is your take (a second
// doesn't replace it: what you said, you said); in Guess how only the
// sayer's counts, and once they've said it, it's time to guess.
export function takeFrom(r: Round, name: string, id: number, now: number): boolean {
  if (r.phase !== "say" || now > r.until) return false;
  if (r.game === "guess-how" && name !== r.sayer) return false;
  if (r.takes.some((t) => t.name === name) || r.takes.length >= MOST_TAKES) return false;
  r.takes.push({ name, id });
  if (r.game === "guess-how") {
    r.phase = "vote";
    r.until = now + VOTE_FOR;
  }
  return true;
}

// A vote (Say it like…: whose take; Guess how: which way). One each, changed
// until voting ends, never for yourself, and the sayer doesn't guess.
export function voteIn(r: Round, voter: string, choice: string, now: number): boolean {
  if (r.phase !== "vote" || now > r.until) return false;
  if (r.game === "say-it-like") {
    if (choice === voter || !r.takes.some((t) => t.name === choice)) return false;
  } else if (r.game === "guess-how") {
    if (voter === r.sayer || !r.choices.includes(choice as WayId)) return false;
  } else return false;
  r.votes.set(voter, choice);
  return true;
}

// Time passing: say → vote (Say it like…, with at least two takes to pick
// from; the question goes straight to showing what was said) → done → over
// (null: the table's free). A Say it like… round with fewer than two takes,
// or a Guess how the sayer never said, ends with nothing to pick.
export function tick(r: Round, now: number): Round | null {
  if (now < r.until) return r;
  if (r.phase === "say") {
    if (r.game === "say-it-like" && r.takes.length >= 2) return { ...r, phase: "vote", until: now + VOTE_FOR };
    return { ...r, phase: "done", until: now + SHOW_FOR };
  }
  if (r.phase === "vote") return { ...r, phase: "done", until: now + SHOW_FOR };
  return null;
}

// Whether everyone who can has voted, so voting can end early (with `here`
// the people in the room now).
export function allVoted(r: Round, here: string[]): boolean {
  if (r.phase !== "vote") return false;
  const can = here.filter((n) => (r.game === "guess-how" ? n !== r.sayer : r.takes.some((t) => t.name !== n)));
  return can.length > 0 && can.every((n) => r.votes.has(n));
}

// The result: Say it like…, each take's votes and who won (most votes; a
// tie, all of them); Guess how, how many guessed the way and who.
export type Result = { counts: Record<string, number>; winners: string[]; right: string[] };
export function resultOf(r: Round): Result {
  const counts: Record<string, number> = {};
  for (const c of r.votes.values()) counts[c] = (counts[c] ?? 0) + 1;
  if (r.game === "guess-how") return { counts, winners: [], right: [...r.votes].filter(([, c]) => c === r.way).map(([v]) => v) };
  const most = Math.max(0, ...Object.values(counts));
  return { counts, winners: most > 0 ? Object.keys(counts).filter((k) => counts[k] === most) : [], right: [] };
}

// A round as a page is sent it: never the secret way to anyone but the sayer
// (and to everyone once it's done), never votes until it's done (only how
// many), never anyone's id (names only, as everywhere).
export function shownTo(r: Round, viewer: string | undefined, drawn: (id: number) => string = () => ""): Record<string, unknown> {
  const done = r.phase === "done";
  const secret = r.game === "guess-how" && !done && viewer !== r.sayer;
  return {
    n: r.n,
    game: r.game,
    by: r.by,
    line: r.line,
    way: secret ? null : r.way,
    sayer: r.sayer,
    choices: r.choices,
    phase: r.phase,
    left: r.until,
    // (each take as it was said, drawn: the words are what's judged)
    takes: r.takes.map((t) => ({ ...t, html: drawn(t.id) })),
    voted: r.votes.size,
    ...(viewer && r.votes.has(viewer) ? { mine: r.votes.get(viewer) } : {}),
    ...(done ? { result: resultOf(r) } : {}),
  };
}
