import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * The synced state of a village or a dungeon room (both step the same simulation). The
 * server copies the plain simulation objects (shared/src/sim.ts) into these each tick;
 * Colyseus diffs and sends them. Clients never write to this; they only send InputFrames.
 *
 * Times are float64. A "number" goes as float32 whenever that loses under 1e-4, and at 60 Hz a
 * tick is a fraction of a ms: a time on the tick grid sent as float32 lands a hair either side of
 * it, and the client's replay would end a swing or a hop a tick off the server.
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
  /** When lastSeq was applied (the player's input clock): the client replays its pending frames from here. */
  @type("float64") inputAt = 0;
  @type("float64") dodgeUntil = 0;
  @type("float64") dodgeCooldownUntil = 0;
  @type("number") dodgeDx = 0;
  @type("number") dodgeDz = 0;
  /** A jump in progress: everyone draws the hop from its landing time, and the client replays it. */
  @type("float64") jumpUntil = 0;
  @type("number") jumpVx = 0;
  @type("number") jumpVz = 0;
  @type("float64") attackUntil = 0;
  @type("float64") attackHitAt = 0;
  @type("float64") abilityUntil = 0;
  @type("float64") abilityHitAt = 0;
  @type("number") abilitySlot = 0;
  /** Per ability slot, when it is off cooldown. */
  @type(["float64"]) readyAt = new ArraySchema<number>(0, 0, 0);
  @type("float64") respawnAt = 0;
  @type("float64") downedUntil = 0;
  @type("float64") pickupMs = 0;
  @type("string") pickupBy = "";
  /** Revive Draughts left this floor (a Phase 1 stand-in counter, not an item). */
  @type("number") draughts = 1;
  /** Block and posture: the client replays its guard from these (blockSince sets the parry window). */
  @type("boolean") guarding = false;
  @type("float64") blockSince = 0;
  @type("number") posture = 100;
  @type("float64") staggerUntil = 0;
  /** A throw in progress: the client replays the slide like a dodge. */
  @type("float64") knockUntil = 0;
  @type("number") knockDx = 0;
  @type("number") knockDz = 0;
  /** The weapon picked at join (a WEAPON_TYPES id and material tier): the client predicts its swing with it. */
  @type("string") weaponType = "sword";
  @type("number") weaponTier = 1;
  /** The enemy the bow is locked on to ("" for auto): the client draws the marker on it. */
  @type("string") lockId = "";
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
  @type("float64") phaseUntil = 0;
  @type("string") targetId = "";
  @type("float64") hitFlashUntil = 0;
  @type("number") posture = 30;
  @type("number") maxPosture = 30;
  @type("float64") postureBrokenUntil = 0;
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
  /** A level with stairs: open once every enemy is down, and how long the party has stood on them. */
  @type("boolean") stairsOpen = false;
  @type("float64") descendMs = 0;
  /** A level with a portal: how long the party has stood on it. */
  @type("float64") portalMs = 0;
  /** Server tick counter; simulation time = tick * TICK_MS. */
  @type("number") tick = 0;
}
