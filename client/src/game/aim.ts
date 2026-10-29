import * as THREE from 'three';
import { enemyStats, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { isTargetable } from '@hearthgate/shared/sim/combat';
import { sphereCast, type Collider } from '@hearthgate/shared/level/geometry';
import type { PlayerState, SimState } from '@hearthgate/shared/sim/types';

/** Where a shot leaves the hero, over its feet (projectiles.ts's ARROW_ORIGIN and BOLT_ORIGIN). */
const SHOT_HEIGHT: Record<Style, number> = { sword: 1.1, bow: 1.45, staff: 1.5 };

/** What the screen's centre points at (D12), and the command's aim toward it from the hand. */
export interface FreeAim {
  aimX: number;
  aimZ: number;
  aimPitch: number;
  /** The ray met an enemy before anything else: the reticle reddens. */
  onEnemy: boolean;
}

const ray = new THREE.Vector3();

/**
 * Free aim over the shoulder (D12): cast from the camera through the screen's centre against the
 * walls, the floor and the enemies' bodies, then aim from the hand at whatever it met (or a point
 * camera.aimRange away), so the shot lands under the reticle although it leaves from beside it.
 * Hits nearer the camera than the hero are ignored: nothing behind the hero is a target.
 */
export function freeAimFrom(camera: THREE.Camera, hero: PlayerState, world: SimState, colliders: readonly Collider[]): FreeAim {
  const from = camera.position;
  camera.getWorldDirection(ray);
  const near = Math.hypot(hero.x - from.x, hero.y + SHOT_HEIGHT[hero.style] - from.y, hero.z - from.z);
  let best = tuning.camera.aimRange;
  let onEnemy = false;
  const wall = sphereCast(from, ray, best, 0.05, colliders, () => true, true);
  if (wall > near) best = wall;
  // The floor the hero stands on.
  if (ray.y < -1e-3) {
    const t = (hero.y - from.y) / ray.y;
    if (t > near && t < best) best = t;
  }
  for (const e of world.enemies) {
    if (!isTargetable(e)) continue;
    const s = enemyStats(e.kind);
    const cx = e.x - from.x;
    const cy = e.y + s.height * 0.55 - from.y;
    const cz = e.z - from.z;
    const along = cx * ray.x + cy * ray.y + cz * ray.z;
    if (along < near || along > best) continue;
    const r = Math.max(s.radius, s.height * 0.35);
    const miss = cx * cx + cy * cy + cz * cz - along * along;
    if (miss > r * r) continue;
    best = along - Math.sqrt(r * r - miss);
    onEnemy = true;
  }
  const px = from.x + ray.x * best - hero.x;
  const py = from.y + ray.y * best - (hero.y + SHOT_HEIGHT[hero.style]);
  const pz = from.z + ray.z * best - hero.z;
  const flat = Math.hypot(px, pz);
  // Aiming at something right beside the hand would turn the shot sideways: keep the camera's heading.
  if (flat < 1.5) {
    const f = Math.hypot(ray.x, ray.z) || 1;
    return { aimX: ray.x / f, aimZ: ray.z / f, aimPitch: Math.atan2(ray.y, f), onEnemy };
  }
  return { aimX: px / flat, aimZ: pz / flat, aimPitch: Math.atan2(py, flat), onEnemy };
}
