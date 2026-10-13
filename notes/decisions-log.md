# Decision log: raw material for PROCESS.md and reflections/crit-9.md

Not a draft. The brief says PROCESS.md and the reflections are yours to write;
this is the record to write them from: what you decided, when, and the
commit it landed in. Each line says who made the call, so your account can
be accurate about the split. Commit links are in the form `check:evidence`
reads.

Repo: https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll

## Your decisions (Bryn), in order

1. **Pivot from AIR.** After reading about speech-to-text options, you asked
   whether any could transcribe *inflection*, and on hearing what was
   possible, chose to pivot the whole project the day before crit 9, against
   the risk Claude raised (that a chat app with voice input reads as "a chat
   room with the nouns swapped"). You said you weren't worried about it.
   Lands in [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b).
2. **Drawn-out words as repeated letters** ("sooo"), your idea, replacing
   letter-spacing. [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)
3. **"Do more testing on real audio"**, which led to the CREMA-D / EARS /
   JFK testing and most of the hearing fixes.
   [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030),
   [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073),
   [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a)
4. **Emotion should be inferable, not labelled.** When Claude raised the
   CHI 2023 finding that DHH users preferred emotion labels over prosody-only
   captions, you chose the opposite position: make emotion easier to *infer*.
5. **Of the ways offered to make it more inferable, you chose:** keep
   playback at the pace it was said; trial a per-person "usual voice" and a
   pitch line. [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
6. **The redesign** (your spec, in one message): messages send themselves
   and stream continuously; a microphone toggle with no time limit; each
   person in a different place on screen in their own colour; words appear
   one at a time in the same spot, whole; the last word lingers then fades;
   **cut the pitch lines ("I don't like that").**
   [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
7. **Strip it back further:** no log/transcript, no borders, people spread
   across the screen rather than in a grid, no text rotation. (Same commit.)
8. **The word queue** (your idea): words wait on your screen before they go
   out; typing overwrites the next word; delete words; number keys put
   effects on them. You chose the effects (Impact, Whisper, Glow), that the
   next word sends itself after a moment, then "1 s at a time", then
   "make the queue go in real time".
   [`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566),
   [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)

## What Claude did (so you can say so accurately)

- Built everything above, and made the implementation calls inside it:
  in-browser Whisper (base.en, word timestamps), YIN pitch, server-sent
  events, the phrase cutting, colours and placement, the checks in `spec/`.
- Ran two independent code reviews (subagents) and fixed what they found
  ([`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e),
  [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)).
- Several of its own wrong turns, each visible in commit messages: a
  drawn-out measure that misfired on real speech; three pace measures that
  disagreed, so "faster/slower" was dropped; Whisper inventing sentences
  ("My name is Bernoulli.") from silence; a worker race that sent one
  phrase's audio with another's words.

## Questions only you can answer (the reflection prompts)

- *What was the breakthrough that moved the work forward?* Which of your
  calls changed the most? (Candidates: the pivot itself; the redesign away
  from messages to a live stage; the queue.)
- *What did this change about who you want to be as a developer?* E.g.
  directing by spec and cutting what you didn't like (pitch lines, the log)
  vs. building it yourself.
- Still open for the README: persistence. Nothing past is shown on the page
  any more; the brief says what people do must still be there when they come
  back. What's your argument?
