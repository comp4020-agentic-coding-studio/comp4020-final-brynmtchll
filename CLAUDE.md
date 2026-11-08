# Harness

The rules the agent's work on Said must meet. Each comes from a direction
Brynly gave while building it (dated; the commits it led to are in
`notes/decisions-log.md`) or from something that went wrong and isn't to go
wrong again. Where `spec/` checks a rule, the check is named; the rest are
judged, and say how.

## What Said is for

Live captions for a room, that keep how each thing was said. Everyone in a
conversation (a tutorial, a meeting, a table) talks into their own phone or
laptop, and everyone reads one transcript as it's said: louder heavier,
higher raised, drawn out drawn out. Someone who'd rather type can, and is
read aloud. It's more useful the more of the room is in it.

It was rebuilt into this on 8 Nov, from a room of 3D avatars ("the whole
site feels a bit goofy and purposeless ... slick, streamlined and useful
(and not clunky) ... if this might entail some radical change then thats
ok"). The state before is tagged `before-rethink`.

## Never

- Never send or keep audio. Only words, and numbers about how they were
  said, leave the speaker's browser (`room.test.ts`: "stores words and how
  they were said, and nothing else, so audio can't ride along").
- Never write what someone feels on their words. How a word was said shows
  in the word, for the reader to infer ("i think id rather the emotion be
  inferrable", 13 Oct). Judged.
- Never say how fast someone spoke: four measures of pace disagreed on real
  speech (`real-voice.test.ts`).
- Never send a stretch of microphone that's mostly silence, a breath or the
  room to Whisper: it invents sentences for it (`prosody.test.ts`;
  `vad.test.ts`: "finds none in noise, a hum, or a note held like singing
  without words"). Background noise turning into words was the bug Brynly
  asked twice to be fixed (20 Oct, 4 Nov).
- Never let anyone change or speak as anyone else (`room.test.ts`: "refuses
  a change to anyone else's words"; "credits what's said to whoever's cookie
  sent it").
- Never show anyone another person's login id, which is also their cookie,
  or who opened a room by it (`room.test.ts`: "never shows anyone another
  person's id"; "escapes a room's name ... never shows who opened it by id").
- Never put what someone said, their name, or a room's name or about into a
  page unescaped (`room.test.ts`: "escapes what people say"; "escapes a
  room's name and what it's about wherever they're shown").
- Never keep what's said in a room past what the room keeps: past it, it's
  deleted, not hidden, and a room closed takes everything said in it
  (`keep.test.ts`: "deletes what's older than each room keeps, and nothing
  newer"; "deletes at once ... and everything when it's closed";
  `room.test.ts`: "deletes what a room no longer keeps").
- Never make a visitor download something large they didn't ask for: the
  speech model (about 80 MB) loads for someone who's joined and opened a
  room; natural voices are opt-in. Reading needs no account and no download.

## Every page

- Words show up as they're said: a faded draft while someone's talking,
  replaced by the phrase within a second of it being heard, on every open
  page, with nothing in the way (`room.test.ts`: "within a second, without
  a reload"; "shows words heard early to everyone"). Tried on real speech
  as a microphone before a change to it is kept (the JFK recording: drafts
  about 3 s after speech starts, phrases about 4.5).
- The transcript is the page: one turn after another, each person's name in
  their own colour, the words themselves always high-contrast. No avatars,
  pitch lines or charts over the words ("get rid of the pitch lines", 13
  Oct). How strongly how it was said shows is each reader's choice, down to
  none (plain captions), with size and contrast; theirs alone, kept in their
  own browser, never sent. Judged from screenshots.
- What's said in a room stays in it, live and stored; who you are goes with
  you (`room.test.ts`: "keeps what's said in a room to that room"). Only
  whoever opened a room changes it, and only to what's on offer in
  `src/packs.ts` (`room.test.ts`: "lets only whoever opened a room change
  it").
- Everything someone can choose is from `src/packs.ts`, never free text that
  could be anything (`speech.test.ts`: "offers voices and a silent one, takes
  only those").
- Works in the latest Chrome at 1920x1080 and 390x844, and on a real phone,
  with no sideways scroll. Judged with a phone-sized browser, measuring the
  page against 390 itself: a phone-sized Chrome's `innerWidth` grows with an
  overflowing page, so comparing with it can't catch one (it missed a 682 px
  page on 5 Nov).
- Slick and calm, not a prototype ("considerably more polished stylish and
  slick", 4 Nov; "slick, streamlined and useful (and not clunky)", 8 Nov):
  one set of controls used everywhere, nothing on screen that isn't for
  reading or saying something, motion only where something arrives. Judged
  from screenshots of every page, both sizes, both themes, before a visual
  change is kept.
- Keys are only taken for correcting a word once you've tapped one of
  yours; never while typing, and never from anywhere else on the page
  (walking once typed "wwww" over someone's last word and Enter sent it to
  everyone, 8 Nov). Judged in a browser.

## Every change

- `pnpm check` passes against the running app (`node src/server.ts`),
  including the hearing checked on real recordings in `spec/fixtures/`. A
  change to how speech is heard is tried on real audio, not only on tones,
  before it's accepted.
- CI is read by its jobs (`gh run view <id> --json jobs`), not by whether
  `gh run watch` exited 0: that said success for three red runs on 8 Nov
  and the site stayed old.
- A fix for something the agent got wrong lands as a check in `spec/` or a
  rule here, not only as a retry until it looks right.
- Facts only in `notes/decisions-log.md`, each with its commit. `README.md`,
  `PROCESS.md`, the reflections and the decision records are Brynly's to
  write; the agent finds sources, facts and gaps for them, and doesn't draft
  them.
- Never force-push, and never move a crit tag.
- Brynly's name in full, never shortened to Bryn.
