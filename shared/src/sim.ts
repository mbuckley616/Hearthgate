/**
 * Hearthgate shared simulation.
 *
 * Everything in this file is deterministic and side-effect free: given the same
 * state and the same inputs it produces the same result on the server and on
 * the client. The server runs it as the single source of truth. The client runs
 * `applyInput` on its own player for prediction, then reconciles against the
 * server's copy.
 *
 * Units: metres and milliseconds. The arena is centred on the origin.
 * Facing is a yaw in radians where the forward vector is (sin f, cos f),
 * which matches Three.js `rotation.y`.
 */

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE; // 50 ms

export const ARENA_HALF = 20; // the arena is 40 x 40 m

export const PLAYER = {
  hp: 100,
  radius: 0.5,
  speed: 6, // m/s
  attackRange: 2.4,
  attackArc: Math.PI * 0.6, // total cone width, 108 degrees
  attackWindupMs: 150, // time from pressing attack until the hit resolves
  attackDurationMs: 450, // total time the player is committed to the swing
  attackDamage: 20,
  dodgeSpeed: 16,
  dodgeMs: 220,
  dodgeCooldownMs: 900,
  respawnMs: 3000
} as const;

export const GOBLIN = {
  hp: 60,
  radius: 0.5,
  speed: 3.4,
  aggroRange: 14,
  attackRange: 1.8,
  attackArc: Math.PI * 0.8,
  windupMs: 650, // the telegraph: long enough to read and dodge
  recoverMs: 600,
  damage: 15,
  respawnMs: 2500
} as const;

/**
 * Hit feedback, client-side presentation only (it never feeds back into the sim).
 * Landing a hit nudges the camera a little toward the goblin; taking one shoves it
 * harder, away. Short enough to read as impact rather than camera shake.
 */
export const HIT_FEEDBACK = {
  dealtNudgeM: 0.12,
  dealtNudgeMs: 110,
  takenNudgeM: 0.32,
  takenNudgeMs: 180,
  /** Volume for hits that do not involve you, relative to your own (0..1). */
  othersVolume: 0.35
} as const;

export const SPAWN_POINTS = [
  { x: -3, z: 3 },
  { x: 3, z: 3 },
  { x: -3, z: -3 },
  { x: 3, z: -3 },
  { x: -6, z: 0 },
  { x: 6, z: 0 },
  { x: 0, z: 6 },
  { x: 0, z: -6 }
] as const;

/**
 * Server-side input flood limit, a token bucket per client. An honest client sends
 * TICK_RATE (20) inputs a second; the refill sits above that so ordinary jitter never
 * trips it, and the burst lets a client that stalled for a second dump its backlog.
 * Only a sustained rate above `ratePerSec` drains the bucket and gets the client dropped.
 */
export const INPUT_LIMIT = {
  ratePerSec: 25,
  burst: 25
} as const;

export const ENEMY_SPAWN = { x: 9, z: -9 } as const;

export const PLAYER_COLORS = [
  "#e8b24a", // amber
  "#5fa8d3", // sky
  "#8fc67a", // moss
  "#d96c6c", // clay
  "#b48ad9", // heather
  "#64c7b8", // teal
  "#e59c6b", // peach
  "#c9c9c9" // ash
] as const;

/** One tick of player intent, sent from the client to the server at TICK_RATE. */
export interface InputFrame {
  seq: number;
  /** Horizontal move axis, -1..1 (left/right on screen = world x). */
  dx: number;
  /** Vertical move axis, -1..1 (up/down on screen = world z). */
  dy: number;
  attack: boolean;
  dodge: boolean;
}

export interface PlayerSim {
  id: string;
  x: number;
  z: number;
  facing: number;
  hp: number;
  /** Sequence number of the last input the simulation applied. */
  lastSeq: number;
  dodgeUntil: number;
  dodgeCooldownUntil: number;
  dodgeDx: number;
  dodgeDz: number;
  /** Time the current swing finishes (0 when not attacking). */
  attackUntil: number;
  /** Time the current swing's hit resolves (0 when already resolved or not attacking). */
  attackHitAt: number;
  /** When a dead player comes back (0 when alive). */
  respawnAt: number;
  spawnX: number;
  spawnZ: number;
}

export type EnemyPhase = "idle" | "chase" | "windup" | "recover" | "dead";

export interface EnemySim {
  x: number;
  z: number;
  facing: number;
  hp: number;
  phase: EnemyPhase;
  /** When the current phase ends (windup, recover, dead). */
  phaseUntil: number;
  targetId: string;
  /** Time until which the enemy shows a hit flash. */
  hitFlashUntil: number;
}

export type SimEvent =
  | { kind: "playerHit"; attackerId: string; damage: number; enemyHp: number }
  | { kind: "enemyKilled"; killerId: string }
  | { kind: "enemyHit"; targetId: string; damage: number; targetHp: number }
  | { kind: "playerDied"; playerId: string }
  | { kind: "playerRespawned"; playerId: string };

export function createPlayer(id: string, x = 0, z = 0): PlayerSim {
  return {
    id,
    x,
    z,
    facing: 0,
    hp: PLAYER.hp,
    lastSeq: 0,
    dodgeUntil: 0,
    dodgeCooldownUntil: 0,
    dodgeDx: 0,
    dodgeDz: 0,
    attackUntil: 0,
    attackHitAt: 0,
    respawnAt: 0,
    spawnX: x,
    spawnZ: z
  };
}

export function createEnemy(): EnemySim {
  return {
    x: ENEMY_SPAWN.x,
    z: ENEMY_SPAWN.z,
    facing: Math.PI,
    hp: GOBLIN.hp,
    phase: "idle",
    phaseUntil: 0,
    targetId: "",
    hitFlashUntil: 0
  };
}

/** An input that does nothing, used when a client sent nothing this tick. */
export function neutralInput(seq: number): InputFrame {
  return { seq, dx: 0, dy: 0, attack: false, dodge: false };
}

export function isValidInput(v: unknown): v is InputFrame {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.seq === "number" &&
    Number.isFinite(f.seq) &&
    typeof f.dx === "number" &&
    typeof f.dy === "number" &&
    Math.abs(f.dx) <= 1.0001 &&
    Math.abs(f.dy) <= 1.0001 &&
    typeof f.attack === "boolean" &&
    typeof f.dodge === "boolean"
  );
}

export interface InputBucket {
  tokens: number;
  lastAt: number;
}

export function createInputBucket(now: number): InputBucket {
  return { tokens: INPUT_LIMIT.burst, lastAt: now };
}

/**
 * Counts one received input message against the bucket. Returns false once the client
 * has sent more than INPUT_LIMIT allows; the caller decides what to do (the server drops them).
 * `now` is the arrival time in ms, from whatever clock the caller owns.
 */
export function takeInputToken(b: InputBucket, now: number): boolean {
  const elapsed = Math.max(0, now - b.lastAt);
  b.lastAt = now;
  b.tokens = Math.min(INPUT_LIMIT.burst, b.tokens + (elapsed / 1000) * INPUT_LIMIT.ratePerSec);
  b.tokens -= 1;
  return b.tokens >= 0;
}

export function clampToArena(o: { x: number; z: number }, radius: number): void {
  const lim = ARENA_HALF - radius;
  if (o.x < -lim) o.x = -lim;
  if (o.x > lim) o.x = lim;
  if (o.z < -lim) o.z = -lim;
  if (o.z > lim) o.z = lim;
}

export function isDodging(p: PlayerSim, now: number): boolean {
  return now < p.dodgeUntil;
}

export function isAttacking(p: PlayerSim, now: number): boolean {
  return now < p.attackUntil;
}

export function isAlive(p: PlayerSim): boolean {
  return p.hp > 0;
}

/**
 * Advance one player by one input over dtMs at simulation time `now`.
 * Mutates `p`. Identical on client (prediction) and server (truth).
 */
export function applyInput(p: PlayerSim, input: InputFrame, now: number, dtMs: number): void {
  p.lastSeq = input.seq;
  if (!isAlive(p)) return;

  const dt = dtMs / 1000;
  let dx = input.dx;
  let dz = input.dy;
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  const moving = len > 0.001;

  const attacking = isAttacking(p, now);
  const dodging = isDodging(p, now);

  // Start a dodge: in the input direction, or forward if standing still.
  if (input.dodge && !dodging && !attacking && now >= p.dodgeCooldownUntil) {
    if (moving) {
      const n = Math.max(len, 1);
      p.dodgeDx = dx / n;
      p.dodgeDz = dz / n;
      const l2 = Math.hypot(p.dodgeDx, p.dodgeDz);
      p.dodgeDx /= l2;
      p.dodgeDz /= l2;
    } else {
      p.dodgeDx = Math.sin(p.facing);
      p.dodgeDz = Math.cos(p.facing);
    }
    p.facing = Math.atan2(p.dodgeDx, p.dodgeDz);
    p.dodgeUntil = now + PLAYER.dodgeMs;
    p.dodgeCooldownUntil = now + PLAYER.dodgeCooldownMs;
  }

  if (isDodging(p, now)) {
    p.x += p.dodgeDx * PLAYER.dodgeSpeed * dt;
    p.z += p.dodgeDz * PLAYER.dodgeSpeed * dt;
  } else if (!attacking && moving) {
    p.x += dx * PLAYER.speed * dt;
    p.z += dz * PLAYER.speed * dt;
    p.facing = Math.atan2(dx, dz);
  }

  // Start a swing. The hit itself resolves later in resolvePlayerAttacks.
  if (input.attack && !attacking && !isDodging(p, now)) {
    p.attackUntil = now + PLAYER.attackDurationMs;
    p.attackHitAt = now + PLAYER.attackWindupMs;
  }

  clampToArena(p, PLAYER.radius);
}

/** True when `target` is inside a cone in front of `from`. */
export function inCone(
  from: { x: number; z: number; facing: number },
  target: { x: number; z: number },
  range: number,
  arc: number,
  targetRadius: number
): boolean {
  const vx = target.x - from.x;
  const vz = target.z - from.z;
  const dist = Math.hypot(vx, vz);
  if (dist > range + targetRadius) return false;
  if (dist < 0.0001) return true;
  const fx = Math.sin(from.facing);
  const fz = Math.cos(from.facing);
  const cos = (vx * fx + vz * fz) / dist;
  return cos >= Math.cos(arc / 2);
}

/** Resolve any player swings whose hit time has arrived. Server only. */
export function resolvePlayerAttacks(
  players: Iterable<PlayerSim>,
  enemy: EnemySim,
  now: number
): SimEvent[] {
  const events: SimEvent[] = [];
  for (const p of players) {
    if (p.attackHitAt === 0 || now < p.attackHitAt) continue;
    p.attackHitAt = 0;
    if (enemy.phase === "dead") continue;
    if (!inCone(p, enemy, PLAYER.attackRange, PLAYER.attackArc, GOBLIN.radius)) continue;
    enemy.hp = Math.max(0, enemy.hp - PLAYER.attackDamage);
    enemy.hitFlashUntil = now + 120;
    events.push({ kind: "playerHit", attackerId: p.id, damage: PLAYER.attackDamage, enemyHp: enemy.hp });
    if (enemy.hp === 0) {
      enemy.phase = "dead";
      enemy.phaseUntil = now + GOBLIN.respawnMs;
      enemy.targetId = "";
      events.push({ kind: "enemyKilled", killerId: p.id });
    }
  }
  return events;
}

function nearestAlivePlayer(enemy: EnemySim, players: Iterable<PlayerSim>): PlayerSim | null {
  let best: PlayerSim | null = null;
  let bestD = Infinity;
  for (const p of players) {
    if (!isAlive(p)) continue;
    const d = Math.hypot(p.x - enemy.x, p.z - enemy.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Advance the goblin by one tick. Server only. */
export function stepEnemy(
  enemy: EnemySim,
  players: Map<string, PlayerSim>,
  now: number,
  dtMs: number
): SimEvent[] {
  const events: SimEvent[] = [];
  const dt = dtMs / 1000;

  if (enemy.phase === "dead") {
    if (now >= enemy.phaseUntil) {
      enemy.x = ENEMY_SPAWN.x;
      enemy.z = ENEMY_SPAWN.z;
      enemy.hp = GOBLIN.hp;
      enemy.phase = "idle";
      enemy.phaseUntil = 0;
      enemy.targetId = "";
    }
    return events;
  }

  // Keep the current target while it is alive and in range, else re-acquire.
  let target = enemy.targetId ? players.get(enemy.targetId) ?? null : null;
  if (!target || !isAlive(target)) target = nearestAlivePlayer(enemy, players.values());
  if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) > GOBLIN.aggroRange * 1.5) {
    target = nearestAlivePlayer(enemy, players.values());
  }
  enemy.targetId = target ? target.id : "";

  switch (enemy.phase) {
    case "idle": {
      if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) <= GOBLIN.aggroRange) {
        enemy.phase = "chase";
      }
      break;
    }
    case "chase": {
      if (!target) {
        enemy.phase = "idle";
        break;
      }
      const vx = target.x - enemy.x;
      const vz = target.z - enemy.z;
      const dist = Math.hypot(vx, vz);
      enemy.facing = Math.atan2(vx, vz);
      if (dist <= GOBLIN.attackRange) {
        enemy.phase = "windup";
        enemy.phaseUntil = now + GOBLIN.windupMs;
      } else {
        const step = Math.min(GOBLIN.speed * dt, dist - GOBLIN.attackRange * 0.9);
        enemy.x += (vx / dist) * step;
        enemy.z += (vz / dist) * step;
        clampToArena(enemy, GOBLIN.radius);
      }
      break;
    }
    case "windup": {
      if (now < enemy.phaseUntil) break;
      // The swing lands. Facing was locked at windup start, so a dodge sideways escapes it.
      if (target && isAlive(target) && !isDodging(target, now)) {
        if (inCone(enemy, target, GOBLIN.attackRange * 1.15, GOBLIN.attackArc, PLAYER.radius)) {
          target.hp = Math.max(0, target.hp - GOBLIN.damage);
          events.push({ kind: "enemyHit", targetId: target.id, damage: GOBLIN.damage, targetHp: target.hp });
          if (target.hp === 0) {
            target.respawnAt = now + PLAYER.respawnMs;
            target.attackUntil = 0;
            target.attackHitAt = 0;
            events.push({ kind: "playerDied", playerId: target.id });
          }
        }
      }
      enemy.phase = "recover";
      enemy.phaseUntil = now + GOBLIN.recoverMs;
      break;
    }
    case "recover": {
      if (now >= enemy.phaseUntil) enemy.phase = "chase";
      break;
    }
  }
  return events;
}

/** Bring dead players back at their spawn point once their timer is up. Server only. */
export function stepRespawns(players: Iterable<PlayerSim>, now: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (const p of players) {
    if (isAlive(p) || p.respawnAt === 0 || now < p.respawnAt) continue;
    p.hp = PLAYER.hp;
    p.x = p.spawnX;
    p.z = p.spawnZ;
    p.respawnAt = 0;
    p.dodgeUntil = 0;
    p.attackUntil = 0;
    p.attackHitAt = 0;
    events.push({ kind: "playerRespawned", playerId: p.id });
  }
  return events;
}
