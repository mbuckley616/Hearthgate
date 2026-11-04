import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { roleOf } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const e = createEnemy(s, world, 'knight', 0, EDGE - 10, 0);
  Object.assign(e, { x: 0, z: EDGE - 10, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, e };
}

const hit = (p: PlayerState, from: { x: number; z: number }, extra: Partial<HitSpec> = {}): HitSpec => {
  const len = Math.hypot(from.x, from.z);
  return { attackerId: p.id, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: -from.x / len, dirZ: -from.z / len, x: 0, y: 1, z: 0, style: 'sword', ...extra };
};

describe('the Barrow Knight (E1f)', () => {
  it('is the elite role, with a brain', () => {
    expect(roleOf('knight')).toBe('elite');
    expect(brainFor('knight')).toBeDefined();
  });

  it('during its rush it can only be hurt from the side or behind: a heavy and magic from the front are blocked', () => {
    const { s, p, e } = scene();
    for (let i = 0; i < 200 && e.ai !== 'charge'; i++) {
      Object.assign(p, { x: 0, z: EDGE - 3 });
      stepEnemies(s, DT, world);
    }
    expect(e.ai).toBe('charge');
    const full = e.hp;
    p.attackCharge = 1;
    damageEnemy(s, e, hit(p, { x: 0, z: 2 }, { heavy: true }));
    damageEnemy(s, e, hit(p, { x: 0, z: 2 }, { style: 'staff', projectile: true }));
    expect(e.hp).toBe(full);
    damageEnemy(s, e, hit(p, { x: 2, z: 0 }));
    expect(e.hp).toBe(full - 10);
    damageEnemy(s, e, hit(p, { x: 0, z: -2 }));
    expect(e.hp).toBe(full - 20);
  });

  it('a wall stuns it as a Hound', () => {
    const { s, p, e } = scene();
    let stunned = false;
    for (let i = 0; i < 300 && !stunned; i++) {
      const locked = e.ai === 'charge' || (e.ai === 'chargeWindup' && e.aiTime >= (tuning.knight.chargeTelegraphMs / 1000) * tuning.knight.trackFrac);
      Object.assign(p, { x: locked ? 3 : 0, z: EDGE - 3 });
      stepEnemies(s, DT, world);
      if (e.ai === 'stagger') stunned = true;
    }
    expect(stunned).toBe(true);
    expect(p.hp).toBe(p.maxHp);
    let ticks = 0;
    while (e.ai === 'stagger' && ticks < 600) {
      stepEnemies(s, DT, world);
      ticks++;
    }
    expect(ticks * DT).toBeCloseTo(tuning.knight.wallStunMs / 1000, 1);
  });

  it('close in, it fights as a Shieldbearer: blocks a light from the front, breaks to a held heavy, bashes', () => {
    const { s, p, e } = scene();
    Object.assign(p, { x: 0, z: EDGE - 8.5 });
    const full = e.hp;
    damageEnemy(s, e, hit(p, { x: 0, z: 2 }));
    expect(e.hp).toBe(full);
    damageEnemy(s, e, hit(p, { x: 0, z: 2 }, { style: 'staff', projectile: true }));
    expect(e.hp).toBe(full - 10);
    let bashed = false;
    for (let i = 0; i < 200 && !bashed; i++) {
      Object.assign(p, { x: 0, z: EDGE - 8.5 });
      stepEnemies(s, DT, world);
      if (p.hp < p.maxHp) bashed = true;
    }
    expect(bashed).toBe(true);
    expect(p.hp).toBe(p.maxHp - tuning.knight.bashDamage);
  });
});
