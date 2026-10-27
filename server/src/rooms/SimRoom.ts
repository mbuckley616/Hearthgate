import { Client, Room, matchMaker } from "@colyseus/core";
import {
  PLAYER_COLORS,
  SPAWN_POINTS,
  TICK_MS,
  PATCH_TICKS,
  INPUT_TIMING,
  onTick,
  applyDueInputs,
  createEncounter,
  createInputQueue,
  createInputBucket,
  createPlayer,
  cycleLock,
  gearName,
  isValidInput,
  stepEncounter,
  takeInputToken,
  talkToNpc,
  type Encounter,
  useDraught,
  type EnemySim,
  type InputBucket,
  type InputQueue,
  type Level,
  type PlayerSim,
  type SimEvent,
  weaponFromPick,
  applyTuning,
  tuningEdits
} from "@hearthgate/shared";
import { DungeonState, EnemyState, PlayerState } from "../schema/DungeonState.js";

/**
 * Inputs a client may bank while the server waits for the next tick.
 * A client that lags and then sends a burst gets its inputs applied over
 * several ticks instead of all at once, which stops speed exploits.
 */
const MAX_QUEUED_INPUTS = 36;
/**
 * Ticks the loop may run back to back to catch up with wall time, half a second of them. Past this
 * the process stalled (a long GC pause, a sleeping laptop) and the lost time is dropped, not
 * replayed. Dropped time leaves every client's frames that much ahead of the slots, a backlog the
 * drain has to clear, so the window covers the 200 to 450 ms stalls a busy machine gives a server.
 */
const MAX_CATCHUP_TICKS = 30;

/**
 * Bumped on every tuning edit this process applies. The tuning object is one per process, shared
 * by every room, so each room compares it with what it last sent and sends its own clients the
 * whole set when it moved, wherever the edit came from.
 */
let tuningVersion = 0;

/** Close code sent to a client dropped for flooding inputs (4000-4999 is the app range). */
export const CLOSE_INPUT_FLOOD = 4001;

export interface JoinOptions {
  name?: string;
  /** A level id from shared LEVELS; the dungeon room reads it, the village ignores it. */
  level?: string;
  /** The weapon picked on the join screen (a WEAPON_TYPES id) and its material tier; checked by weaponFromPick. */
  weapon?: string;
  tier?: number;
}

/**
 * What a room sends each client when the party moves to another room: a seat the matchmaker
 * reserved for them there and the level it runs, so the client can build it before the first
 * patch. The client leaves this room and consumes the seat (colyseus.js consumeSeatReservation).
 */
export interface Handoff {
  reservation: matchMaker.SeatReservation;
  level: string;
}

/**
 * A room that steps the shared simulation: the village and every dungeon floor. One Level, a
 * player per client, the 60 Hz tick locked to wall time, two queued inputs a player a tick,
 * the patch broadcast at the end of every PATCH_TICKS-th step, and the hand-off of the whole party to another
 * room (the portal and the stairs). Subclasses name the level and act on the tick's events.
 */
export abstract class SimRoom extends Room<DungeonState> {
  maxClients = 8;

  protected sim = {
    players: new Map<string, PlayerSim>(),
    encounter: null as unknown as Encounter,
    tick: 0
  };
  private queues = new Map<string, InputQueue>();
  private buckets = new Map<string, InputBucket>();
  private nextSpawn = 0;
  /** Wall time of simulation time zero; tick n is due at epoch + n * TICK_MS. */
  private epoch = 0;
  /** Wall time the last step's patch left, so simNow() can place a ping reply inside the tick. */
  private lastStepAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Events of the steps since the last patch: they go out with it, so a client never hears of a hit before the patch that shows it. */
  private pendingEvents: SimEvent[] = [];
  /** The tuningVersion this room last sent its clients. */
  private sentTuning = 0;
  /** A hand-off is under way: the seats are being reserved and the clients told. */
  private handingOff = false;

  /** The level this room runs, from the options it was created with. */
  protected abstract levelFor(options: JoinOptions): Level;
  /** The tick's events, after they were broadcast: a subclass starts a hand-off from here. */
  protected onEvents(_events: SimEvent[]): void {}
  /** For the log line. */
  protected abstract get label(): string;

  onCreate(options: JoinOptions = {}) {
    this.state = new DungeonState();
    const level = this.levelFor(options);
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
        console.log(`[${this.label} ${this.roomId}] dropping ${client.sessionId}: input flood`);
        client.leave(CLOSE_INPUT_FLOOD);
        return;
      }
      if (!isValidInput(frame)) return;
      const q = this.queues.get(client.sessionId);
      if (!q) return;
      const last = q.frames.length ? q.frames[q.frames.length - 1].seq : this.sim.players.get(client.sessionId)?.lastSeq ?? 0;
      if (frame.seq <= last) return; // duplicate or out of order
      if (q.frames.length < MAX_QUEUED_INPUTS) q.frames.push(frame);
    });

    // The debug panel (backtick): a live tuning edit. The server's copy is the truth; it checks the
    // value against its range, applies it, and every room sends its clients the whole set at its
    // next patch, so prediction never steps numbers the server does not. Any player may tune: the
    // friend group tests together, and nothing here outlives the process.
    this.onMessage("tune", (_client, edit: unknown) => {
      if (applyTuning(edit)) tuningVersion++;
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
    console.log(`[${this.label} ${this.roomId}] created: ${level.name}, ${this.sim.encounter.enemies.size} enemies`);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const slot = this.nextSpawn++ % SPAWN_POINTS.length;
    const spawn = SPAWN_POINTS[slot];
    const p = createPlayer(client.sessionId, spawn.x, spawn.z);
    p.weapon = weaponFromPick(options.weapon, options.tier);
    // Far enough back that the first frame counts as late and is placed at its tick.
    p.inputAt = onTick(this.sim.tick * TICK_MS - INPUT_TIMING.maxLagMs);
    this.sim.players.set(client.sessionId, p);
    this.queues.set(client.sessionId, createInputQueue());
    this.buckets.set(client.sessionId, createInputBucket(performance.now()));

    const ps = new PlayerState();
    ps.id = client.sessionId;
    ps.name = sanitizeName(options.name) || `Adventurer ${slot + 1}`;
    ps.color = PLAYER_COLORS[slot % PLAYER_COLORS.length];
    copyPlayer(p, ps);
    this.state.players.set(client.sessionId, ps);
    // Edits made before this player arrived, before its first patch, so its prediction starts on them.
    client.send("tuning", tuningEdits());

    console.log(`[${this.label} ${this.roomId}] ${ps.name} joined with a ${gearName(p.weapon)} (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    const ps = this.state.players.get(client.sessionId);
    console.log(`[${this.label} ${this.roomId}] ${ps?.name ?? client.sessionId} left`);
    this.sim.players.delete(client.sessionId);
    this.queues.delete(client.sessionId);
    this.buckets.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    console.log(`[${this.label} ${this.roomId}] disposed`);
  }

  /**
   * Move everyone here to another room: the one `roomId` names, or a fresh room of `roomName`
   * created with `createOptions` when it is empty, or the first open room of that name
   * (joinOrCreate) when neither. Each client gets a seat reserved under their own name and
   * weapon and a "handoff" message carrying it; they leave on their own and join there. This
   * room locks so nobody joins a party that is leaving, and disposes once it is empty. If the
   * matchmaker refuses, the sim's latch is cleared so the portal or the stairs can fire again.
   */
  protected async handOffParty(roomName: string, level: string, createOptions: Record<string, unknown> | null): Promise<void> {
    if (this.handingOff) return;
    this.handingOff = true;
    const clients = [...this.clients];
    try {
      await this.lock();
      let roomId = "";
      if (createOptions) roomId = (await matchMaker.createRoom(roomName, createOptions)).roomId;
      for (const c of clients) {
        const profile = this.profileOf(c.sessionId);
        const reservation = roomId ? await matchMaker.joinById(roomId, profile) : await matchMaker.joinOrCreate(roomName, profile);
        roomId = reservation.room.roomId;
        const handoff: Handoff = { reservation, level };
        c.send("handoff", handoff);
      }
      console.log(`[${this.label} ${this.roomId}] handed ${clients.length} to ${roomName} ${roomId} (${level})`);
    } catch (err) {
      console.error(`[${this.label} ${this.roomId}] hand-off to ${roomName} failed`, err);
      this.sim.encounter.departed = false;
      this.sim.encounter.portalMs = 0;
      this.sim.encounter.descendMs = 0;
      await this.unlock();
    } finally {
      this.handingOff = false;
    }
  }

  /** The join options a player carries from room to room: name, weapon and tier as the server checked them. */
  private profileOf(sessionId: string): JoinOptions {
    const p = this.sim.players.get(sessionId);
    const ps = this.state.players.get(sessionId);
    return { name: ps?.name ?? "", weapon: p?.weapon.type, tier: p?.weapon.tier };
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
      console.error(`[${this.label} ${this.roomId}] step failed`, err);
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
    const cyclers: PlayerSim[] = [];
    for (const [id, p] of this.sim.players) {
      const q = this.queues.get(id);
      if (!q) continue;
      // Each frame at its own slot, not this tick's now (inputs.ts): where the client's replay put it.
      const applied = applyDueInputs(p, q, now, level);
      if (applied.some((f) => f.use)) users.push(p);
      if (applied.some((f) => f.cycle)) cyclers.push(p);
    }

    const events: SimEvent[] = [];
    // After everyone has moved this tick, so a draught reaches a body by where it lies now.
    // Use is one key (E, LB): a dead teammate in reach takes the draught, else a villager in reach talks.
    for (const p of users) {
      const revived = useDraught(p, this.sim.players.values());
      events.push(...revived);
      if (revived.length) continue;
      const npc = talkToNpc(p, level);
      if (npc) events.push({ kind: "npcTalk", playerId: p.id, npcId: npc.id });
    }
    // The same for the lock-on: the candidates are measured from where the archer stands now.
    for (const p of cyclers) cycleLock(p, this.sim.encounter.enemies.values(), level);
    events.push(...stepEncounter(this.sim.encounter, this.sim.players, now, TICK_MS));

    this.pendingEvents.push(...events);
    if (this.sim.tick % PATCH_TICKS === 0) {
      if (this.sentTuning !== tuningVersion) {
        this.sentTuning = tuningVersion;
        this.broadcast("tuning", tuningEdits());
      }
      this.syncState();
      if (this.pendingEvents.length) this.broadcast("events", this.pendingEvents);
      this.pendingEvents = [];
      this.broadcastPatch();
    }
    // Taken after the patch leaves, so a ping reply and a patch stamped the same server
    // time left the server at the same wall time and the client's clock sees one path.
    this.lastStepAt = performance.now();
    if (events.length) this.onEvents(events);
  }

  private syncState() {
    this.state.tick = this.sim.tick;
    const enc = this.sim.encounter;
    this.state.stairsOpen = enc.stairsOpen;
    this.state.descendMs = enc.descendMs;
    this.state.portalMs = enc.portalMs;
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
  ps.inputAt = p.inputAt;
  ps.dodgeUntil = p.dodgeUntil;
  ps.dodgeCooldownUntil = p.dodgeCooldownUntil;
  ps.vx = p.vx;
  ps.vz = p.vz;
  ps.dodgeAt = p.dodgeAt;
  ps.dodgeDx = p.dodgeDx;
  ps.dodgeDz = p.dodgeDz;
  ps.jumpUntil = p.jumpUntil;
  ps.dodgeDist = p.dodgeDist;
  ps.dodgeCharges = p.dodgeCharges;
  ps.dodgeChargeAt = p.dodgeChargeAt;
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
  ps.guarding = p.guarding;
  ps.blockSince = p.blockSince;
  // Whole numbers: the regen's fractions would cost a patch every tick for nothing visible.
  ps.posture = Math.ceil(p.posture);
  ps.staggerUntil = p.staggerUntil;
  ps.knockUntil = p.knockUntil;
  ps.knockDx = p.knockDx;
  ps.knockDz = p.knockDz;
  ps.weaponType = p.weapon.type;
  ps.weaponTier = p.weapon.tier;
  ps.lockId = p.lockId;
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
  es.posture = Math.ceil(e.posture);
  es.maxPosture = e.maxPosture;
  es.postureBrokenUntil = e.postureBrokenUntil;
  es.guardUp = e.guardUp;
  es.rallied = e.rallied;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\w \-']/g, "").trim().slice(0, 16);
}
