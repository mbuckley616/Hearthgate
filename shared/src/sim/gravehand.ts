import { tuning } from '../config/tuning';
import type { EnemyState } from './types';

/**
 * The Gravehand's height and its two rules (H1; `docs/bosses.md` 2.1), read from its AI state alone so
 * the server, a joiner's prediction and the view agree from one snapshot: no field rides the wire.
 */

/** Its palm on the floor after a slam: the punish window, where every hit lands harder. */
export function palmResting(e: Pick<EnemyState, 'kind' | 'ai' | 'attack'>): boolean {
  return e.kind === 'gravehand' && e.attack === 'slam' && (e.ai === 'slam' || e.ai === 'recover');
}

/**
 * Metres its palm hangs over the floor. Floating, it is `hoverM` up; a slam's wind-up lifts it higher
 * over its hero and the slam drops it flat; a sweep brings it down on its side; a stagger, a fall or
 * its rest put it on the floor.
 */
export function gravehandLift(e: Pick<EnemyState, 'kind' | 'ai' | 'attack' | 'aiTime'>): number {
  const g = tuning.gravehand;
  if (palmResting(e) || e.ai === 'stagger' || e.ai === 'dead') return 0;
  if (e.ai === 'slamWindup') return g.hoverM + 1.2 * Math.min(1, e.aiTime / ((g.slamTelegraphMs / 1000) * g.slamTrackFrac));
  if (e.ai === 'sweepWindup' || e.ai === 'sweep' || (e.ai === 'recover' && e.attack === 'sweep')) return 0.3;
  return g.hoverM;
}

/** Floating out of a blade's reach: only a projectile or a burst touches it (arrows and spells). */
export function handAloft(e: Pick<EnemyState, 'kind' | 'ai' | 'attack' | 'aiTime'>): boolean {
  return e.kind === 'gravehand' && gravehandLift(e) > tuning.gravehand.hoverM * 0.5;
}
