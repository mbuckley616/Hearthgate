import { enemyStats, tuning, type ComboHit } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { damageEnemy, heroInvulnerable, hurtHero, isTargetable } from './combat';
import { abilityRank } from './talents';
import type { EnemyState, PlayerState, ProjectileState, SimState } from './types';

const PROJECTILE_RADIUS = 0.04;
/** Where projectiles leave the hero, relative to its feet and facing. */
const ARROW_ORIGIN = { forward: 0.5, up: 1.45 };
const BOLT_ORIGIN = { forward: 0.75, up: 1.5 };

const blocksProjectiles = (c: Collider) => c.blocksMovement || c.blocksCamera;

type Payload = Pick<ComboHit, 'damage' | 'poise' | 'knockback' | 'heavy'>;

function spawn(
  state: SimState,
  p: PlayerState,
  payload: Payload,
  partial: Partial<ProjectileState> & Pick<ProjectileState, 'kind'>,
): void {
  state.projectiles.push({
    id: state.nextId++,
    owner: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    life: 1,
    stuck: false,
    charged: false,
    radius: 0,
    damage: payload.damage,
    poise: payload.poise,
    knockback: payload.knockback,
    heavy: payload.heavy,
    pierce: 1,
    hitIds: [],
    slowTime: 0,
    resolved: false,
    targetId: -1,
    homingLeft: 0,
    crit: false,
    hostile: false,
    style: p.style,
    chained: false,
    marks: false,
    comboed: false,
    ...partial,
  });
}

/** A remote player's late parry of an arrow that's already gone: send a fresh one back from them. */
export function reflectFromHero(state: SimState, p: PlayerState, damage: number, shooterId: number): void {
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const speed = tuning.archer.arrowSpeed;
  spawn(state, p, { damage, poise: 0, knockback: 0, heavy: false }, {
    kind: 'arrow',
    x: p.x + fx * 0.6,
    y: p.y + 1.3,
    z: p.z + fz * 0.6,
    vx: -fx * speed,
    vz: -fz * speed,
    life: 2,
    hostile: true,
    owner: `e${shooterId}`,
  });
  reflectArrow(state, state.projectiles[state.projectiles.length - 1], p, shooterId);
}

/** A parried enemy arrow turns around and flies back at its archer, as the hero's own shot. */
function reflectArrow(state: SimState, pr: ProjectileState, p: PlayerState, shooterId: number): void {
  const speed = Math.hypot(pr.vx, pr.vy, pr.vz);
  const archer = state.enemies.find((e) => e.id === shooterId && isTargetable(e));
  let dx = -pr.vx;
  let dy = -pr.vy;
  let dz = -pr.vz;
  if (archer) {
    dx = archer.x - pr.x;
    dy = archer.y + 1.2 - pr.y;
    dz = archer.z - pr.z;
  }
  const len = Math.hypot(dx, dy, dz) || 1;
  pr.vx = (dx / len) * speed;
  pr.vy = (dy / len) * speed;
  pr.vz = (dz / len) * speed;
  pr.hostile = false;
  pr.owner = p.id;
  pr.style = p.style;
  pr.damage *= tuning.guard.reflectDamageMult;
  pr.poise = 2;
  pr.charged = true;
  pr.hitIds = [];
  pr.pierce = 1;
  pr.age = 0;
  pr.life = 2;
}

/** Arrow along the hero's facing, turned by yawOffset (radians). */
export function spawnArrow(
  state: SimState,
  p: PlayerState,
  payload: Payload,
  yawOffset: number,
  speed: number,
  charged: boolean,
  slowTime = 0,
): void {
  const r = tuning.rangedCombo;
  const yaw = p.yaw + yawOffset;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const pitch = aimPitch(state, p, p.y + ARROW_ORIGIN.up);
  spawn(state, p, payload, {
    kind: 'arrow',
    x: p.x + fx * ARROW_ORIGIN.forward,
    y: p.y + ARROW_ORIGIN.up,
    z: p.z + fz * ARROW_ORIGIN.forward,
    vx: fx * speed * Math.cos(pitch),
    vy: speed * Math.sin(pitch),
    vz: fz * speed * Math.cos(pitch),
    life: r.arrowLifeMs / 1000,
    charged,
    pierce: charged ? Math.max(1, Math.round(r.powerPierce)) : 1,
    // Hunter perk: power and piercing shots slow.
    slowTime: slowTime || (charged && p.mods.perks.includes('hunter') ? tuning.gear.hunterSlowMs / 1000 : 0),
  });
}

/** Frost bolt along the hero's facing, turned by yawOffset (radians), curving toward targetId if given. */
export function spawnBolt(state: SimState, p: PlayerState, payload: Payload, yawOffset: number, targetId = -1, crit = false): void {
  const m = tuning.magicCombo;
  const yaw = p.yaw + yawOffset;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const pitch = aimPitch(state, p, p.y + BOLT_ORIGIN.up);
  spawn(state, p, payload, {
    kind: 'bolt',
    x: p.x + fx * BOLT_ORIGIN.forward,
    y: p.y + BOLT_ORIGIN.up,
    z: p.z + fz * BOLT_ORIGIN.forward,
    vx: fx * m.boltSpeed * Math.cos(pitch),
    vy: m.boltSpeed * Math.sin(pitch),
    vz: fz * m.boltSpeed * Math.cos(pitch),
    life: m.boltLifeMs / 1000,
    targetId,
    homingLeft: targetId >= 0 ? tuning.targeting.boltHomingDeg * (Math.PI / 180) : 0,
    crit,
    damage: crit ? payload.damage * (tuning.abilities.blinkCritMultiplier + abilityRank(p, 'blink') * tuning.talents.blinkCritPerRank) : payload.damage,
  });
}

/**
 * Vertical aim toward the soft target's chest, so shots reach archers on the
 * ledge (or heroes on it can shoot down). Level when there's no target.
 */
function aimPitch(state: SimState, p: PlayerState, originY: number): number {
  const t = state.enemies.find((e) => e.id === p.attackTarget && isTargetable(e));
  if (!t) return 0;
  const dy = t.y + enemyStats(t.kind).height * 0.6 - originY;
  const d = Math.max(0.5, Math.hypot(t.x - p.x, t.z - p.z));
  return Math.atan2(dy, d);
}

/** Burst lands `range` ahead, or just short of the first wall or pillar in the way. */
export function spawnBurst(
  state: SimState,
  p: PlayerState,
  payload: Payload,
  colliders: readonly Collider[],
  range: number,
  radius: number,
): void {
  const m = tuning.magicCombo;
  const dir = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  const origin = { x: p.x, y: p.y + 1, z: p.z };
  const d = range > 0 ? sphereCast(origin, dir, range, 0.2, colliders, (c) => c.blocksMovement) : 0;
  const reach = Math.max(0, d - 0.3);
  spawn(state, p, payload, {
    kind: 'burst',
    x: p.x + dir.x * reach,
    y: p.y,
    z: p.z + dir.z * reach,
    life: m.burstLifeMs / 1000,
    radius,
    slowTime: m.burstSlowMs / 1000,
  });
}

/**
 * Distance along the segment (origin + dir * t, t in [0, len]) where it first
 * comes within reach of a standing enemy's body, or Infinity.
 */
function segmentHitsEnemy(pr: ProjectileState, dir: { x: number; y: number; z: number }, len: number, e: EnemyState): number {
  const s = enemyStats(e.kind);
  return segmentHitsCapsule(pr, dir, len, e.x, e.y, e.z, s.radius, s.height);
}

/** Distance along the segment where it first enters a standing body (vertical cylinder), or Infinity. */
function segmentHitsCapsule(
  pr: ProjectileState,
  dir: { x: number; y: number; z: number },
  len: number,
  bx: number,
  by: number,
  bz: number,
  radius: number,
  height: number,
): number {
  const e = { x: bx, y: by, z: bz };
  const s = { radius, height };
  const r = s.radius + PROJECTILE_RADIUS;
  // Closest approach in the ground plane, then check height at that point.
  const ox = pr.x - e.x;
  const oz = pr.z - e.z;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-8) return Infinity;
  const b = 2 * (ox * dir.x + oz * dir.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a));
  if (t > len) return Infinity;
  const y = pr.y + dir.y * t;
  return y >= e.y && y <= e.y + s.height ? t : Infinity;
}

function hitWithProjectile(state: SimState, pr: ProjectileState, e: EnemyState, dir: { x: number; z: number }): void {
  const len = Math.hypot(dir.x, dir.z) || 1;
  // Skewer payoff: a charged shot through melee-staggered enemies hits harder and doesn't stop.
  const skewer = pr.kind === 'arrow' && pr.charged && e.skewerUntil >= state.time;
  if (skewer && !pr.comboed) {
    pr.comboed = true;
    state.events.push({ kind: 'combo', combo: 'skewer', playerId: pr.owner, x: e.x, y: e.y + 1.2, z: e.z });
  }
  damageEnemy(state, e, {
    projectile: true,
    attackerId: pr.owner,
    damage: pr.damage * (skewer ? 1 + tuning.combos.skewerDamageBonus : 1),
    poise: pr.poise,
    knockback: pr.knockback,
    heavy: pr.heavy,
    dirX: dir.x / len,
    dirZ: dir.z / len,
    x: pr.x,
    y: pr.y,
    z: pr.z,
    slowTime: pr.slowTime,
    crit: pr.crit,
    style: pr.style,
    combo: skewer || undefined,
  });
  pr.hitIds.push(e.id);
  // Detonate setup: volley arrows mark.
  if (pr.marks) e.detonateUntil = state.time + tuning.combos.windowMs / 1000;
  if (!skewer) pr.pierce--;
  if (pr.kind === 'bolt' && !pr.chained) chainBolt(state, pr, e);
}

export function stepProjectiles(state: SimState, dt: number, colliders: readonly Collider[]): void {
  for (const pr of state.projectiles) {
    pr.age += dt;
    pr.life -= dt;

    if (pr.kind === 'burst') {
      // Bursts hit everything inside the radius once, as they land.
      if (!pr.resolved) {
        pr.resolved = true;
        // Detonate payoff: a burst that catches a marked enemy grows and hits harder.
        const marked = state.enemies.some(
          (e) => isTargetable(e) && e.detonateUntil >= state.time && Math.abs(e.y - pr.y) <= 1.2 && Math.hypot(e.x - pr.x, e.z - pr.z) <= pr.radius + enemyStats(e.kind).radius,
        );
        const cb = tuning.combos;
        if (marked && pr.owner[0] !== 'e') {
          pr.radius *= 1 + cb.detonateRadiusBonus;
          pr.damage *= 1 + cb.detonateDamageBonus;
          state.events.push({ kind: 'combo', combo: 'detonate', playerId: pr.owner, x: pr.x, y: pr.y + 1, z: pr.z });
        }
        for (const e of state.enemies) {
          if (!isTargetable(e) || Math.abs(e.y - pr.y) > 1.2) continue;
          const dx = e.x - pr.x;
          const dz = e.z - pr.z;
          const d = Math.hypot(dx, dz);
          if (d > pr.radius + enemyStats(e.kind).radius) continue;
          if (marked) e.detonateUntil = -1;
          damageEnemy(state, e, {
            projectile: true,
            attackerId: pr.owner,
            damage: pr.damage,
            poise: pr.poise,
            knockback: pr.knockback,
            heavy: pr.heavy,
            dirX: d > 1e-3 ? dx / d : 0,
            dirZ: d > 1e-3 ? dz / d : 1,
            x: e.x,
            y: e.y + 1,
            z: e.z,
            slowTime: pr.slowTime,
            style: pr.style,
            combo: marked || undefined,
          });
        }
      }
      continue;
    }
    if (pr.stuck) continue;

    if (pr.kind === 'arrow') pr.vy -= tuning.rangedCombo.arrowGravity * dt;
    if (pr.kind === 'bolt' && pr.homingLeft > 0) steerBolt(state, pr, dt);
    const speed = Math.hypot(pr.vx, pr.vy, pr.vz);
    let dist = speed * dt;
    if (dist < 1e-6) continue;
    const dir = { x: pr.vx / speed, y: pr.vy / speed, z: pr.vz / speed };
    const wall = sphereCast(pr, dir, dist, PROJECTILE_RADIUS, colliders, blocksProjectiles);

    // Enemy arrows hit heroes (dodge i-frames let them pass), and nothing else.
    if (pr.hostile) {
      const hit = Math.min(dist, wall);
      for (const p of state.players) {
        if (heroInvulnerable(p)) continue;
        const t = segmentHitsCapsule(pr, dir, hit, p.x, p.y, p.z, tuning.movement.radius, tuning.movement.height);
        if (t < Infinity) {
          const shooter = Number(pr.owner.slice(1));
          const result = hurtHero(state, p, { damage: pr.damage, fromX: pr.x - dir.x * 3, fromZ: pr.z - dir.z * 3, enemyId: shooter, arrow: true });
          if (result === 'parried') reflectArrow(state, pr, p, shooter);
          else pr.life = 0;
          break;
        }
      }
      if (pr.life <= 0 || !pr.hostile) continue;
      pr.x += dir.x * hit;
      pr.y += dir.y * hit;
      pr.z += dir.z * hit;
      if (wall < dist) pr.life = 0;
      continue;
    }

    // Enemies in the way, nearest first, up to the projectile's pierce.
    const hits = state.enemies
      .filter((e) => isTargetable(e) && !pr.hitIds.includes(e.id))
      .map((e) => ({ e, t: segmentHitsEnemy(pr, dir, Math.min(dist, wall), e) }))
      .filter((h) => h.t < Infinity)
      .sort((a, b) => a.t - b.t);
    let travelled = 0;
    for (const h of hits) {
      if (pr.pierce <= 0) break;
      pr.x += dir.x * (h.t - travelled);
      pr.y += dir.y * (h.t - travelled);
      pr.z += dir.z * (h.t - travelled);
      travelled = h.t;
      hitWithProjectile(state, pr, h.e, dir);
    }
    if (pr.pierce <= 0) {
      pr.life = 0;
      continue;
    }
    dist -= travelled;

    const hit = Math.max(0, Math.min(dist, wall - travelled));
    pr.x += dir.x * hit;
    pr.y += dir.y * hit;
    pr.z += dir.z * hit;
    if (wall - travelled < dist) {
      if (pr.kind === 'arrow') {
        // Embed a little and stay for a while; velocity is kept so the view knows its angle.
        pr.x += dir.x * 0.12;
        pr.y += dir.y * 0.12;
        pr.z += dir.z * 0.12;
        pr.stuck = true;
        pr.life = tuning.rangedCombo.stuckArrowLifeMs / 1000;
      } else {
        pr.life = 0;
      }
    }
  }
  state.projectiles = state.projectiles.filter((pr) => pr.life > 0);
}

/** Bolts curve toward their target, a limited total amount (brief: "Homes up to 15 degrees"). */
function steerBolt(state: SimState, pr: ProjectileState, dt: number): void {
  const target = state.enemies.find((e) => e.id === pr.targetId);
  if (!target || !isTargetable(target)) {
    pr.homingLeft = 0;
    return;
  }
  const heading = Math.atan2(pr.vx, pr.vz);
  const desired = Math.atan2(target.x - pr.x, target.z - pr.z);
  const diff = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
  const step = Math.min(Math.abs(diff), tuning.targeting.boltHomingRateDeg * (Math.PI / 180) * dt, pr.homingLeft);
  pr.homingLeft -= step;
  const yaw = heading + Math.sign(diff) * step;
  const speed = Math.hypot(pr.vx, pr.vz);
  pr.vx = Math.sin(yaw) * speed;
  pr.vz = Math.cos(yaw) * speed;
}

/** Chain perk: a bolt that hits jumps to the nearest other enemy nearby, weaker. */
function chainBolt(state: SimState, pr: ProjectileState, from: EnemyState): void {
  const owner = state.players.find((p) => p.id === pr.owner);
  if (!owner || !owner.mods.perks.includes('chainBolt')) return;
  const g = tuning.gear;
  const next = state.enemies
    .filter((e) => e !== from && isTargetable(e) && !pr.hitIds.includes(e.id))
    .map((e) => ({ e, d: Math.hypot(e.x - from.x, e.z - from.z) }))
    .filter((c) => c.d <= g.chainBoltRange)
    .sort((a, b) => a.d - b.d)[0];
  if (!next) return;
  const t = next.e;
  const from3 = { x: from.x, y: from.y + enemyStats(from.kind).height * 0.6, z: from.z };
  const to = { x: t.x, y: t.y + enemyStats(t.kind).height * 0.6, z: t.z };
  const dx = to.x - from3.x;
  const dy = to.y - from3.y;
  const dz = to.z - from3.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const speed = tuning.magicCombo.boltSpeed;
  // Start just outside the first target so it doesn't hit it again.
  const start = enemyStats(from.kind).radius + 0.15;
  state.projectiles.push({
    ...pr,
    id: state.nextId++,
    x: from3.x + (dx / len) * start,
    y: from3.y + (dy / len) * start,
    z: from3.z + (dz / len) * start,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    vz: (dz / len) * speed,
    age: 0,
    life: tuning.magicCombo.boltLifeMs / 1000,
    damage: pr.damage * g.chainBoltDamageFrac,
    pierce: 1,
    hitIds: [from.id],
    targetId: t.id,
    homingLeft: 0.5,
    crit: false,
    chained: true,
  });
  state.events.push({ kind: 'perk', playerId: owner.id, perk: 'chainBolt', x: from.x, z: from.z });
}
