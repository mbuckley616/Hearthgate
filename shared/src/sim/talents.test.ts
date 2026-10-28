import { describe, expect, it } from 'vitest';
import { STYLES, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { createEnemy } from './enemies';
import { damageEnemy, styleDamageBonus } from './combat';
import { addPlayer } from './coop';
import { emptyMods, levelFor, levelUnlock, maxLevel, xpForLevel } from './gear';
import {
  ROW_TALENTS,
  TALENT_IDS,
  boardProblem,
  dodgeRechargeCut,
  emptyTalents,
  maxRanks,
  parryWindowMs,
  pointsEarned,
  rankOf,
  talentFinisher,
  talentLevel,
  type TalentRanks,
} from './talents';
import { createSimState } from './world';

const world = buildWorld(arena);

function hero(level: number, sword: TalentRanks = {}) {
  const s = createSimState(arena, [], world);
  const xp = { sword: xpForLevel(level), bow: 0, staff: 0 };
  const p = addPlayer(s, world, 'p1', { name: 'p', xp, talents: { ...emptyTalents(), sword }, mods: emptyMods(), maxHp: 100 }, true);
  return { s, p };
}

const fullBoard = (): TalentRanks => Object.fromEntries(TALENT_IDS.map((id) => [id, maxRanks(id)]));

describe('progression to 50 (T6a)', () => {
  it('runs style levels to 50, and the board holds exactly the points 50 levels earn', () => {
    expect(maxLevel()).toBe(50);
    expect(levelFor(xpForLevel(50))).toBe(50);
    expect(levelFor(xpForLevel(50) - 1)).toBe(49);
    // The slice's early levels are where they were.
    expect([2, 3, 4, 5].map(xpForLevel)).toEqual([400, 2000, 4500, 8000]);
    const ranks = TALENT_IDS.reduce((n, id) => n + maxRanks(id), 0);
    expect(ranks).toBe(49);
    expect(pointsEarned(xpForLevel(50))).toBe(49);
    expect(boardProblem(xpForLevel(50), fullBoard())).toBeNull();
  });

  it('moves the flat +10% at level 4 into Might, so a raw gain is always a point spent', () => {
    expect(styleDamageBonus(hero(4).p, 'sword')).toBe(0);
    expect(styleDamageBonus(hero(8, { might: 7 }).p, 'sword')).toBeCloseTo(0.35);
    expect(levelUnlock(4)).toBe('Combo step 5');
  });

  it('opens a milestone row every ten levels, and keeps it shut below that whatever the save says', () => {
    expect(ROW_TALENTS.map((r) => r.level)).toEqual([10, 20, 30, 40, 50]);
    expect(levelUnlock(10)).toBe('Talent row: Weight');
    expect(levelUnlock(25)).toBe('Weapon glow');
    expect(levelUnlock(50)).toBe('Talent row: Mastery and Gold glow');
    expect(levelUnlock(11)).toBeUndefined();

    const early = hero(19, { finisher: 4 }).p;
    expect(rankOf(early, 'finisher')).toBe(0);
    expect(talentFinisher(early, 'sword')).toBe(0);
    const ready = hero(20, { finisher: 4 }).p;
    expect(rankOf(ready, 'finisher')).toBe(4);
    expect(talentFinisher(ready, 'sword')).toBeCloseTo(0.4);
  });

  it('gives each row its effect: Riposte widens the parry, Second wind speeds the dodge back', () => {
    expect(parryWindowMs(hero(30).p)).toBe(tuning.guard.parryWindowMs);
    expect(parryWindowMs(hero(30, { riposte: 4 }).p)).toBe(tuning.guard.parryWindowMs + 4 * tuning.talents.riposteParryMsPerRank);
    expect(dodgeRechargeCut(hero(40, { wind: 2 }).p)).toBeCloseTo(2 * tuning.talents.windRechargePerRank);
    // Only with that weapon in hand.
    const { p } = hero(40, { wind: 2 });
    p.style = 'bow';
    expect(dodgeRechargeCut(p)).toBe(0);
  });

  it('adds Weight to poise damage and Finisher to a Skewer', () => {
    const hit = (level: number, ranks: TalentRanks, combo: boolean) => {
      const { s, p } = hero(level, ranks);
      p.talents.bow = ranks;
      p.xp.bow = xpForLevel(level);
      const e = createEnemy(s, world, 'brute', 0, -6, 0);
      e.ai = 'chase';
      const hp = e.hp;
      const poise = e.poise;
      damageEnemy(s, e, { attackerId: p.id, damage: 10, poise: 10, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'bow', projectile: true, combo });
      return { dealt: hp - e.hp, poise: poise - e.poise };
    };
    expect(hit(20, {}, true).dealt).toBeCloseTo(10);
    expect(hit(20, { finisher: 4 }, true).dealt).toBeCloseTo(14);
    expect(hit(20, { finisher: 4 }, false).dealt).toBeCloseTo(10);
    expect(hit(10, { weight: 4 }, false).poise).toBeCloseTo(14);
  });

  it('refuses a board the XP could not have bought', () => {
    const base = { name: 'Ann', mods: emptyMods(), maxHp: 100 };
    const xp = { sword: xpForLevel(12), bow: 0, staff: 0 };
    const ok = { ...emptyTalents(), sword: { might: 7, haste: 3, weight: 1 } };
    expect(readLoadout({ ...base, xp, talents: ok })).not.toBeNull();
    expect(boardProblem(xp.sword, { might: 7, haste: 5 })).toMatch(/more points/);
    expect(readLoadout({ ...base, xp, talents: { ...emptyTalents(), sword: { might: 7, haste: 5 } } })).toBeNull();
    expect(readLoadout({ ...base, xp, talents: { ...emptyTalents(), sword: { finisher: 1 } } })).toBeNull();
    expect(readLoadout({ ...base, xp, talents: { ...emptyTalents(), sword: { might: 9 } } })).toBeNull();
    expect(readLoadout({ ...base, xp, talents: { ...emptyTalents(), bow: { might: 1 } } })).toBeNull();
    for (const s of STYLES) expect(readLoadout({ ...base, xp: { sword: 0, bow: 0, staff: 0, [s]: xpForLevel(50) }, talents: { ...emptyTalents(), [s]: fullBoard() } })).not.toBeNull();
    expect(talentLevel('might')).toBe(1);
  });
});
