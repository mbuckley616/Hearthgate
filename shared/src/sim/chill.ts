import { tuning } from '../config/tuning';
import type { PlayerState, SimState } from './types';

/**
 * Chill a hero (E1d): the server's call, from a Wraith's circle landing. A second Chill restarts the
 * clock rather than stacking (Michael's A: one state, easy to read).
 */
export function chillHero(state: SimState, p: PlayerState): void {
  if (p.mode === 'down' || tuning.chill.durationS <= 0) return;
  p.chill = tuning.chill.durationS;
  state.events.push({ kind: 'chilled', playerId: p.id, x: p.x, z: p.z });
}
