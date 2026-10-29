import { enemyStats, tuning, type EnemyKind } from '../config/tuning';
import { resolveCircle, sphereCast } from '../level/geometry';
import { groundHeight, rampPaths, type World } from '../level/arena';
import { damageEnemy, heroInvulnerable, hurtHero, nextRandom } from './combat';
import type { EnemyAi, EnemyState, PlayerState, SimState } from './types';

const DEG = Math.PI / 180;
const STEER_ACCEL = 18;
/** Height difference beyond which an enemy has to path via a ramp (or can't reach at all). */
const LEVEL_GAP = 0.9;
/** Enemy attacks only connect with heroes on roughly the same level. */
const REACH_HEIGHT = 1.3;

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function turnToward(current: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function setAi(e: EnemyState, ai: EnemyAi): void {
  e.ai = ai;
  e.aiTime = 0;
}

/** Party scaling (brief: each extra player adds 60% enemy health). */
function healthScale(state: SimState): number {
  return 1 + Math.max(0, state.players.length - 1) * tuning.run.extraPlayerHealth;
}

/**
 * Is (x, z) open ground for a body of this radius: inside the arena, on the
 * level it was asked for (floor or ledge), and not inside a wall or pillar?
 */
function isOpen(world: World, x: number, z: number, radius: number, wantLedge: boolean): boolean {
  if (world.level.dungeon) return isOpenOnFloor(world, x, z, radius);
  const h = world.level.floorSize / 2 - radius - 0.2;
  if (Math.abs(x) > h || Math.abs(z) > h) return false;
  const g = groundHeight(world, x, z);
  if (wantLedge ? g < world.level.ledge.height - 0.05 : g > 0.05) return false;
  const pos = { x, z };
  resolveCircle(pos, radius, (wantLedge ? g : 0) + 0.3, 3, world.colliders);
  return Math.hypot(pos.x - x, pos.z - z) < 0.05;
}

/** On a generated floor (T4) rooms stand at many heights: open means clear of walls at whatever height the ground is. */
function isOpenOnFloor(world: World, x: number, z: number, radius: number): boolean {
  const g = groundHeight(world, x, z);
  const pos = { x, z };
  resolveCircle(pos, radius, g + 0.3, g + 3, world.colliders);
  return Math.hypot(pos.x - x, pos.z - z) < 0.05;
}

export function createEnemy(state: SimState, world: World, kind: EnemyKind, x: number, z: number, yaw: number): EnemyState {
  const s = enemyStats(kind);
  const onLedge = groundHeight(world, x, z) > world.level.ledge.height - 0.05;
  let pos = { x, z };
  // Never spawn inside geometry: fall back to the nearest open spawn point.
  if (!isOpen(world, x, z, s.radius, onLedge)) {
    const spots = onLedge ? world.level.archerSpots : world.level.spawnPoints;
    pos = { ...[...spots].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] };
  }
  resolveCircle(pos, s.radius, (onLedge ? world.level.ledge.height : 0) + 0.3, s.height, world.colliders);
  const maxHp = s.maxHp * healthScale(state);
  const e: EnemyState = {
    id: state.nextId++,
    kind,
    x: pos.x,
    y: groundHeight(world, pos.x, pos.z),
    z: pos.z,
    yaw,
    vx: 0,
    vz: 0,
    kbx: 0,
    kbz: 0,
    hp: maxHp,
    maxHp,
    poise: s.maxPoise,
    ai: 'spawn',
    aiTime: 0,
    hitstop: 0,
    flinch: 0,
    slowTime: 0,
    frozen: 0,
    bleedTicks: 0,
    bleedTimer: 0,
    bleedOwner: '',
    hasToken: false,
    cooldown: 0.5 + nextRandom(state),
    poiseWait: 0,
    lastHitAt: -1,
    strafeDir: nextRandom(state) < 0.5 ? -1 : 1,
    tele: { shape: 'none', x: 0, z: 0, radius: 0, yaw: 0, arcDeg: 0 },
    recoverTime: 0,
    phase: 1,
    summoned: false,
    attack: '',
    shatterUntil: -1,
    skewerUntil: -1,
    detonateUntil: -1,
  };
  state.enemies.push(e);
  state.events.push({ kind: 'enemySpawn', enemyId: e.id, x: e.x, z: e.z });
  return e;
}

/** Debug helper: a group of 3-5 grunts at the spawn point farthest from the players. */
export function spawnGroup(state: SimState, world: World): void {
  const g = tuning.grunt;
  const far = (pt: { x: number; z: number }) => Math.min(...state.players.map((p) => Math.hypot(p.x - pt.x, p.z - pt.z)), 99);
  const center = [...world.level.spawnPoints].sort((a, b) => far(b) - far(a))[0];
  const lo = Math.round(Math.min(g.groupMin, g.groupMax));
  const hi = Math.round(Math.max(g.groupMin, g.groupMax));
  const count = lo + Math.floor(nextRandom(state) * (hi - lo + 1));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + nextRandom(state);
    createEnemy(state, world, 'grunt', center.x + Math.cos(a) * 1.6, center.z + Math.sin(a) * 1.6, Math.atan2(-center.x, -center.z));
  }
}

function nearestTarget(state: SimState, e: EnemyState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    if (p.mode === 'down') continue;
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Attack tokens: at most grunt.maxAttackers per standing hero (brief: two attackers per player); a
 * generated floor's fuller rooms (D1) allow dungeon.attackersPerHero. The arena never has a floor,
 * so the slice's two stand there and in the parity test.
 */
function tokenCap(state: SimState): number {
  const per = state.floor ? tuning.dungeon.attackersPerHero : tuning.grunt.maxAttackers;
  return per * Math.max(1, state.players.filter((p) => p.mode !== 'down').length);
}

function tokenHolders(state: SimState): number {
  return state.enemies.filter((o) => o.hasToken && o.ai !== 'dead').length;
}

/**
 * Where to walk to reach the target: straight at it on the same level,
 * otherwise via the nearest ramp (bottom then top, or the reverse).
 */
function navGoal(world: World, e: EnemyState, target: PlayerState): { x: number; z: number } {
  if (Math.abs(target.y - e.y) < LEVEL_GAP) return { x: target.x, z: target.z };
  const paths = rampPaths(world.level);
  // A generated floor has no ledge ramps; its fights stay in one flat room behind shut doors.
  if (paths.length === 0) return { x: target.x, z: target.z };
  const climbing = target.y > e.y;
  const ramp = [...paths].sort(
    (a, b) => Math.hypot(a.bottom.x - e.x, a.bottom.z - e.z) - Math.hypot(b.bottom.x - e.x, b.bottom.z - e.z),
  )[0];
  const onRamp = e.y > 0.05 && e.y < world.level.ledge.height - 0.05;
  if (climbing) {
    if (onRamp || Math.hypot(ramp.bottom.x - e.x, ramp.bottom.z - e.z) < 1.2) return ramp.top;
    return ramp.bottom;
  }
  if (onRamp || Math.hypot(ramp.top.x - e.x, ramp.top.z - e.z) < 1.2) return ramp.bottom;
  return ramp.top;
}

/** Can the enemy see the hero (walls, pillars and the ledge block the view)? */
function lineOfSight(world: World, e: EnemyState, p: PlayerState): boolean {
  const from = { x: e.x, y: e.y + 1.3, z: e.z };
  const dx = p.x - e.x;
  const dy = p.y + 1.1 - from.y;
  const dz = p.z - e.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.5) return true;
  const hit = sphereCast(from, { x: dx / len, y: dy / len, z: dz / len }, len, 0.12, world.colliders, (c) => c.blocksMovement);
  return hit >= len - 0.6;
}

/** Heroes inside a circle on the enemy's level. */
function heroesInCircle(state: SimState, x: number, z: number, r: number, y: number): PlayerState[] {
  return state.players.filter(
    (p) => Math.hypot(p.x - x, p.z - z) <= r + tuning.movement.radius && Math.abs(p.y - y) < REACH_HEIGHT && !heroInvulnerable(p),
  );
}

/** Heroes inside a cone (sweep) on the enemy's level. */
function heroesInCone(state: SimState, x: number, z: number, yaw: number, r: number, arcDeg: number, y: number): PlayerState[] {
  return heroesInCircle(state, x, z, r, y).filter((p) => Math.abs(wrapAngle(Math.atan2(p.x - x, p.z - z) - yaw)) <= (arcDeg * DEG) / 2);
}

function shove(state: SimState, e: EnemyState, victims: PlayerState[], fromX: number, fromZ: number, damage: number, push: number): void {
  for (const p of victims) hurtHero(state, p, { damage, heavy: true, push, fromX, fromZ, enemyId: e.id });
}

/** Grunt slash: light, in front. */
function gruntStrike(state: SimState, e: EnemyState, target: PlayerState | null): void {
  const g = tuning.grunt;
  state.events.push({ kind: 'enemySwing', enemyId: e.id });
  if (!target || tuning.debug.passiveEnemies || heroInvulnerable(target)) return;
  if (Math.abs(target.y - e.y) > REACH_HEIGHT) return;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  if (Math.hypot(dx, dz) > g.reach + tuning.movement.radius) return;
  if (Math.abs(wrapAngle(Math.atan2(dx, dz) - e.yaw)) > (g.arcDeg * DEG) / 2) return;
  hurtHero(state, target, { damage: g.damage, fromX: e.x, fromZ: e.z, enemyId: e.id });
}

interface Intent {
  /** Desired direction (unnormalised; magnitude up to 1 = full speed). */
  x: number;
  z: number;
}

// --- Brains: one per kind. Each sets e.ai/e.yaw/e.tele and returns where it wants to move. ---

function gruntBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const g = tuning.grunt;
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  const toTarget = Math.atan2(dx, dz);
  switch (e.ai) {
    case 'chase': {
      const sameLevel = Math.abs(target.y - e.y) < LEVEL_GAP;
      if (!e.hasToken && e.cooldown <= 0 && dist < 8 && sameLevel && tokenHolders(state) < tokenCap(state)) e.hasToken = true;
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      if (!sameLevel) {
        want.x = gx / gd;
        want.z = gz / gd;
        e.yaw = turnToward(e.yaw, Math.atan2(gx, gz), g.turnRateDeg * DEG * edt);
        break;
      }
      if (e.hasToken) {
        if (dist > g.attackRange) {
          want.x = gx / gd;
          want.z = gz / gd;
        } else if (Math.abs(wrapAngle(toTarget - e.yaw)) < 35 * DEG) {
          setAi(e, 'windup');
          state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
        }
      } else {
        // Wait your turn: hold a ring around the target and circle slowly.
        const radial = clamp((dist - g.holdDistance) / 1.5, -1, 1);
        const ux = dx / Math.max(dist, 1e-3);
        const uz = dz / Math.max(dist, 1e-3);
        want.x = ux * radial - uz * e.strafeDir * 0.45;
        want.z = uz * radial + ux * e.strafeDir * 0.45;
      }
      e.yaw = turnToward(e.yaw, toTarget, g.turnRateDeg * DEG * edt);
      break;
    }
    case 'windup':
      e.yaw = turnToward(e.yaw, toTarget, g.windupTurnRateDeg * DEG * edt);
      if (e.aiTime >= g.telegraphMs / 1000) {
        setAi(e, 'slash1');
        gruntStrike(state, e, target);
      }
      break;
    case 'slash1':
    case 'slash2':
      // A small step into each slash.
      want.x = Math.sin(e.yaw) * 0.6;
      want.z = Math.cos(e.yaw) * 0.6;
      if (e.aiTime >= g.slashActiveMs / 1000) {
        if (e.ai === 'slash1') setAi(e, 'between');
        else {
          setAi(e, 'recover');
          e.recoverTime = g.recoveryMs / 1000;
        }
      }
      break;
    case 'between':
      e.yaw = turnToward(e.yaw, toTarget, g.windupTurnRateDeg * DEG * edt);
      if (e.aiTime >= g.betweenSlashesMs / 1000) {
        setAi(e, 'slash2');
        gruntStrike(state, e, target);
      }
      break;
  }
  return want;
}

function archerBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const a = tuning.archer;
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  const toTarget = Math.atan2(dx, dz);
  switch (e.ai) {
    case 'chase': {
      // Keep distance: back away along the ledge when the hero closes in, otherwise drift a little.
      if (dist < a.fleeDistance) want.x = Math.sign(e.x - target.x || e.strafeDir);
      else want.x = e.strafeDir * 0.25;
      e.yaw = turnToward(e.yaw, toTarget, a.turnRateDeg * DEG * edt);
      if (!e.hasToken && e.cooldown <= 0 && tokenHolders(state) < tokenCap(state) && lineOfSight(world, e, target)) {
        e.hasToken = true;
        setAi(e, 'aim');
        e.tele = { shape: 'line', x: target.x, z: target.z, radius: dist, yaw: toTarget, arcDeg: 0 };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'aim': {
      // The aim line follows the hero, then locks for the last part: side-step late to dodge.
      if (e.aiTime < (a.aimMs / 1000) * a.aimTrackFrac) {
        e.tele.x = target.x;
        e.tele.z = target.z;
      }
      const ax = e.tele.x - e.x;
      const az = e.tele.z - e.z;
      e.tele.yaw = Math.atan2(ax, az);
      e.tele.radius = Math.hypot(ax, az);
      e.yaw = turnToward(e.yaw, e.tele.yaw, a.turnRateDeg * DEG * edt);
      if (e.aiTime >= a.aimMs / 1000) {
        setAi(e, 'shoot');
        if (!tuning.debug.passiveEnemies) fireEnemyArrow(state, e, target);
        state.events.push({ kind: 'enemyShot', enemyId: e.id });
        e.tele.shape = 'none';
      }
      break;
    }
    case 'shoot':
      if (e.aiTime >= a.shootRecoverMs / 1000) {
        setAi(e, 'recover');
        e.recoverTime = 0.05;
      }
      break;
  }
  return want;
}

function fireEnemyArrow(state: SimState, e: EnemyState, target: PlayerState): void {
  const a = tuning.archer;
  const from = { x: e.x + Math.sin(e.yaw) * 0.4, y: e.y + 1.3, z: e.z + Math.cos(e.yaw) * 0.4 };
  const to = { x: e.tele.x, y: target.y + 1.1, z: e.tele.z };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  state.projectiles.push({
    id: state.nextId++,
    kind: 'arrow',
    owner: `e${e.id}`,
    x: from.x,
    y: from.y,
    z: from.z,
    vx: (dx / len) * a.arrowSpeed,
    vy: (dy / len) * a.arrowSpeed,
    vz: (dz / len) * a.arrowSpeed,
    age: 0,
    life: 2,
    stuck: false,
    charged: false,
    radius: 0,
    damage: a.damage,
    poise: 0,
    knockback: 0,
    heavy: false,
    pierce: 1,
    hitIds: [],
    slowTime: 0,
    resolved: false,
    targetId: -1,
    homingLeft: 0,
    crit: false,
    hostile: true,
    style: 'bow',
    chained: false,
    marks: false,
    comboed: false,
  });
}

function bruteBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const b = tuning.brute;
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  const toTarget = Math.atan2(dx, dz);
  switch (e.ai) {
    case 'chase': {
      const sameLevel = Math.abs(target.y - e.y) < LEVEL_GAP;
      if (!e.hasToken && e.cooldown <= 0 && sameLevel && tokenHolders(state) < tokenCap(state)) e.hasToken = true;
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      const close = sameLevel && dist <= b.slamRange;
      if (!close || !e.hasToken) {
        // Without a token it still lumbers toward you, just not into slam range.
        const stop = e.hasToken ? 0 : tuning.grunt.holdDistance;
        if (!sameLevel || dist > stop) {
          want.x = gx / gd;
          want.z = gz / gd;
        }
      }
      e.yaw = turnToward(e.yaw, sameLevel ? toTarget : Math.atan2(gx, gz), b.turnRateDeg * DEG * edt);
      if (close && e.hasToken && Math.abs(wrapAngle(toTarget - e.yaw)) < 30 * DEG) {
        setAi(e, 'slamWindup');
        setSlamTele(e, b.slamOffset, b.slamRadius);
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'slamWindup':
      if (e.aiTime < (b.telegraphMs / 1000) * b.trackFrac) {
        e.yaw = turnToward(e.yaw, toTarget, b.turnRateDeg * DEG * edt);
        setSlamTele(e, b.slamOffset, b.slamRadius);
      }
      if (e.aiTime >= b.telegraphMs / 1000) {
        setAi(e, 'slam');
        slamLands(state, e, b.damage, b.knockbackDealt, false);
      }
      break;
    case 'slam':
      if (e.aiTime >= b.slamActiveMs / 1000) {
        setAi(e, 'recover');
        e.recoverTime = b.recoveryMs / 1000;
        e.tele.shape = 'none';
      }
      break;
  }
  return want;
}

function setSlamTele(e: EnemyState, offset: number, radius: number): void {
  e.tele = { shape: 'circle', x: e.x + Math.sin(e.yaw) * offset, z: e.z + Math.cos(e.yaw) * offset, radius, yaw: e.yaw, arcDeg: 360 };
}

function slamLands(state: SimState, e: EnemyState, damage: number, push: number, boss: boolean): void {
  const t = e.tele;
  state.events.push({ kind: 'enemySlam', enemyId: e.id, x: t.x, z: t.z, radius: t.radius, boss });
  if (tuning.debug.passiveEnemies) return;
  shove(state, e, heroesInCircle(state, t.x, t.z, t.radius, e.y), t.x, t.z, damage, push);
}

function wardenBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const w = tuning.warden;
  const want: Intent = { x: 0, z: 0 };
  const p2 = e.phase >= 2;
  const teleScale = p2 ? w.phase2TelegraphScale : 1;
  const speed = p2 ? w.phase2SpeedScale : 1;
  if (e.ai === 'roar') {
    if (e.aiTime >= w.roarMs / 1000) {
      // Summon at the end of the roar, then the fight gets faster.
      // Summons fan out on the arena side of the Warden.
      const n = Math.round(w.summonCount) + Math.max(0, state.players.length - 1);
      const toCentre = Math.atan2(-e.x, -e.z);
      for (let i = 0; i < n; i++) {
        const a = toCentre + ((i - (n - 1) / 2) / Math.max(1, n)) * 2.4;
        createEnemy(state, world, 'grunt', e.x + Math.sin(a) * 3.2, e.z + Math.cos(a) * 3.2, a);
      }
      e.phase = 2;
      e.summoned = true;
      setAi(e, 'recover');
      e.recoverTime = 0.4;
    }
    return want;
  }
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  const toTarget = Math.atan2(dx, dz);
  switch (e.ai) {
    case 'chase': {
      if (!e.summoned && e.hp <= e.maxHp * 0.5) {
        setAi(e, 'roar');
        e.tele.shape = 'none';
        state.events.push({ kind: 'roar', enemyId: e.id });
        break;
      }
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      if (dist > w.sweepRange - 0.8) {
        want.x = (gx / gd) * speed;
        want.z = (gz / gd) * speed;
      }
      e.yaw = turnToward(e.yaw, toTarget, w.turnRateDeg * DEG * edt * speed);
      if (e.cooldown > 0) break;
      const sameLevel = Math.abs(target.y - e.y) < LEVEL_GAP;
      if (sameLevel && dist <= w.sweepRange && Math.abs(wrapAngle(toTarget - e.yaw)) < 40 * DEG) {
        e.attack = nextRandom(state) < 0.55 ? 'sweep' : 'slam';
        if (e.attack === 'sweep') {
          setAi(e, 'sweepWindup');
          e.tele = { shape: 'cone', x: e.x, z: e.z, radius: w.sweepRadius, yaw: e.yaw, arcDeg: w.sweepArcDeg };
        } else {
          setAi(e, 'slamWindup');
          setSlamTele(e, w.slamOffset, w.slamRadius);
        }
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      } else if (dist >= w.farSlamDistance) {
        // Too far: pound the ground where the hero stands.
        e.attack = 'farSlam';
        setAi(e, 'slamWindup');
        const reach = Math.min(dist, w.farSlamMaxRange);
        e.tele = { shape: 'circle', x: e.x + (dx / dist) * reach, z: e.z + (dz / dist) * reach, radius: w.slamRadius, yaw: toTarget, arcDeg: 360 };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'sweepWindup':
      if (e.aiTime < (w.sweepTelegraphMs / 1000) * teleScale * 0.5) {
        e.yaw = turnToward(e.yaw, toTarget, w.turnRateDeg * DEG * edt);
        e.tele.x = e.x;
        e.tele.z = e.z;
        e.tele.yaw = e.yaw;
      }
      if (e.aiTime >= (w.sweepTelegraphMs / 1000) * teleScale) {
        setAi(e, 'sweep');
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
        if (!tuning.debug.passiveEnemies) {
          const t = e.tele;
          shove(state, e, heroesInCone(state, t.x, t.z, t.yaw, t.radius, t.arcDeg, e.y), e.x, e.z, w.sweepDamage, w.knockbackDealt);
        }
      }
      break;
    case 'sweep':
      if (e.aiTime >= w.sweepActiveMs / 1000) {
        setAi(e, 'recover');
        e.recoverTime = w.sweepRecoveryMs / 1000;
        e.tele.shape = 'none';
      }
      break;
    case 'slamWindup':
      if (e.attack === 'slam' && e.aiTime < (w.slamTelegraphMs / 1000) * teleScale * 0.4) {
        e.yaw = turnToward(e.yaw, toTarget, w.turnRateDeg * DEG * edt);
        setSlamTele(e, w.slamOffset, w.slamRadius);
      }
      if (e.aiTime >= (w.slamTelegraphMs / 1000) * teleScale) {
        setAi(e, 'slam');
        slamLands(state, e, w.slamDamage, w.knockbackDealt, true);
      }
      break;
    case 'slam':
      if (e.aiTime >= w.slamActiveMs / 1000) {
        setAi(e, 'recover');
        e.recoverTime = w.slamRecoveryMs / 1000;
        e.tele.shape = 'none';
      }
      break;
  }
  return want;
}

const BRAINS: Record<EnemyKind, (state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number) => Intent> = {
  grunt: gruntBrain,
  archer: archerBrain,
  brute: bruteBrain,
  warden: wardenBrain,
};

/** Cooldown after an attack, per kind. */
function attackCooldown(e: EnemyState): number {
  switch (e.kind) {
    case 'grunt':
      return tuning.grunt.attackCooldownMs / 1000;
    case 'archer':
      return tuning.archer.cooldownMs / 1000;
    case 'brute':
      return tuning.brute.cooldownMs / 1000;
    case 'warden':
      return (e.phase >= 2 ? tuning.warden.phase2CooldownMs : tuning.warden.cooldownMs) / 1000;
  }
}

/** Haunted (P8): a fallen enemy that has not yet got up, and will. The Warden falls once. */
export function willRise(state: SimState, e: EnemyState): boolean {
  return state.floor?.modifier === 'haunted' && e.ai === 'dead' && !e.risen && e.kind !== 'warden';
}

export function stepEnemies(state: SimState, dt: number, world: World): void {
  const c = tuning.combat;

  for (const e of state.enemies) {
    const stats = enemyStats(e.kind);
    // Hitstop freezes everything, knockback included.
    if (e.hitstop > 0) {
      e.hitstop = Math.max(0, e.hitstop - dt);
      continue;
    }
    // Bleed perk ticks.
    if (e.bleedTicks > 0 && e.ai !== 'dead') {
      e.bleedTimer -= dt;
      if (e.bleedTimer <= 0) {
        e.bleedTicks--;
        e.bleedTimer = tuning.gear.bleedTickMs / 1000;
        damageEnemy(state, e, {
          attackerId: e.bleedOwner,
          damage: tuning.gear.bleedDamage,
          poise: 0,
          knockback: 0,
          heavy: false,
          dirX: 0,
          dirZ: 0,
          x: e.x,
          y: e.y + stats.height * 0.6,
          z: e.z,
          style: 'sword',
          dot: true,
        });
      }
    }
    e.x += e.kbx * dt;
    e.z += e.kbz * dt;
    const friction = Math.exp(-c.knockbackFriction * dt);
    e.kbx *= friction;
    e.kbz *= friction;

    const slow = e.slowTime > 0 ? 1 - tuning.magicCombo.burstSlowFrac : 1;
    e.slowTime = Math.max(0, e.slowTime - dt);
    const edt = dt * slow;
    e.cooldown = Math.max(0, e.cooldown - edt);

    if (e.ai !== 'stagger' && e.ai !== 'dead') {
      e.poiseWait -= edt;
      if (e.poiseWait <= 0) e.poise = Math.min(stats.maxPoise, e.poise + c.poiseRegenPerSec * edt);
    }

    // Frozen solid: no thinking, no moving, no attack tokens.
    if (e.frozen > 0) {
      e.frozen = Math.max(0, e.frozen - dt);
      e.vx = 0;
      e.vz = 0;
      e.hasToken = false;
      e.tele.shape = 'none';
      if (e.ai !== 'dead' && e.ai !== 'stagger' && e.ai !== 'spawn' && e.ai !== 'roar') e.ai = 'chase';
      settle(state, world, e, e.x, e.z);
      continue;
    }
    if (e.flinch > 0) {
      e.flinch = Math.max(0, e.flinch - dt);
      e.vx = 0;
      e.vz = 0;
      settle(state, world, e, e.x, e.z);
      continue;
    }

    e.aiTime += edt;
    const target = nearestTarget(state, e);
    if (!target) e.hasToken = false;
    let want: Intent = { x: 0, z: 0 };

    switch (e.ai) {
      case 'spawn':
        if (e.aiTime >= stats.spawnMs / 1000) setAi(e, 'chase');
        break;
      case 'dead':
        break;
      case 'stagger':
        if (e.aiTime >= c.staggerMs / 1000) {
          e.poise = stats.maxPoise;
          setAi(e, 'chase');
        }
        break;
      case 'recover':
        if (e.aiTime >= e.recoverTime) {
          e.hasToken = false;
          e.cooldown = attackCooldown(e);
          setAi(e, 'chase');
        }
        break;
      default:
        want = BRAINS[e.kind](state, world, e, target, edt);
    }

    // Spread out from other enemies.
    for (const o of state.enemies) {
      if (o === e || o.ai === 'dead') continue;
      const ox = e.x - o.x;
      const oz = e.z - o.z;
      const od = Math.hypot(ox, oz);
      const room = (stats.radius + enemyStats(o.kind).radius) * 1.6;
      if (od > 0.01 && od < room) {
        const push = (room - od) / room;
        want.x += (ox / od) * push;
        want.z += (oz / od) * push;
      }
    }

    const len = Math.hypot(want.x, want.z);
    const speed = stats.moveSpeed * Math.min(1.5, len) * slow;
    const tx = len > 1e-3 ? (want.x / len) * speed : 0;
    const tz = len > 1e-3 ? (want.z / len) * speed : 0;
    const dvx = tx - e.vx;
    const dvz = tz - e.vz;
    const dv = Math.hypot(dvx, dvz);
    const maxDv = STEER_ACCEL * dt;
    if (dv <= maxDv) {
      e.vx = tx;
      e.vz = tz;
    } else {
      e.vx += (dvx / dv) * maxDv;
      e.vz += (dvz / dv) * maxDv;
    }
    const fromX = e.x;
    const fromZ = e.z;
    if (e.ai !== 'dead' && e.ai !== 'stagger' && e.ai !== 'spawn' && e.ai !== 'roar') {
      e.x += e.vx * dt;
      e.z += e.vz * dt;
    }
    settle(state, world, e, fromX, fromZ);
  }

  // Haunted (P8): each enemy gets up once, at half its health, a moment after it falls.
  for (const e of state.enemies) {
    if (!willRise(state, e) || e.aiTime < tuning.dungeon.hauntedRiseMs / 1000) continue;
    e.risen = true;
    e.hp = e.maxHp * tuning.dungeon.hauntedHp;
    e.poise = enemyStats(e.kind).maxPoise;
    setAi(e, 'spawn');
    state.events.push({ kind: 'enemyRose', enemyId: e.id, x: e.x, z: e.z });
  }
  state.enemies = state.enemies.filter((e) => !(e.ai === 'dead' && e.aiTime >= enemyStats(e.kind).deathMs / 1000 && !willRise(state, e)));
}

/**
 * Push an enemy and a hero out of each other's bodies. Exported so a joiner's prediction can apply
 * the same push against the enemies as it last saw them (T2): the host does it in the enemy step,
 * which a joiner never runs, so every brush with an enemy used to correct the joiner's hero.
 */
export function separateBodies(e: EnemyState, p: PlayerState): void {
  if (Math.abs(p.y - e.y) > LEVEL_GAP) return;
  const s = enemyStats(e.kind);
  const dx = e.x - p.x;
  const dz = e.z - p.z;
  const d = Math.hypot(dx, dz);
  const min = s.radius + tuning.movement.radius;
  if (d < min && d > 1e-4) {
    // Big enemies shove the hero more than they get shoved.
    const share = e.kind === 'grunt' || e.kind === 'archer' ? 0.7 : 0.15;
    const overlap = min - d;
    e.x += (dx / d) * overlap * share;
    e.z += (dz / d) * overlap * share;
    p.x -= (dx / d) * overlap * (1 - share);
    p.z -= (dz / d) * overlap * (1 - share);
  }
}

/**
 * Keep an enemy on walkable ground (no stepping up ledges or ramp sides),
 * out of walls and pillars, off the players, and archers on their ledge.
 */
function settle(state: SimState, world: World, e: EnemyState, fromX: number, fromZ: number): void {
  const s = enemyStats(e.kind);
  if (groundHeight(world, e.x, e.z) > e.y + tuning.combat.stepHeight) {
    e.x = fromX;
    e.z = fromZ;
  }
  if (e.ai !== 'dead') {
    for (const p of state.players) separateBodies(e, p);
  }
  resolveCircle(e, s.radius, e.y + 0.3, e.y + s.height, world.colliders);
  if (e.kind === 'archer' && e.y > world.level.ledge.height - 0.1) {
    const l = world.level.ledge;
    e.x = clamp(e.x, l.minX + 0.6, l.maxX - 0.6);
    e.z = clamp(e.z, l.minZ + 0.6, l.maxZ - 0.6);
  }
  e.y = groundHeight(world, e.x, e.z);
}
