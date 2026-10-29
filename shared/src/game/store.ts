import { tuning } from '../config/tuning';
import { CATALOGUE, entryOf, type CatalogueEntry, type GearItem } from '../sim/catalogue';
import { storeStock } from './villageSave';

/**
 * Coin and the General Store (P5). Aldous sells a small stock rolled each day from the catalogue,
 * sized by the store's tier, and buys anything from a bag. The village's room keeps the day's stock
 * and is the one who says what a thing costs; coin itself is the player's, in their browser until
 * Phase 3 (as with an upgrade, the room takes their word for how much they hold).
 */

/** What Aldous asks for an item: by its tier, more for a rare. */
export function buyPrice(item: GearItem): number {
  const v = tuning.village;
  const e = entryOf(item);
  return Math.round(v.priceBase * Math.pow(v.priceTierGrowth, e.tier - 1) * (item.rarity === 'rare' ? v.rarePriceMult : 1));
}

/** What Aldous pays for an item: a share of what he would ask. */
export function sellPrice(item: GearItem): number {
  return Math.max(1, Math.round(buyPrice(item) * tuning.village.sellShare));
}

/** The day the server's clock is on (UTC), which seeds the stock: everyone's store turns over at midnight. */
export function storeDay(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

/** The seeded generator the floors use (mulberry32), so a day's stock is the same wherever it is rolled. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEAPON_KINDS = ['melee', 'ranged', 'magic'] as const;

/**
 * The day's stock at a store of this tier. Commons only, of materials up to one tier above the
 * store's (to the catalogue's fifth); the first three are a weapon for each kind, so there is always
 * something for a hero who wants to try another, then any slot. Each place on the shelf is rolled from
 * the whole catalogue and brought down to the best material the store can get of that shape, so a
 * higher tier keeps the same things in better materials, and adds more.
 */
export function dailyStock(day: number, storeTier: number): GearItem[] {
  const rand = seeded(Math.imul(day, 0x9e3779b1) ^ 0x51ed27);
  const top = Math.min(5, storeTier + 1);
  const all = [...CATALOGUE.values()];
  const pick = (from: CatalogueEntry[]) => from[Math.floor(rand() * from.length)];
  const out: GearItem[] = [];
  const count = storeStock(storeTier);
  for (let i = 0; i < count; i++) {
    const kind = WEAPON_KINDS[i];
    const entry = capTier(kind ? pick(all.filter((e) => e.slot === 'weapon' && e.kind === kind)) : pick(all), top);
    out.push({ uid: `store-${day}-${i}`, id: entry.id, rarity: 'common', perk: null, bonus: null });
  }
  return out;
}

/** The same shape in the best material of its kind at or below `top` (its own if that is low enough). */
function capTier(entry: CatalogueEntry, top: number): CatalogueEntry {
  if (entry.tier <= top) return entry;
  let best: CatalogueEntry | null = null;
  for (const e of CATALOGUE.values()) {
    if (e.shape !== entry.shape || e.material.family !== entry.material.family || e.tier > top) continue;
    if (!best || e.tier > best.tier) best = e;
  }
  return best ?? entry;
}
