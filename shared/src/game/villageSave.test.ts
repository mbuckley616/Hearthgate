import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { applyUpgrade, emptyVillage, readVillageSave, tierGives, upgradeCost, upgradeProblem, villageView } from './villageSave';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const save = { ...emptyVillage('abc123'), lumber: 40, stone: 12, tiers: { shrine: 2, store: 1, storehouse: 1, tavern: 3 } };

describe('the village save (P2)', () => {
  it('takes a save within bounds, filling a missing tier with the first', () => {
    expect(readVillageSave(save)).toEqual(save);
    expect(readVillageSave({ ...save, tiers: { shrine: 2 } })?.tiers).toEqual({ shrine: 2, store: 1, storehouse: 1, tavern: 1 });
  });

  it('refuses a save no village could have', () => {
    expect(readVillageSave({ ...save, id: '' })).toBeNull();
    expect(readVillageSave({ ...save, id: 'a b' })).toBeNull();
    expect(readVillageSave({ ...save, lumber: -1 })).toBeNull();
    expect(readVillageSave({ ...save, stone: 1.5 })).toBeNull();
    expect(readVillageSave({ ...save, lumber: 1e9 })).toBeNull();
    expect(readVillageSave({ ...save, tiers: { ...save.tiers, shrine: tuning.village.maxTier + 1 } })).toBeNull();
    expect(readVillageSave({ ...save, tiers: { ...save.tiers, shrine: 0 } })).toBeNull();
    expect(readVillageSave({ ...save, tiers: { ...save.tiers, forge: 1 } })).toBeNull();
    expect(readVillageSave(null)).toBeNull();
  });

  it('rides on a hello, which a bad one refuses whole; the view leaves the id behind', () => {
    const hello = { k: 'hello', version: PROTOCOL_VERSION, loadout };
    expect(readToHost({ ...hello, village: save })).toEqual({ ...hello, village: save });
    expect(readToHost(hello)).toEqual(hello);
    expect(readToHost({ ...hello, village: { ...save, lumber: -5 } })).toBeNull();
    expect('id' in villageView(save)).toBe(false);
  });
});

describe('raising a building (P4)', () => {
  const v = tuning.village;

  it('costs tier 2 the base price and each tier after upgradeGrowth more', () => {
    expect(upgradeCost(2)).toEqual({ lumber: v.upgradeLumber, stone: v.upgradeStone, coin: v.upgradeCoin });
    expect(upgradeCost(3).lumber).toBe(Math.round(v.upgradeLumber * v.upgradeGrowth));
    expect(upgradeCost(4).coin).toBe(Math.round(v.upgradeCoin * v.upgradeGrowth ** 2));
  });

  it('says what is missing, pays lumber and stone, and stops at the top tier', () => {
    const rich = { ...emptyVillage('x'), tiers: { shrine: 1, store: 1, storehouse: 1, tavern: 1 }, lumber: 1000, stone: 1000 };
    expect(upgradeProblem(villageView(rich), 'store', 0)).toBe(`${v.upgradeCoin} more coin`);
    expect(upgradeProblem({ ...villageView(rich), lumber: 1 }, 'store', 1e6)).toBe(`${v.upgradeLumber - 1} more lumber`);
    expect(upgradeProblem(villageView(rich), 'store', 1e6)).toBeNull();
    const paid = applyUpgrade(rich, 'store');
    expect(rich.tiers.store).toBe(2);
    expect(rich.lumber).toBe(1000 - paid.lumber);
    expect(paid.coin).toBe(v.upgradeCoin);
    rich.tiers.store = v.maxTier;
    expect(upgradeProblem(villageView(rich), 'store', 1e6)).toBe('at its highest tier');
  });

  it('gives each building more as it rises, and the upgrade travels on the wire', () => {
    expect(tierGives('shrine', 1)).toBe('portals as hard as Normal');
    expect(tierGives('shrine', 2)).toBe('portals as hard as Hard');
    expect(tierGives('tavern', 1)).toBe('1 henchman for hire, up to level 12');
    expect(tierGives('tavern', 4)).toContain('quicker');
    expect(readToHost({ k: 'upgrade', building: 'tavern', coin: 120.7 })).toEqual({ k: 'upgrade', building: 'tavern', coin: 120 });
    expect(readToHost({ k: 'upgrade', building: 'forge', coin: 1 })).toBeNull();
    expect(readToHost({ k: 'upgrade', building: 'store', coin: -1 })).toBeNull();
  });
});
