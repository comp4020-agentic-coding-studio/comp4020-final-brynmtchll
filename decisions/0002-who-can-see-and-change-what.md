# 2. Who can see and change what: anyone can watch; only you change what's yours

## Status

Accepted 21 October 2026, for crit 10. Extended on 8 November for rooms.

## Context

A word in Said carries how it was said. Editing someone's word changes what
they seem to have said, and how. Crit 10 requires the server to enforce who
may see and change what.

A person is:
- **a name they choose**
- **a random id in an HttpOnly cookie**
  - Page scripts can't read it.
  - Nobody is ever shown it.
  - Logs show `name#tag` instead
    ([`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)).

Claude chose name plus cookie in the first build. The decisions log lists it
for Brynly to own.

Because a word carries how it was said, good permissions here mean nobody can
change what you seem to have said, or how, while anyone can still watch and
join in without friction. The permissions protect the words, not the room.

## Options

### Identity

| Option | Gain | Cost |
|---|---|---|
| Accounts with passwords | You keep your identity if you clear your browser | You must sign up before speaking. That's a barrier at a walk-up showcase. |
| **Name + cookie** (chosen) | No sign-up | Clearing your cookies makes you a new person. Your old name is lost. |
| Fully anonymous | Nothing identifies you | Nobody can tell who said what. The room needs a place for each person. |

### What others may do to your words

| Option | Effect |
|---|---|
| Nothing | Your words stay only yours |
| **React** (chosen, 20 Oct) | A reaction belongs to the reactor and sits under your word. The word doesn't change. |
| Edit, annotate or remove | Others can change what you seem to have said |

## Decision

- **Anyone can watch.**
- **Joining lets you speak.**
- **Only you can change what's yours.**
- **Anyone who has joined can react to any word.**

Where it came from:

- **Brynly asked for live editing** ("options to modify text be done live
  without a buffer", 20 Oct). That raised the question of whose words a
  person may edit
  ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **Identity comes from the cookie only.** A name sent in a request is
  ignored
  ([`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8)).
- **Reactions came with "really maximise expressiveness"** (20 Oct;
  [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)).
  Claude chose to let anyone react to any word. The decisions log flags this
  for Brynly to own.

| | Anyone with the URL | Joined | Only the person |
|---|---|---|---|
| Watch and read | yes | yes | |
| Speak or type | | yes | |
| Edit, add an effect to, or delete a word | | | own words |
| Face, hands, voice level, head turn, position | | | own avatar |
| Avatar, word style, voice | | | own |
| Emote or raise a hand | | | own |
| React to a word | | any word, one reaction each | |
| Rename a room or change its look | | | the room's maker |

What the server refuses:

| Request | Response |
|---|---|
| Anything from someone who hasn't joined | 401 |
| An edit to someone else's words | 403, logged `refused why="not-theirs"` |
| Anything not on offer in `src/packs.ts` | 400, logged |
| Too many requests too fast | 429 |

I kept the cookie over accounts because sign-up is a barrier at a walk-up
showcase, and a name is enough to tell people apart in a room. I accepted that
clearing cookies loses your identity. I kept reactions over strict ownership
because a reaction sits under a word and never changes it, so it adds
expression without altering what was said. Strict ownership would have left
nobody able to respond to anyone's words, which cuts against "really maximise
expressiveness".

## Consequences

- **Joining is one step.** You type a name. Markers and showcase visitors
  get in from the URL alone.
- **Identity is fragile.** Clearing your browser loses it for good. Nobody
  can moderate someone who rejoins under a new name.
- **Nobody can put words in your mouth.** `spec/room.test.ts` checks this
  against the running app:
  - "credits what's said to whoever's cookie sent it"
  - "refuses a change to anyone else's words"
  - "lets anyone react to anyone's word…"
- **A reaction is someone else's mark next to your words.** It sits under the
  word, not on it.
- **Rooms (8 Nov):**
  - Only a room's maker can change it.
  - They can only pick looks on offer.
  - The maker is never sent by id.
  - What's said stays in its room
    ([`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9);
    `spec/room.test.ts`: "lets only whoever made a room change it, and only
    to looks on offer").
- **Position lives in memory only.** It's never stored or logged. In Space,
  it's never sent with an id.
- **The logs show every action.** `mise exec -- flyctl logs -a
  comp4020-final-brynmtchll` prints one line per action:
  `name#tag action detail`.

I'd revisit whether a reaction is on your words or beside them. It sits under
the word, but it is still someone else's mark attached to what you said, and
a speaker can't remove reactions to their own words. A moderator would need
three things: a way to remove a word or a person, an identity that survives a
rejoin (the cookie can't), and the per-action log, which already exists.
