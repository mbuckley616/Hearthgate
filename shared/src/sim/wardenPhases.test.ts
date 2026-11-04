import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { three: tuning.warden.threePhases, chance: tuning.warden.chainChance, passive: tuning.debug.passiveEnemies };
afterEach(() => {
  tuning.warden.threePhases = kept.three;
  tuning.warden.chainChance = kept.chance;
  tuning.debug.passiveEnemies = kept.passive;
});

function scene(): { s: SimState; p: PlayerState; w: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: -10, z: 3, hp: 1e6, maxHp: 1e6 });
  const w = createEnemy(s, world, 'warden', -6, 3, -Math.PI / 2);
  Object.assign(w, { ai: 'chase', aiTime: 0, cooldown: 99 });
  return { s, p, w };
}

/** Step until the Warden has finished its roar (or `max` seconds pass). */
function throughRoar(s: SimState, w: EnemyState, max = 4): void {
  for (let i = 0; i < max / DT && w.ai !== 'roar'; i++) stepEnemies(s, DT, world);
  expect(w.ai).toBe('roar');
  for (let i = 0; i < max / DT && w.ai === 'roar'; i++) stepEnemies(s, DT, world);
}

describe("the Warden's three phases (E1g)", () => {
  it('at 60% it roars and the dead rise round the hall; at 30% it roars again and quickens; each roar names its phase', () => {
    const { s, w } = scene();
    w.hp = w.maxHp * 0.65;
    for (let i = 0; i < 60; i++) stepEnemies(s, DT, world);
    expect(w.ai).not.toBe('roar');

    w.hp = w.maxHp * 0.59;
    s.events.length = 0;
    throughRoar(s, w);
    expect(s.events.some((e) => e.kind === 'roar' && e.phase === 2)).toBe(true);
    expect(w.phase).toBe(2);
    const risen = s.events.filter((e) => e.kind === 'enemyRose');
    const dead = s.enemies.filter((e) => e.kind === 'grunt');
    expect(risen.length).toBe(Math.round(tuning.warden.summonCount));
    expect(dead.length).toBe(risen.length);
    // From the edges, not at its feet: spread all round it, and further out than the slice's 3.2 m fan.
    for (const g of dead) expect(Math.hypot(g.x - w.x, g.z - w.z)).toBeGreaterThan(4);
    const angles = dead.map((g) => Math.atan2(g.x - w.x, g.z - w.z)).sort((a, b) => a - b);
    expect(angles[angles.length - 1] - angles[0]).toBeGreaterThan(Math.PI);

    // Phase 2 keeps phase 1's pace; phase 3 is the quick one.
    w.cooldown = 0;
    w.hp = w.maxHp * 0.29;
    s.events.length = 0;
    throughRoar(s, w);
    expect(s.events.some((e) => e.kind === 'roar' && e.phase === 3)).toBe(true);
    expect(w.phase).toBe(3);
    // No second raising.
    expect(s.enemies.filter((e) => e.kind === 'grunt').length).toBe(dead.length);
    // It never roars a third time.
    for (let i = 0; i < 300; i++) stepEnemies(s, DT, world);
    expect(w.phase).toBe(3);
    expect(w.ai).not.toBe('roar');
  });

  it("phase 3's rolling slam lands three circles, each further along its line, each telegraphed", () => {
    const { s, p, w } = scene();
    Object.assign(w, { phase: 3, summoned: true });
    tuning.warden.chainChance = 1;
    Object.assign(p, { x: -9, z: 3 });
    const slams: { x: number; z: number }[] = [];
    let teles = 0;
    let started = false;
    for (let i = 0; i < 20 / DT && slams.length < 3; i++) {
      // Keep it choosing until it rolls a slam rather than a sweep.
      if (w.ai === 'chase') w.cooldown = 0;
      stepEnemies(s, DT, world);
      if (w.attack === 'chainSlam') started = true;
      if (!started) {
        s.events.length = 0;
        continue;
      }
      for (const ev of s.events) {
        if (ev.kind === 'enemySlam' && ev.enemyId === w.id) slams.push({ x: ev.x, z: ev.z });
        if (ev.kind === 'enemyTelegraph' && ev.enemyId === w.id) teles++;
      }
      s.events.length = 0;
      p.hp = p.maxHp;
    }
    expect(slams.length).toBe(3);
    expect(teles).toBeGreaterThanOrEqual(2);
    const step1 = Math.hypot(slams[1].x - slams[0].x, slams[1].z - slams[0].z);
    const step2 = Math.hypot(slams[2].x - slams[1].x, slams[2].z - slams[1].z);
    expect(step1).toBeCloseTo(tuning.warden.chainStepM, 3);
    expect(step2).toBeCloseTo(tuning.warden.chainStepM, 3);
    // On one line, away from the Warden.
    expect(Math.hypot(slams[2].x - w.x, slams[2].z - w.z)).toBeGreaterThan(Math.hypot(slams[0].x - w.x, slams[0].z - w.z) + 5);
    // Then it recovers and the next attack starts fresh.
    for (let i = 0; i < 60 && w.ai !== 'recover'; i++) stepEnemies(s, DT, world);
    expect(w.ai).toBe('recover');
    expect(w.chain).toBeUndefined();
  });

  it('switched off it is the slice: one roar at half health, three grunts at its feet, two phases', () => {
    tuning.warden.threePhases = false;
    const { s, w } = scene();
    w.hp = w.maxHp * 0.55;
    for (let i = 0; i < 60; i++) stepEnemies(s, DT, world);
    expect(w.ai).not.toBe('roar');
    w.hp = w.maxHp * 0.49;
    s.events.length = 0;
    throughRoar(s, w);
    expect(s.events.some((e) => e.kind === 'roar' && e.phase === undefined)).toBe(true);
    expect(s.events.some((e) => e.kind === 'enemyRose')).toBe(false);
    expect(w.phase).toBe(2);
    w.hp = w.maxHp * 0.1;
    for (let i = 0; i < 300; i++) stepEnemies(s, DT, world);
    expect(w.phase).toBe(2);
  });
});
