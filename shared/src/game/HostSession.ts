import { applyTuningEdit, tuningEdits } from '../config/edits';
import { STYLES, tuning, type Style } from '../config/tuning';
import type { World } from '../level/arena';
import type { HandDungeon } from '../level/handmade';
import { choiceLabel, type PortalChoice } from './portalChoice';
import { HIRES, henchmanCard, henchmanCommand, type HenchmanCard } from '../sim/henchman';
import { emptyMods, xpForLevel } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { PROTOCOL_VERSION, slotPlayerId, type Cheat, type ToHost, type ToPeer } from '../net/protocol';
import { addPlayer, applyLoadout, removePlayer, slotsOpen } from '../sim/coop';
import { refreshLevelHealth } from '../sim/player';
import { dropFromBag } from '../sim/drops';
import { createEnemy, spawnGroup } from '../sim/enemies';
import { restartRun, skipToWave } from '../sim/run';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '../sim/types';
import { createSimState, stepSim } from '../sim/world';
import { createSlots, nextSlotCommand, receiveInputs, type SlotConfig, type Slots } from './inputSlots';
import { PORTAL_HOLD_S, partyOnPortal, portalsFor, type PortalState, type PortalTo } from './portal';
import { leaveFloor, runPurse, type Purse } from '../sim/floorRun';

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
  /**
   * The portal was taken and the room is moving the party; it fires once until reopenPortal(), or
   * until nobody is on a ring any more: a village outlives its runs, so the party gone (or off the
   * ring) must leave it ready for their return.
   */
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
      // A friend joining a full party takes a henchman's slot (P10); only a party of players is full.
      if (this.sim.players.length >= tuning.coop.maxPlayers) {
        const hench = [...this.sim.players].reverse().find((p) => p.henchman);
        if (!hench) return send({ k: 'refused', reason: 'The party is full' });
        this.between(() => removePlayer(this.sim, hench.id));
      }
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
        // Between runs a change of gear comes with full health; on a floor the phase is ante between fights
        // too, so wearing something there was a free heal (playtest, 29 Oct).
        applyLoadout(p, l, this.sim.run.phase === 'ante' && !this.sim.floor);
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
      case 'hire':
      case 'dismiss':
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
   * A henchman joins the party (P3: a debug cheat until the tavern hires them, P10): at the level of
   * the hero who asked, beside them, with the next free name, and (P6) the next kit in turn, a sword,
   * a bow, a staff, unless one is asked for. Not past the party's size.
   */
  addHenchman(beside: PlayerState | undefined, style?: Style, card?: Partial<HenchmanCard>): PlayerState | null {
    const sim = this.sim;
    if (sim.players.length >= tuning.coop.maxPlayers) return null;
    const n = sim.players.filter((p) => p.henchman).length;
    const kit: Style = style ?? card?.style ?? STYLES[n % STYLES.length];
    const name = card?.name ?? HIRES[kit].name;
    const best = card?.xp ?? (beside ? Math.max(beside.xp.sword, beside.xp.bow, beside.xp.staff) : 0);
    let id = 'h1';
    for (let i = 1; sim.players.some((p) => p.id === id); i++) id = `h${i}`;
    const xp = { sword: 0, bow: 0, staff: 0, [kit]: best };
    const h = addPlayer(sim, this.world, id, { name, xp, talents: emptyTalents(), mods: emptyMods(), maxHp: tuning.combat.heroMaxHp }, false);
    h.henchman = true;
    h.style = kit;
    // Its health follows the level of its own kit, which is set only now (healthPerLevel).
    refreshLevelHealth(h);
    h.hp = h.maxHp;
    if (card?.quick || card?.cap) h.brain = { threat: -1, seenAt: 0, answered: -1, guardUntil: -1, ...(card.quick ? { quick: true } : {}), ...(card.cap ? { cap: card.cap } : {}) };
    return h;
  }

  /**
   * The Tavern's word on its henchmen (P12): the cap a tier sets, and for each kit the XP it has banked.
   * Hires in the village come back at what they banked, so a wipe loses what a run earned since.
   */
  settleHenchmen(cap: number, banked: Partial<Record<Style, number>>, quick: boolean): void {
    for (const h of this.sim.players) {
      if (!h.henchman) continue;
      h.brain = { ...(h.brain ?? { threat: -1, seenAt: 0, answered: -1, guardUntil: -1 }), cap };
      if (quick) h.brain.quick = true;
      h.xp = { sword: 0, bow: 0, staff: 0, [h.style]: Math.min(banked[h.style] ?? 0, xpForLevel(cap)) };
    }
  }

  /** The party's henchmen as they travel to the next room (P10), taken out of this one. */
  takeHenchmen(): HenchmanCard[] {
    const hench = this.sim.players.filter((p) => p.henchman);
    this.between(() => {
      for (const h of hench) removePlayer(this.sim, h.id);
    });
    return hench.map(henchmanCard);
  }

  /** Henchmen arriving with their party from another room (P10). */
  receiveHenchmen(cards: readonly HenchmanCard[]): void {
    this.between(() => {
      for (const c of cards) this.addHenchman(this.sim.players.find((p) => !p.henchman), c.style, c);
    });
  }

  /** A henchman let go (P10), by kit. */
  dismissHenchman(kit: Style): boolean {
    const h = this.sim.players.find((p) => p.henchman && p.style === kit);
    if (h) this.between(() => removePlayer(this.sim, h.id));
    return !!h;
  }

  /** The hero a peer plays, if they have joined. */
  playerOf(peer: string): PlayerState | undefined {
    const r = this.remotes.get(peer);
    return r ? this.sim.players.find((p) => p.id === r.id) : undefined;
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

  /** What the run carries to the next floor (Michael, 31 Oct): nothing once this floor has banked. */
  runPurse(): Purse | null {
    if (!this.sim.floor || this.sim.floor.home) return null;
    return runPurse(this.sim, this.world);
  }

  /** The purse the floors before this one handed on (the room's, from the hand-off). */
  receivePurse(purse: Purse): void {
    if (this.sim.floor) this.sim.floor.purse = { ...purse };
  }

  /** The open rings and how long the party has held one; take it once they have held it long enough. */
  private stepPortal(step: number): void {
    const rings = portalsFor(this.world, this.sim);
    const on = this.remotes.size === 0 ? -1 : rings.findIndex((ring) => partyOnPortal(this.sim, ring));
    if (on !== this.heldRing) this.portalHeld = 0;
    this.heldRing = on;
    if (on < 0) {
      this.portalTaken = false;
      return;
    }
    this.portalHeld = Math.min(PORTAL_HOLD_S, this.portalHeld + step);
    if (this.portalHeld >= PORTAL_HOLD_S && !this.portalTaken) {
      this.portalTaken = true;
      const to = rings[on].to;
      if (to !== 'dungeon' && this.sim.floor) {
        // Off a floor the run banks at the gold ring, or picks up what lies about for deeper
        // (Michael, 31 Oct). The events stay in this tick's (the room credits the village from
        // them) and a snapshot carries them now, ahead of the hand-off.
        const before = this.sim.events.length;
        leaveFloor(this.sim, this.world, to);
        if (this.sim.events.length > before) {
          this.outbox.push(...this.sim.events.slice(before));
          this.sendSnapshot();
        }
      }
      this.onPortal(to);
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
