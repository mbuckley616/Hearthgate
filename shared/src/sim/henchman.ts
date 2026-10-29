import { enemyStats, tuning, type Style } from '../config/tuning';
import { abilityReady } from './abilities';
import { isTargetable, nextRandom } from './combat';
import { idleCommand, type EnemyState, type PlayerCommand, type PlayerState, type SimState } from './types';

/**
 * A henchman (P3; Michael, 28 Oct: henchmen only, no companions yet): a hero in a party slot with no
 * browser behind it. Its brain writes its PlayerCommand each tick from the sim state, so the fight,
 * the snapshots and everyone's views need nothing new; it runs on the server only, deterministic,
 * its few rolls from the sim's own rng.
 *
 * Each follows the party and fights the nearest enemy (or, now and then, one set up for a combo, to pay
 * it off): the sword closes and chains, the bow and the staff keep to their range and step back from
 * anything that comes close (P6). Each uses its abilities now and then, and goes to revive a downed
 * friend when nothing is threatening it. Standing in
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
  /** Hired from a Tavern at its top tier (P10): it reads telegraphs quicker. */
  quick?: boolean;
}

/** The Tavern's hires (P10; Michael's mockup), one of each kit: who stands by Old Fenn's hearth. */
export const HIRES: Record<Style, { name: string; title: string }> = {
  sword: { name: 'Garrick', title: 'Sellsword' },
  bow: { name: 'Bryn', title: 'Archer' },
  staff: { name: 'Tamsin', title: 'Hedge-mage' },
};

/** A henchman as it travels from room to room (P10): who it is, not where it stands. */
export interface HenchmanCard {
  name: string;
  style: Style;
  xp: number;
  quick?: boolean;
}

export function henchmanCard(p: PlayerState): HenchmanCard {
  return { name: p.name, style: p.style, xp: p.xp[p.style], ...(p.brain?.quick ? { quick: true } : {}) };
}

/** Cards from a room's create options (the server's own), each field checked. */
export function readHenchmanCards(v: unknown): HenchmanCard[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c) => {
    if (typeof c !== 'object' || c === null) return [];
    const o = c as Record<string, unknown>;
    if (typeof o.name !== 'string' || !(o.style === 'sword' || o.style === 'bow' || o.style === 'staff') || typeof o.xp !== 'number' || !Number.isFinite(o.xp)) return [];
    return [{ name: o.name.slice(0, 16), style: o.style, xp: Math.max(0, o.xp), ...(o.quick === true ? { quick: true } : {}) }];
  });
}

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
    if (b.answered !== threat.id && (state.time - b.seenAt) * 1000 >= c.reactMs * (b.quick ? c.quickReact : 1)) {
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

  // A friend down (P6): go to them and hold talk until they are up, players before other henchmen.
  if (!threat) {
    const down = state.players
      .filter((p) => p !== h && p.mode === 'down' && (p.bleed === undefined || p.bleed > 0))
      .sort((p, q) => Number(!!p.henchman) - Number(!!q.henchman) || Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0];
    if (down) {
      const at = toward(down.x, down.z);
      cmd.aimX = at.x;
      cmd.aimZ = at.z;
      if (at.d > tuning.coop.reviveRadius - 0.3) {
        cmd.moveX = at.x;
        cmd.moveZ = at.z;
        cmd.sprint = at.d > 4;
      } else cmd.interact = true;
      return cmd;
    }
  }

  // The party it keeps to: the nearest standing player who is not a henchman.
  const leader = state.players
    .filter((p) => !p.henchman && p.mode !== 'down')
    .sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z))[0];

  // Its enemy: the nearest that it or its leader is close to.
  const near = (e: EnemyState, x: number, z: number) => Math.hypot(e.x - x, e.z - z) <= c.aggroRange;
  const foes = state.enemies
    .filter((e) => isTargetable(e) && Math.abs(e.y - h.y) < 1.5 && (near(e, h.x, h.z) || (leader && near(e, leader.x, leader.z))))
    .sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z));
  // Now and then it turns on one someone has set up (P6): a combo to pay off. Which ticks it does so
  // comes from the tick and its own id, so it needs no roll.
  const marked = foes.find((e) => e.shatterUntil > state.time || e.skewerUntil > state.time || e.detonateUntil > state.time);
  const seed = Number(h.id.replace(/\D/g, '')) * 37;
  const target = marked && (state.tick + seed) % 100 < c.comboChance * 100 ? marked : foes[0];
  if (target) {
    const at = toward(target.x, target.z);
    cmd.aimX = at.x;
    cmd.aimZ = at.z;
    cmd.lockTarget = target.id;
    const ranged = h.style !== 'sword';
    const range = h.style === 'bow' ? c.bowRange : h.style === 'staff' ? c.staffRange : c.reach + enemyStats(target.kind).radius;
    if (ranged && at.d < c.rangedMin) {
      // Too close for a bow or a staff: step back, still facing it.
      cmd.moveX = -at.x;
      cmd.moveZ = -at.z;
    } else if (at.d > range) {
      cmd.moveX = at.x;
      cmd.moveZ = at.z;
      cmd.sprint = at.d > range + 6;
    }
    spread(state, h, cmd);
    const inReach = at.d <= range + (ranged ? 1 : 0);
    if (inReach && state.tick % Math.max(1, Math.round(c.attackEveryTicks)) === 0) cmd.attack = true;
    // Its abilities, now and then.
    if (inReach && state.tick % Math.max(1, Math.round(c.abilityCheckTicks)) === 0) {
      for (const slot of [0, 1] as const) {
        if (!abilityReady(h, slot) || nextRandom(state) >= c.abilityChance) continue;
        if (slot === 0) cmd.ability1 = true;
        else cmd.ability2 = true;
        break;
      }
    }
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
  spread(state, h, cmd);
  return cmd;
}

/**
 * Step apart from any hero standing too close: hired together and following one leader, henchmen
 * otherwise walk the same line to the same spot and are drawn as one figure. Two on the very same
 * point part along a direction from their ids, so the sim stays free of rolls.
 */
function spread(state: SimState, h: PlayerState, cmd: PlayerCommand): void {
  const gap = tuning.hirelings.spacing;
  let px = 0;
  let pz = 0;
  for (const o of state.players) {
    if (o === h || o.mode === 'down') continue;
    const dx = h.x - o.x;
    const dz = h.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d >= gap) continue;
    const w = (gap - d) / gap;
    if (d > 1e-3) {
      px += (dx / d) * w;
      pz += (dz / d) * w;
    } else {
      // The golden angle apart for each id, so a whole stack fans out rather than pairing off.
      const a = (Number(h.id.replace(/\D/g, '')) || 0) * 2.39996;
      px += Math.sin(a) * w;
      pz += Math.cos(a) * w;
    }
  }
  if (px === 0 && pz === 0) return;
  const x = cmd.moveX + px;
  const z = cmd.moveZ + pz;
  const len = Math.hypot(x, z);
  cmd.moveX = len > 1 ? x / len : x;
  cmd.moveZ = len > 1 ? z / len : z;
}
