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

## Since crit 9 (14 to 21 October): your directions, in your words

Each is a message you sent, quoted (spelling as typed), and the commit it
led to. Claude chose how to build each; what to build was yours.

1. **Bring back a record, and try emotion from the face.** "reintroduce a
   brief record of whats been said for legibility, look into emotion
   capturing (emojis) via facial recognition". [`5d099dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d099dd), [`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1)
2. **The facelift, modelled on texting.** "the design is ugly i dont like
   the background colour, also lets try to model texting a little bit, i
   want you're own texts to sit on the left and everyone elses to be
   stacked on the right ... text appears when nothing is spoken (thankyou
   appears alot) ... the whole design needs a feacelift". [`b34ab75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b34ab75),
   [`dd82631`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/dd82631)
3. **Avatars instead of emoji, customisable.** "i dont want it to just show
   face i want there to be emojis/avatars mimicking your facial
   expressions, and for them to be customiseable". You also reported "it
   started bugging out", which found the Whisper loop. [`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c),
   [`32e17b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/32e17b4)
4. **Live, not buffered; a scrollable thread like texts.** "get rid of the
   loading zone and have the text be transmitted directly, with options to
   modify text be done live without a buffer", the thread "scrolleable and
   to appear like texts with appendage to the right hand side and line
   breaks indicating gaps in speech", and an assessment of "more detailed
   / animated / even 3d options". [`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)
5. **Top down, fixed boxes, less delay, then 3D.** "i want the text bubble
   column to go top down, and for the bottom of the scroll view to fade
   out ... i don't want the user box height to be dynamic ... is there a
   way to have less delay ... we need to think big ... lets do 3d heads".
   [`13a4e40`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/13a4e40), [`42c293b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/42c293b), [`90dd4fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/90dd4fe)
6. **More responsive.** "i need the head to be more respsonive work and
   iterate on everything". Measured first: a head turn took 0.38 s to get
   halfway to another screen, 0.22 s after. [`70b2085`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/70b2085)
7. **Your live test found two real problems.** "its picking up noise and
   not able to find my face". The logs from your session showed Whisper
   inventing "Thanks for watching!" and "I'm going to go. I'm going to go."
   from your room; the face reader turned out to be 12 times slower on the
   graphics card on your machine. [`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)
8. **Expressiveness and extensibility.** "i want to go really deep on the
   extensibility and customiseability too and really maximise
   expressiveness". You chose all four directions offered (avatar builder,
   word styling, emotes and reactions, extensible packs) and to build on
   main overnight. [`c04f4e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c04f4e4), [`6590dbd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6590dbd), [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)

### Who can see and change what (facts for the crit-10 decision record)

- A person is a name and a random id in an HttpOnly cookie ([`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)
  logs them as `name#tag`, never the id). The id is never shown to anyone.
- Anyone with the URL can watch. Anything else (speaking, editing, face,
  voice, avatar, emotes, reactions) needs a cookie of someone who joined;
  otherwise 401.
- Identity comes only from the cookie: a name in the request is ignored
  ([`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8), checked in `spec/room.test.ts`).
- Your own words, face, voice, avatar and emotes are yours alone. Editing
  someone else's words is refused (403) and logged `refused why="not-theirs"`.
- New on 20 October: anyone who's joined may react to anyone's word. The
  reaction is the reactor's (one each per word), and the word itself is
  unchanged. [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)
- Everything sent is checked against what's on offer (`src/packs.ts`) on
  the server, and each kind is rate-limited separately.

### Open questions for your reflection and README

- The face emoji ([`200bce1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/200bce1)) went in, then became avatars that copy the
  face without naming an emotion: does that answer your 13 October position
  that emotion should be "inferrable", not labelled? The emotes now let
  people label it themselves, on purpose.
- Reactions let anyone put something on your words. You said what's yours
  is yours; is a reaction "on" your word, or beside it?
- What would you cut if a user found it too much? The brief rewards
  defending choices, including what you said no to.

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
