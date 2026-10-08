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

import { applyState, comboMultiplier, expireStates, hasState, resolveHit, type ComboEffect, type HitResult, type HitTag, type StateSet } from "./states";
import { ARENA_HALF, OPEN_FIELD, collideWalls, lineClear, roomAt, steerToward, type Level, type Npc } from "./level";
import { STARTER_WEAPON, WEAPON_TYPES, weaponClassOf, weaponStats, type WeaponGear } from "./gear";

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
  /**
   * A raised shield: hits from its front half while the guard is up do this fraction of
   * their damage. Absent for kinds without a shield.
   */
  frontGuard?: number;
  /** A rush at a target out of reach (the Charger); absent for kinds that only swing. */
  charge?: ChargeDef;
  /** Rallies the enemies near it (the Pack Leader); absent for kinds that do not lead. */
  rally?: RallyDef;
}

/**
 * A rally: every other living enemy within `radius` of a living leader is rallied, moving
 * `speedMult` faster and hitting `damageMult` harder. While any of them is rallied the leader
 * hangs back `holdBack` metres from its target instead of closing to swing.
 */
export interface RallyDef {
  radius: number;
  speedMult: number;
  damageMult: number;
  holdBack: number;
}

/**
 * A charge: from `minRange` to `maxRange` with a clear line, at most every `everyMs`, the
 * enemy plants itself for `aimMs` (the tell: a lane on the ground), then runs straight down
 * the lane at `speed` for up to `maxRange`. The first player it meets takes `damage` and is
 * thrown back `KNOCKBACK` along the lane; a wall stops it dead and leaves it stunned.
 */
export interface ChargeDef {
  minRange: number;
  maxRange: number;
  everyMs: number;
  aimMs: number;
  speed: number;
  damage: number;
  /** Recovery after hitting a wall, the punish for baiting it into one. */
  wallStunMs: number;
}

/**
 * Being thrown: the player slides at `speed` for `ms` and can do nothing else, like a dodge
 * they did not choose. A slide and not a teleport, so the client predicts it from the
 * server's state like a dodge and a throw is never a snap.
 */
export const KNOCKBACK = {
  speed: 12, // m/s
  /**
   * The slide runs on the ticks after the blow (inputs are applied before hits resolve), so a
   * 300 ms window is five ticks at 12 m/s: 3 m, The Old Gates' lair beast's throw.
   */
  ms: 300
} as const;

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

/**
 * The Shieldbearer, lifted from The Old Gates (`56-dungeon-build.enemy-defs.excerpt.js`, v71):
 * a humanoid behind a frontal shield. Hits on its front half do 35% while the guard is up.
 * The answers are The Old Gates' two: a power attack on the front (Cleave) breaks the guard
 * outright, or a flank, which in a party means one player holds its attention while another
 * walks round. Any posture break drops the shield; it comes back up when the stagger ends.
 * Its numbers are The Old Gates' against the goblin's, on Hearthgate's goblin: 48 hp to the
 * goblin's 28, a little over half its speed, 1.3x its blow; slower to swing.
 */
export const SHIELDBEARER: EnemyDef = {
  hp: 100,
  radius: 0.55,
  speed: 2.0,
  aggroRange: 10,
  attackRange: 1.9,
  attackArc: Math.PI * 0.7,
  windupMs: 800,
  recoverMs: 700,
  damage: 20,
  frontGuard: 0.35
};

/**
 * The Charger: designed in The Old Gates (rush plus knockback) and never built there; the
 * charge is its lair beast's (every 7 s from 5 to 16 units at four times its speed, double
 * damage, a three-unit throw), on a goblin-sized brute. Up close it swings like a goblin.
 * The answer is to read the lane and step out of it (or dodge through), best of all with a
 * wall behind you.
 */
export const CHARGER: EnemyDef = {
  hp: 80,
  radius: 0.6,
  speed: 3.0,
  aggroRange: 14,
  attackRange: 1.9,
  attackArc: Math.PI * 0.8,
  windupMs: 700,
  recoverMs: 700,
  damage: 15,
  charge: { minRange: 5, maxRange: 14, everyMs: 7000, aimMs: 900, speed: 12, damage: 30, wallStunMs: 2000 }
};

/**
 * The Pack Leader: designed in The Old Gates ("buffs nearby enemies") and never built there.
 * A goblin chief with a banner: the goblins around it are quicker and hit a third harder, and
 * it stays behind them. The answer is to reach it, through or round the pack (a Charger's
 * lane, a bow, a flank), and the pack is ordinary goblins again the moment it falls.
 */
export const PACK_LEADER: EnemyDef = {
  hp: 90,
  radius: 0.55,
  speed: 3.2,
  aggroRange: 14,
  attackRange: 1.8,
  attackArc: Math.PI * 0.8,
  windupMs: 650,
  recoverMs: 600,
  damage: 15,
  rally: { radius: 7, speedMult: 1.25, damageMult: 1.35, holdBack: 5 }
};

export const ENEMY_KINDS = {
  goblin: GOBLIN,
  shieldbearer: SHIELDBEARER,
  charger: CHARGER,
  packLeader: PACK_LEADER
} as const satisfies Record<string, EnemyDef>;
export type EnemyKind = keyof typeof ENEMY_KINDS;

/**
 * The room (one encounter until floors exist). Enemies stay dead once killed; when the
 * last one falls the room is clear, the downed get up and the dead come back, and after
 * `resetMs` the enemies return to their spawns for another go. Stairs replace the reset
 * when the Warrens floor lands.
 */
/**
 * The stairs (a level with `stairs`): open once every enemy on the floor is down; every
 * standing player on them for `holdMs` takes the party up. The hold is proximity, like
 * the pickup, so it works the same on keyboard, gamepad and touch. The stairs lead back to
 * the village (the dungeon room hands the party to a village room, see stepStairs); a
 * level without them resets after ROOM.resetMs instead.
 */
export const STAIRS = {
  radius: 2.5,
  holdMs: 2000
} as const;

/**
 * The village's portal (level.ts Portal): the same hold as the stairs, so one rule covers
 * both moves between rooms. The village room hands the party to a fresh dungeon room on the
 * portal's level.
 */
export const PORTAL = {
  radius: 2.5,
  holdMs: 2000
} as const;

/** Villagers: how close a player must stand to talk to one (centre to centre). */
export const NPC = {
  talkRange: 2.5
} as const;

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

/**
 * The bottom-right event log. Four lines is what fits between the ability slots and the
 * top-right panel on a 480 x 300 landscape phone; a busy four-player fight makes more than
 * that in 2.5 s, so the oldest line goes first rather than the log climbing (critic, 2026-10-07).
 */
export const EVENT_LOG = {
  maxLines: 4,
  showMs: 2500
} as const;

/**
 * The raised third-person camera (design doc, Combat: 30 to 40 degrees, auto-rotation toward the
 * party's centre of fight). Draw-only: the client turns the move vector by the yaw before it goes
 * in an InputFrame, so the server and replay only ever see world vectors.
 */
export const CAMERA = {
  /** Elevation of the eye above the look target, degrees. */
  pitchDeg: 35,
  /** Eye to look target, metres. The old fixed camera sat 15.8 m away at 55 degrees. */
  distanceM: 12,
  /** Look target height above the ground (about the player's chest). */
  targetY: 0.8,
  /** Follow smoothing time constant for the look target. */
  followMs: 120,
  /** Awake enemies and living teammates this close to the player make up the fight. */
  fightRadiusM: 14,
  /** A fight centre closer than this to the player gives no direction: hold the yaw. */
  minLeadM: 1.5,
  /** The camera ignores this much of its error, so small shifts in the fight never turn it. */
  deadbandDeg: 20,
  /** Turning: eased with this time constant, never faster than maxTurnDegPerS. Slow on purpose:
   * the move keys turn with the camera, so a fast swing would bend the player's path. */
  turnMs: 1500,
  maxTurnDegPerS: 40,
  /** Height on the player the wall-fade ray aims at (mid-body), metres. At 35 degrees a 1.1 m wall
   * would have to be within 0.3 m of the player's centre to cover it, so the 1.8 m pillars are what fade. */
  fadeAimY: 0.9
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
 * to `maxMs`. It slews like the clock, so it never jumps. What the delay does not cover (the
 * first late patch after a quiet spell, a stall past the cap) the projection below does.
 */
export const INTERP = {
  baseMs: 100,
  maxMs: 200,
  /** Fastest the delay may move, ms per second: a remote player runs at most 1% off speed while it does. */
  slewMsPerS: 10,
  /**
   * When the draw time passes the newest snapshot anyway, the pose is projected along its
   * last tick of motion by at most this long, ms, and holds there; see interp.ts. One tick:
   * what a late patch usually costs, and as far as a guess about where a player is going
   * stays good.
   */
  extrapolateMaxMs: TICK_MS,
  /**
   * Motion faster than this between two snapshots, m/s, is a placement (a respawn, a wipe,
   * the stairs), not travel, and is held rather than projected. The fastest real move in the
   * sim is 12 m/s (a dodge, a charge, a throw).
   */
  extrapolateMaxMps: 20,
  /** When the snapshot that ends a projection disagrees with it, the drawn pose eases over with this time constant, ms, instead of popping. */
  easeMs: 100,
  /** A disagreement over this, m, is a placement and pops, as the own player's corrections do over SNAP_DISTANCE. */
  easeSnapM: 2.5
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
  },
  /**
   * Melee, slot 2 (design doc: "heavy damage on a staggered target"): one blow at the
   * nearest Staggered enemy in its cone, else the nearest. It consumes Staggered for the
   * crit (COMBO.staggerCritMult) and the knockdown, times the combo multiplier when someone
   * else did the staggering, so Cleave from one player then Execute from another is the
   * two-player combo. On an enemy that is not staggered it is a plain heavy hit. The windup
   * is short enough to land inside Staggered's 2.5 s after a teammate's Cleave.
   */
  execute: {
    windupMs: 300,
    durationMs: 650,
    range: 2.4,
    arc: Math.PI * 0.6, // 108 degrees, the sword's: it picks one target, not a sweep
    damage: 18,
    cooldownMs: 5000
  },
  /**
   * Ranged, slot 1 (design doc: "arrows fall on a marked area"): a volley loosed high that
   * lands on every enemy within `radius` of the spot. The spot is the bow's lock, else the
   * enemy the bow would shoot now, else `aheadM` in front; chosen when the volley lands, so
   * it falls where the target is, not where it was. The windup is the draw and the flight:
   * long enough for a goblin to step out of a ring it is watching.
   */
  arrowRain: {
    windupMs: 650,
    durationMs: 700,
    range: 12,
    radius: 3,
    aheadM: 7,
    damage: 16,
    cooldownMs: 8000
  }
} as const;

export type AbilityId = keyof typeof ABILITIES;

/**
 * Slots by the weapon's style. Melee weapons (sword and two-handers alike) put Cleave in
 * slot 1 and Execute in slot 2, the bow Arrow rain in slot 1.
 */
export const SWORD_SLOTS: readonly (AbilityId | "")[] = ["cleave", "execute", ""];
export const BOW_SLOTS: readonly (AbilityId | "")[] = ["arrowRain", "", ""];
const EMPTY_SLOTS: readonly (AbilityId | "")[] = ["", "", ""];

/** The ability slots a weapon gives. */
export function slotsFor(weapon: WeaponGear): readonly (AbilityId | "")[] {
  const style = WEAPON_TYPES[weapon.type].style;
  return style === "melee" ? SWORD_SLOTS : style === "ranged" ? BOW_SLOTS : EMPTY_SLOTS;
}
export const ABILITY_SLOTS = 3;

/**
 * Gear tuning (design doc, "Layer 2: gear (tier-capped)"); the tables lifted from The Old
 * Gates live in gear.ts. Nothing in combat reads these yet: the weapon classes item wires
 * the weapon into the swing.
 */
export const GEAR = {
  /**
   * The Old Gates has ten materials, Hearthgate five portal tiers: a portal of tier T lets a
   * weapon or armour perform up to material tier 2T (a tier-1 portal: Wooden and Bronze).
   */
  materialsPerPortalTier: 2,
  /**
   * The Old Gates' attack numbers times this give Hearthgate damage. 3 makes a Wooden Sword
   * hit for 20, today's PLAYER.attackDamage, so wiring the weapon in changes nothing for the
   * starter kit.
   */
  damageScale: 3
} as const;

/**
 * How each class of weapon swings (backlog, "Weapon classes"); its damage, cleave cap and
 * style come from the weapon itself (gear.ts). One-handers keep the Phase 0 sword's swing.
 * Two-handers wind up twice as long and reach further, and hit up to the weapon's
 * `cleaveTargets` in their cone (The Old Gates' cleave cap). The bow locks on to the
 * nearest enemy it can see in a narrow cone (design doc, "Targeting": a lock-on rather than
 * free aim, so it needs no mouse); the hit lands when the draw finishes, no projectile to
 * dodge yet. Numbers are first guesses for playtests.
 */
export const WEAPON_CLASSES = {
  oneHand: { range: PLAYER.attackRange, arc: PLAYER.attackArc, windupMs: PLAYER.attackWindupMs, durationMs: PLAYER.attackDurationMs },
  twoHand: { range: 2.9, arc: Math.PI * 0.75, windupMs: 300, durationMs: 750 },
  bow: { range: 12, arc: Math.PI * 0.35, windupMs: 350, durationMs: 600 }
} as const;
export type WeaponClass = keyof typeof WEAPON_CLASSES;

/**
 * Block and parry, from The Old Gates (`10-player.js`, `74-strikes.js`), simplified for
 * crowds (design doc: "more generous parry windows"). Holding block raises the guard: the
 * player walks at half speed without turning, cannot swing, and a blow from the front half
 * is cut by the weapon's `blockReduce` (0.35 one-handed, 0.5 for the steel two-handers).
 * A blow that lands within `parryWindowMs` of raising the guard is a perfect parry: no
 * damage, and the attacker is staggered and cannot swing for a while. Holding block and
 * waiting is a block, not a parry: the timing is the skill.
 */
export const GUARD = {
  /** The Old Gates' 200 ms, made more generous: a crowd gives less time to read one tell. */
  parryWindowMs: 300,
  /** The guard covers the front half. */
  arc: Math.PI,
  moveMult: 0.5,
  /** A parried enemy is back in recovery this long (The Old Gates' 1.2 s parry stagger). */
  parryStunMs: 1200
} as const;

/**
 * Posture (The Old Gates' S281 and v61gj). Every blow drains it; empty, you are staggered.
 * The player: 100, an unblocked blow drains its damage x1.5, a blocked one x1, a parry
 * nothing; empty means 0.8 s unable to move, swing, block or dodge, then a full bar.
 * An enemy: half its health; a weapon hit drains 8 times the weapon's `postureMult`, Cleave
 * (The Old Gates' power attack) 25, a parry 40% of the bar; empty means staggered for
 * 1.5 s, the opening for the party's heavy hitters. Both refill 5 a second once 1.5 s pass
 * without a blow.
 */
export const POSTURE = {
  player: 100,
  unblockedMult: 1.5,
  blockedMult: 1,
  playerStaggerMs: 800,
  enemyFrac: 0.5,
  weaponDrain: 8,
  abilityDrain: 25,
  parryFrac: 0.4,
  enemyBreakMs: 1500,
  regenPerSec: 5,
  regenDelayMs: 1500
} as const;

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
  /** Use a Revive Draught on the nearest dead teammate this tick; absent means no. */
  use?: boolean;
  /** Block held this tick (held, not a press); absent means no. */
  block?: boolean;
  /** Cycle the bow's lock-on to the next target this tick (a press); absent means no. */
  cycle?: boolean;
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
  /** What the player swings: its class sets the timing, its tier and the portal the damage. */
  weapon: WeaponGear;
  /** Guard up (block held, not swinging, dodging or staggered). */
  guarding: boolean;
  /** When the guard went up: a blow within GUARD.parryWindowMs of it is parried. */
  blockSince: number;
  posture: number;
  /** Last blow that drained posture (regen waits POSTURE.regenDelayMs after it). */
  postureHitAt: number;
  /** Staggered by an empty posture until this time (0 when not). */
  staggerUntil: number;
  /** Thrown until this time (0 when not), sliding at (knockDx, knockDz) m/s. */
  knockUntil: number;
  knockDx: number;
  knockDz: number;
  /** The enemy the bow is locked on to ("" for soft auto-targeting). Set by cycleLock, server only. */
  lockId: string;
  spawnX: number;
  spawnZ: number;
}

/** "aim" is a charge's tell (planted, the lane showing) and "charge" the run itself. */
export type EnemyPhase = "idle" | "chase" | "windup" | "aim" | "charge" | "recover" | "dead";

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
  posture: number;
  maxPosture: number;
  postureHitAt: number;
  /** Posture broken: staggered until this time (0 when not). */
  postureBrokenUntil: number;
  /** A shield kind's guard is up (always false for kinds without one). */
  guardUp: boolean;
  /** A charging kind's next charge is allowed from this time. */
  chargeReadyAt: number;
  /** Metres left in the current charge. */
  chargeLeft: number;
  /** Near a living Pack Leader this tick (set by stepEnemies before anyone moves). */
  rallied: boolean;
  /** A leader with at least one rallied enemy this tick. */
  leading: boolean;
  /** Index into the level's rooms of the room it spawned in (-1: the level has none). */
  room: number;
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
  /** Every enemy is down and the level has stairs. */
  stairsOpen: boolean;
  /** How long every standing player has been on the open stairs. */
  descendMs: number;
  /** How long every standing player has been on the level's portal. */
  portalMs: number;
  /**
   * The party has taken the stairs or the portal: the room is handing them to another and
   * neither fires again. The server clears it if the hand-off fails.
   */
  departed: boolean;
}

export type SimEvent =
  | { kind: "playerHit"; attackerId: string; enemyId: string; damage: number; enemyHp: number; shielded: boolean }
  | { kind: "abilityHit"; attackerId: string; enemyId: string; ability: AbilityId; damage: number; enemyHp: number; interrupted: boolean }
  /** An Arrow rain landed at (x, z): the client draws the ring whether or not it hit anyone. */
  | { kind: "arrowRain"; playerId: string; x: number; z: number; hits: number }
  | { kind: "enemyKilled"; killerId: string; enemyId: string }
  | { kind: "enemyHit"; targetId: string; enemyId: string; damage: number; targetHp: number; blocked: boolean }
  | { kind: "playerParried"; playerId: string; enemyId: string; postureBroken: boolean }
  | { kind: "playerStaggered"; playerId: string }
  | { kind: "postureBroken"; enemyId: string; byId: string }
  /**
   * A hit consumed a state for its payoff (states.ts): the callout over the enemy. `mult` is
   * the combo multiplier from `contributors` distinct players; 1 is a solo payoff.
   */
  | { kind: "combo"; attackerId: string; enemyId: string; payoff: ComboEffect["kind"]; contributors: number; mult: number }
  | { kind: "playerKnocked"; playerId: string; enemyId: string }
  | { kind: "chargeWall"; enemyId: string }
  | { kind: "roomCleared"; byId: string; room: string }
  | { kind: "floorCleared" }
  /** Every standing player held the open stairs: the server hands the party back to the village. */
  | { kind: "stairsTaken" }
  /** Every standing player held the portal: the server hands the party to a dungeon room on level `to`. */
  | { kind: "portalTaken"; to: string }
  /** A player pressed use next to a villager; the line is the level's (level.ts Npc). */
  | { kind: "npcTalk"; playerId: string; npcId: string }
  | { kind: "roomReset" }
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
    weapon: { ...STARTER_WEAPON },
    guarding: false,
    blockSince: 0,
    posture: POSTURE.player,
    postureHitAt: 0,
    staggerUntil: 0,
    knockUntil: 0,
    knockDx: 0,
    knockDz: 0,
    lockId: "",
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
    posture: Math.round(def.hp * POSTURE.enemyFrac),
    maxPosture: Math.round(def.hp * POSTURE.enemyFrac),
    postureHitAt: 0,
    postureBrokenUntil: 0,
    guardUp: def.frontGuard !== undefined,
    chargeReadyAt: 0,
    chargeLeft: 0,
    rallied: false,
    leading: false,
    room: -1,
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
    const e = createEnemy(id, s.kind, s.x, s.z, s.facing);
    e.room = roomAt(level, s.x, s.z);
    m.set(id, e);
  });
  return m;
}

export function createEncounter(level: Level): Encounter {
  return { level, enemies: createEnemies(level), resetAt: 0, stairsOpen: false, descendMs: 0, portalMs: 0, departed: false };
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
  e.posture = e.maxPosture;
  e.postureHitAt = 0;
  e.postureBrokenUntil = 0;
  e.guardUp = ENEMY_KINDS[e.kind].frontGuard !== undefined;
  e.chargeReadyAt = 0;
  e.chargeLeft = 0;
  e.rallied = false;
  e.leading = false;
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
    (f.use === undefined || typeof f.use === "boolean") &&
    (f.block === undefined || typeof f.block === "boolean") &&
    (f.cycle === undefined || typeof f.cycle === "boolean")
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
export function abilityInSlot(weapon: WeaponGear, slot: number): AbilityId | "" {
  return slotsFor(weapon)[slot - 1] ?? "";
}

/** Standing: has health, can move at full speed and fight. */
export function isPlayerStaggered(p: PlayerSim, now: number): boolean {
  return now < p.staggerUntil;
}

export function isEnemyStaggered(e: EnemySim, now: number): boolean {
  return now < e.postureBrokenUntil;
}

/**
 * Drain an enemy's posture; empty, it is staggered (the Staggered state too, for the combos)
 * and back in recovery for POSTURE.enemyBreakMs. True when this drain broke it. A blow on an
 * already broken enemy only holds off its regen.
 */
export function drainEnemyPosture(e: EnemySim, amount: number, byId: string, now: number): boolean {
  e.postureHitAt = now;
  if (isEnemyStaggered(e, now) || e.hp <= 0) return false;
  e.posture = Math.max(0, e.posture - amount);
  if (e.posture > 0) return false;
  e.postureBrokenUntil = now + POSTURE.enemyBreakMs;
  e.guardUp = false;
  applyState(e.states, "staggered", byId, now);
  e.phase = "recover";
  e.phaseUntil = Math.max(e.phaseUntil, now + POSTURE.enemyBreakMs);
  return true;
}

/** Drain a player's posture; empty, they are staggered and their guard drops. True when this broke it. */
export function drainPlayerPosture(p: PlayerSim, amount: number, now: number): boolean {
  p.postureHitAt = now;
  if (isPlayerStaggered(p, now)) return false;
  p.posture = Math.max(0, p.posture - amount);
  if (p.posture > 0) return false;
  p.staggerUntil = now + POSTURE.playerStaggerMs;
  p.guarding = false;
  p.attackUntil = 0;
  p.attackHitAt = 0;
  p.abilityUntil = 0;
  p.abilityHitAt = 0;
  return true;
}

/**
 * Refill posture: a full bar the moment a stagger ends, else POSTURE.regenPerSec once
 * POSTURE.regenDelayMs pass without a blow. Server only; the client is sent the result.
 */
export function stepPosture(players: Iterable<PlayerSim>, enemies: Iterable<EnemySim>, now: number, dtMs: number): void {
  const regen = (o: { posture: number; postureHitAt: number }, max: number, staggered: boolean) => {
    if (staggered) return;
    if (o.posture <= 0) {
      o.posture = max;
      return;
    }
    if (o.posture >= max || now - o.postureHitAt < POSTURE.regenDelayMs) return;
    o.posture = Math.min(max, o.posture + (POSTURE.regenPerSec * dtMs) / 1000);
  };
  for (const p of players) if (isAlive(p)) regen(p, POSTURE.player, isPlayerStaggered(p, now));
  for (const e of enemies) if (isEnemyAlive(e)) regen(e, e.maxPosture, isEnemyStaggered(e, now));
}

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

  if (now < p.knockUntil) {
    // Thrown: slide, nothing else. The guard drops; you were not holding it well enough.
    p.guarding = false;
    p.x += (p.knockDx * dtMs) / 1000;
    p.z += (p.knockDz * dtMs) / 1000;
    collideWalls(p, PLAYER.radius, level);
    return;
  }

  if (isPlayerStaggered(p, now)) {
    // Off balance: no move, swing, guard or dodge until it passes.
    p.guarding = false;
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

  // The guard: up while block is held and nothing else is committed. A dodge drops it.
  const guard = input.block === true && !attacking && !isDodging(p, now);
  if (guard && !p.guarding) p.blockSince = now;
  p.guarding = guard;

  if (isDodging(p, now)) {
    p.x += p.dodgeDx * PLAYER.dodgeSpeed * dt;
    p.z += p.dodgeDz * PLAYER.dodgeSpeed * dt;
  } else if (p.guarding && moving) {
    // Shuffle behind the guard, still facing the threat.
    p.x += dx * PLAYER.speed * GUARD.moveMult * dt;
    p.z += dz * PLAYER.speed * GUARD.moveMult * dt;
  } else if (!attacking && moving) {
    p.x += dx * PLAYER.speed * dt;
    p.z += dz * PLAYER.speed * dt;
    p.facing = Math.atan2(dx, dz);
  }

  // Start an ability, or else a swing. Both hits resolve later in resolvePlayerAttacks.
  const slot = input.ability ?? 0;
  const ability = slot > 0 ? abilityInSlot(p.weapon, slot) : "";
  if (p.guarding) {
    // Lower the guard to swing.
  } else if (ability && !attacking && !isDodging(p, now) && now >= p.readyAt[slot - 1]) {
    const def = ABILITIES[ability];
    p.abilityUntil = now + def.durationMs;
    p.abilityHitAt = now + def.windupMs;
    p.abilitySlot = slot;
    p.readyAt[slot - 1] = now + def.cooldownMs;
  } else if (input.attack && !attacking && !isDodging(p, now)) {
    const swing = WEAPON_CLASSES[weaponClassOf(p.weapon)];
    p.attackUntil = now + swing.durationMs;
    p.attackHitAt = now + swing.windupMs;
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

/**
 * The bow's lock-on cycle (design doc, "Targeting": ranged weapons use a lock-on cycle
 * rather than free aim, so no mouse is needed). The candidates are the living enemies in
 * bow range with a clear line, in any direction, nearest first. A press moves the lock to
 * the next one; past the last it goes back to soft auto-targeting (""), so the same key
 * also lets go. A lock holds while its enemy lives and stays within `keepRangeMult` of the
 * bow's range; a wall between them makes the shot fall back to the cone until it clears.
 */
export const LOCK_ON = {
  keepRangeMult: 1.25
} as const;

/** Who a press of the cycle key can lock on to: in bow range, in sight, alive; nearest first, ids breaking ties. */
export function lockCandidates(p: PlayerSim, enemies: Iterable<EnemySim>, level: Level): EnemySim[] {
  const range = WEAPON_CLASSES.bow.range;
  const found: { e: EnemySim; d: number }[] = [];
  for (const e of enemies) {
    if (!isEnemyAlive(e)) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > range + ENEMY_KINDS[e.kind].radius || !lineClear(p, e, level)) continue;
    found.push({ e, d });
  }
  found.sort((a, b) => a.d - b.d || (a.e.id < b.e.id ? -1 : 1));
  return found.map((f) => f.e);
}

/** A press of the cycle key. Only a bow locks on; anything else clears the lock. Server only. */
export function cycleLock(p: PlayerSim, enemies: Iterable<EnemySim>, level: Level): void {
  if (weaponClassOf(p.weapon) !== "bow" || !isAlive(p)) {
    p.lockId = "";
    return;
  }
  const list = lockCandidates(p, enemies, level);
  const at = list.findIndex((e) => e.id === p.lockId);
  // From auto (or a lock no longer in the list) to the nearest; from the last back to auto.
  p.lockId = at === -1 ? (list[0]?.id ?? "") : (list[at + 1]?.id ?? "");
}

/** Drop locks whose enemy died or got too far away, or whose holder fell. Server only, once a tick. */
export function dropStaleLocks(players: Iterable<PlayerSim>, enemies: Map<string, EnemySim>): void {
  const keep = WEAPON_CLASSES.bow.range * LOCK_ON.keepRangeMult;
  for (const p of players) {
    if (p.lockId === "") continue;
    const e = enemies.get(p.lockId);
    if (!e || !isEnemyAlive(e) || !isAlive(p) || weaponClassOf(p.weapon) !== "bow" || Math.hypot(e.x - p.x, e.z - p.z) > keep) p.lockId = "";
  }
}

/**
 * Where an Arrow rain falls: on the bow's lock while it is in reach and in sight, else on the
 * enemy a shot would take now, else `aheadM` in front (inside the level's bounds).
 */
export function rainSpot(p: PlayerSim, enemies: readonly EnemySim[], level: Level): { x: number; z: number } {
  const def = ABILITIES.arrowRain;
  const sees = (e: EnemySim) => isEnemyAlive(e) && Math.hypot(e.x - p.x, e.z - p.z) <= def.range + ENEMY_KINDS[e.kind].radius && lineClear(p, e, level);
  const locked = p.lockId ? enemies.find((e) => e.id === p.lockId) : undefined;
  if (locked && sees(locked)) return { x: locked.x, z: locked.z };
  const bow = WEAPON_CLASSES.bow;
  const auto = enemiesInCone(p, enemies, Math.min(bow.range, def.range), bow.arc).find((e) => lineClear(p, e, level));
  if (auto) return { x: auto.x, z: auto.z };
  const x = p.x + Math.sin(p.facing) * def.aheadM;
  const z = p.z + Math.cos(p.facing) * def.aheadM;
  return { x: Math.max(-level.halfW, Math.min(level.halfW, x)), z: Math.max(-level.halfD, Math.min(level.halfD, z)) };
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
 * A weapon hits the nearest enemies in its class's cone, up to its cleave cap (one for a
 * one-hander or a bow, which also needs a clear line); Cleave hits every enemy in its wider
 * one. The level gives the walls and the portal tier that caps the weapon.
 * When the last enemy falls the room is clear: the downed get up and the dead come back.
 */
export function resolvePlayerAttacks(
  playerList: Iterable<PlayerSim>,
  enemyList: Iterable<EnemySim>,
  now: number,
  level: Level = OPEN_FIELD
): SimEvent[] {
  const events: SimEvent[] = [];
  const players = [...playerList];
  const enemies = [...enemyList];
  const hit = (e: EnemySim, damage: number) => {
    e.hp = Math.max(0, e.hp - damage);
    e.hitFlashUntil = now + 120;
  };
  // A consumed state's payoff: the callout, and the side effects resolveHit leaves to us.
  // Marked consumes nothing and adds to every hit, so it is not a callout.
  const payoffs = (p: PlayerSim, e: EnemySim, r: HitResult) => {
    for (const fx of r.effects) {
      if (fx.kind === "marked") continue;
      if (fx.kind === "crit" && e.hp > 0) knockDown(e, fx.knockdownMs, now);
      events.push({ kind: "combo", attackerId: p.id, enemyId: e.id, payoff: fx.kind, contributors: fx.contributors, mult: comboMultiplier(fx.contributors) });
    }
  };
  // After the hit event: a kill, and the clear if it was the last one standing in its room.
  const settle = (p: PlayerSim, e: EnemySim) => {
    if (e.hp > 0) return;
    e.phase = "dead";
    e.states = {};
    e.phaseUntil = 0;
    e.targetId = "";
    events.push({ kind: "enemyKilled", killerId: p.id, enemyId: e.id });
    if (enemies.every((o) => o.room !== e.room || !isEnemyAlive(o))) {
      events.push({ kind: "roomCleared", byId: p.id, room: level.rooms?.[e.room]?.name ?? "" });
      events.push(...recoverOnClear(players, now));
    }
  };
  for (const p of players) {
    if (p.abilityHitAt !== 0 && now >= p.abilityHitAt) {
      p.abilityHitAt = 0;
      const ability = abilityInSlot(p.weapon, p.abilitySlot);
      if (ability === "cleave") {
        const def = ABILITIES.cleave;
        for (const e of enemiesInCone(p, enemies, def.range, def.arc)) {
          // An area melee hit: it lands in full on the Rooted, then staggers. A stagger
          // breaks a windup in progress, which is how Melee answers a telegraph.
          // Cleave is the power attack: on a raised shield it is cut like any blow, and it
          // breaks the guard outright (The Old Gates' power-versus-shield rule).
          const shielded = shieldCovers(e, p);
          const base = shielded ? def.damage * (ENEMY_KINDS[e.kind].frontGuard ?? 1) : def.damage;
          const r = resolveHit(e.states, { damage: Math.round(base), tags: ["melee", "area"], byId: p.id }, now);
          const damage = r.damage;
          applyState(e.states, "staggered", p.id, now);
          hit(e, damage);
          const broke = drainEnemyPosture(e, shielded ? e.maxPosture : POSTURE.abilityDrain, p.id, now);
          const interrupted = (e.phase === "windup" || e.phase === "aim" || e.phase === "charge") && e.hp > 0;
          if (interrupted) {
            e.phase = "recover";
            e.phaseUntil = now + ENEMY_KINDS[e.kind].recoverMs;
          }
          events.push({ kind: "abilityHit", attackerId: p.id, enemyId: e.id, ability, damage, enemyHp: e.hp, interrupted });
          if (broke) events.push({ kind: "postureBroken", enemyId: e.id, byId: p.id });
          payoffs(p, e, r);
          settle(p, e);
        }
      } else if (ability === "execute") {
        const def = ABILITIES.execute;
        const inReach = enemiesInCone(p, enemies, def.range, def.arc);
        const e = inReach.find((o) => hasState(o.states, "staggered", now)) ?? inReach[0];
        if (e) {
          const shielded = shieldCovers(e, p);
          const base = shielded ? def.damage * (ENEMY_KINDS[e.kind].frontGuard ?? 1) : def.damage;
          const r = resolveHit(e.states, { damage: Math.round(base), tags: ["melee", "execute"], byId: p.id }, now);
          hit(e, r.damage);
          const broke = r.consumed.length === 0 && drainEnemyPosture(e, POSTURE.abilityDrain, p.id, now);
          events.push({ kind: "abilityHit", attackerId: p.id, enemyId: e.id, ability, damage: r.damage, enemyHp: e.hp, interrupted: false });
          if (broke) events.push({ kind: "postureBroken", enemyId: e.id, byId: p.id });
          payoffs(p, e, r);
          settle(p, e);
        }
      } else if (ability === "arrowRain") {
        const def = ABILITIES.arrowRain;
        const spot = rainSpot(p, enemies, level);
        const under = enemies.filter((e) => isEnemyAlive(e) && Math.hypot(e.x - spot.x, e.z - spot.z) <= def.radius + ENEMY_KINDS[e.kind].radius);
        under.sort((a, b) => (a.id < b.id ? -1 : 1));
        events.push({ kind: "arrowRain", playerId: p.id, x: spot.x, z: spot.z, hits: under.length });
        for (const e of under) {
          // From above: a raised shield does not cover it, and it breaks nothing.
          const r = resolveHit(e.states, { damage: def.damage, tags: ["ranged", "area"], byId: p.id }, now);
          hit(e, r.damage);
          events.push({ kind: "abilityHit", attackerId: p.id, enemyId: e.id, ability, damage: r.damage, enemyHp: e.hp, interrupted: false });
          payoffs(p, e, r);
          settle(p, e);
        }
      }
    }
    if (p.attackHitAt === 0 || now < p.attackHitAt) continue;
    p.attackHitAt = 0;
    const cls = weaponClassOf(p.weapon);
    const swing = WEAPON_CLASSES[cls];
    const stats = weaponStats(p.weapon, level.tier ?? 1);
    let targets = enemiesInCone(p, enemies, swing.range, swing.arc);
    if (cls === "bow") {
      // A lock in range and in sight takes the shot wherever the archer faces; else the cone.
      const locked = p.lockId ? enemies.find((e) => e.id === p.lockId) : undefined;
      const range = swing.range + (locked ? ENEMY_KINDS[locked.kind].radius : 0);
      if (locked && isEnemyAlive(locked) && Math.hypot(locked.x - p.x, locked.z - p.z) <= range && lineClear(p, locked, level)) targets = [locked];
      else targets = targets.filter((e) => lineClear(p, e, level));
    }
    // A weapon swing is a plain hit: it consumes nothing, but a Marked target takes more.
    const tags: HitTag[] = [stats.style];
    for (const target of targets.slice(0, stats.cleaveTargets)) {
      const shielded = shieldCovers(target, p);
      const base = shielded ? Math.round(stats.damage * (ENEMY_KINDS[target.kind].frontGuard ?? 1)) : stats.damage;
      const r = resolveHit(target.states, { damage: base, tags, byId: p.id }, now);
      const damage = r.damage;
      hit(target, damage);
      const broke = drainEnemyPosture(target, POSTURE.weaponDrain * stats.postureMult, p.id, now);
      events.push({ kind: "playerHit", attackerId: p.id, enemyId: target.id, damage, enemyHp: target.hp, shielded });
      if (broke) events.push({ kind: "postureBroken", enemyId: target.id, byId: p.id });
      payoffs(p, target, r);
      settle(p, target);
    }
  }
  return events;
}

/**
 * A crit's knockdown (Staggered consumed): the enemy is down in recovery, its guard dropped
 * and its posture broken for the time, so nothing it was winding up lands.
 */
function knockDown(e: EnemySim, ms: number, now: number): void {
  e.phase = "recover";
  e.phaseUntil = Math.max(e.phaseUntil, now + ms);
  e.postureBrokenUntil = Math.max(e.postureBrokenUntil, now + ms);
  e.guardUp = false;
  e.chargeLeft = 0;
}

/** A raised shield faces the attacker: they are in its front half. */
export function shieldCovers(e: EnemySim, attacker: { x: number; z: number }): boolean {
  return e.guardUp && inCone(e, attacker, Infinity, GUARD.arc, 0);
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
  p.guarding = false;
  p.staggerUntil = 0;
  p.knockUntil = 0;
  p.posture = POSTURE.player;
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
      p.draughts = DOWNS.draughtsPerFloor;
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
  // A shield kind raises its guard again once the stagger that dropped it is over.
  if (!enemy.guardUp && def.frontGuard !== undefined && !isEnemyStaggered(enemy, now)) enemy.guardUp = true;

  // Keep the current target while it is alive and in range, else re-acquire.
  let target = enemy.targetId ? players.get(enemy.targetId) ?? null : null;
  if (!target || !isAlive(target)) target = nearestAlivePlayer(enemy, players.values());
  if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) > def.aggroRange * 1.5) {
    target = nearestAlivePlayer(enemy, players.values());
  }
  enemy.targetId = target ? target.id : "";

  switch (enemy.phase) {
    case "idle": {
      // It has to see you: a room behind a wall sleeps until someone walks in.
      if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) <= def.aggroRange && lineClear(enemy, target, level)) {
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
      const c = def.charge;
      if (dist <= def.attackRange) {
        enemy.phase = "windup";
        enemy.phaseUntil = now + def.windupMs;
      } else if (c && now >= enemy.chargeReadyAt && dist >= c.minRange && dist <= c.maxRange && lineClear(enemy, target, level)) {
        // Plant and aim: the facing, and so the lane, is fixed from here.
        enemy.phase = "aim";
        enemy.phaseUntil = now + c.aimMs;
        enemy.chargeReadyAt = now + c.everyMs;
      } else if (!hasState(enemy.states, "rooted", now)) {
        // Straight at the target when the way is clear, else through the doorways towards it
        // (pressing straight into a wall left a chaser pinned in a corner, the critic's bug).
        // A leader with a rallied pack stops short and lets the pack go in.
        const stopAt = def.rally && enemy.leading ? def.rally.holdBack : def.attackRange * 0.9;
        const speed = def.speed * (enemy.rallied ? rallyOf(enemy).speedMult : 1);
        const goal = steerToward(enemy, target, def.radius, level);
        if (goal === target) {
          const step = Math.max(0, Math.min(speed * dt, dist - stopAt));
          enemy.x += (vx / dist) * step;
          enemy.z += (vz / dist) * step;
        } else {
          const gx = goal.x - enemy.x;
          const gz = goal.z - enemy.z;
          const gd = Math.hypot(gx, gz);
          const step = Math.min(speed * dt, gd);
          enemy.x += (gx / gd) * step;
          enemy.z += (gz / gd) * step;
          enemy.facing = Math.atan2(gx, gz);
        }
        collideWalls(enemy, def.radius, level);
      }
      break;
    }
    case "windup": {
      if (now < enemy.phaseUntil) break;
      // The swing lands. Facing was locked at windup start, so a dodge sideways escapes it.
      enemy.phase = "recover";
      enemy.phaseUntil = now + def.recoverMs;
      if (target && isAlive(target) && !isDodging(target, now)) {
        if (inCone(enemy, target, def.attackRange * 1.15, def.attackArc, PLAYER.radius)) {
          const blow = enemy.rallied ? Math.round(def.damage * rallyOf(enemy).damageMult) : def.damage;
          events.push(...strikePlayer(enemy, target, blow, now));
        }
      }
      break;
    }
    case "aim": {
      if (now < enemy.phaseUntil) break;
      enemy.phase = "charge";
      enemy.chargeLeft = def.charge?.maxRange ?? 0;
      break;
    }
    case "charge": {
      events.push(...stepCharge(enemy, def, players, now, dtMs, level));
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
 * One tick of a charge: run down the lane; the first standing player within reach of the
 * run takes the blow (parried, blocked or taken, as any blow) and, unless parried, is thrown
 * along the lane. A wall stops the run and stuns the charger. Server only.
 */
function stepCharge(enemy: EnemySim, def: EnemyDef, players: Map<string, PlayerSim>, now: number, dtMs: number, level: Level): SimEvent[] {
  const c = def.charge!;
  const fx = Math.sin(enemy.facing);
  const fz = Math.cos(enemy.facing);
  const step = Math.min(enemy.chargeLeft, (c.speed * dtMs) / 1000);
  const fromX = enemy.x;
  const fromZ = enemy.z;
  // Who is in the swept path this tick, nearest along the lane first; ids break ties.
  const reach = def.radius + PLAYER.radius;
  let victim: PlayerSim | null = null;
  let victimT = Infinity;
  for (const p of [...players.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!isAlive(p) || isDodging(p, now)) continue;
    const t = (p.x - fromX) * fx + (p.z - fromZ) * fz;
    if (t < -reach || t > step + reach) continue;
    const side = Math.abs((p.x - fromX) * fz - (p.z - fromZ) * fx);
    if (side > reach || t >= victimT) continue;
    victim = p;
    victimT = t;
  }
  const events: SimEvent[] = [];
  if (victim) {
    const struck = strikePlayer(enemy, victim, c.damage, now);
    events.push(...struck);
    if (isAlive(victim) && !struck.some((e) => e.kind === "playerParried")) {
      victim.knockUntil = now + KNOCKBACK.ms;
      victim.knockDx = fx * KNOCKBACK.speed;
      victim.knockDz = fz * KNOCKBACK.speed;
      victim.guarding = false;
      victim.attackUntil = 0;
      victim.attackHitAt = 0;
      victim.abilityUntil = 0;
      victim.abilityHitAt = 0;
      events.push({ kind: "playerKnocked", playerId: victim.id, enemyId: enemy.id });
    }
    enemy.chargeLeft = 0;
    if (enemy.phase === "charge") {
      enemy.phase = "recover";
      enemy.phaseUntil = now + def.recoverMs;
    }
    return events;
  }
  enemy.x += fx * step;
  enemy.z += fz * step;
  collideWalls(enemy, def.radius, level);
  enemy.chargeLeft -= step;
  const moved = Math.hypot(enemy.x - fromX, enemy.z - fromZ);
  if (moved < step * 0.5) {
    // Into a wall: stopped dead, and stunned for it.
    enemy.chargeLeft = 0;
    enemy.phase = "recover";
    enemy.phaseUntil = now + c.wallStunMs;
    applyState(enemy.states, "staggered", "", now);
    events.push({ kind: "chargeWall", enemyId: enemy.id });
  } else if (enemy.chargeLeft <= 0) {
    enemy.phase = "recover";
    enemy.phaseUntil = now + def.recoverMs;
  }
  return events;
}

/**
 * An enemy's blow lands on a player who did not dodge it: parried, blocked or taken
 * (The Old Gates' `executeStrike`). The guard only covers blows from the front half.
 */
function strikePlayer(enemy: EnemySim, target: PlayerSim, blow: number, now: number): SimEvent[] {
  const guarded = target.guarding && inCone(target, enemy, Infinity, GUARD.arc, 0);
  if (guarded && now - target.blockSince <= GUARD.parryWindowMs) {
    const broke = drainEnemyPosture(enemy, enemy.maxPosture * POSTURE.parryFrac, target.id, now);
    if (!broke) {
      applyState(enemy.states, "staggered", target.id, now);
      enemy.phaseUntil = Math.max(enemy.phaseUntil, now + GUARD.parryStunMs);
    }
    return [{ kind: "playerParried", playerId: target.id, enemyId: enemy.id, postureBroken: broke }];
  }
  const events: SimEvent[] = [];
  const damage = guarded ? Math.max(1, Math.round(blow * (1 - WEAPON_TYPES[target.weapon.type].blockReduce))) : blow;
  target.hp = Math.max(0, target.hp - damage);
  events.push({ kind: "enemyHit", targetId: target.id, enemyId: enemy.id, damage, targetHp: target.hp, blocked: guarded });
  if (target.hp === 0) {
    downPlayer(target, now);
    events.push({ kind: "playerDowned", playerId: target.id });
    return events;
  }
  if (drainPlayerPosture(target, blow * (guarded ? POSTURE.blockedMult : POSTURE.unblockedMult), now)) {
    events.push({ kind: "playerStaggered", playerId: target.id });
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
  updateRallies(enemies);
  for (const e of enemies) events.push(...stepEnemy(e, players, now, dtMs, level));
  separateEnemies(enemies, level);
  return events;
}

/**
 * Who is rallied this tick, from where everyone stood at its start, so the order enemies
 * step in cannot change it. Leaders do not rally each other.
 */
export function updateRallies(enemies: readonly EnemySim[]): void {
  const leaders = enemies.filter((l) => isEnemyAlive(l) && ENEMY_KINDS[l.kind].rally);
  for (const e of enemies) {
    e.rallied = false;
    e.leading = false;
  }
  for (const l of leaders) {
    const r = ENEMY_KINDS[l.kind].rally!;
    for (const e of enemies) {
      if (e === l || !isEnemyAlive(e) || ENEMY_KINDS[e.kind].rally) continue;
      if (Math.hypot(e.x - l.x, e.z - l.z) > r.radius) continue;
      e.rallied = true;
      l.leading = true;
    }
  }
}

/** The rally a rallied enemy is under. The Pack Leader is the only leader; a second kind would record which leader rallied it. */
function rallyOf(_e: EnemySim): RallyDef {
  return PACK_LEADER.rally!;
}

/**
 * The open stairs: when every standing player has stood on them for STAIRS.holdMs the party
 * has taken them. The sim only says so (`stairsTaken`, once: `departed` latches); the server
 * hands the party to the village room, the floor is left behind and its room disposes.
 */
export function stepStairs(enc: Encounter, players: Map<string, PlayerSim>, dtMs: number): SimEvent[] {
  const stairs = enc.level.stairs;
  if (!enc.stairsOpen || !stairs || enc.departed) return [];
  enc.descendMs = holdOn(stairs, STAIRS.radius, enc.descendMs, players, dtMs);
  if (enc.descendMs < STAIRS.holdMs) return [];
  enc.departed = true;
  return [{ kind: "stairsTaken" }];
}

/**
 * The village's portal: every standing player on it for PORTAL.holdMs and the party has gone
 * through (`portalTaken`, once). The server hands them to a dungeon room on the portal's level.
 */
export function stepPortal(enc: Encounter, players: Map<string, PlayerSim>, dtMs: number): SimEvent[] {
  const portal = enc.level.portal;
  if (!portal || enc.departed) return [];
  enc.portalMs = holdOn(portal, PORTAL.radius, enc.portalMs, players, dtMs);
  if (enc.portalMs < PORTAL.holdMs) return [];
  enc.departed = true;
  return [{ kind: "portalTaken", to: portal.to }];
}

/** The hold so far plus this tick while every standing player is within `radius` of the spot; 0 the moment one is not. */
function holdOn(spot: { x: number; z: number }, radius: number, heldMs: number, players: Map<string, PlayerSim>, dtMs: number): number {
  const standing = [...players.values()].filter(isAlive);
  const allOn = standing.length > 0 && standing.every((p) => Math.hypot(p.x - spot.x, p.z - spot.z) <= radius);
  return allOn ? heldMs + dtMs : 0;
}

/**
 * The villager a standing player at `p` is talking to when they press use: the nearest within
 * NPC.talkRange, or null. Server only; the client shows the line from the level's data.
 */
export function talkToNpc(p: PlayerSim, level: Level): Npc | null {
  if (!isAlive(p) || !level.npcs) return null;
  let best: Npc | null = null;
  let bestD = Infinity;
  for (const n of level.npcs) {
    const d = Math.hypot(n.x - p.x, n.z - p.z);
    if (d <= NPC.talkRange && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
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
    p.guarding = false;
    p.staggerUntil = 0;
    p.knockUntil = 0;
    p.posture = POSTURE.player;
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
  events.push(...resolvePlayerAttacks(players.values(), enc.enemies.values(), now, enc.level));
  if (events.some((e) => e.kind === "enemyKilled") && [...enc.enemies.values()].every((e) => !isEnemyAlive(e))) {
    // The floor is clear: the stairs open, or a level without them resets after a pause.
    if (enc.level.stairs) {
      enc.stairsOpen = true;
      enc.descendMs = 0;
      events.push({ kind: "floorCleared" });
    } else {
      enc.resetAt = now + ROOM.resetMs;
    }
  }
  events.push(...stepEnemies(enc.enemies.values(), players, now, dtMs, enc.level));
  events.push(...stepDowns(players.values(), enc.enemies.values(), now, dtMs));
  if (events.some((e) => e.kind === "squadWiped")) {
    enc.resetAt = 0; // the wipe already reset the enemies
    enc.stairsOpen = false;
  }
  events.push(...stepStairs(enc, players, dtMs));
  events.push(...stepPortal(enc, players, dtMs));
  dropStaleLocks(players.values(), enc.enemies);
  events.push(...stepRespawns(players.values(), now));
  stepPosture(players.values(), enc.enemies.values(), now, dtMs);
  if (enc.resetAt !== 0 && now >= enc.resetAt) {
    enc.resetAt = 0;
    for (const e of enc.enemies.values()) resetEnemy(e);
    events.push({ kind: "roomReset" });
  }
  return events;
}
