import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { readToHost } from '../net/validate';
import { entryOf, type GearItem } from '../sim/catalogue';
import { buyPrice, dailyStock, sellPrice, storeDay } from './store';
import { storeStock } from './villageSave';

const sword: GearItem = { uid: 'u1', id: 'bronze-sword', rarity: 'common', perk: null, bonus: null };

describe('the General Store (P5)', () => {
  it('asks more for a higher tier and a rare, and pays a share of what it asks', () => {
    const v = tuning.village;
    expect(buyPrice(sword)).toBe(v.priceBase);
    const steel = { ...sword, id: 'steel-sword' };
    expect(buyPrice(steel)).toBe(Math.round(v.priceBase * v.priceTierGrowth ** 2));
    expect(buyPrice({ ...steel, rarity: 'rare' })).toBe(Math.round(v.priceBase * v.priceTierGrowth ** 2 * v.rarePriceMult));
    expect(sellPrice(steel)).toBe(Math.round(buyPrice(steel) * v.sellShare));
    expect(sellPrice(steel)).toBeLessThan(buyPrice(steel));
  });

  it('stocks the same shelves all day, a weapon of each kind first, commons up to a tier above the store', () => {
    const day = storeDay(Date.UTC(2026, 9, 28, 15));
    expect(storeDay(Date.UTC(2026, 9, 28, 23, 59))).toBe(day);
    expect(storeDay(Date.UTC(2026, 9, 29, 0, 1))).toBe(day + 1);
    const shelves = dailyStock(day, 1);
    expect(shelves).toEqual(dailyStock(day, 1));
    expect(shelves).toHaveLength(storeStock(1));
    expect(shelves.slice(0, 3).map((i) => [entryOf(i).slot, entryOf(i).kind])).toEqual([
      ['weapon', 'melee'],
      ['weapon', 'ranged'],
      ['weapon', 'magic'],
    ]);
    for (const i of shelves) {
      expect(i.rarity).toBe('common');
      expect(entryOf(i).tier).toBeLessThanOrEqual(2);
    }
    expect(new Set(shelves.map((i) => i.uid)).size).toBe(shelves.length);
    expect(dailyStock(day + 1, 1)).not.toEqual(shelves);
  });

  it('keeps the same things in better materials as the store rises, and adds more', () => {
    for (const day of [20000, 20001, 20002]) {
      const low = dailyStock(day, 1);
      const high = dailyStock(day, 3);
      expect(high).toHaveLength(storeStock(3));
      expect(high.length).toBeGreaterThan(low.length);
      high.slice(0, low.length).forEach((h, i) => {
        expect(entryOf(h).shape).toBe(entryOf(low[i]).shape);
        expect(entryOf(h).tier).toBeGreaterThanOrEqual(entryOf(low[i]).tier);
      });
      expect(high.every((i) => entryOf(i).tier <= 4)).toBe(true);
    }
  });

  it('takes a purchase by uid and a sale of a real item off the wire', () => {
    expect(readToHost({ k: 'buy', uid: 'store-1-0', coin: 50.5 })).toEqual({ k: 'buy', uid: 'store-1-0', coin: 50 });
    expect(readToHost({ k: 'buy', uid: 'x', coin: -1 })).toBeNull();
    expect(readToHost({ k: 'sell', item: sword })).toEqual({ k: 'sell', item: sword });
    expect(readToHost({ k: 'sell', item: { ...sword, id: 'excalibur' } })).toBeNull();
  });
});
