import { tuning, type Style } from '@hearthgate/shared/config/tuning';
import {
  BAG_SIZE,
  CATALOGUE,
  STYLE_KIND,
  entryOf,
  fromSliceItem,
  isGearItem,
  starterGear,
  wornMods,
  wornStyle,
  type BodySlot,
  type GearItem,
  type Worn,
} from '@hearthgate/shared/sim/catalogue';
import type { Item } from '@hearthgate/shared/sim/gear';
import type { Loadout } from '@hearthgate/shared/sim/coop';
import { TALENT_IDS, emptyTalents, maxRanks, pointsEarned, pointsSpent, type TalentId, type TalentRanks } from '@hearthgate/shared/sim/talents';
import type { PlayerState } from '@hearthgate/shared/sim/types';

const STORAGE_KEY = 'hearthgate.profile.v2';
/** The slice's save, read once and carried into the bag and body (T5b). */
const SLICE_KEY = 'combat-slice.profile.v1';

/**
 * What persists between runs (brief: "levels and gear persist in the browser"; T5b: a 28-space bag
 * and RuneScape's body, decisions.md 27 Oct). Items stay here until Phase 3's ledger (rule 3's
 * accepted risk).
 */
export interface ProfileData {
  version: 2;
  xp: Record<Style, number>;
  /** BAG_SIZE spaces, each an item or empty. */
  bag: (GearItem | null)[];
  worn: Worn;
  /** Talent ranks per weapon kind (the slice's heroes became styles). */
  talents: Record<Style, TalentRanks>;
  runs: number;
  wins: number;
  /** Shown to other players in co-op. */
  name: string;
}

function emptyBag(): (GearItem | null)[] {
  return Array.from({ length: BAG_SIZE }, () => null);
}

function fresh(): ProfileData {
  const start = starterGear();
  const bag = emptyBag();
  start.bag.forEach((item, i) => (bag[i] = item));
  return { version: 2, xp: { sword: 0, bow: 0, staff: 0 }, bag, worn: start.worn, talents: emptyTalents(), runs: 0, wins: 0, name: '' };
}

function newUid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A slice save (v1: four slots and a list of finds) as a bag and a body; its levels, talents, runs and name carry over. */
function fromSliceSave(raw: string): ProfileData | null {
  try {
    const v1 = JSON.parse(raw) as { version: number; xp: Record<Style, number>; inventory: Item[]; equipped: Record<string, string>; talents: Record<Style, TalentRanks>; runs: number; wins: number; name: string };
    if (v1.version !== 1) return null;
    const out = fresh();
    out.xp = { ...out.xp, ...v1.xp };
    out.talents = { ...emptyTalents(), ...v1.talents };
    out.runs = v1.runs ?? 0;
    out.wins = v1.wins ?? 0;
    out.name = v1.name ?? '';
    const worn = new Set([v1.equipped?.sword, v1.equipped?.body]);
    for (const item of v1.inventory ?? []) {
      const g = fromSliceItem(item);
      if (worn.has(item.uid)) {
        const slot = entryOf(g).slot;
        const old = out.worn[slot];
        out.worn[slot] = g;
        if (old) placeInBag(out.bag, old);
      } else placeInBag(out.bag, g);
    }
    return out;
  } catch {
    return null;
  }
}

/** Put an item in the first free space; false if the bag is full. */
function placeInBag(bag: (GearItem | null)[], item: GearItem): boolean {
  const i = bag.indexOf(null);
  if (i < 0) return false;
  bag[i] = item;
  return true;
}

/**
 * The local player's saved progress. Client-side: in co-op each player keeps their own and brings
 * it to the server's fight when they join (their loadout).
 */
export class Profile {
  data: ProfileData;

  constructor() {
    this.data = Profile.load();
  }

  private static load(): ProfileData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const old = localStorage.getItem(SLICE_KEY);
        return (old && fromSliceSave(old)) || fresh();
      }
      const parsed = JSON.parse(raw) as ProfileData;
      if (parsed.version !== 2) return fresh();
      const known = (i: GearItem | null | undefined) => (i && CATALOGUE.has(i.id) ? i : null);
      const bag = emptyBag();
      (parsed.bag ?? []).slice(0, BAG_SIZE).forEach((i, n) => (bag[n] = known(i)));
      const worn: Worn = {};
      for (const [slot, item] of Object.entries(parsed.worn ?? {})) if (known(item)) worn[slot as BodySlot] = item;
      return { ...fresh(), ...parsed, bag, worn, xp: { ...fresh().xp, ...parsed.xp }, talents: { ...emptyTalents(), ...parsed.talents } };
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

  /** The style the weapon in hand fights with. */
  get style(): Style {
    return wornStyle(this.data.worn);
  }

  /** Keep a found item in the bag; worn at once if its slot is empty. False if the bag was full (it is left behind). */
  addItem(found: Item | GearItem): boolean {
    const item: GearItem = { ...(isGearItem(found) ? found : fromSliceItem(found)), uid: newUid() };
    const slot = entryOf(item).slot;
    let kept = true;
    if (!this.data.worn[slot] && slot !== 'weapon') this.data.worn[slot] = item;
    else kept = placeInBag(this.data.bag, item);
    this.save();
    return kept;
  }

  /** Wear the item in this bag space; what was worn there goes into its place. */
  wear(space: number): void {
    const item = this.data.bag[space];
    if (!item) return;
    const slot = entryOf(item).slot;
    this.data.bag[space] = this.data.worn[slot] ?? null;
    this.data.worn[slot] = item;
    this.save();
  }

  /** Take off a worn piece into the bag (not if the bag is full). The weapon stays: a hero always has one in hand. */
  takeOff(slot: BodySlot): boolean {
    const item = this.data.worn[slot];
    if (!item || slot === 'weapon' || !placeInBag(this.data.bag, item)) return false;
    delete this.data.worn[slot];
    this.save();
    return true;
  }

  /** Throw away what is in a bag space (the editor of a full bag). */
  drop(space: number): void {
    this.data.bag[space] = null;
    this.save();
  }

  /**
   * Take the best weapon of a style from the bag into the hand (1, 2, 3 and the wheel): the
   * highest tier, a rare before a common. False if none is carried or it is already in hand.
   */
  readyWeapon(style: Style): boolean {
    if (this.style === style) return false;
    let best = -1;
    let score = -1;
    this.data.bag.forEach((item, i) => {
      if (!item) return;
      const e = entryOf(item);
      if (e.shape.style !== style) return;
      const s = e.tier * 2 + (item.rarity === 'rare' ? 1 : 0);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best < 0) return false;
    this.wear(best);
    return true;
  }

  /** Styles a weapon is carried for, in hand or in the bag. */
  carriedStyles(): Style[] {
    const styles = new Set<Style>([this.style]);
    for (const item of this.data.bag) {
      const style = item && entryOf(item).shape.style;
      if (style) styles.add(style);
    }
    return (['sword', 'bow', 'staff'] as Style[]).filter((s) => styles.has(s));
  }

  /** Worn armour pieces of another kind than the weapon in hand (each costs gear.mismatchDamagePerPiece). */
  mismatched(): number {
    const kind = STYLE_KIND[this.style];
    return Object.entries(this.data.worn).filter(([slot, item]) => slot !== 'weapon' && item && entryOf(item).kind !== 'none' && entryOf(item).kind !== kind).length;
  }

  /** Unspent talent points for a style. */
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

  /** What this player brings into a fight (their own, also in co-op): levels, talents, worn gear and name. */
  loadout(): Loadout {
    const talents = structuredClone(this.data.talents);
    // Ranks past a lowered cap (tuning changes) simply don't count.
    for (const s of Object.keys(talents) as Style[]) for (const id of TALENT_IDS) if ((talents[s][id] ?? 0) > maxRanks(id)) talents[s][id] = maxRanks(id);
    const mods = wornMods(this.data.worn);
    return { name: this.data.name || 'Player', xp: { ...this.data.xp }, talents, mods, maxHp: tuning.combat.heroMaxHp + mods.maxHp };
  }

  /** Pull XP earned in the sim back into the profile. */
  syncFrom(p: PlayerState): void {
    this.data.xp = { ...p.xp };
  }
}
