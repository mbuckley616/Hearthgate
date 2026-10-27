/**
 * Static collision geometry and queries. Plain data and math only (no Three.js),
 * so the sim, the camera and any future server can share it.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoxCollider {
  kind: 'box';
  id: string;
  min: Vec3;
  max: Vec3;
  blocksMovement: boolean;
  blocksCamera: boolean;
  /** Fades out when it hides the hero instead of blocking the camera. */
  fadeable: boolean;
}

/** Vertical cylinder (pillars). */
export interface CylinderCollider {
  kind: 'cylinder';
  id: string;
  x: number;
  z: number;
  radius: number;
  yMin: number;
  yMax: number;
  blocksMovement: boolean;
  blocksCamera: boolean;
  fadeable: boolean;
}

export type Collider = BoxCollider | CylinderCollider;

/**
 * Ray against an AABB grown by `r` (slab test). Returns entry distance, 0 if the
 * origin starts inside, or Infinity on a miss. Growing the box is a slightly
 * conservative stand-in for a true rounded-box sphere cast; fine for a camera.
 */
function rayBox(o: Vec3, d: Vec3, b: BoxCollider, r: number): number {
  let tMin = -Infinity;
  let tMax = Infinity;
  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
  for (const a of axes) {
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

/** Ray against a vertical cylinder grown by `r`, including its top and bottom caps. */
function rayCylinder(o: Vec3, d: Vec3, c: CylinderCollider, r: number): number {
  const R = c.radius + r;
  const yLo = c.yMin - r;
  const yHi = c.yMax + r;
  const ox = o.x - c.x;
  const oz = o.z - c.z;
  const inside2D = ox * ox + oz * oz <= R * R;
  if (inside2D && o.y >= yLo && o.y <= yHi) return 0;

  let best = Infinity;
  // Side wall.
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-12) {
    const b = 2 * (ox * d.x + oz * d.z);
    const cc = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * a * cc;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const y = o.y + d.y * t;
        if (y >= yLo && y <= yHi) best = t;
      }
    }
  }
  // Caps.
  if (Math.abs(d.y) > 1e-9) {
    for (const yc of [yLo, yHi]) {
      const t = (yc - o.y) / d.y;
      if (t >= 0 && t < best) {
        const px = ox + d.x * t;
        const pz = oz + d.z * t;
        if (px * px + pz * pz <= R * R) best = t;
      }
    }
  }
  return best;
}

/**
 * Sphere cast from `origin` along unit `dir`. Returns the distance the sphere
 * can travel before touching a collider accepted by `filter`, capped at maxDist.
 */
export function sphereCast(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  radius: number,
  colliders: readonly Collider[],
  filter: (c: Collider) => boolean,
  /** Skip colliders the sphere already overlaps at the origin (used for look-ahead probes). */
  ignoreStartOverlap = false,
): number {
  let best = maxDist;
  for (const c of colliders) {
    if (!filter(c)) continue;
    const t = c.kind === 'box' ? rayBox(origin, dir, c, radius) : rayCylinder(origin, dir, c, radius);
    if (t === 0 && ignoreStartOverlap) continue;
    if (t < best) best = t;
  }
  return best;
}

/** Does the segment a→b, thickened by `radius`, touch the collider? */
export function segmentTouches(a: Vec3, b: Vec3, radius: number, c: Collider): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return false;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  const t = c.kind === 'box' ? rayBox(a, dir, c, radius) : rayCylinder(a, dir, c, radius);
  return t <= len;
}

/**
 * Push a circle (character footprint, XZ plane) out of every movement-blocking
 * collider overlapping its height range. Mutates and returns pos.
 */
export function resolveCircle(
  pos: { x: number; z: number },
  radius: number,
  yMin: number,
  yMax: number,
  colliders: readonly Collider[],
): { x: number; z: number } {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (!c.blocksMovement) continue;
      if (c.kind === 'box') {
        if (c.max.y <= yMin || c.min.y >= yMax) continue;
        const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        const nx = pos.x - cx;
        const nz = pos.z - cz;
        const d2 = nx * nx + nz * nz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          pos.x = cx + (nx / d) * radius;
          pos.z = cz + (nz / d) * radius;
        } else {
          // Centre inside the box: push out along the shallowest axis.
          const pushes = [
            { x: c.min.x - radius - pos.x, z: 0 },
            { x: c.max.x + radius - pos.x, z: 0 },
            { x: 0, z: c.min.z - radius - pos.z },
            { x: 0, z: c.max.z + radius - pos.z },
          ].sort((p, q) => Math.abs(p.x + p.z) - Math.abs(q.x + q.z));
          pos.x += pushes[0].x;
          pos.z += pushes[0].z;
        }
        moved = true;
      } else {
        if (c.yMax <= yMin || c.yMin >= yMax) continue;
        const nx = pos.x - c.x;
        const nz = pos.z - c.z;
        const minD = c.radius + radius;
        const d2 = nx * nx + nz * nz;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2) || 1e-6;
        pos.x = c.x + (nx / d) * minD;
        pos.z = c.z + (nz / d) * minD;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return pos;
}
