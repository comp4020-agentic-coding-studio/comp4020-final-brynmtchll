# 2. Who can see and change what: anyone can watch, and what's yours is only yours to change

## Status

Accepted 21 October 2026, for crit 10. Extended on 8 November for rooms (see
"Consequences").

## Context

Said draws each word the way it was said, so a word carries more than its
text: how loud, how high, how drawn out. Anyone who could change someone
else's words could also change how they appeared to have said them. As of
crit 10, the brief asks what each person may see and change, and that the
server enforces it.

What a person is, as built:

- A name they pick, plus a random id kept in an HttpOnly cookie that page
  scripts can't read.
- The id is never shown to anyone. Logs show `name#tag`, a few characters
  derived from it
  ([`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)).
- Name plus cookie was Claude's choice when the app was first built. It's on
  the list of choices you should own or revisit.

> *Brynly: what does good ask of who may see and change what, in a room like
> this?*

## Options considered

**Who counts as a person:**

1. **Accounts with passwords.** Your identity survives a cleared browser. It
   costs a sign-up step before anyone can speak, which is a lot to ask at a
   showcase where people walk up and talk.
2. **A name and a cookie** (chosen). There's no sign-up. Someone who clears
   their cookies becomes a new person and can't get their old name back.
3. **Fully anonymous.** No names at all. Others can't tell who said what,
   which undermines a room where each person has their own place.

**What others may do to your words:**

1. **Nobody but you touches them.**
2. **Others may react** (chosen, 20 Oct). A reaction belongs to the reactor
   and sits under the word, and the word itself doesn't change.
3. **Others may edit, annotate or remove them.**

## Decision

Anyone with the URL can watch. Joining lets you speak. What's yours, only you
can change: your words, face, voice, avatar and emotes. Anyone who has joined
may react to anyone's word.

This comes from your direction for live edits, "options to modify text be
done live without a buffer" (20 Oct). That made it necessary to decide whose
words a person may edit
([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
Who did what is taken only from the cookie, and a name sent in a request is
ignored
([`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8)).
Reactions came with "really maximise expressiveness" (20 Oct)
([`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)).
Letting anyone react to anyone's word was Claude's call inside that, and it's
flagged in the decisions log for you to own.

| | Anyone with the URL | Someone who has joined | Only the person themselves |
|---|---|---|---|
| Watch the room and read what's been said | yes | yes | |
| Speak or type | | yes | |
| Change, add an effect to, or delete a word | | | their own words only |
| Show their face, hands, voice level, head turn, where they stand | | | their own avatar only |
| Choose how their avatar, words and voice look and sound | | | their own only |
| Emote, raise a hand | | | their own only |
| React to a word | | anyone's word, one reaction each | |
| Rename a room or change its look | | | whoever made the room |

The server refuses:

| Request | Response |
|---|---|
| Anything from someone who hasn't joined | 401 |
| An edit to someone else's words | 403, logged `refused why="not-theirs"` |
| Anything not on offer in `src/packs.ts` | 400, logged |
| Too many requests too fast | 429 |

> *Brynly: why a cookie over accounts, and why reactions over strict
> ownership.*

## Consequences

- **Joining is one step: type a name.** Showcase visitors and markers get in
  from the URL alone.
- **A cleared browser loses your identity.** There's no way to get it back,
  and nobody can moderate someone who keeps coming back under a new name.
- **Your words can't be put in your mouth.** Nobody can make you appear to
  have said something, or said it differently. Checked against the running
  app in `spec/room.test.ts`:
  - "credits what's said to whoever's cookie sent it"
  - "refuses a change to anyone else's words"
  - "lets anyone react to anyone's word…"
- **A reaction is someone else's mark on the page next to your words.**
  Reactions sit under the word rather than over it.
- **Rooms (8 Nov).** Only whoever made a room can rename it or change its
  look, and only to looks on offer. Who made a room is never sent by id.
  What's said in a room stays in that room
  ([`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9);
  `spec/room.test.ts`, "lets only whoever made a room change it, and only to
  looks on offer").
- **Where someone stands is kept only in memory.** It's never stored or
  logged, and it's never sent with an id in Space.
- **How it's seen in the logs:**
  `mise exec -- flyctl logs -a comp4020-final-brynmtchll` prints one line per
  action, `name#tag action detail`.

> *Brynly: what you'd revisit (e.g. is a reaction "on" someone's words or
> beside them; what a moderator would need).*
