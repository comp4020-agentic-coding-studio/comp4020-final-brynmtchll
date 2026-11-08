# 2. Who can see and change what: anyone can watch; only you change what's yours

## Status

Accepted 21 October 2026 (crit 10). Extended 8 November for rooms.

## Context

A word in Said carries how it was said, so editing someone's word changes
what they appear to have said and how. Crit 10 requires the server to enforce
who may see and change what.

A person is:
- **a chosen name**
- **a random id in an HttpOnly cookie**, which page scripts can't read. It's
  never shown to anyone. Logs show `name#tag` instead
  ([`e0386ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e0386ef)).

Name plus cookie was Claude's choice in the first build. The decisions log
lists it as one for Brynly to own.

> *Brynly: what "good" asks of permissions in a room like this.*

## Options

### Identity

| Option | Gain | Cost |
|---|---|---|
| Accounts with passwords | Identity survives a cleared browser | A sign-up before anyone can speak; a barrier at a walk-up showcase |
| **Name + cookie** (chosen) | No sign-up | Clearing your cookies makes you a new person, and your old name can't be recovered |
| Fully anonymous | Nothing to identify you | You can't tell who said what, in a room built on each person having a place |

### What others may do to your words

| Option | Effect |
|---|---|
| Nothing | Your words are only ever yours |
| **React** (chosen, 20 Oct) | A reaction belongs to the reactor and sits under your word. The word is unchanged. |
| Edit, annotate or remove | Others can change what you appear to have said |

## Decision

**Anyone can watch. Joining lets you speak. Only you can change what's
yours. Anyone who has joined can react to any word.**

Where this came from:

- **Brynly asked for live editing** ("options to modify text be done live
  without a buffer", 20 Oct). That forced the question of whose words a
  person may edit
  ([`0102513`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/0102513)).
- **Identity comes from the cookie alone.** A name sent in a request is
  ignored
  ([`f08fca8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/f08fca8)).
- **Reactions came with "really maximise expressiveness"** (20 Oct;
  [`2a52afe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/2a52afe)).
  Letting anyone react to any word was Claude's call. It's flagged for Brynly
  to own.

| | Anyone with the URL | Joined | Only the person |
|---|---|---|---|
| Watch and read | yes | yes | |
| Speak or type | | yes | |
| Edit, add an effect to, or delete a word | | | own words |
| Face, hands, voice level, head turn, position | | | own avatar |
| Avatar, word style, voice | | | own |
| Emote, raise hand | | | own |
| React to a word | | any word, one reaction each | |
| Rename a room or change its look | | | the room's maker |

What the server refuses:

| Request | Response |
|---|---|
| Anything from someone who hasn't joined | 401 |
| An edit to someone else's words | 403, logged `refused why="not-theirs"` |
| Anything not on offer in `src/packs.ts` | 400, logged |
| Too many requests too fast | 429 |

> *Brynly: why cookie over accounts, and reactions over strict ownership.*

## Consequences

- **Joining is one step, typing a name.** Markers and showcase visitors get
  in from the URL alone.
- **Identity is fragile.** A cleared browser loses it for good, and
  there's no way to moderate someone who rejoins under a new name.
- **Nobody can put words in your mouth.** Checked against the running app in
  `spec/room.test.ts`:
  - "credits what's said to whoever's cookie sent it"
  - "refuses a change to anyone else's words"
  - "lets anyone react to anyone's word…"
- **A reaction is someone else's mark next to your words.** It sits under
  the word, not on it.
- **Rooms (8 Nov).** Only a room's maker can change it, and only to looks on
  offer. The maker is never sent by id. What's said stays in its room
  ([`a15b5d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/a15b5d9);
  `spec/room.test.ts`, "lets only whoever made a room change it, and only to
  looks on offer").
- **Position is held in memory only.** It's never stored or logged, and never
  sent with an id in Space.
- **Visible in the logs.** `mise exec -- flyctl logs -a
  comp4020-final-brynmtchll` prints one line per action: `name#tag action
  detail`.

> *Brynly: what you'd revisit (is a reaction on your words or beside them;
> what a moderator would need).*
