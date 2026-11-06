import { ABILITIES, OFFHAND_ABILITY, abilityTiming, enemyStats, tuning, type AbilityKind } from '../config/tuning';
import type { PropInfo } from '../level/floor';
import { sphereCast, type Collider } from '../level/geometry';
import { damageEnemy, hitstopFor, isTargetable, type HitSpec } from './combat';
import { levelFor } from './gear';
import { abilityRank, cooldownMult } from './talents';
import { spawnArrow } from './projectiles';
import { smashArc, smashCircle } from './smash';
import { bladeStorm, brambleRain, consecrate, curseRing, elementalNova, novaElement, galeStep, isCurseRing, isThornRing, shadowSwap, thornRing, smokeBomb, snareTrap, fanOfKnives, shadowstep, taunt, wildGrowth } from './specs';
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

export function startAbility(state: SimState, p: PlayerState, slot: 0 | 1 | 2, cmd: PlayerCommand, colliders: readonly Collider[] = []): void {
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
  // Free aim (D12): the reticle, as for an attack.
  const target = freeAim(p, cmd) ? null : pickSoftTarget(state, p, cmd, targetingRange(p), colliders);
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
  props?: readonly PropInfo[],
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
    fire(state, p, kind, cmd, colliders, props);
  }

  const inActive = t >= timing.windup && t < timing.windup + timing.active;
  switch (kind) {
    case 'charge': {
      if (!inActive || p.abilityHitIds.length > 0) break;
      // A Rogue's first tick of the dash is a step behind its target instead (Shadowstep).
      const stepped = t0 < timing.windup ? shadowstep(state, p, colliders) : null;
      const sx = stepped ? Math.sin(p.yaw) : fx;
      const sz = stepped ? Math.cos(p.yaw) : fz;
      if (!stepped) {
        // Dash, stopping at the first enemy it meets, which staggers.
        const distance = a.chargeDistance + rank * tl.chargeDistancePerRank;
        const step = (distance / Math.max(1e-3, timing.active)) * Math.min(dt, t - Math.max(t0, timing.windup));
        p.x += fx * step;
        p.z += fz * step;
        smashCircle(state, props, p.id, p.x, p.y, p.z, tuning.movement.radius + 0.25);
      }
      const hit =
        stepped ??
        state.enemies.find(
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
          dirX: sx,
          dirZ: sz,
          x: hit.x - sx * enemyStats(hit.kind).radius,
          y: hit.y + 1,
          z: hit.z - sz * enemyStats(hit.kind).radius,
        });
        taunt(state, p, hit);
        p.hitstop = hitstopFor(true);
        // Skip the rest of the dash.
        p.abilityTime = timing.windup + timing.active;
      }
      break;
    }
    case 'whirlwind': {
      if (!inActive) break;
      bladeStorm(state, p);
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
        smashCircle(state, props, p.id, p.x, p.y, p.z, a.whirlwindRadius + rank * tl.whirlwindRadiusPerRank);
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
  // The Paladin's spin leaves its ring where it ends (Consecrate).
  if (kind === 'whirlwind' && t0 < timing.windup + timing.active && t >= timing.windup + timing.active) consecrate(state, p);
  // Charge's dash slips hits as a roll does (C6), until it lands on someone or runs its length.
  if (kind === 'charge' && tuning.abilities.meleeGuard) p.invulnerable = p.abilityTime >= timing.windup && p.abilityTime < timing.windup + timing.active;

  return t >= timing.windup + timing.active + timing.recovery;
}

function fire(state: SimState, p: PlayerState, kind: AbilityKind, cmd: PlayerCommand, colliders: readonly Collider[], props?: readonly PropInfo[]): void {
  const a = tuning.abilities;
  const tl = tuning.talents;
  const rank = abilityRank(p, kind);
  const base = tuning.combat.baseDamage;
  switch (kind) {
    case 'whirlwind':
      fanOfKnives(state, p);
      break;
    case 'ward': {
      // The tome's ward (C5): the next hit on this hero and every ally near is absorbed, for a while.
      for (const o of state.players) {
        if (o.mode === 'down' || Math.hypot(o.x - p.x, o.z - p.z) > a.wardRadiusM) continue;
        o.ward = { hits: 1, until: state.time + a.wardSeconds };
      }
      break;
    }
    case 'quickShot': {
      // The hand crossbow (C5): two bolts from the off hand, a little apart.
      state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: false });
      const payload = { damage: a.quickShotDamage * base, poise: 1, knockback: 0, heavy: false };
      for (const u of [-0.04, 0.04]) spawnArrow(state, p, payload, u, tuning.rangedCombo.arrowSpeed, false);
      break;
    }
    case 'bash': {
      // The shield's bash (C4): the nearest enemy in front is knocked off its feet.
      // A bash breaks a secret's cracked wall too (G5's C).
      smashArc(state, props, p, p.x, p.z, a.bashRangeM, a.bashArcDeg, true);
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
      brambleRain(state, p, colliders);
      break;
    }
    case 'disengage': {
      state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: false });
      const payload = { damage: a.disengageDamage * (1 + rank * tl.disengageDamagePerRank) * base, poise: 1, knockback: 0, heavy: false };
      spawnArrow(state, p, payload, 0, tuning.rangedCombo.powerArrowSpeed, false, (a.disengageSlowMs + rank * tl.disengageSlowMsPerRank) / 1000);
      // Fired before the backflip moves the hero, so the trap is where they stood.
      snareTrap(state, p);
      galeStep(state, p, abilityTiming('disengage').active);
      smokeBomb(state, p);
      break;
    }
    case 'frostRing': {
      const radius = a.frostRingRadius + rank * tl.frostRingRadiusPerRank;
      // Curse Ring (the Warlock's): the same ring in shadow, hexing where it would freeze.
      const curse = isCurseRing(p);
      // Thorn Ring (the Druid's): thorns that root where the ring would freeze.
      const thorns = isThornRing(p);
      // Elemental Nova (the Sorcerer's): a ring of their element; a Frost Sorcerer's is the frost ring.
      const element = novaElement(p);
      state.events.push({ kind: 'frostRing', playerId: p.id, x: p.x, z: p.z, radius, ...(curse ? { curse } : {}), ...(thorns ? { thorns } : {}), ...(element ? { element } : {}) });
      smashCircle(state, props, p.id, p.x, p.y, p.z, radius);
      for (const e of state.enemies) {
        if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > radius + enemyStats(e.kind).radius) continue;
        const hit: HitSpec = {
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
          freezeTime: curse || thorns ? undefined : (a.frostFreezeMs + rank * tl.frostFreezeMsPerRank) / 1000,
        };
        elementalNova(p, hit);
        damageEnemy(state, e, hit);
        curseRing(state, p, e);
        thornRing(state, p, e);
      }
      break;
    }
    case 'blink': {
      // A Warlock's Blink trades places with its target instead (Shadow Swap); the bolt after still crits.
      if (shadowSwap(state, p, a.blinkDistance + rank * tl.blinkDistancePerRank)) {
        p.nextBoltCrit = true;
        break;
      }
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
      // A Druid leaves a healing grove where they stood (Wild Growth).
      const grove = wildGrowth(state, p, from.x, from.z);
      state.events.push({ kind: 'blink', playerId: p.id, fromX: from.x, fromZ: from.z, toX: p.x, toZ: p.z, ...(grove ? { grove } : {}) });
      break;
    }
  }
}

/**
 * Soft targeting (brief): the best enemy in a cone around the aim, within the
 * style's range. A locked target wins if it's in range.
 */
/**
 * Free aim (D12): a ranged weapon, no lock-on, and the browser sent a pitch. Shots go exactly through
 * the reticle, with no soft target to turn them; lock-on keeps the slice's aim.
 */
export function freeAim(p: PlayerState, cmd: PlayerCommand): boolean {
  return cmd.aimPitch !== undefined && cmd.lockTarget < 0 && p.style !== 'sword' && Math.hypot(cmd.aimX, cmd.aimZ) > 0.01;
}

export function pickSoftTarget(state: SimState, p: PlayerState, cmd: PlayerCommand, range: number, colliders: readonly Collider[] = []): EnemyState | null {
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
    // Behind a wall: a lunge toward it would only press the hero into the stone.
    if (tuning.combat.sweepFastMoves && !canSee(p, e, d, colliders)) continue;
    // Prefer close and centred.
    const score = d * (1 + off * 2);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Is the enemy in plain view of the hero, chest to chest, past walls and pillars? */
function canSee(p: PlayerState, e: EnemyState, d: number, colliders: readonly Collider[]): boolean {
  if (d < 0.5 || colliders.length === 0) return true;
  const from = { x: p.x, y: p.y + 1.1, z: p.z };
  const dy = e.y + 1.1 - from.y;
  const len = Math.hypot(d, dy);
  const hit = sphereCast(from, { x: (e.x - p.x) / len, y: dy / len, z: (e.z - p.z) / len }, len, 0.12, colliders, (c) => c.blocksMovement);
  return hit >= len - (enemyStats(e.kind).radius + 0.2);
}

/** Range used for soft targeting by the current style. */
export function targetingRange(p: PlayerState): number {
  return p.style === 'sword' ? tuning.targeting.meleeRange : tuning.targeting.rangedRange;
}
