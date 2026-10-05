/**
 * Levels: the walls a room is made of and where its enemies start. Pure data plus the
 * one collision routine both sides run, so a client predicting its own movement slides
 * along a wall exactly where the server will put it.
 *
 * A wall is an axis-aligned box on the ground plane: a centre and half extents. Height is
 * presentation. Rooms, doors and stairs (the Goblin Warrens floor) are assembled from these
 * by the floor item; this module only knows rectangles.
 */
import type { EnemyKind } from "./sim";

export interface WallRect {
  x: number;
  z: number;
  /** Half width (along x) and half depth (along z), metres. */
  hw: number;
  hd: number;
}

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  z: number;
  facing: number;
}

export interface Level {
  id: string;
  name: string;
  /** Half extents of the playable ground, centred on the origin. */
  halfW: number;
  halfD: number;
  walls: readonly WallRect[];
  enemies: readonly EnemySpawn[];
}

/**
 * Keep a circle inside the level's bounds and out of its walls. Mutates `o`. Two passes
 * over the walls so a circle pushed out of one wall into a neighbour settles in the corner
 * instead of ending a tick inside either.
 */
export function collideWalls(o: { x: number; z: number }, radius: number, level: Level): void {
  const lx = level.halfW - radius;
  const lz = level.halfD - radius;
  if (o.x < -lx) o.x = -lx;
  if (o.x > lx) o.x = lx;
  if (o.z < -lz) o.z = -lz;
  if (o.z > lz) o.z = lz;
  for (let pass = 0; pass < 2; pass++) {
    for (const w of level.walls) pushOut(o, radius, w);
  }
}

function pushOut(o: { x: number; z: number }, r: number, w: WallRect): void {
  const nx = Math.max(w.x - w.hw, Math.min(w.x + w.hw, o.x));
  const nz = Math.max(w.z - w.hd, Math.min(w.z + w.hd, o.z));
  const dx = o.x - nx;
  const dz = o.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-12) {
    // Outside the box but overlapping it: back off along the line to the nearest point.
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    o.x += dx * k;
    o.z += dz * k;
    return;
  }
  // The centre is inside the box (a fast move landed in it): leave by the nearest face.
  // Walls are at least 0.4 m deep so one tick of dodging never crosses the middle.
  const left = o.x - (w.x - w.hw);
  const right = w.x + w.hw - o.x;
  const back = o.z - (w.z - w.hd);
  const front = w.z + w.hd - o.z;
  const m = Math.min(left, right, back, front);
  if (m === left) o.x = w.x - w.hw - r;
  else if (m === right) o.x = w.x + w.hw + r;
  else if (m === back) o.z = w.z - w.hd - r;
  else o.z = w.z + w.hd + r;
}

/** True when the segment from a to b crosses no wall (the bounds are not checked). */
export function lineClear(a: { x: number; z: number }, b: { x: number; z: number }, level: Level): boolean {
  for (const w of level.walls) {
    if (segmentHitsRect(a, b, w)) return false;
  }
  return true;
}

function segmentHitsRect(a: { x: number; z: number }, b: { x: number; z: number }, w: WallRect): boolean {
  // Slab test: clip the segment's parameter range against each axis of the box.
  let t0 = 0;
  let t1 = 1;
  const axes: [number, number, number, number][] = [
    [a.x, b.x - a.x, w.x - w.hw, w.x + w.hw],
    [a.z, b.z - a.z, w.z - w.hd, w.z + w.hd]
  ];
  for (const [p, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) {
      const t = ta;
      ta = tb;
      tb = t;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export const ARENA_HALF = 20; // the yard is 40 x 40 m

/** The Phase 0 arena: four edges, no walls, one goblin. The unit tests assume it. */
export const OPEN_FIELD: Level = {
  id: "field",
  name: "Open field",
  halfW: ARENA_HALF,
  halfD: ARENA_HALF,
  walls: [],
  enemies: [{ kind: "goblin", x: 9, z: -9, facing: Math.PI }]
};

/**
 * The goblin yard: the arena with a few ruined walls and four goblins spread so a lone
 * player meets one or two at a time and a party can split them. The stand-in for a
 * Warrens floor until rooms exist. Player spawns (sim.ts SPAWN_POINTS) sit inside
 * x, z in -6..6; every wall keeps 1.5 m clear of them.
 */
export const YARD: Level = {
  id: "yard",
  name: "The goblin yard",
  halfW: ARENA_HALF,
  halfD: ARENA_HALF,
  walls: [
    { x: -12, z: 0, hw: 4, hd: 0.4 }, // a long low wall to the west
    { x: 6, z: 6, hw: 0.4, hd: 4 }, // a wall running north on the east side
    { x: 12, z: -3, hw: 3, hd: 0.4 }, // a stub between the first goblin and the middle
    { x: 0, z: -10, hw: 0.6, hd: 0.6 }, // pillars
    { x: -8, z: 9, hw: 0.6, hd: 0.6 }
  ],
  enemies: [
    { kind: "goblin", x: 9, z: -9, facing: Math.PI },
    { kind: "goblin", x: 12, z: 8, facing: Math.PI },
    { kind: "goblin", x: -12, z: -10, facing: 0 },
    { kind: "goblin", x: -10, z: 12, facing: 0 }
  ]
};

export const LEVELS: Record<string, Level> = { field: OPEN_FIELD, yard: YARD };

/** The level a dungeon room runs until floors exist. */
export const DEFAULT_LEVEL_ID = "yard";

export function levelById(id: string): Level {
  return LEVELS[id] ?? OPEN_FIELD;
}
