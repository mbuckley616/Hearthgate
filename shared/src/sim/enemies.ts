import { enemyStats, tuning, type EnemyKind } from '../config/tuning';
import { resolveCircle, sphereCast, sweptDistance } from '../level/geometry';
import { groundHeight, rampPaths, type World } from '../level/arena';
import { pieceAt, walkRoute, type PieceInfo } from '../level/floor';

/** A floor's brazier as its collider stands (floor.ts). */
const BRAZIER_RADIUS = 0.45;
import { clearsLow, damageEnemy, heroInvulnerable, hurtHero, nextRandom, stepLaunched } from './combat';
import { chillHero } from './chill';
import type { EnemyAi, EnemyState, PlayerState, SimState } from './types';
import { roleOf, type EnemyRole } from './roles';
import { isHidden, isRooted, tauntedBy } from './specs';
import { difficultyMult } from '../game/portalChoice';

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

/** A harder portal's enemies have more health and hit harder (G3): the difficulty's mult, floors only. */
function difficultyScale(world: World): number {
  const spec = world.level.dungeon?.def.spec;
  return spec && tuning.dungeon.difficultyScalesEnemies ? difficultyMult(spec.difficulty) : 1;
}

/** What an enemy's hit deals: its attack's number, times a harder portal's (G3). */
const hitDamage = (e: EnemyState, damage: number) => damage * (e.hitMult ?? 1);

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
  const hard = difficultyScale(world);
  const maxHp = s.maxHp * healthScale(state) * hard;
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
  // Kept off the state at 1, so the arena's enemies keep the slice's shape (and its parity hashes).
  if (hard !== 1) e.hitMult = hard;
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
  // A Paladin's taunt holds it to them, nearer heroes or not (the builds pass).
  const held = e.taunt ? tauntedBy(state, e) : null;
  if (held) return held;
  let best: PlayerState | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    // An Assassin in their Smoke Bomb's cloud is lost to every enemy (the builds pass).
    if (p.mode === 'down' || isHidden(state, p)) continue;
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
  if (world.level.dungeon) return floorGoal(world, e, target);
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

/**
 * Where to head for a hero on a generated floor: straight at them in the same piece, otherwise the next
 * point on the way through the doorways (walkRoute). With the doors open (D8) a hero can leave a room,
 * and an enemy walking straight at them only pressed into the wall between.
 */
function floorGoal(world: World, e: EnemyState, target: PlayerState): { x: number; z: number } {
  const layout = world.level.dungeon!;
  const from = pieceAt(layout, e.x, e.z);
  const to = pieceAt(layout, target.x, target.z);
  if (from < 0) return { x: target.x, z: target.z };
  if (to < 0 || from === to) return around(layout.pieces[from], e, { x: target.x, z: target.z });
  const route = walkRoute(layout, from, to);
  // A point is passed once the enemy is nearer the one after it than the point itself is: the first
  // lies just inside the doorway, and turning back for it held enemies jittering in the door.
  let i = 0;
  const dist = (p: { x: number; z: number }, q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);
  while (i + 1 < route.length && dist(e, route[i + 1]) < dist(route[i], route[i + 1])) i++;
  return around(layout.pieces[from], e, route[i] ?? { x: target.x, z: target.z });
}

/**
 * Step round the first pillar or brazier on the straight line to a goal: aim beside it, on the side
 * the line already passes. Head-on, the push out of it is straight back and an enemy stood there for
 * good (a brazier in front of a great hall's doorway, 29 Oct).
 */
function around(piece: PieceInfo, e: EnemyState, goal: { x: number; z: number }): { x: number; z: number } {
  const dx = goal.x - e.x;
  const dz = goal.z - e.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return goal;
  const ux = dx / len;
  const uz = dz / len;
  const r = enemyStats(e.kind).radius;
  // The L-room (G5's B): with its masonry's corner in the way, head for the elbow first, from where
  // the goal is in view down the other arm. Walking straight held an enemy against the stone.
  if (piece.elbow && Math.hypot(piece.elbow.x - e.x, piece.elbow.z - e.z) > 0.8 && piece.blocks.some((b) => segmentNearRect(b, e.x, e.z, goal.x, goal.z, r + 0.3))) {
    return piece.elbow;
  }
  let best: { x: number; z: number; along: number; side: number; clear: number } | null = null;
  const check = (x: number, z: number, radius: number) => {
    const along = (x - e.x) * ux + (z - e.z) * uz;
    if (along <= 0 || along > len) return;
    // Signed distance of the obstacle from the line, along its left-hand perpendicular (-uz, ux).
    const side = -(x - e.x) * uz + (z - e.z) * ux;
    const clear = radius + r + 0.25;
    if (Math.abs(side) < clear && (!best || along < best.along)) best = { x, z, along, side, clear };
  };
  for (const p of piece.pillars) check(p.x, p.z, p.radius);
  for (const b of piece.braziers) check(b.x, b.z, BRAZIER_RADIUS);
  if (!best) return goal;
  const o: { x: number; z: number; side: number; clear: number } = best;
  // Pass on the far side from it; dead ahead, the side the enemy strafes to.
  const dir = o.side > 0.01 ? -1 : o.side < -0.01 ? 1 : e.strafeDir || 1;
  return { x: o.x - uz * dir * (o.clear + 0.1), z: o.z + ux * dir * (o.clear + 0.1) };
}

/** Does the segment from (ax, az) to (bx, bz) pass within `margin` of the rect? Sampled every 0.25 m. */
function segmentNearRect(r: { minX: number; maxX: number; minZ: number; maxZ: number }, ax: number, az: number, bx: number, bz: number, margin: number): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / n;
    const z = az + ((bz - az) * i) / n;
    if (Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ)) < margin) return true;
  }
  return false;
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

/** The Warden's sweep and slams and the Brute's slam: heavy, and low (M1), along the ground at the enemy's feet. */
function shove(state: SimState, e: EnemyState, victims: PlayerState[], fromX: number, fromZ: number, damage: number, push: number): void {
  // Tagged only while the switch is on, so the slice's pending hits (and the parity hashes) keep their shape.
  const low = tuning.jump.clearsLow ? { low: e.y } : {};
  for (const p of victims) hurtHero(state, p, { damage: hitDamage(e, damage), heavy: true, push, fromX, fromZ, enemyId: e.id, ...low });
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
  hurtHero(state, target, { damage: hitDamage(e, g.damage), fromX: e.x, fromZ: e.z, enemyId: e.id });
}

export interface Intent {
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
      // A hero in another piece of a floor (navGoal routed through a doorway): go round to them first,
      // as a hero up a ramp is gone round to; the ring of waiting grunts is for the room they share.
      const routed = goal.x !== target.x || goal.z !== target.z;
      if (!sameLevel || routed) {
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
      if (world.level.dungeon) floorArcher(world, e, target, dist, want);
      // Keep distance: back away along the ledge when the hero closes in, otherwise drift a little.
      else if (dist < a.fleeDistance) want.x = Math.sign(e.x - target.x || e.strafeDir);
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

/**
 * An archer on a generated floor: out of sight or out of range it comes after the hero through the
 * doorways; too close it backs straight away; otherwise it holds, drifting a little across the line.
 */
function floorArcher(world: World, e: EnemyState, target: PlayerState, dist: number, want: Intent): void {
  const a = tuning.archer;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const d = Math.max(dist, 1e-3);
  if (dist > a.floorRange || !lineOfSight(world, e, target)) {
    const goal = floorGoal(world, e, target);
    const gx = goal.x - e.x;
    const gz = goal.z - e.z;
    const gd = Math.max(Math.hypot(gx, gz), 1e-3);
    want.x = gx / gd;
    want.z = gz / gd;
  } else if (dist < a.fleeDistance) {
    want.x = -dx / d;
    want.z = -dz / d;
  } else {
    want.x = (dz / d) * e.strafeDir * 0.25;
    want.z = (-dx / d) * e.strafeDir * 0.25;
  }
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
    damage: hitDamage(e, a.damage),
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

/**
 * The Skeleton Shieldbearer (E1b, the shield role): walks in behind its shield, turning slowly, and
 * bashes a short line in front, a heavy that staggers whoever it meets. Its block is in damageEnemy.
 */
function shieldBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const sb = e.kind === 'knight' ? tuning.knight : tuning.shieldbearer;
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
      // Without a token it still walks its shield at you, holding where the grunts wait.
      const stop = e.hasToken ? sb.attackRange * 0.8 : tuning.grunt.holdDistance;
      if (!sameLevel || dist > stop) {
        want.x = gx / gd;
        want.z = gz / gd;
      }
      e.yaw = turnToward(e.yaw, sameLevel ? toTarget : Math.atan2(gx, gz), sb.turnRateDeg * DEG * edt);
      if (sameLevel && e.hasToken && dist <= sb.attackRange && Math.abs(wrapAngle(toTarget - e.yaw)) < 30 * DEG) {
        setAi(e, 'windup');
        e.attack = 'bash';
        e.tele = { shape: 'line', x: e.x + Math.sin(e.yaw) * sb.bashReach, z: e.z + Math.cos(e.yaw) * sb.bashReach, radius: sb.bashReach, yaw: e.yaw, arcDeg: 0 };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'windup':
      e.yaw = turnToward(e.yaw, toTarget, sb.windupTurnRateDeg * DEG * edt);
      e.tele = { shape: 'line', x: e.x + Math.sin(e.yaw) * sb.bashReach, z: e.z + Math.cos(e.yaw) * sb.bashReach, radius: sb.bashReach, yaw: e.yaw, arcDeg: 0 };
      if (e.aiTime >= sb.telegraphMs / 1000) {
        setAi(e, 'slash1');
        e.tele.shape = 'none';
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
        if (!tuning.debug.passiveEnemies) {
          const victims = heroesInCone(state, e.x, e.z, e.yaw, sb.bashReach, sb.bashArcDeg, e.y);
          for (const p of victims) hurtHero(state, p, { damage: hitDamage(e, sb.bashDamage), heavy: true, push: sb.bashPush, fromX: e.x, fromZ: e.z, enemyId: e.id });
        }
      }
      break;
    case 'slash1':
      // A step into the bash.
      want.x = Math.sin(e.yaw) * 0.8;
      want.z = Math.cos(e.yaw) * 0.8;
      if (e.aiTime >= sb.bashActiveMs / 1000) {
        setAi(e, 'recover');
        e.recoverTime = sb.recoveryMs / 1000;
      }
      break;
  }
  return want;
}

/** The Hound's line: from it, along where it faces, as far as the rush will run. */
/** A rush's numbers: the Hound's, or the Barrow Knight's (E1f). */
function rushOf(e: EnemyState) {
  const k = tuning.knight;
  return e.kind === 'knight' ? { ...k, telegraphMs: k.chargeTelegraphMs } : tuning.hound;
}

function setChargeTele(e: EnemyState): void {
  const l = rushOf(e).chargeLength;
  e.tele = { shape: 'line', x: e.x + Math.sin(e.yaw) * l, z: e.z + Math.cos(e.yaw) * l, radius: l, yaw: e.yaw, arcDeg: 0 };
}

/**
 * The Crypt Hound (E1c, the charger): keeps its distance, then winds up a yellow line at a hero and
 * rushes along it. The first hero it meets is knocked down; a wall it meets stuns it (a stagger cut to
 * `wallStunMs`), the punish window. It steers nothing during the rush: a sidestep after the line
 * locks makes it miss.
 */
function chargerBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const h = rushOf(e);
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  const toTarget = Math.atan2(dx, dz);
  switch (e.ai) {
    case 'chase': {
      const sameLevel = Math.abs(target.y - e.y) < LEVEL_GAP;
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      const routed = goal.x !== target.x || goal.z !== target.z;
      // Close the distance to a rush's length, or back off from a hero too close to rush.
      if (!sameLevel || routed || dist > h.chargeRange * 0.8) {
        want.x = gx / gd;
        want.z = gz / gd;
      } else if (dist < h.chargeMinRange) {
        want.x = -dx / Math.max(dist, 1e-3);
        want.z = -dz / Math.max(dist, 1e-3);
      } else {
        want.x = (-dz / Math.max(dist, 1e-3)) * e.strafeDir * 0.4;
        want.z = (dx / Math.max(dist, 1e-3)) * e.strafeDir * 0.4;
      }
      e.yaw = turnToward(e.yaw, routed || !sameLevel ? Math.atan2(gx, gz) : toTarget, h.turnRateDeg * DEG * edt);
      const inRange = sameLevel && !routed && dist <= h.chargeRange && dist >= h.chargeMinRange;
      if (inRange && !e.hasToken && e.cooldown <= 0 && tokenHolders(state) < tokenCap(state) && lineOfSight(world, e, target)) {
        e.hasToken = true;
        setAi(e, 'chargeWindup');
        e.attack = 'charge';
        setChargeTele(e);
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'chargeWindup':
      if (e.aiTime < (h.telegraphMs / 1000) * h.trackFrac) e.yaw = turnToward(e.yaw, toTarget, h.turnRateDeg * DEG * edt);
      setChargeTele(e);
      if (e.aiTime >= h.telegraphMs / 1000) {
        setAi(e, 'charge');
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
      }
      break;
    case 'charge': {
      // The rush moves the body itself, faster than steering allows, and stops at what it meets.
      const step = h.chargeSpeed * edt;
      const ux = Math.sin(e.yaw);
      const uz = Math.cos(e.yaw);
      const pos = { x: e.x + ux * step, z: e.z + uz * step };
      resolveCircle(pos, h.radius, e.y + 0.3, e.y + h.height, world.colliders);
      const blocked = groundHeight(world, pos.x, pos.z) > e.y + tuning.combat.stepHeight;
      const moved = blocked ? 0 : (pos.x - e.x) * ux + (pos.z - e.z) * uz;
      e.vx = 0;
      e.vz = 0;
      if (!blocked) {
        e.x = pos.x;
        e.z = pos.z;
      }
      const hit = tuning.debug.passiveEnemies
        ? undefined
        : state.players.find((p) => Math.hypot(p.x - e.x, p.z - e.z) <= h.radius + tuning.movement.radius + 0.15 && Math.abs(p.y - e.y) < REACH_HEIGHT && !heroInvulnerable(p));
      if (hit) {
        hurtHero(state, hit, { damage: hitDamage(e, h.chargeDamage), heavy: true, push: h.chargePush, fromX: e.x - ux, fromZ: e.z - uz, enemyId: e.id });
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = h.recoveryMs / 1000;
      } else if (moved < step * 0.5) {
        // A wall: stunned, the stagger's window cut to wallStunMs.
        e.tele.shape = 'none';
        e.hasToken = false;
        e.poise = 0;
        e.ai = 'stagger';
        e.aiTime = (tuning.combat.staggerMs - h.wallStunMs) / 1000;
        state.events.push({ kind: 'stagger', enemyId: e.id, x: e.x, z: e.z });
      } else if (e.aiTime * h.chargeSpeed >= h.chargeLength) {
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = h.recoveryMs / 1000;
      }
      break;
    }
  }
  return want;
}

/**
 * The Bone Priest (E1e, the leader): keeps `keepDistance` from the nearest hero, behind its pack, and
 * every `raiseEveryMs` chants over the nearest fallen skeleton in reach, a violet circle on the remains
 * for `chantMs`, after which they stand at `raiseHp`. A stagger breaks the chant.
 */
function leaderBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const pr = tuning.priest;
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  switch (e.ai) {
    case 'chase': {
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      const routed = goal.x !== target.x || goal.z !== target.z;
      if (routed || dist > pr.keepDistance + 2) {
        want.x = gx / gd;
        want.z = gz / gd;
      } else if (dist < pr.keepDistance) {
        want.x = -dx / Math.max(dist, 1e-3);
        want.z = -dz / Math.max(dist, 1e-3);
      }
      e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), pr.turnRateDeg * DEG * edt);
      if (e.cooldown > 0) break;
      let best: EnemyState | undefined;
      for (const o of state.enemies) {
        if (o.aiTime < 0.5 || !raisable(state, o)) continue;
        const d = Math.hypot(o.x - e.x, o.z - e.z);
        if (d <= pr.raiseRange && (!best || d < Math.hypot(best.x - e.x, best.z - e.z))) best = o;
      }
      if (best) {
        setAi(e, 'chant');
        e.raiseId = best.id;
        e.tele = { shape: 'circle', x: best.x, z: best.z, radius: 1.2, yaw: 0, arcDeg: 360 };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'chant': {
      const remains = state.enemies.find((o) => o.id === e.raiseId);
      if (!remains || remains.ai !== 'dead') {
        e.tele.shape = 'none';
        e.raiseId = undefined;
        setAi(e, 'chase');
        break;
      }
      e.yaw = turnToward(e.yaw, Math.atan2(remains.x - e.x, remains.z - e.z), pr.turnRateDeg * DEG * edt);
      if (e.aiTime >= pr.chantMs / 1000) {
        remains.risen = true;
        remains.hp = remains.maxHp * pr.raiseHp;
        remains.poise = enemyStats(remains.kind).maxPoise;
        remains.hasToken = false;
        remains.frozen = 0;
        remains.bleedTicks = 0;
        setAi(remains, 'spawn');
        state.events.push({ kind: 'enemyRose', enemyId: remains.id, x: remains.x, z: remains.z });
        e.tele.shape = 'none';
        e.raiseId = undefined;
        setAi(e, 'recover');
        e.recoverTime = pr.recoveryMs / 1000;
      }
      break;
    }
  }
  return want;
}

/**
 * The Barrow Knight (E1f, the elite): from far off it rushes as a Hound does, behind its shield; close
 * in it fights as a Shieldbearer, bash and all.
 */
function eliteBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  if (e.ai === 'chargeWindup' || e.ai === 'charge') return chargerBrain(state, world, e, target, edt);
  if (e.ai === 'chase' && target) {
    const k = tuning.knight;
    const dist = Math.hypot(target.x - e.x, target.z - e.z);
    if (dist >= k.chargeMinRange && dist <= k.chargeRange) {
      // Ask the rush first; if it does not start, the shield's step stands and its turn alone counts.
      const yaw = e.yaw;
      const want = chargerBrain(state, world, e, target, edt);
      if ((e.ai as EnemyAi) === 'chargeWindup') return want;
      e.yaw = yaw;
    }
  }
  return shieldBrain(state, world, e, target, edt);
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

/** The Warden's pace in its phase: the slice's two, or E1g's three (phase 2 adds the dead, phase 3 the speed). */
function wardenPace(e: EnemyState): { teleScale: number; speed: number; cooldownMs: number } {
  const w = tuning.warden;
  if (w.threePhases) {
    if (e.phase >= 3) return { teleScale: w.phase3TelegraphScale, speed: w.phase3SpeedScale, cooldownMs: w.phase3CooldownMs };
    return { teleScale: 1, speed: 1, cooldownMs: w.cooldownMs };
  }
  if (e.phase >= 2) return { teleScale: w.phase2TelegraphScale, speed: w.phase2SpeedScale, cooldownMs: w.phase2CooldownMs };
  return { teleScale: 1, speed: 1, cooldownMs: w.cooldownMs };
}

/**
 * E1g's second phase: skeletons rise from the hall's edges, evenly round the Warden, each as far out
 * as `raiseRadius` allows before a wall (and in sight of the Warden, so never in the next room).
 */
function raiseFromEdges(state: SimState, world: World, e: EnemyState, n: number, kind: EnemyKind = 'grunt', radius = tuning.warden.raiseRadius): void {
  const r = enemyStats(kind).radius;
  const start = Math.atan2(-e.x, -e.z);
  for (let i = 0; i < n; i++) {
    const a = start + (i / Math.max(1, n)) * Math.PI * 2;
    const ux = Math.sin(a);
    const uz = Math.cos(a);
    const from = { x: e.x, y: e.y + 1.3, z: e.z };
    const clear = sphereCast(from, { x: ux, y: 0, z: uz }, radius, r, world.colliders, (c) => c.blocksMovement);
    let d = Math.min(radius, clear - r - 0.3);
    while (d > 2.5 && !isOpen(world, e.x + ux * d, e.z + uz * d, r, false)) d -= 0.5;
    if (d <= 2.5) d = 3.2;
    const g = createEnemy(state, world, kind, e.x + ux * d, e.z + uz * d, a + Math.PI);
    state.events.push({ kind: 'enemyRose', enemyId: g.id, x: g.x, z: g.z });
  }
}

function wardenBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const w = tuning.warden;
  const want: Intent = { x: 0, z: 0 };
  const { teleScale, speed } = wardenPace(e);
  if (e.ai === 'roar') {
    if (e.aiTime >= w.roarMs / 1000) {
      const n = Math.round(w.summonCount) + Math.max(0, state.players.length - 1);
      if (w.threePhases) {
        // E1g: the first roar raises the dead round the hall; the second only quickens it.
        if (e.phase === 1) raiseFromEdges(state, world, e, n);
        e.phase = Math.min(3, e.phase + 1);
      } else {
        // Summon at the end of the roar, then the fight gets faster.
        // Summons fan out on the arena side of the Warden.
        const toCentre = Math.atan2(-e.x, -e.z);
        for (let i = 0; i < n; i++) {
          const a = toCentre + ((i - (n - 1) / 2) / Math.max(1, n)) * 2.4;
          createEnemy(state, world, 'grunt', e.x + Math.sin(a) * 3.2, e.z + Math.cos(a) * 3.2, a);
        }
        e.phase = 2;
      }
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
      if (w.threePhases) {
        const at = e.phase === 1 ? w.phase2At : e.phase === 2 ? w.phase3At : -1;
        if (e.hp <= e.maxHp * at) {
          setAi(e, 'roar');
          e.tele.shape = 'none';
          delete e.chain;
          state.events.push({ kind: 'roar', enemyId: e.id, phase: e.phase + 1 });
          break;
        }
      } else if (!e.summoned && e.hp <= e.maxHp * 0.5) {
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
        // Phase 3 (E1g): some slams roll on toward the hero, a circle at a time.
        delete e.chain;
        if (e.attack === 'slam' && w.threePhases && e.phase >= 3 && nextRandom(state) < w.chainChance) {
          e.attack = 'chainSlam';
          e.chain = 0;
        }
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
      if ((e.attack === 'slam' || (e.attack === 'chainSlam' && !e.chain)) && e.aiTime < (w.slamTelegraphMs / 1000) * teleScale * 0.4) {
        e.yaw = turnToward(e.yaw, toTarget, w.turnRateDeg * DEG * edt);
        setSlamTele(e, w.slamOffset, w.slamRadius);
      }
      // A rolling slam's later circles are locked to the first's line and come quicker.
      if (e.aiTime >= (e.chain ? w.chainTelegraphMs : w.slamTelegraphMs * teleScale) / 1000) {
        setAi(e, 'slam');
        slamLands(state, e, w.slamDamage, w.knockbackDealt, true);
      }
      break;
    case 'slam':
      if (e.aiTime >= w.slamActiveMs / 1000) {
        if (e.attack === 'chainSlam' && (e.chain ?? 0) + 1 < Math.round(w.chainSlams)) {
          e.chain = (e.chain ?? 0) + 1;
          e.tele.x += Math.sin(e.yaw) * w.chainStepM;
          e.tele.z += Math.cos(e.yaw) * w.chainStepM;
          setAi(e, 'slamWindup');
          state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
          break;
        }
        delete e.chain;
        setAi(e, 'recover');
        e.recoverTime = w.slamRecoveryMs / 1000;
        e.tele.shape = 'none';
      }
      break;
  }
  return want;
}

function setStringTele(e: EnemyState): void {
  const k = tuning.king;
  e.tele = { shape: 'cone', x: e.x, z: e.z, radius: k.stringReach, yaw: e.yaw, arcDeg: k.stringArcDeg };
}

/** The crown's line: from the King, where he faces, as far as a wall lets it fly (at most `crownRange`). */
function setCrownTele(world: World, e: EnemyState): void {
  const k = tuning.king;
  const ux = Math.sin(e.yaw);
  const uz = Math.cos(e.yaw);
  const clear = sphereCast({ x: e.x, y: e.y + 1.3, z: e.z }, { x: ux, y: 0, z: uz }, k.crownRange, k.crownRadius * 0.5, world.colliders, (c) => c.blocksMovement);
  const l = Math.max(1, Math.min(k.crownRange, clear));
  e.tele = { shape: 'line', x: e.x + ux * l, z: e.z + uz * l, radius: l, yaw: e.yaw, arcDeg: 0 };
}

/** The King's pace (G4b): phase 3 winds up quicker, moves faster and waits less. */
export function kingPace(e: EnemyState): { teleScale: number; speed: number; cooldownMs: number } {
  const k = tuning.king;
  if (e.phase >= 3) return { teleScale: k.phase3TelegraphScale, speed: k.phase3SpeedScale, cooldownMs: k.phase3CooldownMs };
  return { teleScale: 1, speed: 1, cooldownMs: k.cooldownMs };
}

/** Where the King's crown is now, along the line it was thrown down. */
export function crownAt(e: EnemyState): { x: number; z: number } | null {
  if (!e.crown) return null;
  return { x: e.x + Math.sin(e.tele.yaw) * e.crown.d, z: e.z + Math.cos(e.tele.yaw) * e.crown.d };
}

/**
 * The Hollow King (G4b; Michael's A, 4 Nov), phase 1: up close a three-step sword string, each step a
 * red cone that turns with the hero for the first half of its wind-up; at range his crown, thrown down
 * a yellow line that stops at a wall, out and back, striking each hero it passes once a way. He stands
 * where he threw it until it is back in his hand: the punish window for a hero who stepped aside.
 */
function kingBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const k = tuning.king;
  const want: Intent = { x: 0, z: 0 };
  // A crown in flight is lost to a stagger, and circles cast fade; the crown is back on his head when he gets up.
  if (e.crown && e.ai !== 'charge') delete e.crown;
  if (e.circles && e.ai !== 'chant') delete e.circles;
  const { teleScale, speed } = kingPace(e);
  if (e.ai === 'roar') {
    if (e.aiTime >= k.roarMs / 1000) {
      // Phase 2's roar raises his knights round the hall; phase 3's dims it and quickens him.
      if (e.phase === 1) raiseFromEdges(state, world, e, Math.round(k.knights), 'knight', k.raiseRadius);
      e.phase = Math.min(3, e.phase + 1);
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
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      const at = e.phase === 1 ? k.phase2At : e.phase === 2 ? k.phase3At : -1;
      if (e.hp <= e.maxHp * at) {
        setAi(e, 'roar');
        e.tele.shape = 'none';
        delete e.chain;
        state.events.push({ kind: 'roar', enemyId: e.id, phase: e.phase + 1, king: true });
        break;
      }
      if (dist > k.stringRange - 0.6) {
        want.x = (gx / gd) * speed;
        want.z = (gz / gd) * speed;
      }
      e.yaw = turnToward(e.yaw, toTarget, k.turnRateDeg * DEG * edt * speed);
      if (e.cooldown > 0) break;
      const sameLevel = Math.abs(target.y - e.y) < LEVEL_GAP;
      const facing = Math.abs(wrapAngle(toTarget - e.yaw)) < 40 * DEG;
      const standing = state.players.filter((p) => p.mode !== 'down' && Math.hypot(p.x - e.x, p.z - e.z) <= k.circlesRange && Math.abs(p.y - e.y) < LEVEL_GAP);
      if (e.phase >= 2 && standing.length > 0 && nextRandom(state) < k.circlesChance) {
        // Phase 2 on (G4b): a violet circle under every hero at once, so the party must all move.
        e.attack = 'circles';
        delete e.chain;
        e.circles = standing.map((p) => ({ x: p.x, z: p.z }));
        setAi(e, 'chant');
        e.tele = { shape: 'circle', x: e.circles[0].x, z: e.circles[0].z, radius: k.circlesRadius, yaw: 0, arcDeg: 360 };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      } else if (e.phase >= 3 && sameLevel && dist <= k.sweepRadius && nextRandom(state) < k.sweepChance) {
        // Phase 3: the crown swept round him at arm's length, a wide yellow arc.
        e.attack = 'crownSweep';
        delete e.chain;
        setAi(e, 'sweepWindup');
        e.tele = { shape: 'cone', x: e.x, z: e.z, radius: k.sweepRadius, yaw: e.yaw, arcDeg: k.sweepArcDeg };
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      } else if (sameLevel && facing && dist <= k.stringRange) {
        e.attack = 'string';
        e.chain = 0;
        setAi(e, 'windup');
        setStringTele(e);
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      } else if (sameLevel && facing && dist >= k.crownMinRange && dist <= k.crownRange && lineOfSight(world, e, target)) {
        e.attack = 'crown';
        delete e.chain;
        setAi(e, 'chargeWindup');
        setCrownTele(world, e);
        state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      }
      break;
    }
    case 'windup': {
      const ms = (e.chain ? k.stringNextMs : k.stringTelegraphMs) * teleScale;
      if (e.aiTime < (ms / 1000) * 0.5) {
        e.yaw = turnToward(e.yaw, toTarget, k.turnRateDeg * DEG * edt);
        setStringTele(e);
      }
      if (e.aiTime >= ms / 1000) {
        setAi(e, 'slash1');
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
        if (!tuning.debug.passiveEnemies) {
          const t = e.tele;
          for (const p of heroesInCone(state, t.x, t.z, t.yaw, t.radius, t.arcDeg, e.y)) {
            hurtHero(state, p, { damage: hitDamage(e, k.stringDamage), push: k.knockbackDealt, fromX: e.x, fromZ: e.z, enemyId: e.id });
          }
        }
      }
      break;
    }
    case 'slash1':
      // A step into each cut.
      want.x = Math.sin(e.yaw) * 0.5;
      want.z = Math.cos(e.yaw) * 0.5;
      if (e.aiTime >= k.stringActiveMs / 1000) {
        if ((e.chain ?? 0) + 1 < Math.round(k.stringSteps)) {
          e.chain = (e.chain ?? 0) + 1;
          setAi(e, 'windup');
          setStringTele(e);
          state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
          break;
        }
        delete e.chain;
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = k.stringRecoveryMs / 1000;
      }
      break;
    case 'chargeWindup':
      if (e.aiTime < (k.crownTelegraphMs / 1000) * teleScale * 0.5) {
        e.yaw = turnToward(e.yaw, toTarget, k.turnRateDeg * DEG * edt);
        setCrownTele(world, e);
      }
      if (e.aiTime >= (k.crownTelegraphMs / 1000) * teleScale) {
        setAi(e, 'charge');
        e.crown = { d: 0, length: e.tele.radius, back: false, struck: [] };
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
      }
      break;
    case 'charge': {
      const c = e.crown!;
      const step = k.crownSpeed * edt;
      if (!c.back) {
        c.d = Math.min(c.length, c.d + step);
        if (c.d >= c.length) {
          c.back = true;
          c.struck = [];
        }
      } else c.d = Math.max(0, c.d - step);
      const at = crownAt(e)!;
      if (!tuning.debug.passiveEnemies) {
        for (const p of heroesInCircle(state, at.x, at.z, k.crownRadius, e.y)) {
          if (c.struck.includes(p.id)) continue;
          c.struck.push(p.id);
          hurtHero(state, p, { damage: hitDamage(e, k.crownDamage), push: k.crownPush, fromX: at.x - Math.sin(e.tele.yaw), fromZ: at.z - Math.cos(e.tele.yaw), enemyId: e.id });
        }
      }
      if (c.back && c.d <= 0) {
        delete e.crown;
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = k.crownRecoveryMs / 1000;
      }
      break;
    }
    case 'chant': {
      // The circles stay where they were cast; they land after the channel and the lag grace, as a
      // Wraith's does, so a step out that was on time on the player's screen counts.
      if (e.aiTime >= k.circlesChannelMs / 1000 + tuning.coop.lagGraceMs / 1000) {
        for (const c of e.circles ?? []) {
          let caught = 0;
          for (const p of state.players) {
            if (tuning.debug.passiveEnemies || p.mode === 'down' || Math.hypot(p.x - c.x, p.z - c.z) > k.circlesRadius) continue;
            if (heroInvulnerable(p) || clearsLow(p, e.y)) continue;
            hurtHero(state, p, { damage: hitDamage(e, k.circlesDamage), fromX: c.x, fromZ: c.z, enemyId: e.id, late: true });
            chillHero(state, p);
            caught++;
          }
          state.events.push({ kind: 'circleLanded', enemyId: e.id, x: c.x, z: c.z, caught });
        }
        delete e.circles;
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = k.circlesRecoveryMs / 1000;
      }
      break;
    }
    case 'sweepWindup':
      if (e.aiTime < (k.sweepTelegraphMs / 1000) * teleScale * 0.5) {
        e.yaw = turnToward(e.yaw, toTarget, k.turnRateDeg * DEG * edt);
        e.tele.x = e.x;
        e.tele.z = e.z;
        e.tele.yaw = e.yaw;
      }
      if (e.aiTime >= (k.sweepTelegraphMs / 1000) * teleScale) {
        setAi(e, 'sweep');
        state.events.push({ kind: 'enemySwing', enemyId: e.id });
        if (!tuning.debug.passiveEnemies) {
          const t = e.tele;
          for (const p of heroesInCone(state, t.x, t.z, t.yaw, t.radius, t.arcDeg, e.y)) {
            hurtHero(state, p, { damage: hitDamage(e, k.sweepDamage), push: k.knockbackDealt, fromX: e.x, fromZ: e.z, enemyId: e.id });
          }
        }
      }
      break;
    case 'sweep':
      if (e.aiTime >= k.sweepActiveMs / 1000) {
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = k.sweepRecoveryMs / 1000;
      }
      break;
  }
  return want;
}

/**
 * The Wraith (E1d, the caster): keeps its distance as the Priest does, and when a hero is in reach
 * channels a violet circle at their feet. The circle stays where it was cast; as it lands (after the
 * channel and the lag grace, so a step out that was on time on the player's screen counts) whoever
 * stands in it is Chilled. Any hit breaks the channel (`breakChannel`, from damageEnemy).
 */
function casterBrain(state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number): Intent {
  const w = tuning.wraith;
  const want: Intent = { x: 0, z: 0 };
  if (!target) return want;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const dist = Math.hypot(dx, dz);
  switch (e.ai) {
    case 'chase': {
      const goal = navGoal(world, e, target);
      const gx = goal.x - e.x;
      const gz = goal.z - e.z;
      const gd = Math.max(Math.hypot(gx, gz), 1e-3);
      const routed = goal.x !== target.x || goal.z !== target.z;
      if (routed || dist > w.keepDistance + 2) {
        want.x = gx / gd;
        want.z = gz / gd;
      } else if (dist < w.keepDistance) {
        want.x = -dx / Math.max(dist, 1e-3);
        want.z = -dz / Math.max(dist, 1e-3);
      }
      e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), w.turnRateDeg * DEG * edt);
      // It casts at what it can see (G5's B): a hero behind a tomb or a pillar is out of its sight.
      if (e.cooldown > 0 || dist > w.castRange || routed || !lineOfSight(world, e, target)) break;
      setAi(e, 'chant');
      e.tele = { shape: 'circle', x: target.x, z: target.z, radius: w.circleRadius, yaw: 0, arcDeg: 360 };
      state.events.push({ kind: 'enemyTelegraph', enemyId: e.id });
      break;
    }
    case 'chant': {
      e.yaw = turnToward(e.yaw, Math.atan2(e.tele.x - e.x, e.tele.z - e.z), w.turnRateDeg * DEG * edt);
      if (e.aiTime >= w.channelMs / 1000 + tuning.coop.lagGraceMs / 1000) {
        let caught = 0;
        for (const p of state.players) {
          if (tuning.debug.passiveEnemies || p.mode === 'down' || Math.hypot(p.x - e.tele.x, p.z - e.tele.z) > e.tele.radius) continue;
          // A dodge's i-frames slip it, as they slip a hit.
          if (heroInvulnerable(p)) continue;
          // It lands on the floor: a hero high enough in the air is over it, by the jump's rule.
          if (clearsLow(p, e.y)) continue;
          chillHero(state, p);
          caught++;
        }
        state.events.push({ kind: 'circleLanded', enemyId: e.id, x: e.tele.x, z: e.tele.z, caught });
        e.tele.shape = 'none';
        setAi(e, 'recover');
        e.recoverTime = w.recoveryMs / 1000;
      }
      break;
    }
  }
  return want;
}

export type Brain = (state: SimState, world: World, e: EnemyState, target: PlayerState | null, edt: number) => Intent;

/**
 * One brain a role (E1a): every kind steps through its role's, so a dungeon type's roster is a
 * dressing of these. Shield, charger, caster, leader and elite arrive with their first enemies
 * (E1b to E1f); until then no kind is dressed as them.
 */
const ROLE_BRAINS: Partial<Record<EnemyRole, Brain>> = {
  fodder: gruntBrain,
  archer: archerBrain,
  heavy: bruteBrain,
  boss: wardenBrain,
  shield: shieldBrain,
  charger: chargerBrain,
  leader: leaderBrain,
  elite: eliteBrain,
  caster: casterBrain,
};

/** The brain a kind steps through: its role's. */
export function brainFor(kind: EnemyKind): Brain | undefined {
  // Each boss keeps a brain of its own (roles.ts): the Warden's is the role's.
  if (kind === 'king') return kingBrain;
  return ROLE_BRAINS[roleOf(kind)];
}

/** Cooldown after an attack, per kind. */
function attackCooldown(e: EnemyState): number {
  switch (e.kind) {
    case 'grunt':
      return tuning.grunt.attackCooldownMs / 1000;
    case 'archer':
      return tuning.archer.cooldownMs / 1000;
    case 'brute':
      return tuning.brute.cooldownMs / 1000;
    case 'shieldbearer':
      return tuning.shieldbearer.attackCooldownMs / 1000;
    case 'hound':
      return tuning.hound.cooldownMs / 1000;
    case 'priest':
      return tuning.priest.raiseEveryMs / 1000;
    case 'knight':
      return tuning.knight.attackCooldownMs / 1000;
    case 'wraith':
      return tuning.wraith.cooldownMs / 1000;
    case 'warden':
      return wardenPace(e).cooldownMs / 1000;
    case 'king':
      return kingPace(e).cooldownMs / 1000;
  }
}

/**
 * Remains a Bone Priest can raise (E1e): a fallen skeleton (fodder, archer or shield) while a living
 * Priest is in the room, kept past its death time until the Priest falls. Haunted's own rise comes
 * first, and one a Priest has raised does not rise again under Haunted.
 */
export function raisable(state: SimState, e: EnemyState): boolean {
  if (e.ai !== 'dead' || willRise(state, e)) return false;
  const role = roleOf(e.kind);
  if (role !== 'fodder' && role !== 'archer' && role !== 'shield') return false;
  return state.enemies.some((o) => roleOf(o.kind) === 'leader' && o.ai !== 'dead');
}

/** Haunted (P8): a fallen enemy that has not yet got up, and will. The Warden falls once. */
export function willRise(state: SimState, e: EnemyState): boolean {
  return state.floor?.modifier === 'haunted' && e.ai === 'dead' && !e.risen && roleOf(e.kind) !== 'boss';
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
    let kx = e.kbx * dt;
    let kz = e.kbz * dt;
    if (c.sweepFastMoves) {
      // A launch slides up to a metre a tick: stop it at the wall rather than through it.
      const len = Math.hypot(kx, kz);
      const free = sweptDistance(e.x, e.y, e.z, kx, kz, stats.radius, world.colliders);
      if (free < len) {
        kx *= free / len;
        kz *= free / len;
        e.kbx = 0;
        e.kbz = 0;
      }
    }
    e.x += kx;
    e.z += kz;
    const friction = Math.exp(-c.knockbackFriction * dt);
    e.kbx *= friction;
    e.kbz *= friction;
    if (e.armour !== undefined) {
      e.armour -= dt;
      if (e.armour <= 0) delete e.armour;
    }

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
          if (c.postStaggerArmour && (roleOf(e.kind) === 'heavy' || roleOf(e.kind) === 'boss')) e.armour = c.postStaggerArmourMs / 1000;
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
        want = brainFor(e.kind)!(state, world, e, target, edt);
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
    // A Ranger's root (the builds pass) stops the walk only: knockback above still moves it.
    if (isRooted(state, e)) {
      e.vx = 0;
      e.vz = 0;
    }
    if (e.ai !== 'dead' && e.ai !== 'stagger' && e.ai !== 'spawn' && e.ai !== 'roar') {
      e.x += e.vx * dt;
      e.z += e.vz * dt;
    }
    settle(state, world, e, fromX, fromZ);
  }

  stepLaunched(state);

  // Haunted (P8): each enemy gets up once, at half its health, a moment after it falls.
  for (const e of state.enemies) {
    if (!willRise(state, e) || e.aiTime < tuning.dungeon.hauntedRiseMs / 1000) continue;
    e.risen = true;
    e.hp = e.maxHp * tuning.dungeon.hauntedHp;
    e.poise = enemyStats(e.kind).maxPoise;
    setAi(e, 'spawn');
    state.events.push({ kind: 'enemyRose', enemyId: e.id, x: e.x, z: e.z });
  }
  state.enemies = state.enemies.filter((e) => !(e.ai === 'dead' && e.aiTime >= enemyStats(e.kind).deathMs / 1000 && !willRise(state, e) && !raisable(state, e)));
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
    const share = roleOf(e.kind) === 'fodder' || roleOf(e.kind) === 'archer' ? 0.7 : 0.15;
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
