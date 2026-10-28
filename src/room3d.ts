// The room: everyone in one place, around a low table in a warm room, as a
// 3D scene, instead of a card each. Each person sits in a seat on an arc
// facing whoever's looking, their own avatar as it is on their card (the
// same head, face, mouth, arms and emotes: head3d.ts poses them, and hands
// them here to draw). Over each head, their name and the word they're
// saying, drawn the way they said it, as on their card: the words stay
// words on the page, and the cards stay underneath, where a screen reader
// finds them.
//
// Everything in the room is made of shapes here (nothing to download). On
// an M4 Pro with its processor slowed four times, eight people and the room
// drew at over 60 frames a second at phone size (notes/decisions-log.md).
import { roomView, type RoomHead } from "./head3d.ts";
import { ROW, seatPlaces } from "./seats.ts";

type T = any;

// where seats go: an arc behind the table, as wide as there are people
const MOST_SEATS = 12;
const CROWD = 6; // more than this, and only some are named over their heads
const FLOOR = -5.2; // where the floor is, below a seated head's middle

type Seat = { group: T; chair: T; holds: RoomHead | null };
type Room = {
  THREE: T;
  renderer: T;
  scene: T;
  camera: T;
  seats: Seat[];
  // where the camera looks, eased towards whoever's talking
  look: { x: number; y: number };
  labels: Map<HTMLElement, HTMLElement>;
  overlay: HTMLElement;
  canvas: HTMLCanvasElement;
  at: Map<HTMLElement, { x: number; y: number }>;
  seatOf: Map<HTMLElement, number>;
  last: number;
};

let room: Room | null = null;

const mat = (THREE: T, color: number | string, rough = 0.7, extra: Record<string, unknown> = {}): T => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

// ---- the room itself ----

function furnish(THREE: T, scene: T): void {
  // late-afternoon light through the window, and a lamp
  scene.background = new THREE.Color(0x1d2230);
  scene.fog = new THREE.Fog(0x1d2230, 30, 60);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x39405a, 1.3));
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.1);
  sun.position.set(-10, 14, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 16, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  // a soft light from in front, so faces read
  const front = new THREE.DirectionalLight(0xfff4e6, 1.7);
  front.position.set(2, 4, 16);
  scene.add(front);

  // the floor: planks of warm wood, each a shade apart
  const planks = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const shade = new THREE.Color(0x8a5d3b).offsetHSL(0, 0, ((i * 37) % 7) / 100 - 0.03);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 1.5), mat(THREE, shade, 0.75));
    plank.position.set(((i * 13) % 5) - 2, FLOOR - 0.1, -24 + i * 1.52);
    plank.receiveShadow = true;
    planks.add(plank);
  }
  scene.add(planks);
  // a big round rug under where everyone sits
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.08, 64), mat(THREE, 0x7b3f4f, 1));
  rug.position.set(0, FLOOR + 0.04, -8);
  rug.receiveShadow = true;
  scene.add(rug);
  const rugEdge = new THREE.Mesh(new THREE.TorusGeometry(14.6, 0.18, 8, 96), mat(THREE, 0xd9a441, 0.9));
  rugEdge.rotation.x = Math.PI / 2;
  rugEdge.position.set(0, FLOOR + 0.1, -8);
  scene.add(rugEdge);

  // walls: one behind, with a window; one each side
  const wall = mat(THREE, 0x46506b, 0.95);
  const back = new THREE.Mesh(new THREE.BoxGeometry(60, 26, 0.5), wall);
  back.position.set(0, FLOOR + 13, -26);
  back.receiveShadow = true;
  scene.add(back);
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 26, 40), wall);
    w.position.set(side * 26, FLOOR + 13, -8);
    w.receiveShadow = true;
    scene.add(w);
  }
  // the window: a sky going from blue to gold, hills, and a frame
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 11),
    new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: "varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec2 v; void main(){ vec3 top = vec3(0.36, 0.56, 0.86); vec3 low = vec3(1.0, 0.78, 0.52); gl_FragColor = vec4(mix(low, top, smoothstep(0.1, 0.95, v.y)), 1.0); }",
    }),
  );
  sky.position.set(-6, FLOOR + 14, -25.7);
  scene.add(sky);
  for (const [x, h, c] of [[-13, 2.6, 0x4f7a5a], [-6, 3.6, 0x5c8a66], [1, 2.2, 0x46704f]] as const) {
    const hill = new THREE.Mesh(new THREE.CircleGeometry(h * 2.2, 40, 0, Math.PI), mat(THREE, c, 1));
    hill.position.set(x, FLOOR + 8.5, -25.6);
    hill.scale.y = 0.55;
    scene.add(hill);
  }
  const frame = mat(THREE, 0xf1e6d2, 0.6);
  for (const [w, h, x, y] of [[23, 0.5, 0, 5.75], [23, 0.5, 0, -5.75], [0.5, 12, -11.25, 0], [0.5, 12, 11.25, 0], [0.3, 11, 0, 0], [22, 0.3, 0, 0]] as const) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), frame);
    bar.position.set(-6 + x, FLOOR + 14 + y, -25.5);
    scene.add(bar);
  }
  // a picture on the wall, and shelves of books
  const picture = new THREE.Mesh(new THREE.BoxGeometry(6, 4.4, 0.25), mat(THREE, 0x2a2f3a, 0.5));
  picture.position.set(12, FLOOR + 15, -25.6);
  scene.add(picture);
  for (const [x, y, w, h, c] of [[11, 15.3, 2.4, 2.2, 0xe0506a], [13.2, 14.6, 2, 2.6, 0xf2c14e], [12.6, 15.9, 1.4, 1, 0x4ec9b0]] as const) {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(THREE, c, 0.9));
    blob.position.set(x, FLOOR + y - 0.3, -25.45);
    scene.add(blob);
  }
  const wood = mat(THREE, 0x6b4a2e, 0.8);
  for (const y of [3, 6.5, 10]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 2.2), wood);
    shelf.position.set(19, FLOOR + y, -24.5);
    shelf.castShadow = true;
    scene.add(shelf);
    let x = 16;
    let n = Math.round(y * 7);
    while (x < 22) {
      const w = 0.35 + ((n * 17) % 5) / 10;
      const h = 1.6 + ((n * 7) % 4) / 4;
      const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), mat(THREE, [0xb33a2b, 0x3d4a6e, 0xd9a441, 0x3f8f5a, 0xe8e8ec, 0x7a3fb5][n % 6], 0.8));
      book.position.set(x + w / 2, FLOOR + y + 0.17 + h / 2, -24.5);
      book.rotation.z = n % 9 === 0 ? 0.25 : 0;
      book.castShadow = true;
      scene.add(book);
      x += w + 0.05;
      n++;
    }
  }
  // a lamp in the corner, glowing
  const lampAt = [-19, FLOOR, -14];
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 10), mat(THREE, 0x2b2f3a, 0.4, { metalness: 0.5 }));
  pole.position.set(lampAt[0], FLOOR + 6, lampAt[2]);
  scene.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 2.2, 24, 1, true), mat(THREE, 0xf6e3b4, 0.9, { side: THREE.DoubleSide, emissive: 0xffc070, emissiveIntensity: 0.55 }));
  shade.position.set(lampAt[0], FLOOR + 12.5, lampAt[2]);
  scene.add(shade);
  const bulb = new THREE.PointLight(0xffb866, 60, 30, 1.6);
  bulb.position.set(lampAt[0], FLOOR + 12, lampAt[2]);
  scene.add(bulb);
  // plants, each a pot and a few leaves
  for (const [x, z, s] of [[21, -12, 1.2], [-21, -22, 1.5], [17, 2, 0.9]] as const) {
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 1.8, 20), mat(THREE, 0xc46a3c, 0.8));
    pot.position.y = 0.9;
    pot.castShadow = true;
    plant.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), mat(THREE, i % 2 ? 0x3f8f5a : 0x4fa86a, 0.8));
      const a = (i / 7) * Math.PI * 2;
      leaf.scale.set(0.45, 1.6, 0.25);
      leaf.position.set(Math.cos(a) * 0.6, 2.9 + (i % 3) * 0.4, Math.sin(a) * 0.6);
      leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      leaf.castShadow = true;
      plant.add(leaf);
    }
    plant.position.set(x, FLOOR, z);
    plant.scale.setScalar(s * 1.6);
    scene.add(plant);
  }
  // the table everyone sits at: low and long, in front of them, with a
  // couple of mugs and a pot of flowers on it
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 48), mat(THREE, 0xc9a27a, 0.55));
  top.scale.set(9, 1, 2.6);
  top.position.set(0, FLOOR + 2.6, -4.2);
  top.castShadow = top.receiveShadow = true;
  scene.add(top);
  for (const x of [-6, 6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10), wood);
    leg.position.set(x, FLOOR + 1.3, -4.2);
    scene.add(leg);
  }
  for (const [x, c] of [[-3.5, 0xf4f4f4], [4.2, 0x4a6fd1]] as const) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.8, 16), mat(THREE, c, 0.4));
    mug.position.set(x, FLOOR + 3.2, -3.6);
    mug.castShadow = true;
    scene.add(mug);
  }
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1, 16), mat(THREE, 0x5ec4d8, 0.3));
  vase.position.set(0.6, FLOOR + 3.3, -4.6);
  scene.add(vase);
  for (const [dx, c] of [[-0.3, 0xff6fae], [0.2, 0xf2c14e], [0.5, 0xe0506a]] as const) {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), mat(THREE, c, 0.7));
    bloom.position.set(0.6 + dx, FLOOR + 4.4 + Math.abs(dx), -4.6);
    scene.add(bloom);
  }
}

// A chair for a seat: a soft cushioned one, in a colour from a few
function chair(THREE: T, i: number): T {
  const g = new THREE.Group();
  const colour = [0x3d4a6e, 0x6b3f5a, 0x3f6b5a, 0x6b5a3f][i % 4];
  const soft = mat(THREE, colour, 0.9);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 2.8), soft);
  seat.position.set(0, FLOOR + 2.4, -1.4);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.7), soft);
  back.position.set(0, FLOOR + 3.9, -2.9);
  back.rotation.x = -0.1;
  for (const part of [seat, back]) {
    part.castShadow = part.receiveShadow = true;
    g.add(part);
  }
  for (const [x, z] of [[-1.4, -0.3], [1.4, -0.3], [-1.4, -2.6], [1.4, -2.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 2, 8), mat(THREE, 0x2b2f3a, 0.5));
    leg.position.set(x, FLOOR + 1, z);
    g.add(leg);
  }
  return g;
}

// ---- seats: who sits where ----

// the order people sit in: you in the middle, everyone else as they came
function arrange(heads: RoomHead[], aspect: number): RoomHead[] {
  const mine = heads.find((h) => h.mine);
  const others = heads.filter((h) => !h.mine).slice(0, MOST_SEATS - (mine ? 1 : 0));
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
  const card = slot.closest<HTMLElement>(".spot");
  el = document.createElement("div");
  el.className = "room-label";
  el.setAttribute("aria-hidden", "true"); // the cards say it all for a screen reader
  for (const k of ["words", "font"]) if (card?.dataset[k]) el.dataset[k] = card.dataset[k];
  if (card?.hasAttribute("data-glow")) el.setAttribute("data-glow", "");
  el.style.setProperty("--hue", card?.style.getPropertyValue("--hue") ?? "0");
  el.innerHTML = `<span class="room-name"></span><span class="room-word words"></span>`;
  r.overlay.append(el);
  r.labels.set(slot, el);
  return el;
}

function draw(heads: RoomHead[], THREE: T): void {
  const r = room;
  if (!r || !r.canvas.isConnected) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - r.last) / 1000);
  r.last = now;
  // sized to its box, sharp on a sharp screen
  const w = r.canvas.clientWidth;
  const h = r.canvas.clientHeight;
  const ratio = Math.min(2, devicePixelRatio);
  if (r.canvas.width !== Math.round(w * ratio) || r.canvas.height !== Math.round(h * ratio)) {
    r.renderer.setPixelRatio(ratio);
    r.renderer.setSize(w, h, false);
    r.camera.aspect = w / Math.max(1, h);
    // a tall, narrow frame (a phone) sees wider, or a row of three is a
    // long way off
    r.camera.fov = r.camera.aspect < 1 ? 52 : 38;
    r.camera.updateProjectionMatrix();
  }
  // the camera stands back just far enough to fit everyone in, across and
  // up and down (a narrow screen, further back)
  const sitting = arrange(heads, r.camera.aspect);
  const places = seatPlaces(sitting.length, r.camera.aspect);
  const rows = places.length ? Math.max(...places.map((p) => p.row)) + 1 : 1;
  // (room either side of the outermost: their shoulders, and a hand up)
  const half = places.length ? Math.max(...places.map((p) => Math.abs(p.x))) + (r.camera.aspect < 1 ? 2.6 : 4.6) : 5;
  const fov = (r.camera.fov * Math.PI) / 180;
  const across = 2 * Math.atan(Math.tan(fov / 2) * r.camera.aspect);
  // heads (and hands up) in every row, and the table in front
  const tall = 6.5 + (rows - 1) * ROW.y * 1.25;
  const back = Math.max(half / Math.tan(across / 2), tall / 2 / Math.tan(fov / 2), 12) + (rows - 1) * 2;
  // seats: as many as there are people, made as needed
  while (r.seats.length < sitting.length) {
    const group = new THREE.Group();
    const c = chair(THREE, r.seats.length);
    group.add(c);
    r.scene.add(group);
    r.seats.push({ group, chair: c, holds: null });
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
    // (a head3d frame takes the head out of any scene it's in, to draw it
    // in its card; here it isn't, so it stays put between frames)
    if (who.root.parent !== seat.group) {
      seat.group.add(who.root);
      // (casting a shadow on the chair and the rug, as the room's own things do)
      who.root.traverse((o: T) => void (o.isMesh && (o.castShadow = true)));
    }
    if (who.body && who.body.parent !== seat.group) {
      seat.group.add(who.body);
      who.body.traverse((o: T) => void (o.isMesh && (o.castShadow = true)));
    }
    seat.holds = who;
    r.seatOf.set(who.slot, i);
  });
  // the camera: a little above, looking down at the row, leaning towards
  // whoever's talking
  const talking = sitting.findIndex((x) => x.speaking);
  const aim = talking >= 0 ? places[talking].x * 0.35 : 0;
  const k = 1 - Math.exp(-2.5 * dt);
  r.look.x += (aim - r.look.x) * k;
  const middle = -0.4 + (rows - 1) * ROW.y * 0.5;
  r.camera.position.set(r.look.x * 0.5, middle + back * (rows > 1 ? 0.28 : 0.18), -8 + back);
  r.camera.lookAt(r.look.x, middle, -10 + (rows - 1) * ROW.z * 0.5);
  r.camera.updateMatrixWorld();
  r.renderer.render(r.scene, r.camera);
  // names and words over heads, where each head is on the screen now
  const rect = r.canvas.getBoundingClientRect();
  const v = new THREE.Vector3();
  const seen = new Set<HTMLElement>();
  const placed: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
  for (const who of sitting) {
    seen.add(who.slot);
    const el = label(r, who.slot);
    who.root.getWorldPosition(v);
    const mid = v.clone();
    v.y += 2.1;
    v.project(r.camera);
    mid.project(r.camera);
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    placed.push({ el, x, y, w: el.offsetWidth, h: el.offsetHeight });
    r.at.set(who.slot, { x: rect.left + (mid.x * 0.5 + 0.5) * rect.width, y: rect.top + (-mid.y * 0.5 + 0.5) * rect.height });
    // their name, and the word they're saying (from their card)
    const card = who.slot.closest<HTMLElement>(".spot");
    const hand = card?.dataset.hand;
    const name = card?.dataset.name ?? "";
    const nameEl = el.firstElementChild as HTMLElement;
    if (nameEl.textContent !== name) nameEl.textContent = name;
    const word = card?.querySelector(".spot-word");
    const wordEl = el.lastElementChild as HTMLElement;
    const html = word && !word.classList.contains("fading") ? word.innerHTML : "";
    if (wordEl.innerHTML !== html) wordEl.innerHTML = html;
    el.classList.toggle("speaking", who.speaking);
    el.classList.toggle("mine", who.mine);
    // a crowded room names only who's talking or has a hand up (their cards
    // name everyone)
    el.classList.toggle("quiet", sitting.length > CROWD && !who.speaking && !hand && !html);
    if ((nameEl.dataset.hand ?? "") !== (hand ?? "")) {
      if (hand) nameEl.dataset.hand = hand;
      else delete nameEl.dataset.hand;
    }
  }
  // labels that would sit on each other: the later (further back, or
  // further along) lifted clear of the earlier, the speaker's first
  placed.sort((a, b) => Number(b.el.classList.contains("speaking")) - Number(a.el.classList.contains("speaking")) || b.y - a.y);
  const done: { x: number; y: number; w: number; h: number }[] = [];
  for (const l of placed) {
    // (lifted at most twice: a name further up than that is no longer by its head)
    let y = l.y;
    for (let tries = 0; tries < 2; tries++) {
      if (l.el.classList.contains("quiet")) break;
      const hit = done.find((d) => Math.abs(d.x - l.x) < (d.w + l.w) / 2 + 2 && y > d.y - d.h - 2 && y - l.h < d.y + 2);
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
}

// Show the room in `canvas`, with labels in `overlay` (over it), or stop.
export async function showRoom(canvas: HTMLCanvasElement | null, overlay: HTMLElement | null): Promise<boolean> {
  if (!canvas || !overlay) {
    if (room) {
      // everyone back to their cards
      for (const seat of room.seats) {
        if (seat.holds) {
          seat.group.remove(seat.holds.root);
          if (seat.holds.body) seat.group.remove(seat.holds.body);
        }
      }
      room.renderer.dispose();
      for (const el of room.labels.values()) el.remove();
      room = null;
    }
    await roomView(null);
    return false;
  }
  try {
    const THREE = await roomView({ draw, at: (slot) => room?.at.get(slot) ?? null });
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    furnish(THREE, scene);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 120);
    room = { THREE, renderer, scene, camera, seats: [], look: { x: 0, y: 0 }, labels: new Map(), overlay, canvas, at: new Map(), seatOf: new Map(), last: performance.now() };
    return true;
  } catch (err) {
    console.error(err);
    await roomView(null);
    return false;
  }
}
