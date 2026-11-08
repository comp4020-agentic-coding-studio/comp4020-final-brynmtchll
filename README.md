# Said

A room where you speak instead of type, and everyone sees how you said it.

## How it works

- **Join** with a name to get a seat and colour, the same on every screen.
  More rooms live at `/r/<name>/`.
- **Talk or type.** Whisper transcribes speech in your browser (80 MB on first
  join, then cached). No audio leaves your device.
- **How it was said shows in the words.** Louder is heavier, higher sits
  higher, and a held vowel repeats ("sooo"). Others see each word about 1.2 s
  after you finish. You can retype, delete or add an effect (keys 1–8) to your
  own words, and only yours.
- **Your avatar** is a cartoon head you build in the studio. With your camera
  on, it copies your expression, head and hands; only numbers are sent. Its
  mouth moves with your voice.
- **Walk the 3D room** (W A S D or tap). Words over a head are clear up close
  and fade with distance; loud words carry further. Several conversations run
  at once, and you follow the one you walk up to. **Space** (`/r/space/`) does
  this with words alone.
- **Also:** emotes, reactions, raising a hand to speak next, voices that read
  others' words aloud, and Lately, so a newcomer can catch up.

Use Chrome. A camera is optional.

## What good means here

*To be written by Brynly: who this is for, what it should do well, and why,
argued from sources.*

## What's checked and what's judged

Checked automatically in `spec/`:

- **Real-time:** a word reaches every other open page within 1 s, without a
  reload.
- **Privacy:** only words and numbers are stored. Audio and face images can't
  be sent.
- **Permissions:** nobody can speak as, or edit, anyone else.
- **Hearing:** noise, breath and silence are never transcribed. Loudness,
  pitch and held vowels are measured correctly on test tones, JFK's 1961
  inaugural address, and CREMA-D actors.
- **Distance:** what's said is readable within a set distance, further for
  loud words.
- **Security:** everything shown is escaped, and nobody's login id is ever
  sent to others.

Judged by people:

*To be written by Brynly.*

## Sources

*To be completed by Brynly.* Candidates found while building:

- de Lacerda Pataca, C., & Costa, P. D. P. (2023). Hidden bawls, whispers, and
  yelps: can text be made to sound more than just its words? *IEEE
  Transactions on Affective Computing*, 14, 6–16.
  [arXiv:2202.10631](https://arxiv.org/abs/2202.10631)
- de Lacerda Pataca, C., Watkins, M., Peiris, R., Lee, S., & Huenerfauth, M.
  (2023). Visualization of speech prosody and emotion in captions:
  Accessibility for deaf and hard-of-hearing users. *CHI '23*.
- Caption Royale: Exploring the design space of affective captions from the
  perspective of deaf and hard-of-hearing individuals. *CHI '24*.
  [doi:10.1145/3613904.3642258](https://dl.acm.org/doi/10.1145/3613904.3642258)
- Google, [Expressive Captions](https://blog.google/products-and-platforms/platforms/android/google-android-expressive-captions/)
  (December 2024).
- Cao, H. et al. (2014). CREMA-D: Crowd-sourced Emotional Multimodal Actors
  Dataset. *IEEE Transactions on Affective Computing*, 5(4), 377–390.

## What it doesn't do

- **No full transcript.** Lately keeps only the last few lines.
- **No emotion labels.** It shows how something was said and leaves the
  reading to people.
- **No "faster"/"slower".** On 178 acted takes, four pace measures
  disagreed.
- **No games or scores.**
