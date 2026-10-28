import { enemyStats, tuning, type Style } from '../config/tuning';
import { championCombo, championDamage, championOpen, championPointsEarned, championPoise } from './champion';
import { levelFor } from './gear';
import { damageTakenMult, parryWindowMs, talentDamage, talentFinisher, talentPoise } from './talents';
import type { EnemyState, HeroHit, PlayerState, SimState } from './types';

/** What a single hit carries (from a swing, projectile or burst). */
export interface HitSpec {
  attackerId: string;
  damage: number;
  poise: number;
  /** Metres of knockback; 0 = none. */
  knockback: number;
  heavy: boolean;
  /** Direction the hit pushes, on the ground plane (unit). */
  dirX: number;
  dirZ: number;
  /** Contact point for sparks and numbers. */
  x: number;
  y: number;
  z: number;
  /** Seconds of slow to apply (bursts, the disengage arrow). */
  slowTime?: number;
  /** Seconds to freeze (frost ring). */
  freezeTime?: number;
  /** Blink-primed bolt. */
  crit?: boolean;
  /** Hero style that dealt it: XP goes to that style, and its level/gear bonuses apply. */
  style?: Style;
  /** Damage over time (bleed): no hitstop, flinch or poise. */
  dot?: boolean;
  /** Dealt by a projectile or burst (the host's call); otherwise a joiner predicts it locally. */
  projectile?: boolean;
  /** A Skewer or Detonate payoff (Shatter is found here), for the Finisher talent. */
  combo?: boolean;
}

/** Damage multiplier for a hero's style: level 4 bonus, gear and the might talent. */
export function styleDamageBonus(p: PlayerState, style: Style): number {
  return (levelFor(p.xp[style]) >= 4 ? tuning.progression.level4DamageBonus : 0) + p.mods.damage[style] + talentDamage(p, style) + championDamage(p);
}

/** Add XP to a hero's style, announcing any level crossed. */
export function grantXp(state: SimState, p: PlayerState, style: Style, amount: number): void {
  const before = levelFor(p.xp[style]);
  p.xp[style] += amount;
  const after = levelFor(p.xp[style]);
  for (let l = before + 1; l <= after; l++) state.events.push({ kind: 'levelUp', playerId: p.id, style, level: l });
  // Past the top level in any weapon, every weapon's XP also banks toward champion points.
  if (p.champion && championOpen(p.xp)) {
    const had = championPointsEarned(p.champion.xp);
    p.champion.xp += amount;
    const now = championPointsEarned(p.champion.xp);
    if (now > had) state.events.push({ kind: 'championPoint', playerId: p.id, points: now });
  }
}

const ATTACKING = new Set(['windup', 'slash1', 'between', 'slash2', 'aim', 'shoot']);

/** Light enemies flinch and get knocked out of their attacks; brutes and the Warden only stagger. */
function isLight(e: EnemyState): boolean {
  return e.kind === 'grunt' || e.kind === 'archer';
}

export function isTargetable(e: EnemyState): boolean {
  return e.ai !== 'dead' && e.ai !== 'spawn';
}

export function hitstopFor(heavy: boolean): number {
  return (heavy ? tuning.hitFeel.hitstopHeavyMs : tuning.hitFeel.hitstopLightMs) / 1000;
}

function clearTelegraph(e: EnemyState): void {
  e.tele.shape = 'none';
}

/**
 * Apply a hit to an enemy: damage (bonus while staggered), poise and stagger,
 * knockback or flinch, hitstop and the hit event. Returns false if it couldn't be hit.
 */
export function damageEnemy(state: SimState, e: EnemyState, hit: HitSpec): boolean {
  if (!isTargetable(e)) return false;
  const c = tuning.combat;
  const stats = enemyStats(e.kind);
  const staggered = e.ai === 'stagger';
  const hero = state.players.find((p) => p.id === hit.attackerId);
  const bonus = hero && hit.style ? styleDamageBonus(hero, hit.style) : 0;
  const poiseBonus = hero && hit.style ? hero.mods.poise[hit.style] + talentPoise(hero, hit.style) + championPoise(hero) : 0;
  // Shatter: a melee finisher on a slowed or frozen enemy (brief: cross-style combos).
  const cb = tuning.combos;
  const shatter = hit.style === 'sword' && hit.heavy && !hit.dot && e.shatterUntil >= state.time;
  if (shatter) e.shatterUntil = -1;
  const finisher = hero && hit.style && (shatter || hit.combo) ? talentFinisher(hero, hit.style) + championCombo(hero) : 0;
  const damage = hit.damage * (1 + bonus) * (staggered ? 1 + c.staggerDamageBonus : 1) * (shatter ? 1 + cb.shatterDamageBonus : 1) * (1 + finisher);
  e.hp -= damage;
  e.lastHitAt = state.time;
  if (hero && hit.style) grantXp(state, hero, hit.style, Math.min(damage, damage + e.hp) * tuning.progression.xpPerDamage);
  if (hit.dot) {
    // Bleed ticks: just damage (and a kill if it finishes them).
    if (e.hp <= 0) killEnemy(state, e, stats.knockbackTaken);
    state.events.push({ kind: 'hit', x: hit.x, y: hit.y, z: hit.z, enemyId: e.id, attackerId: hit.attackerId, damage, heavy: false, bonus: false, crit: false, killed: e.hp <= 0, dirX: 0, dirZ: 0, local: false });
    return true;
  }
  e.poiseWait = c.poiseRegenDelayMs / 1000;
  e.hitstop = Math.max(e.hitstop, hitstopFor(hit.heavy));
  if (hero && hit.heavy) {
    hero.lastFinisherAt = state.time;
    // Bleed perk: finishers with the sword open a wound.
    if (hit.style === 'sword' && hero.mods.perks.includes('bleed')) {
      e.bleedTicks = tuning.gear.bleedTicks;
      e.bleedTimer = tuning.gear.bleedTickMs / 1000;
      e.bleedOwner = hero.id;
      state.events.push({ kind: 'perk', playerId: hero.id, perk: 'bleed', x: e.x, z: e.z });
    }
  }
  if (hit.slowTime) e.slowTime = Math.max(e.slowTime, hit.slowTime);
  // Shatter setup: magic that slows or freezes.
  if (hit.style === 'staff' && (hit.slowTime || hit.freezeTime)) e.shatterUntil = state.time + cb.windowMs / 1000;
  if (hit.freezeTime) {
    e.frozen = Math.max(e.frozen, hit.freezeTime * (isLight(e) ? 1 : 0.5));
    state.events.push({ kind: 'freeze', enemyId: e.id });
  }

  const killed = e.hp <= 0;
  let push = hit.knockback * stats.knockbackTaken;
  if (killed) {
    killEnemy(state, e, stats.knockbackTaken);
    push = Math.max(push, 1.2 * stats.knockbackTaken);
  } else if (!staggered) {
    e.poise -= hit.poise * (1 + poiseBonus);
    // A roar is a commitment: it can't be staggered out of (poise still drains).
    if (e.poise <= 0 && e.ai !== 'roar') {
      staggerEnemy(state, e);
      // Skewer setup: a melee stagger.
      if (hit.style === 'sword') e.skewerUntil = state.time + cb.windowMs / 1000;
    } else if (isLight(e) && (push > 0.2 || hit.freezeTime) && ATTACKING.has(e.ai)) {
      // Knockback breaks a light enemy's attack and gives the player an opening.
      e.ai = 'recover';
      e.aiTime = 0;
      e.recoverTime = 0.5;
      clearTelegraph(e);
    } else if (isLight(e) && push <= 0.2) {
      e.flinch = Math.max(e.flinch, c.flinchMs / 1000);
    }
  }
  if (push > 0) {
    // Exponential slide: covers push metres in total.
    const v = push * c.knockbackFriction;
    e.kbx = hit.dirX * v;
    e.kbz = hit.dirZ * v;
  }

  state.events.push({
    kind: 'hit',
    x: hit.x,
    y: hit.y,
    z: hit.z,
    enemyId: e.id,
    attackerId: hit.attackerId,
    damage,
    heavy: hit.heavy,
    bonus: staggered,
    crit: !!hit.crit,
    killed,
    dirX: hit.dirX,
    dirZ: hit.dirZ,
    local: !hit.projectile,
  });
  if (shatter) shatterAround(state, e, hit);
  return true;
}

/** Shatter payoff: the finisher bursts out into the enemies around. */
function shatterAround(state: SimState, e: EnemyState, hit: HitSpec): void {
  const cb = tuning.combos;
  state.events.push({ kind: 'combo', combo: 'shatter', playerId: hit.attackerId, x: e.x, y: e.y + 1, z: e.z });
  for (const o of state.enemies) {
    if (o === e || !isTargetable(o) || Math.abs(o.y - e.y) > 1.2) continue;
    const dx = o.x - e.x;
    const dz = o.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > cb.shatterRadius + enemyStats(o.kind).radius) continue;
    damageEnemy(state, o, {
      attackerId: hit.attackerId,
      damage: hit.damage * cb.shatterSplashFrac,
      poise: hit.poise * 0.5,
      knockback: 1,
      heavy: false,
      style: hit.style,
      dirX: d > 1e-3 ? dx / d : 0,
      dirZ: d > 1e-3 ? dz / d : 1,
      x: o.x,
      y: o.y + 1,
      z: o.z,
    });
  }
}

/** Poise broken (or parried): open for the stagger window. */
function staggerEnemy(state: SimState, e: EnemyState): void {
  e.poise = 0;
  e.ai = 'stagger';
  e.aiTime = 0;
  e.hasToken = false;
  clearTelegraph(e);
  state.events.push({ kind: 'stagger', enemyId: e.id, x: e.x, z: e.z });
}

function killEnemy(state: SimState, e: EnemyState, _knockbackTaken: number): void {
  e.hp = 0;
  e.ai = 'dead';
  e.aiTime = 0;
  e.hasToken = false;
  e.bleedTicks = 0;
  clearTelegraph(e);
  // Drops appear where the last enemy fell; the Warden's spot wins once it's down.
  const r = state.run;
  if (!r.bossDown || e.kind === 'warden') {
    r.dropX = e.x;
    r.dropZ = e.z;
  }
  if (e.kind === 'warden') r.bossDown = true;
}

export function heroInvulnerable(p: PlayerState): boolean {
  return p.invulnerable || p.invulnTime > 0 || p.mode === 'down' || tuning.debug.godMode;
}

/** 'pending' = a remote player's hit waiting out their lag grace (see coop.ts). */
export type HeroHitResult = 'none' | 'hit' | 'blocked' | 'parried' | 'pending';

const DEG = Math.PI / 180;

/** Is a point inside the hero's guard arc? Point-blank sources (a slam on top of you) count as in front. */
function guardCovers(p: PlayerState, x: number, z: number): boolean {
  const dx = x - p.x;
  const dz = z - p.z;
  if (Math.hypot(dx, dz) < 0.5) return true;
  const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - p.yaw), Math.cos(Math.atan2(dx, dz) - p.yaw));
  return Math.abs(off) <= (tuning.guard.arcDeg * DEG) / 2;
}

/** A hit landed inside the parry window: no damage, the attacker staggers (the Warden takes poise damage). */
function parry(state: SimState, p: PlayerState, hit: HeroHit): void {
  const g = tuning.guard;
  p.parrySeq++;
  // A successful parry re-arms straight away, so a rhythm of parries is possible.
  p.guardRaisedAt = -1000;
  p.hitstop = Math.max(p.hitstop, g.parryHitstopMs / 1000);
  const e = hit.enemyId !== undefined ? state.enemies.find((en) => en.id === hit.enemyId && isTargetable(en)) : undefined;
  if (e) {
    e.hitstop = Math.max(e.hitstop, g.parryHitstopMs / 1000);
    e.lastHitAt = state.time;
    if (e.kind === 'warden') {
      e.poise -= g.parryWardenPoise;
      if (e.poise <= 0 && e.ai !== 'roar') staggerEnemy(state, e);
    } else if (e.ai !== 'stagger') {
      staggerEnemy(state, e);
    }
  }
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  state.events.push({ kind: 'parry', playerId: p.id, x: p.x + fx * 0.6, y: p.y + 1.2, z: p.z + fz * 0.6, enemyId: e ? e.id : -1 });
}

/**
 * Damage the hero. Light hits don't interrupt; heavy ones (brute and Warden)
 * break whatever the hero is doing and shove them (brief: "only heavy enemy
 * attacks interrupt the hero mid-chain"). A raised guard parries in its first
 * moments, then blocks light hits and breaks on heavy ones. Zero health puts
 * them down.
 */
export function hurtHero(state: SimState, p: PlayerState, hit: HeroHit): HeroHitResult {
  if (heroInvulnerable(p)) return 'none';
  if (p.lagGrace > 0 && !hit.late) {
    state.pendingHits.push({ playerId: p.id, at: state.time, hit });
    return 'pending';
  }
  const g = tuning.guard;
  const dx = p.x - hit.fromX;
  const dz = p.z - hit.fromZ;
  const d = Math.hypot(dx, dz);
  const dirX = d > 1e-3 ? dx / d : -Math.sin(p.yaw);
  const dirZ = d > 1e-3 ? dz / d : -Math.cos(p.yaw);
  let damage = hit.damage * damageTakenMult(p);
  let heavy = !!hit.heavy;
  let push = hit.push ?? 0;
  let hurtMs = tuning.combat.heroHurtMs;
  if (p.mode === 'guard' && guardCovers(p, hit.fromX, hit.fromZ)) {
    if (p.parryOpen && p.guardTime * 1000 <= parryWindowMs(p)) {
      parry(state, p, hit);
      return 'parried';
    }
    p.blockSeq++;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const at = { x: p.x + fx * 0.5, y: p.y + 1.1, z: p.z + fz * 0.5 };
    if (!heavy) {
      // Blocked: chip damage and a small shove, the guard holds.
      damage *= g.blockDamageFrac;
      p.vx = dirX * g.blockPushM * tuning.combat.knockbackFriction;
      p.vz = dirZ * g.blockPushM * tuning.combat.knockbackFriction;
      state.events.push({ kind: 'block', playerId: p.id, ...at, broke: false });
      p.hp = Math.max(0, p.hp - damage);
      if (p.hp > 0) return 'blocked';
    } else {
      // Heavy hits break the guard: less damage, a longer stumble.
      damage *= g.heavyBlockDamageFrac;
      hurtMs = g.guardBreakMs;
      push *= 0.6;
      state.events.push({ kind: 'block', playerId: p.id, ...at, broke: true });
    }
  }
  // Worn armour (T5b) takes its share off; the slice's heroes carry none.
  if (p.mods.armour) damage *= 1 - p.mods.armour;
  if (p.hp > 0) p.hp = Math.max(0, p.hp - damage);
  state.events.push({ kind: 'heroHurt', playerId: p.id, damage, x: p.x, z: p.z, heavy });
  if (p.hp <= 0) {
    p.mode = 'down';
    p.downTime = tuning.combat.downMs / 1000;
    if (tuning.coop.bleedOut) p.bleed = tuning.coop.bleedOutMs / 1000;
    p.vx = 0;
    p.vz = 0;
    p.attackQueued = false;
    p.queuedAbility = -1;
    state.events.push({ kind: 'heroDown', playerId: p.id });
  } else if (heavy) {
    p.mode = 'hurt';
    p.hurtTime = hurtMs / 1000;
    p.attackQueued = false;
    p.queuedAbility = -1;
    p.invulnerable = false;
    p.vx = 0;
    p.vz = 0;
    const v = push * tuning.combat.knockbackFriction;
    p.kbx = dirX * v;
    p.kbz = dirZ * v;
  }
  return 'hit';
}

/** Deterministic random number in [0, 1) (mulberry32: one 32-bit state, so it serializes). */
export function nextRandom(state: SimState): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
