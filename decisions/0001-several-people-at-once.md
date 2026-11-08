# 1. Several people at once: each person keeps a place, and words arrive as said

## Status

Accepted 14 October 2026, for crit 9. It has changed since. See the last
section.

## Context

Several people talk at once. Readers need to know whose words are whose, and
in what order.

The first build was a shared chat log
([`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)):
- Phrases went out after a preview.
- Each phrase became a line in one list.
- Two speakers' lines interleaved, in the order each finished.

With several people talking, I couldn't follow any one person through the
interleaved lines, and a log shows what was written, not how it was said.
The point of the pivot was inflection, and a log had nowhere to put it.

## Options

1. **A shared log.**
   - For: it's familiar, and the order is easy to follow.
   - Against: speakers interleave line by line. It's the "chat room with the
     nouns swapped" risk raised at the pivot.
2. **A grid of bordered boxes, one per person.**
   - For: each person's words stay together.
   - Against: it reads as a dashboard, not a room.
3. **A live stage** (chosen).
   - Each person has a fixed spot and colour, the same on every screen.
   - Words appear one at a time, and the last one fades.
   - Speakers never collide.

## Decision

Option 3, from Brynly's redesign message on 13 October:

> "messages send automatically, they streem continuously and you have a
> toggle option for recording (with no time limit) each room member is in a
> different spot on the screen, (maybe with different collored text to
> distinguish) and i want words to show up one at a time in the same spot"

The same message cut five things
([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)):
- the pitch lines ("i dont like that")
- the log
- the borders
- the grid
- rotated text

How it was built:
- **Places and colours follow join order.** Colour by name was tried first.
  It gave two near-identical pinks
  ([`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)).
- **A new phrase waits until the speaker's last one finishes playing.**
  Claude chose this.
- **The word queue was Brynly's idea.** Your words waited on your own screen,
  and you could edit them there. Then they went out at speaking pace
  ([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566),
  [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)).

The stage serves "good" better because it shows speech happening rather than
text that was written. A fixed spot and colour tell you whose words are whose
without reading a name. Words one at a time in the same spot keep the pace of
the speaker, and the fading last word stops anything piling up. The log and
the grid both showed finished text.

## Consequences

- **Speakers stay legible.** `spec/room.test.ts` checks that words reach
  every other open page within 1 s, without a reload.
- **No history showed on the page.** Words were stored but not shown, so a
  newcomer couldn't catch up. That conflicts with the brief's "persists".
- **The queue delayed every word by about 1 s.**

The cost fell on anyone who arrived late, looked away, or reads slowly,
including deaf and hard-of-hearing readers who rely on captions: once a word
faded, it was gone. The queue also made the speaker wait on every word, which
worked against the live feel.

## What changed after crit 9

Each person still keeps a place. The rest changed with use:

- **A record came back the next day.** Brynly asked for it: "reintroduce a
  brief record of whats been said for legibility" (14 Oct).
  - Lately returned
    ([`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)).
  - On 20 Oct, each card got a text thread.
- **The queue went.** Brynly: "get rid of the loading zone and have the text
  be transmitted directly" (20 Oct).
  - Phrases now go out about 1.2 s after the speaker finishes.
  - You edit your words live, after sending
    ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **Turn-taking was added.** You can raise a hand to speak next. Every page
  shows the same queue
  ([`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)).
- **Places became seats in a 3D room**
  ([`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)).
- **The room became a party you can read** (8 Nov).
  - Words are clear up close and fade with distance. Loud words carry further
    ([`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277);
    `spec/hearing.test.ts`).
  - The stage separated voices by place. The party separates them by
    distance.

The party extended this decision rather than replacing it. Each person keeps a
place and a colour, and words still arrive as said. What changed is how voices
are told apart: by place on the stage, by distance in the party.
