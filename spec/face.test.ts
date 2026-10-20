import { describe, expect, it } from "vitest";
import { faceReader, readFace } from "../src/face.ts";
import { fromShapes } from "../src/avatar.ts";

// Reading an emoji off a face's expression scores, checked on made-up scores.
// Whether those rules match real faces is judged by people trying it.
describe("reading an emoji off a face", () => {
  it("reads a face at rest as nothing", () => {
    expect(readFace({ mouthSmileLeft: 0.05, mouthSmileRight: 0.06, jawOpen: 0.02, browInnerUp: 0.1 })).toBeNull();
  });

  it("tells a laugh from a smile, and a smirk from both", () => {
    expect(readFace({ mouthSmileLeft: 0.7, mouthSmileRight: 0.7 })).toBe("😀");
    expect(readFace({ mouthSmileLeft: 0.7, mouthSmileRight: 0.7, jawOpen: 0.5 })).toBe("😂");
    expect(readFace({ mouthSmileLeft: 0.6, mouthSmileRight: 0.1 })).toBe("😏");
  });

  it("reads surprise, anger and sadness", () => {
    expect(readFace({ browInnerUp: 0.6, browOuterUpLeft: 0.5, browOuterUpRight: 0.5, jawOpen: 0.5 })).toBe("😮");
    expect(readFace({ browDownLeft: 0.6, browDownRight: 0.6 })).toBe("😠");
    expect(readFace({ mouthFrownLeft: 0.5, mouthFrownRight: 0.5 })).toBe("😢");
  });

  it("only shows an expression once it's held, and keeps it through a passing flicker", () => {
    const read = faceReader();
    const smile = { mouthSmileLeft: 0.7, mouthSmileRight: 0.7 };
    expect(read(smile)).toBeNull();
    expect(read(smile)).toBeNull();
    expect(read(smile)).toBe("😀");
    // one neutral frame doesn't clear it
    expect(read({})).toBe("😀");
    expect(read(smile)).toBe("😀");
    // a held rest does
    for (let i = 0; i < 5; i++) read({});
    expect(read({})).toBeNull();
  });
});

describe("an avatar following a face", () => {
  it("reads a broad real smile as a smile, not a scowl", () => {
    // MediaPipe's scores for its own sample portrait, a big grin: a real
    // smile lowers the brows, which once drew the avatar glaring
    const grin = fromShapes({ mouthSmileLeft: 0.96, mouthSmileRight: 0.934, browDownLeft: 0.839, browDownRight: 0.818, eyeSquintLeft: 0.74, jawOpen: 0.12 });
    expect(grin.smile).toBe(1);
    expect(grin.browDown).toBe(0);
  });

  it("still reads brows down without a smile as a glare", () => {
    expect(fromShapes({ browDownLeft: 0.7, browDownRight: 0.7, mouthFrownLeft: 0.3, mouthFrownRight: 0.3 }).browDown).toBeGreaterThan(0.9);
  });

  it("rests at rest", () => {
    const rest = fromShapes({ mouthSmileLeft: 0.05, mouthSmileRight: 0.05, jawOpen: 0.03, browInnerUp: 0.08, eyeBlinkLeft: 0.1 });
    for (const v of Object.values(rest)) expect(v).toBe(0);
  });
});
