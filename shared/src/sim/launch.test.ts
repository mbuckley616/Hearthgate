import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
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
const kept = { ...tuning.launch };
afterEach(() => {
  Object.assign(tuning.launch, kept);
});

/** A hero in the open west of the middle, a grunt to kill east of them and one more 3 m past it. */
function scene(): { s: SimState; p: PlayerState; victim: EnemyState; next: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: -10, z: 3 });
  const victim = createEnemy(s, world, 'grunt', -8.5, 3, 0);
  const next = createEnemy(s, world, 'grunt', -5.5, 3, 0);
  for (const e of [victim, next]) Object.assign(e, { ai: 'chase', aiTime: 0 });
  victim.hp = 1;
  return { s, p, victim, next };
}

const blow = (p: PlayerState, e: EnemyState, heavy: boolean, damage = 30): HitSpec => ({
  attackerId: p.id,
  damage,
  poise: 0,
  knockback: 0.5,
  heavy,
  dirX: 1,
  dirZ: 0,
  x: e.x,
  y: e.y + 1,
  z: e.z,
  style: 'sword',
});

function fly(s: SimState, ticks = 60): void {
  for (let i = 0; i < ticks; i++) stepEnemies(s, DT, world);
}

describe('launched corpses (K1; Michael, 30 Oct, A)', () => {
  it('a grunt killed by a heavy flies along the blow and hurts and staggers the one it meets, once', () => {
    const { s, p, victim, next } = scene();
    damageEnemy(s, victim, blow(p, victim, true));
    expect(victim.ai).toBe('dead');
    expect(victim.launched?.damage).toBeCloseTo(10);
    const hp = next.hp;
    fly(s);
    expect(next.hp).toBeCloseTo(hp - 10);
    expect(next.ai).toBe('stagger');
    expect(victim.x).toBeGreaterThan(-6);
    expect(victim.launched).toBeUndefined();
  });

  it('a light hit only drops it where it stands', () => {
    const { s, p, victim, next } = scene();
    damageEnemy(s, victim, blow(p, victim, false));
    expect(victim.launched).toBeUndefined();
    const hp = next.hp;
    fly(s);
    expect(victim.x).toBeLessThan(-7);
    expect(next.hp).toBe(hp);
    expect(next.ai).toBe('chase');
  });

  it('the warhammer launches half again as far', () => {
    const plain = scene();
    plain.next.z = -8;
    damageEnemy(plain.s, plain.victim, blow(plain.p, plain.victim, true));
    fly(plain.s, 120);
    const hammer = scene();
    hammer.next.z = -8;
    hammer.p.mods.family = 'warhammer';
    damageEnemy(hammer.s, hammer.victim, blow(hammer.p, hammer.victim, true));
    fly(hammer.s, 120);
    const a = plain.victim.x + 8.5;
    const b = hammer.victim.x + 8.5;
    expect(a).toBeGreaterThan(4);
    expect(b / a).toBeCloseTo(1.5, 1);
  });

  it('switched off (the slice), a heavy kill falls as before', () => {
    tuning.launch.enabled = false;
    const { s, p, victim, next } = scene();
    damageEnemy(s, victim, blow(p, victim, true));
    expect(victim.launched).toBeUndefined();
    const hp = next.hp;
    fly(s);
    expect(next.hp).toBe(hp);
  });
});
