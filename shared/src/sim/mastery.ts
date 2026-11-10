import { tuning } from '../config/tuning';
import type { Combo, PlayerState, SimState } from './types';

/** Every combo a payoff can count toward (the builds pass: combo mastery, Michael's A, 10 Nov). */
export const COMBOS: readonly Combo[] = ['shatter', 'skewer', 'detonate', 'uproot', 'fan'];

/** Each combo's name as the callout says it (Burning's spread is called Wildfire). */
export const COMBO_NAMES: Record<Combo, string> = { shatter: 'Shatter', skewer: 'Skewer', detonate: 'Detonate', uproot: 'Uproot', fan: 'Wildfire' };

/** Ranks as written. */
export const MASTERY_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Payoffs counted per combo: the player's, kept in the browser's save until Phase 3 and carried on the loadout. */
export type ComboMastery = Partial<Record<Combo, number>>;

/** The most a count may claim: far past rank V, so a save can never overflow it. */
export const MASTERY_COUNT_MAX = 1e7;

/** Payoffs needed for ranks I to V, lowest first. */
export function masteryThresholds(): number[] {
  const m = tuning.mastery;
  return [m.rank1, m.rank2, m.rank3, m.rank4, m.rank5];
}

/** A combo's rank, 0 (none yet) to 5, from its count. */
export function masteryRank(count: number | undefined): number {
  const n = count ?? 0;
  let rank = 0;
  for (const t of masteryThresholds()) if (n >= t) rank++;
  return rank;
}

/**
 * A payoff the server decided counts toward its payer's mastery of that combo, and a rank reached
 * says so. Henchmen keep none: mastery is a player's. Off in the parity test (the slice counts nothing).
 */
export function countPayoff(state: SimState, p: PlayerState | undefined, combo: Combo): void {
  if (!tuning.mastery.enabled || !p || p.henchman) return;
  const mastery = (p.mastery ??= {});
  const before = mastery[combo] ?? 0;
  const after = Math.min(MASTERY_COUNT_MAX, before + 1);
  mastery[combo] = after;
  const rank = masteryRank(after);
  if (rank > masteryRank(before)) state.events.push({ kind: 'masteryRank', playerId: p.id, combo, rank });
}

/** Whether a count the browser sends could be a save's (whole, not negative, under the ceiling). */
export function readMastery(v: unknown): ComboMastery | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out: ComboMastery = {};
  for (const [id, n] of Object.entries(v)) {
    if (!COMBOS.includes(id as Combo) || typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MASTERY_COUNT_MAX) return null;
    const whole = Math.trunc(n);
    if (whole > 0) out[id as Combo] = whole;
  }
  return out;
}
