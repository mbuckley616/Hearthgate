import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { dressing, roleOf, telegraphColour } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** A Shieldbearer at the origin facing +z, and a hero two metres in front of it. */
function scene(): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: 2, invulnerable: false, invulnTime: 0 });
  const e = createEnemy(s, world, 'shieldbearer', 0, 0, 0);
  Object.assign(e, { x: 0, z: 0, yaw: 0, ai: 'chase', aiTime: 0 });
  return { s, p, e };
}

/** A sword hit on it from the side `from` is on, pushing through it. */
function swing(p: PlayerState, e: EnemyState, from: { x: number; z: number }, extra: Partial<HitSpec> = {}): HitSpec {
  const len = Math.hypot(from.x, from.z);
  return { attackerId: p.id, damage: 10, poise: 1, knockback: 0, heavy: false, dirX: -from.x / len, dirZ: -from.z / len, x: e.x, y: 1, z: e.z, style: 'sword', ...extra };
}

describe('the Skeleton Shieldbearer (E1b)', () => {
  it('is the Crypt\'s shield role, with a brain, telling in red', () => {
    expect(roleOf('shieldbearer')).toBe('shield');
    expect(brainFor('shieldbearer')).toBeDefined();
    expect(dressing('shieldbearer').name).toBe('Skeleton Shieldbearer');
    expect(telegraphColour({ kind: 'shieldbearer', attack: 'bash' })).toBe('strike');
  });

  it('a sword\'s light chain from the front is blocked; the same from the side lands', () => {
    const { s, p, e } = scene();
    const full = e.hp;
    for (let i = 0; i < 3; i++) damageEnemy(s, e, swing(p, e, { x: 0, z: 2 }, { heavy: i === 2 }));
    expect(e.hp).toBe(full);
    expect(s.events.filter((ev) => ev.kind === 'guarded')).toHaveLength(3);
    damageEnemy(s, e, swing(p, e, { x: 2, z: 0 }));
    expect(e.hp).toBe(full - 10);
    damageEnemy(s, e, swing(p, e, { x: 0, z: -2 }));
    expect(e.hp).toBe(full - 20);
  });

  it('an arrow from the front is blocked; magic goes through the shield', () => {
    const { s, p, e } = scene();
    const full = e.hp;
    damageEnemy(s, e, swing(p, e, { x: 0, z: 5 }, { style: 'bow', projectile: true }));
    expect(e.hp).toBe(full);
    damageEnemy(s, e, swing(p, e, { x: 0, z: 5 }, { style: 'staff', projectile: true }));
    expect(e.hp).toBe(full - 10);
  });

  it('a held heavy breaks the guard and lands, and the guard stays down for guardBreakMs', () => {
    const { s, p, e } = scene();
    const full = e.hp;
    p.attackCharge = 1;
    damageEnemy(s, e, swing(p, e, { x: 0, z: 2 }, { heavy: true }));
    expect(e.hp).toBe(full - 10);
    expect(s.events.some((ev) => ev.kind === 'guardBroken')).toBe(true);
    p.attackCharge = undefined;
    // Back on its feet from whatever the heavy did, the front is still open until the break runs out.
    e.ai = 'chase';
    damageEnemy(s, e, swing(p, e, { x: 0, z: 2 }));
    expect(e.hp).toBe(full - 20);
    s.time += tuning.shieldbearer.guardBreakMs / 1000 + 0.1;
    e.ai = 'chase';
    e.frozen = 0;
    damageEnemy(s, e, swing(p, e, { x: 0, z: 2 }));
    expect(e.hp).toBe(full - 20);
  });

  it('winds up a red line and bashes it: a heavy that staggers the hero standing in it', () => {
    const { s, p, e } = scene();
    p.lagGrace = 0;
    e.cooldown = 0;
    let telegraphed = false;
    for (let i = 0; i < 120 && p.hp === p.maxHp; i++) {
      Object.assign(p, { x: 0, z: 1.6 });
      stepEnemies(s, DT, world);
      if (e.ai === 'windup' && e.tele.shape === 'line') telegraphed = true;
    }
    expect(telegraphed).toBe(true);
    expect(p.hp).toBe(p.maxHp - tuning.shieldbearer.bashDamage);
    expect(p.mode).toBe('hurt');
  });

  it('turns slowly, so a hero circling it reaches its side', () => {
    expect(tuning.shieldbearer.turnRateDeg).toBeLessThan(tuning.grunt.turnRateDeg / 2);
  });
});
