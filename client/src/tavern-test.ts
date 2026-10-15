import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CAMERA, levelById, STARTER_WEAPON } from "@hearthgate/shared";
import { loadModels } from "./models";
import { View } from "./render";

/**
 * The village kit's scale test (`npm run tavern-test`, `tests/tavern-test.ts`; decisions.md
 * 2026-10-14, 2A): the KayKit Medieval Hexagon tavern stood on the greybox Tavern's spot in the
 * real village View, scaled so its door is about 2.2 m beside the 1.8 m Knight, shot from the game's
 * camera. Dev only, like the turnaround: the build never ships it, and the village is not dressed.
 */
type Shot = { scale: number; turn: number; player: { x: number; z: number; facing: number }; yaw: number; pitchDeg?: number };

const app = document.getElementById("app")!;
const view = new View(app);
const village = levelById("village");
const tavernSpot = village.buildings!.find((b) => b.name === "Tavern")!;
let tavern: THREE.Object3D | null = null;

async function setup() {
  await loadModels();
  view.setLevel(village);
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/kaykit/hexagon/building_tavern_green.gltf`);
  tavern = gltf.scene;
  tavern.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  // The greybox Tavern the model stands in for (walls, roof, sign) is hidden, so the shots show the
  // model alone; the sim's walls are unchanged.
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  view.scene.updateMatrixWorld(true);
  view.scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && !(o as THREE.Sprite).isSprite) return;
    box.setFromObject(o);
    box.getCenter(c);
    const small = box.max.x - box.min.x < 20;
    if (small && Math.abs(c.x - tavernSpot.x) <= tavernSpot.hw + 0.6 && Math.abs(c.z - tavernSpot.z) <= tavernSpot.hd + 0.8) o.visible = false;
  });
  view.scene.add(tavern);
  view.ensurePlayer("me", "Knight", "#3fa9f5", true);
}

const ready = setup();

(window as unknown as { __tavern: unknown }).__tavern = async (shot: Shot): Promise<string> => {
  await ready;
  const t = tavern!;
  t.scale.setScalar(shot.scale);
  t.rotation.y = shot.turn;
  t.position.set(tavernSpot.x, 0, tavernSpot.z);
  const pose = { x: shot.player.x, z: shot.player.z, facing: shot.player.facing };
  const v = { hp: 100, weapon: STARTER_WEAPON, attacking: false, swingActive: false, cleaveActive: false, dodging: false, jumping: false, lift: 0, guarding: false, staggered: false, downed: false, pickup: 0, dead: false };
  // The game's camera, placed outright rather than eased there: behind the player along the yaw
  // (0 looks north, +z), CAMERA's distance and pitch, the look target at head height a shoulder
  // to the right.
  const cam = view.camera;
  cam.aspect = 1280 / 720;
  cam.updateProjectionMatrix();
  view.renderer.setSize(1280, 720);
  const pitch = THREE.MathUtils.degToRad(shot.pitchDeg ?? CAMERA.pitchDeg);
  const fx = Math.sin(shot.yaw);
  const fz = Math.cos(shot.yaw);
  const tx = pose.x - fz * CAMERA.shoulderM;
  const tz = pose.z + fx * CAMERA.shoulderM;
  const back = Math.cos(pitch) * CAMERA.distanceM;
  // Let the idle settle, as a second of play would.
  for (let i = 0; i < 30; i++) {
    view.updatePlayer("me", pose, v);
    await new Promise((r) => setTimeout(r, 16));
  }
  cam.position.set(tx - fx * back, CAMERA.targetY + Math.sin(pitch) * CAMERA.distanceM, tz - fz * back);
  cam.lookAt(tx, CAMERA.targetY, tz);
  // Read the canvas in the same task as the render: the drawing buffer is not preserved.
  view.render();
  return view.renderer.domElement.toDataURL("image/png");
};
