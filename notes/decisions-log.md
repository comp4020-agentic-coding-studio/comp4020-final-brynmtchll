# Decision log: raw material for PROCESS.md and reflections/crit-9.md

Not a draft. The brief says PROCESS.md and the reflections are yours to write;
this is the record to write them from: what you decided, when, and the
commit it landed in. Each line says who made the call, so your account can
be accurate about the split. Commit links are in the form `check:evidence`
reads.

Repo: https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll

## Your decisions (Brynly), in order

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

## Since crit 10 (from 22 October): your directions, in your words

1. **The big tickets for the last weeks.** "i want big visions on
   interactivity and customiseability for avatars, im talking hugely
   customiseable with a whole preview option (currently you have to scroll
   back up to the top to see your avatar) i think customising should be its
   whole own screen, look into whole body avatars, with hand gesture
   recognition, following that lets look at making the space more like a
   real space, even 3d with what feels like a real room with avatars in it,
   also i want to look at text to speech so that theres speech accompanying
   'subtitles' with customiseable voice as well". Then: "ok get to work".
   - Customising on its own screen: [`d6827db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d6827db)
     (`/studio`: the head large and always in view, turn and zoom, sixteen
     sliders, up to two more things to wear, undo).
   - Whole-body avatars with hand gestures: [`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090)
     (shoulders, arms and hands on every head, a choice of tops; "Hands too"
     reads arms and hands off the camera in a background worker, and a
     thumbs up, thumbs down, open palm, peace sign or "I love you" sets off
     the matching emote), and [`d4bff2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d4bff2a) (a hand held up, or
     Shift+R, joins a queue to speak, the same on every page, until you've
     spoken).
   - A real room: [`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650) (a "Room" view: everyone at a
     table in one 3D room, with a window, shelves, a lamp and plants, names
     and words over heads, the camera leaning towards whoever's talking),
     [`60cdd2f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/60cdd2f) (the room takes the wide side of the screen when
     you're in it) and [`859b13f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/859b13f) (emotes and reactions work in
     the room too).
   - Speech with the subtitles: [`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255) ("Hear voices":
     each phrase spoken by the browser in the voice its speaker picked in
     the studio, with pitch and speed sliders; a loud, high or drawn-out word
     gets its own run, louder, higher or slower; quiet while you talk, and a
     phrase your microphone hears that's mostly what was just spoken is
     dropped as an echo). Kokoro, the better voice the spike measured, is not built yet:
     it takes a voice and a speed only, so a high word couldn't be spoken
     higher without bending its sound afterwards.

2. **Glitches.** "things are a bit glitchy i want you to work and refine
   them", then "ok lets get to it" (2 and 3 November). Found by running
   two- to seven-person sessions in headless Chrome at desktop and phone
   size and looking at the screenshots and timings; each fix was checked
   the same way.
   - Words: a phrase jumped about as its draft settled ([`5c28ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5c28ef9)); a
     draft's guesses showed big before they were really said ([`5cff87b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5cff87b));
     a long word broke across lines over the thread, and a long name ran off
     the card ([`642c7be`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/642c7be)).
   - Cards: one or two others got small cards in a big empty space
     ([`94e7640`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/94e7640)); an emote's arm grew the head and pushed the whole
     thread down and back ([`d742832`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d742832)); labels sat in the wrong place and
     a head blinked out on a change of look ([`24b4056`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24b4056)).
   - The room: a small group sat behind each other, hidden by the table
     ([`caa187a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/caa187a)); two on a phone sat one in front of the other
     ([`d2d4cc1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d2d4cc1)); someone who'd closed their tab sat there for up to an
     hour as if listening, now shown as away, dozing, until they're back
     ([`174f4cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/174f4cc)).
   - Hand up: the button lagged and a quick double press could undo itself
     ([`77035aa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/77035aa)).
   - Speech model: a download that failed said nothing, and its progress
     read "3 of 3 MB" until the big file started ([`b3c649b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c649b), [`8241d70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8241d70)).
   - Keyboard: choosing one of your own words needed a pointer; ← and →
     now do it ([`043f36c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/043f36c)).
   - Away: an away name stayed up in a crowded room where other quiet ones
     were hidden ([`b5a03aa`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b5a03aa)); someone in the studio showed as away
     ([`123a049`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/123a049)).
   - Reconnecting: a page whose stream dropped (a phone asleep) came back
     with what was said meanwhile but not hands raised, people who joined,
     edits, reactions, phrases taken away or new looks; dropping a second
     time sent the same phrases again; a page lost what was said while it
     loaded; and a redraw showed a word's reactions twice ([`4bcaad3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4bcaad3)).
   - Names in a crowded room were lifted clear of someone's word, so on a
     phone they ended up over the row behind ([`305396c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/305396c)).
   - The server: what was said while it restarted (every deploy) was lost
     ([`eeb636c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eeb636c)); waking for the first visitor after a quiet spell takes
     about 3 s; asking Fly to suspend rather than stop didn't change it (it
     can't suspend a machine with a volume), and starting the server lazily
     saved about a tenth of a second locally ([`75dd8a7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/75dd8a7), [`b3c2ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b3c2ef9)); the studio's choices
     on a phone started below the fold ([`d0a55de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/d0a55de)).

3. **Typing instead.** "can we do text to speech option as well with
   customiseability there" (3 November). Speech for what others say was
   already there ("Hear voices"), so this was built as the other way round:
   a box to type in, sent as a message that goes up and is spoken like a
   said one ([`850616c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/850616c)). How it's said comes from the writing (stars or
   caps, !, drawn-out letters, brackets, ?) and a tone picked beside the box
   (plain, excited, calm, asking, sad, whisper, sarcastic); the voice, its
   pitch and speed are in the box too, the same ones the studio keeps.
   Typed messages are marked ⌨ and aren't counted in someone's usual voice.

4. **Better voices, more of them.** "ok i want voice quality to be improved
   and more selectable for different voices", then "work hard and long on
   improving this" (3 November). The voices were each device's own, robotic
   on many and different on every one.
   - Natural voices, opt-in beside "Hear voices": Kokoro (82M parameters,
     Apache-2.0) run in the browser, the same on every device; only words go
     in, nothing is sent ([`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f)). Measured first in headless Chrome on
     an M4 Pro: the full-size build on the GPU (326 MB) makes a phrase in
     about a quarter of a second, heard about 0.3 s after it's said in the
     room (median of 16); the 8-bit CPU build (92 MB) 2.5 to 3.5 s a phrase;
     the half-size GPU builds came out silent. Whisper heard all 28 English
     voices back word for word. The GPU build where it can run, the small
     one otherwise and on phones ([`ba73bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ba73bff)).
   - Said whole, then shaped: in pieces, Whisper heard "oh this is so good"
     as "so, gone good". A word that stood out is made louder, a little
     higher, or drawn out at its own pitch where it is in the sound
     ([`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f), [`e281037`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e281037)); a phrase whose last word rose is given
     a "?" for the model to read ([`78963db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/78963db)).
   - Choice: 27 voices, each described from measuring it and listed highest
     first ([`1c8497f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1c8497f), [`a76ed3a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a76ed3a)); any two mixed, up to half and half
     ([`82bb3ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/82bb3ad)). Heads' mouths move with the natural voice as it plays,
     and the device's voices prefer their better-sounding versions
     ([`58f7ec1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/58f7ec1)).
   - A review of it (a subagent, read-only) found a colour picked in the
     studio no longer kept, phrases for a voice made even once let go, and
     no limit on falling behind; fixed, with phrases now made one at a time
     ([`10504a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/10504a4)).

5. **Background noise.** "fix what you mentioned about picking up
   background noise" (4 November). On the evening of 3 November real
   sessions filled the room with phrases nobody said ("Thank you.", "I'm
   sorry.", "Bye."): Whisper writes a sentence for whatever it hears, and
   the loudness gate in front of it passed anything with a voice-like
   wobble (all of a Chopin waltz in three-second pieces, twelve of twenty of
   a song, seven of twenty of a street recording). Each phrase now goes
   through Silero VAD (v5, 2.2 MB, MIT) first, and one with under 0.2 s of
   speech in it is never sent to Whisper
   ([`f50b82b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f50b82b)). On the same recordings: no
   speech found in piano, street, crowd, rain, fan or typing; at least half a
   second in every phrase of real speech. Played into the page as its
   microphone for 30 s each, street noise had sent "The End"; afterwards
   nothing from any of them, and JFK's speech word for word. Not covered: a
   room of other people talking is still speech to it.

6. **The room, more polished, and a say in how it's seen.** "completely
   level up the quality of the graphics and the smoothness, ( want control
   over the view of the room as well)" (4 November).
   - What's in the room is painted in code onto canvases (floorboards with
     grain, a woven rug, the view out of the window, two pictures, plaster),
     with new furniture (rounded armchairs, an armchair and lamp in the
     corner, curtains, a door in a fourth wall, a teapot), and steps under
     raised rows. What doesn't move is merged, one mesh per material.
   - Light: light from all round (three.js's RoomEnvironment), the sun low
     through the window, and a soft shadow under each chair. Three tone
     curves compared on the same room: AgX greyed the colours, ACES pushed
     them orange, Khronos Neutral kept them as chosen, so Neutral.
   - After drawing, a glow only on what's brightest (the sky, the lamp) and
     darker corners. Shading where things meet (GTAO) was tried at three
     strengths and dropped: it left a grainy halo along every edge against
     the window. A screen slower than about 40 frames a second loses the
     glow, then pixels; phones start without it. (GTAO came back on 5
     November with other settings: see the end of this item.)
   - Views: Everyone (as before: everyone, leaning to whoever's talking),
     Speaker (close on whoever's talking, typed or said), Wide (from a front
     corner), Above. Drag, scroll or pinch, or the keyboard, to turn and
     zoom; Reset, or a double click, puts it back. The camera stays inside
     the room and in front of the rows (`spec/camera.test.ts`).
   - Smoothness: heads in the room were drawn 30 times a second; now 60.
     Measured in headless Chrome on the M4 Pro: 60 frames a second with 12
     people at 1440x900; 51 with 8 at phone size with the processor slowed
     four times (44 before the sun's shadows were redrawn every other frame
     rather than every frame).
   - The camera, let go mid-drag, glides to a stop rather than stopping
     dead; dragged past the edge of where it can go, it turns back as soon
     as it's dragged the other way ([`a86ead9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a86ead9)).
   - More in the room: soft shafts of sun through the window with dust
     drifting in them ([`efaf24c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/efaf24c)), fairy lights in swags across the
     top of the window, each bulb twinkling in its own time
     ([`c18b751`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c18b751)), a soft light that comes up on whoever's talking and
     goes down after ([`50a9cfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/50a9cfb)), and a small soft shadow under each
     thing on the table ([`7f02c7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7f02c7d)). Each drawn as one or two draws.
     With 12 people at phone size and the processor slowed four times:
     46 to 52 frames a second before and after each (measured at
     [`a86ead9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a86ead9) and after [`50a9cfb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/50a9cfb); varies run to run).
   - Switching to the room: the box shows a slow-moving dusk until the
     first frame is drawn, then fades it up; names over heads show only
     once placed (they had all shown at the top for a moment)
     ([`c4bc696`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c4bc696)). On a light page, the words over heads keep the dark
     page's colours, as the room is dark either way ([`0c6b622`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0c6b622)).
   - The camera moves on springs (critically damped): it gathers speed and
     settles, about 1.2 s for a change of view, with no overshoot; before,
     it set off at full speed. The shot and the turn are sprung separately
     and combined after, as a first try springing the camera's position
     directly cut across the arc of a drag and through a wall
     ([`e954e9b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e954e9b)).
   - Shading where things meet (GTAO), at half size, with a smaller
     radius than the dropped try, solid things only (the shafts of light
     and soft shadows left out), blended at 0.75. Four settings compared
     side by side; larger radii darkened faces round the eyes. It is the
     first thing a slow screen drops, back only 30 s after; phones never
     have it. 12 people, phone size, processor slowed four times: 37 to 40
     frames a second with it, 48 to 50 once dropped ([`e2757f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e2757f5)).
   - In the speaker view, the room nearer and further than the speaker is
     a little soft (depth of field, from the depth GTAO already draws):
     half as soft nearer than further. 16.6 ms a frame with and without at
     1920x1080, 2x ([`fdab177`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fdab177)).
   - Someone new rises a little into their seat; everyone moved along, as
     rows fill or close up, glides to their new place (they had jumped)
     ([`3b4f7db`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3b4f7db)).
   - On a phone, in the room: the room is first, your controls under it, and
     your own card isn't shown (the room had been below a screen of
     controls); the room box is a little shorter (112% of the width, was
     125%) ([`9745fa7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9745fa7)).

7. **The rest of the page, more polished.** Same request (4 to 5 November).
   - Type: Inter for reading, Bricolage Grotesque for headings and the
     name (variable fonts, from jsdelivr); the join card's headline drawn
     the way the app draws speech; cards tinted with each person's colour,
     breathing while they speak; away cards short and after everyone here
     ([`c211045`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/c211045)).
   - Heads in cards lit as the room is: light from all round, a warm key
     light casting a soft shadow, a cool rim light, Neutral tone mapping
     ([`84d0d7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/84d0d7f)). With 11 others all talking and the processor slowed
     four times, cards drew at 59.7 frames a second before, 55.1 with a
     1024 shadow map, 60.2 with 512 (kept).
   - Studio: saved looks, tabs as a grid, sliders, a glow behind the head
     ([`8cf510d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8cf510d)); the avatar fades out at the bottom of its frame
     rather than being cut off ([`b0bf480`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b0bf480)). Help, About and Lately
     restyled ([`409d5fe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/409d5fe)).
   - Your controls in panels (typing and tone, emotes, changing a word); on
     a phone, the microphone across the width, tones as a row that slides,
     emotes and word effects as even grids ([`713d712`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/713d712),
     [`eebcf44`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/eebcf44)). Cards two to a row are shorter, and your own card is
     short until there's something to show under it ([`24d5a36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/24d5a36)).
   - Found on the way: a seat's colour could come to 360 (past the end of
     the colour wheel) from the 602nd seat on; fixed, with a check
     ([`91e966e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/91e966e)).
   - Found 5 November: the tones row (from [`713d712`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/713d712)) made the page
     682 px wide at 390, because a fieldset is as wide as everything in it
     and its hidden radios were placed against the page. Live from 05:25
     to 11:01 that day (deploys); fixed in [`1ce0366`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/1ce0366). The phone probes had
     all compared the page with `innerWidth`, which a phone-sized Chrome
     widens along with the page, so none of them could catch it; a check
     against the width asked for (390) shows 682 before the fix and 390
     after, on every page in both themes.
   - The room with one to three people: the camera stood 12 away, so one
     person was in close-up behind the flowers, their word on their hair,
     and Wide hardly wider; now at least 16. A word goes over the top of
     the head's own hair (it was a fixed 1.3, under a big afro's top).
     Away people with nothing to say aren't named over their heads
     ([`505540e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/505540e)). The typing hint fits a phone ([`affe7b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/affe7b5)).
   - Speaker view on someone in a back row: from 2.4 above their head, the
     head in front hid their mouth; from a back row it's 4.2. Names whose
     head is out of the picture aren't shown ([`4c07961`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/4c07961)).

8. **Walking about the room, and full screen.** Brynly, 7 November: "can we
   make it so that you can control your avatar and move around, also i want
   a full screen option for that" (after Claude offered three other ideas:
   a guessing game, room captions, cutting back).
   - W A S D, a tap or click on the floor, or a stick on a touch screen; you
     get up beside your chair onto a pair of legs, everyone sees you walk,
     and "Me" follows you; Sit takes you back. Kept to the floor and out of
     the table, the furniture and the chairs; the server takes only a place
     on the floor and keeps it only while you're up. Full screen is the
     browser's own, or (an iPhone has none for a page) the room filling the
     window. 186 checks. 12 people at phone size, processor slowed four
     times: 45.0 and 47.6 frames a second with it, 42.6 without
     ([`0023cd6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0023cd6)).
   - Tried and changed before it went in: a "Me" camera that swung round
     behind whichever way you faced turned you round as you walked back
     towards it, and looked out of the room's open front; it now looks into
     the room and turns only when dragged. Getting up straight forward put
     you between your chair and the table; you now step out to the side.
   - Brynly, 7 November, after trying it: "ok theres a lot more work that
     needs to be done on that", then "reimagine the whole thing". Rebuilt
     ([`990b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/990b708)):
     getting up and sitting walk out and back between the chairs (the front
     row towards the table, a raised row along its step, which now runs on
     past the row's ends, and down at the end); a tap on the floor finds a
     way round the table and the chairs; W A S D slide along what they
     meet; tapping near your own chair sits you down; others walk the same
     ways round; arms swing; full screen has its own microphone, typing box
     and five emotes. Rows 6 apart (were 5) and the table nearer the front
     row, so the raised rows have a step to walk along. 190 checks;
     `walk.test.ts` takes everyone out of every seat and back for 1 to 12
     people. 12 people at phone size, processor slowed four times, 11 of
     them walking round the table: 47.2 and 45.4 frames a second (the
     commit before, same run: 47.6 and 43.0).
   - Found while rebuilding: in `0023cd6`, D and right on the stick walked
     you left, and A right. Fixed in `990b708`, with a check.

9. **Rooms, how a room looks, and one place for the controls.** Brynly,
   8 November: "things are still bugging and i want customisability /
   options for selection for the room, along with options to have different
   rooms / spaces, featuring different groups etc and i want the ui to feel
   more cohesive and intuitive"
   ([`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9)).
   - Rooms: the main room stays at `/`; anyone who's joined can make
     another (up to 12 each) at `/r/<name>/`, listed on a Rooms page or
     kept to whoever has the link. What's said, hands, walking and emotes
     stay in their room, live and stored; who you are and how you look go
     with you. Someone who goes into another room leaves the first one's
     cards rather than showing as away there.
   - How a room looks: outside (golden hour, midday, night, snow, seaside),
     walls, floor and rug, or six themes that set them all (lounge, garden
     room, late night, cabin, beach house, studio). Only whoever made a room
     can change it, only to these, and every page in it repaints at once.
     The light, the sky, the rug and the curtains follow it.
   - The room page: your card, then a panel for saying something
     (microphone, hand, typing), then tabs (emotes, your words, you), in one
     column beside the room; on a phone, under the 3D room and above the
     cards. A room switcher in the header. On a phone, cards of people who
     haven't said anything lately are shorter.
   - Bugs fixed in the same commit, each with a check: a tap behind a full
     back row (in rooms of 5, 7 to 12) had the way-finding call itself until
     the page ran out of stack, on every frame, so the room's picture froze
     until a key was pressed (found by a bug-hunting subagent, and
     separately by a check over taps everywhere); a reload, or a tab closed
     and opened again, while standing left you standing on everyone else's
     page for up to a minute while your own had you sitting. 197 checks.
   - The new way-finding check took 7.7 s on CI's runner (0.8 s here), past
     its 5 s limit, so CI was red for three pushes and the site stayed on
     the walking rebuild until it was trimmed
     ([`6c79269`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6c79269)).
   - W A S D did nothing after a view was picked from the room's bar, until
     the room was clicked again
     ([`18896f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/18896f9)).
   - Found by a bug-hunting subagent that used the room in a browser for
     two hours, and fixed ([`b74e452`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b74e452)): walking typed over your last word
     ("see you wwwwwww"), and Enter or Space sent it to everyone; someone
     who closed their tab while up stood there for good (two timers raced);
     after Reset, or a view clicked, the keys went nowhere or the arrows
     picked views; in phone full screen one finger didn't look round; the
     Me camera looked at the floor below a raised row and cut your head
     off; tapping your own raised chair walked you behind it; the "here"
     count was a person short on pages already open. Reported but left: in
     a headless browser Esc didn't leave full screen (a real browser's own
     Esc does); walkers pass through seated people's knees; nothing shows
     the tone chips scroll sideways on a phone.
   - Your own card beside the room was often dim: its fade-in was caught
     part way while the room was being built, and stayed there. It was the
     same in `990b708`. Your card no longer fades in
     ([`0478f98`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0478f98)).

10. **A purpose: a party you can read; and Space.** Brynly, 8 November: "it
    sucks, the room customiseability needs a lot more work, more over the
    whole site feels a bit goofy and purposeless we need to completely big
    picture the site and think about how it can be slick, streamlined and
    useful (and not clunky) if this might entail some radical change then
    thats ok".
    - Claude built a captions-only version with no avatars or 3D room
      (`fd005d2`, `aa5eebf`), not merged. Brynly, later that evening: "nup i
      don't like the rethink at all, scrap it". Its branch was deleted; the
      tag `rethink-trial` keeps it as process evidence. The site as it was
      before is tagged `before-rethink` (`d627070`). Brynly:
      "no i still want the avatars", then "i feel like i just need a good
      purpose for the site, what s a good use for being able to walk around
      as an avatar with live captions". Of the purposes Claude offered,
      Brynly picked the first, a party you can read: "ok lets go with the
      first".
    - The party ([`e047277`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e047277)): over each head in the
      room, their last two phrases, each word as clear as you are close. Clear
      to 6 floor units (a chair is about 3 wide), gone by 10; a word said
      louder than the speaker's usual carries further, up to 1.8 times as far,
      and a whisper a third as far. Further off, a murmur (• • •) shows only
      that they're talking; past 30, nothing. While you're in the room, Lately
      dims what was said out of your reach.
    - Space, same commit. Brynly: "and lets also trial, in a seperate window,
      texting your text is your avatar that you move around a space (no need
      for decorations or so forth) its like you are the text and you can
      move that toward or away from others". At `/r/space/`, linked from the
      header and not on the rooms list: each person is their latest words on
      a plain field, moved by dragging, a tap or the keys. The same hearing
      rules apply. The floor is the same size for everyone (25 by 15 units), so
      reading goes both ways. On a phone held upright it's shown turned a
      quarter. Someone new starts clear of everyone there. Where you are is
      two numbers, kept, and sent to every page in Space.
    - Colour and emoji, same commit. Brynly: "im looking for creative ways to
      communicate is really the core idea of this website, so any further
      ideas are also welcome (iimplemented alongside whats already there so
      far) maybe with communication through non text mediums where speech /
      text is mapped directly to emojis or colors or some other more nuanced
      / abstract kind of expression". In Space you choose how to read what's
      said:
      - as words;
      - as colour: a shape per word, warmer for higher and louder, bigger for
        louder, longer for drawn out;
      - as emoji: about 180 words become their emoji, sized by how loud; the
        rest become a dot.
      Space only; the room is unchanged.
    - Found while building: the first Space measured distance from each
      viewer's own screen shape, so on a laptop you could read someone on a
      phone who couldn't read you. On a phone everyone bunched in the
      middle, and newcomers started on top of each other. Fixed before the
      commit, with checks ("lays Space over one floor for everyone…",
      "starts someone new in Space clear of everyone there…"). 206 checks.
    - Gap for the README: "What good means" still describes the room before
      the party and Space; the purpose, and whether Space stays, are yours to
      write.

11. **Typing goes out a word at a time.** Brynly, 8 November: "text should
    send on hitting space bar"
    ([`197afe3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/197afe3)). Each space sends the words so far,
    live for everyone, drawn faded the way a phrase still being spoken is.
    The line is kept on Enter, or once typing stops for 2.5 s with nothing
    half-typed. This applies in the room's box, the full-screen dock and
    Space. Check: `typed.test.ts`, "sends the words so far each time one's
    finished with a space, and the line when it's done".
    - Same commit, for the creative-communication direction (item 10):
      - The room's captions can be read as colour or emoji too, from a picker
        in the room's corner. It's the reader's choice, and it's remembered.
      - In Space, a ring goes out from whoever speaks, as far as their
        loudest word carries.
      - An opt-in Tones button in Space plays what's said as notes made in
        the browser from each word's numbers: higher said, higher note;
        louder and nearer, louder; drawn out, held. No one's voice is played.
    - Found while checking: with Space added to the header, the room switcher
      covered the Rooms link on a phone. On a phone, Rooms now goes when
      there's a switcher, since the switcher lists every room.

12. **A reason to come: games you play by talking.** Brynly, 8 November:
    "nup i don't like the rethink at all, scrap it. i want rather to think of
    ways to give a feeling of purpose to the original site, or something like
    a task to make it engaging and give users a reason to visit it", then "i
    want to establish acomprehnsive list of changes and improvements to
    together unify and give purpose to the site as well as extend it and
    refine it, enough so so that this can be worked on all through the
    night." The list is `notes/overnight-plan.md`.
    - Games at each room's table ([`6189d0f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/6189d0f)), from a
      new Play tab:
      - Say it like…: everyone says a line a given way and picks the take
        that nailed it.
      - Guess how: one person says a line a secret way, and the others guess
        the way from the drawing.
      - The question: everyone answers one question by talking.
      What you say during a round is your take. The round's card is above
      the room, with a sign over the 3D table. Checks: `rounds.test.ts` (5),
      and in `room.test.ts`: "plays a round in a room…" and "tells only
      whoever says it how a Guess how round is to be said, until it's done".
    - Found while checking, same commit: on a phone, a caption over a head
      could run off the room's right edge. It's now measured after its words
      are in and kept within the room.
    - Before more was built, Brynly: "i wanted to brainstorm before you got
      started". Claude offered other purposes: a daily line, practice,
      accessibility, events, keepsakes. Brynly: "no i dont like any of these, i
      dont want to gamify it, actually id rather lean much further into the
      smoothness and the realism … lets go further with the facial
      expressiosn i want these in depth mimmicked … rethink the whole
      graphics model if we have to". The games came out
      ([`561c29f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/561c29f)); the caption fix stayed. The
      overnight plan is kept, marked superseded.

13. **Avatars: toolkits tried, the cartoon heads kept, made far more expressive.**
    Brynly, 8 November, in turn:
    - "i want to scrap the stretched spheres and go with either rocketbox or
      three js";
    - "i mean they can be some other toolkit for modelling avatars just not
      your own custom spheres cause thats clunky i want to use something
      thats been made for this purpose";
    - "they don't have to be so realistic just very expressive";
    - "cartoony but still as expressive / face like might be good".
    - Options looked at:
      - Microsoft Rocketbox: MIT, realistic, and its face shapes were made
        automatically from face bones.
      - The three.js Face Cap head: no licence stated.
      - Ready Player Me: shut down 31 January 2026.
      - VRoid "perfect sync" VRM models, cartoony, with all 52 ARKit face
        shapes hand-made.
    - Brynly, on VRoid: "wait those are really anime esque i dont want
      that". (The model files' own metadata also said
      "Redistribution_Prohibited", against their README.) "are there other
      options": MakeHuman (MPFB, CC0, a full rigged body) and the Face Cap
      head were rendered in a browser in six expressions, then a cartoonier
      MakeHuman ("show me a made cartoonier") and Face Cap with hair and
      colouring ("can B be given features hair etc").
    - Brynly: "ok no lets keep the silly cartoons that you did i thiink
      theyre more fun and with all the customiseability i just want more
      sophisticated expression out of them and more responsiveness i want you
      to work on the site now as much as can be done to refine it and extend
      it in fun ways and make it feel complete". The heads Said already had
      stay, with all their customisation; what changes is how much of a
      face they show and how quickly.
    - Built: a camera's 52 scores sent with each face (as numbers only) and
      a mouth shaped from each word's letters
      ([`bb91970`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/bb91970));
      the heads given lower lids, cheek apples, each side's lid, brow and
      mouth corner on its own, a tongue, and squash and stretch
      ([`b99a482`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/b99a482)).
      Twelve faces sent from one page and drawn on another: a glare first
      shut the eyes (lids closed by angle), fixed by closing them by how
      much of the eye they cover.

### What the three spikes measured (22 October, for the next decisions)

Half-day tests before building, each on Brynly's M4 Pro in headless Chrome.
None of them was run on a phone yet; that's the open half of each.

- **Hands and body beside the face.** MediaPipe 1.0.1 on the CPU, one
  640x480 frame: face 8 ms, gesture recognition (hands, with names like
  `Thumb_Up`) 26 ms, body (pose lite) 10 ms, all three in one "holistic"
  model 41 ms. All three every frame is 45 ms, too slow for 30 a second and
  it would slow the face. In a background worker instead, the face kept its
  speed (8.6 ms a read, frames on time) and hands and body ran about 15 times
  a second; a thumbs up in a test photo was named at 0.61. (The worker has
  to be a classic one: MediaPipe's loader fails in a module worker.)
- **A voice for the words (Kokoro, 28 voices).** Only fast enough on the
  GPU (WebGPU) with the 163 MB half-size model: about 0.2 s to make a
  phrase once loaded, 8 to 10 times faster than speaking it; 15 s to load
  the first time. Every other way tried was slower than speaking (2.4 s for
  1.7 s of speech). So the browser's own voices first, for everyone, and
  Kokoro as an opt-in better voice where WebGPU exists.
- **Eight people in one 3D room, phone-sized.** A floor, walls, a table,
  shadows, eight heads on simple bodies all moving: 170,000 triangles, 517
  draw calls; the CPU side kept well over 60 frames a second slowed four
  times. It drew on the Mac's GPU, so a phone's GPU is untested. At phone
  width eight people round a table are small: faces read, words would need
  to sit elsewhere.

## What Claude did (so you can say so accurately)

- Built everything above, and made the implementation calls inside it:
  in-browser Whisper (base.en, word timestamps), YIN pitch, server-sent
  events, the phrase cutting, colours and placement, the checks in `spec/`.
- Ran two independent code reviews (subagents) and fixed what they found
  ([`8ba746e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/8ba746e),
  [`0d7470d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0d7470d)).
  Two more on the work since crit 10 (28 October), fixed in
  [`357a6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/357a6b0) and [`3408741`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/3408741): among them a name
  that could run a script on pages drawing flat avatars, voices that
  stopped themselves (the microphone heard them as you talking), replies
  dropped as echoes, and GPU memory that grew with every slider step and
  every visit to the room (measured flat afterwards).
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
