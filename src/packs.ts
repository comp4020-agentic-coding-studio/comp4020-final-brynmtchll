// Everything someone can choose about how they come across, as data: the
// parts of their avatar, how their words are drawn, the effects they can put
// on a word and the emotes they can pull. Each is a pack: a list of choices,
// each with an id (what's stored and sent), a label (what's shown) and what
// it takes to draw it. Adding a choice is adding an entry here; the picker,
// the checks on what's sent and the drawing all read from these lists.
//
// Shared by the server (which checks every choice against them) and the
// browser (which draws them).

export type Choice = { id: string; label: string };

// ---- words ----

// Effects someone can put on one of their words, after they've said it, by
// the key shown. style.css draws each as .w.fx-<id>; each builds on how the
// word was said rather than replacing it.
export const EFFECTS = [
  { id: "impact", label: "Impact", key: "1" },
  { id: "whisper", label: "Whisper", key: "2" },
  { id: "glow", label: "Glow", key: "3" },
  { id: "shake", label: "Shake", key: "4" },
  { id: "wave", label: "Wave", key: "5" },
  { id: "rainbow", label: "Rainbow", key: "6" },
  { id: "spooky", label: "Spooky", key: "7" },
  { id: "sparkle", label: "Sparkle", key: "8" },
] as const satisfies readonly (Choice & { key: string })[];
export type Effect = (typeof EFFECTS)[number]["id"];
export const isEffect = (v: unknown): v is Effect => EFFECTS.some((e) => e.id === v);

// How someone's words are drawn, chosen once for all of them: the lettering,
// and how strongly being loud, high or drawn out shows (style.css reads
// these as custom properties on their card, so every word they say, on
// every page, is drawn their way). `loud`, `pitch` and `motion` scale the
// effect of each: 1 as it always was, 0 not at all, 2 twice as much.
export const STYLES = [
  { id: "plain", label: "Plain", font: "system", loud: 1, pitch: 1, motion: 0 },
  { id: "loud", label: "Big feelings", font: "system", loud: 2, pitch: 1.6, motion: 1 },
  { id: "comic", label: "Comic", font: "comic", loud: 1.6, pitch: 1.4, motion: 1 },
  { id: "neon", label: "Neon", font: "rounded", loud: 1.2, pitch: 1, motion: 0.5, glow: true },
  { id: "hand", label: "Handwritten", font: "hand", loud: 1, pitch: 1.2, motion: 0.3 },
  { id: "type", label: "Typewriter", font: "mono", loud: 0.8, pitch: 0.6, motion: 0 },
  { id: "serif", label: "Storybook", font: "serif", loud: 1, pitch: 1, motion: 0.2 },
  { id: "calm", label: "Calm", font: "rounded", loud: 0.4, pitch: 0.4, motion: 0 },
] as const satisfies readonly (Choice & { font: string; loud: number; pitch: number; motion: number; glow?: boolean })[];
export type Style = (typeof STYLES)[number];

// Each word style as CSS, for the server to put after style.css: a card
// marked data-words="<id>" draws its words that way.
export const stylesCss = (): string =>
  STYLES.map((st) => `.spot[data-words="${st.id}"]{--style-loud:${st.loud};--style-pitch:${st.pitch};--style-motion:${st.motion}}`).join("\n");

// ---- the avatar ----

// Parts that are one of a set of shapes. head3d.ts draws each by its id
// (a shape it doesn't know yet is drawn as the first), and avatar.ts the flat
// face's few.
export const PARTS = {
  face: [
    { id: "round", label: "Round" },
    { id: "oval", label: "Oval" },
    { id: "square", label: "Square" },
    { id: "heart", label: "Heart" },
    { id: "bean", label: "Bean" },
  ],
  hair: [
    { id: "none", label: "None" },
    { id: "buzz", label: "Buzz" },
    { id: "short", label: "Short" },
    { id: "swoop", label: "Swoop" },
    { id: "curly", label: "Curly" },
    { id: "afro", label: "Afro" },
    { id: "bob", label: "Bob" },
    { id: "long", label: "Long" },
    { id: "bun", label: "Bun" },
    { id: "pigtails", label: "Pigtails" },
    { id: "mohawk", label: "Mohawk" },
    { id: "spiky", label: "Spiky" },
  ],
  brows: [
    { id: "bar", label: "Bar" },
    { id: "thin", label: "Thin" },
    { id: "bushy", label: "Bushy" },
    { id: "arched", label: "Arched" },
    { id: "none", label: "None" },
  ],
  eyes: [
    { id: "dots", label: "Dots" },
    { id: "round", label: "Round" },
    { id: "sleepy", label: "Sleepy" },
    { id: "sparkle", label: "Sparkle" },
    { id: "lashes", label: "Lashes" },
    { id: "big", label: "Big" },
  ],
  nose: [
    { id: "button", label: "Button" },
    { id: "pointy", label: "Pointy" },
    { id: "wide", label: "Wide" },
    { id: "long", label: "Long" },
    { id: "none", label: "None" },
  ],
  mouth: [
    { id: "line", label: "Line" },
    { id: "wide", label: "Wide" },
    { id: "cat", label: "Cat" },
    { id: "full", label: "Full" },
  ],
  ears: [
    { id: "round", label: "Round" },
    { id: "pointy", label: "Elf" },
    { id: "big", label: "Big" },
    { id: "cat", label: "Cat" },
    { id: "bunny", label: "Bunny" },
    { id: "none", label: "None" },
  ],
  beard: [
    { id: "none", label: "None" },
    { id: "stubble", label: "Stubble" },
    { id: "moustache", label: "Moustache" },
    { id: "goatee", label: "Goatee" },
    { id: "full", label: "Full" },
  ],
  words: STYLES.map(({ id, label }) => ({ id, label })),
  extra: [
    { id: "none", label: "None" },
    { id: "glasses", label: "Glasses" },
    { id: "shades", label: "Shades" },
    { id: "monocle", label: "Monocle" },
    { id: "hat", label: "Hat" },
    { id: "beanie", label: "Beanie" },
    { id: "cap", label: "Cap" },
    { id: "crown", label: "Crown" },
    { id: "halo", label: "Halo" },
    { id: "horns", label: "Horns" },
    { id: "headphones", label: "Headphones" },
    { id: "flower", label: "Flower" },
    { id: "blush", label: "Blush" },
    { id: "freckles", label: "Freckles" },
  ],
} as const satisfies Record<string, readonly Choice[]>;
export type Part = keyof typeof PARTS;
export type PartId<P extends Part> = (typeof PARTS)[P][number]["id"];

// Colours someone picks: a swatch row each, and any colour at all from a
// picker (kept to #rrggbb).
export const COLOURS = {
  skin: { label: "Skin", swatches: ["#ffd8b5", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a21", "#9ad0ec", "#b9f2a1", "#e3b6ff", "#ffb3c1"] },
  hairColour: { label: "Hair", swatches: ["#1b1b1f", "#4a2f1d", "#8a5a2b", "#d9a441", "#f3e2a0", "#b33a2b", "#e8e8ec", "#ff6fae", "#5aa9ff", "#6fdc8c"] },
  eyeColour: { label: "Eyes", swatches: ["#3a2a1a", "#5a3b22", "#2f6db5", "#3f8f5a", "#8a8f99", "#b07a2a", "#7a3fb5", "#d23a3a"] },
  extraColour: { label: "Accent", swatches: ["#e0506a", "#3d4a6e", "#f2c14e", "#4ec9b0", "#9b6bff", "#ff8a3d", "#1b1f2a", "#f4f4f4"] },
} as const;
export type ColourPart = keyof typeof COLOURS;

export type Look = { [P in Part]: PartId<P> } & { [C in ColourPart]: string };

// What a part is when someone hasn't chosen it, so a look saved before the
// part existed still draws.
export const DEFAULT_LOOK: Look = {
  face: "round",
  hair: "none",
  brows: "bar",
  eyes: "dots",
  nose: "button",
  mouth: "line",
  ears: "round",
  beard: "none",
  extra: "none",
  words: "plain",
  skin: COLOURS.skin.swatches[0],
  hairColour: COLOURS.hairColour.swatches[1],
  eyeColour: COLOURS.eyeColour.swatches[0],
  extraColour: COLOURS.extraColour.swatches[0],
};

const HEX = /^#[0-9a-f]{6}$/;

// A look as sent, every part one of its pack's choices and every colour a
// #rrggbb, with parts it doesn't mention as they were in `base`; null if any
// part it does mention isn't a choice on offer.
export function cleanLook(input: unknown, base: Look = DEFAULT_LOOK): Look | null {
  if (typeof input !== "object" || input === null) return null;
  const l = input as Record<string, unknown>;
  const out = { ...DEFAULT_LOOK, ...base } as Record<string, string>;
  for (const k of Object.keys(PARTS) as Part[]) {
    if (l[k] === undefined) continue;
    if (!(PARTS[k] as readonly Choice[]).some((c) => c.id === l[k])) return null;
    out[k] = l[k] as string;
  }
  for (const k of Object.keys(COLOURS) as ColourPart[]) {
    if (l[k] === undefined) continue;
    if (typeof l[k] !== "string" || !HEX.test((l[k] as string).toLowerCase())) return null;
    out[k] = (l[k] as string).toLowerCase();
  }
  return out as Look;
}

// a look as stored, whatever it was saved with, as a whole look today
export const fullLook = (stored: unknown): Look => cleanLook(stored) ?? DEFAULT_LOOK;

// Someone who hasn't chosen yet gets a look from their seat, so a room of
// newcomers isn't a room of identical faces.
export function lookFor(seat: number): Look {
  const pick = <P extends Part>(p: P, n: number): PartId<P> => PARTS[p][n % PARTS[p].length].id as PartId<P>;
  return {
    ...DEFAULT_LOOK,
    skin: COLOURS.skin.swatches[seat % 6],
    eyes: pick("eyes", seat),
    mouth: pick("mouth", seat >> 1),
    hair: pick("hair", (seat * 5) % 7),
    hairColour: COLOURS.hairColour.swatches[(seat * 3) % 6],
    eyeColour: COLOURS.eyeColour.swatches[seat % 4],
  };
}

// A random look from everything on offer, for "surprise me".
export function randomLook(rnd: () => number = Math.random): Look {
  const out = { ...DEFAULT_LOOK } as Record<string, string>;
  for (const k of Object.keys(PARTS) as Part[]) out[k] = PARTS[k][Math.floor(rnd() * PARTS[k].length)].id;
  for (const k of Object.keys(COLOURS) as ColourPart[]) out[k] = COLOURS[k].swatches[Math.floor(rnd() * COLOURS[k].swatches.length)];
  // a beard on half of them, accessories on most
  if (rnd() < 0.5) out.beard = "none";
  return out as Look;
}
