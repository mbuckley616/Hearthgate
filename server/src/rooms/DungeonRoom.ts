import { Client, Room } from "@colyseus/core";
import {
  PLAYER_COLORS,
  SPAWN_POINTS,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  isValidInput,
  neutralInput,
  resolvePlayerAttacks,
  stepEnemy,
  stepRespawns,
  type EnemySim,
  type InputFrame,
  type PlayerSim,
  type SimEvent
} from "@hearthgate/shared";
import { DungeonState, PlayerState } from "../schema/DungeonState.js";

/**
 * Inputs a client may bank while the server waits for the next tick.
 * A client that lags and then sends a burst gets its inputs applied over
 * several ticks instead of all at once, which stops speed exploits.
 */
const MAX_QUEUED_INPUTS = 12;
const MAX_INPUTS_PER_TICK = 2;

interface JoinOptions {
  name?: string;
}

export class DungeonRoom extends Room<DungeonState> {
  maxClients = 8;

  private sim = {
    players: new Map<string, PlayerSim>(),
    enemy: createEnemy() as EnemySim,
    tick: 0
  };
  private queues = new Map<string, InputFrame[]>();
  private nextSpawn = 0;

  onCreate() {
    this.state = new DungeonState();
    // Patches go out every tick so clients see fresh state as soon as it exists.
    this.patchRate = TICK_MS;

    this.onMessage("input", (client, frame: unknown) => {
      if (!isValidInput(frame)) return;
      const q = this.queues.get(client.sessionId);
      if (!q) return;
      const last = q.length ? q[q.length - 1].seq : this.sim.players.get(client.sessionId)?.lastSeq ?? 0;
      if (frame.seq <= last) return; // duplicate or out of order
      if (q.length < MAX_QUEUED_INPUTS) q.push(frame);
    });

    this.onMessage("ping", (client, sentAt: number) => {
      client.send("pong", sentAt);
    });

    this.setSimulationInterval(() => this.step(), TICK_MS);
    console.log(`[dungeon ${this.roomId}] created`);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const slot = this.nextSpawn++ % SPAWN_POINTS.length;
    const spawn = SPAWN_POINTS[slot];
    const p = createPlayer(client.sessionId, spawn.x, spawn.z);
    this.sim.players.set(client.sessionId, p);
    this.queues.set(client.sessionId, []);

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
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log(`[dungeon ${this.roomId}] disposed`);
  }

  private step() {
    this.sim.tick++;
    const now = this.sim.tick * TICK_MS;

    for (const [id, p] of this.sim.players) {
      const q = this.queues.get(id) ?? [];
      const frames = q.splice(0, MAX_INPUTS_PER_TICK);
      if (frames.length === 0) {
        applyInput(p, neutralInput(p.lastSeq), now, TICK_MS);
      } else {
        for (const f of frames) applyInput(p, f, now, TICK_MS);
      }
    }

    const events: SimEvent[] = [];
    events.push(...resolvePlayerAttacks(this.sim.players.values(), this.sim.enemy, now));
    events.push(...stepEnemy(this.sim.enemy, this.sim.players, now, TICK_MS));
    events.push(...stepRespawns(this.sim.players.values(), now));

    this.syncState();
    if (events.length) this.broadcast("events", events);
  }

  private syncState() {
    this.state.tick = this.sim.tick;
    for (const [id, p] of this.sim.players) {
      const ps = this.state.players.get(id);
      if (ps) copyPlayer(p, ps);
    }
    const e = this.sim.enemy;
    const es = this.state.enemy;
    es.x = e.x;
    es.z = e.z;
    es.facing = e.facing;
    es.hp = e.hp;
    es.phase = e.phase;
    es.phaseUntil = e.phaseUntil;
    es.targetId = e.targetId;
    es.hitFlashUntil = e.hitFlashUntil;
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
  ps.respawnAt = p.respawnAt;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[^\w \-']/g, "").trim().slice(0, 16);
}
