import * as THREE from "three";
import { CAMERA } from "@hearthgate/shared";
import { goblinFigure, newWalkState, poseFigure, type Figure } from "./figures";
import { knightFigure, loadModels, weaponMesh, type RigState } from "./models";

/**
 * The turnaround sheet (`npm run turnaround`, `tests/turnaround.ts`): the KayKit Knight every
 * player is and the spike's goblin, each on a plain backdrop from the front, side, back and the game's over-the-shoulder camera, in
 * its idle, mid-walk and mid-swing pose, with the reference model's crop on the left. Dev only:
 * the production build has one entry, `index.html`, and never ships this page.
 */
type Kind = "knight" | "goblin";
type PoseName = "idle" | "walk" | "swing";

const PANEL_W = 300;
const PANEL_H = 400;
const LABEL_H = 30;
const BACKDROP = 0xefe3c6; // Bone, the reference sheets' parchment
const INK = "#2a2622";
const GOBLIN_SKIN = 0xa5c83a; // render.ts PALETTE.goblin
const PARTY_BLUE = new THREE.Color(0x3fa9f5); // The first party colour, on the Knight's outline.

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(PANEL_W, PANEL_H);
renderer.setClearColor(BACKDROP);

function scene(): THREE.Scene {
  // The game's lights (render.ts): a warm hemisphere and a high sun to one side.
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xfff4dc, 0x6b8a52, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sun.position.set(12, 20, 8);
  s.add(sun);
  return s;
}

function build(kind: Kind): Figure {
  if (kind === "goblin") return goblinFigure(GOBLIN_SKIN);
  const f = knightFigure(PARTY_BLUE);
  // The one-handed sword the game puts in the hand (render.ts PlayerMesh), so the swing reads.
  f.hand.add(weaponMesh("sword_1handed"));
  return f;
}

/** The Knight's clips, run the way render.ts runs them: settle into the base, then into the pose. */
function poseRig(f: Figure, p: PoseName) {
  const s: RigState = { speed: 0, cls: "oneHand", attacking: false, guarding: false, dodging: false, jumping: false, hit: false, downed: false, dead: false };
  if (p === "walk") s.speed = 1.5;
  for (let i = 0; i < 30; i++) f.rig!.update(1 / 30, s);
  if (p !== "swing") return;
  s.attacking = true;
  // About the chop's top: the blade overhead, before it comes down.
  for (let i = 0; i < 9; i++) f.rig!.update(1 / 30, s);
}

function pose(f: Figure, kind: Kind, p: PoseName) {
  if (f.rig) {
    poseRig(f, p);
    f.root.updateMatrixWorld(true);
    return;
  }
  const walk = newWalkState();
  if (p === "walk") {
    walk.phase = Math.PI / 2; // the widest point of the stride
    walk.amount = 1;
  }
  // Idle at a quarter of the sway's period: the furthest it leans.
  poseFigure(f, walk, p === "swing" ? 1 : 0, 750, 0);
  // The goblin's swing is its windup: render.ts also rears the whole figure back.
  f.root.rotation.x = kind === "goblin" && p === "swing" ? -0.3 : 0;
}

/** Each view: the camera's place and look target, relative to a figure at the origin facing +z. */
const box = new THREE.Box3();
const size = new THREE.Vector3();
const centre = new THREE.Vector3();

function placeCamera(cam: THREE.PerspectiveCamera, view: string, f: Figure) {
  // Fit the posed figure's bounding box (ears, shield and sword included) with a margin.
  box.setFromObject(f.root);
  box.getSize(size);
  box.getCenter(centre);
  const across = Math.max(size.x, size.z) * (PANEL_H / PANEL_W);
  const dist = (Math.max(size.y, across) * 1.12) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) + Math.max(size.x, size.z) / 2;
  const { x, y, z } = centre;
  if (view === "front") cam.position.set(x, y, z + dist);
  else if (view === "side") cam.position.set(x + dist, y, z);
  else if (view === "back") cam.position.set(x, y, z - dist);
  if (view !== "in game") {
    cam.lookAt(x, y, z);
    return;
  }
  // The game's camera behind the player: CAMERA's pitch and distance, the look target at head
  // height and a shoulder's width to the camera's right (-x when it looks along +z).
  const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
  const tx = -CAMERA.shoulderM;
  cam.position.set(tx, CAMERA.targetY + Math.sin(pitch) * CAMERA.distanceM, -Math.cos(pitch) * CAMERA.distanceM);
  cam.lookAt(tx, CAMERA.targetY, 0);
}

const VIEWS = ["front", "side", "back", "in game"] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** One sheet: the reference crop, then the four views of `kind` in pose `p`. Returns a PNG data URL. */
async function sheet(kind: Kind, p: PoseName, ref: { src: string; crop: [number, number, number, number] }): Promise<string> {
  const img = await loadImage(ref.src);
  const [sx, sy, sw, sh] = ref.crop;
  const refW = Math.round((sw / sh) * PANEL_H);
  const out = document.createElement("canvas");
  out.width = refW + PANEL_W * VIEWS.length;
  out.height = PANEL_H + LABEL_H;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#efe3c6";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, refW, PANEL_H);

  const s = scene();
  const f = build(kind);
  s.add(f.root);
  pose(f, kind, p);
  const cam = new THREE.PerspectiveCamera(30, PANEL_W / PANEL_H, 0.1, 50);
  VIEWS.forEach((view, i) => {
    if (view === "in game") cam.fov = 50; // the game's own field of view
    cam.aspect = PANEL_W / PANEL_H;
    cam.updateProjectionMatrix();
    placeCamera(cam, view, f);
    renderer.render(s, cam);
    ctx.drawImage(renderer.domElement, refW + i * PANEL_W, 0);
  });

  ctx.fillStyle = INK;
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`reference`, refW / 2, PANEL_H + 21);
  VIEWS.forEach((view, i) => ctx.fillText(`${kind}, ${p}: ${view}`, refW + i * PANEL_W + PANEL_W / 2, PANEL_H + 21));
  ctx.strokeStyle = "#c99a3b";
  for (let i = 0; i <= VIEWS.length; i++) {
    const x = refW + i * PANEL_W + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, PANEL_H);
    ctx.stroke();
  }
  return out.toDataURL("image/png");
}

/** Called by the turnaround script with the reference images; returns one PNG per kind and pose. */
(window as unknown as { __turnaround: unknown }).__turnaround = async (refs: Record<Kind, { src: string; crop: [number, number, number, number] }>) => {
  const sheets: Record<string, string> = {};
  await loadModels();
  for (const kind of ["knight", "goblin"] as const) {
    for (const p of ["idle", "walk", "swing"] as const) sheets[`${kind}-${p}`] = await sheet(kind, p, refs[kind]);
  }
  return sheets;
};
