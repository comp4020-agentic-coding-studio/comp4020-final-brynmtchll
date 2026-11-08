import { describe, expect, it } from "vitest";
import { allVoted, resultOf, voteIn, SAY_FOR, SHOW_FOR, shownTo, startRound, takeFrom, tick, VOTE_FOR, WAYS, type Pick } from "../src/rounds.ts";

// A round of a game in a room, run with a clock moved by hand.
const first: Pick = (xs) => xs[0];
let rolled = 0;
const roll: Pick = (xs) => xs[rolled++ % xs.length];

describe("a round of Say it like…", () => {
  it("takes each person's first phrase as their take, only while it's taking them", () => {
    const r = startRound("say-it-like", "ana", 1, 0, first);
    expect(r.line).toBeTruthy();
    expect(r.way).toBe(WAYS[0].id);
    expect(takeFrom(r, "ana", 10, 1000)).toBe(true);
    // (what you said, you said: a second phrase isn't a second take)
    expect(takeFrom(r, "ana", 11, 2000)).toBe(false);
    expect(takeFrom(r, "ben", 12, 3000)).toBe(true);
    expect(takeFrom(r, "cat", 13, SAY_FOR + 1)).toBe(false);
    expect(r.takes).toEqual([
      { name: "ana", id: 10 },
      { name: "ben", id: 12 },
    ]);
  });

  it("goes to voting with two takes or more, one vote each and never for yourself, and the most votes wins", () => {
    let r = startRound("say-it-like", "ana", 1, 0, first);
    takeFrom(r, "ana", 1, 10);
    takeFrom(r, "ben", 2, 20);
    takeFrom(r, "cat", 3, 30);
    r = tick(r, SAY_FOR)!;
    expect(r.phase).toBe("vote");
    expect(r.votes.size).toBe(0);
    // (votes don't count before voting, or for yourself, or for no take)
    expect(voteIn(r, "ana", "ana", SAY_FOR + 1)).toBe(false);
    expect(voteIn(r, "ana", "nobody", SAY_FOR + 1)).toBe(false);
    expect(voteIn(r, "ana", "ben", SAY_FOR + 1)).toBe(true);
    expect(voteIn(r, "cat", "ben", SAY_FOR + 2)).toBe(true);
    expect(voteIn(r, "ben", "cat", SAY_FOR + 3)).toBe(true);
    // a change of mind replaces the vote, it doesn't add one
    expect(voteIn(r, "cat", "ana", SAY_FOR + 4)).toBe(true);
    expect(voteIn(r, "cat", "ben", SAY_FOR + 5)).toBe(true);
    expect(allVoted(r, ["ana", "ben", "cat"])).toBe(true);
    r = tick(r, SAY_FOR + VOTE_FOR)!;
    expect(r.phase).toBe("done");
    expect(resultOf(r)).toEqual({ counts: { ben: 2, cat: 1 }, winners: ["ben"], right: [] });
    // and then the table's free
    expect(tick(r, SAY_FOR + VOTE_FOR + SHOW_FOR)).toBeNull();
  });

  it("ends with nothing to pick if fewer than two took part, and calls a tie a tie", () => {
    const lone = startRound("say-it-like", "ana", 1, 0, first);
    takeFrom(lone, "ana", 1, 10);
    expect(tick(lone, SAY_FOR)!.phase).toBe("done");
    let r = startRound("say-it-like", "ana", 2, 0, first);
    takeFrom(r, "ana", 1, 10);
    takeFrom(r, "ben", 2, 20);
    r = tick(r, SAY_FOR)!;
    voteIn(r, "ana", "ben", SAY_FOR + 1);
    voteIn(r, "ben", "ana", SAY_FOR + 1);
    expect(resultOf(r).winners.sort()).toEqual(["ana", "ben"]);
  });
});

describe("a round of Guess how", () => {
  it("keeps the way secret from everyone but the sayer until it's done, and counts who guessed it", () => {
    rolled = 0;
    let r = startRound("guess-how", "ana", 1, 0, roll);
    expect(r.sayer).toBe("ana");
    expect(r.choices).toHaveLength(4);
    expect(new Set(r.choices).size).toBe(4);
    expect(r.choices).toContain(r.way);
    expect(shownTo(r, "ben").way).toBeNull();
    expect(shownTo(r, "ana").way).toBe(r.way);
    // only the sayer's phrase counts, and once said, it's time to guess
    expect(takeFrom(r, "ben", 5, 100)).toBe(false);
    expect(takeFrom(r, "ana", 6, 200)).toBe(true);
    expect(r.phase).toBe("vote");
    const wrong = r.choices.find((c) => c !== r.way)!;
    expect(voteIn(r, "ana", r.way!, 300)).toBe(false);
    expect(voteIn(r, "ben", r.way!, 300)).toBe(true);
    expect(voteIn(r, "cat", wrong, 300)).toBe(true);
    expect(voteIn(r, "dev", "not-a-way", 300)).toBe(false);
    // (how many have guessed shows; what they guessed doesn't, until it's done)
    expect(shownTo(r, "dev").voted).toBe(2);
    expect(shownTo(r, "dev").result).toBeUndefined();
    expect(shownTo(r, "ben").mine).toBe(r.way);
    expect(allVoted(r, ["ana", "ben", "cat"])).toBe(true);
    r = tick(r, 200 + VOTE_FOR)!;
    expect(shownTo(r, "dev").way).toBe(r.way);
    expect(resultOf(r).right).toEqual(["ben"]);
  });
});

describe("a round of the question", () => {
  it("keeps everyone's answer for the round and doesn't vote on them", () => {
    let r = startRound("question", "ana", 1, 0, first);
    expect(r.way).toBeNull();
    expect(takeFrom(r, "ana", 1, 10)).toBe(true);
    expect(takeFrom(r, "ben", 2, 10)).toBe(true);
    r = tick(r, SAY_FOR)!;
    expect(r.phase).toBe("done");
    expect(voteIn(r, "ana", "ben", SAY_FOR + 1)).toBe(false);
    expect(r.takes).toHaveLength(2);
  });
});

