import { ABILITIES, ABILITY_NAMES, comboHit, stringHit, tuning, type AbilityKind, type ComboHit, type Style } from '../config/tuning';
import { championArmour, championCooldown, championRecharge, championSpeed } from './champion';
import { flowSpeed } from './flow';
import { levelFor } from './gear';
import type { PlayerState } from './types';

/**
 * Talents: each hero spends the points their levels earn on their own board.
 * Plain data (ranks per talent) plus pure functions the sim reads effects
 * from, shared with the saved profile and the talent screen.
 */

export type TalentId = 'might' | 'haste' | 'armour' | 'fleet' | 'focus' | 'q' | 'e' | RowTalentId;
/** The milestone rows (T6, plan 3a): each opens at its level, so a long climb keeps giving choices. */
export type RowTalentId = 'weight' | 'finisher' | 'riposte' | 'wind' | 'mastery';
export const ROW_TALENTS: readonly { id: RowTalentId; level: number }[] = [
  { id: 'weight', level: 10 },
  { id: 'finisher', level: 20 },
  { id: 'riposte', level: 30 },
  { id: 'wind', level: 40 },
  { id: 'mastery', level: 50 },
];
export const TALENT_IDS: readonly TalentId[] = ['might', 'haste', 'armour', 'fleet', 'focus', 'q', 'e', ...ROW_TALENTS.map((r) => r.id)];

/** The style level a talent opens at (1 for the slice's own board). */
export function talentLevel(id: TalentId): number {
  return ROW_TALENTS.find((r) => r.id === id)?.level ?? 1;
}
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
    case 'q':
    case 'e':
      return t.abilityMaxRanks;
    default:
      return t.rowMaxRanks;
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
    case 'weight':
      return 'Weight';
    case 'finisher':
      return 'Finisher';
    case 'riposte':
      return 'Riposte';
    case 'wind':
      return 'Second wind';
    case 'mastery':
      return 'Mastery';
    default:
      return `${ABILITY_NAMES[slotAbility(style, id)]} (${id.toUpperCase()})`;
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The combo payoff each weapon deals the last blow of. */
const FINISHERS: Record<Style, string> = { sword: 'Shatter', bow: 'Skewer', staff: 'Detonate' };

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
    case 'weight':
      return `+${pct(t.weightPoisePerRank)} poise damage`;
    case 'finisher':
      return `+${pct(t.finisherDamagePerRank)} damage on ${FINISHERS[style]}`;
    case 'riposte':
      return `+${t.riposteParryMsPerRank} ms parry window`;
    case 'wind':
      return `-${pct(t.windRechargePerRank)} dodge recharge`;
    case 'mastery':
      return `+${pct(t.masteryDamagePerRank)} damage`;
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
  const rank = p.talents[style][id] ?? 0;
  if (rank <= 0) return 0;
  // A row the hero hasn't reached is shut, whatever a save says.
  if (talentLevel(id) > 1 && levelFor(p.xp[style]) < talentLevel(id)) return 0;
  return Math.min(maxRanks(id), rank);
}

/** Why a hero's board is not one they could have built, or null: too many points, a rank past its top, a row not reached. */
export function boardProblem(xp: number, ranks: TalentRanks): string | null {
  if (pointsSpent(ranks) > pointsEarned(xp)) return 'more points spent than earned';
  const level = levelFor(xp);
  for (const id of TALENT_IDS) {
    const r = ranks[id] ?? 0;
    if (r > maxRanks(id)) return `${id} past its top rank`;
    if (r > 0 && level < talentLevel(id)) return `${id} opens at level ${talentLevel(id)}`;
  }
  return null;
}

/** Rank of the Q/E upgrade for an ability of the hero's current style (0 if it isn't theirs). */
export function abilityRank(p: PlayerState, kind: AbilityKind): number {
  const slot = ABILITIES[p.style].indexOf(kind);
  return slot < 0 ? 0 : rankOf(p, slot === 0 ? 'q' : 'e');
}

// --- Effects ---

export function attackSpeed(p: PlayerState): number {
  return 1 + rankOf(p, 'haste') * tuning.talents.hasteSpeedPerRank + flowSpeed(p);
}

/** The current hero's chain hit i, sped up by haste. */
export function heroHit(p: PlayerState, i: number): ComboHit {
  // A string move (C1) stands in for the chain step it borrows.
  if (p.attackMove) return stringHit(p.style, p.attackMove, attackSpeed(p), p.attackCharge ?? 1);
  return comboHit(p.style, i, attackSpeed(p));
}

export function talentDamage(p: PlayerState, style: Style): number {
  return rankOf(p, 'might', style) * tuning.talents.mightDamagePerRank + rankOf(p, 'mastery', style) * tuning.talents.masteryDamagePerRank;
}

export function talentPoise(p: PlayerState, style: Style): number {
  return rankOf(p, 'weight', style) * tuning.talents.weightPoisePerRank;
}

/** Extra damage on a combo payoff this weapon dealt. */
export function talentFinisher(p: PlayerState, style: Style): number {
  return rankOf(p, 'finisher', style) * tuning.talents.finisherDamagePerRank;
}

/** The parry window in ms, with Riposte for the weapon in hand. */
export function parryWindowMs(p: PlayerState): number {
  return tuning.guard.parryWindowMs + rankOf(p, 'riposte') * tuning.talents.riposteParryMsPerRank;
}

/** The share taken off a dodge charge's recharge by gear and Second wind. */
export function dodgeRechargeCut(p: PlayerState): number {
  return p.mods.dodgeRecharge + rankOf(p, 'wind') * tuning.talents.windRechargePerRank + championRecharge(p);
}

export function damageTakenMult(p: PlayerState): number {
  return Math.max(0.2, 1 - rankOf(p, 'armour') * tuning.talents.armourReductionPerRank - championArmour(p));
}

export function moveSpeedMult(p: PlayerState): number {
  return 1 + rankOf(p, 'fleet') * tuning.talents.fleetSpeedPerRank + championSpeed(p);
}

/** Cooldown multiplier from gear and the focus talent. */
export function cooldownMult(p: PlayerState): number {
  return Math.max(0.2, 1 - p.mods.cooldowns - rankOf(p, 'focus') * tuning.talents.focusCooldownPerRank - championCooldown(p));
}
