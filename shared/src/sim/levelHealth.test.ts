import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { grantXp } from './combat';
import { emptyMods, xpForLevel } from './gear';
import { refreshLevelHealth, stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const loadout = (swordLevel: number): Loadout => ({
  name: 'p',
  xp: { sword: xpForLevel(swordLevel), bow: 0, staff: 0 },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
});

describe('health with the level of the weapon in hand (Michael, 29 Oct)', () => {
  it('adds healthPerLevel a level: a level-20 sword hero has 290, level 50 has 590', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout(20), false);
    expect(p.maxHp).toBe(100 + tuning.progression.healthPerLevel * 19);
    expect(p.maxHp).toBe(290);
    expect(p.hp).toBe(p.maxHp);
    applyLoadout(p, loadout(50), true);
    expect(p.maxHp).toBe(590);
  });

  it('follows the weapon in hand, keeping the share of the bar, so changing weapons is never a heal', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout(20), false);
    p.hp = p.maxHp / 2;
    p.style = 'bow';
    refreshLevelHealth(p);
    expect(p.maxHp).toBe(100);
    expect(p.hp).toBeCloseTo(50);
    p.style = 'sword';
    refreshLevelHealth(p);
    expect(p.maxHp).toBe(290);
    expect(p.hp).toBeCloseTo(145);
  });

  it('a level gained mid-fight raises the bar on the next tick', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout(1), false);
    expect(p.maxHp).toBe(100);
    grantXp(s, p, 'sword', xpForLevel(2) - p.xp.sword);
    stepPlayer(p, idleCommand(), 1 / 60, world, s);
    expect(p.maxHp).toBe(100 + tuning.progression.healthPerLevel);
  });

  it('a change of gear mid-floor caps health at the new bar and never raises it', () => {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout(20), false);
    p.hp = 60;
    applyLoadout(p, loadout(20), false);
    expect(p.hp).toBe(60);
    expect(p.maxHp).toBe(290);
  });

  it('is off for the slice: with healthPerLevel 0 a hero carries no hpBase and keeps the loadout’s health', () => {
    const kept = tuning.progression.healthPerLevel;
    tuning.progression.healthPerLevel = 0;
    try {
      const s = createSimState(arena, [], world);
      const p = addPlayer(s, world, 'p1', loadout(20), false);
      expect(p.maxHp).toBe(100);
      expect('hpBase' in p).toBe(false);
    } finally {
      tuning.progression.healthPerLevel = kept;
    }
  });
});
