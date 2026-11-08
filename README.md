# Said

A room where you speak instead of type, and everyone sees how you said it.

## How it works

- **Join** with a name. You get a seat and a colour. Both are the same on
  every screen. More rooms live at `/r/<name>/`.
- **Talk or type.** Whisper transcribes speech in your browser. It's an 80 MB
  download on first join, then cached. No audio leaves your device.
- **How it was said shows in the words.** Louder is heavier. Higher sits
  higher. A held vowel repeats ("sooo"). Others see each word about 1.2 s
  after you finish. You can retype or delete your own words, or add an effect
  (keys 1–8). Nobody else can.
- **Your avatar** is a cartoon head you build in the studio. With your camera
  on, it copies your expression, head and hands. Only numbers are sent. Its
  mouth moves with your voice.
- **Walk the 3D room** with W A S D or a tap. Words over a head are clear up
  close. They fade with distance. Loud words carry further. Several
  conversations run at once. You follow the one you walk up to. **Space**
  (`/r/space/`) does this with words alone.

Use Chrome. A camera is optional.

## What good means here

*To be written by Brynly: who this is for, what it should do well, and why,
argued from sources.*

## What's checked and what's judged

Checked automatically in `spec/`:

- **Real-time:** a word reaches every other open page within 1 s. No reload
  is needed.
- **Privacy:** only words and numbers are stored. Audio and face images
  can't be sent.
- **Permissions:** nobody can speak as anyone else. Nobody can edit anyone
  else's words.
- **Hearing:** noise, breath and silence are never transcribed. Loudness,
  pitch and held vowels are tested on tones, JFK's 1961 inaugural address and
  CREMA-D actors.
- **Distance:** words are readable within a set distance. Loud words reach
  further.
- **Security:** everything shown is escaped. Login ids are never sent to
  others.

Judged by people:

*To be written by Brynly.*

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
