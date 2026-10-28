// Reading someone's arms and hands off their camera, in a worker of its own
// so the face, read on the page every frame, keeps its pace. Each frame it's
// sent (whenever it's free: frames that arrive while it's busy are skipped)
// goes through MediaPipe's gesture recogniser (21 points per hand, and what
// each hand is doing) and its pose reader (the body's 33), and what they saw
// goes back as numbers; body.ts makes arms and hands of them on the page.
// On an M4 Pro the pair took 38 ms a frame here, about 15 frames a second,
// while the face read on the page kept to 9 ms.
//
// A classic worker, not a module: MediaPipe loads its runtime with
// importScripts, which a module worker doesn't have. So no imports here; the
// types it shares are written out again.
type Mark = { x: number; y: number; z: number; v?: number };
type Seen = {
  pose: { image: Mark[]; world: Mark[] } | null;
  hands: { side: string; gesture: string; score: number; image: Mark[]; world: Mark[] }[];
};
export type ToHands = { start: true } | { frame: ImageBitmap; at: number };
export type FromHands = { ready: true } | { failed: string } | { seen: Seen; took: number };

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const MODELS = "https://storage.googleapis.com/mediapipe-models";
// about 8 MB and 6 MB, loaded the first time someone turns their hands on
const GESTURE_MODEL = `${MODELS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`;
const POSE_MODEL = `${MODELS}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;

type Reader = { close(): void };
type GestureReader = Reader & {
  recognizeForVideo(
    frame: ImageBitmap,
    at: number,
  ): { landmarks: Mark[][]; worldLandmarks: Mark[][]; handedness: { categoryName: string; score: number }[][]; gestures: { categoryName: string; score: number }[][] };
};
type PoseReader = Reader & { detectForVideo(frame: ImageBitmap, at: number): { landmarks: Mark[][]; worldLandmarks: Mark[][] } };

declare const self: Worker & { importScripts(url: string): void; Vision: Record<string, any> };

let gestures: GestureReader | undefined;
let pose: PoseReader | undefined;
const post = (m: FromHands): void => self.postMessage(m);

// a landmark as plain numbers, rounded (three places is a millimetre)
const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const mark = (m: Mark & { visibility?: number }): Mark => ({ x: r3(m.x), y: r3(m.y), z: r3(m.z), ...(m.visibility !== undefined ? { v: r3(m.visibility) } : {}) });

self.onmessage = async ({ data }: MessageEvent<ToHands>) => {
  if ("start" in data) {
    try {
      self.importScripts(`${VISION}/vision_bundle.js`);
      const { FilesetResolver, GestureRecognizer, PoseLandmarker } = self.Vision;
      const files = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const options = (model: string) => ({ baseOptions: { modelAssetPath: model, delegate: "CPU" }, runningMode: "VIDEO" });
      gestures = await GestureRecognizer.createFromOptions(files, { ...options(GESTURE_MODEL), numHands: 2, minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
      pose = await PoseLandmarker.createFromOptions(files, { ...options(POSE_MODEL), numPoses: 1 });
      post({ ready: true });
    } catch (err) {
      post({ failed: String(err).slice(0, 300) });
    }
    return;
  }
  const { frame, at } = data;
  try {
    if (!gestures || !pose) return;
    const began = performance.now();
    const g = gestures.recognizeForVideo(frame, at);
    const p = pose.detectForVideo(frame, at);
    const seen: Seen = {
      pose: p.landmarks[0] ? { image: p.landmarks[0].map(mark), world: p.worldLandmarks[0].map(mark) } : null,
      hands: g.landmarks.map((l, i) => ({
        side: g.handedness[i]?.[0]?.categoryName ?? "",
        gesture: g.gestures[i]?.[0]?.categoryName ?? "None",
        score: r3(g.gestures[i]?.[0]?.score ?? 0),
        image: l.map(mark),
        world: g.worldLandmarks[i].map(mark),
      })),
    };
    post({ seen, took: Math.round(performance.now() - began) });
  } catch (err) {
    post({ failed: String(err).slice(0, 300) });
  } finally {
    frame.close();
  }
};
