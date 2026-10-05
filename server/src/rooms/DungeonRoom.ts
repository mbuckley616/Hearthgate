import { Client, Room } from "@colyseus/core";
import {
  DEFAULT_LEVEL_ID,
  PLAYER_COLORS,
  SPAWN_POINTS,
  TICK_MS,
  applyInput,
  createEncounter,
  createInputBucket,
  createPlayer,
  isValidInput,
  levelById,
  neutralInput,
  stepEncounter,
  takeInputToken,
  type Encounter,
  useDraught,
  type EnemySim,
  type InputBucket,
  type InputFrame,
  type PlayerSim,
  type SimEvent
} from "@hearthgate/shared";
import { DungeonState, EnemyState, PlayerState } from "../schema/DungeonState.js";

/**
 * Inputs a client may bank while the server waits for the next tick.
 * A client that lags and then sends a burst gets its inputs applied over
 * several ticks instead of all at once, which stops speed exploits.
 */
const MAX_QUEUED_INPUTS = 12;
const MAX_INPUTS_PER_TICK = 2;
/**
 * Ticks the loop may run back to back to catch up with wall time. Past this the process
 * stalled (a long GC pause, a sleeping laptop) and the lost time is dropped, not replayed.
 */
const MAX_CATCHUP_TICKS = 4;

/** Close code sent to a client dropped for flooding inputs (4000-4999 is the app range). */
export const CLOSE_INPUT_FLOOD = 4001;

interface JoinOptions {
  name?: string;
  /** A level id from shared LEVELS; tests pick the open field, play gets the default. */
  level?: string;
}

export class DungeonRoom extends Room<DungeonState> {
  maxClients = 8;

  private sim = {
    players: new Map<string, PlayerSim>(),
    encounter: null as unknown as Encounter,
    tick: 0
  };
  private queues = new Map<string, InputFrame[]>();
  private buckets = new Map<string, InputBucket>();
  private nextSpawn = 0;
  /** Wall time of simulation time zero; tick n is due at epoch + n * TICK_MS. */
  private epoch = 0;
  /** Wall time the last step's patch left, so simNow() can place a ping reply inside the tick. */
  private lastStepAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  onCreate(options: JoinOptions = {}) {
    this.state = new DungeonState();
    const level = levelById(typeof options.level === "string" ? options.level : DEFAULT_LEVEL_ID);
    this.sim.encounter = createEncounter(level);
    this.state.levelId = level.id;
    for (const e of this.sim.encounter.enemies.values()) {
      const es = new EnemyState();
      es.id = e.id;
      es.kind = e.kind;
      es.maxHp = e.maxHp;
      copyEnemy(e, es);
      this.state.enemies.set(e.id, es);
    }
    // Patches go out at the end of each step (see step()), not on Colyseus's own patch
    // interval: that interval runs out of phase with the simulation one and was measured
    // sending each snapshot about 49 ms after the tick it carried. The client's clock
    // trusts a snapshot stamped t to leave at server time t, so the automatic one stays off.
    this.patchRate = 0;

    this.onMessage("input", (client, frame: unknown) => {
      // Counted before validation so a flood of garbage costs the sender as much as real inputs.
      const bucket = this.buckets.get(client.sessionId);
      if (!bucket) return;
      if (!takeInputToken(bucket, performance.now())) {
        this.buckets.delete(client.sessionId); // ignore whatever else arrives before the close lands
        console.log(`[dungeon ${this.roomId}] dropping ${client.sessionId}: input flood`);
        client.leave(CLOSE_INPUT_FLOOD);
        return;
      }
      if (!isValidInput(frame)) return;
      const q = this.queues.get(client.sessionId);
      if (!q) return;
      const last = q.length ? q[q.length - 1].seq : this.sim.players.get(client.sessionId)?.lastSeq ?? 0;
      if (frame.seq <= last) return; // duplicate or out of order
      if (q.length < MAX_QUEUED_INPUTS) q.push(frame);
    });

    // Clock sync: the client times the round trip and reads its offset from the reply with the shortest trip back.
    this.onMessage("ping", (client, sentAt: unknown) => {
      if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) return;
      client.send("pong", { sentAt, serverTime: this.simNow() });
    });

    // The tick is locked to wall time rather than run from setInterval: an interval of 50 ms
    // fires every 50-and-a-bit ms, which made simulation time run about 1% slow, and the
    // clients' clocks (which assume a second is a second) drifted against it.
    this.epoch = performance.now();
    this.pump();
    console.log(`[dungeon ${this.roomId}] created: ${level.name}, ${this.sim.encounter.enemies.size} enemies`);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const slot = this.nextSpawn++ % SPAWN_POINTS.length;
    const spawn = SPAWN_POINTS[slot];
    const p = createPlayer(client.sessionId, spawn.x, spawn.z);
    this.sim.players.set(client.sessionId, p);
    this.queues.set(client.sessionId, []);
    this.buckets.set(client.sessionId, createInputBucket(performance.now()));

    const ps = new PlayerState();
    ps.id = client.sessionId;
    ps.name = sanitizeName(options.name) || `Adventurer ${slot + 1}`;
    ps.color = PLAYER_COLORS[slot % PLAYER_COLORS.length];
    copyPlayer(p, ps);
    this.state.players.set(client.sessionId, ps);

    console.log(`[dungeon ${this.roomId}] ${ps.name} joined (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    const ps = this.state.players.get(client.sessionId);
    console.log(`[dungeon ${this.roomId}] ${ps?.name ?? client.sessionId} left`);
    this.sim.players.delete(client.sessionId);
    this.queues.delete(client.sessionId);
    this.buckets.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    console.log(`[dungeon ${this.roomId}] disposed`);
  }

  /** Run every tick that is due by wall time, then sleep until the next one. */
  private pump() {
    this.timer = null;
    const now = performance.now();
    let due = Math.floor((now - this.epoch) / TICK_MS);
    if (due - this.sim.tick > MAX_CATCHUP_TICKS) {
      this.epoch = now - (this.sim.tick + 1) * TICK_MS;
      due = this.sim.tick + 1;
    }
    try {
      while (this.sim.tick < due) this.step();
    } catch (err) {
      console.error(`[dungeon ${this.roomId}] step failed`, err);
    }
    const next = this.epoch + (this.sim.tick + 1) * TICK_MS;
    this.timer = setTimeout(() => this.pump(), Math.max(1, next - performance.now()));
  }

  /** Simulation time now, including the part of the current tick already elapsed. */
  private simNow(): number {
    const sinceStep = this.lastStepAt === 0 ? 0 : Math.min(TICK_MS, performance.now() - this.lastStepAt);
    return this.sim.tick * TICK_MS + sinceStep;
  }

  private step() {
    this.sim.tick++;
    const now = this.sim.tick * TICK_MS;
    const level = this.sim.encounter.level;

    const users: PlayerSim[] = [];
    for (const [id, p] of this.sim.players) {
      const q = this.queues.get(id) ?? [];
      const frames = q.splice(0, MAX_INPUTS_PER_TICK);
      if (frames.length === 0) {
        applyInput(p, neutralInput(p.lastSeq), now, TICK_MS, level);
      } else {
        for (const f of frames) applyInput(p, f, now, TICK_MS, level);
        if (frames.some((f) => f.use)) users.push(p);
      }
    }

    const events: SimEvent[] = [];
    // After everyone has moved this tick, so a draught reaches a body by where it lies now.
    for (const p of users) events.push(...useDraught(p, this.sim.players.values()));
    events.push(...stepEncounter(this.sim.encounter, this.sim.players, now, TICK_MS));

    this.syncState();
    if (events.length) this.broadcast("events", events);
    this.broadcastPatch();
    // Taken after the patch leaves, so a ping reply and a patch stamped the same server
    // time left the server at the same wall time and the client's clock sees one path.
    this.lastStepAt = performance.now();
  }

  private syncState() {
    this.state.tick = this.sim.tick;
    for (const [id, p] of this.sim.players) {
      const ps = this.state.players.get(id);
      if (ps) copyPlayer(p, ps);
    }
    for (const [id, e] of this.sim.encounter.enemies) {
      const es = this.state.enemies.get(id);
      if (es) copyEnemy(e, es);
    }
  }
}

function copyPlayer(p: PlayerSim, ps: PlayerState) {
  ps.x = p.x;
  ps.z = p.z;
  ps.facing = p.facing;
  ps.hp = p.hp;
  ps.lastSeq = p.lastSeq;
  ps.dodgeUntil = p.dodgeUntil;
  ps.dodgeCooldownUntil = p.dodgeCooldownUntil;
  ps.dodgeDx = p.dodgeDx;
  ps.dodgeDz = p.dodgeDz;
  ps.attackUntil = p.attackUntil;
  ps.attackHitAt = p.attackHitAt;
  ps.abilityUntil = p.abilityUntil;
  ps.abilityHitAt = p.abilityHitAt;
  ps.abilitySlot = p.abilitySlot;
  for (let i = 0; i < p.readyAt.length; i++) if (ps.readyAt[i] !== p.readyAt[i]) ps.readyAt[i] = p.readyAt[i];
  ps.respawnAt = p.respawnAt;
  ps.downedUntil = p.downedUntil;
  ps.pickupMs = p.pickupMs;
  ps.pickupBy = p.pickupBy;
  ps.draughts = p.draughts;
}

/** Only the fields that change; @colyseus/schema skips a write of the same value, but it still costs a compare. */
function copyEnemy(e: EnemySim, es: EnemyState) {
  es.x = e.x;
  es.z = e.z;
  es.facing = e.facing;
  es.hp = e.hp;
  es.phase = e.phase;
  es.phaseUntil = e.phaseUntil;
  es.targetId = e.targetId;
  es.hitFlashUntil = e.hitFlashUntil;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\w \-']/g, "").trim().slice(0, 16);
}
