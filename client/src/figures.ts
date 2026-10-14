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
  /** The reference-model kinds only (adventurer, basic goblin): the pivot at the hips the whole
   * upper body hangs from, and the head on it. The idle sway, the swing's twist and the flinch
   * move these; the older kinds leave them out and pose as before. */
  torso?: THREE.Object3D;
  head?: THREE.Object3D;
  /** How far the weapon arm lifts at swing 1, radians (the goblin's windup goes overhead). */
  swingLift?: number;
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

/** The idle sway's period, ms: slow enough to read as breathing, not as fidgeting. */
const IDLE_PERIOD_MS = 3000;

/**
 * Pose the parts: a walk swing scaled by `walk.amount`, a small bob, and the right arm raised
 * forward by `swing` (0..1) for an attack. Figures with a torso pivot also sway at rest (by
 * `now`, ms), twist into the swing and rock back by `flinch` (0..1, a hit just landed). No
 * allocations: rotations are set in place.
 */
export function poseFigure(f: Figure, walk: WalkState, swing: number, now = 0, flinch = 0) {
  const s = Math.sin(walk.phase) * 0.6 * walk.amount;
  f.legs[0].rotation.x = s;
  f.legs[1].rotation.x = -s;
  f.arms[0].rotation.x = -s * 0.8;
  f.arms[1].rotation.x = swing > 0 ? -(f.swingLift ?? 1.4) * swing : s * 0.8;
  f.root.position.y = Math.abs(Math.cos(walk.phase)) * 0.06 * walk.amount;
  if (!f.torso) return;
  const rest = 1 - walk.amount;
  const breath = Math.sin((now / IDLE_PERIOD_MS) * Math.PI * 2);
  // Lean into the stride, twist the shoulders against the hips, sway side to side at rest.
  f.torso.rotation.x = f.hunch + 0.08 * walk.amount + 0.02 * breath * rest + 0.12 * swing - 0.45 * flinch;
  f.torso.rotation.y = -0.25 * s - 0.35 * swing;
  f.torso.rotation.z = 0.04 * Math.sin((now / IDLE_PERIOD_MS) * Math.PI) * rest;
  // Arms drift out a touch on the breath, so a standing figure is never a statue.
  f.arms[0].rotation.z = -0.06 - 0.03 * breath * rest;
  f.arms[1].rotation.z = 0.06 + 0.03 * breath * rest;
  if (f.head) f.head.rotation.x = -0.35 * flinch - 0.06 * swing;
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
  return adventurerFigure(color);
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
  return basicGoblinFigure(skinColor);
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

/*
 * The reference-model kinds (the art spike, decisions.md 2026-10-13): the base adventurer and the
 * basic goblin rebuilt to `docs/art/reference-models/`. Flat-shaded, one colour per face, a
 * lighter top baked into vertex colours, colours from the style guide's palette. Geometry is built
 * once per kind and shared by every figure of it; only the material that flashes is per figure.
 */

/** The style guide's shared neutrals and the few colours the two references add. */
const INK = 0x2a2622;
const OAK = 0x8b5a2b;
const DARK_TIMBER = 0x5a3a22;
const IRON = 0x6e7378;
const SHADOWSTONE = 0x4e4a44;
const BRASS = 0xc99a3b;
const HEARTWOOD = 0xa0522d;
const TORCH = 0xffb347;
const SKIN_TONE = 0xf2c49b;

/** The lighter-top gradient: a face at the feet is this bright, a face at the figure's top 1. */
const SHADE_BOTTOM = 0.82;

/**
 * Bake the gradient into a part: non-indexed, so each face gets the one colour of its centroid's
 * height (`atY` is where the part sits at rest, `topY` the figure's height). Returns the geometry.
 */
function shaded(geo: THREE.BufferGeometry, atY: number, topY: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + atY;
    const k = SHADE_BOTTOM + (1 - SHADE_BOTTOM) * Math.min(1, Math.max(0, cy / topY));
    colors.fill(k, i * 3, i * 3 + 9);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function faceted(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, vertexColors: true });
}

/** A box with its top corners pulled in by `taper` (0..1 of the half-width): a chunky low-poly wedge. */
function taperedBox(w: number, h: number, d: number, taperX: number, taperZ = taperX): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * (1 - taperX));
      pos.setZ(i, pos.getZ(i) * (1 - taperZ));
    }
  }
  return g;
}

interface Piece {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  x: number;
  y: number;
  z: number;
  ry?: number;
  rz?: number;
}

/** Add shared pieces under a pivot. */
function attach(parent: THREE.Object3D, pieces: Piece[]) {
  for (const p of pieces) {
    const m = part(p.geo, p.mat, p.x, p.y, p.z, parent);
    if (p.ry) m.rotation.y = p.ry;
    if (p.rz) m.rotation.z = p.rz;
  }
}

/** Shared, so many figures cost one set of buffers; the tinted material is the only per-figure one. */
const MAT = {
  skinTone: faceted(SKIN_TONE),
  hair: faceted(HEARTWOOD),
  trousers: faceted(DARK_TIMBER),
  leather: faceted(OAK),
  darkLeather: faceted(DARK_TIMBER),
  iron: faceted(IRON),
  sleeve: faceted(SHADOWSTONE),
  brass: faceted(BRASS),
  ink: new THREE.MeshBasicMaterial({ color: INK }),
  glow: new THREE.MeshBasicMaterial({ color: TORCH })
};

/** Base adventurer: about 4.1 heads, big head and hands, broad shoulders, short legs. */
const ADV = {
  hipY: 0.74,
  legX: 0.13,
  shoulderX: 0.31,
  shoulderY: 0.56,
  neckY: 0.6,
  top: 1.8
};

let advGeo: ReturnType<typeof buildAdventurerGeometry> | null = null;

function buildAdventurerGeometry() {
  const T = ADV.top;
  const hip = ADV.hipY;
  const legLen = hip - 0.26;
  const neckW = hip + ADV.neckY;
  const shoulderW = hip + ADV.shoulderY;
  return {
    // Legs: trousers, then a boot with a turned-down cuff and a toe that points the way.
    thigh: shaded(new THREE.CylinderGeometry(0.11, 0.095, legLen, 6), hip - legLen / 2, T),
    boot: shaded(taperedBox(0.22, 0.3, 0.32, 0.08, 0.2), 0.15, T),
    cuff: shaded(new THREE.CylinderGeometry(0.14, 0.13, 0.1, 6), 0.3, T),
    // The tunic: wide at the shoulders, narrower at the waist, skirted to mid-thigh.
    tunic: shaded(taperedBox(0.42, 0.74, 0.32, -0.2, -0.05), hip + 0.25, T),
    // The skirt flares below the belt, as the reference's does.
    skirt: shaded(taperedBox(0.5, 0.2, 0.36, 0.14, 0.08), hip - 0.04, T),
    belt: shaded(new THREE.BoxGeometry(0.46, 0.09, 0.35), hip + 0.05, T),
    buckle: shaded(new THREE.BoxGeometry(0.1, 0.08, 0.03), hip + 0.05, T),
    strap: shaded(new THREE.BoxGeometry(0.07, 0.66, 0.02), hip + 0.32, T),
    clasp: shaded(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6).rotateX(Math.PI / 2), hip + 0.44, T),
    pad: shaded(taperedBox(0.27, 0.16, 0.32, 0.3), shoulderW, T),
    neck: shaded(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 6), neckW, T),
    // Head: a chunky block with a jaw, hair swept up at the front, small dark eyes.
    skull: shaded(taperedBox(0.32, 0.34, 0.31, 0.05), neckW + 0.21, T),
    jaw: shaded(taperedBox(0.26, 0.08, 0.24, -0.15), neckW + 0.04, T),
    hairTop: shaded(taperedBox(0.36, 0.1, 0.34, 0.12), neckW + 0.4, T),
    hairBack: shaded(new THREE.BoxGeometry(0.35, 0.24, 0.07), neckW + 0.28, T),
    hairSide: shaded(new THREE.BoxGeometry(0.05, 0.14, 0.2), neckW + 0.32, T),
    quiff: shaded(new THREE.ConeGeometry(0.1, 0.22, 4).rotateX(-0.5), neckW + 0.42, T),
    eye: new THREE.BoxGeometry(0.045, 0.065, 0.02),
    brow: new THREE.BoxGeometry(0.08, 0.025, 0.02),
    nose: shaded(taperedBox(0.05, 0.08, 0.06, 0.4), neckW + 0.17, T),
    ear: shaded(new THREE.BoxGeometry(0.05, 0.09, 0.06), neckW + 0.2, T),
    // Arms: a dark sleeve, a leather bracer, a big glove.
    sleeve: shaded(new THREE.CylinderGeometry(0.09, 0.085, 0.24, 6), shoulderW - 0.12, T),
    bracer: shaded(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 6), shoulderW - 0.34, T),
    glove: shaded(taperedBox(0.17, 0.17, 0.17, -0.05), shoulderW - 0.53, T)
  };
}

function adventurerFigure(color: THREE.Color): Figure {
  const g = (advGeo ??= buildAdventurerGeometry());
  const root = new THREE.Group();
  // The party colour: the tunic (it flashes and darkens; render.ts tints it).
  const tunic = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, vertexColors: true });
  const hip = ADV.hipY;
  const legLen = hip - 0.26;
  const leg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * ADV.legX, hip, 0);
    root.add(pivot);
    attach(pivot, [
      { geo: g.thigh, mat: MAT.trousers, x: 0, y: -legLen / 2, z: 0 },
      { geo: g.cuff, mat: MAT.darkLeather, x: 0, y: 0.29 - hip, z: 0 },
      { geo: g.boot, mat: MAT.leather, x: 0, y: 0.14 - hip, z: 0.04 }
    ]);
    return pivot;
  };
  const legs: [THREE.Object3D, THREE.Object3D] = [leg(-1), leg(1)];

  const torso = upperBody(root, hip, 0);
  attach(torso, [
    { geo: g.tunic, mat: tunic, x: 0, y: 0.25, z: 0 },
    { geo: g.skirt, mat: tunic, x: 0, y: -0.04, z: 0 },
    { geo: g.belt, mat: MAT.darkLeather, x: 0, y: 0.05, z: 0 },
    { geo: g.buckle, mat: MAT.brass, x: 0, y: 0.05, z: 0.185 },
    // The bandolier crosses the chest from the left shoulder, and its back half shows from behind.
    { geo: g.strap, mat: MAT.darkLeather, x: 0, y: 0.32, z: 0.17, rz: 0.55 },
    { geo: g.strap, mat: MAT.darkLeather, x: 0, y: 0.32, z: -0.17, rz: -0.55 },
    { geo: g.clasp, mat: MAT.brass, x: -0.06, y: 0.44, z: 0.185 },
    { geo: g.pad, mat: MAT.iron, x: -ADV.shoulderX + 0.03, y: ADV.shoulderY + 0.02, z: 0 },
    { geo: g.pad, mat: MAT.iron, x: ADV.shoulderX - 0.03, y: ADV.shoulderY + 0.02, z: 0 },
    { geo: g.neck, mat: MAT.skinTone, x: 0, y: ADV.neckY, z: 0 }
  ]);

  const head = new THREE.Group();
  head.position.set(0, ADV.neckY, 0);
  torso.add(head);
  attach(head, [
    { geo: g.jaw, mat: MAT.skinTone, x: 0, y: 0.04, z: 0.02 },
    { geo: g.skull, mat: MAT.skinTone, x: 0, y: 0.21, z: 0 },
    { geo: g.nose, mat: MAT.skinTone, x: 0, y: 0.17, z: 0.17 },
    { geo: g.ear, mat: MAT.skinTone, x: -0.17, y: 0.2, z: -0.01 },
    { geo: g.ear, mat: MAT.skinTone, x: 0.17, y: 0.2, z: -0.01 },
    { geo: g.eye, mat: MAT.ink, x: -0.07, y: 0.23, z: 0.157 },
    { geo: g.eye, mat: MAT.ink, x: 0.07, y: 0.23, z: 0.157 },
    { geo: g.brow, mat: MAT.hair, x: -0.075, y: 0.285, z: 0.157 },
    { geo: g.brow, mat: MAT.hair, x: 0.075, y: 0.285, z: 0.157 },
    { geo: g.hairTop, mat: MAT.hair, x: 0, y: 0.4, z: -0.01 },
    { geo: g.hairBack, mat: MAT.hair, x: 0, y: 0.28, z: -0.14 },
    { geo: g.hairSide, mat: MAT.hair, x: -0.165, y: 0.32, z: -0.04 },
    { geo: g.hairSide, mat: MAT.hair, x: 0.165, y: 0.32, z: -0.04 },
    { geo: g.quiff, mat: MAT.hair, x: 0.04, y: 0.44, z: 0.1 },
    { geo: g.quiff, mat: MAT.hair, x: -0.08, y: 0.43, z: 0.02 },
    { geo: g.quiff, mat: MAT.hair, x: 0.1, y: 0.42, z: -0.06 }
  ]);

  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * ADV.shoulderX, ADV.shoulderY, 0);
    torso.add(pivot);
    attach(pivot, [
      { geo: g.sleeve, mat: MAT.sleeve, x: 0, y: -0.12, z: 0 },
      { geo: g.bracer, mat: MAT.leather, x: 0, y: -0.34, z: 0 },
      { geo: g.glove, mat: MAT.darkLeather, x: 0, y: -0.52, z: 0.01 }
    ]);
    return pivot;
  };
  const arms: [THREE.Object3D, THREE.Object3D] = [arm(-1), arm(1)];
  const hand = new THREE.Group();
  hand.position.set(0, -0.53, 0);
  arms[1].add(hand);
  return { root, legs, arms, hand, skin: tunic, hunch: 0, height: ADV.top, torso, head, swingLift: 1.4 };
}

/** Basic goblin: small and hunched, an oversized head with huge ears, sword and round shield. */
const GOB = {
  hipY: 0.42,
  legX: 0.1,
  shoulderX: 0.21,
  shoulderY: 0.3,
  neckY: 0.36,
  hunch: 0.4,
  top: 1.2
};

let gobGeo: ReturnType<typeof buildGoblinGeometry> | null = null;

function buildGoblinGeometry() {
  const T = GOB.top;
  const hip = GOB.hipY;
  const neckW = hip + GOB.neckY;
  const shoulderW = hip + GOB.shoulderY;
  // Ears: a flat four-sided blade pointing out along +x; the left is the same one turned round.
  const ear = new THREE.ConeGeometry(0.1, 0.46, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.35);
  return {
    shin: shaded(new THREE.CylinderGeometry(0.055, 0.05, hip - 0.12, 5), hip / 2 + 0.06, T),
    boot: shaded(taperedBox(0.13, 0.15, 0.2, 0.15, 0.25), 0.075, T),
    vest: shaded(taperedBox(0.32, 0.4, 0.25, -0.12, 0), hip + 0.17, T),
    belly: shaded(new THREE.DodecahedronGeometry(0.13, 0).scale(1, 0.8, 0.8), hip + 0.08, T),
    belt: shaded(new THREE.BoxGeometry(0.33, 0.06, 0.26), hip + 0.02, T),
    skull: shaded(new THREE.DodecahedronGeometry(0.21, 0).scale(1.1, 0.92, 1), neckW + 0.18, T),
    jaw: shaded(taperedBox(0.24, 0.08, 0.2, -0.1), neckW + 0.06, T),
    nose: shaded(new THREE.ConeGeometry(0.05, 0.17, 4).rotateX(Math.PI / 2 + 0.4), neckW + 0.15, T),
    ear: shaded(ear, neckW + 0.24, T),
    eye: new THREE.BoxGeometry(0.06, 0.04, 0.02),
    brow: new THREE.BoxGeometry(0.09, 0.03, 0.03),
    mouth: new THREE.BoxGeometry(0.12, 0.02, 0.02),
    arm: shaded(new THREE.CylinderGeometry(0.05, 0.045, 0.3, 5), shoulderW - 0.15, T),
    wrap: shaded(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 5), shoulderW - 0.26, T),
    hand: shaded(taperedBox(0.09, 0.09, 0.1, -0.1), shoulderW - 0.33, T),
    // A short, broad sword pointing forward out of the fist, and a round wooden shield.
    blade: shaded(taperedBox(0.07, 0.48, 0.025, 0.4, 0).rotateX(Math.PI / 2), shoulderW - 0.33, T),
    guard: shaded(new THREE.BoxGeometry(0.16, 0.04, 0.04), shoulderW - 0.33, T),
    grip: shaded(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 5).rotateX(Math.PI / 2), shoulderW - 0.33, T),
    shield: shaded(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 8).rotateZ(Math.PI / 2), shoulderW - 0.2, T),
    rim: shaded(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 8).rotateZ(Math.PI / 2), shoulderW - 0.2, T),
    boss: shaded(new THREE.ConeGeometry(0.06, 0.06, 6).rotateZ(Math.PI / 2), shoulderW - 0.2, T)
  };
}

function basicGoblinFigure(skinColor: number): Figure {
  const g = (gobGeo ??= buildGoblinGeometry());
  const root = new THREE.Group();
  // The skin flashes (hit, windup, rally); everything else is shared.
  const skin = faceted(skinColor);
  const hip = GOB.hipY;
  const leg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * GOB.legX, hip, 0);
    root.add(pivot);
    attach(pivot, [
      { geo: g.shin, mat: skin, x: 0, y: -(hip / 2 - 0.06), z: 0 },
      { geo: g.boot, mat: MAT.leather, x: 0, y: 0.075 - hip, z: 0.03 }
    ]);
    return pivot;
  };
  const legs: [THREE.Object3D, THREE.Object3D] = [leg(-1), leg(1)];

  const torso = upperBody(root, hip, GOB.hunch);
  attach(torso, [
    { geo: g.belly, mat: skin, x: 0, y: 0.08, z: 0.05 },
    { geo: g.vest, mat: MAT.leather, x: 0, y: 0.17, z: 0 },
    { geo: g.belt, mat: MAT.darkLeather, x: 0, y: 0.02, z: 0 }
  ]);

  const head = new THREE.Group();
  head.position.set(0, GOB.neckY, 0.06);
  // The head comes up out of the hunch, so it looks ahead rather than at the floor.
  head.rotation.x = -GOB.hunch * 0.7;
  torso.add(head);
  attach(head, [
    { geo: g.skull, mat: skin, x: 0, y: 0.18, z: 0 },
    { geo: g.jaw, mat: skin, x: 0, y: 0.06, z: 0.05 },
    { geo: g.nose, mat: skin, x: 0, y: 0.15, z: 0.24 },
    // Ears swept out and up, the goblin's whole silhouette.
    { geo: g.ear, mat: skin, x: 0.36, y: 0.24, z: -0.03, ry: 0.35, rz: 0.3 },
    { geo: g.ear, mat: skin, x: -0.36, y: 0.24, z: -0.03, ry: Math.PI - 0.35, rz: 0.3 },
    // Eyes glow: the facing, and something to read in a dark room.
    { geo: g.eye, mat: MAT.glow, x: -0.08, y: 0.21, z: 0.2 },
    { geo: g.eye, mat: MAT.glow, x: 0.08, y: 0.21, z: 0.2 },
    { geo: g.brow, mat: MAT.ink, x: -0.08, y: 0.25, z: 0.19, rz: -0.35 },
    { geo: g.brow, mat: MAT.ink, x: 0.08, y: 0.25, z: 0.19, rz: 0.35 },
    { geo: g.mouth, mat: MAT.ink, x: 0, y: 0.08, z: 0.15 }
  ]);

  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * GOB.shoulderX, GOB.shoulderY, 0.02);
    torso.add(pivot);
    attach(pivot, [
      { geo: g.arm, mat: skin, x: 0, y: -0.15, z: 0 },
      { geo: g.wrap, mat: MAT.leather, x: 0, y: -0.26, z: 0 },
      { geo: g.hand, mat: skin, x: 0, y: -0.33, z: 0 }
    ]);
    return pivot;
  };
  const arms: [THREE.Object3D, THREE.Object3D] = [arm(-1), arm(1)];
  const hand = new THREE.Group();
  hand.position.set(0, -0.33, 0);
  // The sword rides up out of the fist, as the reference holds it, not level with the floor.
  hand.rotation.x = -0.8;
  arms[1].add(hand);
  attach(hand, [
    { geo: g.grip, mat: MAT.darkLeather, x: 0, y: 0, z: 0.02 },
    { geo: g.guard, mat: MAT.iron, x: 0, y: 0, z: 0.09 },
    { geo: g.blade, mat: MAT.iron, x: 0, y: 0, z: 0.34 }
  ]);
  // The shield on the left forearm, turned to face forward and out.
  const shield = new THREE.Group();
  shield.position.set(-0.07, -0.2, 0.06);
  shield.rotation.y = 0.9;
  arms[0].add(shield);
  attach(shield, [
    { geo: g.rim, mat: MAT.iron, x: 0.005, y: 0, z: 0 },
    { geo: g.shield, mat: MAT.leather, x: -0.01, y: 0, z: 0 },
    { geo: g.boss, mat: MAT.brass, x: -0.05, y: 0, z: 0 }
  ]);
  const height = hip + (GOB.neckY + 0.4) * Math.cos(GOB.hunch);
  return { root, legs, arms, hand, skin, hunch: GOB.hunch, height, torso, head, swingLift: 2.6 };
}
