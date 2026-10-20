# 2. [Title: who can see and change what in Said]

> **Draft:** this is crit 10's required decision record ("the permission
> decision written down in the repo with why"), and it's Bryn's to write.
> The facts below are what the app does today, checked in `spec/`, to argue
> from. Delete this note once it's yours.

## Status

Accepted, 21 October 2026.

## Context

*Bryn: who uses this, and what does good (README.md) ask of who may see and
change what? Why does it matter for a room where words are drawn the way
they were said?*

What a person is, and what the server already does:

- A person is a name they pick and a random id kept in an HttpOnly cookie
  (scripts on the page can't read it). The id is never shown to anyone; logs
  show `name#tag`, a few characters derived from it
  ([`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)).
- Who did something comes only from the cookie. A name sent in a request is
  ignored ([`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8);
  `spec/room.test.ts`, "credits what's said to whoever's cookie sent it").
- Every request is checked on the server against what's on offer
  (`src/packs.ts`), and each kind is rate-limited.

## Options considered

*Bryn: say which you weighed and what each would cost. Some that came up:*

1. *Accounts with passwords* (who a person is survives a cleared browser;
   costs a sign-up step before anyone can speak).
2. *A name and a cookie, as built* (no sign-up; someone who clears their
   cookies is a new person, and can't get their old name back).
3. *Fully anonymous* (no names at all).

*And for what others may do to your words:*

1. *Nobody but you touches your words* (strict).
2. *Others may react, as built* (a reaction is theirs, beside your word,
   and doesn't change it).
3. *Others may edit, annotate or remove* (open).

## Decision

*Bryn: which, and why it serves good better than the others.*

What each person may do, as built:

| | Anyone with the URL | Someone who has joined | Only the person themselves |
|---|---|---|---|
| Watch the room and read what's been said | yes | yes | |
| Speak | | yes | |
| Change, add an effect to, or delete a word | | | their own words only |
| Show their face, voice level, head turn | | | their own avatar only |
| Choose how their avatar and words look | | | their own only |
| Emote | | | their own head only |
| React to a word | | anyone's word, one reaction each | |

Refused on the server: anything by someone who hasn't joined (401); an
edit to someone else's words (403, logged `refused why="not-theirs"`);
anything not on offer (400, logged); too many too fast (429).

## Consequences

*Bryn: what this makes easy, what it makes hard, and what you'd revisit.
E.g. what happens when someone clears their cookies; whether a reaction is
"on" someone's words; what a moderator would need.*

How it's checked: `spec/room.test.ts`, the "only lets a person change
their own..." and "lets anyone react to anyone's word..." checks, against
the running app. How it's seen: `mise exec -- flyctl logs -a
comp4020-final-brynmtchll`, one line per action, `name#tag action detail`.
