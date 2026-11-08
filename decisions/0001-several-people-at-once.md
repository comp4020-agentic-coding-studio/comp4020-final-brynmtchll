# 1. Several people at once: each person keeps a place, and words arrive as said

## Status

Accepted 14 October 2026 (crit 9). Changed since; see the last section.

## Context

When several people talk at once, readers need to know whose words are whose
and in what order. The first build was a shared chat log
([`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)):
- phrases went out after a preview
- each became a line in one list
- two speakers' lines interleaved in the order each finished

> *Brynly: what was wrong with the log for this app.*

## Options

1. **A shared log.**
   - For: familiar, and the order is easy to follow.
   - Against: speakers interleave line by line. It's the "chat room with the
     nouns swapped" risk raised at the pivot.
2. **A grid of bordered boxes, one per person.**
   - For: each person's words stay together.
   - Against: it reads as a dashboard, not a room.
3. **A live stage** (chosen).
   - Each person has a fixed spot and colour, the same on every screen.
   - Words appear one at a time and the last one fades.
   - Simultaneous speakers never collide.

## Decision

Option 3, from Brynly's redesign message on 13 October:

> "messages send automatically, they streem continuously and you have a
> toggle option for recording (with no time limit) each room member is in a
> different spot on the screen, (maybe with different collored text to
> distinguish) and i want words to show up one at a time in the same spot"

The same message cut the pitch lines ("i dont like that"), the log, the
borders, the grid and the rotation
([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)).

How it was built:
- **Places and colours are assigned by join order.** Colour by name was
  tried first and gave two near-identical pinks
  ([`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)).
- **A speaker's new phrase waits until their previous one finishes
  playing.** This was Claude's implementation choice.
- **Brynly's word queue** held your words on your own screen so you could
  edit them before they went out at speaking pace
  ([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566),
  [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)).

> *Brynly: why the stage serves "good" better than the log or grid.*

## Consequences

- **Simultaneous speakers stay legible.** `spec/room.test.ts` checks that
  words reach every other open page within 1 s, without a reload.
- **There was no history on the page.** Words were stored but not shown, so
  a newcomer couldn't catch up. That sits badly with the brief's "persists".
- **The queue delayed every word by about 1 s.**

> *Brynly: what this cost, and who lost out.*

## What changed after crit 9

Each person keeps their own place. Use changed the rest:

- **A record came back the next day.** Brynly: "reintroduce a brief record of
  whats been said for legibility" (14 Oct).
  - Lately returned
    ([`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)).
  - On 20 Oct it became a text thread per card.
- **The queue was removed.** Brynly: "get rid of the loading zone and have
  the text be transmitted directly" (20 Oct).
  - Phrases now go out about 1.2 s after the speaker finishes.
  - Your own words can be edited live after they're sent
    ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **Turn-taking.** You can raise a hand to speak next, in one queue shared
  by every page
  ([`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)).
- **Places became seats in a 3D room**
  ([`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)).
- **The room became a party you can read** (8 Nov).
  - What someone says is clear up close and fades with distance, and loud
    words carry further
    ([`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277);
    `spec/hearing.test.ts`).
  - The stage separated voices by place. The party lets them overlap, and
    separates them by distance.

> *Brynly: did the party replace this decision or extend it?*
