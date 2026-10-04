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

import { applyState, expireStates, hasState, resolveHit, type StateSet } from "./states";

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

/**
 * Downs (design doc, "Downs, revives and wipes"). A player at zero health is downed, not
 * dead: they crawl and cannot fight while a bleed-out timer runs. A standing teammate who
 * stays next to them for `pickupMs` picks them up at no cost; walking off, swinging or
 * dodging breaks the channel and it starts again. The pickup is proximity, not a button,
 * so it works the same on keyboard, gamepad and a later touch layout. Bleeding out is
 * dead for the fight: back when the room is clear (the goblin falls) or the squad wipes.
 */
export const DOWNS = {
  /** 30 s to begin with, tuned in playtests (design doc). */
  bleedOutMs: 30000,
  crawlSpeed: 1.2, // m/s, a fifth of walking: you can drag yourself to a friend, not flee
  /** Centre to centre, so about a metre of gap between two capsules. */
  pickupRange: 2,
  pickupMs: 1500,
  /** Health a picked-up player stands with. */
  pickupHp: 40,
  /**
   * Revive Draught, the Phase 1 stand-in (Michael, 2026-10-04: a plain counter, not an
   * item; the Phase 3 ledger replaces it). A standing player uses theirs on a dead
   * teammate's body; nothing else brings the dead back mid-fight. One each per floor.
   * Until floors exist a wipe stands for the end of the run, so a wipe refills it.
   */
  draughtsPerFloor: 1,
  /** Centre to centre, a little more than the pickup so one press next to the body is enough. */
  draughtRange: 2.5,
  /** More than a pickup: the draught is the scarce one. */
  draughtHp: 50
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

/**
 * Client clock sync (see clock.ts). The client pings; the server echoes its simulation
 * time, and every patch carries its tick's time too. The message with the shortest trip
 * from server to client in the window is the one least delayed by queueing, so its offset
 * is the floor the snapshots can be expected to reach, and remote players are drawn
 * an interpolation delay (INTERP) behind that floor. The applied offset slews toward it at
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
 * How far behind the server clock remote players and the goblin are drawn (clock.ts keeps
 * the estimate). The clock sits on the best delivery the link gives, so this delay is the
 * whole budget a late snapshot has: one arriving more than `delay - TICK_MS` behind the best
 * path holds the remote player still until the next. `baseMs` is the floor and the whole
 * delay on a clean link: it absorbs 50 ms of lateness by itself. Above that the delay
 * follows the longest wait for a patch the frames in the clock window saw, so a jittery link
 * gets exactly the budget its worst recent packet needed and a clean one pays nothing, up
 * to `maxMs`, past which the extrapolation item (backlog) is the answer. It slews like the
 * clock, so it never jumps.
 */
export const INTERP = {
  baseMs: 100,
  maxMs: 200,
  /** Fastest the delay may move, ms per second: a remote player runs at most 1% off speed while it does. */
  slewMsPerS: 10
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
  /** Use a Revive Draught on the nearest dead teammate this tick; absent means no. */
  use?: boolean;
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
  /** Revive Draughts left this floor (DOWNS.draughtsPerFloor to start). */
  draughts: number;
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
  /** Active states (states.ts); cleared when it dies. */
  states: StateSet;
}

export type SimEvent =
  | { kind: "playerHit"; attackerId: string; damage: number; enemyHp: number }
  | { kind: "abilityHit"; attackerId: string; ability: AbilityId; damage: number; enemyHp: number; interrupted: boolean }
  | { kind: "enemyKilled"; killerId: string }
  | { kind: "enemyHit"; targetId: string; damage: number; targetHp: number }
  | { kind: "playerDowned"; playerId: string }
  | { kind: "playerPickedUp"; playerId: string; byId: string }
  | { kind: "playerRevived"; playerId: string; byId: string; draughtsLeft: number }
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
    draughts: DOWNS.draughtsPerFloor,
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
    hitFlashUntil: 0,
    states: {}
  };
}

/** An input that does nothing, used when a client sent nothing this tick. */
export function neutralInput(seq: number): InputFrame {
  return { seq, dx: 0, dy: 0, attack: false, dodge: false, ability: 0, use: false };
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
    (f.ability === undefined || (Number.isInteger(f.ability) && (f.ability as number) >= 0 && (f.ability as number) <= ABILITY_SLOTS)) &&
    (f.use === undefined || typeof f.use === "boolean")
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

/**
 * Advance one player by one input over dtMs at simulation time `now`.
 * Mutates `p`. Identical on client (prediction) and server (truth).
 */
export function applyInput(p: PlayerSim, input: InputFrame, now: number, dtMs: number): void {
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
    clampToArena(p, PLAYER.radius);
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
  playerList: Iterable<PlayerSim>,
  enemy: EnemySim,
  now: number
): SimEvent[] {
  const events: SimEvent[] = [];
  const players = [...playerList];
  const kill = (p: PlayerSim) => {
    if (enemy.hp === 0) {
      enemy.phase = "dead";
      enemy.states = {};
      enemy.phaseUntil = now + GOBLIN.respawnMs;
      enemy.targetId = "";
      events.push({ kind: "enemyKilled", killerId: p.id });
      events.push(...recoverOnClear(players, now));
    }
  };
  for (const p of players) {
    if (p.abilityHitAt !== 0 && now >= p.abilityHitAt) {
      p.abilityHitAt = 0;
      const ability = abilityInSlot(p.abilitySlot);
      if (ability === "cleave" && enemy.phase !== "dead") {
        const def = ABILITIES.cleave;
        if (inCone(p, enemy, def.range, def.arc, GOBLIN.radius)) {
          // An area melee hit: it lands in full on the Rooted, then staggers. A stagger
          // breaks a windup in progress, which is how Melee answers a telegraph.
          const { damage } = resolveHit(enemy.states, { damage: def.damage, tags: ["melee", "area"], byId: p.id }, now);
          applyState(enemy.states, "staggered", p.id, now);
          enemy.hp = Math.max(0, enemy.hp - damage);
          enemy.hitFlashUntil = now + 120;
          const interrupted = enemy.phase === "windup" && enemy.hp > 0;
          if (interrupted) {
            enemy.phase = "recover";
            enemy.phaseUntil = now + GOBLIN.recoverMs;
          }
          events.push({ kind: "abilityHit", attackerId: p.id, ability, damage, enemyHp: enemy.hp, interrupted });
          kill(p);
        }
      }
    }
    if (p.attackHitAt === 0 || now < p.attackHitAt) continue;
    p.attackHitAt = 0;
    if (enemy.phase === "dead") continue;
    if (!inCone(p, enemy, PLAYER.attackRange, PLAYER.attackArc, GOBLIN.radius)) continue;
    // The sword is a plain melee hit: it consumes nothing, but a Marked target takes more.
    const { damage } = resolveHit(enemy.states, { damage: PLAYER.attackDamage, tags: ["melee"], byId: p.id }, now);
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlashUntil = now + 120;
    events.push({ kind: "playerHit", attackerId: p.id, damage, enemyHp: enemy.hp });
    kill(p);
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

/**
 * `user` spends a Revive Draught on the nearest dead teammate within reach, who stands
 * where they lie. Server only, and outside `applyInput` because it changes
 * another player; the client does not predict it and sees the result in the next patch.
 * The dead already on a respawn timer (room cleared, squad wiped) are coming back free and
 * are not a target. Does nothing, and spends nothing, without a draught or a body in reach.
 */
export function useDraught(user: PlayerSim, playerList: Iterable<PlayerSim>): SimEvent[] {
  if (!isAlive(user) || user.draughts <= 0) return [];
  let target: PlayerSim | null = null;
  let bestD = Infinity;
  for (const q of playerList) {
    if (q === user || !isDead(q) || q.respawnAt !== 0) continue;
    const d = Math.hypot(q.x - user.x, q.z - user.z);
    if (d <= DOWNS.draughtRange && d < bestD) {
      bestD = d;
      target = q;
    }
  }
  if (!target) return [];
  user.draughts--;
  standUp(target, DOWNS.draughtHp);
  return [{ kind: "playerRevived", playerId: target.id, byId: user.id, draughtsLeft: user.draughts }];
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
 * Run after the enemy has stepped, so a player downed this tick is counted.
 */
export function stepDowns(
  playerList: Iterable<PlayerSim>,
  enemy: EnemySim,
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
      p.draughts = DOWNS.draughtsPerFloor;
    }
    enemy.x = ENEMY_SPAWN.x;
    enemy.z = ENEMY_SPAWN.z;
    enemy.facing = Math.PI;
    enemy.hp = GOBLIN.hp;
    enemy.phase = "idle";
    enemy.phaseUntil = 0;
    enemy.targetId = "";
    enemy.states = {};
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

/** Advance the goblin by one tick. Server only. */
export function stepEnemy(
  enemy: EnemySim,
  players: Map<string, PlayerSim>,
  now: number,
  dtMs: number
): SimEvent[] {
  const events: SimEvent[] = [];
  const dt = dtMs / 1000;
  expireStates(enemy.states, now);

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
      } else if (!hasState(enemy.states, "rooted", now)) {
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
            downPlayer(target, now);
            events.push({ kind: "playerDowned", playerId: target.id });
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
