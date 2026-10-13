# 1. [Title: the decision about how Said behaves with several people in it]

> **Draft:** this is crit 9's required decision record, and it's Bryn's to
> write. The headings follow the architecture decision record form the brief
> suggests. The facts below are what the app currently does, to argue from.

## Status

Accepted, 14 October 2026.

## Context

*Bryn: what's the situation, and what does good (README.md) ask of it?*

Facts that may be relevant:

- Everyone has a fixed place and colour on the stage, by join order, the
  same on every page ([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c),
  [`ae57f14`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/ae57f14)).
- Several people can speak at once; each person's words stay in their own
  place, and a phrase that arrives while their last is playing waits its turn.
- A speaker's words wait in a queue on their own screen and go out at the
  pace they were said, a second behind; they can change, delete or add an
  effect to the next one first ([`5d51566`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/5d51566),
  [`e9e6e80`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/e9e6e80)).
- There's no log: a page shows what's said from when it opened
  ([`9c6113c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/9c6113c)).

## Options considered

*Bryn: at least two, including the one your pod will argue for.*

1. ...
2. ...

## Decision

*Bryn: which, and why it serves good better than the others.*

## Consequences

*Bryn: what it costs, and who loses out.*
