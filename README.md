# Said

A room where you speak instead of type, and everyone sees how you said it.

> **Draft:** the "What good means here" section below is Bryn's to write. What's
> here so far only describes what the app does.

## How it works

- Pick a name to join. You get a place of your own on the screen, in your own
  colour, which stays put for everyone.
- Turn your microphone on and talk, for as long as you like. Your speech is
  turned into words in your own browser. No audio is sent or kept anywhere.
- Everyone sees your words appear one at a time in your place, as you said
  them, and the rest of what you've said as a thread of text messages
  underneath, newest first. Louder words are heavier, higher ones sit higher,
  and drawn-out sounds repeat their letters ("sooo"). While you're still
  talking, a faded draft of the phrase shows first, then the final words
  replace it.
- Your words go out straight away, and you can change them live: tap one of
  yours (your latest is chosen already) to type over it, delete it, or press
  1, 2 or 3 to make it Impact, Whisper or Glow. Only your own words can be
  changed.
- Everyone has an avatar, a 3D head in a look they choose (colour, eyes,
  mouth, and glasses, shades, a hat, headphones or blush). Its mouth moves
  with your voice as you talk, on everyone's screen, a quarter of a second
  behind you, before your words arrive. It reacts to how each word was said
  (brows up for a high one, eyes wide for a loud one), and its eyes turn to
  whoever is speaking. Turn on "Show my face" and it pulls the faces you
  pull, winks, raises one brow, looks where you look, and turns and leans
  as you do. It learns your face at rest, so a resting frown doesn't show as
  one. Your face and voice are read in your browser and only numbers about
  them are sent: no picture, no sound. Where a browser can't draw 3D, it's
  a flat face instead.
- Make it yours: build your avatar from face shapes, hair styles, brows,
  eyes, noses, ears, beards and things to wear, in any colours (or "Surprise
  me"); choose how your words are drawn (Comic, Neon, Handwritten,
  Typewriter, Big feelings...); put one of eight effects on any of your
  words (keys 1 to 8).
- Emote: your head nods, laughs, sends hearts or a rain cloud, for everyone
  (buttons, or Shift and a letter); a big laugh or a held gasp emotes by
  itself. Tap someone else's word to react to it.
- What's on offer is data, in `src/packs.ts`: adding a hair style, an
  effect, a word style, an emote or a reaction is adding an entry there.
- Under the stage, a short record of what's been said lately, each person's
  words joined into lines in their colour, so someone arriving can catch up.

The first time you join, your browser downloads the speech model (about 80 MB)
before you can talk; after that it's cached. Chrome is recommended.

## What good means here

*To be written by Bryn: who this is for, what it should do well, and why,
argued from sources.*

## What's checked and what's judged

Checked automatically in `spec/`:

- What one person says reaches every other open page within a second, without
  a reload, and several people speaking at once each stay in their own place.
- Only words and numbers about how they were said are stored; nothing else
  (audio included) can be sent along. A face is only ever a handful of
  numbers for its expression and where the head is, and a voice only a few
  loudness levels; which way round a wink, a glance and a head's turn go is
  checked on MediaPipe's own sample portrait with an eye painted shut, its
  irises moved and the picture tilted and shifted.
- A word is never split between two phrases, and the room's background noise,
  breaths and silence are never sent to be transcribed.
- How loud, high and drawn-out words were is measured on made-up tones whose
  answers are known, on John F. Kennedy's 1961 inaugural address, and on
  actors from CREMA-D saying the same sentence in different moods.
- Everyone gets a place and colour of their own, the same on every page.
- What people say is escaped, and nobody's login id is ever shown to anyone
  else.

Judged by people:

*To be written by Bryn.*

## Sources

*To be completed by Bryn.* Candidates found while building:

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

- It only shows the last few lines of what's been said, not everything.
- It doesn't name emotions. It shows how something was said and leaves the
  reading to people.
- It doesn't say "faster" or "slower": tested on 178 acted takes, four ways
  of measuring pace disagreed with each other.
