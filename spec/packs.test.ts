import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COLOURS, cleanLook, DEFAULT_LOOK, EFFECTS, fullLook, isEffect, lookFor, MORE_EXTRAS, PARTS, randomLook, SLIDERS, STYLES, stylesCss } from "../src/packs.ts";

// What someone can choose about how they look, checked as data: every
// choice is somewhere the checks on what's sent will accept, and nothing
// else is. Whether each looks good is judged by eye, on the 3D head.
describe("the parts of an avatar someone can choose", () => {
  it("has a default for every part, and a choice of several for each", () => {
    for (const [part, choices] of Object.entries(PARTS)) {
      expect(choices.length, part).toBeGreaterThanOrEqual(4);
      expect(choices.map((c) => c.id), part).toContain(DEFAULT_LOOK[part as keyof typeof PARTS]);
      expect(new Set(choices.map((c) => c.id)).size, `${part} ids are unique`).toBe(choices.length);
    }
    for (const k of Object.keys(COLOURS)) expect(DEFAULT_LOOK[k as keyof typeof COLOURS]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("takes any choice on offer and any colour as #rrggbb, and keeps parts not mentioned as they were", () => {
    const base = lookFor(3);
    const changed = cleanLook({ hair: "afro", hairColour: "#FF00AA" }, base)!;
    expect(changed.hair).toBe("afro");
    expect(changed.hairColour).toBe("#ff00aa");
    expect(changed.eyes).toBe(base.eyes);
  });

  it("refuses anything not on offer, and colours that aren't colours", () => {
    for (const bad of [{ hair: "<script>" }, { extra: "jetpack" }, { skin: "url(evil)" }, { skin: "red" }, { eyeColour: "#12345" }, { face: 3 }]) {
      expect(cleanLook(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(cleanLook("a look")).toBeNull();
  });

  it("draws a look saved before a part existed, with that part's default", () => {
    const old = { skin: "#9ad0ec", eyes: "sparkle", mouth: "cat", extra: "headphones" };
    const now = fullLook(old);
    expect(now).toMatchObject(old);
    expect(now.hair).toBe(DEFAULT_LOOK.hair);
    expect(now.ears).toBe(DEFAULT_LOOK.ears);
    // and something it can't read at all as the default
    expect(fullLook({ hair: "jetpack" })).toEqual(DEFAULT_LOOK);
  });

  it("gives newcomers different looks, and a surprise is always a look on offer", () => {
    const seats = Array.from({ length: 6 }, (_, i) => JSON.stringify(lookFor(i)));
    expect(new Set(seats).size).toBe(6);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) expect(cleanLook(randomLook(rnd))).not.toBeNull();
  });
});

describe("how someone's words are drawn, and what they can put on one", () => {
  const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

  it("has a drawing in style.css for every effect, and a key of its own for each", () => {
    for (const fx of EFFECTS) expect(css, fx.id).toContain(`.w.fx-${fx.id}`);
    expect(new Set(EFFECTS.map((fx) => fx.key)).size).toBe(EFFECTS.length);
    expect(isEffect("shake")).toBe(true);
    expect(isEffect("<script>")).toBe(false);
  });

  it("draws every word style from its numbers, and every style's lettering is one style.css knows", () => {
    const made = stylesCss();
    for (const st of STYLES) {
      expect(made).toContain(`.spot[data-words="${st.id}"]{--style-loud:${st.loud};`);
      expect(css, st.font).toContain(`[data-font="${st.font}"]`);
    }
    // and a word style is part of a look, checked like the rest
    expect(cleanLook({ words: "comic" })!.words).toBe("comic");
    expect(cleanLook({ words: "wingdings" })).toBeNull();
  });
});

describe("what someone wears below the head", () => {
  it("has tops to choose and a colour for them, and a surprise always has arms", () => {
    expect(PARTS.top.length).toBeGreaterThan(4);
    expect(DEFAULT_LOOK.top).not.toBe("none");
    expect(cleanLook({ top: "hoodie", topColour: "#3EA66B" })).toMatchObject({ top: "hoodie", topColour: "#3ea66b" });
    expect(cleanLook({ top: "cape" })).toBeNull();
    // looks saved before tops existed still draw, with one
    expect(fullLook({ face: "oval" })).toMatchObject({ top: DEFAULT_LOOK.top, topColour: DEFAULT_LOOK.topColour });
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) expect(randomLook(rnd).top).not.toBe("none");
  });
});

describe("shaping a look finer, and wearing more than one thing", () => {
  it("takes any slider on offer, pulled into -1..1, and keeps the ones not mentioned", () => {
    const shaped = cleanLook({ tune: { eyeSize: 0.5, noseSize: 7 } })!;
    expect(shaped.tune).toEqual({ eyeSize: 0.5, noseSize: 1 });
    // a later change to one slider leaves the others; back to 0 is dropped
    expect(cleanLook({ tune: { eyeSize: 0 } }, shaped)!.tune).toEqual({ noseSize: 1 });
    expect(SLIDERS.length).toBeGreaterThanOrEqual(10);
  });

  it("refuses sliders that aren't on offer and values that aren't numbers", () => {
    for (const bad of [{ tune: { tailLength: 1 } }, { tune: { eyeSize: "big" } }, { tune: { eyeSize: NaN } }, { tune: [1, 2] }, { tune: "wide" }]) {
      expect(cleanLook(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("wears up to a couple more things, each on offer, none twice and not the main one again", () => {
    const l = cleanLook({ extra: "hat", more: ["glasses", "flower", "glasses"] })!;
    expect(l.more).toEqual(["glasses", "flower"]);
    expect(cleanLook({ extra: "hat", more: ["hat", "glasses"] })!.more).toEqual(["glasses"]);
    expect(cleanLook({ more: ["glasses", "flower", "crown"].slice(0, MORE_EXTRAS + 1) })).toBeNull();
    expect(cleanLook({ more: ["jetpack"] })).toBeNull();
    expect(cleanLook({ more: "glasses" })).toBeNull();
  });

  it("surprises within reach of usual, never off the ends", () => {
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 30; i++) for (const v of Object.values(randomLook(rnd).tune ?? {})) expect(Math.abs(v)).toBeLessThanOrEqual(0.6);
  });
});
