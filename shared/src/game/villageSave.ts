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
