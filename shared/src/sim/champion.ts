import { STYLES, tuning } from '../config/tuning';
import { levelFor, maxLevel } from './gear';
import type { PlayerState } from './types';

/**
 * Champion points (T6b, plan 3a; Michael, 27 Oct): once any weapon reaches the top level, XP from
 * every weapon also buys champion points, each a little dearer than the last, without end. They are
 * spent in three constellations of small ranked perks, and all of them together never give more
 * than the ceiling's damage and health, so a veteran is stronger but a new friend still matters.
 * They belong to the player, not the hero (shared across characters), so the save keeps them
 * beside the hero; until Phase 2's server saves, the browser sends them on join and the server
 * checks the points spent against the XP.
 */

export type ChampionId = 'precision' | 'heft' | 'exploit' | 'vitality' | 'toughness' | 'steady' | 'will' | 'lightstep' | 'stride';
export type ChampionRanks = Partial<Record<ChampionId, number>>;

/**
 * Slotted perks (T6c, plan 3a; Michael, 28 Oct): sideways, not up. Each constellation has three,
 * opened in turn by the points spent in it; four may be slotted at once, chosen in the village or a
 * rest room.
 */
export type SlottedId = 'wideShatter' | 'teamwork' | 'deepWounds' | 'counterstep' | 'bulwark' | 'lifeline' | 'longFuse' | 'momentum' | 'magnet';

/** A player's champion points: XP banked since a weapon reached the top, where it went, and what is slotted. */
export interface ChampionState {
  xp: number;
  ranks: ChampionRanks;
  slots?: SlottedId[];
}

export type Constellation = 'offence' | 'defence' | 'utility';

export const CONSTELLATIONS: readonly { id: Constellation; name: string; perks: readonly ChampionId[]; slotted: readonly SlottedId[] }[] = [
  { id: 'offence', name: 'Offence', perks: ['precision', 'heft', 'exploit'], slotted: ['wideShatter', 'teamwork', 'deepWounds'] },
  { id: 'defence', name: 'Defence', perks: ['vitality', 'toughness', 'steady'], slotted: ['counterstep', 'bulwark', 'lifeline'] },
  { id: 'utility', name: 'Utility', perks: ['will', 'lightstep', 'stride'], slotted: ['longFuse', 'momentum', 'magnet'] },
];

export const CHAMPION_IDS: readonly ChampionId[] = CONSTELLATIONS.flatMap((c) => c.perks);
export const SLOTTED_IDS: readonly SlottedId[] = CONSTELLATIONS.flatMap((c) => c.slotted);

export function emptyChampion(): ChampionState {
  return { xp: 0, ranks: {} };
}

/** Each perk: its name, gain per rank (from tuning) and top rank. */
function perk(id: ChampionId): { name: string; perRank: number; max: number } {
  const c = tuning.champion;
  switch (id) {
    case 'precision':
      return { name: 'Precision', perRank: c.precisionDamagePerRank, max: c.precisionMaxRanks };
    case 'heft':
      return { name: 'Heft', perRank: c.heftPoisePerRank, max: c.smallMaxRanks };
    case 'exploit':
      return { name: 'Exploit', perRank: c.exploitComboPerRank, max: c.smallMaxRanks };
    case 'vitality':
      return { name: 'Vitality', perRank: c.vitalityHealthPerRank, max: c.vitalityMaxRanks };
    case 'toughness':
      return { name: 'Toughness', perRank: c.toughnessReductionPerRank, max: c.smallMaxRanks };
    case 'steady':
      return { name: 'Steady hands', perRank: c.steadyReviveCutPerRank, max: c.smallMaxRanks };
    case 'will':
      return { name: 'Will', perRank: c.willCooldownPerRank, max: c.smallMaxRanks };
    case 'lightstep':
      return { name: 'Light step', perRank: c.lightstepRechargePerRank, max: c.smallMaxRanks };
    case 'stride':
      return { name: 'Stride', perRank: c.strideSpeedPerRank, max: c.smallMaxRanks };
  }
}

export function championMaxRanks(id: ChampionId): number {
  return Math.max(0, Math.round(perk(id).max));
}

export function championName(id: ChampionId): string {
  return perk(id).name;
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** What one rank gives. */
export function championText(id: ChampionId): string {
  const v = perk(id).perRank;
  switch (id) {
    case 'precision':
      return `+${pct(v)} damage`;
    case 'heft':
      return `+${pct(v)} poise damage`;
    case 'exploit':
      return `+${pct(v)} combo payoff damage`;
    case 'vitality':
      return `+${pct(v)} max health`;
    case 'toughness':
      return `-${pct(v)} damage taken`;
    case 'steady':
      return `-${pct(v)} time to revive a friend`;
    case 'will':
      return `-${pct(v)} ability cooldowns`;
    case 'lightstep':
      return `-${pct(v)} dodge recharge, -${tuning.champion.lightstepCancelMsPerRank} ms dodge recovery`;
    case 'stride':
      return `+${pct(v)} move speed`;
  }
}

/** XP that buys the first n points: each costs pointXp, plus pointXpGrowth more than the one before. */
export function championXpFor(n: number): number {
  const c = tuning.champion;
  return n * c.pointXp + (c.pointXpGrowth * n * (n - 1)) / 2;
}

/** Points earned by this much banked XP. */
export function championPointsEarned(xp: number): number {
  const c = tuning.champion;
  if (xp <= 0 || c.pointXp <= 0) return 0;
  // Solve the cost's quadratic, then settle on whole points either side of rounding.
  const g = c.pointXpGrowth;
  let n = g > 0 ? Math.floor((-(c.pointXp - g / 2) + Math.sqrt((c.pointXp - g / 2) ** 2 + 2 * g * xp)) / g) : Math.floor(xp / c.pointXp);
  while (n > 0 && championXpFor(n) > xp) n--;
  while (championXpFor(n + 1) <= xp) n++;
  return n;
}

export function championPointsSpent(ranks: ChampionRanks): number {
  return CHAMPION_IDS.reduce((sum, id) => sum + (ranks[id] ?? 0), 0);
}

/** Whether a hero banks champion XP: any weapon at the top level. */
export function championOpen(xp: Record<(typeof STYLES)[number], number>): boolean {
  return STYLES.some((s) => levelFor(xp[s]) >= maxLevel());
}

export function slotCount(): number {
  return Math.max(0, Math.round(tuning.champion.slots));
}

/** Points spent in a constellation's ranked perks. */
export function spentIn(ranks: ChampionRanks, con: Constellation): number {
  const c = CONSTELLATIONS.find((k) => k.id === con)!;
  return c.perks.reduce((sum, id) => sum + (ranks[id] ?? 0), 0);
}

function homeOf(id: SlottedId): { con: Constellation; index: number } {
  const c = CONSTELLATIONS.find((k) => k.slotted.includes(id))!;
  return { con: c.id, index: c.slotted.indexOf(id) };
}

/** Points that must be spent in its constellation before a slotted perk opens. */
export function slottedUnlockAt(id: SlottedId): number {
  return (homeOf(id).index + 1) * Math.round(tuning.champion.slotUnlockStep);
}

export function slottedUnlocked(ranks: ChampionRanks, id: SlottedId): boolean {
  return spentIn(ranks, homeOf(id).con) >= slottedUnlockAt(id);
}

/** Why a champion board is not one its XP could have bought, or null. */
export function championProblem(c: ChampionState): string | null {
  if (championPointsSpent(c.ranks) > championPointsEarned(c.xp)) return 'more champion points spent than earned';
  for (const id of CHAMPION_IDS) if ((c.ranks[id] ?? 0) > championMaxRanks(id)) return `${id} past its top rank`;
  // A slotted perk whose constellation has since lost the points stays slotted but does nothing (`slotted`),
  // so a respec on a floor, where the slots are fixed, never makes the server refuse the whole loadout.
  if (c.slots) {
    if (c.slots.length > slotCount()) return 'more slotted perks than slots';
    if (new Set(c.slots).size !== c.slots.length) return 'a slotted perk twice';
  }
  return null;
}

const SLOTTED: Record<SlottedId, { name: string; text: () => string }> = {
  wideShatter: { name: 'Wide shatter', text: () => `Shatter splashes ${times(tuning.champion.wideShatterRadiusMult)} as far` },
  teamwork: { name: 'Teamwork', text: () => `A combo an ally set up hits ${pct(tuning.champion.teamworkBonus)} harder` },
  deepWounds: { name: 'Deep wounds', text: () => `Bleeds last ${times(tuning.champion.deepWoundsTicksMult)} as long` },
  counterstep: { name: 'Counterstep', text: () => 'A parry gives back a dodge charge' },
  bulwark: { name: 'Bulwark', text: () => `Blocked hits chip ${pct(1 - tuning.champion.bulwarkChipMult)} less` },
  lifeline: { name: 'Lifeline', text: () => `A friend you revive gets up with ${times(tuning.champion.lifelineHpMult)} the health` },
  longFuse: { name: 'Long fuse', text: () => `Combos you set up stay open ${pct(tuning.champion.longFuseWindowMult - 1)} longer` },
  momentum: { name: 'Momentum', text: () => `A combo payoff takes ${tuning.champion.momentumCooldownMs / 1000} s off your ability cooldowns` },
  magnet: { name: 'Magnet', text: () => `Pick up drops from ${times(tuning.champion.magnetRadiusMult)} as far` },
};

function times(v: number): string {
  return v === 2 ? 'twice' : `${Math.round(v * 10) / 10}×`;
}

export const slottedName = (id: SlottedId) => SLOTTED[id].name;
export const slottedText = (id: SlottedId) => SLOTTED[id].text();

// --- Effects (0 for a hero with none, which is every hero in the slice and the parity test) ---

function gain(p: PlayerState, id: ChampionId): number {
  const rank = p.champion?.ranks[id] ?? 0;
  return rank > 0 ? Math.min(championMaxRanks(id), rank) * perk(id).perRank : 0;
}

/** Damage from champion points, never past the ceiling. */
export function championDamage(p: PlayerState): number {
  return Math.min(tuning.champion.ceilingDamage, gain(p, 'precision'));
}

/** Max health from champion points, as a share, never past the ceiling. */
export function championHealth(c: ChampionState | undefined): number {
  const rank = c?.ranks.vitality ?? 0;
  return rank > 0 ? Math.min(tuning.champion.ceilingHealth, Math.min(championMaxRanks('vitality'), rank) * perk('vitality').perRank) : 0;
}

export const championPoise = (p: PlayerState) => gain(p, 'heft');
export const championCombo = (p: PlayerState) => gain(p, 'exploit');
export const championArmour = (p: PlayerState) => gain(p, 'toughness');
export const championRevive = (p: PlayerState) => gain(p, 'steady');
export const championCooldown = (p: PlayerState) => gain(p, 'will');
export const championRecharge = (p: PlayerState) => gain(p, 'lightstep');
export const championSpeed = (p: PlayerState) => gain(p, 'stride');

/** Milliseconds Light step takes off a roll's recovery (D9). */
export function championRecovery(p: PlayerState): number {
  const rank = Math.min(championMaxRanks('lightstep'), p.champion?.ranks.lightstep ?? 0);
  return rank > 0 ? rank * tuning.champion.lightstepCancelMsPerRank : 0;
}

/** A slotted perk is working: in one of the hero's slots, and its constellation holds the points to open it. */
export function slotted(p: PlayerState | undefined, id: SlottedId): boolean {
  const c = p?.champion;
  return !!c?.slots && c.slots.includes(id) && slottedUnlocked(c.ranks, id);
}
