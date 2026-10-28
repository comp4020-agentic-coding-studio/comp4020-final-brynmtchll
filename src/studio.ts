// The studio's script: your avatar large and live while you make it. Every
// change shows at once on the preview (a 3D head you can turn and zoom,
// which can follow your face and try an emote) and is saved for everyone a
// moment later; undo and redo walk back and forth through what you've
// changed. Without this script the page is a plain form, and nothing saves.
import { avatarSvg, fromShapes, REST, smoother, type Expression, type Pose } from "./avatar.ts";
import { arms, emote, head3d, webgl, withBody, zoom } from "./head3d.ts";
import { readHands, type HandReader } from "./handreader.ts";
import { emoteOf, MORE_EXTRAS, randomLook, SLIDERS, STYLES, type Look } from "./packs.ts";
import { wordHtml } from "./voice.ts";
import { tryVoice } from "./speech.ts";

const form = document.getElementById("look") as HTMLFormElement;
const preview = document.querySelector<HTMLElement>(".preview")!;
const slot = preview.querySelector<HTMLElement>(".preview-head")!;
const status = document.getElementById("status") as HTMLElement;
const undoButton = document.getElementById("undo") as HTMLButtonElement;
const redoButton = document.getElementById("redo") as HTMLButtonElement;
const say = (text: string): void => void (status.textContent = text);

let look = JSON.parse(preview.dataset.look!) as Look;

// ---- the preview: turned by dragging, zoomed by scrolling or pinching ----

// A turn a drag gives the head, eased back towards facing you when let go
// (unless it's following your face, which turns it instead).
let turn: Pose = { pitch: 0.05, yaw: -0.35, roll: 0, x: 0, y: 0, z: 0 };
let face: Expression = REST;
let following = false;
let near = 1.1;
function draw(): void {
  if (webgl) void head3d(slot, look, face, following ? null : turn);
  else slot.innerHTML = avatarSvg(look, face, "Your avatar");
}

let dragging: { x: number; y: number; from: Pose } | null = null;
slot.addEventListener("pointerdown", (e) => {
  dragging = { x: e.clientX, y: e.clientY, from: { ...turn } };
  slot.setPointerCapture(e.pointerId);
});
slot.addEventListener("pointermove", (e) => {
  if (!dragging || following) return;
  const dx = (e.clientX - dragging.x) / slot.clientWidth;
  const dy = (e.clientY - dragging.y) / slot.clientHeight;
  turn = { ...turn, yaw: Math.max(-1.4, Math.min(1.4, dragging.from.yaw + dx * 3)), pitch: Math.max(-0.5, Math.min(0.5, dragging.from.pitch + dy * 1.5)) };
  draw();
});
slot.addEventListener("pointerup", () => void (dragging = null));
slot.addEventListener("pointercancel", () => void (dragging = null));
slot.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    near = Math.min(2, Math.max(0.7, near * Math.exp(-e.deltaY * 0.0015)));
    zoom(slot, near);
  },
  { passive: false },
);
// two fingers: pinch to zoom
const touches = new Map<number, { x: number; y: number }>();
let pinch: { d: number; from: number } | null = null;
slot.addEventListener("pointerdown", (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), from: near };
    dragging = null;
  }
});
slot.addEventListener("pointermove", (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    near = Math.min(2, Math.max(0.7, (pinch.from * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d));
    zoom(slot, near);
  }
});
for (const end of ["pointerup", "pointercancel"]) {
  slot.addEventListener(end, (e) => {
    touches.delete((e as PointerEvent).pointerId);
    if (touches.size < 2) pinch = null;
  });
}
document.getElementById("studio-front")?.addEventListener("click", () => {
  turn = { pitch: 0, yaw: 0, roll: 0, x: 0, y: 0, z: 0 };
  near = 1.1;
  zoom(slot, near);
  draw();
});
// try an emote on yourself (here only: nobody else sees it)
document.getElementById("studio-emote")?.addEventListener("change", (e) => {
  const select = e.target as HTMLSelectElement;
  const em = emoteOf(select.value);
  select.value = "";
  if (em) emote(slot, em);
});

// A sample of how your words look in your style: a loud word, a high one,
// a quiet one and a drawn-out one, as if you'd said them.
function sample(): void {
  const st = STYLES.find((x) => x.id === look.words) ?? STYLES[0];
  preview.dataset.words = st.id;
  preview.dataset.font = st.font;
  preview.toggleAttribute("data-glow", "glow" in st);
  const w = (word: string, loud: number, pitch: number, stretch = 0): string => wordHtml({ w: word, start: 0, end: 0.4, loud, pitch, rise: 0, stretch, held: null, contour: [] });
  preview.querySelector(".preview-words")!.innerHTML = [w("oh", -3, 1), w("this", 0, 0), w("is", -2, -1), w("SO", 9, 5), w("good", 2, 2, 1.6)].join(" ");
}

// ---- what's chosen, as a look ----

// The form's state as a look: each part's choice, each colour, the sliders
// (tune.<id>), and what else is worn (up to MORE_EXTRAS).
function fromForm(): Look {
  const data = new FormData(form);
  const out: Record<string, unknown> = {};
  const tune: Record<string, number> = {};
  const more: string[] = [];
  for (const [k, v] of data) {
    if (typeof v !== "string" || k === "look-tab") continue;
    if (k.startsWith("tune.")) {
      const n = Number(v);
      if (n !== 0) tune[k.slice(5)] = n;
    }
    else if (k === "more") more.push(v);
    else out[k] = v;
  }
  return { ...look, ...out, tune, more: more.filter((m) => m !== out.extra).slice(0, MORE_EXTRAS) } as Look;
}

// The form set to a look (after undo, a saved look, a surprise).
function toForm(l: Look): void {
  for (const [k, v] of Object.entries(l)) {
    if (typeof v !== "string") continue;
    let radio = form.querySelector<HTMLInputElement>(`input[type=radio][name="${k}"][value="${CSS.escape(v)}"]`);
    if (!radio) {
      // a colour from the picker rather than a swatch
      radio = form.querySelector<HTMLInputElement>(`input[name="${k}"][data-custom]`);
      if (radio) {
        radio.value = v;
        const picker = radio.closest("label")?.querySelector<HTMLInputElement>("input[type=color]");
        if (picker) picker.value = v;
      }
    }
    if (radio) radio.checked = true;
  }
  for (const range of form.querySelectorAll<HTMLInputElement>("input[type=range]")) {
    range.value = String((l.tune as Record<string, number> | undefined)?.[range.name.slice(5)] ?? 0);
  }
  for (const box of form.querySelectorAll<HTMLInputElement>("input[name=more]")) box.checked = (l.more ?? []).includes(box.value as never);
  limitMore();
}

// at most MORE_EXTRAS ticked as well, and never the one already worn
function limitMore(): void {
  const main = (form.querySelector<HTMLInputElement>("input[name=extra]:checked")?.value ?? "none") as string;
  const boxes = [...form.querySelectorAll<HTMLInputElement>("input[name=more]")];
  const ticked = boxes.filter((b) => b.checked && b.value !== main).length;
  for (const b of boxes) {
    if (b.value === main) b.checked = false;
    b.disabled = b.value === main || (!b.checked && ticked >= MORE_EXTRAS);
  }
}

// ---- changing it: at once here, saved a moment later, undoable ----

const SAVE_AFTER = 400; // ms after the last change
const past: Look[] = [];
const future: Look[] = [];
let saveTimer: number | undefined;
let settled = JSON.stringify(look); // what the last undo step was taken from

function apply(next: Look, record = true): void {
  if (record && JSON.stringify(next) !== settled) {
    past.push(JSON.parse(settled) as Look);
    if (past.length > 60) past.shift();
    future.length = 0;
  }
  look = next;
  settled = JSON.stringify(next);
  preview.dataset.look = settled;
  undoButton.disabled = past.length === 0;
  redoButton.disabled = future.length === 0;
  draw();
  sample();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, SAVE_AFTER);
}

async function save(): Promise<void> {
  try {
    // every slider said, at 0 too: the server keeps any not mentioned as it
    // was, so one put back to 0 (or left out of a surprise) has to say so
    const tune = Object.fromEntries(SLIDERS.map((sl) => [sl.id, (look.tune as Record<string, number> | undefined)?.[sl.id] ?? 0]));
    const res = await fetch("/look", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ look: { ...look, tune } }) });
    if (!res.ok) return say("Couldn't save that. Try again.");
    say("Saved. Everyone sees you like this.");
  } catch {
    say("Couldn't save. Check your connection.");
  }
}

// A slider moves the preview as it's dragged, and counts as one change
// when it's let go, so undo takes back the whole drag.
form.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.type === "color") {
    const radio = t.closest("label")?.querySelector<HTMLInputElement>("input[type=radio]");
    if (radio) {
      radio.value = t.value;
      radio.checked = true;
    }
  }
  if (t.type === "range" || t.type === "color") {
    look = fromForm();
    preview.dataset.look = JSON.stringify(look);
    draw();
  }
});
form.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name === "look-tab") return;
  if (t.name === "extra" || t.name === "more") limitMore();
  apply(fromForm());
});
form.addEventListener("click", (e) => {
  const reset = (e.target as HTMLElement).closest<HTMLElement>("[data-reset]");
  if (!reset) return;
  const range = form.querySelector<HTMLInputElement>(`input[name="tune.${reset.dataset.reset}"]`);
  if (range) range.value = "0";
  apply(fromForm());
});

undoButton.addEventListener("click", () => {
  const prev = past.pop();
  if (!prev) return;
  future.push(look);
  toForm(prev);
  apply(prev, false);
});
redoButton.addEventListener("click", () => {
  const next = future.pop();
  if (!next) return;
  past.push(look);
  toForm(next);
  apply(next, false);
});
addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || (e.target as HTMLElement).closest("input[type=text], textarea")) return;
  e.preventDefault();
  (e.shiftKey ? redoButton : undoButton).click();
});

document.getElementById("surprise")?.addEventListener("click", () => {
  const next = randomLook();
  toForm(next);
  apply({ ...fromForm(), tune: next.tune });
});

// ---- how your words sound ----

// The sample sentence, said in your voice the way the sample's drawn: "oh
// this is" quietly, "SO" loud and high, "good" drawn out.
document.getElementById("hear-voice")?.addEventListener("click", () =>
  tryVoice(look, [
    { text: "oh this is", loud: -3, pitch: 0, stretch: 0 },
    { text: "so", loud: 9, pitch: 5, stretch: 0 },
    { text: "good", loud: 2, pitch: 2, stretch: 1.6 },
  ]),
);

// ---- saved looks ----

document.querySelector(".saved-looks")?.addEventListener("click", async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-slot]");
  if (!btn) return;
  if (btn.classList.contains("wear") && btn.dataset.look) {
    const l = JSON.parse(btn.dataset.look) as Look;
    toForm(l);
    return apply(l);
  }
  if (!btn.classList.contains("keep")) return;
  // what's saved is what's worn: make sure it's been saved first
  clearTimeout(saveTimer);
  await save();
  try {
    const res = await fetch("/looks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot: Number(btn.dataset.slot) }) });
    if (!res.ok) return say("Couldn't save that look. Try again.");
    const { looks } = (await res.json()) as { looks: (Look | null)[] };
    const saved = looks[Number(btn.dataset.slot)];
    const wear = btn.parentElement?.querySelector<HTMLButtonElement>(".wear");
    if (wear && saved) {
      wear.disabled = false;
      wear.dataset.look = JSON.stringify(saved);
      wear.setAttribute("aria-label", `Wear saved look ${Number(btn.dataset.slot) + 1}`);
      wear.innerHTML = avatarSvg(saved, REST, "");
    }
    say(`Saved to slot ${Number(btn.dataset.slot) + 1}.`);
  } catch {
    say("Couldn't save that look. Check your connection.");
  }
});

// ---- following your face, here only ----

// The camera read on this page alone, so you can see your expressions on
// what you're making; nothing is sent from here.
const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const faceButton = document.getElementById("studio-face") as HTMLButtonElement;
let stopFace: (() => void) | undefined;
// and your arms and hands too, if asked: read off the same camera, in a
// worker (handreader.ts), on your avatar here
const handsButton = document.getElementById("studio-hands") as HTMLButtonElement;
let hands: HandReader | null = null;
function handsOff(): void {
  hands?.stop();
  hands = null;
  arms(slot, null);
  handsButton.setAttribute("aria-pressed", "false");
}
handsButton.addEventListener("click", () => {
  if (hands) return handsOff();
  handsButton.setAttribute("aria-pressed", "true");
  say("Loading the hand reader…");
  hands = readHands({
    ready: () => say("Your arms and hands too, here only."),
    failed: (why) => {
      console.error(why);
      say("Couldn't read your hands here.");
      handsOff();
    },
    read: (body) => arms(slot, body),
  });
});
faceButton.addEventListener("click", async () => {
  if (stopFace) {
    stopFace();
    stopFace = undefined;
    following = false;
    face = REST;
    faceButton.setAttribute("aria-pressed", "false");
    faceButton.textContent = "Follow my face";
    handsOff();
    handsButton.hidden = true;
    return draw();
  }
  faceButton.disabled = true;
  say("Opening your camera…");
  let camera: MediaStream | undefined;
  try {
    camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } });
    const { FaceLandmarker, FilesetResolver } = await import(`${VISION}/vision_bundle.mjs`);
    const reader = await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(`${VISION}/wasm`), {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      numFaces: 1,
      minFaceDetectionConfidence: 0.3,
      minFacePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = camera;
    await video.play();
    const steady = smoother<Expression>(1.2, 0.6);
    const { poseFrom, placed } = await import("./avatar.ts");
    let home: ReturnType<typeof placed> | undefined;
    let running = true;
    const read = (): void => {
      if (!running) return;
      requestAnimationFrame(read);
      if (video.readyState < 2) return;
      const seen = reader.detectForVideo(video, performance.now());
      const shapes = seen.faceBlendshapes?.[0]?.categories as { categoryName: string; score: number }[] | undefined;
      const matrix = seen.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
      if (!shapes) return;
      face = steady(fromShapes(Object.fromEntries(shapes.map((c) => [c.categoryName, c.score]))), performance.now() / 1000);
      if (matrix) home ??= placed(matrix);
      void head3d(slot, look, face, matrix ? poseFrom(matrix, home) : null);
      hands?.frame(video, performance.now());
    };
    read();
    const opened = camera;
    stopFace = () => {
      running = false;
      for (const t of opened.getTracks()) t.stop();
      reader.close();
    };
    following = true;
    faceButton.setAttribute("aria-pressed", "true");
    faceButton.textContent = "Stop following";
    handsButton.hidden = false;
    say("Following your face, on this page only.");
  } catch (err) {
    console.error(err);
    // the camera off again if it opened, and the right reason given
    for (const t of camera?.getTracks() ?? []) t.stop();
    say(camera ? "Couldn't load the face reader. Check your connection and try again." : "Couldn't follow your face here: the camera's blocked or there isn't one.");
  } finally {
    faceButton.disabled = false;
  }
});

limitMore();
// the studio shows your shoulders and arms all the time, so you see your top
withBody(slot);
zoom(slot, near);
draw();
sample();
