# Process

## Where it started

I started as AIR, a market in shares of nothing whose bubble pops after five idle minutes ([`16bf213`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/16bf213)). On 13 October, the day before crit 9, I dropped it, even though it worked. I pivoted to a room where each spoken word is drawn the way it was said ([`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b)). Claude warned it might be "a chat room with the nouns swapped". I went ahead. In AIR only a number moved, and a number can't carry how something was said. Inflection can.

From there the site grew two ways. My attention moved across parts of the interaction, one at a time. And I tried options, keeping some and throwing others away.

## How I worked with the agent

I gave direction in one message, Claude built it in a long run, and I judged it by using it. The redesign was one message ([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)). So were the big tickets on 21 October ([`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db)). I also asked for checks: tests on real audio ([`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030)), independent reviews ([`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d), [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0)), and headless sessions with up to seven people ([`24b4056`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24b4056)).

The trade-off: unattended runs were fast but drifted. The rethink was built on "don't ask any questions or pause for anything". Being on a branch, it cost nothing to discard. Claude made most implementation calls: server-sent events, pitch detection, the checks in `spec/`. Mine were direction and what stayed.

## Where attention went

- **Hearing (13 Oct).** "do more testing on real audio". Real recordings found lost takes, vanishing whispers and sentences invented from silence ([`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030)).
- **Expression in the text (13 Oct).** My idea: drawn-out words repeat their letters, "sooo" ([`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888)).
- **Legibility (13–20 Oct).** I cut the log because it made Said a chat room. Then use showed latecomers had nothing to catch up on. So I asked to "reintroduce a brief record … for legibility" ([`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd)), later modelled on texting ([`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75)).
- **Liveness (20 Oct).** "get rid of the loading zone" ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)). First words then reached others in 1.8 s, not 3.4 s ([`42c293b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/42c293b)).
- **The face (14–21 Oct).** My pod tested Said at crit 9. Their feedback led to face mirroring, fuller avatars, a 3D room and choosing your voice. I took all four: "avatars mimicking your facial expressions" ([`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)), then "lets do 3d heads" ([`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)).
- **Presence (21 Oct–8 Nov).** "what feels like a real room" ([`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)), then walking, which I had rebuilt: "reimagine the whole thing" ([`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)).
- **Purpose (8 Nov).** "feels a bit goofy and purposeless". The answer was a party you can read: you follow the conversation you walk up to ([`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)).

I aimed at hearing, expression and presence on purpose. Legibility, liveness, noise and purpose came out of use: "thankyou appears alot", "its picking up noise".

## Trying options and throwing them away

- **The queue.** I proposed it so speakers could fix words before sending ([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566)). It went through four forms. Then I removed it, and editing became live on sent words ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **The pitch line.** I trialled it ([`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)) and cut it ([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)). The words already showed pitch. A second line competed with them.
- **"Faster/slower".** On 178 acted takes, pace measures disagreed, so it's never shown ([`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073)). A label that's sometimes wrong is worse than none.
- **The rethink.** A captions-only version was built ([`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)). I said "no i still want the avatars". The captions were readable, but nobody was there. A head that turns, looks at the speaker and moves its mouth makes words someone's.

## Refining a method: crude first, then better

The avatars show this best. First, an emoji by your name ([`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1)). It was too coarse, and it named the emotion. A flat face driven by seven numbers copied the expression instead ([`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)). Then a 3D head ([`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)). Tuning cut a head turn's lag from 440 ms to 290 ms ([`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)). On 8 Nov I called the sphere heads "clunky". We compared Rocketbox, Face Cap, Ready Player Me and VRoid. I kept the cartoon heads: "more fun and with all the customiseability".

The noise gate went the same way, from a syllable-rhythm gate to Silero, a voice detection model ([`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a) → [`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)). So did voices, from the browser's own to Kokoro ([`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255) → [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)). I changed method when the complaint was about what a thing was, not how well it worked. Here the goal stayed fixed. In the rethink, the goal itself was in question.

## Corrections that landed in the harness

- Whisper invented "Thank you." from near-silence. Now checked in `spec/prosody.test.ts` ([`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631)).
- Walking typed "wwww" over a word. CLAUDE.md now says never type over a word ([`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)).
- Crowd captions flickered up to 240 times in 120 frames. The CLAUDE.md rule names the probe that caught it ([`118e3c1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/118e3c1)).
- Word gestures fired on one word in five. Now it's one in twenty ([`3148db2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3148db2)).

CLAUDE.md came late, inferred from my directions on 7 Nov ([`df22520`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/df22520)). Until then the rules lived in my messages, and a run could miss them. Next time I'd start it in week one. `spec/` now holds over 220 checks.

## Stack and why

- **Whisper in the browser.** No audio leaves the device. No key, no cost per use. The price is an 80 MB download. Base beat tiny, which placed words up to a second late ([`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf)).
- **Server-sent events.** Words flow one way, server to page. Pages send with a plain POST. SSE reconnects by itself, and Last-Event-ID catches a page up.
- **Node, TypeScript and SQLite, with few dependencies.** I could read all of it. It runs on one small Fly machine.
- **On-device models** (MediaPipe, and Kokoro as an opt-in), for the same privacy reason. Face reading took 143 ms on the GPU and 12 ms on the CPU, so it runs on the CPU ([`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)).

## My position on what I read

De Lacerda Pataca et al. (CHI 2023) found deaf and hard-of-hearing viewers wanted emotion labelled. I made it inferable instead ([`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)). I read their finding as a need for access to emotion. A label is one way to give it, but it flattens. It says "sad" where the voice and face show how sad. The tension is emotes. They're labels, and a big laugh or gasp read from the camera sends one by itself ([`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)). I think it still fits. [YOU: one sentence on why.]

## Close

What I'd keep is the willingness to throw away working things that don't serve the vision: AIR, the queue, the pitch line, a whole rethink. Claude wrote most of the code. The record shows what I added: the pivot, the specs, what I kept, and the tests I asked for.
