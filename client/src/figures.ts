import * as THREE from "three";
import type { EnemyKind } from "@hearthgate/shared";

/**
 * Placeholder figures: a few flat-shaded parts per kind, built once when render.ts makes the
 * entity, posed per frame by `poseFigure`. Stand-ins until the commissioned models arrive, so each
 * kind is one function here that a loaded model can replace as long as it returns a `Figure`.
 *
 * Silhouettes are exaggerated per the design doc's Art section so a kind reads at the raised
 * camera: the player broad-shouldered with the weapon in hand, the goblin small and hunched with
 * big ears, the Shieldbearer bulky behind its plank, the Charger heavy and low, the Pack Leader
 * tall with a crest. The group's origin is at the feet; +z is the facing.
 */
export interface Figure {
  root: THREE.Group;
  /** Hip and shoulder pivots: legs and arms swing about x. */
  legs: [THREE.Object3D, THREE.Object3D];
  arms: [THREE.Object3D, THREE.Object3D];
  /** The right hand's pivot, where a held weapon hangs (players only use it). */
  hand: THREE.Object3D;
  /** The colour that flashes: party colour for players, the kind's skin for enemies. */
  skin: THREE.MeshStandardMaterial;
  /** How far forward the torso leans at rest (goblins hunch). */
  hunch: number;
  /** Top of the head above the feet, metres: name tags and bars sit above it. */
  height: number;
}

/** Walk state a mesh keeps between frames; `stepFigureWalk` advances it from the drawn pose. */
export interface WalkState {
  x: number;
  z: number;
  t: number;
  phase: number;
  amount: number;
  started: boolean;
}

export function newWalkState(): WalkState {
  return { x: 0, z: 0, t: 0, phase: 0, amount: 0, started: false };
}

/** A full stride cycle per this many metres walked. */
const STRIDE_M = 1.3;
/** Speeds at or above this swing the legs fully (the player walks at 5 m/s). */
const FULL_SWING_MPS = 3;

/** Advance the walk cycle from how far the drawn pose moved since the last frame. */
export function stepFigureWalk(w: WalkState, x: number, z: number, t: number) {
  if (!w.started) {
    w.started = true;
    w.x = x;
    w.z = z;
    w.t = t;
    return;
  }
  const dt = Math.max(1, t - w.t);
  const d = Math.hypot(x - w.x, z - w.z);
  w.x = x;
  w.z = z;
  w.t = t;
  // A teleport (respawn, a throw) is not a stride.
  if (d > 1.5) return;
  w.phase = (w.phase + (d / STRIDE_M) * Math.PI * 2) % (Math.PI * 2);
  const target = Math.min(1, (d / dt) * 1000 / FULL_SWING_MPS);
  // Ease the swing in and out over about a tenth of a second so stops don't freeze mid-stride.
  w.amount += (target - w.amount) * (1 - Math.exp(-dt / 100));
}

/**
 * Pose the parts: a walk swing scaled by `walk.amount`, a small bob, and the right arm raised
 * forward by `swing` (0..1) for an attack. No allocations: rotations are set in place.
 */
export function poseFigure(f: Figure, walk: WalkState, swing: number) {
  const s = Math.sin(walk.phase) * 0.6 * walk.amount;
  f.legs[0].rotation.x = s;
  f.legs[1].rotation.x = -s;
  f.arms[0].rotation.x = -s * 0.8;
  f.arms[1].rotation.x = swing > 0 ? -1.4 * swing : s * 0.8;
  f.root.position.y = Math.abs(Math.cos(walk.phase)) * 0.06 * walk.amount;
}

function flat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** A limb hanging from a pivot at (x, y, z): the box's top sits on the pivot, so rotating it swings the limb. */
function limb(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, w: number, len: number, d: number) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  part(new THREE.BoxGeometry(w, len, d), mat, 0, -len / 2, 0, pivot);
  return pivot;
}

/** The part of a figure above the hips that hunches: torso, head and arms lean together. */
function upperBody(root: THREE.Group, hipY: number, hunch: number): THREE.Group {
  const upper = new THREE.Group();
  upper.position.y = hipY;
  upper.rotation.x = hunch;
  root.add(upper);
  return upper;
}

export function playerFigure(color: THREE.Color): Figure {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
  const trousers = flat(0x3b3a40);
  const face = flat(0xe0b48c);
  const hipY = 0.8;
  const legs: [THREE.Object3D, THREE.Object3D] = [
    limb(root, trousers, -0.14, hipY, 0, 0.18, 0.8, 0.2),
    limb(root, trousers, 0.14, hipY, 0, 0.18, 0.8, 0.2)
  ];
  const upper = upperBody(root, hipY, 0);
  // Broad at the shoulders, narrow at the waist: four sides so the wedge stays flat-shaded.
  const torso = new THREE.CylinderGeometry(0.42, 0.24, 0.62, 4);
  torso.rotateY(Math.PI / 4);
  part(torso, skin, 0, 0.31, 0, upper);
  part(new THREE.IcosahedronGeometry(0.2, 0), face, 0, 0.84, 0, upper);
  // A dark brow band on the front of the head: the facing reads even with the weapon away.
  part(new THREE.BoxGeometry(0.3, 0.08, 0.1), trousers, 0, 0.88, 0.15, upper);
  const arms: [THREE.Object3D, THREE.Object3D] = [
    limb(upper, skin, -0.4, 0.56, 0, 0.14, 0.58, 0.16),
    limb(upper, skin, 0.4, 0.56, 0, 0.14, 0.58, 0.16)
  ];
  const hand = new THREE.Group();
  hand.position.set(0, -0.55, 0);
  arms[1].add(hand);
  return { root, legs, arms, hand, skin, hunch: 0, height: hipY + 1.04 };
}

/** The goblin family's shared shape, scaled and decorated per kind. */
function goblinShape(skinColor: number, scale: number, hunch: number, earLen: number) {
  const root = new THREE.Group();
  const skin = flat(skinColor);
  const rags = flat(0x5a4632);
  const hipY = 0.5 * scale;
  const legs: [THREE.Object3D, THREE.Object3D] = [
    limb(root, skin, -0.12 * scale, hipY, 0, 0.12 * scale, hipY, 0.14 * scale),
    limb(root, skin, 0.12 * scale, hipY, 0, 0.12 * scale, hipY, 0.14 * scale)
  ];
  const upper = upperBody(root, hipY, hunch);
  const torso = new THREE.CylinderGeometry(0.3 * scale, 0.22 * scale, 0.5 * scale, 5);
  part(torso, rags, 0, 0.25 * scale, 0, upper);
  // An oversized head pushed forward, with the ears out to the sides.
  const headY = 0.62 * scale;
  const head = part(new THREE.DodecahedronGeometry(0.25 * scale, 0), skin, 0, headY, 0.08 * scale, upper);
  const ear = new THREE.ConeGeometry(0.08 * scale, earLen * scale, 4);
  ear.rotateZ(Math.PI / 2);
  part(ear, skin, -(0.22 + earLen / 2) * scale, headY + 0.06 * scale, 0.04 * scale, upper).rotation.z = -0.35;
  const right = part(ear, skin, (0.22 + earLen / 2) * scale, headY + 0.06 * scale, 0.04 * scale, upper);
  // Mirrored: turned half round, then tipped up like the left.
  right.rotation.set(0, Math.PI, -0.35);
  // Glowing eyes on the front of the head: the facing, and something to read in a dark room.
  part(new THREE.BoxGeometry(0.26 * scale, 0.06 * scale, 0.06 * scale), new THREE.MeshBasicMaterial({ color: 0xffe08a }), 0, headY + 0.03 * scale, 0.3 * scale, upper);
  const arms: [THREE.Object3D, THREE.Object3D] = [
    limb(upper, skin, -0.32 * scale, 0.45 * scale, 0, 0.1 * scale, 0.5 * scale, 0.12 * scale),
    limb(upper, skin, 0.32 * scale, 0.45 * scale, 0, 0.1 * scale, 0.5 * scale, 0.12 * scale)
  ];
  const hand = new THREE.Group();
  hand.position.set(0, -0.48 * scale, 0);
  arms[1].add(hand);
  const height = hipY + (headY + 0.25 * scale) * Math.cos(hunch);
  return { root, legs, arms, hand, skin, hunch, height, upper, head, rags };
}

export function goblinFigure(skinColor: number): Figure {
  const g = goblinShape(skinColor, 1, 0.45, 0.42);
  // A stubby club.
  const club = new THREE.CylinderGeometry(0.07, 0.04, 0.5, 5);
  club.rotateX(Math.PI / 2);
  part(club, flat(0x6b4f33), 0, 0, 0.2, g.hand);
  return g;
}

export function shieldbearerFigure(skinColor: number): Figure {
  // Bigger and more upright; the plank shield itself is the EnemyMesh's (it hides when broken).
  const g = goblinShape(skinColor, 1.35, 0.2, 0.3);
  // A helmet over the ears' root: a heavier read than the bare goblin head.
  part(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 6), flat(0x55524c), 0, 0.62 * 1.35 + 0.17, 0.08 * 1.35, g.upper);
  return g;
}

export function packLeaderFigure(skinColor: number): Figure {
  const g = goblinShape(skinColor, 1.45, 0.1, 0.5);
  // A crest of spikes along the head: the tallest outline in the room.
  const spike = new THREE.ConeGeometry(0.07, 0.36, 4);
  const crest = flat(0xc0392b);
  const top = 0.62 * 1.45 + 0.3;
  for (let i = 0; i < 3; i++) part(spike, crest, 0, top + (i === 1 ? 0.06 : 0), -0.12 + i * 0.12, g.upper);
  return { ...g, height: g.height + 0.3 };
}

export function chargerFigure(skinColor: number): Figure {
  const root = new THREE.Group();
  const skin = flat(skinColor);
  const hide = flat(0x5e3d28);
  const horn = flat(0xe8dcc0);
  const hipY = 0.5;
  // Four stubby legs under a long low barrel: a beast, not a goblin.
  const legs: [THREE.Object3D, THREE.Object3D] = [
    limb(root, hide, -0.28, hipY, -0.35, 0.2, hipY, 0.2),
    limb(root, hide, 0.28, hipY, -0.35, 0.2, hipY, 0.2)
  ];
  const arms: [THREE.Object3D, THREE.Object3D] = [
    limb(root, hide, -0.28, hipY, 0.35, 0.2, hipY, 0.2),
    limb(root, hide, 0.28, hipY, 0.35, 0.2, hipY, 0.2)
  ];
  const barrel = new THREE.CylinderGeometry(0.42, 0.38, 1.2, 6);
  barrel.rotateX(Math.PI / 2);
  part(barrel, skin, 0, hipY + 0.32, 0, root);
  // A hump over the shoulders and a low head with tusks: it leads with them.
  part(new THREE.DodecahedronGeometry(0.34, 0), skin, 0, hipY + 0.62, 0.3, root);
  part(new THREE.BoxGeometry(0.4, 0.34, 0.36), hide, 0, hipY + 0.22, 0.72, root);
  const tusk = new THREE.ConeGeometry(0.06, 0.38, 4);
  tusk.rotateX(Math.PI / 2 - 0.5);
  part(tusk, horn, -0.16, hipY + 0.2, 0.98, root);
  part(tusk, horn, 0.16, hipY + 0.2, 0.98, root);
  part(new THREE.BoxGeometry(0.3, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xffe08a }), 0, hipY + 0.3, 0.91, root);
  const hand = new THREE.Group();
  root.add(hand);
  return { root, legs, arms, hand, skin, hunch: 0, height: hipY + 0.96 };
}

/** The figure for an enemy kind: the one switch the commissioned models replace. */
export function enemyFigure(kind: EnemyKind, skinColor: number): Figure {
  switch (kind) {
    case "shieldbearer":
      return shieldbearerFigure(skinColor);
    case "charger":
      return chargerFigure(skinColor);
    case "packLeader":
      return packLeaderFigure(skinColor);
    default:
      return goblinFigure(skinColor);
  }
}
