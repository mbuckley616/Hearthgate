import { GEAR } from "./sim";

/**
 * Gear and weapon definitions, lifted from The Old Gates (`docs/reference/old-gates/14-items.js`,
 * snapshot a129d39) and re-tuned for tier caps (design doc, "Layer 2: gear (tier-capped)").
 *
 * Kept from The Old Gates: the ten materials, the weapon and armour types with their attack and
 * defence multipliers, the two-hander fields (cleave targets, posture, block), the per-tier
 * attack, defence and shield-block curves, and the weapon enchants that make sense without
 * mana or stamina. Left behind: weight and encumbrance, attribute requirements, prices and
 * drop weights (the economy is Phase 3), icons and colours beyond the material's blade.
 *
 * A piece of gear is a plain description (`Gear`): what it is, not what it does. Its numbers
 * are always derived here for the portal it is used in, so a tier cap can never be forgotten
 * by a caller holding stale stats. Nothing in this file creates, moves or destroys an item
 * (CLAUDE.md rule 3: that is the Phase 3 ledger's job); it only says what one is worth.
 *
 * The Old Gates rolls a weapon's damage in its range on every hit; Hearthgate's hits are
 * fixed (no RNG in the swing), so a weapon at or under the cap hits for the middle of its
 * range, and one held back by the cap hits for the top of the capped tier's range: a strong
 * weapon of that tier, never the next tier's.
 */

/** Combat style comes from the weapon (design doc, "Combat triangle"). */
export type Style = "melee" | "ranged" | "magic";
export type DamageType = "slash" | "pierce" | "blunt";

export interface Material {
  tier: number;
  name: string;
  /** Blade or body colour; the renderer will tint weapons with it. */
  color: number;
  /** Light from tier 5 up (the "magical" tiers), null below. */
  glow: number | null;
}

/** The Old Gates' ten material tiers, unchanged. */
export const MATERIALS: readonly Material[] = [
  { tier: 1, name: "Wooden", color: 0x8b5e3c, glow: null },
  { tier: 2, name: "Bronze", color: 0xcd7f32, glow: null },
  { tier: 3, name: "Iron", color: 0xa8b0b8, glow: null },
  { tier: 4, name: "Steel", color: 0xdde8ec, glow: null },
  { tier: 5, name: "Mithril", color: 0x3a5da8, glow: 0x4466cc },
  { tier: 6, name: "Adamant", color: 0x2d6a2d, glow: 0x33aa33 },
  { tier: 7, name: "Obsidian", color: 0x1a1a1a, glow: 0x440088 },
  { tier: 8, name: "Draconic", color: 0xcc2200, glow: 0xff4400 },
  { tier: 9, name: "Demonic", color: 0x8800cc, glow: 0xcc00ff },
  { tier: 10, name: "Cosmic", color: 0x88eeff, glow: 0x00ddff }
];
export const MAX_MATERIAL_TIER = MATERIALS.length;

/** Base attack per material tier before the weapon's multiplier (index = tier). The Old Gates' v56 curve, ~1.29x a tier. */
export const TIER_BASE_ATK: readonly number[] = [0, 8, 10, 13, 17, 22, 28, 36, 47, 61, 80];
/** Base defence per material tier before the armour's multiplier (index = tier). */
export const TIER_BASE_DEF: readonly number[] = [0, 1, 2, 3, 5, 7, 10, 14, 19, 25, 32];
/** Shield block fraction per material tier (index = tier). */
export const TIER_BLOCK: readonly number[] = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.68, 0.75, 0.82, 0.88, 0.94];

export interface WeaponType {
  name: string;
  style: Style;
  damageType: DamageType;
  /** Attack range as a multiple of the tier's base attack. */
  atkMult: readonly [number, number];
  twoHand: boolean;
  /** Enemies one swing can hit (The Old Gates' cleave cap); 1 for one-handers. */
  cleaveTargets: number;
  /** Multiplier on the posture damage a hit deals (posture item). */
  postureMult: number;
  /** Damage a held block takes off with this weapon (posture item); The Old Gates' bare and one-handed block is 0.35. */
  blockReduce: number;
}

const ONE_HAND = { twoHand: false, cleaveTargets: 1, postureMult: 1, blockReduce: 0.35 } as const;

/**
 * The Old Gates' weapon types. Every melee weapon is Melee, the bow is Ranged; the staff
 * (Magic) is not in The Old Gates and arrives with the weapon classes item.
 */
export const WEAPON_TYPES = {
  dagger: { name: "Dagger", style: "melee", damageType: "pierce", atkMult: [0.55, 0.7], ...ONE_HAND },
  sword: { name: "Sword", style: "melee", damageType: "slash", atkMult: [0.75, 0.9], ...ONE_HAND },
  longsword: { name: "Longsword", style: "melee", damageType: "slash", atkMult: [0.85, 1.05], ...ONE_HAND },
  scimitar: { name: "Scimitar", style: "melee", damageType: "slash", atkMult: [0.8, 0.95], ...ONE_HAND },
  mace: { name: "Mace", style: "melee", damageType: "blunt", atkMult: [0.9, 1.15], ...ONE_HAND },
  flail: { name: "Flail", style: "melee", damageType: "blunt", atkMult: [0.95, 1.25], ...ONE_HAND },
  // The bow's multiplier is half the story in The Old Gates (the arrow adds the rest);
  // the weapon classes item decides whether Hearthgate keeps arrows at all.
  bow: { name: "Bow", style: "ranged", damageType: "pierce", atkMult: [0.6, 0.8], twoHand: true, cleaveTargets: 1, postureMult: 1, blockReduce: 0.35 },
  greatClub: { name: "Great Club", style: "melee", damageType: "blunt", atkMult: [0.55, 0.75], twoHand: true, cleaveTargets: 1, postureMult: 1.5, blockReduce: 0.4 },
  claymore: { name: "Claymore", style: "melee", damageType: "slash", atkMult: [1.4, 1.7], twoHand: true, cleaveTargets: 3, postureMult: 1.75, blockReduce: 0.5 },
  greatAxe: { name: "Great Axe", style: "melee", damageType: "slash", atkMult: [1.5, 1.85], twoHand: true, cleaveTargets: 2, postureMult: 1.75, blockReduce: 0.5 },
  warHammer: { name: "War Hammer", style: "melee", damageType: "blunt", atkMult: [1.65, 2.0], twoHand: true, cleaveTargets: 1, postureMult: 2.25, blockReduce: 0.5 }
} as const satisfies Record<string, WeaponType>;
export type WeaponTypeId = keyof typeof WEAPON_TYPES;

export type ArmorSlot = "head" | "chest" | "hands" | "legs" | "feet" | "offhand" | "ring" | "amulet";

export interface ArmorType {
  name: string;
  slot: ArmorSlot;
  /** Defence as a multiple of the tier's base defence. */
  defMult: number;
  /** Shields block a fraction of a hit (TIER_BLOCK); everything else only has defence. */
  shield: boolean;
}

/** The Old Gates' armour types. */
export const ARMOR_TYPES = {
  helmet: { name: "Helmet", slot: "head", defMult: 0.8, shield: false },
  amulet: { name: "Amulet", slot: "amulet", defMult: 0.3, shield: false },
  cuirass: { name: "Cuirass", slot: "chest", defMult: 2.0, shield: false },
  buckler: { name: "Buckler", slot: "offhand", defMult: 1.0, shield: true },
  ring: { name: "Ring", slot: "ring", defMult: 0.15, shield: false },
  gauntlets: { name: "Gauntlets", slot: "hands", defMult: 0.6, shield: false },
  greaves: { name: "Greaves", slot: "legs", defMult: 0.9, shield: false },
  boots: { name: "Boots", slot: "feet", defMult: 0.5, shield: false }
} as const satisfies Record<string, ArmorType>;
export type ArmorTypeId = keyof typeof ARMOR_TYPES;

export interface WeaponEnchant {
  name: string;
  /** Extra damage as a fraction of the hit (fire, frost, shock). */
  extraFrac: number;
  /** Health back to the wielder as a fraction of the hit (life drain). */
  healFrac: number;
}

/**
 * The Old Gates' weapon enchants that need no mana or stamina (Fatigue and Soul Tap stay
 * behind). An enchant is the gear's "special effect" and survives the tier cap untouched
 * (design doc). Tying fire to Burning and frost to Chilled is for the abilities to decide.
 */
export const WEAPON_ENCHANTS = {
  fire: { name: "of Flames", extraFrac: 0.25, healFrac: 0 },
  frost: { name: "of Frost", extraFrac: 0.2, healFrac: 0 },
  shock: { name: "of Shock", extraFrac: 0.22, healFrac: 0 },
  drain: { name: "of Life Drain", extraFrac: 0, healFrac: 0.2 }
} as const satisfies Record<string, WeaponEnchant>;
export type WeaponEnchantId = keyof typeof WEAPON_ENCHANTS;

/** What a piece of gear is. Its numbers come from `weaponStats` and `armorStats` for a portal tier. */
export type Gear =
  | { kind: "weapon"; type: WeaponTypeId; tier: number; enchant?: WeaponEnchantId }
  | { kind: "armor"; type: ArmorTypeId; tier: number };

export type WeaponGear = Extract<Gear, { kind: "weapon" }>;
export type ArmorGear = Extract<Gear, { kind: "armor" }>;

/** The starter weapon: hits for today's PLAYER.attackDamage (see GEAR.damageScale). */
export const STARTER_WEAPON: WeaponGear = { kind: "weapon", type: "sword", tier: 1 };

/**
 * What a player may pick before joining (Michael, A, 2026-10-05): every weapon type at any
 * material tier, a stand-in for the Phase 2 loadout. The portal's cap still decides what
 * the tier is worth, so a Cosmic Claymore in a tier-1 portal hits like a Bronze one's best.
 */
export const PICKABLE_WEAPONS = Object.keys(WEAPON_TYPES) as readonly WeaponTypeId[];

/**
 * The weapon a join asks for, checked: an unknown type is the starter sword, a tier is
 * clamped to the materials that exist. Join options come from the client, so anything
 * may arrive here; the server never trusts more than a type name and a number.
 */
export function weaponFromPick(type: unknown, tier: unknown): WeaponGear {
  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(WEAPON_TYPES, type)) return { ...STARTER_WEAPON };
  const t = typeof tier === "number" ? tier : typeof tier === "string" ? Number(tier) : NaN;
  return { kind: "weapon", type: type as WeaponTypeId, tier: Number.isFinite(t) ? clampTier(t) : 1 };
}

/** Which swing a weapon uses (WEAPON_CLASSES in sim.ts). */
export function weaponClassOf(g: WeaponGear): "oneHand" | "twoHand" | "bow" {
  const t = WEAPON_TYPES[g.type];
  if (t.style === "ranged") return "bow";
  return t.twoHand ? "twoHand" : "oneHand";
}

function clampTier(tier: number): number {
  return Math.min(MAX_MATERIAL_TIER, Math.max(1, Math.floor(tier)));
}

/** The highest material tier a portal of this tier lets gear perform at. */
export function tierCap(portalTier: number): number {
  return clampTier(Math.max(1, Math.floor(portalTier)) * GEAR.materialsPerPortalTier);
}

/** The material tier gear performs at in a portal, and whether the cap held it back. */
export function effectiveTier(gearTier: number, portalTier: number): { tier: number; capped: boolean } {
  const own = clampTier(gearTier);
  const cap = tierCap(portalTier);
  return own > cap ? { tier: cap, capped: true } : { tier: own, capped: false };
}

export function materialOf(tier: number): Material {
  return MATERIALS[clampTier(tier) - 1];
}

/** "Mithril Claymore of Flames". */
export function gearName(g: Gear): string {
  const material = materialOf(g.tier).name;
  if (g.kind === "armor") return `${material} ${ARMOR_TYPES[g.type].name}`;
  const base = `${material} ${WEAPON_TYPES[g.type].name}`;
  return g.enchant ? `${base} ${WEAPON_ENCHANTS[g.enchant].name}` : base;
}

export interface WeaponStats {
  /** Hearthgate damage of one hit, before states and combos. */
  damage: number;
  tier: number;
  capped: boolean;
  style: Style;
  damageType: DamageType;
  twoHand: boolean;
  cleaveTargets: number;
  postureMult: number;
  blockReduce: number;
  enchant: WeaponEnchant | null;
}

/** A weapon's numbers in a portal of `portalTier`. Pure: same gear and tier, same answer. */
export function weaponStats(g: WeaponGear, portalTier: number): WeaponStats {
  const t = WEAPON_TYPES[g.type];
  const { tier, capped } = effectiveTier(g.tier, portalTier);
  const [lo, hi] = t.atkMult;
  const mult = capped ? hi : (lo + hi) / 2;
  return {
    damage: Math.round(TIER_BASE_ATK[tier] * mult * GEAR.damageScale),
    tier,
    capped,
    style: t.style,
    damageType: t.damageType,
    twoHand: t.twoHand,
    cleaveTargets: t.cleaveTargets,
    postureMult: t.postureMult,
    blockReduce: t.blockReduce,
    enchant: g.enchant ? WEAPON_ENCHANTS[g.enchant] : null
  };
}

export interface ArmorStats {
  /** Flat defence, The Old Gates' scale (nothing subtracts it yet). */
  def: number;
  /** Shields only: the fraction of a blocked hit they stop; 0 otherwise. */
  block: number;
  tier: number;
  capped: boolean;
  slot: ArmorSlot;
}

/** An armour piece's numbers in a portal of `portalTier`. */
export function armorStats(g: ArmorGear, portalTier: number): ArmorStats {
  const t = ARMOR_TYPES[g.type];
  const { tier, capped } = effectiveTier(g.tier, portalTier);
  return {
    def: Math.max(1, Math.round(TIER_BASE_DEF[tier] * t.defMult)),
    block: t.shield ? TIER_BLOCK[tier] : 0,
    tier,
    capped,
    slot: t.slot
  };
}
