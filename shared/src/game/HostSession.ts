import { applyTuningEdit, tuningEdits } from '../config/edits';
import { tuning } from '../config/tuning';
import { arena, type World } from '../level/arena';
import { PROTOCOL_VERSION, slotPlayerId, type Cheat, type SeqCommand, type ToHost, type ToPeer } from '../net/protocol';
import { addPlayer, applyLoadout, removePlayer } from '../sim/coop';
import { createEnemy, spawnGroup } from '../sim/enemies';
import { restartRun, skipToWave } from '../sim/run';
import { idleCommand, type PlayerCommand, type SimEvent, type SimState } from '../sim/types';
import { createSimState, stepSim } from '../sim/world';
import { mergePresses, withoutPresses } from './Session';

/** A joiner's inputs waiting for host ticks; more than this get folded together so lag can't pile up. */
export const MAX_QUEUE = 4;
/** Ticks without input from a joiner (a stall, a hidden tab) before their held buttons let go. */
export const STALE_TICKS = 15;

/** How the host's messages leave: to one peer, or to every peer when `peer` is omitted. */
export type Send = (msg: ToPeer, peer?: string) => void;

interface Remote {
  id: string;
  queue: SeqCommand[];
  /** Held buttons repeat when a tick's input hasn't arrived yet. */
  last: PlayerCommand;
  /** Last input seq applied, sent back so the joiner can drop it from its replay list. */
  ack: number;
  /** Ticks since an input from them was applied. */
  starved: number;
  /** Ran dry: wait until the cushion (coop.inputBufferTicks) refills before using inputs again. */
  refilling: boolean;
}

/**
 * The authoritative fight, the slice's HostSession moved onto Hearthgate's server. In the slice
 * it ran in the host player's browser with that player's own hero stepped from their keyboard;
 * here every player is a joiner, peers are the server's connections (keyed by session id), and
 * the room's 60 Hz pump calls tick() instead of a browser frame calling advance(). The input
 * queue, acks, folding and staleness are the slice's, line for line.
 *
 * What the slice's host did from its own keyboard and debug panel arrives as input or messages:
 * a fresh interact press once the run is over restarts it, tuning edits, and (in a dev build) the
 * cheat buttons.
 */
export class HostSession {
  sim: SimState;
  private remotes = new Map<string, Remote>();
  /** Events since the last snapshot, for joiners. */
  private outbox: SimEvent[] = [];
  /** Interact held last tick per player: a restart needs a fresh press, as the slice's `pressed` was. */
  private interactHeld = new Set<string>();

  constructor(
    private readonly world: World,
    private readonly send: Send,
    /** Whether the cheat buttons work (a dev build). */
    private readonly cheats = false,
  ) {
    this.sim = createSimState(arena, [], world);
  }

  get playerCount(): number {
    return this.remotes.size;
  }

  /** How fast the fight runs: 1, or the debug slow motion's scale while it is on. */
  timeScale(): number {
    return tuning.debug.slowMo ? tuning.debug.slowMoScale : 1;
  }

  /** One fixed step of the fight, for every player. Returns the step's events. */
  tick(): SimEvent[] {
    const step = 1 / tuning.sim.tickRate;
    const commands: Record<string, PlayerCommand> = {};
    for (const r of this.remotes.values()) commands[r.id] = this.nextCommand(r);
    stepSim(this.sim, commands, step, this.world);
    const events = this.sim.events;
    this.outbox.push(...events);
    this.restartOnInteract(commands);
    if (this.remotes.size > 0 && this.sim.tick % Math.max(1, Math.round(tuning.coop.snapshotEveryTicks)) === 0) this.sendSnapshot();
    return events;
  }

  onMessage(peer: string, msg: ToHost): void {
    if (msg.k === 'hello') {
      const send = (m: ToPeer) => this.send(m, peer);
      if (msg.version !== PROTOCOL_VERSION) return send({ k: 'refused', reason: 'Different game version; refresh the page' });
      if (this.remotes.has(peer)) return;
      if (this.sim.players.length >= tuning.coop.maxPlayers) return send({ k: 'refused', reason: 'The party is full' });
      const id = this.freeId();
      this.between(() => addPlayer(this.sim, this.world, id, msg.loadout, true));
      this.remotes.set(peer, { id, queue: [], last: idleCommand(), ack: 0, starved: 0, refilling: true });
      send({ k: 'welcome', id });
      send({ k: 'tuning', edits: tuningEdits() });
      this.sendSnapshot();
      return;
    }
    const r = this.remotes.get(peer);
    if (!r) return;
    switch (msg.k) {
      case 'input':
        for (const c of msg.cmds) if (c.seq > r.ack && !r.queue.some((q) => q.seq === c.seq)) r.queue.push(c);
        break;
      case 'loadout': {
        const p = this.sim.players.find((pl) => pl.id === r.id);
        if (p) applyLoadout(p, msg.loadout, this.sim.run.phase === 'ante');
        break;
      }
      case 'tune':
        // The process's tuning is shared by every room, so each room sends its own players the set (FightRoom).
        applyTuningEdit(msg.edit.path, msg.edit.value);
        break;
      case 'cheat':
        if (this.cheats) this.cheat(msg.cheat, r.id);
        break;
    }
  }

  /** A peer's connection closed: their hero leaves the fight. */
  onPeerLeft(peer: string): void {
    const r = this.remotes.get(peer);
    if (r) this.between(() => removePlayer(this.sim, r.id));
    this.remotes.delete(peer);
    if (r) this.interactHeld.delete(r.id);
  }

  /** The last input seq applied for a peer (0 before any), for tests and the lab. */
  ackOf(peer: string): number {
    return this.remotes.get(peer)?.ack ?? 0;
  }

  /** Inputs waiting for a peer, for tests and the lab. */
  queuedOf(peer: string): number {
    return this.remotes.get(peer)?.queue.length ?? 0;
  }

  /** The lowest free party slot's id, so a party of four is always p1 to p4. */
  private freeId(): string {
    for (let slot = 0; ; slot++) {
      const id = slotPlayerId(slot);
      if (!this.sim.players.some((p) => p.id === id)) return id;
    }
  }

  /** One tick's input for a joiner: the next queued one, or the last held state if it hasn't arrived. */
  private nextCommand(r: Remote): PlayerCommand {
    while (r.queue.length > MAX_QUEUE) {
      const a = r.queue.shift()!;
      r.queue[0] = { seq: r.queue[0].seq, cmd: mergePresses(a.cmd, r.queue[0].cmd) };
    }
    if (r.queue.length === 0) r.refilling = true;
    if (r.refilling && r.queue.length >= Math.max(1, Math.round(tuning.coop.inputBufferTicks))) r.refilling = false;
    const next = r.refilling ? undefined : r.queue.shift();
    if (!next) {
      // Keep moving through a hiccup, but stop if they've gone quiet.
      if (++r.starved > STALE_TICKS) r.last = { ...idleCommand(), aimX: r.last.aimX, aimZ: r.last.aimZ };
      return r.last;
    }
    r.starved = 0;
    r.ack = next.seq;
    r.last = withoutPresses(next.cmd);
    return next.cmd;
  }

  /**
   * The slice's host started again on its own F (or A) once a run was won or lost; with every
   * player a joiner, anyone's fresh press of interact does.
   */
  private restartOnInteract(commands: Record<string, PlayerCommand>): void {
    const over = this.sim.run.phase === 'won' || this.sim.run.phase === 'lost';
    let pressed = false;
    for (const [id, cmd] of Object.entries(commands)) {
      if (cmd.interact && !this.interactHeld.has(id)) pressed = true;
      if (cmd.interact) this.interactHeld.add(id);
      else this.interactHeld.delete(id);
    }
    if (over && pressed) this.restart();
  }

  /** Back to the antechamber with a fresh run (everyone keeps their heroes, at full health). */
  private restart(): void {
    this.between(() => restartRun(this.sim, this.world));
  }

  /** The slice's debug buttons that change the fight (Game's onHost tools). */
  private cheat(cheat: Cheat, playerId: string): void {
    const sim = this.sim;
    const me = sim.players.find((p) => p.id === playerId) ?? sim.players[0];
    this.between(() => {
      switch (cheat) {
        case 'restart':
          return this.restart();
        case 'wave2':
          return skipToWave(sim, this.world, 2);
        case 'wave3':
          return skipToWave(sim, this.world, 3);
        case 'warden':
          return skipToWave(sim, this.world, 4);
        case 'spawnGrunts':
          return spawnGroup(sim, this.world);
        case 'spawnBrute': {
          if (!me) return;
          const x = me.x + Math.sin(me.yaw) * 6;
          const z = me.z + Math.cos(me.yaw) * 6;
          createEnemy(sim, this.world, 'brute', x, z, me.yaw + Math.PI);
          return;
        }
        case 'spawnArcher': {
          // The slice picked a ledge with Math.random; the sim's own rng would change the fight's rolls, so the tick picks.
          const spots = this.world.level.archerSpots;
          const s = spots[sim.tick % spots.length];
          createEnemy(sim, this.world, 'archer', s.x, s.z, 0);
          return;
        }
        case 'killAll':
          for (const e of sim.enemies) {
            e.hp = 0;
            e.ai = 'dead';
            e.aiTime = 0;
            e.hasToken = false;
            e.tele.shape = 'none';
          }
          return;
      }
    });
  }

  /** Change the sim between ticks, keeping any events it raises. */
  private between(fn: () => void): void {
    const before = this.sim.events.length;
    fn();
    this.outbox.push(...this.sim.events.splice(before));
  }

  private sendSnapshot(): void {
    const acks: Record<string, number> = {};
    for (const r of this.remotes.values()) acks[r.id] = r.ack;
    const msg: ToPeer = { k: 'snap', s: { ...this.sim, events: [] }, acks, ev: this.outbox, scale: this.timeScale() };
    this.send(msg);
    this.outbox = [];
  }
}
