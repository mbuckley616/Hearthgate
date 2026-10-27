import { applyServerEdits } from '@hearthgate/shared/config/edits';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { World } from '@hearthgate/shared/level/arena';
import { arena } from '@hearthgate/shared/level/arena';
import { PROTOCOL_VERSION, type SeqCommand, type ToHost, type ToPeer } from '@hearthgate/shared/net/protocol';
import type { Loadout } from '@hearthgate/shared/sim/coop';
import { applyLoadout } from '@hearthgate/shared/sim/coop';
import { separateBodies } from '@hearthgate/shared/sim/enemies';
import { stepPlayer } from '@hearthgate/shared/sim/player';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '@hearthgate/shared/sim/types';
import { createSimState } from '@hearthgate/shared/sim/world';
import { addArrivalSample, createClockSync, remoteTimeAt, type ClockConfig, type ClockSync } from '@hearthgate/shared/net/clock';
import { ServerLink, type LinkEvent } from '../net/ServerLink';
import { isPredictedFor, withoutPresses, type Blend, type Session } from '@hearthgate/shared/game/Session';

/**
 * A replay that moves the hero further than this counts as a correction: Hearthgate's lab has counted
 * from 2 cm since Phase 0, so the numbers compare across the transplant. Smaller ones still ease out.
 */
const CORRECTION_M = 0.02;

/** A hero's plain fields (numbers, strings, booleans), for the lab's diagnosis. */
function scalars(p: PlayerState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v === null || typeof v !== 'object') out[k] = v;
  return out;
}

/** The clock's numbers, read from tuning each time so the panel tunes them live. */
function clockConfig(): ClockConfig {
  const c = tuning.coop;
  return {
    windowMs: c.clockWindowMs,
    slewMsPerS: c.clockSlewMsPerS,
    snapMs: c.clockSnapMs,
    intervalMs: (Math.max(1, Math.round(c.snapshotEveryTicks)) * 1000) / tuning.sim.tickRate,
    baseMs: c.interpDelayMs,
    // Never later than the lag grace: hits on you wait coop.lagGraceMs so a dodge that was on time on
    // your screen counts, and an enemy drawn later than that would eat the grace (the lab, T2).
    maxMs: Math.max(c.interpDelayMs, Math.min(c.interpDelayMaxMs, c.lagGraceMs)),
  };
}

interface Snapshot {
  s: SimState;
  /** The local clock (s) when it arrived. */
  recv: number;
}

/** Corrections and snaps so far, for the debug readout, the lab and the tests. */
export interface PredictionStats {
  snapshots: number;
  /** Snapshots whose replay moved the hero over CORRECTION_M (eased out). */
  corrections: number;
  /** Corrections too big to ease (over 2.5 m), drawn as a jump. */
  snaps: number;
  /** Largest correction so far (m). */
  maxCorrection: number;
  /** Corrections over 10 cm, the ones a player might see through the ease (decisions.md, 27 Oct, T2). */
  bigCorrections: number;
  /**
   * The same, by what the hero was doing (here or on the server): their own swing or ability (its lunge
   * and turn toward a target that moved, decision A), taking a hit (a knock the browser could not
   * foresee), or neither: what is left is the network's.
   */
  bigBySwing: number;
  bigByHit: number;
  bigOther: number;
  /** Over 2.5 m, or going from down to standing: the server placed the hero (a restart, a revive, the gate), not the network. */
  bigPlaced: number;
  /** Sum of every correction (m), for the mean. */
  sumCorrection: number;
}

/**
 * Joining a fight: the slice's joiner, now how every player plays, since the fight runs on
 * Hearthgate's server (solo is a room of one). The server's snapshots are drawn a little in
 * the past (smooth, between two of them); the local hero runs ahead on its own prediction
 * (brief: "each player predicts their own movement and attack animations locally"). When a
 * snapshot arrives, the hero restarts from the server's version of it and replays the inputs
 * the server hasn't applied yet; any difference is eased out visually instead of snapping.
 *
 * Changed from the slice only where the host moved: the relay is a Colyseus room (ServerLink),
 * the server's tuning edits are applied as they arrive, and the clock that draws and predicts
 * runs at the server's speed, so the debug slow motion (now the server's) slows both.
 */
export class ClientSession implements Session {
  readonly role = 'client' as const;
  localId = '';
  /** The room's four-letter code once joined. */
  code: string;
  private relay: ServerLink;
  private state: 'joining' | 'playing' | 'refused' | 'hostLeft' = 'joining';
  private message = '';
  private snaps: Snapshot[] = [];
  /** Latest snapshot with the predicted hero in it: what prediction runs against. */
  private pred: SimState | null = null;
  private me: PlayerState | null = null;
  private prevMe: PlayerState | null = null;
  private seq = 0;
  /** Inputs sent but not yet applied by the server (replayed after each snapshot). */
  private history: SeqCommand[] = [];
  private outgoing: SeqCommand[] = [];
  private accumulator = 0;
  /** The server's clock on the least-delayed path, and the delay to draw behind it (T2: it adapts to late snapshots). */
  private sync: ClockSync = createClockSync(clockConfig());
  /** Host events, released when the drawn time reaches them. */
  private inbox: { t: number; ev: SimEvent }[] = [];
  /** Visual-only offset that eases out prediction corrections. */
  private err = { x: 0, y: 0, z: 0 };
  private loadout: Loadout;
  /** How fast the server runs the fight (1, or the debug slow motion's scale). */
  private speed = 1;
  /** Seconds of fight time on this machine: wall time at the server's speed. */
  private clock = 0;
  private clockWall = performance.now();
  /** What to draw before the first snapshot: the empty arena. */
  private readonly empty: SimState;
  readonly stats: PredictionStats = { snapshots: 0, corrections: 0, snaps: 0, maxCorrection: 0, sumCorrection: 0, bigCorrections: 0, bigBySwing: 0, bigByHit: 0, bigOther: 0, bigPlaced: 0 };
  /** Bumped when the server's tuning edits arrive, so the debug panel can show them. */
  tuningVersion = 0;
  /**
   * The lab's diagnosis of big corrections (off unless set to an array): for each one over 10 cm, the
   * hero's fields where the server, at the acked input, differs from this browser's prediction of
   * that same input, and the command the input carried.
   */
  diag: { at: number; seq: number; size: number; modes: (string | undefined)[]; diffs: Record<string, [unknown, unknown]>; cmd: PlayerCommand | null }[] | null = null;
  private diagPred = new Map<number, Record<string, unknown>>();
  /** Predict enemies pushing the hero (T2); the lab turns it off with --no-shove to measure what it buys. */
  predictBodies = true;

  constructor(
    private readonly world: World,
    /** A friend's room code, or null to start a fight of our own. */
    code: string | null,
    loadout: Loadout,
    /** The server to play on (default: serverUrl(), from the page); the netcode test passes its own. */
    url?: string,
  ) {
    this.relay = new ServerLink(url);
    this.code = code ?? '';
    this.loadout = loadout;
    this.empty = createSimState(arena, [], world);
    this.relay.onEvent((ev) => this.onRelay(ev));
    void this.relay.join(code);
  }

  get playing(): boolean {
    return this.state === 'playing' && !!this.me;
  }

  /** The server is gone or refused us: the game should offer to start again. */
  get ended(): boolean {
    return this.state === 'refused' || this.state === 'hostLeft';
  }

  /** The server's speed: Game scales its frame time by it, as the slice's host did with slow motion. */
  get timeScale(): number {
    return this.speed;
  }

  status(): string {
    switch (this.state) {
      case 'joining':
        return this.code ? `Joining game ${this.code}…` : 'Starting a game…';
      case 'playing':
        return this.me ? `In ${this.code} · ${this.pred?.players.length ?? 1} players` : `Joined ${this.code}, waiting for the fight…`;
      case 'refused':
        return `Couldn't join: ${this.message}`;
      case 'hostLeft':
        return 'Lost the connection to the server';
    }
  }

  setLoadout(loadout: Loadout, refill: boolean): void {
    this.loadout = loadout;
    if (this.me) applyLoadout(this.me, loadout, refill);
    if (this.state === 'playing') this.send({ k: 'loadout', loadout });
  }

  /** Ask the server for something the slice's host did itself (a restart, a tuning edit, a cheat). */
  request(msg: Extract<ToHost, { k: 'restart' | 'tune' | 'cheat' }>): void {
    if (this.state === 'playing') this.send(msg);
  }

  advance(cmd: PlayerCommand, dt: number): { ticks: number; events: SimEvent[] } {
    this.tickClock();
    const events: SimEvent[] = [];
    // Corrections fade out (exponentially, about correctionBlendMs to settle).
    const fade = Math.exp((-3 * dt * 1000) / Math.max(1, tuning.coop.correctionBlendMs));
    this.err.x *= fade;
    this.err.y *= fade;
    this.err.z *= fade;

    if (!this.pred || !this.me) {
      // Nothing to steer yet; drop presses so they don't fire on arrival.
      return { ticks: 1, events: this.releaseInbox() };
    }
    const step = 1 / tuning.sim.tickRate;
    this.accumulator += dt;
    let ticks = 0;
    while (this.accumulator >= step && ticks < tuning.sim.maxStepsPerFrame) {
      const tickCmd = ticks === 0 ? cmd : withoutPresses(cmd);
      const sc = { seq: ++this.seq, cmd: tickCmd };
      this.history.push(sc);
      this.outgoing.push(sc);
      this.prevMe = structuredClone(this.me);
      this.predictTick(tickCmd, step);
      if (this.diag) this.diagPred.set(sc.seq, scalars(this.me));
      // Our own swings, shots, spells and melee contact play now, not a round trip later.
      for (const ev of this.pred.events) if (isPredictedFor(ev, this.localId)) events.push(ev);
      this.accumulator -= step;
      ticks++;
    }
    if (ticks === tuning.sim.maxStepsPerFrame) this.accumulator = Math.min(this.accumulator, step);
    if (this.outgoing.length > 0) {
      this.send({ k: 'input', cmds: this.outgoing });
      this.outgoing = [];
    }
    events.push(...this.releaseInbox());
    return { ticks, events };
  }

  view(): Blend<SimState> {
    const snaps = this.snaps;
    const last = snaps[snaps.length - 1]?.s ?? this.pred ?? this.empty;
    const t = this.renderTime();
    for (let i = snaps.length - 2; i >= 0; i--) {
      const a = snaps[i].s;
      const b = snaps[i + 1].s;
      if (t >= a.time) {
        const alpha = b.time > a.time ? Math.min(1, (t - a.time) / (b.time - a.time)) : 1;
        return { prev: a, curr: b, alpha };
      }
    }
    const first = snaps[0]?.s ?? last;
    return { prev: first, curr: first, alpha: 1 };
  }

  hero(): Blend<PlayerState> | null {
    if (!this.me) return null;
    const shift = (p: PlayerState) => ({ ...p, x: p.x + this.err.x, y: p.y + this.err.y, z: p.z + this.err.z });
    return { prev: shift(this.prevMe ?? this.me), curr: shift(this.me), alpha: this.accumulator * tuning.sim.tickRate };
  }

  /** A world to run prediction in: the latest snapshot, with our predicted hero swapped in. */
  predictionState(): SimState | null {
    return this.pred;
  }

  /** Inputs the server has not applied yet. */
  get unacked(): number {
    return this.history.length;
  }

  private predictTick(cmd: PlayerCommand, step: number): void {
    const pred = this.pred!;
    pred.events = [];
    const w = pred.run.gateClosed ? this.world : { ...this.world, colliders: this.world.collidersOpen };
    stepPlayer(this.me!, cmd, step, w, pred);
    // The server pushes heroes out of enemy bodies in the enemy step, which prediction never runs:
    // push against the enemies as the last snapshot had them, or every brush with one is a correction (T2).
    if (this.predictBodies) for (const e of pred.enemies) if (e.ai !== 'dead') separateBodies(e, this.me!);
    pred.time += step;
  }

  /** The slice used performance.now(); this clock runs at the server's speed so slow motion slows the drawn world too. */
  private tickClock(): void {
    const wall = performance.now();
    this.clock += ((wall - this.clockWall) / 1000) * this.speed;
    this.clockWall = wall;
  }

  private renderTime(): number {
    return remoteTimeAt(this.sync, clockConfig(), this.clock * 1000) / 1000;
  }

  /** How far behind the server everyone else is drawn now, ms. */
  get drawDelayMs(): number {
    return this.sync.delay;
  }

  private releaseInbox(): SimEvent[] {
    if (this.inbox.length === 0) return [];
    const t = this.renderTime();
    const out: SimEvent[] = [];
    while (this.inbox.length && this.inbox[0].t <= t) out.push(this.inbox.shift()!.ev);
    return out;
  }

  private send(msg: ToHost): void {
    this.relay.send(msg);
  }

  private onRelay(ev: LinkEvent): void {
    switch (ev.t) {
      case 'joined':
        this.code = ev.code;
        this.send({ k: 'hello', version: PROTOCOL_VERSION, loadout: this.loadout });
        break;
      case 'error':
        this.state = 'refused';
        this.message = ev.reason;
        break;
      case 'closed':
        if (this.state === 'playing' || this.state === 'joining') this.state = 'hostLeft';
        break;
      case 'msg':
        this.onMessage(ev.d as ToPeer);
        break;
    }
  }

  private onMessage(msg: ToPeer): void {
    if (msg.k === 'welcome') {
      this.localId = msg.id;
      this.state = 'playing';
    } else if (msg.k === 'refused') {
      this.state = 'refused';
      this.message = msg.reason;
      this.relay.close();
    } else if (msg.k === 'tuning') {
      applyServerEdits(msg.edits);
      this.tuningVersion++;
    } else if (msg.k === 'snap') {
      this.onSnapshot(msg.s, msg.acks, msg.ev, msg.scale);
    }
  }

  private onSnapshot(s: SimState, acks: Record<string, number>, events: SimEvent[], scale: number): void {
    this.tickClock();
    this.speed = scale;
    const now = this.clock;
    if (this.snaps.length && s.time <= this.snaps[this.snaps.length - 1].s.time) return;
    this.snaps.push({ s, recv: now });
    if (this.snaps.length > 12) this.snaps.shift();
    this.stats.snapshots++;

    // Track the server's clock on its least-delayed snapshots (clock.ts): a late one cannot drag it later.
    addArrivalSample(this.sync, clockConfig(), now * 1000, s.time * 1000);

    // Server events wait until the drawn world catches up with them, so effects line up with what's on screen.
    for (const ev of events) if (!isPredictedFor(ev, this.localId)) this.inbox.push({ t: s.time, ev });
    if (!this.localId) return;

    // Reconcile: restart from the server's version of our hero and replay what it hasn't seen.
    const ack = acks[this.localId] ?? 0;
    const ackedCmd = this.diag ? (this.history.find((h) => h.seq === ack)?.cmd ?? null) : null;
    this.history = this.history.filter((h) => h.seq > ack);
    const base = structuredClone(s);
    const mine = base.players.find((p) => p.id === this.localId);
    if (!mine) return;
    const before = this.me ? { x: this.me.x, y: this.me.y, z: this.me.z } : null;
    const modes = [this.me?.mode, mine.mode];
    this.pred = base;
    this.me = mine;
    const xp = { ...mine.xp };
    const serverMine = this.diag ? scalars(mine) : null;
    const predAtAck = this.diag ? this.diagPred.get(ack) : undefined;
    if (this.diag) for (const k of this.diagPred.keys()) if (k <= ack) this.diagPred.delete(k);
    for (const h of this.history) {
      this.predictTick(h.cmd, 1 / tuning.sim.tickRate);
      if (this.diag) this.diagPred.set(h.seq, scalars(mine));
    }
    // Replayed hits mustn't count XP twice; the server's number is the truth.
    mine.xp = xp;
    base.events = [];
    if (before && this.prevMe) {
      const d = { x: before.x - mine.x, y: before.y - mine.y, z: before.z - mine.z };
      const size = Math.hypot(d.x, d.y, d.z);
      if (size > CORRECTION_M) {
        this.stats.corrections++;
        this.stats.maxCorrection = Math.max(this.stats.maxCorrection, size);
        if (size > 0.1) {
          this.stats.bigCorrections++;
          if (size > 2.5 || (modes[0] === 'down' && modes[1] !== 'down')) this.stats.bigPlaced++;
          else if (modes.some((m) => m === 'attack' || m === 'ability')) this.stats.bigBySwing++;
          else if (modes.some((m) => m === 'hurt' || m === 'down')) this.stats.bigByHit++;
          else this.stats.bigOther++;
          if (this.diag && serverMine && predAtAck) {
            const diffs: Record<string, [unknown, unknown]> = {};
            for (const k of Object.keys(serverMine)) if (serverMine[k] !== predAtAck[k]) diffs[k] = [predAtAck[k], serverMine[k]];
            this.diag.push({ at: s.time, seq: ack, size, modes, diffs, cmd: ackedCmd });
            if (this.diag.length > 200) this.diag.shift();
          }
        }
        this.stats.sumCorrection += size;
      }
      this.err.x += d.x;
      this.err.y += d.y;
      this.err.z += d.z;
      // Keep the previous tick in the same frame of reference so the blend between them doesn't jump.
      this.prevMe.x -= d.x;
      this.prevMe.y -= d.y;
      this.prevMe.z -= d.z;
      // Far off (a teleport, a restart): just snap.
      if (Math.hypot(this.err.x, this.err.z) > 2.5) {
        this.stats.snaps++;
        this.err = { x: 0, y: 0, z: 0 };
        this.prevMe = structuredClone(mine);
      }
    } else {
      this.prevMe = structuredClone(mine);
    }
  }
}
