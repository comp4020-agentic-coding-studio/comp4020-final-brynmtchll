// Kokoro, a small neural voice (82M, Apache-2.0), run in a worker so the page
// keeps moving while it speaks: natural voices, the same on every device,
// for anyone who turns them on (speech.ts). Like Whisper, transformers.js
// comes from the CDN at the same pinned version, the model from Hugging
// Face, and the browser keeps both after the first time.
//
// Which build, measured in Chrome on an M4 Pro, in the room with Whisper
// downloading beside it: on the GPU (WebGPU) the full-size model, 326 MB,
// makes a phrase in a quarter of a second, so it's heard under a second
// after it's said (the half-size ones there came out silent). Anywhere else
// the 8-bit one on the CPU, 92 MB, two and a half to three and a half
// seconds a phrase: a little behind someone talking on. So the GPU one
// where the graphics can run it, unless someone asks for the smaller.
// @ts-expect-error: a URL import the type checker can't follow
import { AutoTokenizer, StyleTextToSpeech2Model, Tensor } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";
// @ts-expect-error: a URL import the type checker can't follow
import { phonemize } from "https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/+esm";
import { fixSounds, normalise, pieces, shareOut, STYLE, styleAt, trim, wordSpans } from "./kokoro-text.ts";

export const RATE = 24_000;
export type Build = "small" | "fast";
// A phrase to say, whole: its words (punctuation and all), in which voice,
// how fast (1 as the voice is). What comes back is the sound, the quiet
// either side trimmed off, and where each word is in it (seconds), so a word
// that stood out can be made to stand out in it (speech.ts).
export type Phrase = { words: string[]; voice: string; speed: number };
export type ToKokoro = { type: "load"; build: Build } | { type: "say"; id: number; phrase: Phrase };
export type FromKokoro =
  | { type: "loading"; loaded: number; total: number; build: Build }
  | { type: "ready"; build: Build }
  | { type: "said"; id: number; audio: Float32Array; spans: [number, number][] }
  | { type: "failed"; id: number | null; error: string };

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const scope = self as unknown as { postMessage(m: FromKokoro, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<ToKokoro>) => void) | null };

type Progress = { status: string; file?: string; loaded?: number; total?: number };
const files = new Map<string, { loaded: number; total: number }>();
const progress = (p: Progress): void => {
  if (p.status !== "progress" || !p.file) return;
  files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
  let loaded = 0;
  let total = 0;
  for (const f of files.values()) {
    loaded += f.loaded;
    total += f.total;
  }
  scope.postMessage({ type: "loading", loaded, total, build: loading });
};
let loading: Build = "small";

type Model = (inputs: Record<string, unknown>) => Promise<{ waveform: { data: Float32Array } }>;
type Tokenizer = (text: string, o: { truncation: boolean }) => { input_ids: { dims: number[] } };
let loaded: Promise<{ model: Model; tokenizer: Tokenizer; build: Build }> | undefined;
async function gpuWorks(): Promise<boolean> {
  try {
    return !!(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter());
  } catch {
    return false;
  }
}
// (the GPU build where it's asked for and the graphics can run it, and the
// small one if it can't after all)
const load = (build: Build) =>
  (loaded ??= (async () => {
    const tokenizer = AutoTokenizer.from_pretrained(MODEL, { progress_callback: progress });
    const of = (fast: boolean) => StyleTextToSpeech2Model.from_pretrained(MODEL, { device: fast ? "webgpu" : "wasm", dtype: fast ? "fp32" : "q8", progress_callback: progress });
    let fast = build === "fast" && (await gpuWorks());
    loading = fast ? "fast" : "small";
    let model: Model;
    try {
      model = await of(fast);
    } catch (err) {
      if (!fast) throw err;
      files.clear();
      fast = false;
      loading = "small";
      model = await of(false);
    }
    return { model, tokenizer: await tokenizer, build: fast ? "fast" : "small" } as { model: Model; tokenizer: Tokenizer; build: Build };
  })());

// Each voice's styles (half a megabyte), fetched the first time it's used
// and kept, here and in the browser's cache. A fetch that hangs is given up
// on and tried again, twice, rather than holding up every phrase after it.
const voices = new Map<string, Promise<Float32Array>>();
const VOICE_ID = /^[ab][fm]_[a-z]+$/;
const CACHE = "said-kokoro-voices";
async function fetchVoice(id: string): Promise<Float32Array> {
  const url = `https://huggingface.co/${MODEL}/resolve/main/voices/${id}.bin`;
  const cache = await caches.open(CACHE).catch(() => null);
  const kept = await cache?.match(url);
  if (kept) return new Float32Array(await kept.arrayBuffer());
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`voice ${id}: ${r.status}`);
      const bytes = await r.arrayBuffer();
      await cache?.put(url, new Response(bytes)).catch(() => {});
      return new Float32Array(bytes);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}
function styles(id: string): Promise<Float32Array> {
  if (!VOICE_ID.test(id)) id = "af_heart";
  if (!voices.has(id)) {
    const p = fetchVoice(id);
    voices.set(id, p);
    p.catch(() => voices.delete(id));
  }
  return voices.get(id)!;
}

async function sounds(text: string, american: boolean): Promise<string> {
  const parts = pieces(normalise(text));
  const said = await Promise.all(parts.map(async (p) => (p.say ? ((await phonemize(p.text, american ? "en-us" : "en")) as string[]).join(" ") : p.text)));
  return fixSounds(said.join(""), american);
}

// The longest stretch the model says at once, in its own tokens (it takes
// 510): a phrase longer than that is said a sentence or so at a time.
const MOST = 400;
async function sayPart(words: string[], voice: string, speed: number): Promise<{ audio: Float32Array; spans: [number, number][] }> {
  const { model, tokenizer } = await load("small");
  const ph = await sounds(words.join(" "), voice[0] === "a");
  if (!ph) return { audio: new Float32Array(0), spans: words.map(() => [0, 0]) };
  const { input_ids } = tokenizer(ph, { truncation: true });
  const all = await styles(voice);
  const at = styleAt(input_ids.dims.at(-1)!);
  const style = all.slice(at, at + STYLE);
  const { waveform } = await model({ input_ids, style: new Tensor("float32", style, [1, STYLE]), speed: new Tensor("float32", [Math.min(2, Math.max(0.5, speed))], [1]) });
  const audio = trim(waveform.data, RATE);
  return { audio, spans: wordSpans(audio, RATE, shareOut(words, ph)) };
}
async function say(phrase: Phrase): Promise<{ audio: Float32Array; spans: [number, number][] }> {
  const voice = VOICE_ID.test(phrase.voice) ? phrase.voice : "af_heart";
  // (cut after a sentence's end, or anywhere, once a part's too long)
  const parts: string[][] = [[]];
  let letters = 0;
  for (const w of phrase.words) {
    parts.at(-1)!.push(w);
    letters += w.length + 1;
    if (letters > MOST / 2 && (/[.!?…]$/.test(w) || letters > MOST)) {
      parts.push([]);
      letters = 0;
    }
  }
  const made = await Promise.all(parts.filter((p) => p.length).map((p) => sayPart(p, voice, phrase.speed)));
  const gap = Math.round(RATE * 0.25);
  const audio = new Float32Array(made.reduce((a, m) => a + m.audio.length, 0) + gap * (made.length - 1));
  const spans: [number, number][] = [];
  let at = 0;
  for (const m of made) {
    audio.set(m.audio, at);
    for (const [a, b] of m.spans) spans.push([a + at / RATE, b + at / RATE]);
    at += m.audio.length + gap;
  }
  return { audio, spans };
}

// One phrase at a time, in the order asked, each run of it in turn.
let queue: Promise<void> = Promise.resolve();
scope.onmessage = (e) => {
  const m = e.data;
  queue = queue.then(async () => {
    try {
      if (m.type === "load") {
        let { build } = await load(m.build);
        // The first phrase takes seconds longer than the rest (the model
        // settling in): one said now, unheard, so the first heard isn't late
        // (but not waited on for long: ready is ready). If what comes out of
        // the GPU build is silence (the half-size ones were, on the GPU it
        // was measured on), the small one is used instead.
        // (each length of phrase is new to the GPU the first time: a short,
        // a middling and a long one, so most phrases after are quick)
        const hello = async (): Promise<unknown> => {
          let first: unknown = null;
          for (const words of [["Hello", "there,", "how", "are", "you?"], ["Okay."], ["So", "I", "was", "thinking", "we", "could", "maybe", "get", "some", "lunch", "together", "tomorrow,", "what", "do", "you", "reckon?"]]) {
            const r = await Promise.race([say({ words, voice: "af_heart", speed: 1 }).catch(() => null), new Promise((r) => setTimeout(r, 20_000, "slow"))]);
            first ??= r;
            if (r === "slow" || !r) break;
          }
          return first;
        };
        const heard = await hello();
        if (build === "fast" && heard !== "slow" && !(heard as { audio?: Float32Array } | null)?.audio?.length) {
          loaded = undefined;
          files.clear();
          build = (await load("small")).build;
          await hello();
        }
        return scope.postMessage({ type: "ready", build });
      }
      const { audio, spans } = await say(m.phrase);
      scope.postMessage({ type: "said", id: m.id, audio, spans }, [audio.buffer]);
    } catch (err) {
      if (m.type === "load") loaded = undefined;
      scope.postMessage({ type: "failed", id: m.type === "say" ? m.id : null, error: String(err) });
    }
  });
};
