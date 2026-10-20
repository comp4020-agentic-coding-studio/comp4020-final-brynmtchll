// Each person's avatar: a face drawn in SVG that pulls the expression its
// owner is pulling, from a handful of numbers read off their camera, in a look
// they choose. Shared by the server (which draws it into the page and checks
// what's sent) and the browser (which redraws it as expressions arrive).
//
// Nothing about a face leaves its owner's browser but the seven numbers in
// Expression, a few times a second while they've asked for it: no picture.

// How the face is set, each 0 to 1, from MediaPipe's expression scores.
export type Expression = {
  smile: number;
  frown: number;
  open: number; // jaw
  pucker: number;
  browUp: number;
  browDown: number;
  blink: number;
};
export const REST: Expression = { smile: 0, frown: 0, open: 0, pucker: 0, browUp: 0, browDown: 0, blink: 0 };
const KEYS = Object.keys(REST) as (keyof Expression)[];

// What someone can choose about how their avatar looks.
export const LOOKS = {
  skin: ["#ffd8b5", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a21", "#9ad0ec", "#b9f2a1", "#e3b6ff", "#ffb3c1"],
  eyes: ["dots", "round", "sleepy", "sparkle"],
  mouth: ["line", "wide", "cat"],
  extra: ["none", "glasses", "shades", "hat", "headphones", "blush"],
} as const;
export type Look = { skin: string; eyes: (typeof LOOKS.eyes)[number]; mouth: (typeof LOOKS.mouth)[number]; extra: (typeof LOOKS.extra)[number] };

// someone who hasn't chosen yet gets a look from their seat, so a room of
// newcomers isn't a room of identical faces
export const lookFor = (seat: number): Look => ({
  skin: LOOKS.skin[seat % 6],
  eyes: LOOKS.eyes[seat % LOOKS.eyes.length],
  mouth: LOOKS.mouth[(seat >> 1) % LOOKS.mouth.length],
  extra: "none",
});

const clamp01 = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// an expression as sent, as seven numbers and nothing else, or null if it isn't one
export function cleanExpression(input: unknown): Expression | null {
  if (typeof input !== "object" || input === null) return null;
  const e = input as Record<string, unknown>;
  return Object.fromEntries(KEYS.map((k) => [k, round2(clamp01(e[k]))])) as Expression;
}

// a look as sent, each part one of the choices on offer, or null if any isn't
export function cleanLook(input: unknown): Look | null {
  if (typeof input !== "object" || input === null) return null;
  const l = input as Record<string, unknown>;
  for (const k of Object.keys(LOOKS) as (keyof typeof LOOKS)[]) {
    if (!(LOOKS[k] as readonly unknown[]).includes(l[k])) return null;
  }
  return { skin: l.skin, eyes: l.eyes, mouth: l.mouth, extra: l.extra } as Look;
}

// MediaPipe's expression scores (blend shapes) as an Expression. Its scores
// rarely reach 1, so each is stretched so an ordinary smile or frown moves the
// avatar fully, and a resting face sits at rest.
export function fromShapes(s: Partial<Record<string, number>>): Expression {
  const avg = (...names: string[]): number => names.reduce((n, k) => n + (s[k] ?? 0), 0) / names.length;
  const stretch = (v: number, from: number, to: number): number => round2(clamp01((v - from) / (to - from)));
  return {
    smile: stretch(avg("mouthSmileLeft", "mouthSmileRight"), 0.1, 0.7),
    frown: stretch(avg("mouthFrownLeft", "mouthFrownRight", "mouthPressLeft", "mouthPressRight"), 0.08, 0.45),
    open: stretch(s.jawOpen ?? 0, 0.05, 0.55),
    pucker: stretch(s.mouthPucker ?? 0, 0.2, 0.8),
    browUp: stretch(avg("browInnerUp", "browOuterUpLeft", "browOuterUpRight"), 0.1, 0.6),
    // A real smile pushes the cheeks up and the brows down: MediaPipe gave a
    // broad grin browDown 0.83, which drawn as it stood was a scowl. A smile
    // takes its brows-down away (the eyes crinkle instead); without one,
    // brows down is a frown or a glare.
    browDown: stretch(avg("browDownLeft", "browDownRight") * (1 - Math.min(1, avg("mouthSmileLeft", "mouthSmileRight") * 1.4)), 0.1, 0.55),
    blink: stretch(avg("eyeBlinkLeft", "eyeBlinkRight"), 0.35, 0.75),
  };
}

const n = (v: number): string => (Math.round(v * 10) / 10).toString();

// The avatar as SVG, 100 by 100, in a look, pulling an expression. Each
// feature is drawn from the numbers, so it moves smoothly between any two.
export function avatarSvg(look: Look, e: Expression = REST, label = ""): string {
  const ink = "#1b1f2a";
  // eyes: open height shrinks with a blink, and with a big smile (cheeks push up)
  const lid = Math.max(0.08, 1 - e.blink - e.smile * 0.35);
  const eyeY = 44 - e.browUp * 2;
  const eye = (x: number): string => {
    if (look.eyes === "sleepy") return `<path d="M${x - 6} ${eyeY} q6 ${n(5 * lid)} 12 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    const r = look.eyes === "round" ? 6 : 4.5;
    const shine = look.eyes === "sparkle" ? `<circle cx="${x + 1.8}" cy="${n(eyeY - 1.8 * lid)}" r="1.6" fill="#fff"/>` : "";
    const white = look.eyes === "round" ? `<ellipse cx="${x}" cy="${eyeY}" rx="${r + 2}" ry="${n((r + 2) * lid)}" fill="#fff"/>` : "";
    return `${white}<ellipse cx="${x}" cy="${eyeY}" rx="${r - (look.eyes === "round" ? 2 : 0)}" ry="${n(Math.max(0.6, (r - (look.eyes === "round" ? 2 : 0)) * lid))}" fill="${ink}"/>${shine}`;
  };
  // brows: up lifts them; down drops them and angles the inner ends down
  // (cross); up with a frown lifts the inner ends (worried, sad)
  const brow = (x: number, side: number): string => {
    const y = 33 - e.browUp * 6 + e.browDown * 4;
    const inner = e.browDown * 5 - e.browUp * e.frown * 6 - e.browUp * 1.5;
    const outer = -e.browDown * 1.5 + e.browUp * e.frown * 3;
    return `<path d="M${x - 7 * side} ${n(y + outer)} L${x + 6 * side} ${n(y + inner)}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  };
  // mouth: smile curves the corners up, frown down; open drops the jaw;
  // pucker narrows it to a little "o"
  const w = (look.mouth === "wide" ? 22 : 16) * (1 - e.pucker * 0.55) * (1 + e.smile * 0.15);
  const curve = (e.smile - e.frown) * 9;
  const open = e.open * 16 + e.pucker * 3;
  const my = 66 + e.frown * 2;
  let mouth: string;
  if (look.mouth === "cat" && open < 3) {
    mouth = `<path d="M${n(50 - w / 2)} ${n(my - curve * 0.4)} q${n(w / 4)} ${n(5 + curve * 0.5)} ${n(w / 2)} 0 q${n(w / 4)} ${n(5 + curve * 0.5)} ${n(w / 2)} 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (open < 2.5) {
    mouth = `<path d="M${n(50 - w / 2)} ${n(my - curve * 0.5)} Q50 ${n(my + curve)} ${n(50 + w / 2)} ${n(my - curve * 0.5)}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    // an open mouth: a lip line on top, a jaw that drops below, a tongue
    const top = my - curve * 0.5;
    mouth = `<path d="M${n(50 - w / 2)} ${n(top)} Q50 ${n(my + curve * 0.6)} ${n(50 + w / 2)} ${n(top)} Q50 ${n(my + curve * 0.6 + open + 4)} ${n(50 - w / 2)} ${n(top)} Z" fill="#5a1f2b" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>` +
      (open > 6 ? `<ellipse cx="50" cy="${n(my + curve * 0.4 + open * 0.75)}" rx="${n(w * 0.25)}" ry="${n(open * 0.18)}" fill="#e36a7a"/>` : "");
  }
  const blush = look.extra === "blush" || e.smile > 0.6
    ? `<ellipse cx="29" cy="58" rx="6" ry="3.5" fill="#ff7a8a" opacity="${n(look.extra === "blush" ? 0.55 : (e.smile - 0.6) * 1.2)}"/><ellipse cx="71" cy="58" rx="6" ry="3.5" fill="#ff7a8a" opacity="${n(look.extra === "blush" ? 0.55 : (e.smile - 0.6) * 1.2)}"/>`
    : "";
  const extra = {
    none: "",
    blush: "",
    glasses: `<g fill="none" stroke="${ink}" stroke-width="2.5"><circle cx="36" cy="${eyeY}" r="9"/><circle cx="64" cy="${eyeY}" r="9"/><path d="M45 ${eyeY} h10 M27 ${eyeY - 2} l-7 -3 M73 ${eyeY - 2} l7 -3"/></g>`,
    shades: `<g fill="${ink}"><path d="M24 ${eyeY - 7} h24 v7 q-1 7 -12 7 q-11 0 -12 -7 Z M52 ${eyeY - 7} h24 v7 q-1 7 -12 7 q-11 0 -12 -7 Z"/><path d="M48 ${eyeY - 5} h4" stroke="${ink}" stroke-width="2.5"/></g>`,
    hat: `<path d="M10 25 Q50 10 90 25 L86 31 Q50 19 14 31 Z" fill="#2f3a56"/><path d="M24 24 Q26 -2 50 -2 Q74 -2 76 24 Z" fill="#3d4a6e"/><path d="M24.5 17 Q50 11 75.5 17 L75.8 22 Q50 16 24.2 22 Z" fill="#e0506a"/>`,
    headphones: `<path d="M16 52 Q14 14 50 12 Q86 14 84 52" fill="none" stroke="${ink}" stroke-width="5"/><rect x="9" y="46" width="12" height="20" rx="5" fill="#e0506a"/><rect x="79" y="46" width="12" height="20" rx="5" fill="#e0506a"/>`,
  }[look.extra];
  return `<svg class="avatar" viewBox="0 -4 100 104" role="img" aria-label="${label}"><circle cx="50" cy="52" r="38" fill="${look.skin}" stroke="${ink}" stroke-width="2.5"/>${blush}${brow(36, 1)}${brow(64, -1)}${eye(36)}${eye(64)}${mouth}${extra}</svg>`;
}
