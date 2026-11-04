import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ort from "onnxruntime-node";
import { SPEECH_FOR, speechIn, type VadStep } from "../src/vad.ts";

// Is anyone speaking? Checked with the same model as the page (Silero VAD
// v5, MIT; fixtures/silero-vad.onnx) on real speech, and on what Whisper
// would otherwise write sentences for: noise, a hum, a tone held like a
// note. (Locally it was also tried on recordings of piano, singing, a
// crowd, a street, rain, a fan and typing, which can't be kept here.)
const RATE = 16_000;
const fixture = (name: string): string => new URL(`./fixtures/${name}`, import.meta.url).pathname;
function wav(path: string): Float32Array {
  const b = readFileSync(path);
  let at = 12;
  while (b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const data = b.subarray(at + 8, at + 8 + b.readUInt32LE(at + 4));
  const pcm = new Float32Array(data.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = data.readInt16LE(i * 2) / 32768;
  return pcm;
}
const session = ort.InferenceSession.create(fixture("silero-vad.onnx"));
const sr = new ort.Tensor("int64", BigInt64Array.from([16000n]), []);
const step: VadStep<ort.Tensor> = async (input, state) => {
  const out = await (await session).run({ input: new ort.Tensor("float32", input, [1, input.length]), state: state ?? new ort.Tensor("float32", new Float32Array(256), [2, 1, 128]), sr });
  return { p: (out.output.data as Float32Array)[0], state: out.stateN as ort.Tensor };
};
// a little noise, as a room has
let seed = 1;
const noise = (n: number, level: number) => new Float32Array(n).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * level);

describe("hearing whether anyone's speaking", () => {
  it("finds speech in every phrase of real speech, however it was said", async () => {
    const jfk = wav(fixture("jfk-1961.wav"));
    // in phrases of about three seconds, as they'd come
    for (let i = 0; i + RATE * 1.5 <= jfk.length; i += RATE * 3) expect(await speechIn(jfk.slice(i, i + RATE * 3), step), `jfk at ${i / RATE}s`).toBeGreaterThan(SPEECH_FOR * 2);
    for (const take of ["1020_TIE_ANG_XX", "1020_TIE_SAD_XX", "1038_TIE_NEU_XX"]) expect(await speechIn(wav(fixture(`crema-d/${take}.wav`)), step), take).toBeGreaterThan(SPEECH_FOR * 2);
  }, 30_000);

  it("finds none in noise, a hum, or a note held like singing without words", async () => {
    expect(await speechIn(noise(RATE * 3, 0.3), step)).toBeLessThan(SPEECH_FOR);
    const hum = new Float32Array(RATE * 3).map((_, i) => 0.2 * Math.sin((2 * Math.PI * 50 * i) / RATE) + 0.1 * Math.sin((2 * Math.PI * 150 * i) / RATE));
    expect(await speechIn(hum, step)).toBeLessThan(SPEECH_FOR);
    const note = new Float32Array(RATE * 3).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE) * (0.6 + 0.4 * Math.sin(i / RATE)));
    expect(await speechIn(note, step)).toBeLessThan(SPEECH_FOR);
  }, 30_000);

  it("still hears speech with a room's noise under it", async () => {
    const take = wav(fixture("crema-d/1020_TIE_NEU_XX.wav"));
    const room = noise(take.length, 0.05);
    const mixed = take.map((x, i) => x + room[i]);
    expect(await speechIn(mixed, step)).toBeGreaterThan(SPEECH_FOR * 2);
  }, 30_000);
});
