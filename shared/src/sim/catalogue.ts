import { tuning, type AmmoKind, type OffhandKind, type Style } from '../config/tuning';
import { emptyMods, type Item, type Mods, type Perk, type Rarity, type StatKind } from './gear';

/**
 * The item catalogue (T5b, decisions.md 27 Oct: a bag and a body, as RuneScape): every piece of gear
 * is a shape in a slot (a full helm, a platebody, a shortbow) made of a material (bronze, iron,
 * black, leather, linen, ash). The two give its name ("Iron full helm", "Black platebody"), its
 * kind (melee, ranged or magic, or none for capes, necks and rings), its tier and its stats, and
 * T5c draws it on the hero from the same pair. Plain data, read by the sim (drops, mods), the save
 * and the views alike.
 *
 * Until Phase 3's ledger an owned item is a GearItem in the browser's save (rule 3's accepted risk):
 * the catalogue id plus what makes this one different (rarity, a perk, a bonus).
 */

export type BodySlot = 'head' | 'cape' | 'neck' | 'body' | 'legs' | 'hands' | 'feet' | 'ring' | 'shield' | 'weapon' | 'ammo';
/** RuneScape's body, in the order the equip screen lays it out; the ammo slot is RuneScape's eleventh (C4). */
export const BODY_SLOTS: readonly BodySlot[] = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
export const BODY_SLOT_NAMES: Record<BodySlot, string> = {
  head: 'Head',
  cape: 'Cape',
  neck: 'Neck',
  body: 'Body',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
  // The shield slot is the off-hand (C4; Michael, 28 Oct).
  shield: 'Off-hand',
  weapon: 'Weapon',
  ammo: 'Ammo',
};
/** Free spaces in the bag (Michael: 28, as RuneScape). Worn gear takes none. */
export const BAG_SIZE = 28;

export type GearKind = 'melee' | 'ranged' | 'magic' | 'none';
/** The kind of fighting each of the slice's styles is. */
export const STYLE_KIND: Record<Style, GearKind> = { sword: 'melee', bow: 'ranged', staff: 'magic' };

type Family = 'metal' | 'hide' | 'cloth' | 'wood' | 'trinket' | 'dye' | 'fletch';

/** What a piece is made of: its tier, and the colours T5c draws it in. */
export interface Material {
  id: string;
  name: string;
  family: Family;
  tier: number;
  colors: { base: number; trim: number };
}

const FAMILY_KIND: Record<Family, GearKind> = { metal: 'melee', hide: 'ranged', cloth: 'magic', wood: 'none', trinket: 'none', dye: 'none', fletch: 'none' };

export const MATERIALS: readonly Material[] = [
  { id: 'bronze', name: 'Bronze', family: 'metal', tier: 1, colors: { base: 0xb07a3c, trim: 0x6e4a22 } },
  { id: 'iron', name: 'Iron', family: 'metal', tier: 2, colors: { base: 0x8c8f94, trim: 0x4e5156 } },
  { id: 'steel', name: 'Steel', family: 'metal', tier: 3, colors: { base: 0xc6cbd2, trim: 0x7c838c } },
  { id: 'black', name: 'Black', family: 'metal', tier: 4, colors: { base: 0x2b2b30, trim: 0x63636c } },
  { id: 'wardensteel', name: 'Wardensteel', family: 'metal', tier: 5, colors: { base: 0x3a6c78, trim: 0xd8b25a } },
  { id: 'leather', name: 'Leather', family: 'hide', tier: 1, colors: { base: 0x8a5a34, trim: 0x4e321c } },
  { id: 'hardleather', name: 'Hard leather', family: 'hide', tier: 2, colors: { base: 0x6e4526, trim: 0x2f1d10 } },
  { id: 'studded', name: 'Studded', family: 'hide', tier: 3, colors: { base: 0x5c3d24, trim: 0xa8a8a8 } },
  { id: 'wyvernhide', name: 'Wyvernhide', family: 'hide', tier: 4, colors: { base: 0x3f6b3a, trim: 0x1f3a1c } },
  { id: 'stormhide', name: 'Stormhide', family: 'hide', tier: 5, colors: { base: 0x34506e, trim: 0xb8c8e0 } },
  { id: 'linen', name: 'Linen', family: 'cloth', tier: 1, colors: { base: 0xd8ccb0, trim: 0x8a7a5a } },
  { id: 'wool', name: 'Wool', family: 'cloth', tier: 2, colors: { base: 0x6a5a8a, trim: 0x3a2e52 } },
  { id: 'silk', name: 'Silk', family: 'cloth', tier: 3, colors: { base: 0x2f4f9a, trim: 0xd8c070 } },
  { id: 'starweave', name: 'Starweave', family: 'cloth', tier: 4, colors: { base: 0x1c1f4a, trim: 0xe8e0ff } },
  { id: 'duskweave', name: 'Duskweave', family: 'cloth', tier: 5, colors: { base: 0x4a1f5a, trim: 0xff9a3a } },
  { id: 'ash', name: 'Ash', family: 'wood', tier: 1, colors: { base: 0xc8a878, trim: 0x6a5232 } },
  { id: 'oak', name: 'Oak', family: 'wood', tier: 2, colors: { base: 0x9a6e40, trim: 0x4e3418 } },
  { id: 'elm', name: 'Elm', family: 'wood', tier: 3, colors: { base: 0x7a4a2a, trim: 0x3a2010 } },
  { id: 'yew', name: 'Yew', family: 'wood', tier: 4, colors: { base: 0x8a3a24, trim: 0x3a140a } },
  { id: 'heartwood', name: 'Heartwood', family: 'wood', tier: 5, colors: { base: 0x5a1a2a, trim: 0xe8c060 } },
  { id: 'copper', name: 'Copper', family: 'trinket', tier: 1, colors: { base: 0xb8683c, trim: 0x5a3018 } },
  { id: 'silver', name: 'Silver', family: 'trinket', tier: 2, colors: { base: 0xd8dce4, trim: 0x7a8090 } },
  { id: 'gold', name: 'Gold', family: 'trinket', tier: 3, colors: { base: 0xe8b84a, trim: 0x8a5a14 } },
  { id: 'red', name: 'Red', family: 'dye', tier: 1, colors: { base: 0x9a2a2a, trim: 0x4a1010 } },
  { id: 'blue', name: 'Blue', family: 'dye', tier: 1, colors: { base: 0x2a4a9a, trim: 0x10204a } },
  { id: 'green', name: 'Green', family: 'dye', tier: 1, colors: { base: 0x2f6a34, trim: 0x123a16 } },
  { id: 'warden', name: 'Warden’s', family: 'dye', tier: 3, colors: { base: 0x1a1a24, trim: 0xd8b25a } },
  // Arrows for the ammo slot (C4): what they do is in the material (AmmoKind).
  { id: 'frost', name: 'Frost', family: 'fletch', tier: 2, colors: { base: 0x9fd8ff, trim: 0x3a6c9a } },
  { id: 'barbed', name: 'Barbed', family: 'fletch', tier: 2, colors: { base: 0x8a3a24, trim: 0x2a1a10 } },
];

/** A kind of piece in a slot, the materials it comes in, and its share of a tier's armour. */
export interface Shape {
  id: string;
  slot: BodySlot;
  name: string;
  families: readonly Family[];
  /** Melee for a sword, ranged for a bow, magic for a staff; otherwise the material's family decides. */
  kind?: GearKind;
  /** Armour weight (a platebody carries more than gauntlets); 0 for weapons and trinkets. */
  weight: number;
  /** The style a weapon fights with. */
  style?: Style;
  /** Bows and staves take both hands: a shield is slung on the back and does nothing. */
  twoHanded?: boolean;
  /** An off-hand's kind (C4): what its ability on 3 is. */
  offhand?: OffhandKind;
}

export const SHAPES: readonly Shape[] = [
  { id: 'medHelm', slot: 'head', name: 'med helm', families: ['metal'], weight: 0.8 },
  { id: 'fullHelm', slot: 'head', name: 'full helm', families: ['metal'], weight: 1 },
  { id: 'coif', slot: 'head', name: 'coif', families: ['hide'], weight: 1 },
  { id: 'hat', slot: 'head', name: 'hat', families: ['cloth'], weight: 1 },
  { id: 'chainbody', slot: 'body', name: 'chainbody', families: ['metal'], weight: 1.4 },
  { id: 'platebody', slot: 'body', name: 'platebody', families: ['metal'], weight: 2 },
  { id: 'jerkin', slot: 'body', name: 'jerkin', families: ['hide'], weight: 2 },
  { id: 'robeTop', slot: 'body', name: 'robe top', families: ['cloth'], weight: 2 },
  { id: 'platelegs', slot: 'legs', name: 'platelegs', families: ['metal'], weight: 1.5 },
  { id: 'plateskirt', slot: 'legs', name: 'plateskirt', families: ['metal'], weight: 1.5 },
  { id: 'chaps', slot: 'legs', name: 'chaps', families: ['hide'], weight: 1.5 },
  { id: 'robeSkirt', slot: 'legs', name: 'robe skirt', families: ['cloth'], weight: 1.5 },
  { id: 'gauntlets', slot: 'hands', name: 'gauntlets', families: ['metal'], weight: 0.6 },
  { id: 'vambraces', slot: 'hands', name: 'vambraces', families: ['hide'], weight: 0.6 },
  { id: 'gloves', slot: 'hands', name: 'gloves', families: ['cloth'], weight: 0.6 },
  { id: 'boots', slot: 'feet', name: 'boots', families: ['metal', 'hide', 'cloth'], weight: 0.6 },
  { id: 'squareShield', slot: 'shield', name: 'square shield', families: ['metal'], weight: 1, offhand: 'shield' },
  { id: 'kiteshield', slot: 'shield', name: 'kiteshield', families: ['metal'], weight: 1.2, offhand: 'shield' },
  // Arrows count for no kind: worn with a sword they do nothing, and cost nothing.
  { id: 'arrows', slot: 'ammo', name: 'arrows', families: ['fletch'], weight: 0, kind: 'none' },
  { id: 'cape', slot: 'cape', name: 'cape', families: ['dye'], weight: 0 },
  { id: 'amulet', slot: 'neck', name: 'amulet', families: ['trinket'], weight: 0 },
  { id: 'ring', slot: 'ring', name: 'ring', families: ['trinket'], weight: 0 },
  { id: 'sword', slot: 'weapon', name: 'sword', families: ['metal'], weight: 0, kind: 'melee', style: 'sword' },
  { id: 'shortbow', slot: 'weapon', name: 'shortbow', families: ['wood'], weight: 0, kind: 'ranged', style: 'bow', twoHanded: true },
  { id: 'staff', slot: 'weapon', name: 'staff', families: ['wood'], weight: 0, kind: 'magic', style: 'staff', twoHanded: true },
];

/** One kind of item: what an id in the catalogue stands for. */
export interface CatalogueEntry {
  id: string;
  name: string;
  slot: BodySlot;
  kind: GearKind;
  tier: number;
  material: Material;
  shape: Shape;
}

function entryFor(material: Material, shape: Shape): CatalogueEntry {
  const name = `${material.name} ${shape.name}`;
  return {
    id: `${material.id}-${shape.id}`,
    name: name[0].toUpperCase() + name.slice(1),
    slot: shape.slot,
    kind: shape.kind ?? FAMILY_KIND[material.family],
    tier: material.tier,
    material,
    shape,
  };
}

/** Every item there is, by id. */
export const CATALOGUE: ReadonlyMap<string, CatalogueEntry> = new Map(
  SHAPES.flatMap((shape) => MATERIALS.filter((m) => shape.families.includes(m.family)).map((m) => entryFor(m, shape))).map((e) => [e.id, e]),
);

/** An item someone owns: which catalogue item, and what makes this one different. */
export interface GearItem {
  /** Unique within a saved profile (given when it is kept). */
  uid: string;
  id: string;
  rarity: Rarity;
  perk: Perk | null;
  /** A rare's extra stat, as the slice's items had one. */
  bonus: { kind: StatKind; value: number } | null;
  /** A rare carried over from the slice's loot keeps its name (Emberbrand, Warden's Plate). */
  name?: string;
}

export function isGearItem(item: Item | GearItem): item is GearItem {
  return 'id' in item;
}

export function entryOf(item: GearItem): CatalogueEntry {
  return CATALOGUE.get(item.id) ?? CATALOGUE.get('bronze-sword')!;
}

export function itemName(item: GearItem): string {
  return item.name ?? entryOf(item).name;
}

/** Armour a piece gives: its tier times its shape's weight, less for hide and cloth than metal. */
export function armourOf(entry: CatalogueEntry): number {
  const g = tuning.gear;
  const kindFactor = entry.kind === 'melee' ? 1 : entry.kind === 'ranged' ? g.hideArmourFactor : entry.kind === 'magic' ? g.clothArmourFactor : 0;
  return entry.tier * entry.shape.weight * g.armourPerTierWeight * kindFactor;
}

/** Worn gear, by slot. */
export type Worn = Partial<Record<BodySlot, GearItem>>;

/** What the hero wears as every player draws it (T5c): the worn catalogue ids, in the body's order. */
export function lookOf(worn: Worn): string[] {
  return BODY_SLOTS.flatMap((slot) => (worn[slot] ? [worn[slot]!.id] : []));
}

/** The worn pieces a look names, by slot (unknown ids are skipped). */
export function lookSlots(look: readonly string[]): Partial<Record<BodySlot, CatalogueEntry>> {
  const out: Partial<Record<BodySlot, CatalogueEntry>> = {};
  for (const id of look) {
    const e = CATALOGUE.get(id);
    if (e) out[e.slot] = e;
  }
  return out;
}

/** The style the weapon in hand fights with (the sword, with nothing in hand). */
export function wornStyle(worn: Worn): Style {
  return worn.weapon ? (entryOf(worn.weapon).shape.style ?? 'sword') : 'sword';
}

/**
 * What worn gear adds up to on the hero (the slice's Mods). Damage is per style, so armour of
 * another kind than a style costs that style mismatchDamagePerPiece a piece (Michael: per piece,
 * 5%); the weapon's tier and bonus count for its own style. A shield does nothing while a bow or
 * staff is in hand.
 */
export function wornMods(worn: Worn): Mods {
  const g = tuning.gear;
  const m = emptyMods();
  const weapon = worn.weapon ? entryOf(worn.weapon) : null;
  const twoHanded = !!weapon?.shape.twoHanded;
  let armour = 0;
  const kinds: GearKind[] = [];
  for (const slot of BODY_SLOTS) {
    const item = worn[slot];
    if (!item) continue;
    const e = entryOf(item);
    if (slot === 'shield' && twoHanded) continue;
    if (slot !== 'weapon') {
      armour += armourOf(e);
      if (e.kind !== 'none') kinds.push(e.kind);
    }
    if (slot === 'neck') m.maxHp += e.tier * g.amuletHpPerTier;
    if (slot === 'ring') m.cooldowns += e.tier * g.ringCooldownPerTier;
    if (slot === 'cape') m.dodgeRecharge += e.tier * g.capeDodgePerTier;
    const style = e.shape.style;
    if (style) m.damage[style] += (e.tier - 1) * g.weaponDamagePerTier;
    const b = item.bonus;
    if (b) {
      if (b.kind === 'damage' && style) m.damage[style] += b.value;
      else if (b.kind === 'poise' && style) m.poise[style] += b.value;
      else if (b.kind === 'maxHp') m.maxHp += b.value;
      else if (b.kind === 'cooldowns') m.cooldowns += b.value;
      else if (b.kind === 'dodgeRecharge') m.dodgeRecharge += b.value;
    }
    if (item.perk && !m.perks.includes(item.perk)) m.perks.push(item.perk);
  }
  for (const s of ['sword', 'bow', 'staff'] as Style[]) {
    const wrong = kinds.filter((k) => k !== STYLE_KIND[s]).length;
    m.damage[s] -= wrong * g.mismatchDamagePerPiece;
  }
  // Off-hand and two hands (C4): a one-handed weapon takes an off-hand of its kind, whose ability is the
  // third; a two-handed one takes none and hits harder for it.
  const style = weapon?.shape.style;
  if (weapon && style && twoHanded) m.damage[style] += g.twoHandDamage;
  const off = worn.shield ? entryOf(worn.shield) : null;
  if (weapon && !twoHanded && off?.shape.offhand && off.kind === weapon.kind) m.offhand = off.shape.offhand;
  const ammo = worn.ammo ? entryOf(worn.ammo) : null;
  if (ammo && style === 'bow') m.ammo = ammo.material.id as AmmoKind;
  // Only set when worn: a hero in the slice's gear (or none) never carries the field.
  if (armour > 0) m.armour = Math.min(g.armourCap, Math.round(armour * 1000) / 1000);
  return m;
}

const PERKS_FOR: Record<GearKind, Perk[]> = { melee: ['bleed'], ranged: ['hunter'], magic: ['chainBolt'], none: ['dodgeRefund'] };

/**
 * A drop from the catalogue (behind gear.catalogue; the parity test keeps the slice's loot). Any
 * slot; a common of tier 1 to 3, a rare of 3 up with a bonus and usually a perk.
 */
export function rollGear(rand: () => number, forceRare = false, rareMult = 1): GearItem {
  const rarity: Rarity = forceRare || rand() < tuning.gear.rareChance * rareMult ? 'rare' : 'common';
  const rare = rarity === 'rare';
  const entries = [...CATALOGUE.values()].filter((e) => (rare ? e.tier >= 3 : e.tier <= 3));
  const entry = entries[Math.floor(rand() * entries.length)];
  let bonus: GearItem['bonus'] = null;
  if (rare) {
    const kinds: StatKind[] = entry.shape.style ? ['damage', 'poise'] : ['maxHp', 'cooldowns', 'dodgeRecharge'];
    const kind = kinds[Math.floor(rand() * kinds.length)];
    bonus = { kind, value: kind === 'maxHp' ? 10 + Math.round(rand() * 10) : Math.round((0.05 + rand() * 0.06) * 100) / 100 };
  }
  const perks = PERKS_FOR[entry.kind];
  const perk = rare && rand() < 0.6 ? perks[Math.floor(rand() * perks.length)] : null;
  return { uid: '', id: entry.id, rarity, perk, bonus };
}

/** A slice item (an old save, or loot rolled with the catalogue off) as a catalogue item, keeping its name, stat and perk. */
export function fromSliceItem(item: Item): GearItem {
  const rare = item.rarity === 'rare';
  const id =
    item.slot === 'sword'
      ? rare ? 'steel-sword' : 'bronze-sword'
      : item.slot === 'bow'
        ? rare ? 'elm-shortbow' : 'ash-shortbow'
        : item.slot === 'staff'
          ? rare ? 'elm-staff' : 'ash-staff'
          : /robe/i.test(item.name)
            ? rare ? 'silk-robeTop' : 'linen-robeTop'
            : /mantle|coat/i.test(item.name)
              ? rare ? 'studded-jerkin' : 'leather-jerkin'
              : rare ? 'steel-platebody' : 'iron-chainbody';
  return { uid: item.uid, id, rarity: item.rarity, perk: item.perk, bonus: { kind: item.stat.kind, value: item.stat.value }, name: item.name };
}

/** A new hero's gear: a plain weapon of each kind, the sword in hand, no armour. */
export function starterGear(): { worn: Worn; bag: GearItem[] } {
  const plain = (id: string, n: number): GearItem => ({ uid: `starter-${n}`, id, rarity: 'common', perk: null, bonus: null });
  return { worn: { weapon: plain('bronze-sword', 1) }, bag: [plain('ash-shortbow', 2), plain('ash-staff', 3)] };
}
