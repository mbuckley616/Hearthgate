import type { Vec3 } from "./camera";

/**
 * The combat slice's sphere cast, for the camera (`client/src/orbit.ts`). Plain maths, no
 * Three.js, so it is unit tested here. The sim's own collision stays `collideWalls`; this is what
 * the eye uses, and a level's walls and roofs become boxes for it (`wallBox`). The slice also had
 * upright cylinders for its pillars; Hearthgate's pillars are boxes, so they stayed behind.
 */

export interface BoxCollider {
  min: Vec3;
  max: Vec3;
}

/** A box from a level's wall rectangle, standing from `y0` to `y1`. */
export function wallBox(rect: { x: number; z: number; hw: number; hd: number }, y0: number, y1: number): BoxCollider {
  return { min: { x: rect.x - rect.hw, y: y0, z: rect.z - rect.hd }, max: { x: rect.x + rect.hw, y: y1, z: rect.z + rect.hd } };
}

/** The ground as a slab under y = 0, so the eye never dips below the floor when it looks up. */
export const GROUND_BOX: BoxCollider = { min: { x: -1e4, y: -50, z: -1e4 }, max: { x: 1e4, y: 0, z: 1e4 } };

const AXES = ["x", "y", "z"] as const;

/**
 * Ray against a box grown by `r` (slab test). Returns the entry distance, 0 if the origin starts
 * inside, or Infinity on a miss. Growing the box is a slightly conservative stand-in for a true
 * rounded-box sphere cast; fine for a camera.
 */
function rayBox(o: Vec3, d: Vec3, b: BoxCollider, r: number): number {
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const a of AXES) {
    const lo = b.min[a] - r;
    const hi = b.max[a] + r;
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo || o[a] > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o[a]) / d[a];
    let t2 = (hi - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (tMax < 0) return Infinity;
  return Math.max(0, tMin);
}

/**
 * Sphere cast from `origin` along unit `dir`: how far a sphere of `radius` travels before it
 * touches a box, capped at `maxDist`. `ignoreStartOverlap` skips boxes the sphere already overlaps
 * at the origin (the camera's wider look-ahead probe, which would otherwise stop at once beside a wall).
 */
export function sphereCast(origin: Vec3, dir: Vec3, maxDist: number, radius: number, boxes: readonly BoxCollider[], ignoreStartOverlap = false): number {
  let best = maxDist;
  for (const b of boxes) {
    const t = rayBox(origin, dir, b, radius);
    if (t === 0 && ignoreStartOverlap) continue;
    if (t < best) best = t;
  }
  return best;
}
