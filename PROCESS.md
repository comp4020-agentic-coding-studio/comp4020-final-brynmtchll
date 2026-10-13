# Process overview

I started this brief as AIR [one line on what AIR was]. On 13 October, the day before the crit, I dropped it, even though it worked. [Why: what AIR couldn't do that inflection could, and why that was worth more than a working app.] I archetyped the pivot before any code: a room of spoken messages, updating live, where each word is drawn the way it was said. That framing is the pivot commit, [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b), and everything after it was judged against it.

## How I directed the work

I worked by spec and by test. I set the direction, Claude built, and I decided what stayed. The first morning went from nothing to a working loop: recording and transcription in the browser ([`37b6cfe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/37b6cfe)), then measuring how each word was said and drawing it ([`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf)). The idea that made it feel like speech rather than a chart was mine: drawn-out words stretch into repeated letters, "sooo" ([`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)).

## How I knew it worked

A demo that looks right proves little, so I asked for tests on real audio. They found problems I'd never have seen by eye: takes being lost, whispers vanishing, and Whisper inventing sentences out of silence. Claude fixed the hearing so words were re-placed and judged by held vowels ([`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030)). I then asked for more testing, which produced 178 acted takes in six moods ([`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073)). That round drove the later work on several speakers at once, whispers and split words ([`dca3a7a...0cbcdf4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/compare/dca3a7a...0cbcdf4)). I also asked for independent reviews. They caught real bugs, including one phrase receiving another's words ([`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)), and I chose which of their suggestions to keep and trial ([`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)).

## What I threw away

The cuts are where my judgement shows most.

- **The pitch line.** I trialled a usual-voice and pitch line in [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e) and removed it in the redesign. [Why it went.]
- **"Faster/slower".** The real-audio tests showed it was unreliable, so I dropped it in [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073). A label that is sometimes wrong is worse than no label.
- **The message log, borders, grid layout and rotation.** In [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c) I rewrote the whole spec: a live stage, a spot for each speaker, words appearing one by one, no log. The app stopped being a chat room and became a place where speech happens. [Why a log was the wrong thing.]

## A position I took on purpose

[Which finding of the CHI 2023 study I disagreed with, and the reason I went the other way.]

## The queue

Late on the last day I added the word queue ([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566)). Words wait so the speaker can type over them, delete them or add effects after speaking. The idea and the choices were mine. Then I asked for it to release at speaking pace ("make it real time"), because a queue that dumps words at once breaks the sense of a live voice ([`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)).

## Stack and why

- **Whisper in the browser, not a hosted API.** Audio never leaves the device, there's no key to leak and no per-use cost. The trade-off is an 80MB first download, which I accepted because [reason].
- **Server-sent events** for live updates: [reason, e.g. one-way flow, simpler than WebSockets].
- **No build step**: [reason].

Claude wrote most of the code. What I contributed is visible in the record: the pivot, the spec for the redesign, the ideas I chose to keep, and the tests that showed what was true.