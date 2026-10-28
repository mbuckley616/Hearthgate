import { STYLES, tuning, type AmmoKind, type OffhandKind, type Style, type WeaponFamily } from '../config/tuning';

/**
 * Gear and levels: plain data and pure functions shared by the sim (effects),
 * the saved profile and the UI. Kept minimal for the slice, but slots are a
 * list so helmets/hoods, legs, gloves, boots and ammo can be added later.
 */

/** Slots in play now. Future: 'head' | 'legs' | 'hands' | 'feet' | 'ammo'. */
export type GearSlot = 'sword' | 'bow' | 'staff' | 'body';
export const GEAR_SLOTS: readonly GearSlot[] = ['sword', 'bow', 'staff', 'body'];
export const SLOT_LABELS: Record<GearSlot, string> = { sword: 'Knight weapon', bow: 'Archer weapon', staff: 'Mage weapon', body: 'Armour' };

export type Rarity = 'common' | 'rare';

/** The one stat an item carries (brief: "one stat"). */
export type StatKind = 'damage' | 'poise' | 'maxHp' | 'cooldowns' | 'dodgeRecharge';

/** The perk, if any (brief: "at most one perk tied to combat"). */
export type Perk = 'bleed' | 'chainBolt' | 'dodgeRefund' | 'hunter';

export interface Item {
  /** Unique within a saved profile (assigned when picked up). */
  uid: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  stat: { kind: StatKind; value: number };
  perk: Perk | null;
}

export const PERK_TEXT: Record<Perk, string> = {
  bleed: 'Finishers make enemies bleed',
  chainBolt: 'Bolts chain to a second target',
  dodgeRefund: 'Dodging right after a finisher refunds the dodge',
  hunter: 'Power and piercing shots slow their target',
};

export function statText(stat: Item['stat'], slot: GearSlot): string {
  const pct = `${Math.round(stat.value * 100)}%`;
  switch (stat.kind) {
    case 'damage':
      return `+${pct} ${slot === 'body' ? '' : 'damage'}`.trim();
    case 'poise':
      return `+${pct} stagger damage`;
    case 'maxHp':
      return `+${Math.round(stat.value)} max health`;
    case 'cooldowns':
      return `-${pct} ability cooldowns`;
    case 'dodgeRecharge':
      return `-${pct} dodge recharge time`;
  }
}

/** What equipped gear adds up to; lives on the player in the sim. */
export interface Mods {
  damage: Record<Style, number>;
  poise: Record<Style, number>;
  maxHp: number;
  cooldowns: number;
  dodgeRecharge: number;
  perks: Perk[];
  /**
   * Damage taken is cut by this fraction (T5b: worn armour from the catalogue). Only set when some is
   * worn, so the slice's heroes never carry the field.
   */
  armour?: number;
  /** The off-hand in use (C4): its ability is the third, on 3. Only with a one-handed weapon of its kind. */
  offhand?: OffhandKind;
  /** The arrows in the ammo slot (C4), with a bow in hand. */
  ammo?: AmmoKind;
  /** The weapon family in hand (C5), when it is not its style's first (sword, shortbow, staff). */
  family?: WeaponFamily;
}

export function emptyMods(): Mods {
  return { damage: { sword: 0, bow: 0, staff: 0 }, poise: { sword: 0, bow: 0, staff: 0 }, maxHp: 0, cooldowns: 0, dodgeRecharge: 0, perks: [] };
}

export function computeMods(equipped: (Item | null | undefined)[]): Mods {
  const m = emptyMods();
  for (const item of equipped) {
    if (!item) continue;
    const style = item.slot === 'body' ? null : (item.slot as Style);
    switch (item.stat.kind) {
      case 'damage':
        if (style) m.damage[style] += item.stat.value;
        break;
      case 'poise':
        if (style) m.poise[style] += item.stat.value;
        break;
      case 'maxHp':
        m.maxHp += item.stat.value;
        break;
      case 'cooldowns':
        m.cooldowns += item.stat.value;
        break;
      case 'dodgeRecharge':
        m.dodgeRecharge += item.stat.value;
        break;
    }
    if (item.perk && !m.perks.includes(item.perk)) m.perks.push(item.perk);
  }
  return m;
}

// --- Levels ---

/** Levels carry on past 5 for talent points, up to this (50 since T6). */
export function maxLevel(): number {
  return Math.max(5, Math.round(tuning.progression.maxLevel));
}

/** Cumulative XP per level: the tuned 2-5, then gaps that grow by levelGapGrowthXp. */
let cached: { key: string; t: number[] } | null = null;

function thresholds(): number[] {
  const p = tuning.progression;
  // The sim asks for levels inside every step (rows opening, the dodge recharge); the table only
  // changes when the panel moves one of these numbers.
  const key = `${p.level2Xp},${p.level3Xp},${p.level4Xp},${p.level5Xp},${p.levelGapGrowthXp},${maxLevel()}`;
  if (cached && cached.key === key) return cached.t;
  const t = [0, p.level2Xp, p.level3Xp, p.level4Xp, p.level5Xp];
  let gap = p.level5Xp - p.level4Xp;
  while (t.length < maxLevel()) {
    gap += p.levelGapGrowthXp;
    t.push(t[t.length - 1] + gap);
  }
  cached = { key, t };
  return t;
}

/** XP needed to reach a level. */
export function xpForLevel(level: number): number {
  const t = thresholds();
  return t[Math.max(0, Math.min(t.length, level) - 1)];
}

export function levelFor(xp: number): number {
  const t = thresholds();
  let level = 1;
  for (let i = 1; i < t.length; i++) if (xp >= t[i]) level = i + 1;
  return level;
}

/** 0..1 progress from this level to the next (1 at max level). */
export function levelProgress(xp: number): number {
  const t = thresholds();
  const level = levelFor(xp);
  if (level >= maxLevel()) return 1;
  return Math.min(1, (xp - t[level - 1]) / Math.max(1, t[level] - t[level - 1]));
}

/** What a level unlocks (for toasts and the equip screen), or undefined: only a talent point. */
export function levelUnlock(level: number): string | undefined {
  const p = tuning.progression;
  if (level === 2) return 'Second ability (2)';
  if (level === 3) return 'Combo step 4';
  if (level === 4) return p.level4DamageBonus > 0 ? `Combo step 5 and +${Math.round(p.level4DamageBonus * 100)}% damage` : 'Combo step 5';
  const parts: string[] = [];
  const row = ROW_NAMES[level];
  if (row) parts.push(`Talent row: ${row}`);
  if (level === Math.round(p.glowLevel)) parts.push('Weapon glow');
  if (level === maxLevel()) parts.push('Gold glow');
  return parts.length ? parts.join(' and ') : undefined;
}

/** The milestone rows' names by level (talents.ts has their rules; it imports this file, so not the other way). */
const ROW_NAMES: Record<number, string> = { 10: 'Weight', 20: 'Finisher', 30: 'Riposte', 40: 'Second wind', 50: 'Mastery' };

/** Chain length for a hero at a level: the brief's 3 hits, steps 4 and 5 unlocked at levels 3 and 4. */
export function chainLengthFor(level: number): number {
  return level >= 4 ? 5 : level >= 3 ? 4 : 3;
}

// --- Drops ---

const NAMES: Record<GearSlot, Record<Rarity, string[]>> = {
  sword: { common: ['Arming Sword', 'Soldier’s Blade', 'Falchion'], rare: ['Emberbrand', 'Oathkeeper', 'Wardenbane'] },
  bow: { common: ['Hunting Bow', 'Ash Longbow', 'Recurve'], rare: ['Galeshot', 'Whisperwood', 'Hawkeye Bow'] },
  staff: { common: ['Oak Staff', 'Frostwood Staff', 'Apprentice Rod'], rare: ['Rimecaller', 'Staff of Still Waters', 'Glacier Spire'] },
  body: { common: ['Padded Vest', 'Mail Shirt', 'Traveller’s Coat'], rare: ['Warden’s Plate', 'Duskweave Robe', 'Ranger’s Mantle'] },
};

/** Perks that make sense on each slot. */
const SLOT_PERKS: Record<GearSlot, Perk[]> = {
  sword: ['bleed'],
  bow: ['hunter'],
  staff: ['chainBolt'],
  body: ['dodgeRefund'],
};

/** Roll an item with the sim's RNG (host-authoritative). uid is filled in when it's saved. */
export function rollItem(rand: () => number, forceRare = false): Item {
  const slot = GEAR_SLOTS[Math.floor(rand() * GEAR_SLOTS.length)];
  const rarity: Rarity = forceRare || rand() < tuning.gear.rareChance ? 'rare' : 'common';
  const rare = rarity === 'rare';
  let stat: Item['stat'];
  if (slot === 'body') {
    const kinds: StatKind[] = ['maxHp', 'cooldowns', 'dodgeRecharge'];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const value =
      kind === 'maxHp' ? (rare ? 20 + Math.round(rand() * 10) : 8 + Math.round(rand() * 7)) : rare ? 0.1 + rand() * 0.06 : 0.04 + rand() * 0.04;
    stat = { kind, value: kind === 'maxHp' ? value : Math.round(value * 100) / 100 };
  } else {
    const kind: StatKind = rand() < 0.7 ? 'damage' : 'poise';
    const value = rare ? 0.1 + rand() * 0.06 : 0.04 + rand() * 0.05;
    stat = { kind, value: Math.round(value * 100) / 100 };
  }
  // Rares usually carry a perk; commons never do.
  const perks = SLOT_PERKS[slot];
  const perk = rare && rand() < 0.75 ? perks[Math.floor(rand() * perks.length)] : null;
  const names = NAMES[slot][rarity];
  return { uid: '', name: names[Math.floor(rand() * names.length)], slot, rarity, stat, perk };
}

/** Every style's level, for HUD lists. */
export function allLevels(xp: Record<Style, number>): Record<Style, number> {
  return Object.fromEntries(STYLES.map((s) => [s, levelFor(xp[s])])) as Record<Style, number>;
}
