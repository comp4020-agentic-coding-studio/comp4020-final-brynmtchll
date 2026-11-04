// Is anyone speaking in a clip at all? Whisper writes sentences for music,
// traffic, rain and a fan ("Thank you.", "I'm sorry.", "Bye." filled the
// room one evening), and the loudness gate before it (prosody.ts spoke())
// let all of a piano piece through. Silero VAD (v5, 2 MB, MIT), a small
// model that tells a voice from everything else, hears each phrase first
// (worker.ts); with less than SPEECH_FOR of speech in it, Whisper never
// hears it. Tried on real recordings (spec/vad.test.ts, and locally on more):
// it found no speech in piano, street noise, a crowd, rain, a fan or typing,
// and at least half a second in every phrase of real speech. A room of
// people talking is speech to it too: that's what the loudness gate, against
// your own level, is for.
//
// Here only the counting, given whatever runs the model (transformers.js in
// the browser, onnxruntime in the checks).
export const VAD_MODEL = "onnx-community/silero-vad";
export const FRAME = 512; // samples at 16 kHz, 32 ms
const CONTEXT = 64; // samples of the frame before, each frame carries
export const SPEECH_FOR = 0.2; // s
const SPEECH_P = 0.5;

// what the model is given and gives back, each frame: the sound, its memory
// (fed back in next frame) and the rate; how likely speech is, and its memory
export type VadStep<T> = (input: Float32Array, state: T | null) => Promise<{ p: number; state: T }>;

// seconds of speech in a clip at 16 kHz
export async function speechIn<T>(pcm: Float32Array, step: VadStep<T>): Promise<number> {
  let state: T | null = null;
  let speech = 0;
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    const frame = new Float32Array(CONTEXT + FRAME);
    if (i >= CONTEXT) frame.set(pcm.subarray(i - CONTEXT, i), 0);
    frame.set(pcm.subarray(i, i + FRAME), CONTEXT);
    const out = await step(frame, state);
    state = out.state;
    if (out.p > SPEECH_P) speech += FRAME / 16_000;
  }
  return speech;
}
