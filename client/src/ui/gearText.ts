import { ABILITY_NAMES, OFFHAND_ABILITY, tuning } from '@hearthgate/shared/config/tuning';
import { armourOf, entryOf, isGearItem, itemName, type GearItem } from '@hearthgate/shared/sim/catalogue';
import { PERK_TEXT, statText, type Item } from '@hearthgate/shared/sim/gear';

const KIND_WORDS = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic', none: '' } as const;
const STYLE_WORDS = { sword: 'a sword', bow: 'a bow', staff: 'a staff' } as const;

/** An item's name, from the catalogue or the slice's loot. */
export function nameOf(item: Item | GearItem): string {
  return isGearItem(item) ? itemName(item) : item.name;
}

/** One line of what an item does: its kind and tier, its armour or damage, a rare's bonus and perk. */
export function gearLine(item: Item | GearItem): string {
  if (!isGearItem(item)) return `${statText(item.stat, item.slot)}${item.perk ? ` · ${PERK_TEXT[item.perk]}` : ''}`;
  const e = entryOf(item);
  const parts: string[] = [];
  const kind = KIND_WORDS[e.kind];
  parts.push(`${kind ? `${kind} · ` : ''}tier ${e.tier}`);
  const armour = armourOf(e);
  if (armour > 0) parts.push(`${Math.round(armour * 1000) / 10}% armour`);
  if (e.shape.style) {
    const dmg = (e.tier - 1) * tuning.gear.weaponDamagePerTier;
    parts.push(`fights as ${STYLE_WORDS[e.shape.style]}${dmg > 0 ? `, +${Math.round(dmg * 100)}% damage` : ''}${e.shape.twoHanded ? ', two hands' : ''}`);
  }
  // C4: the off-hand's ability, two hands' bonus, and what arrows do.
  if (e.shape.offhand) parts.push(`${ABILITY_NAMES[OFFHAND_ABILITY[e.shape.offhand]]} on 3, with a one-handed ${KIND_WORDS[e.kind].toLowerCase()} weapon`);
  if (e.shape.twoHanded) parts.push(`+${Math.round(tuning.gear.twoHandDamage * 100)}% damage for two hands`);
  if (e.slot === 'ammo') parts.push(e.material.id === 'frost' ? `with a bow: hits slow for ${tuning.gear.frostArrowSlowS} s` : `with a bow: charged shots bleed`);
  if (e.slot === 'neck') parts.push(`+${e.tier * tuning.gear.amuletHpPerTier} max health`);
  if (e.slot === 'ring') parts.push(`-${Math.round(e.tier * tuning.gear.ringCooldownPerTier * 100)}% ability cooldowns`);
  if (e.slot === 'cape') parts.push(`-${Math.round(e.tier * tuning.gear.capeDodgePerTier * 100)}% dodge recharge`);
  if (item.bonus) parts.push(statText(item.bonus, e.shape.style ?? 'body'));
  if (item.perk) parts.push(PERK_TEXT[item.perk]);
  return parts.join(' · ');
}
