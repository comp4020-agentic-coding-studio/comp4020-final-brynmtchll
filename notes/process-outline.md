# PROCESS.md outline (for Brynly to write from)

Not a draft: headings, word budgets, what each section has to answer, and the
evidence to cite. Facts and commits come from `notes/decisions-log.md` and
`notes/process-narrative.md`. "Yours" marks sentences you've already written
(current PROCESS.md, `reflections/`) that could be reused.

Target: 900–1100 words. The brief asks PROCESS.md to cover:
- how you got from the brief to the harness and workflow
- why this stack and workflow, and the trade-offs you weighed
- corrections that landed in CLAUDE.md or spec/
- your position on what you read

---

## 1. Where it started, and the arc (~120 words)

- One line on AIR (a market in shares of nothing, with a bubble that pops):
  [`16bf213`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/16bf213).
- The pivot on 13 Oct, the day before crit 9:
  [`9f2f44b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9f2f44b).
  Claude raised the "chat room with the nouns swapped" risk and you went ahead anyway.
- **You answer:** what AIR couldn't do that inflection could.
- Your framing, from 8 Nov: the site grew by turning attention to one facet
  of HCI after another, and by trying options, some of them thrown away. This
  is the spine for sections 3 and 4. Say it in one or two sentences here.

## 2. How I worked with the agent (~150 words)

- The workflow: a direction in one message, built in a long unattended run,
  then judged by using it.
  - The redesign spec, in one message:
    [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c).
  - The big tickets on 22 Oct, then "ok get to work":
    [`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db).
  - "don't ask any questions or pause". Runs like this were spent against a
    budget.
- The checks you asked for:
  - testing on real audio:
    [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030),
    [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073)
  - independent reviews:
    [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d),
    [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0)
  - headless sessions of 2 to 7 people:
    [`24b4056`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24b4056)
- **The trade-off to name:** unattended runs were fast but went their own way.
  The rethink was built without a pause, then thrown away. What did you change
  in how you directed because of that?
- Yours (crit-10 reflection): "I want to be the person who understands the
  system well enough to judge the output…"

## 3. Where attention went (~250 words). The main narrative

Pick 4 or 5 of these. For each, give the direction (your quote), what use
showed, what changed, and a commit.

| Facet | When | Your words | Commits |
|---|---|---|---|
| Hearing accuracy | 13 Oct | "do more testing on real audio" | [`5681030`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5681030) [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073) |
| Expression in the text | 13 Oct | repeated letters, "sooo" (your idea) | [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888) |
| Legibility | 14–20 Oct | "reintroduce a brief record … for legibility"; "model texting" | [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd) [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75) |
| Liveness | 20 Oct | "get rid of the loading zone … live without a buffer" | [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513) [`42c293b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/42c293b) |
| Expression in the face | 20–21 Oct | "avatars mimicking your facial expressions"; "lets do 3d heads" | [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c) [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe) |
| Presence | 22 Oct–7 Nov | "what feels like a real room"; "move around" | [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650) [`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6) [`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708) |
| Purpose | 8 Nov | "feels a bit goofy and purposeless" → a party you can read | [`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277) |

**You answer:**
- Which facets did you aim at on purpose, and which surfaced from use?
- What turned "no log" on 13 Oct into a record again on 14 Oct?

## 4. Trying options and throwing them away (~150 words)

Two or three worked examples, each as tried → showed → decided:

- **The queue.** It went flat 1 s → real time → a column → a bar, then was
  removed. Path:
  [`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566)
  →
  [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513).
  The current PROCESS.md "Queue" section can shrink into this.
- **The pitch line.** Trialled in
  [`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e)
  and cut in
  [`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)
  ("i dont like that"). **You answer:** why.
- **The rethink.** Captions only, tag `rethink-trial`
  ([`aa5eebf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/aa5eebf)),
  then "no i still want the avatars", then the purpose
  ([`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)).
  **You answer:** what seeing the app without avatars showed you they're for.
  This is your strongest "trial as insight" example.
- Yours (current PROCESS.md): "A label that is sometimes wrong is worse than
  no label." This fits under "faster/slower",
  [`d9ba073`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d9ba073).

## 4b. Refining a method: start crude, then find a better way (~150 words)

Your 8 Nov note: try something crude first, then look at other ways of doing
it to make it better. The avatars show this most clearly. Each step kept what
the last one taught.

Each step below says what it was, then what it taught you.

1. **An emoji by your name (14 Oct).** The face was read on your device and
   turned into one of 6 emoji, sent only when it changed:
   [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1).
   - Taught: a label is too coarse, and it names the emotion, which goes
     against "inferrable".
2. **A flat SVG face pulling your expressions (20 Oct).** It was driven by 7
   numbers from MediaPipe ("i want there to be emojis/avatars mimicking your
   facial expressions"):
   [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c).
   - Taught: copying the face works better than naming the feeling.
3. **A 3D head built in code from spheres (20 Oct, "lets do 3d heads").** It
   turns as you turn and looks at the speaker:
   [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe).
   - A ready-made head (Face Cap) was rejected because its licence was
     unclear.
4. **Refining the same method.**
   - Responsiveness ("i need the head to be more respsonive"): the face is
     read every frame and smoothed with a One Euro filter, so a turn reaches
     another screen 440 → 290 ms behind the camera
     ([`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)).
   - Back on the CPU after measuring the GPU at 143 ms vs 12 ms a read
     ([`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)).
   - Parts as data in `packs.ts`
     ([`c04f4e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c04f4e4)).
   - A body, arms and hands
     ([`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090)).
   - The mouth moves with the voice
     ([`58f7ec1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/58f7ec1)).
   - Lighting, with the shadow size chosen by frame rate
     ([`84d0d7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/84d0d7f)).
5. **Questioning the method itself (8 Nov).** "scrap the stretched spheres …
   that's clunky i want to use something that's been made for this purpose",
   then "cartoony but still as expressive".
   - Options compared: Rocketbox, Face Cap, Ready Player Me (shut down),
     VRoid perfect-sync VRM ("really anime esque i dont want that"), and
     MakeHuman, rendered plain and cartoonier.
   - Chosen: keep the cartoon heads ("i thiink theyre more fun and with all
     the customiseability"), with more sophisticated expression and
     responsiveness. A trial of options that changed the target, not the
     method. Logged in decisions-log item 13.

The same pattern, crude first and then a better method, shows up elsewhere.
Each of these could be a one-line example:
- **Noise gate:** a syllable-rhythm gate → a voice-vs-room level → Silero VAD
  ([`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a) →
  [`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)).
- **Voices:** the browser's own voices, then Kokoro
  ([`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255) →
  [`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)).
- **Drawn-out words:** letter-spacing → repeated letters → a threshold tuned
  on real speech
  ([`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf) →
  [`a26d888`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a26d888) →
  [`c357e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c357e2a)).

**You answer:**
- What made each crude version good enough to start with?
- What told you it was time to change method rather than keep refining?
  E.g. "clunky" on 8 Nov, after weeks of refining spheres.
- How is this different from section 4, where you threw options away?
  Here the goal stayed fixed and the method changed. There, the goal itself
  was in question.

## 5. Corrections in the harness (~120 words)

The brief rewards fixes that land in CLAUDE.md or spec/, not just retries.
Candidates:

- "Thank you." invented from silence. Fixed and checked in
  `spec/real-voice.test.ts`:
  [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631).
- Walking typed "wwww" over a word. Became a CLAUDE.md rule ("never type over
  a word"):
  [`bd869e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/bd869e4).
- A name that could run a script in flat avatars. Fixed and tested:
  [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0).
- The games were taken out under the rule "no gamifying":
  [`561c29f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/561c29f).
- Be honest that CLAUDE.md came late. It was inferred from your directions on
  7 Nov
  ([`df22520`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/df22520)).
  **You answer:** what that cost, or what you'd do differently.
- Captions in a crowd flickered 100 to 240 times in 120 frames: a cut-down
  caption was measured at its cut size, came back whole, and was cut
  again. Fixed, and a CLAUDE.md rule names the probe that counted it
  ([`118e3c1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/118e3c1)).
- Word gestures first fired on one word in five of ordinary talk, measured
  on a paragraph; now one in twenty, and the rule says so
  ([`3148db2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3148db2)).
- The size of spec/ now: 231 checks in 21 files (9 Nov).

## 6. Stack and why (~150 words; link the ADRs instead of restating them)

- **Whisper in the browser.**
  - For it: no audio leaves the device, no key, no per-use cost.
  - Against it: an 80 MB download. Base was chosen over tiny because tiny
    placed words up to 1 s late
    ([`46d4caf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/46d4caf)).
- **Server-sent events.** Updates flow one way; Last-Event-ID catches up after
  a drop. **You answer:** why not WebSockets.
- **Node + TypeScript with almost no dependencies, and SQLite on the Fly
  volume.** **You answer:** why so little framework.
- **On-device models everywhere:** MediaPipe, Kokoro (opt-in). This follows
  the same privacy line as Whisper.
- **The GPU vs CPU measurement:** 143 ms vs 12 ms per read
  ([`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)).
  A good example of a trade-off settled by measuring.

## 7. My position on what I read (~80 words)

- CHI 2023: DHH viewers wanted emotion labelled. You chose to make it
  "inferrable" instead. **You answer:** why.
- The tension to address:
  - Emotes are labels you choose yourself.
  - A laugh sends an emote by itself
    ([`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)).
  - Does that still fit "inferrable"?
- The brief asks for small-web reading. None is cited yet. Whatever you add
  to the README goes here too.

## 8. Close (~50 words)

Yours (crit-9 reflection): "the willingness to throw away working things that
don't serve the vision." This ties sections 4 and 2 together.

---

## Before you hand it in

- Delete the old "The queue" section. It describes something that no longer
  exists.
- Reword "no log … stopped being a chat room". A record came back the next
  day, and on 20 Oct you modelled it on texting.
- The current draft's claims should match the "What Claude did" list in the
  decisions log. In particular, Claude made the implementation calls (SSE,
  pitch detection, the checks in spec/).
- crit-10.md still says "84 to 92 checks" (the record shows 85 → 113). It
  also says dropping the 0.25 s pause cut was your call; the record shows
  Claude measured it and dropped it.
- Run `pnpm check:evidence` after writing. It confirms every commit you link
  exists.
