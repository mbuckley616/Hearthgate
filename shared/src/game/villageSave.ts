import { tuning } from '../config/tuning';
import type { Building } from '../level/village';

/**
 * The host's village (P2; Michael, 28 Oct: in the browser until Phase 3). The host's browser keeps it
 * under its own key beside the hero and sends it in its hello when it joins a village room; the room
 * checks it, holds it, adds what the run banks, and sends it back to every player there. Only the
 * browser whose save it is (`id`) keeps what comes back, so a visitor's own village never changes.
 */

export type BuildingId = Building['id'];
export const BUILDINGS: readonly BuildingId[] = ['shrine', 'store', 'storehouse', 'tavern'];

export interface VillageSave {
  /** Which browser's village this is: made once when the save is, never shown to anyone else. */
  id: string;
  lumber: number;
  stone: number;
  /** Each starting building's tier, 1 to village.maxTier (P4 spends lumber, stone and coin on them). */
  tiers: Record<BuildingId, number>;
}

/** What every player in the village is sent: the save without its owner's id. */
export type VillageView = Omit<VillageSave, 'id'>;

export function emptyVillage(id: string): VillageSave {
  return { id, lumber: 0, stone: 0, tiers: { shrine: 1, store: 1, storehouse: 1, tavern: 1 } };
}

const MAX_STOCK = 10_000_000;

/**
 * A village save from a hello, or null: an id, whole lumber and stone within bounds, and every tier
 * one there is. Until P4 sets prices no tier can be checked against what it cost.
 */
export function readVillageSave(v: unknown): VillageSave | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !/^[\w-]{1,32}$/.test(o.id)) return null;
  const count = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= MAX_STOCK ? x : null);
  const lumber = count(o.lumber);
  const stone = count(o.stone);
  if (lumber === null || stone === null) return null;
  if (typeof o.tiers !== 'object' || o.tiers === null) return null;
  const given = o.tiers as Record<string, unknown>;
  if (Object.keys(given).some((k) => !BUILDINGS.includes(k as BuildingId))) return null;
  const tiers = emptyVillage('').tiers;
  for (const b of BUILDINGS) {
    const t = given[b];
    if (t === undefined) continue;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > tuning.village.maxTier) return null;
    tiers[b] = t;
  }
  return { id: o.id, lumber, stone, tiers };
}

export function villageView(save: VillageSave): VillageView {
  return { lumber: save.lumber, stone: save.stone, tiers: { ...save.tiers } };
}

export interface Cost {
  lumber: number;
  stone: number;
  coin: number;
}

/** What raising a building to `tier` costs (P4): tier 2's price, upgradeGrowth more each tier after. */
export function upgradeCost(tier: number): Cost {
  const v = tuning.village;
  const k = Math.pow(v.upgradeGrowth, Math.max(0, tier - 2));
  return { lumber: Math.round(v.upgradeLumber * k), stone: Math.round(v.upgradeStone * k), coin: Math.round(v.upgradeCoin * k) };
}

/** Why the owner cannot raise this building now, or null: the top tier, or too little of something. */
export function upgradeProblem(view: VillageView, building: BuildingId, coin: number): string | null {
  const tier = view.tiers[building];
  if (tier >= tuning.village.maxTier) return 'at its highest tier';
  const c = upgradeCost(tier + 1);
  if (view.lumber < c.lumber) return `${c.lumber - view.lumber} more lumber`;
  if (view.stone < c.stone) return `${c.stone - view.stone} more stone`;
  if (coin < c.coin) return `${c.coin - coin} more coin`;
  return null;
}

/** Raise a building a tier, paying its lumber and stone (the coin is the owner's, in their save). */
export function applyUpgrade(save: VillageSave, building: BuildingId): Cost {
  const c = upgradeCost(save.tiers[building] + 1);
  save.lumber -= c.lumber;
  save.stone -= c.stone;
  save.tiers[building]++;
  return c;
}

/** The highest portal tier the shrine opens (P7): one above its own. */
export const shrinePortalTier = (tier: number) => tier + 1;
/** Henchmen the tavern hires (P10): one a tier to three; tier 4 makes them quicker. */
export const tavernHenchmen = (tier: number) => Math.min(3, tier);
/** Items the store stocks a day (P5). */
export const storeStock = (tier: number) => tuning.village.stockBase + (tier - 1) * tuning.village.stockPerTier;
/** Spaces in the storehouse's stash (P9). */
export const stashSpaces = (tier: number) => tier * tuning.village.stashPerTier;

/** What a building does at a tier, in a villager's words. */
export function tierGives(building: BuildingId, tier: number): string {
  switch (building) {
    case 'shrine':
      return `portals up to tier ${shrinePortalTier(tier)}`;
    case 'store':
      return `${storeStock(tier)} items on the shelves each day`;
    case 'storehouse':
      return `${stashSpaces(tier)} spaces to keep things in`;
    case 'tavern': {
      const n = tavernHenchmen(tier);
      return tier >= 4 ? 'three henchmen, quicker on their feet' : `${n} ${n === 1 ? 'henchman' : 'henchmen'} for hire`;
    }
  }
}
