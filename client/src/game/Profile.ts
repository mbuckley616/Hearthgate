import { tuning, type Style } from '@hearthgate/shared/config/tuning';
import { GEAR_SLOTS, computeMods, type GearSlot, type Item } from '@hearthgate/shared/sim/gear';
import type { Loadout } from '@hearthgate/shared/sim/coop';
import { TALENT_IDS, emptyTalents, maxRanks, pointsEarned, pointsSpent, type TalentId, type TalentRanks } from '@hearthgate/shared/sim/talents';
import type { PlayerState } from '@hearthgate/shared/sim/types';

const STORAGE_KEY = 'combat-slice.profile.v1';

/** What persists between runs (brief: "levels and gear persist in the browser"). */
export interface ProfileData {
  version: 1;
  xp: Record<Style, number>;
  inventory: Item[];
  /** Item uid equipped in each slot. */
  equipped: Partial<Record<GearSlot, string>>;
  /** Talent ranks per hero. */
  talents: Record<Style, TalentRanks>;
  runs: number;
  wins: number;
  /** Shown to other players in co-op. */
  name: string;
}

function fresh(): ProfileData {
  return { version: 1, xp: { sword: 0, bow: 0, staff: 0 }, inventory: [], equipped: {}, talents: emptyTalents(), runs: 0, wins: 0, name: '' };
}

/**
 * The local player's saved progress. Client-side: in co-op each player keeps
 * their own and brings it to the host's sim when they join (M5).
 */
export class Profile {
  data: ProfileData;

  constructor() {
    this.data = Profile.load();
  }

  private static load(): ProfileData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh();
      const parsed = JSON.parse(raw) as ProfileData;
      if (parsed.version !== 1) return fresh();
      return { ...fresh(), ...parsed, xp: { ...fresh().xp, ...parsed.xp }, talents: { ...emptyTalents(), ...parsed.talents } };
    } catch {
      return fresh();
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage can be unavailable (private windows); progress just won't persist.
    }
  }

  reset(): void {
    this.data = fresh();
    this.save();
  }

  equippedItems(): Item[] {
    return GEAR_SLOTS.map((slot) => this.item(this.data.equipped[slot])).filter((i): i is Item => !!i);
  }

  item(uid: string | undefined): Item | undefined {
    return uid ? this.data.inventory.find((i) => i.uid === uid) : undefined;
  }

  /** Keep a found item; it's equipped straight away if its slot is empty. */
  addItem(item: Item): Item {
    const kept = { ...item, uid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
    this.data.inventory.push(kept);
    if (!this.data.equipped[kept.slot]) this.data.equipped[kept.slot] = kept.uid;
    this.save();
    return kept;
  }

  equip(uid: string): void {
    const item = this.item(uid);
    if (!item) return;
    this.data.equipped[item.slot] = uid;
    this.save();
  }

  unequip(slot: GearSlot): void {
    delete this.data.equipped[slot];
    this.save();
  }

  /** Unspent talent points for a hero. */
  pointsLeft(style: Style): number {
    return pointsEarned(this.data.xp[style]) - pointsSpent(this.data.talents[style]);
  }

  /** Spend (+1) or refund (-1) a rank. */
  changeRank(style: Style, id: TalentId, delta: 1 | -1): void {
    const ranks = this.data.talents[style];
    const rank = ranks[id] ?? 0;
    if (delta > 0 && (rank >= maxRanks(id) || this.pointsLeft(style) <= 0)) return;
    if (delta < 0 && rank <= 0) return;
    ranks[id] = rank + delta;
    this.save();
  }

  resetTalents(style: Style): void {
    this.data.talents[style] = {};
    this.save();
  }

  /** What this player brings into a fight (their own, also in co-op): levels, talents, gear and name. */
  loadout(): Loadout {
    const talents = structuredClone(this.data.talents);
    // Ranks past a lowered cap (tuning changes) simply don't count.
    for (const s of Object.keys(talents) as Style[]) for (const id of TALENT_IDS) if ((talents[s][id] ?? 0) > maxRanks(id)) talents[s][id] = maxRanks(id);
    const mods = computeMods(this.equippedItems());
    return { name: this.data.name || 'Player', xp: { ...this.data.xp }, talents, mods, maxHp: tuning.combat.heroMaxHp + mods.maxHp };
  }

  /** Pull XP earned in the sim back into the profile. */
  syncFrom(p: PlayerState): void {
    this.data.xp = { ...p.xp };
  }
}
