import { STYLES, tuning, type Style } from '../config/tuning';
import type { Building } from '../level/village';
import type { GearItem } from '../sim/catalogue';
import { DIFFICULTIES, maxDifficulty } from './portalChoice';

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
  /**
   * Each starting building's tier, 1 to village.maxTier (P4 spends lumber, stone and coin on them);
   * 0 is an empty plot (Michael, 31 Oct, A), which the shrine never is.
   */
  tiers: Record<BuildingId, number>;
  /**
   * The Tavern's henchmen's XP, by kit (P12; one name a kit, HIRES): banked with a floor as finds are,
   * so a hire comes back at the level it banked. Absent until one has banked.
   */
  hench?: Partial<Record<Style, number>>;
}

/** What every player in the village is sent: the save without its owner's id, and the store's shelves today (P5). */
export type VillageView = Omit<VillageSave, 'id'> & { stock?: GearItem[] };

/**
 * A new village (Michael, 31 Oct, A): Wren's portal and, with village.startWithPlots, empty plots for
 * the other three, each raised by its first build.
 */
export function emptyVillage(id: string): VillageSave {
  const t = tuning.village.startWithPlots ? 0 : 1;
  return { id, lumber: 0, stone: 0, tiers: { shrine: 1, store: t, storehouse: t, tavern: t } };
}

/** The lowest tier a building may stand at: the shrine is always built, the others may be a plot. */
export const minTier = (b: BuildingId) => (b === 'shrine' ? 1 : 0);

/** The buildings still an empty plot. */
export const plotsOf = (tiers: Record<BuildingId, number>): BuildingId[] => BUILDINGS.filter((b) => tiers[b] < 1);

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
  // A save from before the plots names every tier; one that leaves a building out had it built.
  const tiers: Record<BuildingId, number> = { shrine: 1, store: 1, storehouse: 1, tavern: 1 };
  for (const b of BUILDINGS) {
    const t = given[b];
    if (t === undefined) continue;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < minTier(b) || t > tuning.village.maxTier) return null;
    tiers[b] = t;
  }
  const hench = readHench(o.hench);
  if (hench === null) return null;
  return { id: o.id, lumber, stone, tiers, ...(hench ? { hench } : {}) };
}

/** Henchmen's XP from a save: whole, within bounds, by a kit there is; undefined when absent, null when wrong. */
function readHench(v: unknown): Partial<Record<Style, number>> | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== 'object' || v === null) return null;
  const out: Partial<Record<Style, number>> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!STYLES.includes(k as Style) || typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > MAX_STOCK * 100) return null;
    out[k as Style] = Math.floor(x);
  }
  return out;
}

export function villageView(save: VillageSave): VillageView {
  return { lumber: save.lumber, stone: save.stone, tiers: { ...save.tiers }, ...(save.hench ? { hench: { ...save.hench } } : {}) };
}

/** The highest level the Tavern's henchmen reach at this tier (P12). */
export function henchmanCap(tavernTier: number): number {
  const max = tuning.progression.maxLevel;
  return tavernTier >= tuning.village.maxTier ? max : Math.min(max, Math.max(0, tavernTier) * tuning.village.henchmanCapPerTier);
}

/**
 * A floor banked with henchmen in the party (P12): each kit keeps the most XP it has banked. Their XP
 * is capped in the fight already, so what comes here is never past the Tavern's cap.
 */
export function bankHenchmen(save: VillageSave, hench: readonly { style: Style; xp: number }[]): boolean {
  let changed = false;
  for (const h of hench) {
    const xp = Math.floor(h.xp);
    if (xp <= (save.hench?.[h.style] ?? 0)) continue;
    save.hench = { ...save.hench, [h.style]: xp };
    changed = true;
  }
  return changed;
}

export interface Cost {
  lumber: number;
  stone: number;
  coin: number;
}

/** What raising a building to `tier` costs (P4): tier 2's price, upgradeGrowth more each tier after. */
export function upgradeCost(tier: number): Cost {
  const v = tuning.village;
  // A plot's first build (Michael, 31 Oct, A) costs a little lumber and stone.
  if (tier <= 1) return { lumber: v.plotLumber, stone: v.plotStone, coin: v.plotCoin };
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
export const storeStock = (tier: number) => (tier < 1 ? 0 : tuning.village.stockBase + (tier - 1) * tuning.village.stockPerTier);
/** Spaces in the storehouse's stash (P9). */
export const stashSpaces = (tier: number) => (tier < 1 ? 0 : tuning.village.stashBase + (tier - 1) * tuning.village.stashPerTier);
/**
 * The bag's safe pocket (D5): its first spaces, never lost on a wipe. A Storehouse still a plot keeps
 * the first tier's, so a new hero's first wipe never takes the bow and staff they started with.
 */
export const pocketSpaces = (tier: number) => Math.min(28, tuning.village.pocketBase + (Math.max(1, tier) - 1) * tuning.village.pocketPerTier);

/**
 * How a building looks at a tier (Michael, 1 Nov, A): each its own trade from the first build, and one
 * step at villageLook.stepTier. Only the views read it; the shrine keeps its stone at every tier.
 */
export interface BuildingLook {
  /** Walls of dressed stone rather than timber and plaster (the Storehouse's strongroom). */
  stone: boolean;
  /** A stone ground floor under the timber (the Tavern's). */
  stoneBase: boolean;
  /** Dormers on the roof: rooms upstairs (the Store's and the Tavern's second storey). */
  dormers: boolean;
  /** Chimneys on the ridge. */
  chimneys: number;
}

export function buildingLook(building: BuildingId, tier: number): BuildingLook {
  const up = tier >= tuning.villageLook.stepTier;
  switch (building) {
    case 'shrine':
      return { stone: true, stoneBase: false, dormers: false, chimneys: 0 };
    case 'storehouse':
      return { stone: up, stoneBase: false, dormers: false, chimneys: 0 };
    case 'store':
      return { stone: false, stoneBase: false, dormers: up, chimneys: up ? 1 : 0 };
    case 'tavern':
      return { stone: false, stoneBase: up, dormers: up, chimneys: up ? 2 : 1 };
  }
}

/** What a building does at a tier, in a villager's words. */
export function tierGives(building: BuildingId, tier: number): string {
  if (tier < 1) return 'an empty plot, waiting to be built';
  switch (building) {
    case 'shrine':
      return `portals as hard as ${DIFFICULTIES[maxDifficulty(tier)].name}`;
    case 'store':
      return `${storeStock(tier)} items on the shelves each day`;
    case 'storehouse':
      return `${stashSpaces(tier)} spaces to keep things in, and a pocket of ${pocketSpaces(tier)} no wipe can take`;
    case 'tavern': {
      const n = tavernHenchmen(tier);
      const cap = `, up to level ${henchmanCap(tier)}`;
      return tier >= 4 ? `three henchmen, quicker on their feet${cap}` : `${n} ${n === 1 ? 'henchman' : 'henchmen'} for hire${cap}`;
    }
  }
}
