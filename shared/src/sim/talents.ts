import { ABILITIES, ABILITY_NAMES, comboHit, tuning, type AbilityKind, type ComboHit, type Style } from '../config/tuning';
import { levelFor } from './gear';
import type { PlayerState } from './types';

/**
 * Talents: each hero spends the points their levels earn on their own board.
 * Plain data (ranks per talent) plus pure functions the sim reads effects
 * from, shared with the saved profile and the talent screen.
 */

export type TalentId = 'might' | 'haste' | 'armour' | 'fleet' | 'focus' | 'q' | 'e';
export const TALENT_IDS: readonly TalentId[] = ['might', 'haste', 'armour', 'fleet', 'focus', 'q', 'e'];
export type TalentRanks = Partial<Record<TalentId, number>>;

export function emptyTalents(): Record<Style, TalentRanks> {
  return { sword: {}, bow: {}, staff: {} };
}

export function maxRanks(id: TalentId): number {
  const t = tuning.talents;
  switch (id) {
    case 'might':
      return t.mightMaxRanks;
    case 'haste':
      return t.hasteMaxRanks;
    case 'armour':
      return t.armourMaxRanks;
    case 'fleet':
      return t.fleetMaxRanks;
    case 'focus':
      return t.focusMaxRanks;
    default:
      return t.abilityMaxRanks;
  }
}

/** The ability a Q/E talent upgrades for a hero. */
function slotAbility(style: Style, id: 'q' | 'e'): AbilityKind {
  return ABILITIES[style][id === 'q' ? 0 : 1];
}

export function talentName(style: Style, id: TalentId): string {
  switch (id) {
    case 'might':
      return 'Might';
    case 'haste':
      return 'Haste';
    case 'armour':
      return 'Armour';
    case 'fleet':
      return 'Fleet foot';
    case 'focus':
      return 'Focus';
    default:
      return `${ABILITY_NAMES[slotAbility(style, id)]} (${id.toUpperCase()})`;
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** What one rank gives. */
export function talentText(style: Style, id: TalentId): string {
  const t = tuning.talents;
  switch (id) {
    case 'might':
      return `+${pct(t.mightDamagePerRank)} damage`;
    case 'haste':
      return `+${pct(t.hasteSpeedPerRank)} attack speed`;
    case 'armour':
      return `-${pct(t.armourReductionPerRank)} damage taken`;
    case 'fleet':
      return `+${pct(t.fleetSpeedPerRank)} move speed`;
    case 'focus':
      return `-${pct(t.focusCooldownPerRank)} ability cooldowns`;
  }
  switch (slotAbility(style, id)) {
    case 'charge':
      return `+${pct(t.chargeDamagePerRank)} damage, +${t.chargeDistancePerRank} m dash`;
    case 'whirlwind':
      return `+${pct(t.whirlwindDamagePerRank)} damage, +${t.whirlwindRadiusPerRank} m radius`;
    case 'volley':
      return `+${t.volleyArrowsPerRank} arrow, +${pct(t.volleyDamagePerRank)} damage`;
    case 'disengage':
      return `+${pct(t.disengageDamagePerRank)} damage, +${t.disengageSlowMsPerRank / 1000} s slow`;
    case 'frostRing':
      return `+${t.frostRingRadiusPerRank} m radius, +${t.frostFreezeMsPerRank / 1000} s freeze`;
    case 'blink':
      return `+${t.blinkDistancePerRank} m distance, +${pct(t.blinkCritPerRank)} crit damage`;
  }
}

/** Points a hero has earned: one per level after the first. */
export function pointsEarned(xp: number): number {
  return (levelFor(xp) - 1) * Math.round(tuning.talents.pointsPerLevel);
}

export function pointsSpent(ranks: TalentRanks): number {
  return TALENT_IDS.reduce((sum, id) => sum + (ranks[id] ?? 0), 0);
}

export function rankOf(p: PlayerState, id: TalentId, style: Style = p.style): number {
  return Math.min(maxRanks(id), p.talents[style][id] ?? 0);
}

/** Rank of the Q/E upgrade for an ability of the hero's current style (0 if it isn't theirs). */
export function abilityRank(p: PlayerState, kind: AbilityKind): number {
  const slot = ABILITIES[p.style].indexOf(kind);
  return slot < 0 ? 0 : rankOf(p, slot === 0 ? 'q' : 'e');
}

// --- Effects ---

export function attackSpeed(p: PlayerState): number {
  return 1 + rankOf(p, 'haste') * tuning.talents.hasteSpeedPerRank;
}

/** The current hero's chain hit i, sped up by haste. */
export function heroHit(p: PlayerState, i: number): ComboHit {
  return comboHit(p.style, i, attackSpeed(p));
}

export function talentDamage(p: PlayerState, style: Style): number {
  return rankOf(p, 'might', style) * tuning.talents.mightDamagePerRank;
}

export function damageTakenMult(p: PlayerState): number {
  return Math.max(0.2, 1 - rankOf(p, 'armour') * tuning.talents.armourReductionPerRank);
}

export function moveSpeedMult(p: PlayerState): number {
  return 1 + rankOf(p, 'fleet') * tuning.talents.fleetSpeedPerRank;
}

/** Cooldown multiplier from gear and the focus talent. */
export function cooldownMult(p: PlayerState): number {
  return Math.max(0.2, 1 - p.mods.cooldowns - rankOf(p, 'focus') * tuning.talents.focusCooldownPerRank);
}
