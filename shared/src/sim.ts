/**
 * Hearthgate shared simulation.
 *
 * Everything in this file is deterministic and side-effect free: given the same
 * state and the same inputs it produces the same result on the server and on
 * the client. The server runs it as the single source of truth. The client runs
 * `applyInput` on its own player for prediction, then reconciles against the
 * server's copy.
 *
 * Units: metres and milliseconds. The level is centred on the origin.
 * Facing is a yaw in radians where the forward vector is (sin f, cos f),
 * which matches Three.js `rotation.y`.
 */

import { applyState, expireStates, hasState, resolveHit, type StateSet } from "./states";
import { ARENA_HALF, OPEN_FIELD, collideWalls, type Level } from "./level";

export { ARENA_HALF };

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE; // 50 ms

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

/**
 * Downs (design doc, "Downs, revives and wipes"). A player at zero health is downed, not
 * dead: they crawl and cannot fight while a bleed-out timer runs. A standing teammate who
 * stays next to them for `pickupMs` picks them up at no cost; walking off, swinging or
 * dodging breaks the channel and it starts again. The pickup is proximity, not a button,
 * so it works the same on keyboard, gamepad and a later touch layout. Bleeding out is
 * dead for the fight: back when the room is clear (the last enemy falls) or the squad wipes.
 */
export const DOWNS = {
  /** 30 s to begin with, tuned in playtests (design doc). */
  bleedOutMs: 30000,
  crawlSpeed: 1.2, // m/s, a fifth of walking: you can drag yourself to a friend, not flee
  /** Centre to centre, so about a metre of gap between two capsules. */
  pickupRange: 2,
  pickupMs: 1500,
  /** Health a picked-up player stands with. */
  pickupHp: 40
} as const;

/** What an enemy kind is made of. The roster item adds kinds; the AI in stepEnemy reads these. */
export interface EnemyDef {
  hp: number;
  radius: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackArc: number;
  /** The telegraph: long enough to read and dodge. */
  windupMs: number;
  recoverMs: number;
  damage: number;
}

export const GOBLIN: EnemyDef = {
  hp: 60,
  radius: 0.5,
  speed: 3.4,
  aggroRange: 14,
  attackRange: 1.8,
  attackArc: Math.PI * 0.8,
  windupMs: 650,
  recoverMs: 600,
  damage: 15
};

export const ENEMY_KINDS = { goblin: GOBLIN } as const satisfies Record<string, EnemyDef>;
export type EnemyKind = keyof typeof ENEMY_KINDS;

/**
 * The room (one encounter until floors exist). Enemies stay dead once killed; when the
 * last one falls the room is clear, the downed get up and the dead come back, and after
 * `resetMs` the enemies return to their spawns for another go. Stairs replace the reset
 * when the Warrens floor lands.
 */
export const ROOM = {
  resetMs: 6000
} as const;

/**
 * Hit feedback, client-side presentation only (it never feeds back into the sim).
 * Landing a hit nudges the camera a little toward the enemy; taking one shoves it
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

/**
 * Client clock sync (see clock.ts). The client pings; the server echoes its simulation
 * time, and every patch carries its tick's time too. The message with the shortest trip
 * from server to client in the window is the one least delayed by queueing, so its offset
 * is the floor the snapshots can be expected to reach, and remote players are drawn
 * INTERP_DELAY behind that floor. The applied offset slews toward it at
 * a bounded rate: a remote player drawn against a clock moving `slewMsPerS` runs at most
 * 1% off speed, which nobody sees, where a jump would show as a skip or a stall.
 */
export const CLOCK_SYNC = {
  /** How long a sample counts, ms. Every patch is a sample too, so the window holds hundreds. */
  windowMs: 20000,
  /** Ping cadence: quick at first so the window has a few samples within a second. */
  pingFastMs: 250,
  pingFastCount: 12,
  pingMs: 1000,
  /** Fastest the applied offset may move, in ms per second of client time. */
  slewMsPerS: 10,
  /** A target this far from the applied offset is taken at once (first sample, a tab that slept). */
  snapMs: 250
} as const;

/**
 * States and combos (design doc, "States and combos"; logic in states.ts). Every ability
 * either applies a state or consumes one; the payoff grows with how many *different*
 * players took part (appliers plus the finisher), never with their levels, so a tier-1
 * setup feeding a tier-5 finish is worth more than the veteran alone.
 * Durations are long enough for a second player to react to a first player's setup.
 */
export const STATES = {
  soaked: { durationMs: 8000 },
  staggered: { durationMs: 2500 },
  marked: { durationMs: 8000 },
  burning: { durationMs: 5000 },
  rooted: { durationMs: 3000 },
  chilled: { durationMs: 6000 }
} as const;

export const COMBO = {
  /** Payoff multiplier gained per distinct contributor beyond the first. */
  perContributor: 0.5,
  /** Distinct contributors past this add nothing (eight players must not one-shot a boss). */
  maxContributors: 4,
  /** Marked: extra damage on every hit from anyone, as a fraction of the hit. */
  markedBonus: 0.25,
  /** Staggered, consumed by Backstab or Execute: a critical hit and a knockdown. */
  staggerCritMult: 2,
  knockdownMs: 1200,
  /** Soaked, consumed by lightning: the bolt jumps to enemies this close, for this share of the hit. */
  chainRadius: 4,
  chainShare: 0.6,
  /** Soaked, consumed by frost: frozen in place (rooted and chilled). */
  freezeMs: 2000,
  /** Burning, consumed by oil or wind: spreads to enemies this close. */
  spreadRadius: 4,
  /** Chilled, consumed by Shatter: flat bonus damage before the combo multiplier. */
  shatterBonus: 40
} as const;

/**
 * Abilities (design doc, "Abilities"). Three slots a player; which ability sits in a slot
 * comes from the weapon's style. Each is a committed move like the sword swing: a windup,
 * then the hit resolves on the server, then a cooldown on that slot.
 */
export const ABILITIES = {
  /** Melee, slot 1: a wide swing that staggers everything in front. */
  cleave: {
    windupMs: 250, // longer than the sword's 150: it is the big swing
    durationMs: 600,
    range: 2.8,
    arc: Math.PI * 1.1, // 198 degrees: "everything in front"
    damage: 14,
    cooldownMs: 6000
  }
} as const;

export type AbilityId = keyof typeof ABILITIES;

/**
 * Slots by weapon. Only the sword (Melee) exists until the weapon classes land, so slot 1
 * is Cleave and slots 2 and 3 are empty; Arrow rain and Magic missile arrive with the bow
 * and the staff.
 */
export const SWORD_SLOTS: readonly (AbilityId | "")[] = ["cleave", "", ""];
export const ABILITY_SLOTS = 3;

/** Where the first goblin stands in every level so far (the hit-feedback test walks to it). */
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
  /** Ability slot pressed this tick, 1..ABILITY_SLOTS, or 0 / absent for none. */
  ability?: number;
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
  /** Time the current ability finishes (0 when none). */
  abilityUntil: number;
  /** Time the current ability's hit resolves (0 when resolved or none). */
  abilityHitAt: number;
  /** Slot of the current or last ability, 1..ABILITY_SLOTS (0 before the first). */
  abilitySlot: number;
  /** Per slot, when it is off cooldown. */
  readyAt: number[];
  /** When a dead player comes back (0 when alive, or dead and waiting for the room to clear). */
  respawnAt: number;
  /** Bleed-out deadline while downed (0 when standing or dead). */
  downedUntil: number;
  /** Pickup channel progress while downed, ms; back to 0 when nobody is next to them. */
  pickupMs: number;
  /** Who is picking this player up ("" when nobody). */
  pickupBy: string;
  spawnX: number;
  spawnZ: number;
}

export type EnemyPhase = "idle" | "chase" | "windup" | "recover" | "dead";

export interface EnemySim {
  /** Stable within a room: the client keys its meshes and snapshot buffers by it. */
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  facing: number;
  hp: number;
  maxHp: number;
  phase: EnemyPhase;
  /** When the current phase ends (windup, recover). */
  phaseUntil: number;
  targetId: string;
  /** Time until which the enemy shows a hit flash. */
  hitFlashUntil: number;
  /** Active states (states.ts); cleared when it dies. */
  states: StateSet;
  spawnX: number;
  spawnZ: number;
  spawnFacing: number;
}

/** The enemies of one room and when a cleared room resets. The server owns one per room. */
export interface Encounter {
  level: Level;
  enemies: Map<string, EnemySim>;
  /** When the cleared room's enemies return (0 while any is alive). */
  resetAt: number;
}

export type SimEvent =
  | { kind: "playerHit"; attackerId: string; enemyId: string; damage: number; enemyHp: number }
  | { kind: "abilityHit"; attackerId: string; enemyId: string; ability: AbilityId; damage: number; enemyHp: number; interrupted: boolean }
  | { kind: "enemyKilled"; killerId: string; enemyId: string }
  | { kind: "enemyHit"; targetId: string; enemyId: string; damage: number; targetHp: number }
  | { kind: "roomCleared"; byId: string }
  | { kind: "roomReset" }
  | { kind: "playerDowned"; playerId: string }
  | { kind: "playerPickedUp"; playerId: string; byId: string }
  | { kind: "playerDied"; playerId: string }
  | { kind: "squadWiped" }
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
    abilityUntil: 0,
    abilityHitAt: 0,
    abilitySlot: 0,
    readyAt: [0, 0, 0],
    respawnAt: 0,
    downedUntil: 0,
    pickupMs: 0,
    pickupBy: "",
    spawnX: x,
    spawnZ: z
  };
}

export function createEnemy(
  id = "e1",
  kind: EnemyKind = "goblin",
  x: number = ENEMY_SPAWN.x,
  z: number = ENEMY_SPAWN.z,
  facing = Math.PI
): EnemySim {
  const def = ENEMY_KINDS[kind];
  return {
    id,
    kind,
    x,
    z,
    facing,
    hp: def.hp,
    maxHp: def.hp,
    phase: "idle",
    phaseUntil: 0,
    targetId: "",
    hitFlashUntil: 0,
    states: {},
    spawnX: x,
    spawnZ: z,
    spawnFacing: facing
  };
}

/** The level's enemies, keyed e1, e2, ... in the level's order. */
export function createEnemies(level: Level): Map<string, EnemySim> {
  const m = new Map<string, EnemySim>();
  level.enemies.forEach((s, i) => {
    const id = `e${i + 1}`;
    m.set(id, createEnemy(id, s.kind, s.x, s.z, s.facing));
  });
  return m;
}

export function createEncounter(level: Level): Encounter {
  return { level, enemies: createEnemies(level), resetAt: 0 };
}

/** Back at the spawn, full health, forgetting everything. */
export function resetEnemy(e: EnemySim): void {
  e.x = e.spawnX;
  e.z = e.spawnZ;
  e.facing = e.spawnFacing;
  e.hp = e.maxHp;
  e.phase = "idle";
  e.phaseUntil = 0;
  e.targetId = "";
  e.hitFlashUntil = 0;
  e.states = {};
}

/** An input that does nothing, used when a client sent nothing this tick. */
export function neutralInput(seq: number): InputFrame {
  return { seq, dx: 0, dy: 0, attack: false, dodge: false, ability: 0 };
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
    typeof f.dodge === "boolean" &&
    (f.ability === undefined || (Number.isInteger(f.ability) && (f.ability as number) >= 0 && (f.ability as number) <= ABILITY_SLOTS))
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

/** Keep inside the bare arena (no walls). The levelled form is collideWalls in level.ts. */
export function clampToArena(o: { x: number; z: number }, radius: number): void {
  collideWalls(o, radius, OPEN_FIELD);
}

export function isDodging(p: PlayerSim, now: number): boolean {
  return now < p.dodgeUntil;
}

/** Committed to a sword swing or an ability: no walking, no new swing. */
export function isAttacking(p: PlayerSim, now: number): boolean {
  return now < p.attackUntil || now < p.abilityUntil;
}

/** The ability in a slot (1-based) for the weapon the player holds, or "" for an empty slot. */
export function abilityInSlot(slot: number): AbilityId | "" {
  return SWORD_SLOTS[slot - 1] ?? "";
}

/** Standing: has health, can move at full speed and fight. */
export function isAlive(p: PlayerSim): boolean {
  return p.hp > 0;
}

/** At zero health with the bleed-out timer running. */
export function isDowned(p: PlayerSim): boolean {
  return p.hp <= 0 && p.downedUntil > 0;
}

/** Bled out, or wiped: out of the fight until the room clears or the squad respawns. */
export function isDead(p: PlayerSim): boolean {
  return p.hp <= 0 && p.downedUntil === 0;
}

export function isEnemyAlive(e: EnemySim): boolean {
  return e.phase !== "dead";
}

/**
 * Advance one player by one input over dtMs at simulation time `now`, inside `level`.
 * Mutates `p`. Identical on client (prediction) and server (truth): both must pass the
 * room's level, or a wall the server knows about would be a snap for the client.
 */
export function applyInput(p: PlayerSim, input: InputFrame, now: number, dtMs: number, level: Level = OPEN_FIELD): void {
  p.lastSeq = input.seq;
  const downed = isDowned(p);
  if (!isAlive(p) && !downed) return;

  const dt = dtMs / 1000;
  let dx = input.dx;
  let dz = input.dy;
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  const moving = len > 0.001;

  if (downed) {
    // A crawl: slow movement, no swing, no dodge.
    if (moving) {
      p.x += dx * DOWNS.crawlSpeed * dt;
      p.z += dz * DOWNS.crawlSpeed * dt;
      p.facing = Math.atan2(dx, dz);
    }
    collideWalls(p, PLAYER.radius, level);
    return;
  }

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

  // Start an ability, or else a swing. Both hits resolve later in resolvePlayerAttacks.
  const slot = input.ability ?? 0;
  const ability = slot > 0 ? abilityInSlot(slot) : "";
  if (ability && !attacking && !isDodging(p, now) && now >= p.readyAt[slot - 1]) {
    const def = ABILITIES[ability];
    p.abilityUntil = now + def.durationMs;
    p.abilityHitAt = now + def.windupMs;
    p.abilitySlot = slot;
    p.readyAt[slot - 1] = now + def.cooldownMs;
  } else if (input.attack && !attacking && !isDodging(p, now)) {
    p.attackUntil = now + PLAYER.attackDurationMs;
    p.attackHitAt = now + PLAYER.attackWindupMs;
  }

  collideWalls(p, PLAYER.radius, level);
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

/** Living enemies inside the cone, nearest first (soft auto-targeting, design doc). */
export function enemiesInCone(from: PlayerSim, enemies: readonly EnemySim[], range: number, arc: number): EnemySim[] {
  const hits: { e: EnemySim; d: number }[] = [];
  for (const e of enemies) {
    if (!isEnemyAlive(e)) continue;
    if (!inCone(from, e, range, arc, ENEMY_KINDS[e.kind].radius)) continue;
    hits.push({ e, d: Math.hypot(e.x - from.x, e.z - from.z) });
  }
  hits.sort((a, b) => a.d - b.d || (a.e.id < b.e.id ? -1 : 1));
  return hits.map((h) => h.e);
}

/**
 * Resolve any player swings and abilities whose hit time has arrived. Server only.
 * The sword hits the nearest enemy in its cone; Cleave hits every enemy in its wider one.
 * When the last enemy falls the room is clear: the downed get up and the dead come back.
 */
export function resolvePlayerAttacks(
  playerList: Iterable<PlayerSim>,
  enemyList: Iterable<EnemySim>,
  now: number
): SimEvent[] {
  const events: SimEvent[] = [];
  const players = [...playerList];
  const enemies = [...enemyList];
  const hit = (e: EnemySim, damage: number) => {
    e.hp = Math.max(0, e.hp - damage);
    e.hitFlashUntil = now + 120;
  };
  // After the hit event: a kill, and the clear if it was the last one standing.
  const settle = (p: PlayerSim, e: EnemySim) => {
    if (e.hp > 0) return;
    e.phase = "dead";
    e.states = {};
    e.phaseUntil = 0;
    e.targetId = "";
    events.push({ kind: "enemyKilled", killerId: p.id, enemyId: e.id });
    if (enemies.every((o) => !isEnemyAlive(o))) {
      events.push({ kind: "roomCleared", byId: p.id });
      events.push(...recoverOnClear(players, now));
    }
  };
  for (const p of players) {
    if (p.abilityHitAt !== 0 && now >= p.abilityHitAt) {
      p.abilityHitAt = 0;
      const ability = abilityInSlot(p.abilitySlot);
      if (ability === "cleave") {
        const def = ABILITIES.cleave;
        for (const e of enemiesInCone(p, enemies, def.range, def.arc)) {
          // An area melee hit: it lands in full on the Rooted, then staggers. A stagger
          // breaks a windup in progress, which is how Melee answers a telegraph.
          const { damage } = resolveHit(e.states, { damage: def.damage, tags: ["melee", "area"], byId: p.id }, now);
          applyState(e.states, "staggered", p.id, now);
          hit(e, damage);
          const interrupted = e.phase === "windup" && e.hp > 0;
          if (interrupted) {
            e.phase = "recover";
            e.phaseUntil = now + ENEMY_KINDS[e.kind].recoverMs;
          }
          events.push({ kind: "abilityHit", attackerId: p.id, enemyId: e.id, ability, damage, enemyHp: e.hp, interrupted });
          settle(p, e);
        }
      }
    }
    if (p.attackHitAt === 0 || now < p.attackHitAt) continue;
    p.attackHitAt = 0;
    const target = enemiesInCone(p, enemies, PLAYER.attackRange, PLAYER.attackArc)[0];
    if (!target) continue;
    // The sword is a plain melee hit: it consumes nothing, but a Marked target takes more.
    const { damage } = resolveHit(target.states, { damage: PLAYER.attackDamage, tags: ["melee"], byId: p.id }, now);
    hit(target, damage);
    events.push({ kind: "playerHit", attackerId: p.id, enemyId: target.id, damage, enemyHp: target.hp });
    settle(p, target);
  }
  return events;
}

/**
 * The room is clear: the downed get up where they lie and the dead come back at their
 * spawn after the usual respawn time, all for free (design doc).
 */
function recoverOnClear(players: readonly PlayerSim[], now: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (const q of players) {
    if (isDowned(q)) {
      standUp(q, DOWNS.pickupHp);
      events.push({ kind: "playerPickedUp", playerId: q.id, byId: "" });
    } else if (isDead(q) && q.respawnAt === 0) {
      q.respawnAt = now + PLAYER.respawnMs;
    }
  }
  return events;
}

function standUp(p: PlayerSim, hp: number): void {
  p.hp = hp;
  p.downedUntil = 0;
  p.pickupMs = 0;
  p.pickupBy = "";
}

/** Zero health: down the player, cancel what they were doing. */
export function downPlayer(p: PlayerSim, now: number): void {
  p.hp = 0;
  p.downedUntil = now + DOWNS.bleedOutMs;
  p.pickupMs = 0;
  p.pickupBy = "";
  p.attackUntil = 0;
  p.attackHitAt = 0;
  p.abilityUntil = 0;
  p.abilityHitAt = 0;
  p.dodgeUntil = 0;
}

/** A standing teammate close enough to pick `p` up, and not busy swinging or dodging. */
function pickupHelper(p: PlayerSim, players: readonly PlayerSim[], now: number): PlayerSim | null {
  // Keep the current helper while they qualify, so two friends do not trade the channel.
  let best: PlayerSim | null = null;
  let bestD = Infinity;
  for (const q of players) {
    if (q === p || !isAlive(q) || isAttacking(q, now) || isDodging(q, now)) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d > DOWNS.pickupRange) continue;
    if (q.id === p.pickupBy) return q;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * Advance downs by one tick: pickup channels, bleed-outs, and the wipe. Server only.
 * Run after the enemies have stepped, so a player downed this tick is counted.
 */
export function stepDowns(
  playerList: Iterable<PlayerSim>,
  enemyList: Iterable<EnemySim>,
  now: number,
  dtMs: number
): SimEvent[] {
  const events: SimEvent[] = [];
  const players = [...playerList];
  for (const p of players) {
    if (!isDowned(p)) continue;
    const helper = pickupHelper(p, players, now);
    if (helper) {
      if (helper.id !== p.pickupBy) p.pickupMs = 0;
      p.pickupBy = helper.id;
      p.pickupMs += dtMs;
      if (p.pickupMs >= DOWNS.pickupMs) {
        standUp(p, DOWNS.pickupHp);
        events.push({ kind: "playerPickedUp", playerId: p.id, byId: helper.id });
        continue;
      }
    } else {
      p.pickupMs = 0;
      p.pickupBy = "";
    }
    if (now >= p.downedUntil) {
      p.downedUntil = 0;
      p.pickupMs = 0;
      p.pickupBy = "";
      p.respawnAt = 0; // dead for the fight: waits for the room to clear or a wipe
      events.push({ kind: "playerDied", playerId: p.id });
    }
  }

  // Wipe: nobody standing. Everyone comes back at their spawn and the fight resets.
  const wiped =
    players.length > 0 && players.every((p) => !isAlive(p)) && players.some((p) => p.respawnAt === 0);
  if (wiped) {
    for (const p of players) {
      p.downedUntil = 0;
      p.pickupMs = 0;
      p.pickupBy = "";
      p.respawnAt = now + PLAYER.respawnMs;
    }
    for (const e of enemyList) resetEnemy(e);
    events.push({ kind: "squadWiped" });
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

/** Advance one enemy by one tick. Server only. A dead enemy stays dead until the room resets. */
export function stepEnemy(
  enemy: EnemySim,
  players: Map<string, PlayerSim>,
  now: number,
  dtMs: number,
  level: Level = OPEN_FIELD
): SimEvent[] {
  const events: SimEvent[] = [];
  const dt = dtMs / 1000;
  const def = ENEMY_KINDS[enemy.kind];
  expireStates(enemy.states, now);

  if (enemy.phase === "dead") return events;

  // Keep the current target while it is alive and in range, else re-acquire.
  let target = enemy.targetId ? players.get(enemy.targetId) ?? null : null;
  if (!target || !isAlive(target)) target = nearestAlivePlayer(enemy, players.values());
  if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) > def.aggroRange * 1.5) {
    target = nearestAlivePlayer(enemy, players.values());
  }
  enemy.targetId = target ? target.id : "";

  switch (enemy.phase) {
    case "idle": {
      if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) <= def.aggroRange) {
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
      if (dist <= def.attackRange) {
        enemy.phase = "windup";
        enemy.phaseUntil = now + def.windupMs;
      } else if (!hasState(enemy.states, "rooted", now)) {
        // Straight at the target; a wall in the way turns the step into a slide along it.
        const step = Math.min(def.speed * dt, dist - def.attackRange * 0.9);
        enemy.x += (vx / dist) * step;
        enemy.z += (vz / dist) * step;
        collideWalls(enemy, def.radius, level);
      }
      break;
    }
    case "windup": {
      if (now < enemy.phaseUntil) break;
      // The swing lands. Facing was locked at windup start, so a dodge sideways escapes it.
      if (target && isAlive(target) && !isDodging(target, now)) {
        if (inCone(enemy, target, def.attackRange * 1.15, def.attackArc, PLAYER.radius)) {
          target.hp = Math.max(0, target.hp - def.damage);
          events.push({ kind: "enemyHit", targetId: target.id, enemyId: enemy.id, damage: def.damage, targetHp: target.hp });
          if (target.hp === 0) {
            downPlayer(target, now);
            events.push({ kind: "playerDowned", playerId: target.id });
          }
        }
      }
      enemy.phase = "recover";
      enemy.phaseUntil = now + def.recoverMs;
      break;
    }
    case "recover": {
      if (now >= enemy.phaseUntil) enemy.phase = "chase";
      break;
    }
  }
  return events;
}

/**
 * Keep living enemies from standing inside each other: overlapping pairs are pushed apart,
 * half each, then back out of the walls. Pairs in id order so the result does not depend on
 * how the caller stored them.
 */
export function separateEnemies(enemyList: Iterable<EnemySim>, level: Level): void {
  const live = [...enemyList].filter(isEnemyAlive).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const minD = ENEMY_KINDS[a.kind].radius + ENEMY_KINDS[b.kind].radius;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      if (d >= minD) continue;
      if (d < 1e-6) {
        // Exactly on top of each other (a shared spawn): part them along x.
        dx = 1;
        dz = 0;
        d = 1;
      }
      const push = (minD - d) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      b.x += (dx / d) * push;
      b.z += (dz / d) * push;
    }
  }
  for (const e of live) collideWalls(e, ENEMY_KINDS[e.kind].radius, level);
}

/** Advance every enemy by one tick, then keep them apart. Server only. */
export function stepEnemies(
  enemyList: Iterable<EnemySim>,
  players: Map<string, PlayerSim>,
  now: number,
  dtMs: number,
  level: Level
): SimEvent[] {
  const events: SimEvent[] = [];
  const enemies = [...enemyList];
  for (const e of enemies) events.push(...stepEnemy(e, players, now, dtMs, level));
  separateEnemies(enemies, level);
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
    p.downedUntil = 0;
    p.pickupMs = 0;
    p.pickupBy = "";
    p.dodgeUntil = 0;
    p.attackUntil = 0;
    p.attackHitAt = 0;
    p.abilityUntil = 0;
    p.abilityHitAt = 0;
    p.readyAt = [0, 0, 0];
    events.push({ kind: "playerRespawned", playerId: p.id });
  }
  return events;
}

/**
 * One server tick of the fight, after the players' inputs have been applied: hits land,
 * enemies move and swing, downs and respawns advance, and a cleared room resets after
 * ROOM.resetMs. Server only.
 */
export function stepEncounter(enc: Encounter, players: Map<string, PlayerSim>, now: number, dtMs: number): SimEvent[] {
  const events: SimEvent[] = [];
  events.push(...resolvePlayerAttacks(players.values(), enc.enemies.values(), now));
  if (events.some((e) => e.kind === "roomCleared")) enc.resetAt = now + ROOM.resetMs;
  events.push(...stepEnemies(enc.enemies.values(), players, now, dtMs, enc.level));
  events.push(...stepDowns(players.values(), enc.enemies.values(), now, dtMs));
  if (events.some((e) => e.kind === "squadWiped")) enc.resetAt = 0; // the wipe already reset the enemies
  events.push(...stepRespawns(players.values(), now));
  if (enc.resetAt !== 0 && now >= enc.resetAt) {
    enc.resetAt = 0;
    for (const e of enc.enemies.values()) resetEnemy(e);
    events.push({ kind: "roomReset" });
  }
  return events;
}
