// Reading an emoji off someone's face, from the expression scores ("blend
// shapes", 0 to 1) MediaPipe's face landmarker gives for each frame of their
// camera. Only the emoji ever leaves their browser: no picture, no scores.
// Kept apart from the page so the rules can be checked without a camera.

export const FACES = ["😀", "😂", "😮", "😠", "😢", "😏"] as const;
export type Face = (typeof FACES)[number];

// the scores this reads, by MediaPipe's names for them
export type Shapes = Partial<Record<string, number>>;

const avg = (s: Shapes, ...names: string[]): number => names.reduce((n, k) => n + (s[k] ?? 0), 0) / names.length;

// One frame's expression, or null for a face at rest. Each rule wants a
// clear signal (most blend shapes idle around 0.0 to 0.2 on a resting face),
// and they're tried strongest first, so a laugh isn't read as just a smile.
export function readFace(s: Shapes): Face | null {
  const smile = avg(s, "mouthSmileLeft", "mouthSmileRight");
  const jaw = s.jawOpen ?? 0;
  const browUp = avg(s, "browInnerUp", "browOuterUpLeft", "browOuterUpRight");
  const browDown = avg(s, "browDownLeft", "browDownRight");
  const frown = avg(s, "mouthFrownLeft", "mouthFrownRight");
  const lopsided = Math.abs((s.mouthSmileLeft ?? 0) - (s.mouthSmileRight ?? 0));

  if (smile > 0.5 && jaw > 0.3) return "😂";
  if (browUp > 0.4 && jaw > 0.35 && smile < 0.3) return "😮";
  if (browDown > 0.4 && smile < 0.2) return "😠";
  if (lopsided > 0.3 && smile > 0.25) return "😏";
  if (smile > 0.45) return "😀";
  if (frown > 0.3 && smile < 0.15) return "😢";
  return null;
}

// Expressions flicker frame to frame, so one only counts once it's held for
// STEADY readings in a row, and stays until another is; a face at rest
// clears it after REST readings, so a fleeting neutral frame doesn't.
const STEADY = 3;
const REST = 6;

export function faceReader(): (s: Shapes) => Face | null {
  let shown: Face | null = null;
  let candidate: Face | null = null;
  let run = 0;
  return (s) => {
    const now = readFace(s);
    if (now === candidate) run++;
    else {
      candidate = now;
      run = 1;
    }
    if (candidate !== null && run >= STEADY) shown = candidate;
    if (candidate === null && run >= REST) shown = null;
    return shown;
  };
}
