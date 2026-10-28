import { describe, expect, it } from "vitest";
import { faceReader, readFace } from "../src/face.ts";
import { JSDOM } from "jsdom";
import { avatarSvg, cleanExpression, cleanPose, fromShapes, oneEuro, poseFrom, resting } from "../src/avatar.ts";
import { lookFor } from "../src/packs.ts";

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

  // MediaPipe names sides as the person's own; drawn in a mirror, their left
  // is the screen's left (-). Its own sample portrait with the eye on the
  // picture's left painted shut scored eyeBlinkRight 0.6, eyeBlinkLeft 0.34.
  it("tells a wink from a blink, on the side it's drawn", () => {
    const wink = fromShapes({ eyeBlinkLeft: 0.341, eyeBlinkRight: 0.595 });
    expect(wink.wink).toBeGreaterThan(0.2);
    expect(wink.blink).toBe(0);
    const blink = fromShapes({ eyeBlinkLeft: 0.8, eyeBlinkRight: 0.78 });
    expect(blink.blink).toBe(1);
    expect(blink.wink).toBe(0);
  });

  // the same portrait with both irises moved toward the picture's right (the
  // screen's left, in the mirror), then its left
  it("follows where the eyes look, the way they look in the mirror", () => {
    const toScreenLeft = fromShapes({ eyeLookInLeft: 0.008, eyeLookInRight: 0.402, eyeLookOutLeft: 0.397, eyeLookOutRight: 0.015 });
    const toScreenRight = fromShapes({ eyeLookInLeft: 0.148, eyeLookInRight: 0.026, eyeLookOutLeft: 0.052, eyeLookOutRight: 0.247 });
    expect(toScreenLeft.lookX).toBeLessThan(-0.5);
    expect(toScreenRight.lookX).toBeGreaterThan(0.2);
  });

  it("reads a smirk and one brow raised on their side, and puffed cheeks and a sneer", () => {
    const e = fromShapes({ mouthSmileLeft: 0.6, mouthSmileRight: 0.05, browOuterUpRight: 0.6, cheekPuff: 0.7, noseSneerLeft: 0.6, noseSneerRight: 0.6 });
    expect(e.smirk).toBeLessThan(-0.9);
    expect(e.brow).toBeGreaterThan(0.9);
    expect(e.puff).toBe(1);
    expect(e.sneer).toBe(1);
  });

  it("takes someone's own resting face off, so a face that rests a little frowny rests", () => {
    const frowny = { mouthFrownLeft: 0.3, mouthFrownRight: 0.3, mouthPressLeft: 0.25, mouthPressRight: 0.25, browDownLeft: 0.3, browDownRight: 0.3 };
    expect(fromShapes(frowny).frown).toBeGreaterThan(0.4);
    const learn = resting();
    for (let i = 0; i < 60; i++) learn.add(frowny);
    // a few seconds of a big smile don't become their rest
    for (let i = 0; i < 20; i++) learn.add({ ...frowny, mouthSmileLeft: 0.9, mouthSmileRight: 0.9 });
    const rest = learn.rest();
    expect(fromShapes(frowny, rest).frown).toBe(0);
    expect(fromShapes(frowny, rest).browDown).toBe(0);
    expect(fromShapes({ ...frowny, mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }, rest).smile).toBeGreaterThan(0.9);
  });

  it("keeps each number of a face as sent within its range, and nothing else", () => {
    const e = cleanExpression({ smile: 2, wink: -5, lookX: 0.4, picture: "data:," })!;
    expect(e.smile).toBe(1);
    expect(e.wink).toBe(-1);
    expect(e.lookX).toBe(0.4);
    expect(e).not.toHaveProperty("picture");
  });
});

describe("holding a face steady without lagging behind it", () => {
  it("smooths jitter on a held face, and follows a quick move closely", () => {
    const f = oneEuro(1.2, 0.6);
    // held still, jittering by 0.1 either side, 30 times a second (once
    // it's settled: it starts from the first reading, itself 0.1 out)
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      const v = f(0.5 + (i % 2 ? 0.1 : -0.1), i / 30);
      if (i >= 15) worst = Math.max(worst, Math.abs(v - 0.5));
    }
    expect(worst).toBeLessThan(0.05);
    // then a smile in a tenth of a second: within a fifth of the way after
    // a fifth of a second
    const g = oneEuro(1.2, 0.6);
    for (let i = 0; i < 30; i++) g(0, i / 30);
    let v = 0;
    for (let i = 0; i < 7; i++) v = g(Math.min(1, i / 3), (30 + i) / 30);
    expect(v).toBeGreaterThan(0.8);
  });
});

describe("a head turning", () => {
  // MediaPipe's matrices for its own sample portrait, as it is and turned
  // 0.35 radians clockwise in the picture
  const upright = [0.999, 0.015, -0.031, 0, -0.013, 0.998, 0.068, 0, 0.032, -0.067, 0.997, 0, -0.412, 22.464, -65.446, 1];
  const tilted = [0.946, -0.322, -0.04, 0, 0.324, 0.944, 0.057, 0, 0.019, -0.066, 0.998, 0, 7.401, 21.625, -66.753, 1];

  it("reads a face looking at the camera as near enough still", () => {
    for (const v of Object.values(poseFrom(upright))) expect(Math.abs(v)).toBeLessThan(0.1);
  });

  it("reads a head tilted in the picture as that tilt, mirrored, and nothing else", () => {
    const p = poseFrom(tilted);
    // clockwise as the camera sees it, so anticlockwise in the mirror
    expect(p.roll).toBeCloseTo(0.33, 1);
    expect(Math.abs(p.pitch)).toBeLessThan(0.1);
    expect(Math.abs(p.yaw)).toBeLessThan(0.1);
  });

  it("keeps a turn within a head's reach, as its numbers and nothing else", () => {
    expect(cleanPose({ pitch: 3, yaw: -9, roll: "left", z: 4, picture: "data:image/png;base64,AAAA" })).toEqual({ pitch: 0.5, yaw: -0.7, roll: 0, x: 0, y: 0, z: 1 });
    expect(cleanPose("a picture")).toBeNull();
  });

  // the portrait moved 120 px to the picture's right in a 640 px frame, and
  // made 1.3 times bigger (nearer): MediaPipe's matrix moved 23 cm across
  // and 17 cm nearer
  it("moves the head as its owner moves about, mirrored, and leans it in as they come nearer", () => {
    const at = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    const home = { pitch: 0, yaw: 0, roll: 0, x: -0.4, y: 22.8, z: -78.5 };
    expect(poseFrom(at(22.6, 22.7, -78.2), home).x).toBe(-1);
    expect(poseFrom(at(-0.5, 22.9, -61.5), home).z).toBe(1);
    // a head facing a camera that's below the screen faces the screen
    const tilted = [1, 0, 0, 0, 0, 0.98, -0.2, 0, 0, 0.2, 0.98, 0, 0, 0, -60, 1];
    const usual = { pitch: Math.atan2(-0.2, 0.98), yaw: 0, roll: 0, x: 0, y: 0, z: -60 };
    expect(poseFrom(tilted, usual).pitch).toBe(0);
  });
});

describe("an avatar's name", () => {
  it("is only ever its words, whatever characters a name has, never markup", () => {
    // a name that would close the label and add a handler, were it not escaped
    // (the browser redraws avatars from names it's sent)
    const name = `"onload="alert(1)//`;
    const svg = new JSDOM(`<body>${avatarSvg(lookFor(0) as never, undefined, `${name}'s avatar`)}</body>`).window.document.querySelector("svg")!;
    expect(svg.getAttribute("onload")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBe(`${name}'s avatar`);
  });
});
