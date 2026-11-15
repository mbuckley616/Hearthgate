import { tuning } from '../config/tuning';
import { fightOn } from './player';
import type { SimState } from './types';

/**
 * The slow regen (Michael, 15 Nov, A: "Maybe regen health out of combat, but slowly"): once no fight
 * has been on for `heal.regenDelayS`, every standing hero (henchmen too) regains `heal.regenPerS` of
 * their health a second, never past full. A fight starting (a floor's room shutting, the arena's
 * waves) stops it at once and starts the wait again. Health is the server's, so prediction never
 * regens; the hero's health follows the snapshot.
 */
export function stepRegen(state: SimState, dt: number): void {
  const h = tuning.heal;
  if (h.regenPerS <= 0 || fightOn(state)) {
    delete state.calmFor;
    return;
  }
  const calm = (state.calmFor ?? 0) + dt;
  state.calmFor = calm;
  if (calm < h.regenDelayS) return;
  for (const p of state.players) {
    if (p.mode === 'down' || p.hp <= 0 || p.hp >= p.maxHp) continue;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * h.regenPerS * dt);
  }
}
