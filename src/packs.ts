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
  STYLES.map((st) => `.spot[data-words="${st.id}"],.room-label[data-words="${st.id}"]{--style-loud:${st.loud};--style-pitch:${st.pitch};--style-motion:${st.motion}}`).join("\n");

// ---- voices ----

// How someone's words sound to whoever has voices on (speech.ts): a voice
// of a few, each a way of sounding rather than a particular recording, since
// each listener's device has its own voices: `names` are the ones to look
// for, best first (macOS, Windows, Android and Chrome's own), and `lang` the
// accent to fall back on, at the voice's own pitch and speed (1 as the
// device speaks). Each listener's device says it a little differently; the
// pitch and speed make it theirs anywhere. "Silent" is never spoken.
export const VOICES = [
  { id: "warm", label: "Warm", names: ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Zira", "Karen"], lang: "en-US", pitch: 1, rate: 1 },
  { id: "deep", label: "Deep", names: ["Daniel", "Google UK English Male", "Microsoft Guy", "Microsoft David", "Rishi", "Fred"], lang: "en-GB", pitch: 0.75, rate: 0.95 },
  { id: "bright", label: "Bright", names: ["Karen", "Tessa", "Google UK English Female", "Microsoft Jenny", "Samantha"], lang: "en-AU", pitch: 1.3, rate: 1.06 },
  { id: "story", label: "Storyteller", names: ["Moira", "Daniel", "Google UK English Female", "Microsoft Libby", "Microsoft Hazel"], lang: "en-IE", pitch: 0.95, rate: 0.88 },
  { id: "quick", label: "Quick", names: ["Rishi", "Reed (English (United States))", "Microsoft Mark", "Google US English"], lang: "en-IN", pitch: 1.05, rate: 1.25 },
  { id: "grand", label: "Grand", names: ["Grandpa (English (United Kingdom))", "Grandpa (English (United States))", "Microsoft George", "Daniel"], lang: "en-GB", pitch: 0.7, rate: 0.85 },
  { id: "tiny", label: "Tiny", names: ["Junior", "Flo (English (United States))", "Microsoft Ana", "Google US English"], lang: "en-US", pitch: 1.65, rate: 1.15 },
  { id: "robot", label: "Robot", names: ["Trinoids", "Zarvox", "Fred", "Microsoft David"], lang: "en-US", pitch: 0.4, rate: 1 },
  { id: "whisper", label: "Whisper", names: ["Whisper", "Microsoft Zira"], lang: "en-US", pitch: 1.1, rate: 0.9 },
  { id: "silent", label: "Silent", names: [], lang: "", pitch: 1, rate: 1 },
] as const satisfies readonly (Choice & { names: readonly string[]; lang: string; pitch: number; rate: number })[];
export type VoiceChoice = (typeof VOICES)[number];
export const voiceOf = (id: unknown): VoiceChoice => VOICES.find((v) => v.id === id) ?? VOICES[0];

// ---- moments ----

// Emotes: something someone's head does, for everyone, for a moment, by the
// key shown (with Shift, so they don't take a word's keys) or a button.
// `head` is how head3d.ts moves the head, `burst` what rises from it (an
// emoji, drawn by the page), `face` the expression it pulls meanwhile, `arm`
// what their arm does (body.ts GESTURE_ARMS). Some go off by themselves when
// the face does (`when`: an expression held), or a hand does (`gesture`:
// MediaPipe's name for it, held up to the camera).
export const EMOTES = [
  { id: "nod", label: "Nod", key: "N", head: "nod", burst: "", face: { smile: 0.3 } },
  { id: "shake", label: "No", key: "X", head: "shake", burst: "", face: { frown: 0.5 } },
  { id: "laugh", label: "Laugh", key: "L", head: "bounce", burst: "😂", face: { smile: 1, open: 0.7 }, when: { smile: 0.85, open: 0.5 } },
  { id: "love", label: "Love", key: "H", head: "tilt", burst: "❤️", face: { smile: 0.8 }, arm: "love", gesture: "ILoveYou" },
  { id: "wow", label: "Wow", key: "W", head: "back", burst: "❗", face: { browUp: 1, open: 0.6, wide: 1 }, when: { browUp: 0.8, open: 0.55 } },
  { id: "think", label: "Hmm", key: "T", head: "tilt", burst: "💭", face: { brow: 1, smirk: -0.4, lookY: 0.7, lookX: 0.5 }, arm: "chin" },
  { id: "idea", label: "Idea", key: "I", head: "back", burst: "💡", face: { browUp: 0.7, smile: 0.6, wide: 0.6 }, arm: "point", gesture: "Pointing_Up" },
  { id: "sad", label: "Sad", key: "S", head: "droop", burst: "🌧️", face: { frown: 1, browUp: 0.6 } },
  { id: "angry", label: "Grr", key: "G", head: "shake", burst: "💢", face: { browDown: 1, frown: 0.7, sneer: 0.6 } },
  { id: "party", label: "Party", key: "P", head: "bounce", burst: "🎉", face: { smile: 1, open: 0.4, wide: 0.5 }, arm: "pump" },
  { id: "sleep", label: "Zzz", key: "Z", head: "droop", burst: "💤", face: { blink: 1 } },
  { id: "cool", label: "Cool", key: "C", head: "tilt", burst: "😎", face: { smirk: 0.8, smile: 0.4 } },
  { id: "yes", label: "Yes", key: "Y", head: "nod", burst: "👍", face: { smile: 0.6 }, arm: "thumbs", gesture: "Thumb_Up" },
  { id: "boo", label: "Boo", key: "B", head: "shake", burst: "👎", face: { frown: 0.6, browDown: 0.4 }, arm: "boo", gesture: "Thumb_Down" },
  { id: "hi", label: "Hi", key: "O", head: "tilt", burst: "👋", face: { smile: 0.7 }, arm: "wave", gesture: "Open_Palm" },
  { id: "peace", label: "Peace", key: "V", head: "tilt", burst: "✌️", face: { smile: 0.5, smirk: 0.3 }, arm: "peace", gesture: "Victory" },
] as const satisfies readonly (Choice & { key: string; head: string; burst: string; face: Record<string, number>; when?: Record<string, number>; arm?: string; gesture?: string })[];
export type Emote = (typeof EMOTES)[number];
export const emoteOf = (id: unknown): Emote | undefined => EMOTES.find((e) => e.id === id);

// Reactions someone can put on someone else's word: one each per word,
// shown on the word for everyone, kept with it.
export const REACTIONS = [
  { id: "love", label: "Love it", emoji: "❤️" },
  { id: "laugh", label: "Funny", emoji: "😂" },
  { id: "wow", label: "Wow", emoji: "😮" },
  { id: "yes", label: "Agree", emoji: "👍" },
  { id: "sad", label: "Aw", emoji: "😢" },
  { id: "fire", label: "Fire", emoji: "🔥" },
] as const satisfies readonly (Choice & { emoji: string })[];
export type Reaction = (typeof REACTIONS)[number];
export const reactionOf = (id: unknown): Reaction | undefined => REACTIONS.find((r) => r.id === id);

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
  // how their words sound, to anyone listening
  voice: VOICES.map(({ id, label }) => ({ id, label })),
  // what they're wearing below the head, which shows with their arms
  top: [
    { id: "tee", label: "T-shirt" },
    { id: "hoodie", label: "Hoodie" },
    { id: "jumper", label: "Jumper" },
    { id: "collar", label: "Shirt" },
    { id: "overalls", label: "Overalls" },
    { id: "robe", label: "Robe" },
    { id: "none", label: "No arms" },
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
  topColour: { label: "Top", swatches: ["#4a6fd1", "#e0506a", "#3ea66b", "#f2c14e", "#9b6bff", "#2b2f3a", "#f4f4f4", "#ff8a3d", "#5ec4d8", "#c46a3c"] },
} as const;
export type ColourPart = keyof typeof COLOURS;

// Sliders: how a part is shaped, finer than which part it is. Each is -1
// to 1, 0 as the part is drawn by default; head3d.ts reads each by its id.
export const SLIDERS = [
  { id: "headWidth", label: "Head width", group: "Face" },
  { id: "headHeight", label: "Head height", group: "Face" },
  { id: "jaw", label: "Jaw", group: "Face" },
  { id: "earSize", label: "Ears", group: "Face" },
  { id: "noseSize", label: "Nose size", group: "Face" },
  { id: "noseHeight", label: "Nose height", group: "Face" },
  { id: "eyeSize", label: "Eye size", group: "Eyes" },
  { id: "eyeSpacing", label: "Eye spacing", group: "Eyes" },
  { id: "eyeHeight", label: "Eye height", group: "Eyes" },
  { id: "eyeTilt", label: "Eye tilt", group: "Eyes" },
  { id: "browHeight", label: "Brow height", group: "Hair" },
  { id: "browThickness", label: "Brow thickness", group: "Hair" },
  { id: "hairSize", label: "Hair volume", group: "Hair" },
  { id: "mouthWidth", label: "Mouth width", group: "Mouth" },
  { id: "mouthHeight", label: "Mouth height", group: "Mouth" },
  { id: "lipSize", label: "Lips", group: "Mouth" },
  { id: "shoulders", label: "Shoulders", group: "Body" },
  { id: "armLength", label: "Arm length", group: "Body" },
  { id: "handSize", label: "Hands", group: "Body" },
  { id: "neck", label: "Neck", group: "Body" },
  { id: "voicePitch", label: "Pitch", group: "Voice" },
  { id: "voiceSpeed", label: "Speed", group: "Voice" },
] as const satisfies readonly (Choice & { group: string })[];
export type Slider = (typeof SLIDERS)[number]["id"];
export type Tune = Partial<Record<Slider, number>>;

// More things to wear than the one: this many besides it
export const MORE_EXTRAS = 2;

export type Look = { [P in Part]: PartId<P> } & { [C in ColourPart]: string } & { tune?: Tune; more?: PartId<"extra">[] };

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
  top: "tee",
  voice: "warm",
  words: "plain",
  skin: COLOURS.skin.swatches[0],
  hairColour: COLOURS.hairColour.swatches[1],
  eyeColour: COLOURS.eyeColour.swatches[0],
  extraColour: COLOURS.extraColour.swatches[0],
  topColour: COLOURS.topColour.swatches[0],
};

const HEX = /^#[0-9a-f]{6}$/;

// A look as sent, every part one of its pack's choices and every colour a
// #rrggbb, with parts it doesn't mention as they were in `base`; null if any
// part it does mention isn't a choice on offer.
export function cleanLook(input: unknown, base: Look = DEFAULT_LOOK): Look | null {
  if (typeof input !== "object" || input === null) return null;
  const l = input as Record<string, unknown>;
  const out = { ...DEFAULT_LOOK, ...base } as unknown as Record<string, string>;
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
  const look = out as unknown as Look;
  // sliders: only those on offer, each a number pulled into -1..1 (two
  // places is plenty); unmentioned ones as they were
  if (l.tune !== undefined) {
    if (typeof l.tune !== "object" || l.tune === null || Array.isArray(l.tune)) return null;
    const tune: Tune = { ...(base.tune ?? {}) };
    for (const [k, v] of Object.entries(l.tune as Record<string, unknown>)) {
      if (!SLIDERS.some((sl) => sl.id === k) || typeof v !== "number" || !Number.isFinite(v)) return null;
      const n = Math.round(Math.min(1, Math.max(-1, v)) * 100) / 100;
      if (n === 0) delete tune[k as Slider];
      else tune[k as Slider] = n;
    }
    look.tune = tune;
  }
  // more to wear: each one on offer, none twice, none the main one, at most MORE_EXTRAS
  if (l.more !== undefined) {
    if (!Array.isArray(l.more) || l.more.length > MORE_EXTRAS * 2) return null;
    const ids = PARTS.extra.map((c) => c.id) as readonly string[];
    if (!l.more.every((m) => typeof m === "string" && ids.includes(m))) return null;
    const more = [...new Set(l.more as PartId<"extra">[])].filter((m) => m !== look.extra && m !== "none");
    if (more.length > MORE_EXTRAS) return null;
    look.more = more;
  }
  return look;
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
    topColour: COLOURS.topColour.swatches[(seat * 7) % 10],
    voice: VOICES[(seat * 3) % (VOICES.length - 1)].id,
  };
}

// A random look from everything on offer, for "surprise me".
export function randomLook(rnd: () => number = Math.random): Look {
  const out = { ...DEFAULT_LOOK } as unknown as Record<string, string>;
  for (const k of Object.keys(PARTS) as Part[]) out[k] = PARTS[k][Math.floor(rnd() * PARTS[k].length)].id;
  for (const k of Object.keys(COLOURS) as ColourPart[]) out[k] = COLOURS[k].swatches[Math.floor(rnd() * COLOURS[k].swatches.length)];
  // a beard on half of them, accessories on most, and always arms
  if (rnd() < 0.5) out.beard = "none";
  if (out.top === "none") out.top = "tee";
  if (out.voice === "silent") out.voice = "warm";
  // and shaped a little, not far from usual
  const tune: Tune = {};
  for (const sl of SLIDERS) if (rnd() < 0.5) tune[sl.id] = Math.round((rnd() * 2 - 1) * 0.6 * 100) / 100;
  return { ...(out as unknown as Look), tune };
}
