import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { boundMult, masonBound } from './mason';
import { attackType, roleOf, telegraphTell } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// M1, the Ossuary Mason (docs/bosses.md 2.2): tanky by rule, not by health. Bound while a Wardstone
// stands, it takes 25% of every hit; its maul string and hod throw.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { ...tuning.mason, passive: tuning.debug.passiveEnemies };
afterEach(() => {
  const { passive, ...m } = kept;
  Object.assign(tuning.mason, m);
  tuning.debug.passiveEnemies = passive;
});

function scene(heroZ: number): { s: SimState; p: PlayerState; m: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: heroZ, yaw: Math.PI, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
  const m = createEnemy(s, world, 'mason', 0, 2, 0);
  Object.assign(m, { x: 0, z: 2, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, m };
}

function ticksUntil(s: SimState, done: () => boolean, max = 900): number {
  let i = 0;
  for (; i < max && !done(); i++) stepEnemies(s, DT, world);
  return i;
}

function hit(e: EnemyState, style: 'sword' | 'bow' | 'staff' = 'sword'): HitSpec {
  return { attackerId: 'p1', damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style, projectile: style !== 'sword' };
}

const stones = (s: SimState) => s.enemies.filter((e) => e.kind === 'wardstone');
const events = (s: SimState, kind: string) => s.events.filter((e) => e.kind === kind);

describe('the Ossuary Mason (M1)', () => {
  it('is a boss with a brain of its own; its maul string blockable, its hod rimmed, both blunt', () => {
    expect(roleOf('mason')).toBe('boss');
    expect(brainFor('mason')).toBeDefined();
    expect(brainFor('mason')).not.toBe(brainFor('warden'));
    expect(telegraphTell({ kind: 'mason', attack: 'string' }, true).rim).toBe(false);
    expect(telegraphTell({ kind: 'mason', attack: 'hod' }, true).rim).toBe(true);
    expect(attackType({ kind: 'mason', attack: 'string' })).toBe('blunt');
    expect(attackType({ kind: 'mason', attack: 'hod' })).toBe('blunt');
  });

  it('ends Emberhall, and the Warden does with the switch off', () => {
    expect(bossOf('emberhall')).toBe('mason');
    expect(bossOf('old-cellar')).toBe('warden');
    tuning.mason.enabled = false;
    expect(bossOf('emberhall')).toBe('warden');
  });

  it('raises its Wardstones round it as it wakes, once', () => {
    const { s } = scene(20);
    stepEnemies(s, DT, world);
    expect(stones(s)).toHaveLength(tuning.mason.wardstones);
    expect(events(s, 'enemyRose')).toHaveLength(tuning.mason.wardstones);
    for (let i = 0; i < 30; i++) stepEnemies(s, DT, world);
    expect(stones(s)).toHaveLength(tuning.mason.wardstones);
  });

  it('takes boundTaken while a stone stands, and full damage once all fall (the gate)', () => {
    const { s, m } = scene(20);
    stepEnemies(s, DT, world);
    const [a, b, c] = stones(s);
    for (const st of [a, b, c]) st.ai = 'chase';
    expect(masonBound(s)).toBe(true);
    let hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    // A staff's bolt is held as much: the rule is any style's.
    hp = m.hp;
    damageEnemy(s, m, hit(m, 'staff'));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    // Two stones down, one standing: still Bound.
    for (const st of [a, b]) while (st.ai !== 'dead') damageEnemy(s, st, { ...hit(st), damage: 1000 });
    hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    while (c.ai !== 'dead') damageEnemy(s, c, { ...hit(c), damage: 1000 });
    expect(masonBound(s)).toBe(false);
    hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10, 5);
  });

  it('binds only the Mason: a stone and any other kind take their full hit', () => {
    const { s } = scene(20);
    stepEnemies(s, DT, world);
    expect(boundMult(s, stones(s)[0])).toBe(1);
    expect(boundMult(s, { kind: 'warden' })).toBe(1);
  });

  it('never moves a Wardstone, and its stones crumble when it falls, so the hall clears', () => {
    const { s, m } = scene(20);
    stepEnemies(s, DT, world);
    const st = stones(s)[0];
    const at = { x: st.x, z: st.z };
    for (let i = 0; i < 120; i++) stepEnemies(s, DT, world);
    expect(Math.hypot(st.x - at.x, st.z - at.z)).toBeLessThan(1e-6);
    m.hp = 0;
    m.ai = 'dead';
    ticksUntil(s, () => stones(s).every((e) => e.ai === 'dead'), 120);
    expect(stones(s).every((e) => e.ai === 'dead')).toBe(true);
  });

  it('swings a string of stringSteps cones at its front hero, the last an overhead', () => {
    tuning.mason.wardstones = 0;
    const { s, p, m } = scene(4.5);
    ticksUntil(s, () => m.ai === 'windup');
    expect(m.attack).toBe('string');
    expect(m.tele.shape).toBe('cone');
    const taken: number[] = [];
    let last = p.hp;
    const n = ticksUntil(s, () => m.ai === 'slash1');
    expect(Math.abs(n * DT * 1000 - tuning.mason.stringTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    let swings = 0;
    ticksUntil(s, () => {
      if (p.hp < last) {
        taken.push(last - p.hp);
        last = p.hp;
      }
      // Keep the hero in front, and never i-framed, so every swing can land.
      Object.assign(p, { x: m.x + Math.sin(m.yaw) * 2, z: m.z + Math.cos(m.yaw) * 2, invulnTime: 0, mode: 'move' });
      swings = events(s, 'enemySwing').length;
      return m.ai === 'recover';
    });
    expect(swings).toBe(tuning.mason.stringSteps);
    expect(taken).toHaveLength(tuning.mason.stringSteps);
    expect(taken[taken.length - 1]).toBeGreaterThan(taken[0]);
  });

  it('throws its hod at a far hero: the circle follows them half the wind-up, then lands where it locked', () => {
    tuning.mason.wardstones = 0;
    const { s, p, m } = scene(12);
    ticksUntil(s, () => m.ai === 'slamWindup');
    expect(m.attack).toBe('hod');
    expect(m.tele.shape).toBe('circle');
    // Past the lock the hero steps out of the circle: the load misses.
    ticksUntil(s, () => m.aiTime >= (tuning.mason.hodTelegraphMs / 1000) * 0.6);
    const locked = { x: m.tele.x, z: m.tele.z };
    p.x = locked.x + tuning.mason.hodRadius + 2;
    ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(m.tele.x).toBeCloseTo(locked.x, 6);
    expect(p.hp).toBe(1000);
  });

  it('lands its hod on a hero who stays in the circle', () => {
    tuning.mason.wardstones = 0;
    const { s, p, m } = scene(12);
    ticksUntil(s, () => m.ai === 'slamWindup');
    const n = ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(Math.abs(n * DT * 1000 - tuning.mason.hodTelegraphMs)).toBeLessThanOrEqual(2 * DT * 1000 + 1);
    expect(p.hp).toBeLessThan(1000);
  });
});
