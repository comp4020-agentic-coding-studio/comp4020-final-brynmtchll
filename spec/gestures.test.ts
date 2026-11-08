import { describe, expect, it } from "vitest";
import { gestureArm, gestureFor, gestureHead } from "../src/gestures.ts";
import { RESTING } from "../src/body.ts";

describe("gestures that go with words", () => {
  it("finds a word's own gesture whatever's round it, and none for an ordinary word", () => {
    expect(gestureFor("Hi!")?.moves).toBe("wave");
    expect(gestureFor("hello,")?.moves).toBe("wave");
    expect(gestureFor("MAYBE...")?.moves).toBe("shrug");
    expect(gestureFor("no.")?.head?.shake).toBeGreaterThan(0);
    expect(gestureFor("yeah")?.head?.nod).toBeGreaterThan(0);
    expect(gestureFor("huge")?.hands).toBe("both");
    for (const w of ["the", "and", "I", "was", "table", "", "...", "hippopotamus"]) expect(gestureFor(w)).toBeNull();
  });

  it("only points or counts with a word said in passing as often as not when it's leaned on", () => {
    for (const w of ["that", "over", "one", "right", "sure"]) {
      expect(gestureFor(w, false)).toBeNull();
      expect(gestureFor(w, true)).not.toBeNull();
    }
  });

  it("starts from resting, gets to the gesture, and mirrors it for the other hand", () => {
    const g = gestureFor("you")!;
    const rest = gestureArm(g, "right", 0, 0)!;
    expect(rest.upper[0]).toBeCloseTo(RESTING.right.upper[0], 5);
    expect(rest.fore[1]).toBeCloseTo(RESTING.right.fore[1], 5);
    const there = gestureArm(g, "right", 1, 0.3)!;
    // (the forearm out towards whoever's looking, not hanging)
    expect(there.fore[2]).toBeGreaterThan(0.6);
    expect(there.fore[1]).toBeGreaterThan(0);
    const left = gestureArm(g, "left", 1, 0.3)!;
    expect(left.upper[0]).toBeCloseTo(-there.upper[0], 5);
    expect(left.fore[2]).toBeCloseTo(there.fore[2], 5);
  });

  it("waves a wave as it's held, and nods a yes and shakes a no without moving a hand", () => {
    const hi = gestureFor("hi")!;
    const a = gestureArm(hi, "right", 1, 0.05)!.fore[0];
    const b = gestureArm(hi, "right", 1, 0.12)!.fore[0];
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
    const yes = gestureFor("yes")!;
    expect(gestureArm(yes, "right", 1, 0)).toBeNull();
    const nods = [0.1, 0.2, 0.3, 0.6, 0.7, 0.8].map((t) => gestureHead(yes, t, 1).pitch);
    expect(Math.max(...nods)).toBeGreaterThan(0.1);
    expect(gestureHead(yes, 0.5, 1).yaw).toBe(0);
    const no = gestureFor("nope")!;
    const shakes = [0.12, 0.37, 0.62, 0.87].map((t) => gestureHead(no, t, 1).yaw);
    expect(Math.max(...shakes)).toBeGreaterThan(0.15);
    expect(Math.min(...shakes)).toBeLessThan(-0.15);
    // and nothing at either end, so it starts and finishes still
    expect(Math.abs(gestureHead(no, 0, 1).yaw)).toBeLessThan(1e-9);
  });
});
