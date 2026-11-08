// Hearing what's said as tones, not words: each word a short soft note, made
// here in the browser from the numbers of how it was said (no voice, no
// sound from anyone). Higher said, higher the note; louder said, and nearer
// you, louder the note; drawn out, held. A phrase plays at the pace it was
// said. So a laugh across Space is a bright quick run, and a sigh beside you
// a low long one, and you can hear who's excited without reading anyone.
// Off until someone turns it on.
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const BASE = 220; // a note for a word said at its speaker's usual pitch
// the notes a word lands on: a pentatonic scale, so any run of them sounds
// like it belongs together
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function tonesOn(yes: boolean): void {
  if (!yes) {
    void ctx?.close();
    ctx = out = null;
    return;
  }
  ctx ??= new AudioContext();
  void ctx.resume();
  out = ctx.createGain();
  out.gain.value = 0.18;
  out.connect(ctx.destination);
}
export const tonesAreOn = (): boolean => !!ctx;

// semitones above the speaker's usual, onto the scale
const noteOf = (pitch: number): number => {
  const step = Math.max(0, Math.min(SCALE.length - 1, Math.round(4 + pitch / 2.5)));
  return BASE * 2 ** (SCALE[step] / 12);
};

export type Note = { t: number; d: number; loud: number; pitch: number; stretch: number };
// Play a phrase's words, at `near` (0 to 1, how clear it is from where you
// are) and with the speaker's colour as a slight difference in tone, so two
// people talking at once can be told apart.
export function play(words: Note[], near: number, hue: number): void {
  if (!ctx || !out || near <= 0.02 || !words.length) return;
  const c = ctx;
  const t0 = c.currentTime + 0.05;
  const first = words[0].t;
  const pan = c.createStereoPanner();
  pan.pan.value = Math.sin((hue / 360) * Math.PI * 2) * 0.5;
  pan.connect(out);
  for (const w of words) {
    const at = t0 + Math.min(8, Math.max(0, w.t - first));
    const len = Math.min(1.6, Math.max(0.09, w.d * 0.8 + w.stretch * 0.25));
    const vol = Math.min(1, Math.max(0.15, 0.55 + w.loud / 14)) * near;
    const osc = c.createOscillator();
    osc.type = hue % 120 < 60 ? "sine" : "triangle";
    osc.frequency.value = noteOf(w.pitch);
    const env = c.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(vol, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, at + len);
    osc.connect(env).connect(pan);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
}
