// Each person's avatar as a 3D head, built in code (no model file, nobody
// else's licence), in the look they chose, pulling the face they're pulling
// and turning the way their head turns. The same look and expression as the
// flat avatar in avatar.ts, which stays as the fallback where there's no
// WebGL. three.js comes from the CDN at a pinned version, loaded only once
// there's a head to draw.
//
// One WebGL context for the whole page draws every head (browsers allow only
// a handful of contexts), at one size: each card has a canvas of its own, and
// the shared renderer draws each head in turn and copies it over.
//
// Between what its owner's camera sends, a head keeps living: it moves its
// mouth to each word as the word goes up, turns its eyes (and, if nobody's
// camera is steering it, its head) to whoever is speaking, and blinks.
import { STILL, type Expression, type Look, type Pose } from "./avatar.ts";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
// three.js as loaded from the CDN, untyped: this file only builds meshes
type T = any;

let three: Promise<T> | undefined;
const load = (): Promise<T> => (three ??= import(THREE_URL));

export const webgl = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
})();

type Head = {
  root: T;
  jaw: T;
  lidL: T;
  lidR: T;
  browL: T;
  browR: T;
  irisL: T;
  irisR: T;
  mouth: T;
  lipTop: T;
  lipBottom: T;
  cheeks: T;
  blush: boolean;
  sleepy: boolean;
  look: string;
};

// A head on the page: its look, the face and turn it's easing towards, and
// what it's doing of its own accord.
type Shown = {
  canvas: HTMLCanvasElement;
  head: Head;
  e: Expression;
  pose: Pose;
  target: { e: Expression; pose: Pose | null };
  talk: { from: number; until: number; loud: number };
  gaze: { x: number; y: number };
  glance: { x: number; y: number; at: number };
  blinkAt: number;
};

// how big each head is drawn before it's copied into its card's canvas
const SIZE = 256;
const BLINK = 140; // ms
const still = matchMedia("(prefers-reduced-motion: reduce)");

let renderer: T;
let camera: T;
let scene: T;
const heads = new Map<HTMLElement, Shown>();
let speaker: HTMLElement | null = null;

async function setUp(): Promise<T> {
  const THREE = await load();
  if (renderer) return THREE;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.12, 4.9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.5, 2, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab4ff, 1.2);
  rim.position.set(-2, 1, -2);
  scene.add(rim);
  requestAnimationFrame(frame);
  return THREE;
}

const mat = (THREE: T, color: string | number, rough = 0.55, extra: Record<string, unknown> = {}): T =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

// A head in a look: built once per look, rebuilt when the look changes.
function build(THREE: T, look: Look): Head {
  const root = new THREE.Group();
  const skin = mat(THREE, look.skin, 0.6);
  const ink = mat(THREE, 0x1b1f2a, 0.4);

  // the skull: a sphere, a little taller than wide, a little flat at the back
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin);
  skull.scale.set(1, 1.08, 0.94);
  root.add(skull);
  // ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), skin);
    ear.scale.set(0.5, 0.9, 0.6);
    ear.position.set(side * 0.97, 0.02, -0.05);
    root.add(ear);
  }
  // nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), skin);
  nose.scale.set(0.9, 1, 1.1);
  nose.position.set(0, -0.02, 0.98);
  root.add(nose);

  // eyes: a white ball, an iris and pupil that can look about, and a lid that
  // closes over it
  const eyeStyle = look.eyes;
  const eyeR = eyeStyle === "round" ? 0.2 : 0.16;
  const eyes: T[] = [];
  const irises: T[] = [];
  const lids: T[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * 0.34, 0.18, 0.82);
    const white = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 32, 24), mat(THREE, 0xffffff, 0.25));
    g.add(white);
    const iris = new THREE.Group();
    const irisDisc = new THREE.Mesh(new THREE.CircleGeometry(eyeR * (eyeStyle === "dots" ? 0.62 : 0.5), 32), mat(THREE, eyeStyle === "dots" ? 0x1b1f2a : 0x3a2a1a, 0.3));
    irisDisc.position.z = eyeR * 0.98;
    iris.add(irisDisc);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.26, 24), ink);
    pupil.position.z = eyeR * 0.99;
    iris.add(pupil);
    if (eyeStyle === "sparkle") {
      const shine = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.13, 16), mat(THREE, 0xffffff, 0.1, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
      shine.position.set(eyeR * 0.18, eyeR * 0.18, eyeR * 1.0);
      iris.add(shine);
    }
    g.add(iris);
    // the upper lid: a shell of skin just bigger than the eye, covering its
    // top half; it swings forward and down over the eye to close it
    const lidPivot = new THREE.Group();
    // a little more than a hemisphere, and a little bigger than the eye, so
    // closed it covers the whole front with no rim of white showing
    const lid = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.14, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), skin);
    // its open edge faces forward-down, sitting above the eye at rest
    lid.rotation.x = -0.45;
    lidPivot.add(lid);
    g.add(lidPivot);
    root.add(g);
    eyes.push(g);
    irises.push(iris);
    lids.push(lidPivot);
  }

  // brows: rounded bars that lift, drop and tilt
  const brows: T[] = [];
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 6, 12), ink);
    brow.rotation.z = Math.PI / 2;
    brow.position.set(side * 0.34, 0.44, 0.9);
    root.add(brow);
    brows.push(brow);
  }

  // the mouth: two lips drawn as tubes along curves that bend with the
  // expression (rebuilt as it changes, see pose()), a dark opening between
  // them, and teeth and a tongue that show as it opens
  const mouthW = look.mouth === "wide" ? 0.34 : 0.27;
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.36, 0.88);
  // follow the face's curve: tilt the mouth to lie on the sphere
  mouth.rotation.x = -0.18;
  root.add(mouth);
  const lipMat = mat(THREE, look.mouth === "cat" ? 0x2a2230 : 0xb0505f, 0.45);
  const lipTop = new THREE.Mesh(new THREE.BufferGeometry(), lipMat);
  const lipBottom = new THREE.Mesh(new THREE.BufferGeometry(), lipMat);
  const cavity = new THREE.Mesh(new THREE.BufferGeometry(), mat(THREE, 0x3e121c, 0.85, { side: THREE.DoubleSide }));
  cavity.position.z = -0.012;
  mouth.add(cavity, lipTop, lipBottom);
  const jaw = new THREE.Group();
  mouth.add(jaw);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(mouthW * 1.05, 0.045, 0.03), mat(THREE, 0xf7f3ea, 0.3));
  teeth.position.set(0, -0.02, -0.02);
  mouth.add(teeth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(mouthW * 0.42, 24, 12), mat(THREE, 0xe36a7a, 0.6));
  tongue.scale.set(1, 0.3, 0.55);
  tongue.position.set(0, -0.02, -0.035);
  jaw.add(tongue);
  mouth.userData = { THREE, w: mouthW, teeth, tongue, cat: look.mouth === "cat" };

  // blush, shown with "blush" or a big smile
  const cheeks = new THREE.Group();
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), mat(THREE, 0xff7a8a, 0.9, { transparent: true, opacity: 0.0 }));
    c.position.set(side * 0.55, -0.1, 0.82);
    c.rotation.y = side * 0.55;
    cheeks.add(c);
  }
  root.add(cheeks);

  // what they're wearing
  if (look.extra === "glasses" || look.extra === "shades") {
    const frame = look.extra === "shades" ? mat(THREE, 0x111111, 0.2, { metalness: 0.4 }) : ink;
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 10, 32), frame);
      rim.position.set(side * 0.34, 0.18, 1.0);
      root.add(rim);
      if (look.extra === "shades") {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.21, 32), mat(THREE, 0x0a0a12, 0.1, { metalness: 0.6 }));
        lens.position.set(side * 0.34, 0.18, 1.01);
        root.add(lens);
      }
    }
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.18, 4, 8), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.2, 1.03);
    root.add(bridge);
  } else if (look.extra === "hat") {
    const felt = mat(THREE, 0x3d4a6e, 0.8);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.05, 48), felt);
    brim.position.y = 0.62;
    brim.rotation.x = -0.08;
    root.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.78, 0.52, 48), felt);
    crown.position.y = 0.9;
    crown.rotation.x = -0.08;
    root.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.785, 0.79, 0.1, 48), mat(THREE, 0xe0506a, 0.6));
    band.position.y = 0.7;
    band.rotation.x = -0.08;
    root.add(band);
  } else if (look.extra === "headphones") {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 12, 48, Math.PI), mat(THREE, 0x1b1f2a, 0.4));
    band.position.y = 0.05;
    root.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), mat(THREE, 0xe0506a, 0.4));
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 1.02, 0.02, 0);
      root.add(cup);
    }
  }

  return { root, jaw, lidL: lids[0], lidR: lids[1], browL: brows[0], browR: brows[1], irisL: irises[0], irisR: irises[1], mouth, lipTop, lipBottom, cheeks, blush: look.extra === "blush", sleepy: look.eyes === "sleepy", look: JSON.stringify(look) };
}

// set a head's face, turn and gaze (-1 to 1 across and up)
function pose(h: Head, e: Expression, p: Pose, gaze: { x: number; y: number }): void {
  h.root.rotation.set(p.pitch, p.yaw, p.roll);
  // lids: open (half shut, for sleepy eyes), swinging down over the eye with
  // a blink, and partway with a big smile (the cheeks push up) or a glare
  // (a smile narrows them only a little: much more read as sleepy, not happy)
  const close = Math.min(1, (h.sleepy ? 0.32 : 0) + e.blink + e.smile * 0.15 + e.browDown * 0.12);
  for (const lid of [h.lidL, h.lidR]) lid.rotation.x = close * 1.95;
  // eyes: the irises turn in their sockets, less far up than down, so
  // looking up doesn't take them under the lid
  for (const iris of [h.irisL, h.irisR]) iris.rotation.set(-gaze.y * (gaze.y > 0 ? 0.12 : 0.3), gaze.x * 0.45, 0);
  // brows: up lifts; down drops and angles the inner ends down (cross);
  // up with a frown lifts the inner ends (worried)
  const y = 0.44 + e.browUp * 0.09 - e.browDown * 0.05;
  const tilt = e.browDown * 0.35 - e.browUp * e.frown * 0.4;
  h.browL.position.y = y;
  h.browR.position.y = y;
  h.browL.rotation.z = Math.PI / 2 - tilt;
  h.browR.rotation.z = Math.PI / 2 + tilt;
  shapeMouth(h, e);
  for (const c of h.cheeks.children) c.material.opacity = h.blush ? 0.5 : Math.max(0, (e.smile - 0.55) * 1.2);
}

// The lips as curves: corners up with a smile, down with a frown, the lower
// lip dropping as the jaw opens, the whole mouth narrowing to a pucker. Each
// lip is a tube along its curve, and the opening is filled between them.
// Rebuilt only when the face has moved enough to see.
function shapeMouth(h: Head, e: Expression): void {
  const u = h.mouth.userData as { THREE: T; w: number; teeth: T; tongue: T; cat: boolean; key?: string };
  const key = [e.smile, e.frown, e.open, e.pucker].map((v) => Math.round(v * 40)).join(",");
  if (u.key === key) return;
  u.key = key;
  const THREE = u.THREE;
  const w = u.w * (1 - e.pucker * 0.5) * (1 + e.smile * 0.18);
  const lift = (e.smile - e.frown) * 0.075; // corners up (+) or down (-)
  const open = e.open * 0.2 + e.pucker * 0.035;
  const N = 16;
  const curve = (dip: number, drop: number): T[] =>
    Array.from({ length: N + 1 }, (_, i) => {
      const x = (i / N) * 2 - 1; // -1 to 1 across the mouth
      // the corners rise with lift; the middle dips (or rises) by dip; the
      // lower lip drops by drop at the middle, less at the corners
      const y = lift * x * x - lift * 0.35 + dip * (1 - x * x) - drop * (1 - x * x * 0.7);
      const z = -0.04 * x * x; // curving back round the face
      return new THREE.Vector3(x * w, y, z);
    });
  const top = curve(e.pucker * 0.01, 0);
  const bottom = curve(-0.006, open);
  const tube = (pts: T[], r: number): T => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, r, 8, false);
  h.lipTop.geometry.dispose();
  h.lipBottom.geometry.dispose();
  h.lipTop.geometry = tube(top, u.cat ? 0.018 : 0.026);
  h.lipBottom.geometry = tube(bottom, u.cat ? 0.018 : 0.03);
  // the opening between them, as a strip
  const pos: number[] = [];
  for (let i = 0; i < N; i++) {
    const [a, b, c, d] = [top[i], top[i + 1], bottom[i], bottom[i + 1]];
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  const cavity = h.mouth.children[0];
  cavity.geometry.dispose();
  cavity.geometry = new THREE.BufferGeometry();
  cavity.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  cavity.geometry.computeVertexNormals();
  // teeth show once it's open a little; the tongue rides the jaw
  u.teeth.visible = open > 0.03;
  u.teeth.position.y = -lift * 0.35 - 0.012;
  u.teeth.scale.x = w / u.w;
  u.tongue.visible = open > 0.06;
  u.tongue.position.y = -open * 0.75;
}

// a head no longer drawn gives back what the GPU was holding for it
function drop(h: Head): void {
  h.root.traverse((o: T) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const ease = (a: number, b: number, k: number): number => a + (b - a) * k;
const centre = (el: Element): { x: number; y: number } => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Heads are drawn at most FPS times a second: smooth enough for a face, and
// half the work of a fast screen's every frame, which matters in a full room
// on a phone.
const FPS = 30;
let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  if (now - last < 1000 / FPS - 2) return;
  // easing by the time since the last frame, so heads move at the same
  // speed on a slow screen as a fast one
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const k = (perSecond: number): number => 1 - Math.exp(-perSecond * dt);
  const calm = still.matches;
  const t = now / 1000;
  const talker = speaker && heads.has(speaker) ? centre(speaker) : null;
  for (const [slot, s] of heads) {
    if (!s.canvas.isConnected) {
      heads.delete(slot);
      speaking(slot, false);
      drop(s.head);
      continue;
    }
    const r = s.canvas.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    for (const key of Object.keys(s.e) as (keyof Expression)[]) s.e[key] = ease(s.e[key], s.target.e[key], k(14));
    // eyes on whoever's speaking; with nobody speaking (or when it's them),
    // a glance somewhere now and then
    const me = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    let look = { x: s.glance.x, y: s.glance.y };
    if (talker && speaker !== slot) look = { x: clamp((talker.x - me.x) / 500, -1, 1), y: clamp((me.y - talker.y) / 500, -1, 1) };
    else if (!calm && now > s.glance.at) s.glance = { x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.4, at: now + 1800 + Math.random() * 3500 };
    s.gaze.x = ease(s.gaze.x, look.x, k(8));
    s.gaze.y = ease(s.gaze.y, look.y, k(8));
    // turned as its owner's head is turned, if their camera's on; if not,
    // a little towards where it's looking, swaying slightly
    const sway = calm ? STILL : { pitch: Math.sin(t * 0.9 + r.left) * 0.025, yaw: Math.sin(t * 0.6 + r.top) * 0.04, roll: Math.sin(t * 0.5 + r.left) * 0.015 };
    const to = s.target.pose ?? { pitch: -s.gaze.y * 0.15 + sway.pitch, yaw: s.gaze.x * 0.3 + sway.yaw, roll: sway.roll };
    for (const key of Object.keys(s.pose) as (keyof Pose)[]) s.pose[key] = ease(s.pose[key], to[key], k(10));
    // the mouth, moving with each word as it goes up: open once per
    // syllable, wider for a louder word, held open through a drawn-out one
    const e = { ...s.e };
    if (!calm && now < s.talk.until) {
      // (a syllable's start comes from a timer, which can be a moment ahead
      // of this frame's clock)
      const done = clamp((now - s.talk.from) / (s.talk.until - s.talk.from), 0, 1);
      e.open = Math.max(e.open, s.talk.loud * Math.pow(Math.sin(Math.PI * done), 0.6));
    }
    // and a blink every few seconds, BLINK long
    if (!calm && now >= s.blinkAt) {
      if (now < s.blinkAt + BLINK) e.blink = 1;
      else s.blinkAt = now + 2200 + Math.random() * 4000;
    }
    pose(s.head, e, s.pose, s.gaze);
    scene.add(s.head.root);
    renderer.render(scene, camera);
    scene.remove(s.head.root);
    const ctx = s.canvas.getContext("2d");
    ctx?.clearRect(0, 0, SIZE, SIZE);
    ctx?.drawImage(renderer.domElement, 0, 0);
  }
}

// Draw (or redraw) a person's head in their avatar's slot, in their look,
// pulling their face and, if their camera's sending it, turned as their head
// is. The flat avatar already in the slot stays until three.js has loaded,
// and for good where there's no WebGL: then this returns false.
export async function head3d(slot: HTMLElement, look: Look, e: Expression, p: Pose | null = null): Promise<boolean> {
  if (!webgl) return false;
  try {
    const THREE = await setUp();
    const known = heads.get(slot);
    const lookKey = JSON.stringify(look);
    if (known && known.head.look === lookKey && known.canvas.isConnected) {
      known.target = { e: { ...e }, pose: p && { ...p } };
      return true;
    }
    const label = slot.querySelector("[aria-label]")?.getAttribute("aria-label") ?? known?.canvas.getAttribute("aria-label") ?? "";
    if (known) drop(known.head);
    const canvas = known?.canvas.isConnected ? known.canvas : document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.className = "avatar head3d";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);
    if (!canvas.isConnected) slot.replaceChildren(canvas);
    heads.set(slot, {
      canvas,
      head: build(THREE, look),
      e: known?.e ?? { ...e },
      pose: known?.pose ?? { ...(p ?? STILL) },
      target: { e: { ...e }, pose: p && { ...p } },
      talk: known?.talk ?? { from: 0, until: 0, loud: 0 },
      gaze: known?.gaze ?? { x: 0, y: 0 },
      glance: known?.glance ?? { x: 0, y: 0, at: 0 },
      blinkAt: known?.blinkAt ?? performance.now() + Math.random() * 4000,
    });
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// A word going up for a head: its mouth moves for as long as it was said,
// opening once per syllable, wider the louder it was (dB against the
// speaker's typical word, as in voice.ts).
export function mouthWord(slot: HTMLElement, seconds: number, loud: number, syllables: number): void {
  const s = heads.get(slot);
  if (!s) return;
  const now = performance.now();
  // one opening per syllable, back to back, so a word of three moves three times
  const each = Math.max(0.12, seconds / Math.max(1, syllables));
  s.talk = { from: now, until: now + each * 1000, loud: clamp(0.45 + loud / 30, 0.2, 0.85) };
  for (let i = 1; i < syllables; i++) {
    window.setTimeout(() => {
      const at = performance.now();
      if (heads.get(slot) === s) s.talk = { from: at, until: at + each * 1000, loud: s.talk.loud };
    }, i * each * 1000);
  }
}

// Who's speaking now, so every other head can look at them; the last to
// start, if several are.
const talking: HTMLElement[] = [];
export function speaking(slot: HTMLElement, on: boolean): void {
  const i = talking.indexOf(slot);
  if (i >= 0) talking.splice(i, 1);
  if (on) talking.push(slot);
  speaker = talking.at(-1) ?? null;
}
