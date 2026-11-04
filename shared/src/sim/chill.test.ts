import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { chillHero } from './chill';
import { addPlayer, type Loadout } from './coop';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand } from './types';
import { createSimState } from './world';

// E1d's Chill on a hero, Michael's A (4 Nov): 35% slower for 3 s and no sprint; attacks, dodges and
// abilities unchanged.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** Metres covered running half a second toward +z (clear of the arena's walls), chilled or not. */
function run(cmd: Partial<PlayerCommand>, chilled: boolean) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  p.x = 0;
  p.z = -6;
  if (chilled) chillHero(s, p);
  const z0 = p.z;
  for (let i = 0; i < 30; i++) stepPlayer(p, { ...idleCommand(), moveZ: 1, aimX: 0, aimZ: 1, ...cmd }, DT, world, s);
  return { dist: p.z - z0, p, s };
}

describe('Chill on a hero (E1d)', () => {
  it('slows a run by chill.slow once at speed', () => {
    const warm = run({}, false).dist;
    const cold = run({}, true).dist;
    // The steering's ramp-up is the same share of both, so the ratio is close to the slow.
    expect(cold / warm).toBeGreaterThan(1 - tuning.chill.slow - 0.05);
    expect(cold / warm).toBeLessThan(1 - tuning.chill.slow + 0.05);
  });

  it('stops a sprint: a chilled sprint is no faster than a chilled run', () => {
    expect(run({ sprint: true }, false).dist).toBeGreaterThan(run({}, false).dist + 0.3);
    expect(run({ sprint: true }, true).dist).toBeCloseTo(run({}, true).dist, 5);
  });

  it('wears off after chill.durationS, counted in stepPlayer, so prediction agrees', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    chillHero(s, p);
    expect(s.events.some((e) => e.kind === 'chilled' && e.playerId === p.id)).toBe(true);
    const ticks = Math.round(tuning.chill.durationS / DT);
    for (let i = 0; i < ticks - 1; i++) stepPlayer(p, idleCommand(), DT, world, s);
    expect(p.chill).toBeGreaterThan(0);
    stepPlayer(p, idleCommand(), DT, world, s);
    stepPlayer(p, idleCommand(), DT, world, s);
    expect(p.chill).toBeUndefined();
    // A copy stepped the same way agrees to the tick.
    chillHero(s, p);
    const copy = structuredClone(p);
    for (let i = 0; i < 40; i++) {
      stepPlayer(p, { ...idleCommand(), moveX: 1 }, DT, world, s);
      stepPlayer(copy, { ...idleCommand(), moveX: 1 }, DT, world, s);
    }
    expect(copy.chill).toBe(p.chill);
    expect(copy.x).toBe(p.x);
  });

  it('leaves the dodge alone', () => {
    const roll = (chilled: boolean) => {
      const { p, s } = run({}, false);
      if (chilled) chillHero(s, p);
      const z0 = p.z;
      stepPlayer(p, { ...idleCommand(), moveZ: 1, dodge: true }, DT, world, s);
      for (let i = 0; i < 10; i++) stepPlayer(p, { ...idleCommand(), moveZ: 1 }, DT, world, s);
      return p.z - z0;
    };
    // The roll itself is the same; only the steering after it may differ, so compare the first ticks.
    expect(Math.abs(roll(true) - roll(false))).toBeLessThan(0.15);
  });
});
