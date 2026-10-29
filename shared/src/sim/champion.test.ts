import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import {
  championDamage,
  championPointsEarned,
  championProblem,
  championXpFor,
  emptyChampion,
  type ChampionState,
} from './champion';
import { grantXp, styleDamageBonus } from './combat';
import { addPlayer, stepRevives, type Loadout } from './coop';
import { emptyMods, xpForLevel } from './gear';
import { cooldownMult, damageTakenMult, dodgeRechargeCut, emptyTalents, moveSpeedMult } from './talents';
import { idleCommand } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);

function party(champion: ChampionState | undefined, swordLevel = 50) {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(swordLevel), bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100, champion };
  const p = addPlayer(s, world, 'p1', l, true);
  return { s, p };
}

const kept = { ...tuning.champion };
afterEach(() => Object.assign(tuning.champion, kept));

describe('champion points (T6b)', () => {
  it('prices each point a little more than the last, without end', () => {
    expect(championXpFor(1)).toBe(20000);
    expect(championXpFor(2)).toBe(40250);
    expect(championPointsEarned(19999)).toBe(0);
    expect(championPointsEarned(20000)).toBe(1);
    expect(championPointsEarned(40249)).toBe(1);
    expect(championPointsEarned(40250)).toBe(2);
    for (const n of [7, 60, 500, 4000]) {
      expect(championPointsEarned(championXpFor(n))).toBe(n);
      expect(championPointsEarned(championXpFor(n) - 1)).toBe(n - 1);
    }
  });

  it('banks XP only once a weapon is at the top level, from any weapon', () => {
    const below = party(emptyChampion(), 49);
    grantXp(below.s, below.p, 'bow', 30000);
    expect(below.p.champion!.xp).toBe(0);

    const top = party(emptyChampion());
    grantXp(top.s, top.p, 'bow', 25000);
    expect(top.p.champion!.xp).toBe(25000);
    expect(top.s.events).toContainEqual({ kind: 'championPoint', playerId: 'p1', points: 1 });

    // The slice's heroes carry none, and bank none.
    const slice = party(undefined);
    grantXp(slice.s, slice.p, 'sword', 25000);
    expect(slice.p.champion).toBeUndefined();
  });

  it('never gives more than the ceiling, whatever the ranks are worth', () => {
    const full = { xp: championXpFor(200), ranks: { precision: 15, vitality: 10 } };
    const { p } = party(full);
    expect(championDamage(p)).toBeCloseTo(0.15);
    expect(styleDamageBonus(p, 'sword')).toBeCloseTo(0.15);
    // Vitality's ceiling is on the base; each level's health (healthPerLevel) comes on top of it.
    expect(p.hpBase).toBe(115);
    tuning.champion.precisionDamagePerRank = 0.05;
    tuning.champion.vitalityHealthPerRank = 0.05;
    expect(championDamage(p)).toBeCloseTo(0.15);
    expect(party(full).p.hpBase).toBe(115);
  });

  it('puts each perk where it belongs, and nothing for a hero without them', () => {
    const none = party(undefined).p;
    const some = party({ xp: championXpFor(30), ranks: { toughness: 5, will: 5, lightstep: 5, stride: 5 } }).p;
    expect(damageTakenMult(some)).toBeCloseTo(damageTakenMult(none) - 0.05);
    expect(cooldownMult(some)).toBeCloseTo(cooldownMult(none) - 0.075);
    expect(dodgeRechargeCut(some)).toBeCloseTo(dodgeRechargeCut(none) + 0.15);
    expect(moveSpeedMult(some)).toBeCloseTo(moveSpeedMult(none) + 0.05);
  });

  it('lets Steady hands revive a friend sooner', () => {
    const timeToRevive = (ranks: ChampionState['ranks']) => {
      const s = createSimState(arena, [], world);
      const l = (name: string): Loadout => ({ name, xp: { sword: xpForLevel(50), bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100, champion: { xp: championXpFor(10), ranks } });
      const helper = addPlayer(s, world, 'a', l('a'), true);
      const down = addPlayer(s, world, 'b', l('b'), true);
      down.mode = 'down';
      down.x = helper.x + 0.5;
      down.z = helper.z;
      down.y = helper.y;
      let t = 0;
      while (down.mode === 'down' && t < 10) {
        stepRevives(s, { a: { ...idleCommand(), interact: true } }, 1 / 60);
        t += 1 / 60;
      }
      return t;
    };
    const plain = timeToRevive({});
    expect(plain).toBeCloseTo(tuning.coop.reviveMs / 1000, 1);
    expect(timeToRevive({ steady: 5 })).toBeCloseTo(plain * 0.7, 1);
  });

  it('refuses a champion board the banked XP could not have bought', () => {
    const base = { name: 'Ann', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    expect(readLoadout(base)?.champion).toBeUndefined();
    expect(readLoadout({ ...base, champion: { xp: championXpFor(3), ranks: { precision: 2, will: 1 } } })?.champion).toEqual({ xp: 60750, ranks: { precision: 2, will: 1 } });
    expect(championProblem({ xp: championXpFor(3) - 1, ranks: { precision: 3 } })).toMatch(/more champion points/);
    expect(readLoadout({ ...base, champion: { xp: championXpFor(3) - 1, ranks: { precision: 3 } } })).toBeNull();
    expect(readLoadout({ ...base, champion: { xp: championXpFor(40), ranks: { stride: 6 } } })).toBeNull();
    expect(readLoadout({ ...base, champion: { xp: championXpFor(40), ranks: { flight: 1 } } })).toBeNull();
    expect(readLoadout({ ...base, champion: { xp: -5, ranks: {} } })).toBeNull();
  });
});
