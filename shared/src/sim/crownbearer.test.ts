import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { damageEnemy } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, crownbearerChanting, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { ADD_WEAKNESS, roleOf, weakTo } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// K1, part two (docs/bosses.md 2.4): the Hollow King's phase 2 raises a Crownbearer, a warded caster,
// and while it channels his thrown crown comes back to his hand ready to throw again at once.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { rules: tuning.king.underRules, channel: tuning.crownbearer.channelMs, weak: tuning.bosses.addWeakness };
afterEach(() => {
  tuning.king.underRules = kept.rules;
  tuning.crownbearer.channelMs = kept.channel;
  tuning.bosses.addWeakness = kept.weak;
});

function scene(heroZ: number): { s: SimState; p: PlayerState; k: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: heroZ, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1e4, maxHp: 1e4 });
  const k = createEnemy(s, world, 'king', 0, 2, 0);
  Object.assign(k, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, k };
}

function stepUntil(s: SimState, done: () => boolean, max = 900): number {
  let i = 0;
  for (; i < max && !done(); i++) stepEnemies(s, DT, world);
  return i;
}

/** A Crownbearer channelling far off, out of the fight's way. */
function bearer(s: SimState): EnemyState {
  const c = createEnemy(s, world, 'crownbearer', -12, -12, 0);
  Object.assign(c, { ai: 'chant', aiTime: 0, tele: { shape: 'circle', x: c.x, z: c.z, radius: 1, yaw: 0, arcDeg: 360 } });
  return c;
}

/** Ticks from the King's crown coming home to his next crown wind-up. */
function rethrowTicks(s: SimState, k: EnemyState): number {
  stepUntil(s, () => k.ai === 'charge');
  stepUntil(s, () => k.ai !== 'charge');
  expect(k.ai).toBe('recover');
  return stepUntil(s, () => k.ai === 'chargeWindup');
}

describe('the Crownbearer (K1)', () => {
  it('is a warded caster: the archer’s job', () => {
    expect(roleOf('crownbearer')).toBe('caster');
    expect(ADD_WEAKNESS.crownbearer).toBe('warded');
    expect(weakTo('crownbearer')).toBe('bow');
  });

  it("rises with the Knights at the King's 60% roar, and not with the rules off", () => {
    for (const on of [true, false]) {
      tuning.king.underRules = on;
      const { s, k } = scene(12);
      k.hp = k.maxHp * 0.59;
      stepEnemies(s, DT, world);
      stepUntil(s, () => k.ai !== 'roar');
      expect(s.enemies.filter((e) => e.kind === 'knight')).toHaveLength(2);
      expect(s.enemies.filter((e) => e.kind === 'crownbearer')).toHaveLength(on ? 1 : 0);
    }
  });

  it('channels a violet circle at its feet while its King stands, and an arrow breaks it', () => {
    tuning.bosses.addWeakness = true;
    const { s } = scene(12);
    const c = createEnemy(s, world, 'crownbearer', -8, -8, 0);
    Object.assign(c, { ai: 'chase', aiTime: 0, cooldown: 0 });
    stepUntil(s, () => c.ai === 'chant', 120);
    expect(c.ai).toBe('chant');
    expect(c.tele.shape).toBe('circle');
    expect(crownbearerChanting(s)).toBe(true);
    // A spell is turned aside and the channel goes on; an arrow breaks it.
    damageEnemy(s, c, { attackerId: 'p1', damage: 5, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: c.x, y: 1, z: c.z, style: 'staff' });
    expect(c.ai).toBe('chant');
    damageEnemy(s, c, { attackerId: 'p1', damage: 5, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: c.x, y: 1, z: c.z, style: 'bow', projectile: true });
    expect(c.ai).toBe('recover');
    expect(crownbearerChanting(s)).toBe(false);
  });

  it("while it channels, the King's crown comes home ready to throw at once", () => {
    tuning.crownbearer.channelMs = 60000;
    const plain = scene(12);
    const slow = rethrowTicks(plain.s, plain.k);
    const fast = scene(12);
    bearer(fast.s);
    const quick = rethrowTicks(fast.s, fast.k);
    expect(slow).toBeGreaterThanOrEqual(Math.floor((tuning.king.crownRecoveryMs / 1000) * 60));
    expect(quick).toBeLessThan(5);
    // With the rules off it is a crown like any other.
    tuning.king.underRules = false;
    const off = scene(12);
    bearer(off.s);
    expect(rethrowTicks(off.s, off.k)).toBe(slow);
  });
});
