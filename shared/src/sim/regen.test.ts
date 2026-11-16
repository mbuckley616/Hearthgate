import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { newFlow } from './flow';
import { emptyMods, xpForLevel } from './gear';
import { spawnBolt, stepProjectiles } from './projectiles';
import { stepRegen } from './regen';
import { holyPulse, masteryTwist, stepGroves } from './specs';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState, stepSim } from './world';

// Self-heals only and a slow regen out of a fight (Michael, 15 Nov, A).
const world = buildWorld(arena);
const DT = 1 / 60;
const at10 = xpForLevel(tuning.specs.level);
const base = (sword: number, staff = 0): Loadout => ({ name: 'p', xp: { sword, bow: 0, staff }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });

function two(spec?: Loadout['spec']) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', { ...base(at10, at10), ...(spec ? { spec } : {}) }, false);
  const friend = addPlayer(s, world, 'p2', base(0), false);
  Object.assign(p, { x: 0, z: 10, yaw: Math.PI, hp: 40 });
  Object.assign(friend, { x: 1, z: 10, hp: 40 });
  return { s, p, friend };
}

describe('self-heals only (heal.selfOnly)', () => {
  it("a Paladin's Bulwark pulse heals the Paladin and not the friend beside them", () => {
    const { s, p, friend } = two({ sword: 'paladin' });
    holyPulse(s, p);
    expect(p.hp).toBeCloseTo(40 + p.maxHp * tuning.specs.bulwarkHeal);
    expect(friend.hp).toBe(40);
  });

  it("the Paladin's rank V twist heals the Paladin alone", () => {
    const { s, p, friend } = two({ sword: 'paladin' });
    expect(masteryTwist(s, p, p.x, p.z)).toBe(true);
    expect(p.hp).toBeCloseTo(40 + p.maxHp * tuning.mastery.paladinHeal);
    expect(friend.hp).toBe(40);
  });

  it("a Druid's grove heals the Druid standing in it, not a friend in it too", () => {
    const { s, p, friend } = two({ staff: 'druid' });
    s.groves = [{ by: p.id, x: p.x, y: p.y, z: p.z, radius: 4, until: s.time + 1, element: 'nature' }];
    for (let i = 0; i < 30; i++) stepGroves(s, DT);
    expect(p.hp).toBeGreaterThan(40);
    expect(friend.hp).toBe(40);
  });

  it("a Druid's bolt passes a hurt friend by and heals the Druid as it lands, once", () => {
    const { s, p, friend } = two({ staff: 'druid' });
    Object.assign(p, { style: 'staff', mode: 'move', flow: newFlow() });
    Object.assign(friend, { x: 0, z: 8 });
    const e = createEnemy(s, world, 'grunt', 0, 6, 0);
    Object.assign(e, { x: 0, z: 6, ai: 'chase', hp: 9999 });
    spawnBolt(s, p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0);
    for (let i = 0; i < 60; i++) {
      stepProjectiles(s, DT, world.colliders);
      s.time += DT;
    }
    expect(e.hp).toBeLessThan(9999);
    expect(friend.hp).toBe(40);
    expect(p.hp).toBeCloseTo(40 + p.maxHp * tuning.heal.bloomSelf);
  });
});

describe('the slow regen out of a fight (heal.regenPerS)', () => {
  it('waits regenDelayS with no fight on, then heals regenPerS of health a second, never past full', () => {
    const { s, p } = two();
    s.run.phase = 'ante';
    const wait = Math.round(tuning.heal.regenDelayS / DT);
    for (let i = 0; i < wait - 2; i++) stepRegen(s, DT);
    expect(p.hp).toBe(40);
    for (let i = 0; i < 2 + 60; i++) stepRegen(s, DT);
    expect(p.hp).toBeCloseTo(40 + p.maxHp * tuning.heal.regenPerS, 0);
    for (let i = 0; i < 60 * 200; i++) stepRegen(s, DT);
    expect(p.hp).toBe(p.maxHp);
  });

  it('stops the moment a fight is on and starts the wait again', () => {
    const { s, p } = two();
    s.run.phase = 'ante';
    for (let i = 0; i < Math.round((tuning.heal.regenDelayS + 1) / DT); i++) stepRegen(s, DT);
    const before = p.hp;
    expect(before).toBeGreaterThan(40);
    s.run.phase = 'wave';
    for (let i = 0; i < 120; i++) stepRegen(s, DT);
    expect(p.hp).toBe(before);
    expect(s.calmFor).toBeUndefined();
    s.run.phase = 'ante';
    for (let i = 0; i < 60; i++) stepRegen(s, DT);
    expect(p.hp).toBe(before);
  });

  it('a downed hero does not regen', () => {
    const { s, friend } = two();
    s.run.phase = 'ante';
    Object.assign(friend, { mode: 'down', hp: 0 });
    for (let i = 0; i < Math.round((tuning.heal.regenDelayS + 2) / DT); i++) stepRegen(s, DT);
    expect(friend.hp).toBe(0);
  });

  it('stepSim runs it, in the antechamber where heroes join', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', base(0), false);
    p.hp = 40;
    const idle = { p1: idleCommand() };
    for (let i = 0; i < Math.round((tuning.heal.regenDelayS + 2) / DT); i++) stepSim(s, idle, DT, world);
    expect(s.run.phase).toBe('ante');
    expect(p.hp).toBeGreaterThan(40);
  });
});
