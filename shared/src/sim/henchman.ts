import { enemyStats, tuning } from '../config/tuning';
import { isTargetable, nextRandom } from './combat';
import { idleCommand, type EnemyState, type PlayerCommand, type PlayerState, type SimState } from './types';

/**
 * A henchman (P3; Michael, 28 Oct: henchmen only, no companions yet): a hero in a party slot with no
 * browser behind it. Its brain writes its PlayerCommand each tick from the sim state, so the fight,
 * the snapshots and everyone's views need nothing new; it runs on the server only, deterministic,
 * its few rolls from the sim's own rng.
 *
 * The sword henchman follows the party, picks the nearest enemy, closes and chains on it. Standing in
 * an enemy's telegraph it notices only after tuning.hirelings.reactMs, then dodges out of it or raises
 * its guard. A player reacts sooner and always can, so a friend is still the better partner (the design
 * doc: below the Tavern's top tiers, henchmen are clearly worse than a competent human).
 */

/** What the brain remembers between ticks: the telegraph it is reacting to, and its guard. */
export interface HenchmanBrain {
  /** The enemy whose telegraph it stands in, or -1, and when it first stood there. */
  threat: number;
  seenAt: number;
  /** The last telegraph it has answered (dodged or guarded), so it answers each once. */
  answered: number;
  /** Sim time until which it holds its guard up. */
  guardUntil: number;
}

/** Names for the tavern's hires (P10 lets the player choose; a cheat takes the next). */
export const HENCHMAN_NAMES = ['Garrick', 'Bryn', 'Tamsin', 'Odo'] as const;

/** Whether this point stands inside an enemy's telegraph, with a hero's radius of slack. */
export function inTelegraph(e: EnemyState, x: number, z: number): boolean {
  const t = e.tele;
  const r = tuning.movement.radius;
  if (t.shape === 'none') return false;
  if (t.shape === 'circle') return Math.hypot(x - t.x, z - t.z) <= t.radius + r;
  if (t.shape === 'cone') {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d > t.radius + r) return false;
    const off = Math.atan2(x - t.x, z - t.z) - t.yaw;
    return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) <= ((t.arcDeg / 2) * Math.PI) / 180 + 0.15;
  }
  // A line: from the enemy along its yaw for the telegraph's length.
  const fx = Math.sin(t.yaw);
  const fz = Math.cos(t.yaw);
  const along = (x - e.x) * fx + (z - e.z) * fz;
  if (along < 0 || along > t.radius + r) return false;
  return Math.abs((x - e.x) * fz - (z - e.z) * fx) <= r + 0.5;
}

/** The command a henchman gives itself this tick. */
export function henchmanCommand(state: SimState, h: PlayerState): PlayerCommand {
  const cmd = idleCommand();
  if (h.mode === 'down') return cmd;
  const c = tuning.hirelings;
  const b = (h.brain ??= { threat: -1, seenAt: 0, answered: -1, guardUntil: -1 });
  const toward = (x: number, z: number) => {
    const dx = x - h.x;
    const dz = z - h.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d, d };
  };

  // A telegraph it stands in: noticed late, answered once, by a dodge out of it or a raised guard.
  const threat = state.enemies.find((e) => e.ai === 'windup' && inTelegraph(e, h.x, h.z));
  if (threat) {
    if (b.threat !== threat.id) {
      b.threat = threat.id;
      b.seenAt = state.time;
    }
    if (b.answered !== threat.id && (state.time - b.seenAt) * 1000 >= c.reactMs) {
      b.answered = threat.id;
      if (nextRandom(state) < c.dodgeChance) {
        const away = toward(threat.x, threat.z);
        cmd.moveX = -away.x;
        cmd.moveZ = -away.z;
        cmd.aimX = -away.x;
        cmd.aimZ = -away.z;
        cmd.dodge = true;
        return cmd;
      }
      b.guardUntil = state.time + c.guardMs / 1000;
    }
  } else b.threat = -1;
  if (b.guardUntil > state.time && threat) {
    const at = toward(threat.x, threat.z);
    cmd.aimX = at.x;
    cmd.aimZ = at.z;
    cmd.block = true;
    return cmd;
  }

  // The party it keeps to: the nearest standing player who is not a henchman.
  const leader = state.players
    .filter((p) => !p.henchman && p.mode !== 'down')
    .sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0];

  // Its enemy: the nearest that it or its leader is close to.
  const near = (e: EnemyState, x: number, z: number) => Math.hypot(e.x - x, e.z - z) <= c.aggroRange;
  const target = state.enemies
    .filter((e) => isTargetable(e) && Math.abs(e.y - h.y) < 1.5 && (near(e, h.x, h.z) || (leader && near(e, leader.x, leader.z))))
    .sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0];
  if (target) {
    const at = toward(target.x, target.z);
    cmd.aimX = at.x;
    cmd.aimZ = at.z;
    cmd.lockTarget = target.id;
    if (at.d > c.reach + enemyStats(target.kind).radius) {
      cmd.moveX = at.x;
      cmd.moveZ = at.z;
      cmd.sprint = at.d > 6;
    } else if (state.tick % Math.max(1, Math.round(c.attackEveryTicks)) === 0) cmd.attack = true;
    return cmd;
  }

  // Nothing to fight: keep up with the party.
  if (leader) {
    const at = toward(leader.x, leader.z);
    if (at.d > c.followDistance) {
      cmd.moveX = at.x;
      cmd.moveZ = at.z;
      cmd.aimX = at.x;
      cmd.aimZ = at.z;
      cmd.sprint = at.d > 8;
    }
  }
  return cmd;
}
