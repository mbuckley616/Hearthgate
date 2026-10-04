import { Client, Room } from "colyseus.js";
import {
  CLOCK_SYNC,
  TICK_MS,
  addArrivalSample,
  addClockSample,
  applyInput,
  createClockSync,
  createPlayer,
  minRtt,
  serverTimeAt,
  type EnemyPhase,
  type InputFrame,
  type PlayerSim,
  type SimEvent
} from "@hearthgate/shared";

/**
 * How far behind the server clock remote players are drawn. The clock (see
 * @hearthgate/shared clock.ts) tracks server time as it reaches us on the least-delayed
 * path, so this is also the budget a late snapshot has before the remote player holds.
 */
export const INTERP_DELAY_MS = 100;
const SNAPSHOT_KEEP = 24;
/** Prediction error larger than this snaps instead of smoothing. */
export const SNAP_DISTANCE = 2.5;

export interface Snapshot {
  /** Server time the snapshot describes. */
  t: number;
  /** Client time it arrived (performance.now()); the clock harness reads the delivery floor from it. */
  at: number;
  x: number;
  z: number;
  facing: number;
}

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  hp: number;
  downedUntil: number;
  pickupMs: number;
  attackUntil: number;
  attackHitAt: number;
  dodgeUntil: number;
  snaps: Snapshot[];
}

export interface EnemyView {
  hp: number;
  phase: EnemyPhase;
  phaseUntil: number;
  targetId: string;
  hitFlashUntil: number;
  snaps: Snapshot[];
}

export interface Pose {
  x: number;
  z: number;
  facing: number;
}

export type EventListener = (events: SimEvent[]) => void;

/**
 * Owns the connection and the two halves of the netcode:
 *  - prediction: our own player runs the shared sim locally per tick and is
 *    rewound and replayed whenever the server's copy arrives;
 *  - interpolation: everyone else is drawn ~100 ms in the past between two
 *    received snapshots so movement is smooth at 20 updates a second.
 *
 * The server clock behind interpolation comes from stamped messages: the server echoes
 * its simulation time to pings and stamps every patch with its tick, the message with the
 * shortest trip here in a window sets the offset, and the applied offset slews toward it at
 * CLOCK_SYNC.slewMsPerS so remote players never skip or stall when a packet is late.
 */
export class Net {
  room: Room | null = null;
  sessionId = "";
  /** Our own predicted player. */
  me: PlayerSim = createPlayer("");
  myName = "";
  myColor = "#ffffff";
  /** Server-time of the latest input we predicted. Advances one tick per input. */
  predictedTime = 0;
  /** Smoothed visual offset that hides reconciliation corrections. */
  visualErrX = 0;
  visualErrZ = 0;
  pending: InputFrame[] = [];
  remotes = new Map<string, RemotePlayer>();
  enemy: EnemyView = { hp: 0, phase: "idle", phaseUntil: 0, targetId: "", hitFlashUntil: 0, snaps: [] };
  rttMs = 0;
  connected = false;
  lastServerTick = 0;
  /** Count of reconciliations that moved us more than a few centimetres (debug HUD). */
  corrections = 0;
  /** Count of corrections too big to smooth (over SNAP_DISTANCE), which pop instead. */
  snaps = 0;

  private clock = createClockSync();
  private pingsSent = 0;
  private listeners: EventListener[] = [];
  private pingTimer: ReturnType<typeof setTimeout> | null = null;

  async connect(endpoint: string, name: string): Promise<void> {
    const client = new Client(endpoint);
    const room = await client.joinOrCreate("dungeon", { name });
    this.room = room;
    this.sessionId = room.sessionId;
    this.me = createPlayer(room.sessionId);
    this.connected = true;

    room.onStateChange((state: any) => this.onState(state));
    room.onMessage("events", (events: SimEvent[]) => {
      for (const l of this.listeners) l(events);
    });
    room.onMessage("pong", (m: { sentAt: number; serverTime: number }) => {
      const now = performance.now();
      const rtt = now - m.sentAt;
      this.rttMs = this.rttMs === 0 ? rtt : this.rttMs * 0.8 + rtt * 0.2;
      addClockSample(this.clock, m.sentAt, now, m.serverTime);
    });
    room.onLeave(() => {
      this.connected = false;
    });

    this.ping();
  }

  /** Pings quickly at first so the clock has a few samples within a second, then once a second. */
  private ping() {
    if (!this.room || !this.connected) return;
    this.room.send("ping", performance.now());
    this.pingsSent++;
    const wait = this.pingsSent < CLOCK_SYNC.pingFastCount ? CLOCK_SYNC.pingFastMs : CLOCK_SYNC.pingMs;
    this.pingTimer = setTimeout(() => this.ping(), wait);
  }

  /** Lowest round trip in the clock window (debug handle). */
  get minRttMs(): number {
    const m = minRtt(this.clock);
    return Number.isFinite(m) ? m : 0;
  }

  /** The clock offset in force: server time minus performance.now() (debug handle). */
  get clockOffset(): number {
    return this.clock.offset;
  }

  onEvents(listener: EventListener) {
    this.listeners.push(listener);
  }

  /** Called once per client tick with the sampled input. Predicts locally and sends. */
  tick(frame: InputFrame) {
    if (!this.room || !this.connected) return;
    this.predictedTime += TICK_MS;
    applyInput(this.me, frame, this.predictedTime, TICK_MS);
    this.pending.push(frame);
    if (this.pending.length > 64) this.pending.shift(); // never let a dead link grow unbounded
    this.room.send("input", frame);
  }

  /**
   * Estimated server time in ms as its messages reach us, for drawing remote snapshots.
   * Not for prediction: that uses predictedTime, which counts ticks from the last patch.
   */
  serverNow(): number {
    return serverTimeAt(this.clock, performance.now());
  }

  /** Where to draw our own player this frame (prediction plus decaying error offset). */
  myPose(dtMs: number): Pose {
    const decay = Math.exp(-dtMs / 90);
    this.visualErrX *= decay;
    this.visualErrZ *= decay;
    return { x: this.me.x + this.visualErrX, z: this.me.z + this.visualErrZ, facing: this.me.facing };
  }

  remotePose(r: { snaps: Snapshot[] }): Pose | null {
    return sampleSnapshots(r.snaps, this.serverNow() - INTERP_DELAY_MS);
  }

  private onState(state: any) {
    const serverTime = state.tick * TICK_MS;
    const at = performance.now();
    this.lastServerTick = state.tick;
    // Every patch is a clock sample too: it left the server at the time it is stamped with.
    addArrivalSample(this.clock, at, serverTime);

    const seen = new Set<string>();
    state.players.forEach((p: any, id: string) => {
      seen.add(id);
      if (id === this.sessionId) {
        this.reconcile(p, serverTime);
        return;
      }
      let r = this.remotes.get(id);
      if (!r) {
        r = { id, name: p.name, color: p.color, hp: p.hp, downedUntil: 0, pickupMs: 0, attackUntil: 0, attackHitAt: 0, dodgeUntil: 0, snaps: [] };
        this.remotes.set(id, r);
      }
      r.name = p.name;
      r.color = p.color;
      r.hp = p.hp;
      r.downedUntil = p.downedUntil;
      r.pickupMs = p.pickupMs;
      r.attackUntil = p.attackUntil;
      r.attackHitAt = p.attackHitAt;
      r.dodgeUntil = p.dodgeUntil;
      pushSnapshot(r.snaps, { t: serverTime, at, x: p.x, z: p.z, facing: p.facing });
    });
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.remotes.delete(id);

    const e = state.enemy;
    this.enemy.hp = e.hp;
    this.enemy.phase = e.phase;
    this.enemy.phaseUntil = e.phaseUntil;
    this.enemy.targetId = e.targetId;
    this.enemy.hitFlashUntil = e.hitFlashUntil;
    pushSnapshot(this.enemy.snaps, { t: serverTime, at, x: e.x, z: e.z, facing: e.facing });
  }

  /** Rewind to the server's copy of us and replay every input it has not applied yet. */
  private reconcile(p: any, serverTime: number) {
    this.myName = p.name;
    this.myColor = p.color;

    const beforeX = this.me.x;
    const beforeZ = this.me.z;

    const me = this.me;
    me.x = p.x;
    me.z = p.z;
    me.facing = p.facing;
    me.hp = p.hp;
    me.lastSeq = p.lastSeq;
    me.dodgeUntil = p.dodgeUntil;
    me.dodgeCooldownUntil = p.dodgeCooldownUntil;
    me.dodgeDx = p.dodgeDx;
    me.dodgeDz = p.dodgeDz;
    me.attackUntil = p.attackUntil;
    me.attackHitAt = p.attackHitAt;
    me.respawnAt = p.respawnAt;
    me.downedUntil = p.downedUntil;
    me.pickupMs = p.pickupMs;
    me.pickupBy = p.pickupBy;

    this.pending = this.pending.filter((f) => f.seq > p.lastSeq);
    let t = serverTime;
    for (const f of this.pending) {
      t += TICK_MS;
      applyInput(me, f, t, TICK_MS);
    }
    this.predictedTime = t;

    // Fold the correction into a visual offset that decays, so small errors never pop.
    const errX = beforeX - me.x;
    const errZ = beforeZ - me.z;
    const err = Math.hypot(errX, errZ);
    if (err > 0.02) this.corrections++;
    if (err < SNAP_DISTANCE) {
      this.visualErrX += errX;
      this.visualErrZ += errZ;
    } else {
      this.snaps++;
      this.visualErrX = 0;
      this.visualErrZ = 0;
    }
  }

  dispose() {
    if (this.pingTimer !== null) clearTimeout(this.pingTimer);
    this.connected = false;
    this.room?.leave();
  }
}

function pushSnapshot(buf: Snapshot[], s: Snapshot) {
  const last = buf[buf.length - 1];
  if (last && last.t === s.t) {
    buf[buf.length - 1] = s;
    return;
  }
  buf.push(s);
  if (buf.length > SNAPSHOT_KEEP) buf.shift();
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** Interpolate (or hold) a pose from a snapshot buffer at time t. */
export function sampleSnapshots(snaps: Snapshot[], t: number): Pose | null {
  if (snaps.length === 0) return null;
  if (snaps.length === 1 || t <= snaps[0].t) {
    const s = snaps[0];
    return { x: s.x, z: s.z, facing: s.facing };
  }
  for (let i = 0; i < snaps.length - 1; i++) {
    const a = snaps[i];
    const b = snaps[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return {
        x: a.x + (b.x - a.x) * k,
        z: a.z + (b.z - a.z) * k,
        facing: lerpAngle(a.facing, b.facing, k)
      };
    }
  }
  // Past the newest snapshot: hold it (no extrapolation in Phase 0; see backlog).
  const s = snaps[snaps.length - 1];
  return { x: s.x, z: s.z, facing: s.facing };
}
