# 1. Several people at once: everyone keeps their own place, and words arrive as they're said

## Status

Accepted 14 October 2026, for crit 9. Changed since, as listed under "What
changed after crit 9" below.

## Context

Said is a room where people speak rather than type, and each word is drawn
the way it was said. The brief asks for an app that is more interesting
because others are in it at the same time. In a room of people talking, the
hard case is several of them talking at once: whose words are whose, in what
order, and does anything get lost or jumbled.

On 13 October, the first working version was a chat log: phrases went out
after a preview, and each appeared as a new line in one shared list
([`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)).
With two people talking, their lines interleaved in the order they finished.

> *Brynly: one or two sentences on what was wrong with the log for this app.*

## Options considered

1. **One shared log, newest at the bottom**, as built first. Easy to follow
   in order, and familiar from chat apps. People talking at once interleave
   line by line. It is also the "chat room with the nouns swapped" that
   Claude raised as a risk when you pivoted.
2. **A grid of boxes, one per person**, with borders. This is what the first
   multi-person layout used. Each person's words stay together. But it looks
   like a dashboard, not a room.
3. **A live stage: each person a fixed spot, words one at a time** (chosen).
   Each person has their own place and colour, scattered across the page, the
   same on every screen. Their words appear one at a time in that spot and the
   last one fades. Several people speaking at once don't collide, because each
   has their own spot.

## Decision

Option 3, from your redesign spec of 13 October, sent as one message:

> "messages send automatically, they streem continuously and you have a
> toggle option for recording (with no time limit) each room member is in a
> different spot on the screen, (maybe with different collored text to
> distinguish) and i want words to show up one at a time in the same spot"

The same message cut the pitch lines ("i dont like that"). It also cut the
log, the borders, the grid and the rotation. Built in
[`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c).
Places and colours are assigned by join order, so they're the same on every
page. Colour by name was tried first and gave two near-identical pinks
([`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)).
If a phrase arrives while that speaker's last one is still playing, the new
one waits its turn. That was Claude's implementation choice.

The word queue
([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566),
[`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80))
was also yours. Your words waited on your own screen so you could type over,
delete or add an effect to them before they went out at speaking pace ("make
the queue go in real time").

> *Brynly: why the stage serves "good" better than the log or the grid.*

## Consequences

- **Several voices stay readable.** Two or more people speaking at once each
  stay in their own place. `spec/room.test.ts` checks that what one person
  says reaches every other open page within a second, without a reload.
- **There was no history on the page.** The page showed only what was said
  after it opened. The words were stored, but a newcomer couldn't see what
  had already been said. This conflicted with the brief's "persists".
- **The queue delayed everyone else.** Every word reached others about a
  second late, by design.

> *Brynly: what this cost, and who lost out.*

## What changed after crit 9

The decision held, each person in their own place, but use changed parts of
it:

- **A record came back the next day.** "reintroduce a brief record of whats
  been said for legibility" (14 Oct) brought back "Lately"
  ([`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)).
  On 20 Oct each card got its own text thread, modelled on texting
  ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **The queue went.** "get rid of the loading zone and have the text be
  transmitted directly" (20 Oct). Phrases now go out as soon as they're heard,
  about 1.2 s after the speaker finishes, and you edit words live after
  they're sent
  ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **Turn-taking was added.** You can raise a hand to speak next, in one queue
  shared by every page
  ([`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a)).
- **Each place became a seat in a 3D room**
  ([`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)).
  On 8 Nov the room became "a party you can read": what someone says is clear
  near them and fades with distance, and a loud word carries further. So
  several conversations can run at once and you follow the one you walk up
  to ("ok lets go with the first";
  [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277);
  `spec/hearing.test.ts`). This is a second answer to the same problem: the
  stage kept voices apart by place, and the party lets them overlap by
  distance.

> *Brynly: did the party replace this decision or extend it?*
