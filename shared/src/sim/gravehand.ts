import { tuning } from '../config/tuning';
import type { EnemyState, PlayerCommand, PlayerState, SimState } from './types';

/**
 * The Gravehand's height and its two rules (H1; `docs/bosses.md` 2.1), read from its AI state alone so
 * the server, a joiner's prediction and the view agree from one snapshot: no field rides the wire.
 */

/** Its palm on the floor after a slam: the punish window, where every hit lands harder. */
export function palmResting(e: Pick<EnemyState, 'kind' | 'ai' | 'attack'>): boolean {
  if (e.kind !== 'gravehand') return false;
  return (e.attack === 'slam' && (e.ai === 'slam' || e.ai === 'recover')) || (e.attack === 'grab' && e.ai === 'recover');
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
  // Closed round a hero (H2): down at their height, where a partner's blade reaches it.
  if (e.ai === 'charge' && e.attack === 'grab') return 1;
  return g.hoverM;
}

/** Floating out of a blade's reach: only a projectile or a burst touches it (arrows and spells). */
export function handAloft(e: Pick<EnemyState, 'kind' | 'ai' | 'attack' | 'aiTime'>): boolean {
  return e.kind === 'gravehand' && gravehandLift(e) > tuning.gravehand.hoverM * 0.5;
}

/**
 * A held hero's tick (H2), from stepPlayer: they cannot move, swing or roll. The grip runs down, and
 * dodge presses each at least `grabBeatMs` after the last wriggle them free after `grabEscapePresses`;
 * a press sooner starts the count again. The hand sees the grip gone on its next step and lets go.
 */
export function stepHeld(p: PlayerState, cmd: PlayerCommand, dt: number): void {
  const g = tuning.gravehand;
  const h = p.held!;
  p.vx = 0;
  p.vz = 0;
  h.left -= dt;
  h.since += dt;
  if (cmd.dodge) {
    h.presses = h.since >= g.grabBeatMs / 1000 ? h.presses + 1 : 0;
    h.since = 0;
  }
  if (h.left <= 1e-9 || h.presses >= Math.round(g.grabEscapePresses)) freeHero(p);
}

/** Out of the grip, untouchable a moment so it cannot close again at once. */
export function freeHero(p: PlayerState): void {
  delete p.held;
  p.invulnTime = Math.max(p.invulnTime, tuning.gravehand.grabFreedInvulnMs / 1000);
}

/** The hand's grip goes (H2): staggered, fallen or opened, its hero is free. */
export function releaseGrip(state: SimState, e: EnemyState): void {
  const p = state.players.find((q) => q.held?.by === e.id);
  if (p) freeHero(p);
  delete e.grip;
}

/** The hand opens (H2): its hero is freed and its palm rests where it held them, the punish window. */
export function letGo(state: SimState, e: EnemyState): void {
  releaseGrip(state, e);
  e.tele.shape = 'none';
  e.ai = 'recover';
  e.aiTime = 0;
  e.recoverTime = tuning.gravehand.slamRestMs / 1000;
}

/**
 * A hit on a hand that holds a hero (H2, from damageEnemy): a partner's heavy opens it at once, and so
 * does `grabBreakDamage` dealt while it holds.
 */
export function hitOnGrip(state: SimState, e: EnemyState, attackerId: string, damage: number, heavy: boolean): void {
  const grip = e.grip;
  if (!grip || e.ai !== 'charge') return;
  grip.taken += damage;
  if ((heavy && attackerId !== grip.hero) || grip.taken >= tuning.gravehand.grabBreakDamage) letGo(state, e);
}
