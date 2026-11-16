import { tuning } from '../config/tuning';
import type { EnemyState, SimState } from './types';

/**
 * The Ossuary Mason's rule (M1; `docs/bosses.md` 2.2): tanky by rule, not by health. While any of its
 * Wardstones stand it is Bound, and every hit on it lands at `mason.boundTaken`.
 */
export function masonBound(state: Pick<SimState, 'enemies'>): boolean {
  return state.enemies.some((o) => o.kind === 'wardstone' && o.ai !== 'dead');
}

/** What a hit on `e` is multiplied by for the Bound rule: 1 for anything but a Bound Mason. */
export function boundMult(state: Pick<SimState, 'enemies'>, e: Pick<EnemyState, 'kind'>): number {
  return e.kind === 'mason' && masonBound(state) ? tuning.mason.boundTaken : 1;
}
