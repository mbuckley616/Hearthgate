import { enemyStats, tuning, type ComboHit } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { comboWindow, damageEnemy, isTargetable, type HitSpec } from './combat';
import { hasRune } from './runes';
import type { PlayerState, SimState } from './types';

/**
 * Rune of the Whip (the builds pass, Michael's A, 11 Nov): every heavy from a sword-style weapon with
 * the rune set lashes a fire whip straight ahead as its hit opens, a line `runes.whipRangeM` long and
 * `runes.whipWidthM` wide that stops at the first wall. Each enemy in it past the swing's own reach
 * takes `runes.whipDamage` of the heavy's hit, as sword damage; with the element states on it is left
 * Burning, ready for a Detonate, since a whip of fire is Fire whatever the hero's element.
 */
export function runeWhip(state: SimState, p: PlayerState, hit: ComboHit, colliders: readonly Collider[]): void {
  if (p.style !== 'sword' || p.attackCharge === undefined || !hasRune(p.mods, 'whip')) return;
  const r = tuning.runes;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const origin = { x: p.x, y: p.y + 1, z: p.z };
  const length = sphereCast(origin, { x: fx, y: 0, z: fz }, r.whipRangeM, 0.15, colliders, (c) => c.blocksMovement);
  state.events.push({ kind: 'whip', playerId: p.id, x: p.x, z: p.z, yaw: p.yaw, length });
  for (const e of state.enemies) {
    if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
    const er = enemyStats(e.kind).radius;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const along = dx * fx + dz * fz;
    const across = Math.abs(dx * fz - dz * fx);
    // Ahead of the swing's reach (the swing has the near ones) and inside the whip's line.
    if (along - er > length || along + er <= hit.range || across > r.whipWidthM / 2 + er) continue;
    const spec: HitSpec = {
      attackerId: p.id,
      damage: hit.damage * r.whipDamage,
      poise: hit.poise * r.whipDamage,
      knockback: 0,
      heavy: false,
      dirX: fx,
      dirZ: fz,
      style: 'sword',
      x: e.x - fx * er,
      y: e.y + Math.min(1.2, enemyStats(e.kind).height * 0.55),
      z: e.z - fz * er,
    };
    damageEnemy(state, e, spec);
    if (tuning.combos.elementStates && isTargetable(e)) e.detonateUntil = state.time + comboWindow(p);
  }
}
