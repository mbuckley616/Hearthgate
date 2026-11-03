import { afterEach, describe, expect, it } from 'vitest';
import { enemyStats, tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.combat.postStaggerArmour;
afterEach(() => {
  tuning.combat.postStaggerArmour = kept;
});

function scene(kind: EnemyKind): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: -10, z: 3 });
  const e = createEnemy(s, world, kind, -8, 3, 0);
  Object.assign(e, { x: -8, z: 3, ai: 'chase', aiTime: 0, hp: 10_000 });
  return { s, p, e };
}

const blow = (p: PlayerState, e: EnemyState): HitSpec => ({ attackerId: p.id, damage: 10, poise: 100, knockback: 0.5, heavy: true, dirX: 1, dirZ: 0, x: e.x, y: e.y + 1, z: e.z, style: 'sword' });

/** Break its poise, then let the stagger run out. */
function breakAndRise(s: SimState, p: PlayerState, e: EnemyState): void {
  damageEnemy(s, e, blow(p, e));
  expect(e.ai).toBe('stagger');
  for (let i = 0; i < Math.ceil((tuning.combat.staggerMs / 1000) / DT) + 30 && e.ai === 'stagger'; i++) stepEnemies(s, DT, world);
  expect(e.ai).not.toBe('stagger');
}

describe('armour after a stagger (G1; Michael, 2 Nov)', () => {
  it.each(['brute', 'warden'] as const)('a %s gets up armoured: hits hurt it but neither break its poise nor push it, until the armour runs out', (kind) => {
    const { s, p, e } = scene(kind);
    breakAndRise(s, p, e);
    expect(e.armour).toBeGreaterThan(3.5);
    const hp = e.hp;
    const poise = e.poise;
    for (let i = 0; i < 5; i++) damageEnemy(s, e, blow(p, e));
    expect(e.hp).toBeLessThan(hp);
    expect(e.poise).toBe(poise);
    expect(e.ai).not.toBe('stagger');
    expect(Math.hypot(e.kbx, e.kbz)).toBeLessThan(0.01);
    for (let i = 0; i < Math.ceil(tuning.combat.postStaggerArmourMs / 1000 / DT) + 30; i++) stepEnemies(s, DT, world);
    expect(e.armour).toBeUndefined();
    e.hitstop = 0;
    damageEnemy(s, e, blow(p, e));
    expect(e.ai).toBe('stagger');
  });

  it('a grunt gets up as before, and a switched-off Brute too (the slice)', () => {
    const g = scene('grunt');
    g.e.poise = 0.1;
    breakAndRise(g.s, g.p, g.e);
    expect(g.e.armour).toBeUndefined();
    tuning.combat.postStaggerArmour = false;
    const b = scene('brute');
    breakAndRise(b.s, b.p, b.e);
    expect(b.e.armour).toBeUndefined();
    expect(enemyStats('brute').maxPoise).toBeGreaterThan(0);
  });
});
