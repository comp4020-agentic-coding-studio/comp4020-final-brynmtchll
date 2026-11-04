// The room: everyone in one place, around a low table in a warm room, as a
// 3D scene, instead of a card each. Each person sits in a seat on an arc
// facing whoever's looking, their own avatar as it is on their card (the
// same head, face, mouth, arms and emotes: head3d.ts poses them, and hands
// them here to draw). Over each head, their name and the word they're
// saying, drawn the way they said it, as on their card: the words stay
// words on the page, and the cards stay underneath, where a screen reader
// finds them.
//
// Everything in the room is made here, in code: its shapes, and the grain of
// its floor, the weave of its rug, the view from its window and the pictures
// on its walls, painted onto canvases (nothing to download, nobody else's
// licence). What doesn't move is merged into a few meshes, one per material,
// so the room costs a handful of draw calls however much is in it.
//
// It's lit as a room at dusk: warm light from the window low across the
// floor, a lamp glowing in the corner, and light from all round (a room
// blurred into light, three.js's RoomEnvironment), with a soft shadow on the
// floor under each chair and the table. Then, where the screen can afford
// it, a glow round what's brightest (bloom: the window, the lamp) and a
// gentle darkening at the edges. A screen that can't keep up loses those,
// then draws at fewer pixels; a phone starts without. (Shading where things
// meet, from the depth drawn, GTAO, was tried: at any strength that showed,
// it left a grainy halo along every edge against the window.)
//
// The camera frames everyone and leans towards whoever's talking, or (the
// view bar) closes in on the speaker, stands back for the whole room, or
// looks down from above. Dragging turns it round the table, scrolling or
// pinching zooms, a double click puts it back (camera.ts keeps it inside
// the room).
import { roomView, type RoomHead } from "./head3d.ts";
import { seatPlaces } from "./seats.ts";
import { fovFor, held, LEVEL, MOST_YAW, RISE, shotFor, turned, VIEWS, ZOOM, type Shot, type Turn, type View } from "./camera.ts";

type T = any;

// where seats go: an arc behind the table, as wide as there are people
const MOST_SEATS = 12;
const CROWD = 6; // more than this, and only some are named over their heads
const FLOOR = -5.2; // where the floor is, below a seated head's middle

type Seat = { group: T; chair: T; riser: T; holds: RoomHead | null };
type Quality = 0 | 1; // 0: plain; 1: a glow and darker edges
type Room = {
  THREE: T;
  renderer: T;
  scene: T;
  camera: T;
  post: Post | null;
  seats: Seat[];
  // the camera as drawn: where it stands and looks, eased towards the shot
  eye: { at: number[]; look: number[] } | null;
  view: View;
  turn: Turn; // as the watcher's dragged it
  focus: HTMLElement | null; // who the speaker view is on
  labels: Map<HTMLElement, HTMLElement>;
  overlay: HTMLElement;
  canvas: HTMLCanvasElement;
  at: Map<HTMLElement, { x: number; y: number }>;
  seatOf: Map<HTMLElement, number>;
  activeAt: Map<HTMLElement, number>; // when each was last talking or had a hand up
  last: number;
  // how long frames are taking, to draw less when they're slow
  slow: { frames: number; over: number; since: number };
  quality: Quality;
  pixels: number; // a share of the screen's own pixel ratio
  shadowFrame: number;
  // how fast it was being turned when let go (per second), so it glides to
  // a stop rather than stopping dead
  spin: { yaw: number; pitch: number };
  framed: Shot | null; // the shot for the view, before it's turned
};

let room: Room | null = null;
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---- painted surfaces ----

// A canvas painted by `paint`, as a texture: in colour (sRGB), repeating,
// smoothed when seen at a slant.
function painted(THREE: T, w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number] = [1, 1]): T {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
// the same random numbers every time, so the room looks the same to everyone
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// floorboards: long planks, each its own shade, with grain along them and a
// dark seam between
function boards(g: CanvasRenderingContext2D, w: number, h: number): void {
  const rnd = seeded(7);
  const rows = 8;
  const ph = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * w * 0.5;
    while (x < w) {
      const len = w * (0.35 + rnd() * 0.4);
      const l = 36 + rnd() * 10;
      g.fillStyle = `hsl(${24 + rnd() * 8} ${42 + rnd() * 10}% ${l}%)`;
      g.fillRect(x, r * ph, len, ph);
      // grain: thin streaks along the plank, darker and lighter
      for (let i = 0; i < 26; i++) {
        const y = r * ph + rnd() * ph;
        g.strokeStyle = `hsl(24 40% ${l + (rnd() - 0.5) * 16}% / ${0.12 + rnd() * 0.2})`;
        g.lineWidth = 0.6 + rnd() * 1.6;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 1; s <= 6; s++) g.lineTo(x + (len * s) / 6, y + (rnd() - 0.5) * 3);
        g.stroke();
      }
      // a knot, now and then
      if (rnd() < 0.25) {
        const kx = x + rnd() * len, ky = r * ph + ph * (0.3 + rnd() * 0.4);
        const grad = g.createRadialGradient(kx, ky, 0, kx, ky, 7);
        grad.addColorStop(0, "hsl(20 45% 22% / 0.8)");
        grad.addColorStop(1, "hsl(20 45% 30% / 0)");
        g.fillStyle = grad;
        g.fillRect(kx - 8, ky - 8, 16, 16);
      }
      g.fillStyle = "hsl(20 40% 14% / 0.85)";
      g.fillRect(x + len - 1.5, r * ph, 1.5, ph);
      x += len;
    }
    g.fillStyle = "hsl(20 40% 12% / 0.9)";
    g.fillRect(0, r * ph, w, 2);
  }
}

// the rug: rings of colour round its middle, a woven texture, a fringe of
// pattern near its edge
function rug(g: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2, cy = h / 2, R = w / 2;
  const rings: [number, string][] = [[1, "#7a3443"], [0.93, "#d9a441"], [0.9, "#7a3443"], [0.8, "#5a2633"], [0.78, "#e8c27a"], [0.74, "#8c3d4f"], [0.42, "#a8505f"], [0.38, "#e8c27a"], [0.35, "#8c3d4f"]];
  for (const [r, c] of rings) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(cx, cy, R * r, 0, Math.PI * 2);
    g.fill();
  }
  // a band of diamonds between the rings
  g.fillStyle = "#e8c27a";
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = R * 0.85;
    g.save();
    g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.rotate(a);
    g.beginPath();
    g.moveTo(-R * 0.03, 0);
    g.lineTo(0, -R * 0.022);
    g.lineTo(R * 0.03, 0);
    g.lineTo(0, R * 0.022);
    g.fill();
    g.restore();
  }
  // the weave: fine noise over all of it
  const img = g.getImageData(0, 0, w, h);
  const rnd = seeded(3);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22 + (((i >> 2) % w) % 3 === 0 ? -6 : 0);
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// the view from the window: a sky going from blue to gold, a low sun, a
// few clouds, hills fading into the distance, and a line of trees
function view(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#3d5f9e");
  sky.addColorStop(0.45, "#8fa6cf");
  sky.addColorStop(0.72, "#f3c48a");
  sky.addColorStop(0.86, "#ffb070");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // the sun, low, with a halo
  const sx = w * 0.68, sy = h * 0.7;
  const halo = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.5);
  halo.addColorStop(0, "rgb(255 236 190 / 1)");
  halo.addColorStop(0.08, "rgb(255 220 160 / 0.9)");
  halo.addColorStop(0.4, "rgb(255 190 120 / 0.25)");
  halo.addColorStop(1, "rgb(255 190 120 / 0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  // clouds: soft streaks lit from below
  const rnd = seeded(11);
  for (let i = 0; i < 9; i++) {
    const cx = rnd() * w, cy = h * (0.15 + rnd() * 0.4), cw = w * (0.15 + rnd() * 0.25);
    const c = g.createRadialGradient(cx, cy, 0, cx, cy, cw / 2);
    c.addColorStop(0, `rgb(255 ${200 + rnd() * 40} ${190 + rnd() * 30} / 0.55)`);
    c.addColorStop(1, "rgb(255 220 200 / 0)");
    g.save();
    g.translate(cx, cy);
    g.scale(1, 0.18);
    g.translate(-cx, -cy);
    g.fillStyle = c;
    g.fillRect(cx - cw, cy - cw, cw * 2, cw * 2);
    g.restore();
  }
  // hills, furthest first, each nearer one darker and greener
  const hills: [number, string, number][] = [[0.66, "#7f8fb3", 0.05], [0.72, "#5f7f86", 0.07], [0.8, "#3f6b55", 0.09], [0.9, "#2c4f3d", 0.06]];
  for (const [base, colour, amp] of hills) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (base - amp * (Math.sin(x / w * 5 + base * 20) * 0.6 + Math.sin(x / w * 13 + base * 7) * 0.4)));
    g.lineTo(w, h);
    g.fill();
  }
  // a line of trees along the nearest
  g.fillStyle = "#213d2f";
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = h * (0.86 + rnd() * 0.04), r = h * (0.015 + rnd() * 0.025);
    g.beginPath();
    g.ellipse(x, y, r * 0.8, r * 1.6, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// a picture for the wall: soft shapes of colour, as a print would have
function print(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = "#f2ead8";
  g.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = [[0.32, 0.42, 0.3, "#e0506a"], [0.66, 0.55, 0.28, "#f2c14e"], [0.5, 0.3, 0.16, "#4ec9b0"], [0.38, 0.72, 0.18, "#3d4a6e"]];
  for (const [x, y, r, c] of blobs) {
    g.globalAlpha = 0.88;
    g.fillStyle = c;
    g.beginPath();
    g.arc(x * w, y * h, r * w, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
// and another: a few lines, as a drawing of the hills
function lines(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = "#1f2633";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#e8c27a";
  g.lineWidth = w * 0.012;
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.35 + i * 0.15;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h * (0.3 + i * 0.12) - Math.sin(x / w * 6 + i) * h * 0.05);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#ff9a6a";
  g.beginPath();
  g.arc(w * 0.72, h * 0.22, w * 0.07, 0, Math.PI * 2);
  g.fill();
}
// plaster, a little uneven, for the walls
function plaster(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = "#808080";
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const rnd = seeded(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (rnd() - 0.5) * 18;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  g.putImageData(img, 0, 0);
  // blurred into soft unevenness
  g.filter = "blur(2px)";
  g.drawImage(g.canvas, 0, 0);
  g.filter = "none";
}
// a soft round shadow, dark in the middle and gone at the edge, to lay
// under something on the floor or the table (where its own shadow would be
// hard or missing)
function blot(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, "rgb(0 0 0 / 0.55)");
  grad.addColorStop(0.5, "rgb(0 0 0 / 0.3)");
  grad.addColorStop(1, "rgb(0 0 0 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// ---- the room itself ----

// Everything that doesn't move, gathered by material and merged into one
// mesh each (as built, each piece placed and turned where it goes).
type Kit = { THREE: T; add: (geo: T, material: T, at?: number[], rot?: number[], scale?: number[]) => void };
function kit(THREE: T, scene: T, merge: (g: T[]) => T): Kit & { done: (shadows: Set<T>) => void } {
  const byMat = new Map<T, T[]>();
  const add: Kit["add"] = (geo, material, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    // (every piece with the same attributes, so they merge)
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    g.applyMatrix4(m);
    byMat.set(material, [...(byMat.get(material) ?? []), g]);
  };
  return {
    THREE,
    add,
    done: (shadows) => {
      for (const [material, geos] of byMat) {
        const merged = merge(geos);
        for (const g of geos) g.dispose();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = shadows.has(material);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);
      }
    },
  };
}

const mat = (THREE: T, color: number | string, rough = 0.7, extra: Record<string, unknown> = {}): T => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

function furnish(THREE: T, scene: T, merge: (g: T[]) => T, RoundedBox: T): { lamp: T; sun: T } {
  scene.background = new THREE.Color(0x141824);
  scene.fog = new THREE.Fog(0x141824, 46, 90);
  // light from above and below: warm from the ceiling, cool off the floor
  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a2f45, 0.55));
  // late sun through the window, low and gold, throwing long soft shadows
  const sun = new THREE.DirectionalLight(0xffc68a, 3.2);
  sun.position.set(-14, 16, -30);
  sun.target.position.set(2, FLOOR, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  // a soft light from in front, a little cool, so faces read
  const front = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  front.position.set(4, 8, 24);
  scene.add(front);
  // and the window's light bouncing across the room, warm, onto the far wall
  const bounce = new THREE.DirectionalLight(0xffd9b0, 0.5);
  bounce.position.set(-20, 6, 4);
  scene.add(bounce);

  const k = kit(THREE, scene, merge);
  // the floor: boards, a little sheen
  const floorTex = painted(THREE, 1024, 1024, boards, [3, 3]);
  const floor = mat(THREE, 0xffffff, 0.62, { map: floorTex });
  const fl = new THREE.PlaneGeometry(60, 66);
  fl.rotateX(-Math.PI / 2);
  k.add(fl, floor, [0, FLOOR, 7]);
  // a big round rug under where everyone sits
  const rugMat = mat(THREE, 0xffffff, 0.95, { map: painted(THREE, 1024, 1024, rug) });
  const rugGeo = new THREE.CircleGeometry(15.5, 96);
  rugGeo.rotateX(-Math.PI / 2);
  k.add(rugGeo, rugMat, [0, FLOOR + 0.03, -8]);

  // walls: plaster, a deep blue-grey, with a skirting board; one behind,
  // with a window; one each side
  const wallTex = painted(THREE, 256, 256, plaster, [6, 4]);
  const wall = mat(THREE, 0x434c66, 0.95, { map: wallTex });
  // (tall enough that a phone's tall view, pulled back for a crowd, doesn't
  // see over them)
  const H = 40;
  // the back wall, built round the window: below it, above it, either side
  const win = { x: -6, y: FLOOR + 14, w: 22, h: 11 };
  const backZ = -26;
  const piece = (x0: number, x1: number, y0: number, y1: number): void => k.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.5), wall, [(x0 + x1) / 2, (y0 + y1) / 2, backZ]);
  piece(-30, 30, FLOOR, win.y - win.h / 2);
  piece(-30, 30, win.y + win.h / 2, FLOOR + H);
  piece(-30, win.x - win.w / 2, win.y - win.h / 2, win.y + win.h / 2);
  piece(win.x + win.w / 2, 30, win.y - win.h / 2, win.y + win.h / 2);
  for (const side of [-1, 1]) k.add(new THREE.BoxGeometry(0.5, H, 66), wall, [side * 26, FLOOR + H / 2, 7]);
  // and one in front, behind whoever's looking (seen only once the camera's
  // turned), with a door in it
  const frontZ = 40;
  const door = { x: 14, w: 6, h: 13 };
  const fpiece = (x0: number, x1: number, y0: number, y1: number): void => k.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.5), wall, [(x0 + x1) / 2, (y0 + y1) / 2, frontZ]);
  fpiece(-30, door.x - door.w / 2, FLOOR, FLOOR + H);
  fpiece(door.x + door.w / 2, 30, FLOOR, FLOOR + H);
  fpiece(door.x - door.w / 2, door.x + door.w / 2, FLOOR + door.h, FLOOR + H);
  // skirting and a picture rail, cream
  const trim = mat(THREE, 0xe9dfcc, 0.55);
  k.add(new THREE.BoxGeometry(52, 0.9, 0.2), trim, [0, FLOOR + 0.45, backZ + 0.3]);
  for (const side of [-1, 1]) k.add(new THREE.BoxGeometry(0.2, 0.9, 66), trim, [side * 25.7, FLOOR + 0.45, 7]);
  k.add(new THREE.BoxGeometry(52, 0.9, 0.2), trim, [0, FLOOR + 0.45, frontZ - 0.3]);
  // the door: a frame, and a panelled door in it, a brass handle
  for (const [w, h, x, y] of [[0.5, door.h, -door.w / 2 - 0.25, door.h / 2], [0.5, door.h, door.w / 2 + 0.25, door.h / 2], [door.w + 1, 0.5, 0, door.h + 0.25]] as const) {
    k.add(new THREE.BoxGeometry(w, h, 0.9), trim, [door.x + x, FLOOR + y, frontZ]);
  }
  k.add(new THREE.BoxGeometry(door.w, door.h, 0.3), trim, [door.x, FLOOR + door.h / 2, frontZ + 0.1]);
  for (const y of [3.4, 9.2]) k.add(new RoundedBox(door.w - 1.6, 4.4, 0.2, 2, 0.08), trim, [door.x, FLOOR + y, frontZ - 0.1]);
  k.add(new THREE.BoxGeometry(52, 0.3, 0.3), trim, [0, FLOOR + 21.5, backZ + 0.35]);
  // the window: the view, a deep frame and a sill, glazing bars
  const viewTex = painted(THREE, 1024, 512, view);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshBasicMaterial({ map: viewTex, toneMapped: true, fog: false }));
  outside.position.set(win.x, win.y, backZ - 0.6);
  // (bright, so the sky glows a little: bloom picks it up)
  outside.material.color.setScalar(1.35);
  scene.add(outside);
  const frame = mat(THREE, 0xf1e6d2, 0.5);
  for (const [w, h, x, y] of [[win.w + 1, 0.6, 0, win.h / 2 + 0.3], [win.w + 1, 0.6, 0, -win.h / 2 - 0.3], [0.6, win.h + 1.2, -win.w / 2 - 0.3, 0], [0.6, win.h + 1.2, win.w / 2 + 0.3, 0], [0.22, win.h, 0, 0], [win.w, 0.22, 0, 0.6]] as const) {
    k.add(new THREE.BoxGeometry(w, h, 1.4), frame, [win.x + x, win.y + y, backZ + 0.1]);
  }
  // the reveal: the wall's depth round the glass
  for (const [w, h, x, y] of [[win.w, 0.1, 0, win.h / 2], [win.w, 0.1, 0, -win.h / 2], [0.1, win.h, -win.w / 2, 0], [0.1, win.h, win.w / 2, 0]] as const) {
    k.add(new THREE.BoxGeometry(w, h, 0.9), wall, [win.x + x, win.y + y, backZ - 0.3]);
  }
  k.add(new RoundedBox(win.w + 2.4, 0.4, 1.8, 2, 0.12), frame, [win.x, win.y - win.h / 2 - 0.7, backZ + 0.8]);
  // curtains either side, heavy and soft, in folds
  const curtain = mat(THREE, 0x8c3d4f, 0.9, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(4.2, 15, 24, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 4.2) * 0.35);
    g.computeVertexNormals();
    k.add(g, curtain, [win.x + side * (win.w / 2 + 2.4), win.y - 1.2, backZ + 1.2]);
  }
  k.add(new THREE.CylinderGeometry(0.12, 0.12, win.w + 10, 10), mat(THREE, 0x2b2f3a, 0.35, { metalness: 0.6 }), [win.x, win.y + win.h / 2 + 1.4, backZ + 1.2], [0, 0, Math.PI / 2]);
  // pictures on the wall, framed
  const darkWood = mat(THREE, 0x3a2a1f, 0.5);
  for (const [x, y, w, h, paint] of [[13, 15, 6, 4.4, print], [19.5, 16.2, 3.2, 4.2, lines]] as const) {
    k.add(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3), darkWood, [x, FLOOR + y, backZ + 0.4]);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(THREE, 0xffffff, 0.8, { map: painted(THREE, 512, Math.round((512 * h) / w), paint) }));
    pic.position.set(x, FLOOR + y, backZ + 0.56);
    scene.add(pic);
  }
  // shelves of books, against the right wall
  const wood = mat(THREE, 0x6b4a2e, 0.65);
  k.add(new THREE.BoxGeometry(7.4, 12, 0.3), wood, [19, FLOOR + 6, backZ + 0.4]);
  for (const x of [15.4, 22.6]) k.add(new THREE.BoxGeometry(0.3, 12, 2.4), wood, [x, FLOOR + 6, backZ + 1.4]);
  const books = [0xb33a2b, 0x3d4a6e, 0xd9a441, 0x3f8f5a, 0xe8e8ec, 0x7a3fb5, 0x2f6f7a, 0xc96f3b].map((c) => mat(THREE, c, 0.75));
  for (const y of [0.3, 3.8, 7.3, 11.6]) {
    k.add(new THREE.BoxGeometry(7.4, 0.3, 2.4), wood, [19, FLOOR + y, backZ + 1.4]);
    if (y > 11) continue;
    let x = 15.7;
    let n = Math.round(y * 7);
    while (x < 22) {
      const w = 0.32 + ((n * 17) % 5) / 12;
      const h = 2 + ((n * 7) % 4) / 4;
      const lean = n % 9 === 0 ? 0.22 : 0;
      k.add(new RoundedBox(w, h, 1.7, 1, 0.05), books[n % books.length], [x + w / 2, FLOOR + y + 0.15 + h / 2, backZ + 1.4], [0, 0, lean]);
      x += w + 0.04 + (lean ? 0.4 : 0);
      n++;
    }
  }
  // a lamp in the corner: a tripod of legs, a drum shade, glowing
  const lampAt = [-19, FLOOR, -15];
  const brass = mat(THREE, 0xc9a25a, 0.3, { metalness: 0.8 });
  k.add(new THREE.SphereGeometry(0.28, 16, 12), brass, [14 - 2.2, FLOOR + 6.4, 40 - 0.5]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.add(new THREE.CylinderGeometry(0.09, 0.07, 11.5, 8), brass, [lampAt[0] + Math.cos(a) * 0.8, FLOOR + 5.6, lampAt[2] + Math.sin(a) * 0.8], [Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]);
  }
  const glow = mat(THREE, 0xfff1d6, 0.9, { side: THREE.DoubleSide, emissive: 0xffc070, emissiveIntensity: 1.6 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 2.4, 32, 1, true), glow);
  shade.position.set(lampAt[0], FLOOR + 12.4, lampAt[2]);
  scene.add(shade);
  const lamp = new THREE.PointLight(0xffb866, 70, 34, 1.5);
  lamp.position.set(lampAt[0], FLOOR + 12, lampAt[2]);
  scene.add(lamp);
  // a pool of light under it, on the floor
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(lampAt[0], FLOOR + 0.05, lampAt[2]);
  scene.add(pool);
  // an armchair by it, and a side table
  const velvet = mat(THREE, 0x2f5f5a, 0.85);
  const cx = -18, cz = -7;
  k.add(new RoundedBox(4.6, 1.4, 4, 3, 0.4), velvet, [cx, FLOOR + 1.6, cz], [0, 0.5, 0]);
  k.add(new RoundedBox(4.6, 3.6, 1, 3, 0.4), velvet, [cx - 1.9 * Math.sin(0.5), FLOOR + 3.4, cz - 1.9 * Math.cos(0.5)], [-0.12, 0.5, 0]);
  for (const s of [-1, 1]) k.add(new RoundedBox(0.9, 2.2, 4, 3, 0.35), velvet, [cx + s * 2.1 * Math.cos(0.5), FLOOR + 2.3, cz - s * 2.1 * Math.sin(0.5)], [0, 0.5, 0]);
  for (const [dx, dz] of [[-1.7, -1.5], [1.7, -1.5], [-1.7, 1.5], [1.7, 1.5]]) k.add(new THREE.CylinderGeometry(0.12, 0.08, 0.9, 8), darkWood, [cx + dx * Math.cos(0.5) + dz * Math.sin(0.5), FLOOR + 0.45, cz - dx * Math.sin(0.5) + dz * Math.cos(0.5)]);
  // plants: a pot, and leaves fanning out of it
  const leafA = mat(THREE, 0x3f8f5a, 0.6, { side: THREE.DoubleSide });
  const leafB = mat(THREE, 0x2f7048, 0.6, { side: THREE.DoubleSide });
  const terracotta = mat(THREE, 0xc46a3c, 0.8);
  const leaf = (): T => {
    // a long leaf, curving over: a plane bent along its length
    const g = new THREE.PlaneGeometry(0.9, 4, 1, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 2;
      const x = p.getX(i) * Math.sin((y / 4) * Math.PI) * 1.6;
      p.setXYZ(i, x, y, -y * y * 0.12);
    }
    g.computeVertexNormals();
    return g;
  };
  for (const [x, z, s] of [[21, -14, 1.3], [-21.5, -22, 1.6], [20, 4, 1]] as const) {
    k.add(new THREE.CylinderGeometry(1.1 * s, 0.8 * s, 1.8 * s, 24), terracotta, [x, FLOOR + 0.9 * s, z]);
    k.add(new THREE.CylinderGeometry(1.0 * s, 1.0 * s, 0.1, 24), mat(THREE, 0x3a2a20, 1), [x, FLOOR + 1.75 * s, z]);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4;
      const tilt = 0.25 + (i % 3) * 0.22;
      k.add(leaf(), i % 2 ? leafA : leafB, [x, FLOOR + 1.7 * s, z], [Math.cos(a) * tilt, a, Math.sin(a) * tilt], [s, s * (0.8 + (i % 4) * 0.15), s]);
    }
  }
  // the table everyone sits at: low and long, oval, in front of them, with
  // a couple of mugs, a teapot and a pot of flowers on it
  const tableWood = mat(THREE, 0xb98a5e, 0.38, { map: floorTex });
  const topGeo = new THREE.CylinderGeometry(1, 1, 0.45, 64);
  k.add(topGeo, tableWood, [0, FLOOR + 2.6, -4.2], [0, 0, 0], [9, 1, 2.6]);
  const rim = new THREE.TorusGeometry(1, 0.06, 6, 96);
  rim.rotateX(Math.PI / 2);
  k.add(rim, darkWood, [0, FLOOR + 2.38, -4.2], [0, 0, 0], [9, 1, 2.6]);
  for (const x of [-6, 6]) for (const z of [-5.4, -3]) k.add(new THREE.CylinderGeometry(0.22, 0.14, 2.4, 10), darkWood, [x, FLOOR + 1.2, z]);
  const ceramic = (c: number): T => mat(THREE, c, 0.25, { envMapIntensity: 1.2 });
  for (const [x, c] of [[-3.5, 0xf4f1ea], [4.2, 0x4a6fd1], [-1.6, 0xe0506a]] as const) {
    const cup = new THREE.LatheGeometry([[0, 0], [0.36, 0], [0.42, 0.1], [0.44, 0.8], [0.4, 0.8], [0.38, 0.12], [0, 0.12]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
    k.add(cup, ceramic(c), [x, FLOOR + 2.83, -3.6 + (x < 0 ? 0.2 : 0)]);
    const handle = new THREE.TorusGeometry(0.2, 0.05, 6, 12, Math.PI);
    k.add(handle, ceramic(c), [x + 0.44, FLOOR + 3.25, -3.6 + (x < 0 ? 0.2 : 0)], [0, 0, -Math.PI / 2]);
  }
  // a teapot: a squashed ball, a lid, a spout
  const pot = ceramic(0xe8c27a);
  k.add(new THREE.SphereGeometry(0.85, 24, 16), pot, [3, FLOOR + 3.5, -4.9], [0, 0, 0], [1, 0.78, 1]);
  k.add(new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), pot, [3, FLOOR + 4.1, -4.9]);
  k.add(new THREE.CylinderGeometry(0.08, 0.16, 0.9, 10), pot, [3.85, FLOOR + 3.6, -4.9], [0, 0, -0.9]);
  // the vase of flowers
  const vase = new THREE.LatheGeometry([[0, 0], [0.4, 0], [0.55, 0.4], [0.35, 1.0], [0.3, 1.15], [0.36, 1.25]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
  k.add(vase, ceramic(0x5ec4d8), [0.6, FLOOR + 2.83, -4.6]);
  const stem = mat(THREE, 0x3f7a4a, 0.7);
  for (const [dx, dy, c] of [[-0.35, 1.3, 0xff6fae], [0.1, 1.6, 0xf2c14e], [0.45, 1.25, 0xe0506a], [-0.05, 1.05, 0xffffff], [0.3, 1.45, 0xff9a6a]] as const) {
    k.add(new THREE.CylinderGeometry(0.03, 0.03, dy, 4), stem, [0.6 + dx / 2, FLOOR + 3.9 + dy / 2 - 0.4, -4.6], [0, 0, -dx * 0.5]);
    k.add(new THREE.IcosahedronGeometry(0.26, 1), mat(THREE, c, 0.6), [0.6 + dx, FLOOR + 3.5 + dy, -4.6]);
  }
  // soft shadows under the table, the armchair and the pots (where the
  // sun's hard one, cast long, doesn't fall)
  const blotMat = new THREE.MeshBasicMaterial({ map: painted(THREE, 128, 128, blot), transparent: true, depthWrite: false, opacity: 0.9 });
  under = blotMat;
  for (const [x, z, sx, sz] of [[0, -4.2, 22, 8], [-18, -7, 8, 8], [21, -14, 4, 4], [-21.5, -22, 5, 5], [20, 4, 3.5, 3.5]] as const) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), blotMat);
    b.rotation.x = -Math.PI / 2;
    b.position.set(x, FLOOR + 0.06, z);
    b.renderOrder = 1;
    scene.add(b);
  }
  k.done(new Set([wood, velvet, leafA, leafB, terracotta, tableWood, darkWood, brass, ...books]));
  return { lamp, sun };
}

// A chair for a seat: a soft, rounded armchair, in a colour from a few, on
// short dark legs, with a soft shadow on the floor under it
let under: T = null;
let stepMat: T = null;
function chair(THREE: T, i: number, RoundedBox: T): T {
  const g = new THREE.Group();
  const colour = [0x3d4a6e, 0x6b3f5a, 0x2f5f5a, 0x7a5a3a, 0x4a3f6e][i % 5];
  const soft = mat(THREE, colour, 0.82);
  const legs = mat(THREE, 0x2a1f18, 0.5);
  const parts: [T, T, number[], number[]][] = [
    [new RoundedBox(3.8, 1, 3, 3, 0.4), soft, [0, FLOOR + 2.3, -1.5], [0, 0, 0]],
    [new RoundedBox(3.8, 3.4, 0.9, 3, 0.4), soft, [0, FLOOR + 3.9, -3], [-0.12, 0, 0]],
    [new RoundedBox(0.7, 1.4, 2.8, 3, 0.3), soft, [-2.05, FLOOR + 2.9, -1.6], [0, 0, 0]],
    [new RoundedBox(0.7, 1.4, 2.8, 3, 0.3), soft, [2.05, FLOOR + 2.9, -1.6], [0, 0, 0]],
  ];
  for (const [x, z] of [[-1.6, -0.3], [1.6, -0.3], [-1.6, -2.7], [1.6, -2.7]]) parts.push([new THREE.CylinderGeometry(0.12, 0.08, 1.8, 8), legs, [x, FLOOR + 0.9, z], [0, 0, 0]]);
  for (const [geo, m, at, rot] of parts) {
    const part = new THREE.Mesh(geo, m);
    part.position.set(...(at as [number, number, number]));
    part.rotation.set(...(rot as [number, number, number]));
    part.castShadow = part.receiveShadow = true;
    g.add(part);
  }
  if (under) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.6), under);
    shadow.rotation.x = -Math.PI / 2;
    // (on the floor, or, for a row raised behind, on its riser)
    shadow.position.set(0, FLOOR + 0.07, -1.5);
    shadow.renderOrder = 1;
    g.add(shadow);
  }
  return g;
}

// ---- after drawing: depth, glow, the edges ----

// A glow round what's brightest (bloom), then tone mapping, a little
// darkening at the edges, and a little noise so the dark gradients don't
// band.
type Post = { composer: T; bloom: T; finish: T; setSize: (w: number, h: number) => void };
async function postFor(THREE: T, renderer: T, scene: T, camera: T): Promise<Post | null> {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }] = await Promise.all([
      // @ts-expect-error: resolved by the page's import map
      import("three/addons/postprocessing/EffectComposer.js"),
      // @ts-expect-error: resolved by the page's import map
      import("three/addons/postprocessing/RenderPass.js"),
      // @ts-expect-error: resolved by the page's import map
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      // @ts-expect-error: resolved by the page's import map
      import("three/addons/postprocessing/ShaderPass.js"),
    ]);
    // drawn in linear light, at half-float, so the glow works on real
    // brightness (only the sky and the lamp are over 1), then tone mapped
    // once at the end
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.5, 1.6);
    composer.addPass(bloom);
    const finish = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, time: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float vignette; uniform float time;
        varying vec2 vUv;
        // (the renderer's exposure, and its sRGB conversion, which three.js
        // adds to every shader of this kind)
        #include <tonemapping_pars_fragment>
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          c.rgb = NeutralToneMapping(c.rgb);
          // darker towards the corners, as a lens is
          vec2 d = vUv - 0.5;
          c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
          c = sRGBTransferOETF(c);
          // a whisper of noise, so a smooth dark wall doesn't band
          float n = fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453);
          c.rgb += (n - 0.5) / 255.0;
          gl_FragColor = c;
        }`,
    });
    // (the renderer's own tone mapping is the finish's job now)
    finish.material.toneMapped = false;
    composer.addPass(finish);
    return { composer, bloom, finish, setSize: (w, h) => composer.setSize(w, h) };
  } catch (err) {
    console.warn("room: drawing it plainly", err);
    return null;
  }
}

// ---- seats: who sits where ----

// the order people sit in: you in the middle, everyone else as they came.
// A room with more people than seats seats those talking, with a hand up or
// most lately either, and keeps where each sits while they stay in it.
function arrange(heads: RoomHead[], aspect: number, r?: Pick<Room, "activeAt" | "seatOf">): RoomHead[] {
  const mine = heads.find((h) => h.mine);
  let others = heads.filter((h) => !h.mine);
  const room = MOST_SEATS - (mine ? 1 : 0);
  if (others.length > room && r) {
    const now = performance.now();
    for (const h of others) if (h.speaking || h.slot.closest<HTMLElement>(".spot")?.dataset.hand) r.activeAt.set(h.slot, now);
    const seated = (h: RoomHead): number => r.seatOf.get(h.slot) ?? Infinity;
    const chosen = new Set([...others].sort((a, b) => (r.activeAt.get(b.slot) ?? -1) - (r.activeAt.get(a.slot) ?? -1) || seated(a) - seated(b)).slice(0, room));
    // in the seats they had, the newly seated after
    others = others.filter((h) => chosen.has(h)).sort((a, b) => seated(a) - seated(b));
  } else others = others.slice(0, room);
  if (!mine) return others;
  // (in the middle of the front row)
  const front = seatPlaces(others.length + 1, aspect).filter((p) => p.row === 0).length;
  const at = Math.floor((front - 1) / 2);
  return [...others.slice(0, at), mine, ...others.slice(at)];
}

// ---- drawing it ----

function label(r: Room, slot: HTMLElement): HTMLElement {
  let el = r.labels.get(slot);
  if (el) return el;
  el = document.createElement("div");
  el.className = "room-label";
  el.setAttribute("aria-hidden", "true"); // the cards say it all for a screen reader
  el.innerHTML = `<span class="room-name"></span><span class="room-word words"></span>`;
  r.overlay.append(el);
  r.labels.set(slot, el);
  return el;
}

// how sharp to draw: as sharp as the screen, within 2 (a phone, 1.5), times
// however much less a slow screen has been brought down to
const ratioFor = (r: Room): number => Math.min(innerWidth < 700 ? 1.5 : 2, devicePixelRatio) * r.pixels;

function draw(heads: RoomHead[], THREE: T): void {
  const r = room;
  if (!r || !r.canvas.isConnected) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - r.last) / 1000);
  r.last = now;
  adapt(r, dt);
  // sized to its box, sharp on a sharp screen
  const w = r.canvas.clientWidth;
  const h = r.canvas.clientHeight;
  const ratio = ratioFor(r);
  if (r.canvas.width !== Math.round(w * ratio) || r.canvas.height !== Math.round(h * ratio)) {
    r.renderer.setPixelRatio(ratio);
    r.renderer.setSize(w, h, false);
    r.post?.setSize(Math.round(w * ratio), Math.round(h * ratio));
    r.camera.aspect = w / Math.max(1, h);
    // a tall, narrow frame (a phone) sees wider, or a row of three is a
    // long way off
    r.camera.fov = fovFor(r.camera.aspect);
    r.camera.updateProjectionMatrix();
  }
  const sitting = arrange(heads, r.camera.aspect, r);
  const places = seatPlaces(sitting.length, r.camera.aspect);
  // seats: as many as there are people, made as needed
  while (r.seats.length < sitting.length) {
    const group = new THREE.Group();
    const c = chair(THREE, r.seats.length, roundedBox);
    // a step under a raised row's chair, as a lecture theatre's (side by
    // side, they make one long step)
    const riser = new THREE.Mesh(new roundedBox(4.9, 1, 4.8, 2, 0.06), stepMat ??= mat(THREE, 0x4a3a30, 0.7));
    riser.castShadow = riser.receiveShadow = true;
    group.add(c, riser);
    r.scene.add(group);
    r.seats.push({ group, chair: c, riser, holds: null });
  }
  r.seats.forEach((seat, i) => {
    const who = sitting[i];
    seat.group.visible = !!who;
    // whoever sat here before is put back where head3d keeps them
    if (seat.holds && seat.holds !== who) {
      seat.group.remove(seat.holds.root);
      if (seat.holds.body) seat.group.remove(seat.holds.body);
    }
    if (!who) return void (seat.holds = null);
    const p = places[i];
    seat.group.position.set(p.x, p.y, p.z);
    seat.group.rotation.y = p.turn;
    seat.riser.visible = p.y > 0.05;
    seat.riser.scale.y = Math.max(0.01, p.y);
    seat.riser.position.set(0, FLOOR - p.y / 2, -1.5);
    // (a head3d frame takes the head out of any scene it's in, to draw it
    // in its card; here it isn't, so it stays put between frames)
    if (who.root.parent !== seat.group) {
      seat.group.add(who.root);
      // (casting a shadow on the chair and the rug, as the room's own things do)
      who.root.traverse((o: T) => void (o.isMesh && (o.castShadow = o.receiveShadow = true)));
    }
    if (who.body && who.body.parent !== seat.group) {
      seat.group.add(who.body);
      who.body.traverse((o: T) => void (o.isMesh && (o.castShadow = o.receiveShadow = true)));
    }
    seat.holds = who;
    r.seatOf.set(who.slot, i);
  });
  // the camera: the shot for the view, turned as the watcher has it, eased
  // there (quickly while they drag, gently as the view changes or follows
  // someone)
  if (!dragging && (r.spin.yaw || r.spin.pitch)) {
    glide(r, dt);
  }
  const talking = sitting.findIndex((x) => x.speaking);
  if (talking >= 0) r.focus = sitting[talking].slot;
  let focus = r.focus ? sitting.findIndex((x) => x.slot === r.focus) : -1;
  if (focus < 0) focus = sitting.findIndex((x) => x.mine);
  const framed = shotFor(r.view, places, r.camera.aspect, talking, focus);
  r.framed = framed;
  // (what it can show, held to while it's dragged or gliding: the follow
  // view's leaning would otherwise loosen it, a little, every time someone
  // spoke)
  if (dragging || r.spin.yaw || r.spin.pitch) r.turn = held(framed, r.turn);
  const shot = turned(framed, r.turn);
  r.eye ??= { at: [...shot.at], look: [...shot.look] };
  const k = still.matches ? 1 : 1 - Math.exp(-(dragging || r.spin.yaw || r.spin.pitch ? 14 : r.view === "follow" ? 2.5 : 3.2) * dt);
  for (let i = 0; i < 3; i++) {
    r.eye.at[i] += (shot.at[i] - r.eye.at[i]) * k;
    r.eye.look[i] += (shot.look[i] - r.eye.look[i]) * k;
  }
  r.camera.position.set(...r.eye.at);
  r.camera.lookAt(...r.eye.look);
  r.camera.updateMatrixWorld();
  // the sun's shadows, drawn again only every few frames (they take every
  // head and chair drawn a second time; a head's shadow a frame or two
  // behind it doesn't show), more often for a fast screen
  if (++r.shadowFrame >= (r.quality > 0 ? 2 : 4)) {
    r.shadowFrame = 0;
    r.renderer.shadowMap.needsUpdate = true;
  }
  if (r.post && r.quality > 0) {
    r.post.finish.uniforms.time.value = (now % 1000) / 10;
    r.post.composer.render(dt);
  } else r.renderer.render(r.scene, r.camera);
  // names and words over heads, where each head is on the screen now
  const rect = r.canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  const seen = new Set<HTMLElement>();
  const placed: { el: HTMLElement; x: number; y: number; w: number; h: number; behind: boolean }[] = [];
  for (const who of sitting) {
    seen.add(who.slot);
    const el = label(r, who.slot);
    who.root.getWorldPosition(v);
    const mid = v.clone();
    // (just above the top of their head, hair and all: further up, a near
    // head's name floats off it, into the row behind)
    v.y += 1.3;
    v.project(r.camera);
    mid.project(r.camera);
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    // (behind the camera, turned right round: not shown)
    placed.push({ el, x, y, w: el.offsetWidth, h: el.offsetHeight, behind: v.z > 1 });
    r.at.set(who.slot, { x: rect.left + (mid.x * 0.5 + 0.5) * rect.width, y: rect.top + (-mid.y * 0.5 + 0.5) * rect.height });
    // their name, and the word they're saying (from their card)
    const card = who.slot.closest<HTMLElement>(".spot");
    // their words drawn as on their card: its style, font and glow (which
    // can change while they're here)
    for (const k of ["words", "font"] as const) if (card && el.dataset[k] !== card.dataset[k]) el.dataset[k] = card.dataset[k] ?? "";
    el.toggleAttribute("data-glow", !!card?.hasAttribute("data-glow"));
    const hue = card?.style.getPropertyValue("--hue") ?? "0";
    if (el.style.getPropertyValue("--hue") !== hue) el.style.setProperty("--hue", hue);
    const hand = card?.dataset.hand;
    const name = card?.dataset.name ?? "";
    const nameEl = el.firstElementChild as HTMLElement;
    if (nameEl.textContent !== name) nameEl.textContent = name;
    // no page open: said to be away (style.css)
    const gone = !!card?.hasAttribute("data-away");
    if (nameEl.hasAttribute("data-away") !== gone) nameEl.toggleAttribute("data-away", gone);
    const word = card?.querySelector(".spot-word");
    const wordEl = el.lastElementChild as HTMLElement;
    const html = word && !word.classList.contains("fading") ? word.innerHTML : "";
    if (wordEl.innerHTML !== html) wordEl.innerHTML = html;
    // which word, so it can be tapped to react to
    for (const k of ["id", "i"] as const) {
      const v = html && word instanceof HTMLElement ? word.dataset[k] : undefined;
      if (wordEl.dataset[k] !== v) v === undefined ? delete wordEl.dataset[k] : (wordEl.dataset[k] = v);
    }
    el.classList.toggle("speaking", who.speaking);
    el.classList.toggle("mine", who.mine);
    // a crowded room names only who's talking or has a hand up (their cards
    // name everyone)
    el.classList.toggle("quiet", (sitting.length > CROWD && !who.speaking && !hand && !html && !el.querySelector(".burst")) || v.z > 1);
    if ((nameEl.dataset.hand ?? "") !== (hand ?? "")) {
      if (hand) nameEl.dataset.hand = hand;
      else delete nameEl.dataset.hand;
    }
  }
  // labels that would sit on each other: the later (further back, or
  // further along) lifted clear of the earlier, the speaker's first. Only
  // about a name's height, all told: lifted over someone's word, a name in
  // a crowded room ended up rows above its head, over someone else's. One
  // that can't clear stays by its head, under the other (words are on top).
  placed.sort((a, b) => Number(b.el.classList.contains("speaking")) - Number(a.el.classList.contains("speaking")) || b.y - a.y);
  const done: { x: number; y: number; w: number; h: number }[] = [];
  for (const l of placed) {
    const most = (l.el.firstElementChild as HTMLElement).offsetHeight * 1.3 + 2;
    let y = l.y;
    for (let tries = 0; tries < 2; tries++) {
      if (l.el.classList.contains("quiet")) break;
      const hit = done.find((d) => Math.abs(d.x - l.x) < (d.w + l.w) / 2 + 2 && y > d.y - d.h - 2 && y - l.h < d.y + 2 && l.y - (d.y - d.h - 2) <= most);
      if (!hit) break;
      y = hit.y - hit.h - 2;
    }
    if (!l.el.classList.contains("quiet")) done.push({ x: l.x, y, w: l.w, h: l.h });
    l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
  for (const [slot, el] of r.labels) {
    if (seen.has(slot)) continue;
    el.remove();
    r.labels.delete(slot);
    r.at.delete(slot);
  }
  for (const m of [r.activeAt, r.seatOf]) for (const slot of m.keys()) if (!slot.isConnected) m.delete(slot);
}

// Drawing less on a screen that can't keep up: frames taking over 24 ms (a
// screen that should be doing 60 managing about 40) for most of two seconds
// drop the glow, then draw at fewer pixels; and frames well under, for long
// enough, bring them back a step at a time.
function adapt(r: Room, dt: number): void {
  if (document.hidden) return;
  r.slow.frames++;
  if (dt > 0.024) r.slow.over++;
  const t = performance.now();
  if (t - r.slow.since < 2000) return;
  const share = r.slow.over / Math.max(1, r.slow.frames);
  if (share > 0.5) {
    if (r.quality > 0) r.quality = 0;
    else if (r.pixels > 0.6) r.pixels = Math.max(0.6, r.pixels - 0.2);
  } else if (share < 0.05 && r.slow.frames > 100) {
    if (r.pixels < 1) r.pixels = Math.min(1, r.pixels + 0.2);
    else r.quality = 1;
  }
  r.slow = { frames: 0, over: 0, since: t };
}

// ---- the camera, by hand ----

// a turn, turned further (within how far it can go)
const turnedFrom = (r: Room, yaw: number, pitch: number): Turn => {
  const t = { ...r.turn, yaw: Math.max(-MOST_YAW * 2, Math.min(MOST_YAW * 2, r.turn.yaw + yaw)), pitch: Math.max(-RISE[1], Math.min(RISE[1], r.turn.pitch + pitch)) };
  return r.framed ? held(r.framed, t) : t;
};
// after a flick: turning on at the speed it was let go, slowing (to a tenth
// in about half a second), and stopping at the edge it can't turn past
function glide(r: Room, dt: number): void {
  const before = r.turn;
  r.turn = turnedFrom(r, r.spin.yaw * dt, r.spin.pitch * dt);
  const fade = Math.exp(-4.5 * dt);
  r.spin = { yaw: r.turn.yaw === before.yaw ? 0 : r.spin.yaw * fade, pitch: r.turn.pitch === before.pitch ? 0 : r.spin.pitch * fade };
  if (Math.abs(r.spin.yaw) < 0.01 && Math.abs(r.spin.pitch) < 0.01) r.spin = { yaw: 0, pitch: 0 };
  turnedByHand();
}

let dragging = false;
function control(r: Room, box: HTMLElement): void {
  if (box.dataset.controlled) return;
  box.dataset.controlled = "1";
  const canvas = box.querySelector("canvas")!;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const turnBy = (dx: number, dy: number): void => {
    if (!room) return;
    room.turn = turnedFrom(room, -dx * 0.006, dy * 0.005);
    turnedByHand();
  };
  // how fast the drag is going, smoothed over the last few moves
  let moved = { t: 0, yaw: 0, pitch: 0 };
  const track = (dx: number, dy: number): void => {
    const now = performance.now();
    const dt = Math.max(1, now - moved.t) / 1000;
    const k = Math.min(1, dt / 0.05);
    moved = { t: now, yaw: moved.yaw + ((-dx * 0.006) / dt - moved.yaw) * k, pitch: moved.pitch + ((dy * 0.005) / dt - moved.pitch) * k };
  };
  const zoomBy = (f: number): void => {
    if (!room) return;
    room.turn = { ...room.turn, zoom: Math.max(ZOOM[0], Math.min(ZOOM[1], room.turn.zoom * f)) };
    turnedByHand();
  };
  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // (a finger on a phone: one scrolls the page, two turn and zoom; a
    // mouse or pen drags with one)
    if (e.pointerType !== "touch" || pointers.size >= 2) {
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      box.classList.add("dragging");
      // (caught: a glide stops where it's held)
      if (room) room.spin = { yaw: 0, pitch: 0 };
      moved = { t: performance.now(), yaw: 0, pitch: 0 };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const was = pointers.get(e.pointerId);
    if (!was) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, now);
    if (!dragging) return;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoomBy(pinch / d);
      pinch = d;
      turnBy((now.x - was.x) / 2, (now.y - was.y) / 2);
      track((now.x - was.x) / 2, (now.y - was.y) / 2);
    } else {
      turnBy(now.x - was.x, now.y - was.y);
      track(now.x - was.x, now.y - was.y);
    }
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) {
      // let go while still moving (not after a pause): it carries on, slowing
      // (at most about a turn of 70 degrees a second: a hard flick is a glide, not a spin)
      const most = 1.2;
      if (dragging && room && !still.matches && performance.now() - moved.t < 80) room.spin = { yaw: Math.max(-most, Math.min(most, moved.yaw)), pitch: Math.max(-most, Math.min(most, moved.pitch)) };
      dragging = false;
      box.classList.remove("dragging");
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  // two fingers on a phone don't scroll the page or zoom it
  canvas.addEventListener("touchmove", (e) => void (e.touches.length > 1 && e.preventDefault()), { passive: false });
  // a wheel zooms, while over the room (and the page stays put)
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  }, { passive: false });
  canvas.addEventListener("dblclick", () => {
    if (room) (room.turn = LEVEL), (room.spin = { yaw: 0, pitch: 0 });
    turnedByHand();
  });
  // the keyboard: arrows turn it, + and - zoom, 0 puts it back (on the room
  // itself, focused)
  box.addEventListener("keydown", (e) => {
    const step = 40;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => turnBy(-step, 0),
      ArrowRight: () => turnBy(step, 0),
      ArrowUp: () => turnBy(0, -step),
      ArrowDown: () => turnBy(0, step),
      "+": () => zoomBy(0.85),
      "=": () => zoomBy(0.85),
      "-": () => zoomBy(1.18),
      "0": () => {
        if (room) room.turn = LEVEL;
        turnedByHand();
      },
    };
    if (e.target !== box || e.metaKey || e.ctrlKey || e.altKey || !keys[e.key]) return;
    e.preventDefault();
    keys[e.key]();
  });
  // the view bar
  box.querySelector(".room-views")?.addEventListener("change", (e) => {
    const v = (e.target as HTMLInputElement).value as View;
    if (VIEWS.includes(v)) setView(v);
  });
  box.querySelector(".room-reset")?.addEventListener("click", () => {
    if (room) (room.turn = LEVEL), (room.spin = { yaw: 0, pitch: 0 });
    turnedByHand();
  });
}
// (a way back once it's been turned)
function turnedByHand(): void {
  const t = room?.turn ?? LEVEL;
  const moved = Math.abs(t.yaw) > 0.01 || Math.abs(t.pitch) > 0.01 || Math.abs(t.zoom - 1) > 0.01;
  room?.overlay.closest(".room3d")?.toggleAttribute("data-turned", moved);
}
const VIEW_KEY = "said-room-view";
function setView(v: View): void {
  if (!room) return;
  room.view = v;
  room.turn = LEVEL;
  room.spin = { yaw: 0, pitch: 0 };
  turnedByHand();
  for (const i of room.overlay.closest(".room3d")?.querySelectorAll<HTMLInputElement>(".room-views input") ?? []) i.checked = i.value === v;
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // (a private window: it just isn't remembered)
  }
}
const savedView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    return v && VIEWS.includes(v) ? v : "follow";
  } catch {
    return "follow";
  }
};

// Where something rising from someone's head goes in the room (an emote's
// emoji): over their head, with their name. Null when the room isn't shown,
// or they're not sitting in it.
export const overHead = (slot: HTMLElement): HTMLElement | null => room?.labels.get(slot) ?? null;

// Show the room in `canvas`, with labels in `overlay` (over it), or stop.
// Made once and kept, hidden, for the next time: a second drawing would
// keep its own copy of every head on the GPU for as long as the page is
// open (three.js keeps a renderer alive while anything it drew is), so each
// visit to the room would add one.
let kept: Pick<Room, "THREE" | "renderer" | "scene" | "camera" | "canvas" | "post"> | null = null;
let roundedBox: T = null;
// phones and small screens start plain (and work up if they keep up easily)
const startQuality = (): Quality => (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600 ? 0 : 1);
export async function showRoom(canvas: HTMLCanvasElement | null, overlay: HTMLElement | null): Promise<boolean> {
  if (!canvas || !overlay) {
    if (room) {
      // everyone back to their cards
      for (const seat of room.seats) {
        if (seat.holds) {
          seat.group.remove(seat.holds.root);
          if (seat.holds.body) seat.group.remove(seat.holds.body);
        }
        seat.holds = null;
        seat.group.visible = false;
      }
      for (const el of room.labels.values()) el.remove();
      room = null;
    }
    await roomView(null);
    return false;
  }
  try {
    const THREE = await roomView({ draw, at: (slot) => room?.at.get(slot) ?? null });
    if (!kept || kept.canvas !== canvas) {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      // bright things roll off rather than clip, and colours stay as
      // chosen (Khronos's Neutral: AgX and ACES both shifted skin and
      // clothes, one greyer, one more orange) (drawn plainly; with the
      // after-drawing passes, their finish does it instead)
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      const scene = new THREE.Scene();
      const [{ mergeGeometries }, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
        // @ts-expect-error: resolved by the page's import map
        import("three/addons/utils/BufferGeometryUtils.js"),
        // @ts-expect-error: resolved by the page's import map
        import("three/addons/geometries/RoundedBoxGeometry.js"),
        // @ts-expect-error: resolved by the page's import map
        import("three/addons/environments/RoomEnvironment.js"),
      ]);
      roundedBox = RoundedBoxGeometry;
      // light from all round, as a lit room gives (a room made of shapes and
      // blurred into light): soft shading, and a little of the room in
      // everything that shines
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.4;
      pmrem.dispose();
      furnish(THREE, scene, mergeGeometries, RoundedBoxGeometry);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 140);
      const post = await postFor(THREE, renderer, scene, camera);
      kept = { THREE, renderer, scene, camera, canvas, post };
      seatsKept = [];
    }
    room = {
      ...kept,
      seats: seatsKept,
      eye: null,
      view: savedView(),
      turn: LEVEL,
      focus: null,
      labels: new Map(),
      overlay,
      at: new Map(),
      seatOf: new Map(),
      activeAt: new Map(),
      last: performance.now(),
      slow: { frames: 0, over: 0, since: performance.now() },
      quality: startQuality(),
      shadowFrame: 0,
      spin: { yaw: 0, pitch: 0 },
      framed: null,
      pixels: 1,
    };
    const box = canvas.closest<HTMLElement>(".room3d");
    if (box) {
      control(room, box);
      setView(room.view);
    }
    return true;
  } catch (err) {
    console.error(err);
    await roomView(null);
    return false;
  }
}
let seatsKept: Seat[] = [];
