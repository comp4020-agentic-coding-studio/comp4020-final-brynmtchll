# Harness

The rules the agent's work on Said must meet. Each comes from a direction
Brynly gave while building it (dated; the commits it led to are in
`notes/decisions-log.md`) or from something that went wrong and isn't to go
wrong again. Where `spec/` checks a rule, the check is named; the rest are
judged, and say how.

## What Said is for

People in one room, talking, and everyone seeing *how* each thing was said,
not just what: louder heavier, higher higher, drawn out drawn out. It should
be more interesting because others are in the room at the same moment.

## Never

- Never send or keep audio, or a picture of anyone's face. Only words, and
  numbers about how they were said and how a face or hand is held, leave the
  speaker's browser (`room.test.ts`: "stores words and how they were said,
  and nothing else"; "puts someone's expression on their avatar ... and takes
  nothing but its numbers").
- Never write what someone feels on their words or their card. How a word
  was said shows in the word, for the reader to infer ("i think id rather
  the emotion be inferrable", 13 Oct). Judged. (The nearest the app comes:
  a big laugh or a held gasp read from someone's face sends an emote by
  itself. If that stays, README.md says why.)
- Never say how fast someone spoke: four measures of pace disagreed on real
  speech (`real-voice.test.ts`).
- Never send a stretch of microphone that's mostly silence, a breath or the
  room to Whisper: it invents sentences for it (`prosody.test.ts`;
  `vad.test.ts`: "finds none in noise, a hum, or a note held like singing
  without words"). Background noise turning into words was the bug Brynly
  asked twice to be fixed (20 Oct, 4 Nov).
- Never let anyone change, take back or speak as anyone else
  (`room.test.ts`: "refuses a change to anyone else's words"; "credits what's
  said to whoever's cookie sent it").
- Never show anyone another person's login id, which is also their cookie
  (`room.test.ts`).
- Never put what someone said into a page unescaped (`room.test.ts`,
  `face.test.ts`).
- Never make a visitor download something large they didn't ask for: the
  speech model (about 80 MB) loads once, on joining, and is kept; natural
  voices and anything else big are opt-in.

## Every page

- Words show up as they're said: one at a time, in the speaker's own place,
  within a second on every other open page, with no queue, loading zone or
  button in the way ("i want ... the text be transmitted directly", 20 Oct;
  `room.test.ts`: "within a second, without a reload"). Each person keeps
  their own place and colour.
- No pitch lines or charts over the words: the words themselves carry it
  ("get rid of the pitch lines i dont like that", 13 Oct).
- Works in the latest Chrome at 1920x1080 and 390x844, and on a real phone,
  with no sideways scroll. Judged with a phone-sized browser, measuring the
  page against 390 itself: a phone-sized Chrome's `innerWidth` grows with an
  overflowing page, so comparing with it can't catch one (it missed a 682 px
  page on 5 Nov).
- Polished, smooth and stylish, not a prototype ("considerably more polished
  stylish and slick, with seamless and stunning design", 4 Nov): motion eases
  rather than jumps, the room stays near 60 frames a second on a laptop and
  near 50 on a slowed phone with twelve people in it, and a slow device gives
  up effects before it gives up smoothness. Judged from screenshots of every
  page, both sizes, both themes, before a visual change is kept, and frame
  rates measured, not guessed.
- Personal: everything about how someone appears is theirs to choose (avatar,
  word style, voice), from choices in `src/packs.ts`, never free text that
  could be anything (`packs.test.ts`).
- The avatar is them: it follows their face, head, hands and voice closely
  enough to feel live ("i need the head to be more responsive", 20 Oct).
  Judged by Brynly, with Brynly's own face and voice.
- The room is a place to be in, not only to look at: you can walk your
  avatar about it, everyone sees you there, and it can fill the screen
  ("make it so that you can control your avatar and move around, also i
  want a full screen option", 7 Nov; "theres a lot more work that needs to
  be done on that", then "reimagine the whole thing"). Nobody walks through
  a wall, the table or a chair: getting up and sitting go out and back
  between the chairs, a raised row along its step and down at the end, and
  a tap finds a way round (`walk.test.ts`: "gets everyone out of their
  chair and back into it ... never through a chair or the table", "finds
  the way round the table and the chairs"). Right is right, as the camera
  sees it (`walk.test.ts`: "walks the way the stick points"; it went left
  for a day). Keys pressed in the room are the room's: W A S D walk
  whatever in it was last clicked (a view, Reset, Sit), except a box being
  typed in, and never type over a word (walking once typed "wwww" over
  your last word, and Enter sent it to everyone, 8 Nov). Judged in a
  browser: say something, click a view, hold W, press Enter. Full screen
  keeps a way to talk, and one finger looks round in it. Anyone who closes
  their page while up is back in their chair within a minute and a bit
  (`walk.test.ts`: "sits back down whoever closed their page while up").
  Where someone stands is only ever a place on the floor, kept while
  they're up and never stored or logged (`room.test.ts`: "shows someone
  walking about the room").
- There's more than one room, each its own group with its own look
  ("options to have different rooms / spaces, featuring different groups
  etc", 8 Nov). What's said, hands, walking and emotes in a room stay in that
  room, live and stored (`room.test.ts`: "keeps what's said in a room to that
  room, live and stored"). Who you are and how you look go with you. Only
  whoever made a room changes it, and only to looks from `src/packs.ts`
  (`room.test.ts`: "lets only whoever made a room change it, and only to
  looks on offer"). A room's name is escaped everywhere it shows, and who
  made it is never sent by id (`room.test.ts`: "escapes a room's name
  wherever it's shown, and never shows who made it by id").
- One place for each thing: what you can do sits together beside the room
  (on a phone, under the 3D room, and above the cards), one panel for
  saying something, the rest in tabs;
  the room's own settings open from the room, for whoever made it ("i want
  the ui to feel more cohesive and intuitive", 8 Nov). Judged from
  screenshots, both sizes, both themes.

## Every change

- `pnpm check` passes against the running app (`node src/server.ts`),
  including the hearing checked on real recordings in `spec/fixtures/`. A
  change to how speech is heard is tried on real audio, not only on tones,
  before it's accepted.
- A fix for something the agent got wrong lands as a check in `spec/` or a
  rule here, not only as a retry until it looks right.
- Facts only in `notes/decisions-log.md`, each with its commit. `README.md`,
  `PROCESS.md`, the reflections and the decision records are Brynly's to
  write; the agent finds sources, facts and gaps for them, and doesn't draft
  them.
- Never force-push, and never move a crit tag.
- Brynly's name in full, never shortened to Bryn.
