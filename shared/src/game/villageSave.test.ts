import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { emptyVillage, readVillageSave, villageView } from './villageSave';

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
