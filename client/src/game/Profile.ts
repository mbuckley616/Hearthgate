import { tuning, type Style } from '@hearthgate/shared/config/tuning';
import {
  BAG_SIZE,
  CATALOGUE,
  STYLE_KIND,
  entryOf,
  fromSliceItem,
  isGearItem,
  starterGear,
  lookOf,
  wornMods,
  wornStyle,
  type BodySlot,
  type GearItem,
  type Worn,
} from '@hearthgate/shared/sim/catalogue';
import { levelFor, type Item } from '@hearthgate/shared/sim/gear';
import type { Loadout } from '@hearthgate/shared/sim/coop';
import { TALENT_IDS, emptyTalents, maxRanks, pointsEarned, pointsSpent, talentLevel, type TalentId, type TalentRanks } from '@hearthgate/shared/sim/talents';
import type { PlayerState } from '@hearthgate/shared/sim/types';
import { emptyVillage, pocketSpaces, readVillageSave, stashSpaces, type VillageSave } from '@hearthgate/shared/game/villageSave';
import {
  CHAMPION_IDS,
  SLOTTED_IDS,
  championMaxRanks,
  championPointsEarned,
  championPointsSpent,
  emptyChampion,
  slotCount,
  slottedUnlocked,
  type ChampionId,
  type ChampionState,
  type SlottedId,
} from '@hearthgate/shared/sim/champion';

const STORAGE_KEY = 'hearthgate.profile.v2';
/** The slice's save, read once and carried into the bag and body (T5b). */
const SLICE_KEY = 'combat-slice.profile.v1';
/** Champion points are the player's, not the hero's (shared across characters, decisions.md 27 Oct), so they keep a key of their own. */
const CHAMPION_KEY = 'hearthgate.champion.v1';
/** The village this browser opens (P1): its lumber and stone until P2 makes it a village save of its own. */
const VILLAGE_KEY = 'hearthgate.village.v1';


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
  /** Earned by banking a floor (P1). */
  coin: number;
  /** Shown to other players in co-op. */
  name: string;
  /** Health potions on the belt (D4): the server's count, saved so the next room starts with them. */
  potions?: number;
  /** Story dungeons cleared (P7), by id: each opens the next at Keeper Wren's. */
  storyCleared?: string[];
  /** Finds carried on this floor (D3), by uid: in the bag or worn, but lost on a wipe until banked. */
  carried?: string[];
}

function emptyBag(): (GearItem | null)[] {
  return Array.from({ length: BAG_SIZE }, () => null);
}

function fresh(): ProfileData {
  const start = starterGear();
  const bag = emptyBag();
  start.bag.forEach((item, i) => (bag[i] = item));
  return { version: 2, xp: { sword: 0, bow: 0, staff: 0 }, bag, worn: start.worn, talents: emptyTalents(), runs: 0, wins: 0, coin: 0, name: '' };
}

/** A village's id: only its own browser knows it, so only that browser keeps what its room sends back. */
function newVillageId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
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
/**
 * Put an item in the first free bag space past the safe pocket (D5): what goes in the pocket is the
 * player's choice, made at Marta's, so a find never lands there by itself.
 */
function placeInBag(bag: (GearItem | null)[], item: GearItem, pocket = 0): boolean {
  const i = bag.findIndex((s, n) => n >= pocket && !s);
  if (i < 0) return false;
  bag[i] = item;
  return true;
}

/** A space in the bag or in Marta's stash (P9). */
export interface Space {
  area: 'bag' | 'stash';
  i: number;
}

/** This browser's own village (P2), with Marta's stash (P9), which only this browser holds until Phase 3. */
export type OwnVillage = VillageSave & { stash?: (GearItem | null)[] };

/**
 * The local player's saved progress. Client-side: in co-op each player keeps their own and brings
 * it to the server's fight when they join (their loadout).
 */
export class Profile {
  data: ProfileData;
  champion: ChampionState;
  /** This browser's own village (P2): sent in the hello when joining one, and what its room sends back. */
  village: OwnVillage;

  constructor() {
    this.data = Profile.load();
    this.champion = Profile.loadChampion();
    this.village = Profile.loadVillage();
  }

  private static loadVillage(): OwnVillage {
    try {
      const v = JSON.parse(localStorage.getItem(VILLAGE_KEY) ?? '{}') as Partial<OwnVillage>;
      const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);
      // P1's save had only lumber and stone; it gains an id and the starting tiers.
      const save = { ...emptyVillage(typeof v.id === 'string' ? v.id : newVillageId()), lumber: n(v.lumber), stone: n(v.stone) };
      const read: OwnVillage = readVillageSave({ ...save, tiers: { ...save.tiers, ...v.tiers } }) ?? save;
      if (Array.isArray(v.stash)) read.stash = v.stash.map((i) => (i && CATALOGUE.has(i.id) ? i : null));
      return read;
    } catch {
      return emptyVillage(newVillageId());
    }
  }

  private static loadChampion(): ChampionState {
    try {
      const raw = localStorage.getItem(CHAMPION_KEY);
      if (!raw) return emptyChampion();
      const parsed = JSON.parse(raw) as ChampionState;
      const ranks: ChampionState['ranks'] = {};
      for (const id of CHAMPION_IDS) if (Number.isFinite(parsed.ranks?.[id])) ranks[id] = parsed.ranks[id];
      const slots = Array.isArray(parsed.slots) ? [...new Set(parsed.slots.filter((id) => SLOTTED_IDS.includes(id)))].slice(0, slotCount()) : [];
      return { xp: Number.isFinite(parsed.xp) ? Math.max(0, parsed.xp) : 0, ranks, slots };
    } catch {
      return emptyChampion();
    }
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
      localStorage.setItem(CHAMPION_KEY, JSON.stringify(this.champion));
      localStorage.setItem(VILLAGE_KEY, JSON.stringify(this.village));
    } catch {
      // Storage can be unavailable (private windows); progress just won't persist.
    }
  }

  reset(): void {
    this.data = fresh();
    this.champion = emptyChampion();
    this.village = emptyVillage(newVillageId());
    this.save();
  }

  /** The style the weapon in hand fights with. */
  get style(): Style {
    return wornStyle(this.data.worn);
  }

  /**
   * Keep a found item in the bag; worn at once if its slot is empty. False if the bag was full (it is
   * left behind). A find picked up on a floor is `carried` (D3): wearable now, lost on a wipe until banked.
   */
  addItem(found: Item | GearItem, carried = false): boolean {
    const item: GearItem = { ...(isGearItem(found) ? found : fromSliceItem(found)), uid: newUid() };
    if (carried) (this.data.carried ??= []).push(item.uid);
    const slot = entryOf(item).slot;
    let kept = true;
    if (!this.data.worn[slot] && slot !== 'weapon') this.data.worn[slot] = item;
    else kept = placeInBag(this.data.bag, item, this.pocketSize());
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
    if (!item || slot === 'weapon' || !placeInBag(this.data.bag, item, this.pocketSize())) return false;
    delete this.data.worn[slot];
    this.save();
    return true;
  }

  /** The bag's safe pocket (D5): its first spaces, by this browser's own Storehouse. */
  pocketSize(): number {
    return pocketSpaces(this.village.tiers.storehouse);
  }

  /** Marta's stash (P9), as many spaces as the Storehouse holds; items past a lower size stay. */
  stash(): (GearItem | null)[] {
    const s = (this.village.stash ??= []);
    while (s.length < stashSpaces(this.village.tiers.storehouse)) s.push(null);
    return s;
  }

  private spaceOf(at: Space): (GearItem | null)[] {
    return at.area === 'bag' ? this.data.bag : this.stash();
  }

  itemIn(at: Space): GearItem | null {
    return this.spaceOf(at)[at.i] ?? null;
  }

  /** Put what is in one space into another, swapping with whatever is there (P9's pick up and put down). */
  swap(a: Space, b: Space): void {
    const from = this.spaceOf(a);
    const to = this.spaceOf(b);
    const held = from[a.i] ?? null;
    from[a.i] = to[b.i] ?? null;
    to[b.i] = held;
    this.save();
  }

  /** Send an item straight to the other side (P9's quick move): the first free space there. False if none. */
  quickMove(at: Space): boolean {
    const item = this.itemIn(at);
    if (!item) return false;
    const to = at.area === 'bag' ? this.stash() : this.data.bag;
    const free = at.area === 'bag' ? to.indexOf(null) : to.findIndex((s, n) => n >= this.pocketSize() && !s);
    if (free < 0) return false;
    to[free] = item;
    this.spaceOf(at)[at.i] = null;
    this.save();
    return true;
  }

  /** Whether this item is a carried find (D3), not yet banked. */
  isCarried(item: GearItem | null | undefined): boolean {
    return !!item && (this.data.carried ?? []).includes(item.uid);
  }

  /** The floor banked (D3): what was carried is the player's for good. */
  bankCarried(): void {
    this.data.carried = [];
    this.save();
  }

  /**
   * A wipe takes every carried find (D3), worn or in the pocket too: wearing one is never a way round
   * the risk (Michael, 28 Oct). A hero left with nothing in hand takes the best weapon left in the bag,
   * or a plain one of their kind. Returns how many went.
   */
  loseCarried(): number {
    const gone = new Set(this.data.carried ?? []);
    if (gone.size === 0) return 0;
    let lost = 0;
    this.data.bag = this.data.bag.map((i) => (i && gone.has(i.uid) ? (lost++, null) : i));
    for (const [slot, item] of Object.entries(this.data.worn) as [BodySlot, GearItem][]) {
      if (!gone.has(item.uid)) continue;
      delete this.data.worn[slot];
      lost++;
    }
    if (!this.data.worn.weapon) {
      const spare = this.data.bag.findIndex((i) => i && entryOf(i).slot === 'weapon');
      if (spare >= 0) this.wear(spare);
      else this.data.worn.weapon = { ...starterGear().worn.weapon!, uid: newUid() };
    }
    this.data.carried = [];
    this.save();
    return lost;
  }

  /** A wipe takes the bag (D5): everything past the safe pocket. Returns how many items went. */
  loseBag(): number {
    let lost = 0;
    for (let i = this.pocketSize(); i < this.data.bag.length; i++) {
      if (!this.data.bag[i]) continue;
      this.data.bag[i] = null;
      lost++;
    }
    this.save();
    return lost;
  }

  /** Take an item out of the bag by its uid (P5: sold to Aldous). False if it is not there. */
  removeByUid(uid: string): boolean {
    const at = this.data.bag.findIndex((i) => i?.uid === uid);
    if (at < 0) return false;
    this.data.bag[at] = null;
    this.save();
    return true;
  }

  /** Take what is in a bag space out of the bag: the hero screen's Drop lays it on the floor (D13). */
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
    if (delta > 0 && (rank >= maxRanks(id) || this.pointsLeft(style) <= 0 || levelFor(this.data.xp[style]) < talentLevel(id))) return;
    if (delta < 0 && rank <= 0) return;
    ranks[id] = rank + delta;
    this.save();
  }

  resetTalents(style: Style): void {
    this.data.talents[style] = {};
    this.save();
  }

  /** Unspent champion points. */
  championLeft(): number {
    return championPointsEarned(this.champion.xp) - championPointsSpent(this.champion.ranks);
  }

  /**
   * Spend (+1) or take back (-1) a champion point. Taking one back costs village.respecCoinPerPoint
   * coin (P5; decisions.md 27 Oct: free until coin came); false if there is not the coin.
   */
  changeChampion(id: ChampionId, delta: 1 | -1): boolean {
    const rank = this.champion.ranks[id] ?? 0;
    if (delta > 0 && (rank >= championMaxRanks(id) || this.championLeft() <= 0)) return false;
    if (delta < 0 && rank <= 0) return false;
    if (delta < 0 && !this.pay(tuning.village.respecCoinPerPoint)) return false;
    this.champion.ranks[id] = rank + delta;
    this.save();
    return true;
  }

  /** Take back every champion point, at the same price a point. False if there is not the coin. */
  resetChampion(): boolean {
    if (!this.pay(championPointsSpent(this.champion.ranks) * tuning.village.respecCoinPerPoint)) return false;
    this.champion.ranks = {};
    this.save();
    return true;
  }

  /** Pay coin from the save, if there is enough. */
  private pay(coin: number): boolean {
    if (this.data.coin < coin) return false;
    this.data.coin -= coin;
    return true;
  }

  /**
   * Slot an open perk into a free slot, or take it out (T6c). A slotted perk whose constellation later
   * loses the points stays slotted and does nothing until they are back, as on the server.
   */
  toggleSlot(id: SlottedId): void {
    const slots = (this.champion.slots ??= []);
    const at = slots.indexOf(id);
    if (at >= 0) slots.splice(at, 1);
    else if (slots.length < slotCount() && slottedUnlocked(this.champion.ranks, id)) slots.push(id);
    else return;
    this.save();
  }

  /** What this player brings into a fight (their own, also in co-op): levels, talents, worn gear and name. */
  loadout(): Loadout {
    const talents = structuredClone(this.data.talents);
    // Ranks past a lowered cap (tuning changes) simply don't count.
    for (const s of Object.keys(talents) as Style[]) for (const id of TALENT_IDS) if ((talents[s][id] ?? 0) > maxRanks(id)) talents[s][id] = maxRanks(id);
    const mods = wornMods(this.data.worn);
    const ranks = { ...this.champion.ranks };
    for (const id of CHAMPION_IDS) if ((ranks[id] ?? 0) > championMaxRanks(id)) ranks[id] = championMaxRanks(id);
    return {
      name: this.data.name || 'Player',
      xp: { ...this.data.xp },
      talents,
      mods,
      maxHp: tuning.combat.heroMaxHp + mods.maxHp,
      look: lookOf(this.data.worn),
      champion: { xp: this.champion.xp, ranks, slots: (this.champion.slots ?? []).slice(0, slotCount()) },
      ...(this.data.potions ? { potions: this.data.potions } : {}),
    };
  }

  /** Pull XP earned in the sim back into the profile. */
  syncFrom(p: PlayerState): void {
    this.data.xp = { ...p.xp };
    if (p.champion) this.champion.xp = p.champion.xp;
    this.data.potions = p.potions ?? 0;
  }
}
