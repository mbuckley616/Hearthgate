import { ABILITIES, OFFHAND_ABILITY, abilityTiming, enemyStats, tuning, type AbilityKind } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { damageEnemy, hitstopFor, isTargetable } from './combat';
import { levelFor } from './gear';
import { abilityRank, cooldownMult } from './talents';
import { spawnArrow } from './projectiles';
import type { EnemyState, PlayerCommand, PlayerState, SimState } from './types';

const DEG = Math.PI / 180;

/** Ability ready to use for this slot of the current style? */
export function abilityReady(p: PlayerState, slot: 0 | 1 | 2): boolean {
  // The third is the off-hand's (C4), with its own cooldown.
  if (slot === 2) return !!p.mods.offhand && (p.offhandCooldown ?? 0) <= 0;
  // The second ability unlocks at style level 2 (brief).
  if (slot === 1 && levelFor(p.xp[p.style]) < 2) return false;
  return p.cooldowns[p.style][slot] <= 0;
}

export function startAbility(state: SimState, p: PlayerState, slot: 0 | 1 | 2, cmd: PlayerCommand): void {
  const kind = slot === 2 ? OFFHAND_ABILITY[p.mods.offhand!] : ABILITIES[p.style][slot];
  const timing = abilityTiming(kind);
  p.mode = 'ability';
  p.ability = kind;
  p.abilityTime = 0;
  p.abilityFired = false;
  p.abilityTicks = 0;
  p.abilityHitIds = [];
  p.abilitySeq++;
  p.attackQueued = false;
  if (slot === 2) p.offhandCooldown = timing.cooldown * cooldownMult(p);
  else p.cooldowns[p.style][slot] = timing.cooldown * cooldownMult(p);
  p.vx = 0;
  p.vz = 0;
  // Face the soft target (or the locked one, or the aim) for directional abilities; shots also pitch toward it.
  const target = pickSoftTarget(state, p, cmd, targetingRange(p));
  p.attackTarget = target ? target.id : -1;
  const yaw = target ? Math.atan2(target.x - p.x, target.z - p.z) : Math.atan2(cmd.aimX, cmd.aimZ);
  if (kind !== 'blink' && (target || Math.hypot(cmd.aimX, cmd.aimZ) > 0.01)) p.yaw = yaw;
  state.events.push({ kind: 'ability', playerId: p.id, ability: kind, x: p.x, z: p.z, yaw: p.yaw });
}

/** Advance the current ability one tick. Returns true when it has finished. */
export function stepAbility(
  state: SimState,
  p: PlayerState,
  cmd: PlayerCommand,
  dt: number,
  colliders: readonly Collider[],
): boolean {
  const kind = p.ability;
  const timing = abilityTiming(kind);
  const a = tuning.abilities;
  const tl = tuning.talents;
  const rank = abilityRank(p, kind);
  const t0 = p.abilityTime;
  p.abilityTime += dt;
  const t = p.abilityTime;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);

  // Main effect at the end of the windup.
  if (!p.abilityFired && t >= timing.windup) {
    p.abilityFired = true;
    fire(state, p, kind, cmd, colliders);
  }

  const inActive = t >= timing.windup && t < timing.windup + timing.active;
  switch (kind) {
    case 'charge': {
      if (!inActive || p.abilityHitIds.length > 0) break;
      // Dash, stopping at the first enemy it meets, which staggers.
      const distance = a.chargeDistance + rank * tl.chargeDistancePerRank;
      const step = (distance / Math.max(1e-3, timing.active)) * Math.min(dt, t - Math.max(t0, timing.windup));
      p.x += fx * step;
      p.z += fz * step;
      const hit = state.enemies.find(
        (e) => isTargetable(e) && Math.abs(e.y - p.y) < 1.2 && Math.hypot(e.x - p.x, e.z - p.z) < tuning.movement.radius + enemyStats(e.kind).radius + 0.25,
      );
      if (hit) {
        p.abilityHitIds.push(hit.id);
        damageEnemy(state, hit, {
          attackerId: p.id,
          damage: a.chargeDamage * (1 + rank * tl.chargeDamagePerRank) * tuning.combat.baseDamage,
          poise: 1000,
          knockback: 1.2,
          heavy: true,
          style: p.style,
          dirX: fx,
          dirZ: fz,
          x: hit.x - fx * enemyStats(hit.kind).radius,
          y: hit.y + 1,
          z: hit.z - fz * enemyStats(hit.kind).radius,
        });
        p.hitstop = hitstopFor(true);
        // Skip the rest of the dash.
        p.abilityTime = timing.windup + timing.active;
      }
      break;
    }
    case 'whirlwind': {
      if (!inActive) break;
      // Drift slowly with the move input while spinning.
      const speed = tuning.movement.runSpeed * a.whirlwindMoveFrac;
      const mag = Math.min(1, Math.hypot(cmd.moveX, cmd.moveZ));
      if (mag > 0.01) {
        p.x += (cmd.moveX / mag) * speed * mag * dt;
        p.z += (cmd.moveZ / mag) * speed * mag * dt;
      }
      const due = Math.floor((t - timing.windup) / (a.whirlwindTickMs / 1000)) + 1;
      if (p.abilityTicks < due) {
        p.abilityTicks = due;
        state.events.push({ kind: 'whirlTick', playerId: p.id });
        for (const e of state.enemies) {
          if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
          const er = enemyStats(e.kind).radius;
          const dx = e.x - p.x;
          const dz = e.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > a.whirlwindRadius + rank * tl.whirlwindRadiusPerRank + er) continue;
          damageEnemy(state, e, {
            attackerId: p.id,
            damage: a.whirlwindDamage * (1 + rank * tl.whirlwindDamagePerRank) * tuning.combat.baseDamage,
            poise: 0.8,
            knockback: 0,
            heavy: false,
            style: p.style,
            dirX: d > 1e-3 ? dx / d : fx,
            dirZ: d > 1e-3 ? dz / d : fz,
            x: e.x - (dx / Math.max(d, 1e-3)) * er,
            y: e.y + 1,
            z: e.z - (dz / Math.max(d, 1e-3)) * er,
          });
        }
      }
      break;
    }
    case 'disengage': {
      if (!inActive) break;
      // Backflip away from where the hero faces.
      const u0 = Math.max(0, (t0 - timing.windup) / timing.active);
      const u1 = Math.min(1, (t - timing.windup) / timing.active);
      const ease = (u: number) => 1 - (1 - u) * (1 - u);
      const step = a.disengageDistance * (ease(u1) - ease(Math.max(0, Math.min(1, u0))));
      p.x -= fx * step;
      p.z -= fz * step;
      p.invulnerable = true;
      break;
    }
  }
  if (kind === 'disengage' && !inActive) p.invulnerable = false;

  return t >= timing.windup + timing.active + timing.recovery;
}

function fire(state: SimState, p: PlayerState, kind: AbilityKind, cmd: PlayerCommand, colliders: readonly Collider[]): void {
  const a = tuning.abilities;
  const tl = tuning.talents;
  const rank = abilityRank(p, kind);
  const base = tuning.combat.baseDamage;
  switch (kind) {
    case 'bash': {
      // The shield's bash (C4): the nearest enemy in front is knocked off its feet.
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      let best: EnemyState | null = null;
      let bestD = Infinity;
      for (const e of state.enemies) {
        if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > a.bashRangeM + enemyStats(e.kind).radius || d >= bestD) continue;
        const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - p.yaw), Math.cos(Math.atan2(dx, dz) - p.yaw)));
        if (off > (a.bashArcDeg * DEG) / 2) continue;
        best = e;
        bestD = d;
      }
      if (best) {
        const r = enemyStats(best.kind).radius;
        damageEnemy(state, best, {
          attackerId: p.id,
          damage: a.bashDamage * base,
          poise: 1000,
          knockback: a.bashKnockbackM,
          heavy: true,
          style: p.style,
          dirX: fx,
          dirZ: fz,
          x: best.x - fx * r,
          y: best.y + 1,
          z: best.z - fz * r,
        });
        p.hitstop = hitstopFor(true);
      }
      break;
    }
    case 'volley': {
      state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: true });
      const payload = { damage: a.volleyDamage * (1 + rank * tl.volleyDamagePerRank) * base, poise: 0.8, knockback: 0, heavy: false };
      const n = Math.max(1, Math.round(a.volleyArrows + rank * tl.volleyArrowsPerRank));
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) - 0.5 : 0;
        spawnArrow(state, p, payload, u * a.volleySpreadDeg * DEG, tuning.rangedCombo.arrowSpeed, false);
      }
      // Detonate setup: volley arrows mark what they hit.
      for (const pr of state.projectiles.slice(-n)) pr.marks = true;
      break;
    }
    case 'disengage': {
      state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: false });
      const payload = { damage: a.disengageDamage * (1 + rank * tl.disengageDamagePerRank) * base, poise: 1, knockback: 0, heavy: false };
      spawnArrow(state, p, payload, 0, tuning.rangedCombo.powerArrowSpeed, false, (a.disengageSlowMs + rank * tl.disengageSlowMsPerRank) / 1000);
      break;
    }
    case 'frostRing': {
      const radius = a.frostRingRadius + rank * tl.frostRingRadiusPerRank;
      state.events.push({ kind: 'frostRing', playerId: p.id, x: p.x, z: p.z, radius });
      for (const e of state.enemies) {
        if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > radius + enemyStats(e.kind).radius) continue;
        damageEnemy(state, e, {
          attackerId: p.id,
          damage: a.frostRingDamage * base,
          poise: 1,
          knockback: 0,
          heavy: false,
          style: p.style,
          dirX: d > 1e-3 ? dx / d : 0,
          dirZ: d > 1e-3 ? dz / d : 1,
          x: e.x,
          y: e.y + 1,
          z: e.z,
          freezeTime: (a.frostFreezeMs + rank * tl.frostFreezeMsPerRank) / 1000,
        });
      }
      break;
    }
    case 'blink': {
      // Teleport along the move input (or forward), stopping short of walls and pillars.
      const mag = Math.hypot(cmd.moveX, cmd.moveZ);
      const dir = mag > 0.1 ? { x: cmd.moveX / mag, y: 0, z: cmd.moveZ / mag } : { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
      const origin = { x: p.x, y: 1, z: p.z };
      const free = sphereCast(origin, dir, a.blinkDistance + rank * tl.blinkDistancePerRank, tuning.movement.radius, colliders, (c) => c.blocksMovement);
      const dist = Math.max(0, free - 0.05);
      const from = { x: p.x, z: p.z };
      p.x += dir.x * dist;
      p.z += dir.z * dist;
      p.nextBoltCrit = true;
      state.events.push({ kind: 'blink', playerId: p.id, fromX: from.x, fromZ: from.z, toX: p.x, toZ: p.z });
      break;
    }
  }
}

/**
 * Soft targeting (brief): the best enemy in a cone around the aim, within the
 * style's range. A locked target wins if it's in range.
 */
export function pickSoftTarget(state: SimState, p: PlayerState, cmd: PlayerCommand, range: number): EnemyState | null {
  const tg = tuning.targeting;
  const lock = state.enemies.find((e) => e.id === cmd.lockTarget && isTargetable(e));
  if (lock && Math.hypot(lock.x - p.x, lock.z - p.z) <= range * 1.25) return lock;
  const aimYaw = Math.hypot(cmd.aimX, cmd.aimZ) > 0.01 ? Math.atan2(cmd.aimX, cmd.aimZ) : p.yaw;
  let best: EnemyState | null = null;
  let bestScore = Infinity;
  for (const e of state.enemies) {
    if (!isTargetable(e)) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > range) continue;
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.x - p.x, e.z - p.z) - aimYaw), Math.cos(Math.atan2(e.x - p.x, e.z - p.z) - aimYaw)));
    if (off > (tg.coneDeg * DEG) / 2) continue;
    // Prefer close and centred.
    const score = d * (1 + off * 2);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Range used for soft targeting by the current style. */
export function targetingRange(p: PlayerState): number {
  return p.style === 'sword' ? tuning.targeting.meleeRange : tuning.targeting.rangedRange;
}
