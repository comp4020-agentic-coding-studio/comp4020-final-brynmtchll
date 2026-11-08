// Ways to read what's said, other than as words: each word drawn from the
// numbers of how it was said (voice.ts wordHtml), as a colour or as an emoji.
// Space and the room's captions both use these, and both remember which
// the reader chose (it's the reader's, not the speaker's: the same words,
// read differently).
import { emojiOf } from "./packs.ts";
import { esc } from "./voice.ts";

export type Lens = "words" | "colour" | "emoji";
export const LENSES: readonly Lens[] = ["words", "colour", "emoji"];
const KEY = "said-lens";

export function savedLens(): Lens {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem("said-space-lens");
    return LENSES.includes(v as Lens) ? (v as Lens) : "words";
  } catch {
    return "words";
  }
}
export function saveLens(l: Lens): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // (a private window: not remembered)
  }
}

// A word as said, from its drawn HTML: the word and its numbers.
export type Said = { w: string; loud: number; pitch: number; stretch: number };
export function saidOf(el: Element): Said {
  const s = (el as HTMLElement).style;
  const copy = el.cloneNode(true) as HTMLElement;
  const held = copy.querySelector(".held");
  const stretch = held ? Math.min(3, (held.textContent?.length ?? 0) / 3) : 0;
  held?.remove();
  return { w: copy.textContent ?? "", loud: Number(s.getPropertyValue("--loud")) || 0, pitch: Number(s.getPropertyValue("--pitch")) || 0, stretch };
}

// A word as a soft shape: warmer the higher and louder it was said (blue,
// low and quiet, through green and gold to red-pink, high and loud), bigger
// the louder, longer the more drawn out (and the longer the word), and
// higher up the higher it was said.
export function colourOf(x: Said): string {
  const heat = Math.max(-1, Math.min(1, x.pitch / 6 + x.loud / 12));
  const hue = Math.round(230 - (heat + 1) * 105);
  const size = Math.max(0.5, Math.min(2.2, 1 + x.loud / 12));
  const long = 1 + Math.max(0, x.stretch) * 1.2 + Math.min(1.5, x.w.length / 8);
  return `<span class="blob" style="--loud:${x.loud};--h:${hue};--s:${size.toFixed(2)};--l:${long.toFixed(2)};--p:${Math.max(-12, Math.min(12, x.pitch))}" title="${esc(x.w)}"></span>`;
}

// A word as its emoji, if it has an obvious one (packs.ts WORD_EMOJI), sized
// by how loud; any other word, a small dot, so the rhythm of the phrase
// still shows.
export function emojiWord(x: Said): string {
  const e = emojiOf(x.w);
  const size = Math.max(0.7, Math.min(2.4, 1 + x.loud / 10));
  return e ? `<span class="emo" style="--loud:${x.loud};--s:${size.toFixed(2)};--p:${Math.max(-12, Math.min(12, x.pitch))}" title="${esc(x.w)}">${e}</span>` : `<span class="tick" style="--loud:${x.loud};--s:${size.toFixed(2)}" title="${esc(x.w)}"></span>`;
}

// Words (their drawn HTML, `.w` spans) as a lens draws them. In the words
// lens they're as they are.
export function throughLens(lens: Lens, words: Element[]): string {
  if (lens === "words") return words.map((w) => w.outerHTML).join(" ");
  return words.map((w) => (lens === "colour" ? colourOf(saidOf(w)) : emojiWord(saidOf(w)))).join("");
}
