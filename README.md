# Said

A room where you speak instead of type, and everyone sees how you said it.

## How it works

- **Join** with a name to get a seat and colour. More rooms live at
  `/r/<name>/`.
- **Talk or type.** Whisper transcribes speech in your browser (80 MB, once).
  No audio leaves your device.
- **How it was said shows in the words.** Louder is heavier. Higher sits
  higher. A held vowel repeats ("sooo"). You can retype, delete or add an
  effect to your own words.
- **Your avatar** is a cartoon head you build in the studio. With your camera
  on, it copies your expression, head and hands. Only numbers are sent. Its
  mouth moves with your voice.
- **Walk the 3D room** with W A S D or a tap. Words over a head fade with
  distance. Several conversations run at once. You follow the one you walk
  up to. **Space** (`/r/space/`) does this with words alone.

Use Chrome. A camera is optional.

## What good means here

Said is for small groups talking in one room. Good means four things.

- **Expressive.** How something was said comes through, not just what.
  Following de Lacerda Pataca and Costa (2023), loudness is weight and pitch
  is height. Held vowels repeat their letters. Faces, hands and gestures add
  the rest. De Lacerda Pataca et al. (2023) found deaf and hard-of-hearing
  viewers wanted emotions named. Said leaves them to be inferred instead.
- **Accurate.** The right words, and only words someone said.
- **Efficient.** Small delays. Words arrive about 1.2 s after a phrase ends.
  The room stays smooth with 12 people in it.
- **Customisable.** Features to explore that communicate effectively:
  avatars, word styles, effects, voices and rooms.

## What's checked and what's judged

Checked automatically in `spec/`:

- **Efficient:** a word reaches every other open page within 1 s.
- **Accurate:** noise, breath and silence are never transcribed. Hearing is
  tested on JFK's 1961 inaugural address and CREMA-D actors.
- **Expressive:** loudness, pitch and held vowels are measured correctly on
  known tones. Loud words carry further in the room.
- **Customisable:** every choice comes from a fixed list. Nothing is free
  text.
- **Safe:** only words and numbers are stored. Nobody can speak as or edit
  anyone else. Everything shown is escaped.

Judged by people:

- **My pod tested it at crit 9 (14 Oct).** Their feedback led to face
  mirroring ([`836339c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/836339c)), fuller avatars ([`81d2090`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/81d2090)), a 3D room
  ([`309e650`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/309e650)) and choosing your voice ([`fa34255`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/fa34255)).
- **Expressive:** I judged the avatars with my own face and voice.
- **Accurate:** my own test found room noise becoming words. It's now a check
  ([`7793481`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brynmtchll/commit/7793481)).
- **Efficient:** frame rates were measured with 12 people. Every page was
  judged from screenshots at desktop and phone sizes.

## Sources

- de Lacerda Pataca, C., & Costa, P. D. P. (2023). Hidden bawls, whispers, and
  yelps: can text be made to sound more than just its words? *IEEE
  Transactions on Affective Computing*, 14, 6–16.
  [arXiv:2202.10631](https://arxiv.org/abs/2202.10631)
- de Lacerda Pataca, C., Watkins, M., Peiris, R., Lee, S., & Huenerfauth, M.
  (2023). Visualization of speech prosody and emotion in captions:
  Accessibility for deaf and hard-of-hearing users. *CHI '23*.
- Cao, H. et al. (2014). CREMA-D: Crowd-sourced Emotional Multimodal Actors
  Dataset. *IEEE Transactions on Affective Computing*, 5(4), 377–390.

## What it doesn't do

- **No full transcript.** Lately keeps only the last few lines.
- **No emotion labels.** It shows how something was said. People do the
  reading.
- **No "faster"/"slower".** On 178 acted takes, four pace measures
  disagreed.
- **No games or scores.**
