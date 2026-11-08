# Overnight plan: one purpose for Said, then extend and refine (8 to 9 November)

> **Superseded, 8 November, 22:10.** Brynly turned down the games ("i dont
> want to gamify it") in favour of seamlessness and expressive faces. The
> games were built and then removed (`6189d0f`, reverted in `561c29f`). Kept
> as a record of an option tried. The work now is avatars from a toolkit
> made for it (decisions log 13).

Brynly, 8 November, 21:20: "i want rather to think of ways to give a feeling
of purpose to the original site, or something like a task to make it
engaging and give users a reason to visit it", and "establish a
comprehnsive list of changes and improvements to together unify and give
purpose to the site as well as extend it and refine it, enough so so that
this can be worked on all through the night."

Due noon Monday 9 November. The rethink is scrapped: its branch is
deleted, and only the tag `rethink-trial` is kept, as process evidence.

This is a working list. Each item ships alone: built, checked in a browser at
1920 and 390 in both themes, `pnpm check` green, committed, deployed, and
the decisions log updated with its commit. Ticked as done. The order is the
order of work: purpose first, then what makes it engaging, then what's
unfinished, then polish.

## The idea that ties it together

Said is about **how** something is said, not only what. Every part of it
already serves that:
- words drawn the way they were said;
- avatars that pull your face;
- captions that fade with distance;
- colour, emoji and tones as other ways to read the same voice.

What's missing is a reason to come, and a reason to talk once you're there.

**Purpose: Said is a place to play with how you say things.** You come to a
room for something to do together, a prompt or a game, that's only fun
because everyone can see *how* you said it. The party room is where it
happens; Space is the quiet corner where you can be just your words.

That gives every feature a job:
- **Prosody drawing.** The game is about it.
- **Avatars and faces.** Your face is part of how you said it.
- **Hearing by distance.** Group play: walk to the table that's playing.
- **Lenses and tones.** Ways to guess and judge.
- **Typing with tones.** For anyone without a microphone, or who'd rather type.

## A. Purpose: things to do in a room (the core of tonight)

Each room has a **game table**. Anyone can start a round from the room's
panel. A round is a short shared task, shown to everyone in the room (and
over the table in 3D), that you play by talking.

1. [x] **Say it like…** (the first game, and the one to get right). The room
   is given a plain line ("I can't believe you did that") and a way to say
   it ("…like it's the best news ever", "…like a secret", "…like you're
   furious"). Everyone says it. Each take shows as words drawn the way they
   were said, side by side. Everyone taps the take that nailed it. The most
   taps wins the round. Prompts are data in `packs.ts`. Only words and
   numbers are kept, as now. Checks:
   - a round's takes only from people in the room;
   - one vote each, never for yourself;
   - the result is the same on every page.
2. [x] **Guess how.** One person is given a secret way to say a line and says
   it. Everyone else guesses the way from the drawing alone (four choices).
   Score: how many guessed right. This is the "emotion inferable, not
   labelled" position (decisions log 4) as a game.
3. [x] **Hot seat / question of the round.** A question for the room ("the
   best thing that happened this week?"), and everyone answers by talking.
   Answers stay pinned to the table for the round. This is the low-pressure
   one, for groups that just want to talk.
4. [x] **Rounds in the 3D room.** The prompt floats over the table. Takes
   show over each player's head. A gentle chime and a sweep of light mark
   each round's start and end. People drift to the table to play (hearing
   by distance makes this matter: the table is where you read).
5. [ ] **Scores that mean a little.** Each person collects "nailed it"
   marks across rounds, shown on their card as a small count, and the
   room's best take of the day is pinned. Nothing global, nothing that
   follows you about.
6. [ ] **The home page says what Said is for.** A one-line purpose, the
   rooms with a game going ("3 playing Say it like… now"), and one big way
   in. Space is introduced as the quiet corner.
7. [ ] **A daily line.** The same "Say it like…" prompt for everyone that
   day, on the home page, so there's a reason to come back. Takes from
   anyone, in any room, gathered on a "today's line" page, best voted
   first.

## B. Making the first minute work (onboarding and learnability)

8. [ ] **First visit tour, three steps, skippable:**
   - talk, and see your words drawn;
   - walk to people to read them;
   - play a round.
   Shown once and remembered.
9. [ ] **Try it before joining.** On the join card, a "say something"
   preview that draws a typed line with a tone, so a visitor sees the idea
   before giving a name.
10. [ ] **Empty room.** When you're the only one there, a friendly
    "nobody else here yet: share the link, or play solo" with a copy-link
    button and a solo round (Say it like… against your own last take).
11. [ ] **Microphone states made obvious.** Downloading, listening, heard,
    and "too quiet / too far" each get a clear visual state on the talk
    button and dock (not only the status line).

## C. Social presence and feeling of a place

12. [ ] **Arrivals and leavings,** shown softly in the room: "Ana came in",
    and a wave from their avatar.
13. [ ] **Reactions float up in 3D.** A word reacted to sends its emoji up
    from the speaker's head, as emotes already do.
14. [ ] **Who's reading you.** A small "2 can read you" by your own name in
    3D and in Space, from the same hearing rules, so you know who's in
    earshot.
15. [ ] **Room ambience,** off by default: a soft room tone, chosen with the
    room's look (café, garden, night), quietened under talking. Never sent
    anywhere.

## D. Expression (more ways to say and read how)

16. [ ] **Tones in the room as well as Space.** The ♪ toggle in the room's
    corner; each person's notes from where their avatar is (panned by
    position).
17. [ ] **Lens: "shape".** Words as a sound-wave line: thick for loud, high
    for pitch, long for drawn out. A fourth way to read.
18. [ ] **Typed tone shows live.** The tone picked shows on your own draft
    as you type, so you see how it'll land before the space sends it.

## E. Refinement (usability, robustness, polish)

19. [ ] **Phone pass on every page** (390x844 and a real phone if
    possible): room, studio, rooms, Space, a game round. Fix anything
    cramped, any tap target under 44 px, and any sideways scroll.
20. [ ] **Keyboard pass:** every control reachable, visible focus, no traps
    (the room's keys versus boxes), Esc closes what's open.
21. [ ] **Screen reader pass.** Game rounds announced (prompt, your turn,
    result); live region for what's said kept tidy.
22. [ ] **Reduced motion.** Every new animation (rounds, ripples, reactions)
    off under `prefers-reduced-motion`.
23. [ ] **Performance check** with twelve people and a round going: the
    frame rate measured, not guessed, at laptop and slowed-phone speeds.
24. [ ] **Bug hunt** (a subagent using the site for an hour, as before),
    then fix what it finds, each with a check.
25. [ ] **Consistent words across the site:** one name per thing ("room",
    "round", "take", "Space"), and the help texts match what's there.

## F. Hand-in

26. [ ] **README facts** brought up to date (How it works, What's checked).
    Gaps flagged for Brynly: "What good means", "Judged by people",
    Sources. The README's "Bryn" is fixed to "Brynly" (their name in full).
27. [ ] **Process evidence** in `notes/process-narrative.md` (facts and
    commits for Brynly's narrative: attention moving across the facets of
    HCI, and trials such as the rethink driving decisions). Brynly writes
    PROCESS.md from it.
28. [ ] **Preflight before noon:** clean tree, pushed, CI green by jobs, live
    deploy verified, `pnpm check:evidence` passing.

## Order for the night

A1 → A4 → A6 → B8 → A2 → A5 → B10 → B11 → A3 → A7 → C14 → D16 → C12 →
C13 → B9 → D18 → D17 → C15, with E19 to E25 after each big piece and as a
final sweep, and F26 to F28 last. If time runs short, everything from C on
is optional; A1, A4, A6 and B8 are the purpose.
