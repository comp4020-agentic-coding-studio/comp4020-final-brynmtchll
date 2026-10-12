import { describe, expect, it } from "vitest";
import { measure } from "../src/prosody.ts";

// What the app hears in a voice, checked on made-up audio whose loudness,
// pitch and timing are known exactly. Real voices are messier; whether the
// result looks like how someone said it is judged by people trying it.
const RATE = 16_000;

// a voice-like tone (a fundamental and four overtones) whose pitch can glide,
// written into a clip at a given time
function tone(clip: Float32Array, from: number, to: number, hz: [number, number], amplitude: number): void {
  let phase = 0;
  const n = Math.round((to - from) * RATE);
  for (let i = 0; i < n; i++) {
    const f = hz[0] + ((hz[1] - hz[0]) * i) / n;
    phase += (2 * Math.PI * f) / RATE;
    let s = 0;
    for (let k = 1; k <= 5; k++) s += Math.sin(k * phase) / k;
    clip[Math.round(from * RATE) + i] = amplitude * s * 0.5;
  }
}

function clip(): Float32Array {
  const c = new Float32Array(RATE * 3.2);
  tone(c, 0.0, 0.5, [150, 150], 0.1); // "one": ordinary
  tone(c, 0.7, 1.2, [150, 150], 0.4); // "two": four times the amplitude, about 12 dB louder
  tone(c, 1.4, 1.9, [180, 300], 0.1); // "six": higher, and rising
  tone(c, 2.0, 3.0, [150, 150], 0.1); // "so": two letters over a whole second
  return c;
}

const words = [
  { w: "one", start: 0.0, end: 0.5 },
  { w: "two", start: 0.7, end: 1.2 },
  { w: "six", start: 1.4, end: 1.9 },
  { w: "so", start: 2.0, end: 3.0 },
];

describe("hearing how a word was said", () => {
  const [one, two, six, so] = measure(clip(), RATE, words);

  it("hears a louder word as louder, by about how much louder it was", () => {
    expect(two.loud - one.loud).toBeGreaterThan(9);
    expect(two.loud - one.loud).toBeLessThan(15);
  });

  it("hears a higher word as higher, and a rising one as rising", () => {
    expect(six.pitch! - one.pitch!).toBeGreaterThan(4);
    expect(six.rise).toBeGreaterThan(4);
    expect(Math.abs(one.rise)).toBeLessThan(1);
  });

  it("hears a drawn-out word as drawn out", () => {
    expect(so.stretch).toBeGreaterThan(1);
    expect(Math.abs(one.stretch)).toBeLessThan(0.5);
  });

  it("measures everything against the rest of the message, so a typical word sits near zero", () => {
    expect(Math.abs(one.loud)).toBeLessThan(1);
    expect(Math.abs(one.pitch!)).toBeLessThan(1);
  });

  it("doesn't count a pause as part of the word before it", () => {
    // Whisper often lets a word run on into the silence after it
    const [late] = measure(clip(), RATE, [{ w: "one", start: 0.0, end: 0.7 }, ...words.slice(1)]);
    expect(Math.abs(late.stretch - one.stretch)).toBeLessThan(0.2);
    expect(Math.abs(late.loud - one.loud)).toBeLessThan(1);
  });

  it("hears nothing in silence, so the words Whisper invents for it never get sent", () => {
    expect(measure(new Float32Array(RATE * 2), RATE, [{ w: "you", start: 0, end: 1 }])).toEqual([]);
  });
});
