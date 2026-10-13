import { describe, expect, it } from "vitest";
import { queue, WAIT } from "../src/queue.ts";
import type { Word } from "../src/voice.ts";

// A speaker's words, waiting on their own screen before anyone else sees
// them. Time is passed in, so these run without waiting.
const word = (w: string, extra: Partial<Word> = {}): Word => ({
  w,
  start: 0,
  end: 0.3,
  loud: 0,
  pitch: 0,
  rise: 0,
  stretch: 0,
  held: null,
  contour: [],
  ...extra,
});
const type = (q: ReturnType<typeof queue>, keys: string, now: number): void => {
  for (const k of keys) q.key(k, now);
};

describe("a speaker's queue of words", () => {
  it("sends the top word after a moment, then the next, in the order they were said", () => {
    const q = queue();
    q.add([word("one"), word("two")], 0);
    expect(q.release(WAIT - 1)).toBeNull();
    expect(q.release(WAIT)?.w).toBe("one");
    expect(q.release(WAIT + 1)).toBeNull();
    expect(q.release(2 * WAIT)?.w).toBe("two");
    expect(q.release(3 * WAIT)).toBeNull();
  });

  it("replaces the top word with what's typed, keeping how it was said", () => {
    const q = queue();
    q.add([word("there", { loud: 9, pitch: 3, stretch: 1.5, held: 0.6 })], 0);
    type(q, "their", 100);
    expect(q.typing()).toBe("their");
    q.key("Enter", 200);
    const out = q.release(200 + WAIT)!;
    expect(out).toMatchObject({ w: "their", loud: 9, pitch: 3, stretch: 1.5 });
    // which letter was held belonged to the old spelling
    expect(out.held).toBeNull();
  });

  it("holds the top word while it's being typed over, however long that takes", () => {
    const q = queue();
    q.add([word("one")], 0);
    q.key("x", 10);
    expect(q.release(60_000)).toBeNull();
    q.key("Escape", 60_000);
    // cancelled: the word as heard, after a fresh wait
    expect(q.release(60_000 + WAIT)?.w).toBe("one");
  });

  it("lets backspace mend what's being typed, and drop the top word when nothing is", () => {
    const q = queue();
    q.add([word("one"), word("two")], 0);
    type(q, "onf", 0);
    q.key("Backspace", 0);
    type(q, "e!", 0);
    q.key("Enter", 0);
    expect(q.words()[0].w).toBe("one!");
    q.key("Backspace", 0);
    expect(q.words().map((w) => w.w)).toEqual(["two"]);
  });

  it("puts an effect on the top word with its number, and takes it off with the same number", () => {
    const q = queue();
    q.add([word("wow"), word("ok")], 0);
    q.key("1", 0);
    expect(q.words()[0].effect).toBe("impact");
    q.key("3", 0);
    expect(q.words()[0].effect).toBe("glow");
    q.key("3", 0);
    expect(q.words()[0].effect).toBeUndefined();
    q.key("2", 0);
    expect(q.release(WAIT)).toMatchObject({ w: "wow", effect: "whisper" });
    expect(q.words()[0].effect).toBeUndefined();
  });

  it("gives the top word a fresh wait whenever its speaker does something to it", () => {
    const q = queue();
    q.add([word("one")], 0);
    q.key("1", WAIT - 100);
    expect(q.release(WAIT)).toBeNull();
    expect(q.release(2 * WAIT - 100)?.w).toBe("one");
  });

  it("sends the top word at once on Enter", () => {
    const q = queue();
    q.add([word("now")], 0);
    q.key("Enter", 50);
    expect(q.release(50)?.w).toBe("now");
  });

  it("leaves keys alone with nothing waiting, so typing elsewhere on the page works", () => {
    const q = queue();
    expect(q.key("a", 0)).toBe(false);
    expect(q.key("1", 0)).toBe(false);
  });

  it("gives up everything still waiting when its speaker leaves, with what they'd typed", () => {
    const q = queue();
    q.add([word("one"), word("two")], 0);
    type(q, "uno", 0);
    expect(q.flush().map((w) => w.w)).toEqual(["uno", "two"]);
    expect(q.words()).toHaveLength(0);
  });
});
