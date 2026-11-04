import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { roleOf, telegraphColour } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// G4b, the Hollow King (Michael's A, 4 Nov), phase 1: a three-step sword string up close, and his
// crown thrown down a yellow line at range, out and back. A sidestep after the line locks makes it miss.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

const kept = { passive: tuning.debug.passiveEnemies, hollow: tuning.king.hollowCrown };
afterEach(() => {
  tuning.debug.passiveEnemies = kept.passive;
  tuning.king.hollowCrown = kept.hollow;
});

function scene(heroZ: number): { s: SimState; p: PlayerState; k: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: heroZ, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
  const k = createEnemy(s, world, 'king', 0, 2, 0);
  Object.assign(k, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, k };
}

/** Step until `done`, collecting every event on the way (a step clears none here: stepEnemies only pushes). */
function stepUntil(s: SimState, done: () => boolean, max = 600): void {
  for (let i = 0; i < max && !done(); i++) stepEnemies(s, DT, world);
}

describe('the Hollow King (G4b)', () => {
  it('is a boss with a brain of its own, his string red and his crown yellow', () => {
    expect(roleOf('king')).toBe('boss');
    expect(brainFor('king')).toBeDefined();
    expect(brainFor('king')).not.toBe(brainFor('warden'));
    expect(telegraphColour({ kind: 'king', attack: 'string' })).toBe('strike');
    expect(telegraphColour({ kind: 'king', attack: 'crown' })).toBe('projectile');
  });

  it('ends the Hollow Crown, and only it; the Warden ends every other run', () => {
    expect(bossOf('hollow-crown')).toBe('king');
    expect(bossOf('mossgate')).toBe('warden');
    expect(bossOf(undefined)).toBe('warden');
    tuning.king.hollowCrown = false;
    expect(bossOf('hollow-crown')).toBe('warden');
  });

  it('cuts three times up close, each cut a red cone, and the hero in front is hurt', () => {
    const { s, p, k } = scene(4.5);
    stepUntil(s, () => k.ai === 'windup');
    expect(k.attack).toBe('string');
    expect(k.tele.shape).toBe('cone');
    stepUntil(s, () => k.ai === 'recover');
    expect(s.events.filter((e) => e.kind === 'enemySwing' && e.enemyId === k.id)).toHaveLength(3);
    expect(p.hp).toBeLessThan(1000);
  });

  it('throws his crown down a yellow line at a far hero, out and back, and stands until it returns', () => {
    const { s, p, k } = scene(12);
    stepUntil(s, () => k.ai === 'chargeWindup');
    expect(k.attack).toBe('crown');
    expect(k.tele.shape).toBe('line');
    stepUntil(s, () => k.ai === 'charge');
    expect(k.crown).toEqual({ d: 0, length: k.tele.radius, back: false, struck: [] });
    const at = { x: k.x, z: k.z };
    let farthest = 0;
    stepUntil(s, () => {
      farthest = Math.max(farthest, k.crown?.d ?? 0);
      return k.ai !== 'charge';
    });
    expect(k.ai).toBe('recover');
    expect(k.crown).toBeUndefined();
    expect(farthest).toBeGreaterThan(9);
    expect(Math.hypot(k.x - at.x, k.z - at.z)).toBeLessThan(0.05);
    expect(p.hp).toBeLessThan(1000);
  });

  it('misses a hero who sidesteps after the line locks', () => {
    const { s, p, k } = scene(12);
    stepUntil(s, () => k.ai === 'chargeWindup');
    stepUntil(s, () => k.aiTime >= (tuning.king.crownTelegraphMs / 1000) * 0.55);
    p.x = 3;
    stepUntil(s, () => k.ai === 'recover');
    expect(p.hp).toBe(1000);
  });

  it('loses the crown in flight to a stagger', () => {
    const { s, k } = scene(12);
    stepUntil(s, () => k.ai === 'charge');
    stepUntil(s, () => (k.crown?.d ?? 0) > 3);
    k.ai = 'stagger';
    k.aiTime = 0;
    stepUntil(s, () => k.ai !== 'stagger');
    stepEnemies(s, DT, world);
    expect(k.crown).toBeUndefined();
  });

  it('at 60% roars and two Barrow Knights rise round the hall', () => {
    const { s, k } = scene(12);
    k.hp = k.maxHp * 0.59;
    stepEnemies(s, DT, world);
    expect(k.ai).toBe('roar');
    expect(s.events.find((e) => e.kind === 'roar')).toEqual({ kind: 'roar', enemyId: k.id, phase: 2, king: true });
    stepUntil(s, () => k.ai !== 'roar');
    expect(k.phase).toBe(2);
    const knights = s.enemies.filter((e) => e.kind === 'knight');
    expect(knights).toHaveLength(2);
    for (const n of knights) expect(Math.hypot(n.x - k.x, n.z - k.z)).toBeGreaterThan(2.4);
  });

  it('from phase 2 puts a violet circle under every hero, which Chills and hurts whoever stays', () => {
    const { s, p, k } = scene(12);
    const q = addPlayer(s, world, 'p2', loadout, false);
    Object.assign(q, { x: 6, z: 8, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
    Object.assign(k, { phase: 2 });
    tuning.king.circlesChance = 1;
    try {
      stepUntil(s, () => k.ai === 'chant');
      expect(k.attack).toBe('circles');
      expect(telegraphColour(k)).toBe('magic');
      expect(k.circles).toEqual([
        { x: p.x, z: p.z },
        { x: q.x, z: q.z },
      ]);
      // One steps out in time; the other stays.
      q.x += tuning.king.circlesRadius + 1;
      stepUntil(s, () => k.ai !== 'chant');
    } finally {
      tuning.king.circlesChance = 0.3;
    }
    expect(p.chill).toBeGreaterThan(0);
    expect(p.hp).toBeLessThan(1000);
    expect(q.chill).toBeUndefined();
    expect(q.hp).toBe(1000);
    expect(s.events.filter((e) => e.kind === 'circleLanded').map((e) => (e as { caught: number }).caught)).toEqual([1, 0]);
    expect(k.circles).toBeUndefined();
  });

  it('at 30% roars again: quicker, and his crown sweeps a wide yellow arc that a hero behind it is outside', () => {
    const { s, p, k } = scene(5);
    Object.assign(k, { phase: 2, hp: k.maxHp * 0.29 });
    stepEnemies(s, DT, world);
    expect(s.events.find((e) => e.kind === 'roar')).toMatchObject({ phase: 3, king: true });
    stepUntil(s, () => k.ai !== 'roar');
    expect(k.phase).toBe(3);
    tuning.king.sweepChance = 1;
    const circles = tuning.king.circlesChance;
    tuning.king.circlesChance = 0;
    try {
      stepUntil(s, () => k.ai === 'sweepWindup');
      expect(k.attack).toBe('crownSweep');
      expect(k.tele).toMatchObject({ shape: 'cone', radius: tuning.king.sweepRadius, arcDeg: tuning.king.sweepArcDeg });
      expect(telegraphColour(k)).toBe('projectile');
      let ticks = 0;
      stepUntil(s, () => {
        ticks++;
        return k.ai !== 'sweepWindup';
      });
      // Wound up at phase 3's pace, a quarter quicker than its full telegraph.
      expect(Math.abs(ticks - (tuning.king.sweepTelegraphMs * tuning.king.phase3TelegraphScale) / 1000 / DT)).toBeLessThanOrEqual(2);
      expect(p.hp).toBeLessThan(1000);
    } finally {
      tuning.king.sweepChance = 0.4;
      tuning.king.circlesChance = circles;
    }
  });
});
