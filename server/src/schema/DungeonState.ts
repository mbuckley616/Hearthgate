import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * The synced state. The server copies the plain simulation objects
 * (shared/src/sim.ts) into these each tick; Colyseus diffs and sends them.
 * Clients never write to this; they only send InputFrames.
 */
export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") color = "#ffffff";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") facing = 0;
  @type("number") hp = 100;
  @type("number") lastSeq = 0;
  @type("number") dodgeUntil = 0;
  @type("number") dodgeCooldownUntil = 0;
  @type("number") dodgeDx = 0;
  @type("number") dodgeDz = 0;
  @type("number") attackUntil = 0;
  @type("number") attackHitAt = 0;
  @type("number") abilityUntil = 0;
  @type("number") abilityHitAt = 0;
  @type("number") abilitySlot = 0;
  /** Per ability slot, when it is off cooldown. */
  @type(["number"]) readyAt = new ArraySchema<number>(0, 0, 0);
  @type("number") respawnAt = 0;
  @type("number") downedUntil = 0;
  @type("number") pickupMs = 0;
  @type("string") pickupBy = "";
  /** Revive Draughts left this floor (a Phase 1 stand-in counter, not an item). */
  @type("number") draughts = 1;
  /** Block and posture: the client replays its guard from these (blockSince sets the parry window). */
  @type("boolean") guarding = false;
  @type("number") blockSince = 0;
  @type("number") posture = 100;
  @type("number") staggerUntil = 0;
  /** A throw in progress: the client replays the slide like a dodge. */
  @type("number") knockUntil = 0;
  @type("number") knockDx = 0;
  @type("number") knockDz = 0;
}

export class EnemyState extends Schema {
  @type("string") id = "";
  @type("string") kind = "goblin";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") facing = 0;
  @type("number") hp = 60;
  @type("number") maxHp = 60;
  @type("string") phase = "idle";
  @type("number") phaseUntil = 0;
  @type("string") targetId = "";
  @type("number") hitFlashUntil = 0;
  @type("number") posture = 30;
  @type("number") maxPosture = 30;
  @type("number") postureBrokenUntil = 0;
  /** A Shieldbearer's shield is raised. */
  @type("boolean") guardUp = false;
  /** Near a living Pack Leader: quicker and harder-hitting. */
  @type("boolean") rallied = false;
}

export class DungeonState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  /** Keyed by the simulation's enemy id; the set is fixed for the life of the room. */
  @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
  /** Which level (shared/src/level.ts LEVELS) the room runs; the client builds its walls from it. */
  @type("string") levelId = "";
  /** A level with stairs: open once every enemy is down; how long the party has stood on them; which floor. */
  @type("boolean") stairsOpen = false;
  @type("number") descendMs = 0;
  @type("number") floor = 1;
  /** Server tick counter; simulation time = tick * TICK_MS. */
  @type("number") tick = 0;
}
