// Your arms and hands, read off your camera beside your face, for the page
// that asks: the room (sent to everyone, with gestures doing emotes) and the
// studio (on your avatar there only). The reading itself happens in a worker
// (hands.ts), so the face keeps its pace; each frame goes to it whenever it's
// free, and a frame that comes while it's busy is skipped. What it sees
// becomes arms and hands (body.ts), smoothed as a face is, and arms not seen
// for a moment go back down rather than freeze.
import { oneEuro } from "./avatar.ts";
import { bodyFrom, type Body, type Seen } from "./body.ts";
import type { FromHands, ToHands } from "./hands.ts";

const LOST_FOR = 600; // ms without seeing an arm before it goes back down

export type HandReader = {
  // a frame of the camera, whenever there's one (skipped while it's busy)
  frame(video: HTMLVideoElement, at: number): void;
  stop(): void;
};

// `ready` once it can read (the models are loaded), `failed` if it can't,
// and for every frame read, the arms (null: none in sight) and what was seen.
export function readHands(on: { ready(): void; failed(why: string): void; read(body: Body | null, seen: Seen): void }): HandReader {
  const worker = new Worker("/js/hands.ts");
  let busy = false;
  let stopped = false;
  let ready = false; // (frames sent before the models are in would go unread)
  let body: Body | null = null;
  let seenAt = 0;
  const steady = new Map<string, (v: number, at: number) => number>();
  // every number in it through its own filter, by where it is in it
  const smooth = (b: Body, at: number): Body => {
    const walk = (o: unknown, path: string): unknown => {
      if (typeof o === "number") {
        if (!steady.has(path)) steady.set(path, oneEuro(1.5, 1));
        return Math.round(steady.get(path)!(o, at) * 100) / 100;
      }
      if (Array.isArray(o)) return o.map((v, i) => walk(v, `${path}.${i}`));
      if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v, `${path}.${k}`)]));
      return o;
    };
    return walk(b, "") as Body;
  };
  worker.onmessage = ({ data }: MessageEvent<FromHands>) => {
    if (stopped) return;
    if ("ready" in data) {
      ready = true;
      return on.ready();
    }
    if ("failed" in data) return on.failed(data.failed);
    busy = false;
    const now = performance.now();
    const read = bodyFrom(data.seen);
    const any = read.left !== null || read.right !== null;
    if (any) seenAt = now;
    body = any ? smooth(read, now / 1000) : now - seenAt > LOST_FOR ? null : body;
    on.read(body, data.seen);
  };
  worker.postMessage({ start: true } satisfies ToHands);
  return {
    async frame(video, at) {
      if (stopped || !ready || busy || video.readyState < 2) return;
      busy = true;
      try {
        const frame = await createImageBitmap(video);
        if (stopped) return frame.close();
        worker.postMessage({ frame, at } satisfies ToHands, [frame]);
      } catch {
        busy = false;
      }
    },
    stop() {
      stopped = true;
      worker.terminate();
      steady.clear();
    },
  };
}
