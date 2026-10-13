import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";

// The basics every page holds to, as served (no script runs): a declared
// language, a real title, a viewport meta, a nav landmark, exactly one h1,
// and alt text on every image. The README's own top heading is the h1 on
// /readme/, so this also catches a README that grows a second one.
const baseUrl = inject("baseUrl");

for (const path of ["/", "/readme/"]) {
  it(`${path} has the basics`, async () => {
    const doc = new JSDOM(await (await fetch(new URL(path, baseUrl))).text()).window.document;
    expect(doc.documentElement.lang).not.toBe("");
    expect(doc.title.trim()).not.toBe("");
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(doc.querySelector("nav")).not.toBeNull();
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    for (const img of doc.querySelectorAll("img")) expect(img.hasAttribute("alt"), img.outerHTML).toBe(true);
  });
}
