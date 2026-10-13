# Harness

> **Draft:** the rules below are the ones `spec/` already enforces, collected
> so the agent works to them. The standards that come from what good means
> for Said are Bryn's to add once README.md argues them.

## Never

- Never send or keep audio. Only words, and numbers about how they were said,
  leave the speaker's browser (`spec/room.test.ts`: "stores words and how they
  were said, and nothing else").
- Never show anyone another person's login id, which is also their cookie.
- Never put what someone said into a page unescaped.
- Never send a stretch of microphone to Whisper that's mostly silence, a
  breath or the room: it invents sentences for them (`src/prosody.ts` spoke()).
- Never say how fast someone spoke: four measures of pace disagreed on real
  speech (`spec/real-voice.test.ts`).

## Every change

- `pnpm check` passes against the running app (start it with
  `node src/server.ts`), including the hearing checked on real recordings in
  `spec/fixtures/`. A change to how speech is heard is tried on real audio,
  not only on tones, before it's accepted.
- Works in the latest Chrome at 1920x1080 and 390x844, with no sideways
  scroll, and on a phone.
- Each person's words stay in their own place, and appear on every other open
  page within a second of leaving their queue.

## Bryn's standards

*To be added: what every page must hold to, derived from README.md's argument.*
