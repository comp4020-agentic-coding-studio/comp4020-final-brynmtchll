# Harness

Rules the agent's work on Said must meet. Each rule comes from one of two
places:

- a direction Brynly gave, dated (its commits are in
  `notes/decisions-log.md`)
- a bug that mustn't recur

Where `spec/` checks a rule, the check is named. The rest are judged, and the
rule says how. A "probe" is a script in `~/comp4020/.probes`.

## What Said is for

A room where people talk and everyone sees how each thing was said:

- louder is heavier
- higher sits higher
- a drawn-out word is drawn out

It should be better because other people are there at the same time.

- **A party you can read.** Several conversations run at once, and you follow
  the one you walk up to ("ok lets go with the first", 8 Nov).
- **The core is creative ways to communicate** (8 Nov). New ways sit
  alongside what's already there, not instead of it.
- **The avatars stay** ("no i still want the avatars", 8 Nov). They're
  cartoon heads, made more expressive and responsive ("lets keep the silly
  cartoons … i just want more sophisticated expression out of them", 8 Nov).
  Avatar toolkits were tried and set aside.
- **Ruled out:**
  - the captions-only rethink ("scrap it", 8 Nov)
  - games and scores ("i dont want to gamify it", 8 Nov)

## Never

- **Never send or keep audio or face images.** Only words leave the browser.
  So do numbers about how each was said, and how a face or hand is held.
  - Checked in `room.test.ts`:
    - "stores words and how they were said, and nothing else"
    - "puts someone's expression on their avatar ... and takes nothing but
      its numbers"
- **Never label a feeling** on anyone's words or card. How a word was said
  shows in the word. The reader infers the rest ("i think id rather the
  emotion be inferrable", 13 Oct). Judged.
  - The exception: a big laugh or a held gasp sends an emote by itself. If
    that stays, README.md says why.
- **Never say how fast someone spoke.** Four measures of pace disagreed on
  real speech (`real-voice.test.ts`).
- **Never send silence, breath or room noise to Whisper.** It invents
  sentences from them. Brynly reported this twice (20 Oct, 4 Nov).
  - Checked in `prosody.test.ts`, and in `vad.test.ts`: "finds none in
    noise, a hum, or a note held like singing without words".
- **Never let anyone edit, retract or speak as someone else.**
  - Checked in `room.test.ts`:
    - "refuses a change to anyone else's words"
    - "credits what's said to whoever's cookie sent it"
- **Never show anyone another person's login id.** It's also their cookie
  (`room.test.ts`).
- **Never put user text into a page unescaped** (`room.test.ts`,
  `face.test.ts`).
- **Never force a large download.**
  - The speech model (~80 MB) loads once, on joining. Then it's cached.
  - Natural voices are opt-in. So is anything else large.

## Every page

### Speed, layout, polish

- **Words appear as they're said.** One at a time, in the speaker's place.
  Every open page shows them within 1 s. There's no queue and no send button
  ("the text be transmitted directly", 20 Oct).
  - Checked in `room.test.ts`: "within a second, without a reload".
- **Typed words go out one at a time.** Each is sent when a space ends it.
  Enter or a pause keeps the line ("text should send on hitting space bar",
  8 Nov).
  - Checked in `typed.test.ts`.
  - Judged with two pages: type a word and a space in one, and the other
    shows it.
- **No pitch lines or charts over the words** ("get rid of the pitch lines i
  dont like that", 13 Oct).
- **Works in Chrome at 1920×1080 and 390×844, and on a real phone.** No
  sideways scroll.
  - Judged by measuring the page against 390 px. Don't compare against
    `innerWidth`. It grows with an overflowing page. That's how a 682 px page
    was missed on 5 Nov.
- **Polished and smooth** ("considerably more polished stylish and slick",
  4 Nov):
  - Motion eases rather than jumps.
  - The room runs at about 60 fps on a laptop. On a slowed phone with 12
    people, it runs at about 50.
  - A slow device drops effects before it drops smoothness.
  - Judged from screenshots of every page, at both sizes, in both themes.
    This happens before a visual change is kept. Frame rates are measured,
    not guessed.
- **One place for each thing** ("i want the ui to feel more cohesive and
  intuitive", 8 Nov).
  - Controls sit in one column beside the room. On a phone, they sit under
    it. One panel is for saying something. The rest are in tabs.
  - A room's settings open from the room, for its maker only.
  - A list that scrolls fades where it's cut.
  - Lately opens on the newest lines. It opened on the oldest on 9 Nov
    (probe `lately.mjs`).
- **Panels are solid enough to read.** Only overflowing text fades. The help
  panel once let the page show through (probe `help-panel.mjs`).
- **One name for each thing, wherever it appears:** "Show my face", "Say",
  "Looks like", "Copy the link", and one emoji for wow.
- **A room's count includes who's away as well as who's here** (probe
  `counts.mjs`).
- **A button too small for its label still says what it does.** Use a
  microphone icon, not a bare dot.
- **On a phone in full screen, every control stays in reach.** That's every
  view, Sit and the lenses. None covers another. On 9 Nov the lenses covered
  "Above". Once you stood up, they covered "Me" and "Sit" too (probe
  `full-bar.mjs`).
- **Everything works from the keyboard, with a visible focus ring.**
  - Each person's latest words are one tab stop. The arrow keys choose a
    word. Enter reacts to it.
  - Esc closes any open panel. Focus returns to where it was.
  - On a phone, a panel taller than the screen opens as a bottom sheet.
  - Judged by tabbing through every page. All of this was missing on 9 Nov
    (probe `a11y.mjs`).

### Avatars

- **Everything about how someone looks is theirs to choose.** That's avatar,
  word style and voice. Choices come only from `src/packs.ts`. Never free
  text (`packs.test.ts`).
- **The avatar is them.** It follows their face, head, hands and voice. It
  should feel live ("i need the head to be more responsive", 20 Oct). Brynly
  judges this with their own face and voice.
- **Face:**
  - Each side moves on its own, from the camera's 52 scores (`arkit.ts`).
    A wink, a raised brow or a smirk shows on the right side
    (`arkit.test.ts`).
  - A head driven by a camera blinks only when its person blinks.
  - A glare narrows the eyes without shutting them.
  - Judged from 12 test faces. They're sent from one page and drawn on
    another (probe `faces.mjs`). This happens before any change to how a
    head is drawn is kept.
- **An avatar never shows a feeling its person didn't.**
  - Others' heads only glance at someone who emotes, arrives or raises a
    hand.
  - Nobody's face is pulled for them.
- **Eyes:**
  - Listening eyes move about the speaker's face. Now and then they look
    away and back (probe `listen-eyes.mjs`).
  - The eyes move before the head does (probe `eyes-lead.mjs`).
- **A head turned by hand in the studio is still alive.** It blinks. When
  "Hear it" plays, it says the sample with its mouth and a hand. It stood
  mute on 9 Nov (probe `studio-say.mjs`).
- **How a word was said shows on the speaker's face as it's said.** That
  covers loud, quiet, high, low, a question, drawn out, and any effect. It's
  strong enough to read across the room (`packs.test.ts`: "the faces a
  word's effect pulls on its speaker").
- **Hands move only with the speaker's own words** (probe `beats.mjs`):
  - a beat on a word leaned on
  - a palm up on a question
  - claws, jazz hands or a sway for the Spooky, Sparkle and Wave effects
- **Word gestures.** Some words get a gesture of their own:
  - "hi" waves
  - "me" puts a hand to the chest
  - "you" holds a hand out
  - "huge" spreads the hands apart
  - "maybe" shrugs
  - "yes" nods
  - "no" shakes the head
- **Common words gesture only when stressed.** "you", "me", "that", "one"
  and "yes" are often said in passing. About 1 word in 20 of ordinary talk
  gets a gesture. Not 1 in 5.
  - Gestures show the word, never how anyone feels about it.
  - Checked in `gestures.test.ts`. Probes `gestures.mjs`, `gestures-num.mjs`
    and `card-gesture.mjs`.
- **An emote with a pose moves the arms too:**
  - laugh: a hand on the belly
  - wow: hands to the cheeks
  - grr: fists
  - cool: arms folded
  - It uses one arm or both. Never both kinds of movement at once
    (`body.test.ts`; probe `emote-bodies.mjs`).

### The room

- **You can walk about the room.** Everyone sees you there. It can fill the
  screen ("make it so that you can control your avatar and move around",
  7 Nov; "reimagine the whole thing", 8 Nov).
- **Nobody walks through a wall, the table or a chair.**
  - Standing up and sitting down go out and back between the chairs.
  - A raised row is reached by its step.
  - A tap on the floor finds a way round.
  - Checked in `walk.test.ts`:
    - "gets everyone out of their chair and back into it ... never through a
      chair or the table"
    - "finds the way round the table and the chairs"
- **Right is right, as the camera sees it** (`walk.test.ts`: "walks the way
  the stick points"). For a day it went left.
- **Keys pressed in the room belong to the room.**
  - W A S D walk after anything in the room is clicked. Not while typing in
    a box.
  - They never type over a word. On 8 Nov walking typed "wwww" over a word.
    Enter sent it.
  - Judged: say something, click a view, hold W, then press Enter.
- **Full screen keeps a way to talk.** One finger drags to look around.
- **Close the page while standing, and you're back in your chair** within
  about 70 s (`walk.test.ts`: "sits back down whoever closed their page while
  up").
- **Before you join, an empty room shows its chairs.** It says nothing about
  walking (probe `landing-room.mjs`).
- **Where someone stands is kept only while they're standing.** It's never
  stored or logged (`room.test.ts`: "shows someone walking about the room").
- **There's more than one room** ("different rooms / spaces, featuring
  different groups", 8 Nov).
  - What's said, hands, walking and emotes stay in their own room. That holds
    live and in storage (`room.test.ts`: "keeps what's said in a room to
    that room, live and stored").
  - Who you are and how you look go with you.
  - Only a room's maker can change it. They can only pick looks from
    `src/packs.ts` (`room.test.ts`: "lets only whoever made a room change
    it, and only to looks on offer").
  - A room's name is always escaped. Its maker is never sent by id
    (`room.test.ts`: "escapes a room's name wherever it's shown, and never
    shows who made it by id").
- **Words are as clear as you are close.**
  - Words are clear close by. They fade further off. Past a point, all that
    shows is that someone's talking.
  - A loud word carries further. A whisper carries less far. Both have
    limits.
  - The rules live in `src/hearing.ts`. Checked in `hearing.test.ts`:
    - "reads someone clearly close to, fainter further off, and not at all
      past their reach"
    - "carries a loud word further and a quiet one less far, within bounds"
  - Judged with two groups talking at once. They stand at opposite ends of
    the room.
- **Captions over heads never cover each other or the controls.** They never
  run off the edge.
  - In a crowd they shrink to one line, then to a name. They stay shrunk
    while it's crowded. They don't flicker between sizes.
  - Probes `crowd/room1.mjs`, `crowd/overlap.mjs` and `crowd/flicker.mjs`.
    The overlap and the flicker both happened on 9 Nov.

### Space (`/r/space/`)

- **In Space, you are your words.** You move them about a plain field ("you
  are the text and you can move that toward or away from others", 8 Nov).
- **It's one floor for everyone.** If someone can read you, you can read them
  (`hearing.test.ts`: "lays Space over one floor for everyone…").
- **Someone new starts clear of everyone already there** (`hearing.test.ts`
  and `room.test.ts`: "starts someone new in Space clear of everyone
  there…").
- **Your position is two numbers.** Only you set it. It's never sent with an
  id (`room.test.ts`: "puts each person in Space where they move
  themselves…").
- **Names are escaped** (`room.test.ts`: "escapes names in Space…").
- **Space never appears in the rooms list.**
- **Lenses** (Words, Colour, Emoji) redraw the same words from their numbers
  (`src/lens.ts`). They work in Space and over heads in the room.
- **Tones** turn the same numbers into notes. They never use anyone's actual
  voice. They play only when turned on.
- **No name or words are drawn over anyone else's.** That holds even with
  several people in one corner. They overlapped on 9 Nov (probe
  `space-corner.mjs`).
- **An empty field says it's empty.**
- **On a phone the field is turned sideways.** Right on the screen is still
  right.
- Judged from screenshots: both sizes, both themes, before and after joining.

## Every change

- **`pnpm check` passes against the running app** (`node src/server.ts`).
  That includes the hearing checks on real recordings in `spec/fixtures/`.
- **A change to how speech is heard is tried on real audio,** not only on
  test tones.
- **A fix for an agent mistake becomes a check in `spec/` or a rule here.**
  Not just a retry until it looks right.
- **`notes/decisions-log.md` holds facts only,** each with its commit.
- **Brynly writes `README.md`, `PROCESS.md`, the reflections and the
  decision records.** The agent finds sources, facts and gaps. It doesn't
  draft them.
- **Never force-push. Never move a crit tag.**
- **Brynly's name is always in full.** Never "Bryn".
