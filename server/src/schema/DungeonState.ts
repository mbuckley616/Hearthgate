import { MapSchema, Schema, type } from "@colyseus/schema";

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
  @type("number") respawnAt = 0;
  @type("number") downedUntil = 0;
  @type("number") pickupMs = 0;
  @type("string") pickupBy = "";
}

export class EnemyState extends Schema {
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") facing = 0;
  @type("number") hp = 60;
  @type("string") phase = "idle";
  @type("number") phaseUntil = 0;
  @type("string") targetId = "";
  @type("number") hitFlashUntil = 0;
}

export class DungeonState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(EnemyState) enemy = new EnemyState();
  /** Server tick counter; simulation time = tick * TICK_MS. */
  @type("number") tick = 0;
}
