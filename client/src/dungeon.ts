import * as THREE from "three";
import type { Level, WallRect } from "@hearthgate/shared";
import { kitPiece, type KitPiece } from "./models";

/**
 * The Warrens dressed in the KayKit Dungeon Pack (decisions.md 2026-10-14, 1A). Draw-only: every
 * piece stands on a wall rectangle of the level or the floor, so nothing in sight is not also a
 * collider, and `level.ts` and the collision do not change. A kit piece that does not fit its
 * rectangle is stretched along the rectangle's length, never moved off it. Repeated pieces are
 * one `InstancedMesh` each, all on the kit's one material.
 */

/** Metres per kit unit: a kit wall is 1 unit thick, the sim's walls 0.8 m. */
const KIT_M = 0.8;
/** The kit's wall piece: 4 units long and 4 tall; its end cap 1.07 units long. */
const WALL_UNITS = 4;
const ENDCAP_UNITS = 1.07;
export const KIT_WALL_H = WALL_UNITS * KIT_M;
/** Mounted torches every this many metres along a wall face, this high. */
const TORCH_SPACING_M = 6;
const TORCH_Y_M = 2;
/**
 * The light cap: one lit torch per room and one in the hall, the torch nearest each one's middle.
 * Every point light is paid for on every lit pixel; eight cost a headless software frame about
 * 190 ms in Session 43, so the rest of the torches are props.
 */
const TORCH_LIGHT = { color: 0xffb347, intensity: 10, distance: 9, decay: 2 };
/** The cover pillars' rectangles hold these, in turn: a pillar, stacked crates, a big barrel. */
const PROPS: readonly KitPiece[] = ["pillar", "crates_stacked", "barrel_large"];

/** One wall rectangle as drawn: its meshes (which the camera's fade swaps), its rectangle and height. */
export interface DressedWall {
  meshes: THREE.Mesh[];
  rect: WallRect;
  h: number;
}

export interface Dressing {
  group: THREE.Group;
  walls: DressedWall[];
  /** The kit's material and its see-through twin for a wall between the eye and the player. */
  material: THREE.Material;
  faded: THREE.Material;
  /** Instances per piece, for the devlog and the e2e checks. */
  counts: Record<string, number>;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const sc = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** A placement: where, which way the piece's +x points (yaw), and its scale. */
type Place = { x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number };

function instanced(piece: KitPiece, places: Place[], material: THREE.Material): THREE.InstancedMesh {
  const { geometry } = kitPiece(piece);
  const mesh = new THREE.InstancedMesh(geometry, material, places.length);
  places.forEach((pl, i) => {
    q.setFromAxisAngle(UP, pl.yaw);
    m4.compose(p.set(pl.x, pl.y, pl.z), q, sc.set(pl.sx, pl.sy, pl.sz));
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Is the point on another rectangle or at the level's edge, so a wall ending there is joined, not open? */
function joined(x: number, z: number, self: WallRect, rects: readonly WallRect[], level: Level): boolean {
  if (Math.abs(x) >= level.halfW - 0.5 || Math.abs(z) >= level.halfD - 0.5) return true;
  return rects.some((r) => r !== self && Math.abs(x - r.x) <= r.hw + 0.3 && Math.abs(z - r.z) <= r.hd + 0.3);
}

/**
 * Tile one long rectangle with wall pieces: an end cap inside each open end, and wall pieces
 * stretched to fill the rest exactly.
 */
function tileWall(r: WallRect, rects: readonly WallRect[], level: Level, edge: boolean): { walls: Place[]; caps: Place[] } {
  const alongX = r.hw >= r.hd;
  const half = alongX ? r.hw : r.hd;
  const thick = (alongX ? r.hd : r.hw) * 2;
  // Local +x of a piece runs along the rectangle: +x for a wall along x, +z for one along z.
  const yaw = alongX ? 0 : -Math.PI / 2;
  const at = (s: number) => (alongX ? { x: r.x + s, z: r.z } : { x: r.x, z: r.z + s });
  const capM = ENDCAP_UNITS * KIT_M;
  const lo = at(-half);
  const hi = at(half);
  const openLo = !edge && !joined(lo.x, lo.z, r, rects, level) && half * 2 > capM * 3;
  const openHi = !edge && !joined(hi.x, hi.z, r, rects, level) && half * 2 > capM * 3;
  const sz = thick / 1;
  const caps: Place[] = [];
  // The cap reaches +x from its origin: at the high end it starts a cap's length in; at the low end it is turned round.
  if (openHi) caps.push({ ...at(half - capM), y: 0, yaw, sx: KIT_M, sy: KIT_M, sz });
  if (openLo) caps.push({ ...at(-half + capM), y: 0, yaw: yaw + Math.PI, sx: KIT_M, sy: KIT_M, sz });
  const from = -half + (openLo ? capM : 0);
  const to = half - (openHi ? capM : 0);
  const len = to - from;
  const n = Math.max(1, Math.round(len / (WALL_UNITS * KIT_M)));
  const seg = len / n;
  const walls: Place[] = [];
  for (let i = 0; i < n; i++) walls.push({ ...at(from + seg * (i + 0.5)), y: 0, yaw, sx: seg / WALL_UNITS, sy: KIT_M, sz });
  return { walls, caps };
}

/** Torches along both faces of a wall (only the inner face of the level's edge), facing out. */
function torchesFor(r: WallRect, edge: boolean, out: Place[]) {
  const alongX = r.hw >= r.hd;
  const half = alongX ? r.hw : r.hd;
  const n = Math.floor((half * 2) / TORCH_SPACING_M);
  if (n < 1) return;
  for (const side of [-1, 1]) {
    const nx = alongX ? 0 : side;
    const nz = alongX ? side : 0;
    // The edge's inner face is the one toward the middle of the level.
    if (edge && (nx * r.x > 0 || nz * r.z > 0)) continue;
    for (let i = 0; i < n; i++) {
      const s = -half + (half * 2 * (i + 0.5)) / n;
      out.push({
        x: r.x + (alongX ? s : 0) + nx * r.hw,
        y: TORCH_Y_M,
        z: r.z + (alongX ? 0 : s) + nz * r.hd,
        // The piece reaches +z from the wall: turn +z onto the face's outward normal.
        yaw: Math.atan2(nx, nz),
        sx: KIT_M,
        sy: KIT_M,
        sz: KIT_M
      });
    }
  }
}

/** Dress a dungeon level: a tiled floor, kit walls on every wall rectangle and the level's edge, props on the pillars, torches. */
export function dressDungeon(level: Level): Dressing {
  const group = new THREE.Group();
  const { material } = kitPiece("wall");
  const faded = material.clone();
  faded.transparent = true;
  faded.opacity = 0.28;
  faded.depthWrite = false;
  const counts: Record<string, number> = {};
  const count = (k: string, n: number) => (counts[k] = (counts[k] ?? 0) + n);

  // The floor: large tiles over the whole level, their tops at the ground.
  const tile = 4 * KIT_M;
  const nx = Math.ceil((level.halfW * 2) / tile);
  const nz = Math.ceil((level.halfD * 2) / tile);
  const floor: Place[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) floor.push({ x: -((nx - 1) * tile) / 2 + i * tile, y: -0.05 * KIT_M, z: -((nz - 1) * tile) / 2 + j * tile, yaw: 0, sx: KIT_M, sy: KIT_M, sz: KIT_M });
  const floorMesh = instanced("floor_tile_large", floor, material);
  floorMesh.castShadow = false;
  group.add(floorMesh);
  count("floor_tile_large", floor.length);

  // The level's edge is a collider too: walls just outside its bounds.
  const t = KIT_M / 2;
  const edges: WallRect[] = [
    { x: 0, z: level.halfD + t, hw: level.halfW + KIT_M, hd: t },
    { x: 0, z: -level.halfD - t, hw: level.halfW + KIT_M, hd: t },
    { x: level.halfW + t, z: 0, hw: t, hd: level.halfD },
    { x: -level.halfW - t, z: 0, hw: t, hd: level.halfD }
  ];
  const walls: DressedWall[] = [];
  const torches: Place[] = [];
  const longRects = level.walls.filter((w) => !(w.hw < 1 && w.hd < 1));
  for (const [r, edge] of [...longRects.map((w) => [w, false] as const), ...edges.map((w) => [w, true] as const)]) {
    const { walls: segs, caps } = tileWall(r, longRects, level, edge);
    const meshes: THREE.Mesh[] = [instanced("wall", segs, material)];
    count("wall", segs.length);
    if (caps.length) {
      meshes.push(instanced("wall_endcap", caps, material));
      count("wall_endcap", caps.length);
    }
    for (const m of meshes) group.add(m);
    walls.push({ meshes, rect: r, h: KIT_WALL_H });
    torchesFor(r, edge, torches);
  }

  // The cover pillars: a kit prop sized to sit inside each one's rectangle. One of each, so a
  // plain mesh apiece, which the camera's fade can swap on its own.
  level.walls
    .filter((w) => w.hw < 1 && w.hd < 1)
    .forEach((w, i) => {
      const k = PROPS[i % PROPS.length];
      const { geometry } = kitPiece(k);
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox!;
      const s = Math.min(KIT_M, (w.hw * 2) / (bb.max.x - bb.min.x), (w.hd * 2) / (bb.max.z - bb.min.z));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(s);
      mesh.position.set(w.x - ((bb.max.x + bb.min.x) / 2) * s, 0, w.z - ((bb.max.z + bb.min.z) / 2) * s);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      walls.push({ meshes: [mesh], rect: w, h: bb.max.y * s });
      count(k, 1);
    });

  if (torches.length) {
    group.add(instanced("torch_mounted", torches, material));
    count("torch_mounted", torches.length);
    const anchors = [...(level.rooms ?? []).map((r) => ({ x: r.x, z: r.z })), { x: 0, z: 0 }];
    const lit = new Set<number>();
    for (const a of anchors) {
      let best = -1;
      let bestD = Infinity;
      torches.forEach((tp, i) => {
        const d = Math.hypot(tp.x - a.x, tp.z - a.z);
        if (d < bestD && !lit.has(i)) {
          best = i;
          bestD = d;
        }
      });
      if (best < 0) continue;
      lit.add(best);
      const tp = torches[best];
      const light = new THREE.PointLight(TORCH_LIGHT.color, TORCH_LIGHT.intensity, TORCH_LIGHT.distance, TORCH_LIGHT.decay);
      light.position.set(tp.x + Math.sin(tp.yaw) * 0.6, tp.y + 0.5, tp.z + Math.cos(tp.yaw) * 0.6);
      group.add(light);
      count("torchLights", 1);
    }
  }
  return { group, walls, material, faded, counts };
}
