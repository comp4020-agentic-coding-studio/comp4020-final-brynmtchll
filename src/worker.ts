// Whisper, run in a worker so the page stays responsive while it listens back.
// transformers.js comes from the CDN at a pinned version and the model from
// Hugging Face; the browser caches both after the first visit. The
// "_timestamped" export of the model is the one that can say when each word
// starts and ends, which everything about how a word was said depends on.
// It's base rather than tiny: tiny is half the download (41 MB to 77 MB) but
// placed words up to a second late on a test clip, often in the pause after
// them, and base got their starts right.
// @ts-expect-error: a URL import the type checker can't follow
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";

export type Chunk = { text: string; timestamp: [number, number | null] };
export type FromWorker =
  | { type: "loading"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "heard"; chunks: Chunk[] }
  | { type: "failed"; error: string };
export type ToWorker = { type: "load" } | { type: "transcribe"; pcm: Float32Array };

type Asr = (pcm: Float32Array, options: { return_timestamps: "word" }) => Promise<{ text: string; chunks: Chunk[] }>;
type Progress = { status: string; file?: string; loaded?: number; total?: number };

const MODEL = "onnx-community/whisper-base.en_timestamped";
const scope = self as unknown as { postMessage(m: FromWorker): void; onmessage: ((e: MessageEvent<ToWorker>) => void) | null };

// download progress across every file the model needs, reported as one total
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
  scope.postMessage({ type: "loading", loaded, total });
};

let asr: Promise<Asr> | undefined;
const load = (): Promise<Asr> =>
  (asr ??= pipeline("automatic-speech-recognition", MODEL, { dtype: "q8", device: "wasm", progress_callback: progress }) as Promise<Asr>);

// Messages are handled in order, so a clip sent while the model is still
// downloading waits for it rather than failing.
scope.onmessage = async (e) => {
  try {
    const run = await load();
    if (e.data.type === "load") return scope.postMessage({ type: "ready" });
    const out = await run(e.data.pcm, { return_timestamps: "word" });
    scope.postMessage({ type: "heard", chunks: out.chunks });
  } catch (err) {
    asr = undefined;
    scope.postMessage({ type: "failed", error: String(err) });
  }
};
