import { Client, Room } from "colyseus.js";
import {
  CLOCK_SYNC,
  OPEN_FIELD,
  TICK_MS,
  addArrivalSample,
  addClockSample,
  applyInput,
  createClockSync,
  createPlayer,
  interpDelayAt,
  isAlive,
  isDead,
  levelById,
  minRtt,
  remoteTimeAt,
  serverTimeAt,
  type EnemyKind,
  type EnemyPhase,
  type InputFrame,
  type Level,
  type PlayerSim,
  type SimEvent,
  type WeaponGear,
  weaponFromPick
} from "@hearthgate/shared";

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
  /** When a dead teammate comes back by themselves (0 while a draught is their only way back). */
  respawnAt: number;
  attackUntil: number;
  abilityUntil: number;
  abilitySlot: number;
  attackHitAt: number;
  dodgeUntil: number;
  guarding: boolean;
  staggerUntil: number;
  /** Their weapon (picked at join): the mesh and the swing timings come from it. */
  weapon: WeaponGear;
  snaps: Snapshot[];
}

export interface EnemyView {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  phase: EnemyPhase;
  phaseUntil: number;
  targetId: string;
  hitFlashUntil: number;
  posture: number;
  maxPosture: number;
  postureBrokenUntil: number;
  guardUp: boolean;
  rallied: boolean;
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
 *  - interpolation: everyone else is drawn 100 to 200 ms in the past (INTERP, adapted to
 *    the jitter seen) between two received snapshots so movement is smooth at 20 updates
 *    a second.
 *
 * The server clock behind interpolation comes from stamped messages: the server echoes
 * its simulation time to pings and stamps every patch with its tick, the message with the
 * shortest trip here in a window sets the offset, and the applied offset slews toward it at
 * CLOCK_SYNC.slewMsPerS so remote players never skip or stall when a packet is late. The
 * same window's longest wait for a patch sets the interpolation delay (see clock.ts), slewed
 * the same way.
 *
 * Prediction runs inside the room's level (walls included), which the first patch names;
 * the server steps the same level, so a wall is never a correction.
 */
export class Net {
  room: Room | null = null;
  sessionId = "";
  /** Our own predicted player. */
  me: PlayerSim = createPlayer("");
  myName = "";
  myColor = "#ffffff";
  /** The room's level, from the server; the open field until the first patch. */
  level: Level = OPEN_FIELD;
  /** Server-time of the latest input we predicted. Advances one tick per input. */
  predictedTime = 0;
  /** Smoothed visual offset that hides reconciliation corrections. */
  visualErrX = 0;
  visualErrZ = 0;
  pending: InputFrame[] = [];
  remotes = new Map<string, RemotePlayer>();
  /** Every enemy in the room, alive or dead, keyed by the simulation's id. */
  enemies = new Map<string, EnemyView>();
  rttMs = 0;
  connected = false;
  lastServerTick = 0;
  /** The floor's stairs: open, how long the party has stood on them (ms), which floor. */
  stairsOpen = false;
  descendMs = 0;
  floor = 1;
  /** Count of reconciliations that moved us more than a few centimetres (debug HUD). */
  corrections = 0;
  /** Count of corrections too big to smooth (over SNAP_DISTANCE), which pop instead. */
  snaps = 0;

  /** False until the first patch places us; that placement is not a correction. */
  private placed = false;
  private clock = createClockSync();
  private pingsSent = 0;
  private listeners: EventListener[] = [];
  private pingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Join with the weapon picked on the join screen; the server checks it and the first patch confirms it. */
  async connect(endpoint: string, name: string, level?: string, weapon: WeaponGear = weaponFromPick("sword", 1)): Promise<void> {
    const client = new Client(endpoint);
    const options: Record<string, unknown> = { name, weapon: weapon.type, tier: weapon.tier };
    if (level) options.level = level;
    const room = await client.joinOrCreate("dungeon", options);
    this.room = room;
    this.sessionId = room.sessionId;
    this.me = createPlayer(room.sessionId);
    this.me.weapon = { ...weapon };
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

  /** How far behind serverNow() remote players and enemies are drawn right now, ms. */
  get interpDelayMs(): number {
    return interpDelayAt(this.clock, performance.now());
  }

  /** The worst recent lateness the frames saw (longest wait for a patch, less a tick), ms: what the delay above base covers. */
  get lateMs(): number {
    return this.clock.late;
  }

  onEvents(listener: EventListener) {
    this.listeners.push(listener);
  }

  /** Called once per client tick with the sampled input. Predicts locally and sends. */
  tick(frame: InputFrame) {
    if (!this.room || !this.connected) return;
    this.predictedTime += TICK_MS;
    applyInput(this.me, frame, this.predictedTime, TICK_MS, this.level);
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

  /**
   * The server time remote players and enemies are drawn at this frame: serverNow() less
   * the interpolation delay. Use it for their timers (swings, windups) too, so what they do
   * lines up with where they are.
   */
  remoteNow(): number {
    return remoteTimeAt(this.clock, performance.now());
  }

  remotePose(r: { snaps: Snapshot[] }): Pose | null {
    return sampleSnapshots(r.snaps, this.remoteNow());
  }

  /** The living enemy drawn nearest to (x, z), for the HUD and hit feedback. */
  nearestEnemy(x: number, z: number): { view: EnemyView; pose: Pose } | null {
    let best: { view: EnemyView; pose: Pose } | null = null;
    let bestD = Infinity;
    for (const view of this.enemies.values()) {
      if (view.phase === "dead") continue;
      const pose = this.remotePose(view);
      if (!pose) continue;
      const d = Math.hypot(pose.x - x, pose.z - z);
      if (d < bestD) {
        bestD = d;
        best = { view, pose };
      }
    }
    return best;
  }

  enemiesAlive(): number {
    let n = 0;
    for (const e of this.enemies.values()) if (e.phase !== "dead") n++;
    return n;
  }

  private onState(state: any) {
    const serverTime = state.tick * TICK_MS;
    const at = performance.now();
    this.lastServerTick = state.tick;
    this.stairsOpen = state.stairsOpen === true;
    this.descendMs = state.descendMs ?? 0;
    this.floor = state.floor ?? 1;
    // Every patch is a clock sample too: it left the server at the time it is stamped with.
    addArrivalSample(this.clock, at, serverTime);
    if (typeof state.levelId === "string" && state.levelId !== this.level.id) this.level = levelById(state.levelId);

    const seen = new Set<string>();
    state.players.forEach((p: any, id: string) => {
      seen.add(id);
      if (id === this.sessionId) {
        this.reconcile(p, serverTime);
        return;
      }
      let r = this.remotes.get(id);
      if (!r) {
        r = { id, name: p.name, color: p.color, hp: p.hp, downedUntil: 0, pickupMs: 0, respawnAt: 0, attackUntil: 0, abilityUntil: 0, abilitySlot: 0, attackHitAt: 0, dodgeUntil: 0, guarding: false, staggerUntil: 0, weapon: weaponFromPick(p.weaponType, p.weaponTier), snaps: [] };
        this.remotes.set(id, r);
      }
      r.name = p.name;
      r.color = p.color;
      r.hp = p.hp;
      r.downedUntil = p.downedUntil;
      r.pickupMs = p.pickupMs;
      r.respawnAt = p.respawnAt;
      r.attackUntil = p.attackUntil;
      r.abilityUntil = p.abilityUntil;
      r.abilitySlot = p.abilitySlot;
      r.attackHitAt = p.attackHitAt;
      r.dodgeUntil = p.dodgeUntil;
      r.guarding = p.guarding === true;
      r.staggerUntil = p.staggerUntil ?? 0;
      syncWeapon(r.weapon, p);
      pushSnapshot(r.snaps, { t: serverTime, at, x: p.x, z: p.z, facing: p.facing });
    });
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.remotes.delete(id);

    const seenEnemies = new Set<string>();
    state.enemies?.forEach((e: any, id: string) => {
      seenEnemies.add(id);
      let v = this.enemies.get(id);
      if (!v) {
        v = { id, kind: e.kind, hp: e.hp, maxHp: e.maxHp, phase: e.phase, phaseUntil: 0, targetId: "", hitFlashUntil: 0, posture: 0, maxPosture: 0, postureBrokenUntil: 0, guardUp: false, rallied: false, snaps: [] };
        this.enemies.set(id, v);
      }
      v.kind = e.kind;
      v.hp = e.hp;
      v.maxHp = e.maxHp;
      v.phase = e.phase;
      v.phaseUntil = e.phaseUntil;
      v.targetId = e.targetId;
      v.hitFlashUntil = e.hitFlashUntil;
      v.posture = e.posture ?? 0;
      v.maxPosture = e.maxPosture ?? 0;
      v.postureBrokenUntil = e.postureBrokenUntil ?? 0;
      v.guardUp = e.guardUp === true;
      v.rallied = e.rallied === true;
      pushSnapshot(v.snaps, { t: serverTime, at, x: e.x, z: e.z, facing: e.facing });
    });
    for (const id of [...this.enemies.keys()]) if (!seenEnemies.has(id)) this.enemies.delete(id);
  }

  /** Rewind to the server's copy of us and replay every input it has not applied yet. */
  private reconcile(p: any, serverTime: number) {
    this.myName = p.name;
    this.myColor = p.color;

    const beforeX = this.me.x;
    const beforeZ = this.me.z;
    const wasDead = isDead(this.me);

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
    me.abilityUntil = p.abilityUntil;
    me.abilityHitAt = p.abilityHitAt;
    me.abilitySlot = p.abilitySlot;
    me.readyAt = Array.from(p.readyAt as Iterable<number>);
    me.respawnAt = p.respawnAt;
    me.downedUntil = p.downedUntil;
    me.pickupMs = p.pickupMs;
    me.pickupBy = p.pickupBy;
    me.draughts = p.draughts;
    // The guard is predicted like a dodge: rewind to the server's and replay.
    me.guarding = p.guarding === true;
    me.blockSince = p.blockSince ?? 0;
    me.posture = p.posture ?? me.posture;
    me.staggerUntil = p.staggerUntil ?? 0;
    me.knockUntil = p.knockUntil ?? 0;
    me.knockDx = p.knockDx ?? 0;
    me.knockDz = p.knockDz ?? 0;
    // The server's checked weapon, before the replay: a two-hander's swing times differ.
    syncWeapon(me.weapon, p);
    // Server only (cycleLock): prediction never moves it, so it is copied, not replayed.
    me.lockId = typeof p.lockId === "string" ? p.lockId : "";

    this.pending = this.pending.filter((f) => f.seq > p.lastSeq);
    let t = serverTime;
    for (const f of this.pending) {
      t += TICK_MS;
      applyInput(me, f, t, TICK_MS, this.level);
    }
    this.predictedTime = t;

    // Joining and respawning (dead to standing, after a bleed-out, a cleared room or a wipe)
    // put us where the server chose: a placement, not a prediction error, so it neither
    // smooths nor counts, or the HUD and the lag lab would read every respawn as a snap.
    if (!this.placed || (wasDead && isAlive(me))) {
      this.placed = true;
      this.visualErrX = 0;
      this.visualErrZ = 0;
      return;
    }

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

/** Copy the schema's weapon into a sim weapon in place, checked like the server checks a pick. */
function syncWeapon(w: WeaponGear, p: any) {
  if (typeof p.weaponType !== "string") return;
  if (w.type === p.weaponType && w.tier === p.weaponTier) return;
  const checked = weaponFromPick(p.weaponType, p.weaponTier);
  w.type = checked.type;
  w.tier = checked.tier;
}
