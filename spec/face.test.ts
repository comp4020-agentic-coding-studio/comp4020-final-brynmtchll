import { describe, expect, it } from "vitest";
import { faceReader, readFace } from "../src/face.ts";

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
