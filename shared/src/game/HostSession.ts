import { applyTuningEdit, tuningEdits } from '../config/edits';
import { tuning } from '../config/tuning';
import type { World } from '../level/arena';
import type { HandDungeon } from '../level/handmade';
import { choiceLabel, type PortalChoice } from './portalChoice';
import { HENCHMAN_NAMES, henchmanCommand } from '../sim/henchman';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { PROTOCOL_VERSION, slotPlayerId, type Cheat, type ToHost, type ToPeer } from '../net/protocol';
import { addPlayer, applyLoadout, removePlayer, slotsOpen } from '../sim/coop';
import { dropFromBag } from '../sim/drops';
import { createEnemy, spawnGroup } from '../sim/enemies';
import { restartRun, skipToWave } from '../sim/run';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '../sim/types';
import { createSimState, stepSim } from '../sim/world';
import { createSlots, nextSlotCommand, receiveInputs, type SlotConfig, type Slots } from './inputSlots';
import { PORTAL_HOLD_S, partyOnPortal, portalsFor, type PortalState, type PortalTo } from './portal';

/**
 * The input slots' numbers (inputSlots.ts). The cushion starts at the slice's coop.inputBufferTicks;
 * it widens to cover late inputs up to a quarter of a second, the TCP retransmit a lossy link costs
 * (200 ms) and a little; a player silent for 300 ms has stalled rather than lagged; the held
 * buttons let go after the slice's 15 ticks; five calm seconds narrow the cushion by a tick; and
 * more than four waiting beyond the cushion are used up at once, as the slice's host folded them.
 */
export function slotConfig(): SlotConfig {
  return { baseCushion: Math.max(1, Math.round(tuning.coop.inputBufferTicks)), maxCushion: 15, maxGuess: 18, staleTicks: 15, calmTicks: 300, maxQueued: 120, maxExtra: 4 };
}

/** How the host's messages leave: to one peer, or to every peer when `peer` is omitted. */
export type Send = (msg: ToPeer, peer?: string) => void;

interface Remote {
  id: string;
  /** Their inputs and when each takes effect; `slots.ack` goes back to them in every snapshot. */
  slots: Slots;
}

/**
 * The authoritative fight, the slice's HostSession moved onto Hearthgate's server. In the slice
 * it ran in the host player's browser with that player's own hero stepped from their keyboard;
 * here every player is a joiner, peers are the server's connections (keyed by session id), and
 * the room's 60 Hz pump calls tick() instead of a browser frame calling advance(). The input
 * queue is T2's input slots (inputSlots.ts), which replaced the slice's after the lab's lossy row.
 *
 * What the slice's host did from its own keyboard and debug panel arrives as messages: a restart
 * once the run is over (anyone's F), tuning edits, and (in a dev build) the cheat buttons.
 */
export class HostSession {
  sim: SimState;
  private remotes = new Map<string, Remote>();
  /** Events since the last snapshot, for joiners. */
  private outbox: SimEvent[] = [];
  /** Seconds the whole party has stood in one open ring (T3), and which ring (the rest room has two, T4). */
  private portalHeld = 0;
  private heldRing = -1;
  /** The portal was taken and the room is moving the party; it fires once until reopenPortal(). */
  private portalTaken = false;
  /** Where the village's ring leads (T4b): a hand-built dungeon Keeper Wren was asked for, or null for a generated run. */
  destination: HandDungeon | null = null;
  /** What Keeper Wren's menu chose (P7), set by the village's room; it leads the ring over `destination`. */
  choice: PortalChoice | null = null;

  constructor(
    private readonly world: World,
    private readonly send: Send,
    /** Whether the cheat buttons work (a dev build; never in the village). */
    private readonly cheats = false,
    /** Called once when the party has held the open portal long enough: the room hands them on. */
    private readonly onPortal: (to: PortalTo) => void = () => {},
    /** A player asked to go home from a finished floor (D10): the room hands that peer alone to the village. */
    private readonly onHome: (peer: string) => void = () => {},
  ) {
    this.sim = createSimState(world.level, [], world);
  }

  /** The hand-off failed (or was refused): the portal can be taken again. */
  reopenPortal(): void {
    this.portalTaken = false;
    this.portalHeld = 0;
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
    // Henchmen (P3): their brains give their commands, here on the server alone.
    for (const p of this.sim.players) if (p.henchman) commands[p.id] = henchmanCommand(this.sim, p);
    stepSim(this.sim, commands, step, this.world);
    const events = this.sim.events;
    this.outbox.push(...events);
    this.stepPortal(step);
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
      this.remotes.set(peer, { id, slots: createSlots(slotConfig()) });
      // A generated floor's browsers build it from its spec (T4); the layout never travels.
      send({ k: 'welcome', id, floor: this.world.level.dungeon?.def.spec });
      send({ k: 'tuning', edits: tuningEdits() });
      this.sendSnapshot();
      return;
    }
    const r = this.remotes.get(peer);
    if (!r) return;
    switch (msg.k) {
      case 'input':
        receiveInputs(r.slots, slotConfig(), msg.cmds);
        break;
      case 'loadout': {
        const p = this.sim.players.find((pl) => pl.id === r.id);
        if (!p) break;
        // Slotted perks change only in the village or a rest room (T6c); elsewhere the hero keeps its four.
        const l = msg.loadout;
        if (l.champion && !slotsOpen(this.sim, !!this.world.level.village)) {
          const kept = p.champion?.slots;
          l.champion = { xp: l.champion.xp, ranks: l.champion.ranks, ...(kept ? { slots: [...kept] } : {}) };
        }
        applyLoadout(p, l, this.sim.run.phase === 'ante');
        break;
      }
      case 'restart':
        // The slice's host started again on its own F (or A) once a run was over; now anyone's does.
        // A generated floor is never run again in place: its rings lead on or home (T4).
        if ((this.sim.run.phase === 'won' || this.sim.run.phase === 'lost') && !this.world.level.dungeon) this.restart();
        break;
      case 'home':
        // The end card's button (D10): a wipe leaves the party down where it fell, so each goes home
        // when they choose; a win's ring still takes the party together.
        if (this.world.level.dungeon && (this.sim.run.phase === 'won' || this.sim.run.phase === 'lost')) this.onHome(peer);
        break;
      case 'drop':
        this.between(() => dropFromBag(this.sim, this.world, r.id, msg.item));
        break;
      case 'tune':
        // The process's tuning is shared by every room, so each room sends its own players the set (FightRoom).
        applyTuningEdit(msg.edit.path, msg.edit.value);
        break;
      case 'destination':
        // Anyone in the village may ask Keeper Wren; the whole party's ring follows.
        if (this.world.level.village) {
          this.destination = msg.dungeon;
          this.choice = null;
        }
        break;
      case 'portal':
        // The village's room checks the choice against its shrine and sets `choice` (P7).
        break;
      case 'cheat':
        if (this.cheats && !this.world.level.village) this.cheat(msg.cheat, r.id, !!this.world.level.dungeon);
        break;
      case 'upgrade':
      case 'buy':
      case 'sell':
        // The village's room holds the village and its store and answers these (P4, P5); the fight has nothing to do.
        break;
    }
  }

  /** A peer's connection closed: their hero leaves the fight. */
  onPeerLeft(peer: string): void {
    const r = this.remotes.get(peer);
    if (r) this.between(() => removePlayer(this.sim, r.id));
    this.remotes.delete(peer);
  }

  /** The last input seq applied for a peer (0 before any), for tests and the lab. */
  ackOf(peer: string): number {
    return this.remotes.get(peer)?.slots.ack ?? 0;
  }

  /** Inputs waiting for a peer, for tests and the lab. */
  queuedOf(peer: string): number {
    return this.remotes.get(peer)?.slots.queue.length ?? 0;
  }

  /** A peer's input slots, for tests and the lab. */
  slotsOf(peer: string): Slots | undefined {
    return this.remotes.get(peer)?.slots;
  }

  /** The lowest free party slot's id, so a party of four is always p1 to p4. */
  private freeId(): string {
    for (let slot = 0; ; slot++) {
      const id = slotPlayerId(slot);
      if (!this.sim.players.some((p) => p.id === id)) return id;
    }
  }

  /** One tick's input for a joiner: the one whose slot this is, or their held buttons standing in for it. */
  private nextCommand(r: Remote): PlayerCommand {
    return nextSlotCommand(r.slots, slotConfig());
  }

  /** Back to the antechamber with a fresh run (everyone keeps their heroes, at full health). */
  private restart(): void {
    this.between(() => restartRun(this.sim, this.world));
  }

  /** The slice's debug buttons that change the fight (Game's onHost tools). */
  /**
   * A henchman joins the party (P3: a debug cheat until the tavern hires them, P10): a sword hero at
   * the level of the hero who asked, beside them, with the next free name. Not past the party's size.
   */
  addHenchman(beside: PlayerState | undefined): PlayerState | null {
    const sim = this.sim;
    if (sim.players.length >= tuning.coop.maxPlayers) return null;
    const n = sim.players.filter((p) => p.henchman).length;
    const name = HENCHMAN_NAMES[n % HENCHMAN_NAMES.length];
    const best = beside ? Math.max(beside.xp.sword, beside.xp.bow, beside.xp.staff) : 0;
    let id = 'h1';
    for (let i = 1; sim.players.some((p) => p.id === id); i++) id = `h${i}`;
    const h = addPlayer(sim, this.world, id, { name, xp: { sword: best, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: tuning.combat.heroMaxHp }, false);
    h.henchman = true;
    h.style = 'sword';
    return h;
  }

  private cheat(cheat: Cheat, playerId: string, floor: boolean): void {
    const sim = this.sim;
    const me = sim.players.find((p) => p.id === playerId) ?? sim.players[0];
    // A generated floor has no waves to skip to and no ledge for archers: its archers come in front of you, as the brute does.
    if (floor && (cheat === 'restart' || cheat === 'wave2' || cheat === 'wave3' || cheat === 'warden')) return;
    if (floor && cheat === 'spawnArcher' && me) {
      this.between(() => createEnemy(sim, this.world, 'archer', me.x + Math.sin(me.yaw) * 8, me.z + Math.cos(me.yaw) * 8, me.yaw + Math.PI));
      return;
    }
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
        case 'henchman':
          return this.addHenchman(me);
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

  /** The open rings and how long the party has held one; take it once they have held it long enough. */
  private stepPortal(step: number): void {
    const rings = portalsFor(this.world, this.sim);
    const on = this.remotes.size === 0 ? -1 : rings.findIndex((ring) => partyOnPortal(this.sim, ring));
    if (on !== this.heldRing) this.portalHeld = 0;
    this.heldRing = on;
    if (on < 0) return;
    this.portalHeld = Math.min(PORTAL_HOLD_S, this.portalHeld + step);
    if (this.portalHeld >= PORTAL_HOLD_S && !this.portalTaken) {
      this.portalTaken = true;
      this.onPortal(rings[on].to);
    }
  }

  /** What the snapshot says about the open rings. */
  private portalStates(): PortalState[] {
    return portalsFor(this.world, this.sim).map((ring, i) => ({ x: ring.x, y: ring.y, z: ring.z, radius: ring.radius, held: i === this.heldRing ? this.portalHeld : 0, to: ring.to, label: this.ringLabel(ring.to) }));
  }

  /** The words over a ring: where it leads. */
  private ringLabel(to: PortalTo): string {
    if (to === 'dungeon') return this.choice ? choiceLabel(this.choice) : (this.destination?.name ?? 'A new dungeon');
    return to === 'deeper' ? 'Deeper' : 'Home';
  }

  /** Change the sim between ticks, keeping any events it raises. */
  private between(fn: () => void): void {
    const before = this.sim.events.length;
    fn();
    this.outbox.push(...this.sim.events.splice(before));
  }

  private sendSnapshot(): void {
    const acks: Record<string, number> = {};
    for (const r of this.remotes.values()) acks[r.id] = r.slots.ack;
    const msg: ToPeer = { k: 'snap', s: { ...this.sim, events: [] }, acks, ev: this.outbox, scale: this.timeScale(), portals: this.portalStates() };
    this.send(msg);
    this.outbox = [];
  }
}
