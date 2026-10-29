import { beforeEach, describe, expect, it } from 'vitest';
import { tuning, tuningDefaults } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import { PROTOCOL_VERSION, type ToPeer } from '../net/protocol';
import type { Loadout } from '../sim/coop';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerCommand } from '../sim/types';
import { HostSession, slotConfig } from './HostSession';

const world = buildWorld(arena);
const loadout = (name: string): Loadout => ({ name, xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });
const cmd = (over: Partial<PlayerCommand> = {}): PlayerCommand => ({ ...idleCommand(), aimX: 0, aimZ: -1, ...over });

let sent: { msg: ToPeer; peer?: string }[];
let host: HostSession;
const snaps = () => sent.filter((s) => s.msg.k === 'snap').map((s) => s.msg as Extract<ToPeer, { k: 'snap' }>);
const lastSnap = () => snaps()[snaps().length - 1];
const hello = (peer: string, version = PROTOCOL_VERSION) => host.onMessage(peer, { k: 'hello', version, loadout: loadout(peer) });
const input = (peer: string, from: number, to: number, c: (seq: number) => PlayerCommand = () => cmd()) => {
  const cmds = [];
  for (let seq = from; seq <= to; seq++) cmds.push({ seq, cmd: c(seq) });
  host.onMessage(peer, { k: 'input', cmds });
};
const player = (id: string) => host.sim.players.find((p) => p.id === id)!;

beforeEach(() => {
  Object.assign(tuning.debug, tuningDefaults.debug);
  sent = [];
  host = new HostSession(world, (msg, peer) => sent.push({ msg, peer }));
});

describe('joining', () => {
  it('welcomes a hello with the lowest free slot, its tuning and a snapshot to everyone', () => {
    hello('a');
    expect(sent.map((s) => [s.msg.k, s.peer])).toEqual([
      ['welcome', 'a'],
      ['tuning', 'a'],
      ['snap', undefined],
    ]);
    expect(sent[0].msg).toEqual({ k: 'welcome', id: 'p1' });
    hello('b');
    expect(host.sim.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    host.onPeerLeft('a');
    hello('c');
    expect(host.sim.players.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('refuses another build and a full party', () => {
    hello('old', PROTOCOL_VERSION - 1);
    expect(sent[0].msg.k).toBe('refused');
    for (let i = 0; i < tuning.coop.maxPlayers; i++) hello(`p${i}`);
    sent = [];
    hello('late');
    expect(sent).toEqual([{ msg: { k: 'refused', reason: 'The party is full' }, peer: 'late' }]);
    expect(host.playerCount).toBe(tuning.coop.maxPlayers);
  });

  it('ignores messages from a peer that never said hello', () => {
    input('stranger', 1, 3);
    host.tick();
    expect(host.sim.players).toHaveLength(0);
    expect(host.queuedOf('stranger')).toBe(0);
  });

  it('a leaver is gone from the fight and the next snapshot says so', () => {
    hello('a');
    hello('b');
    host.onPeerLeft('b');
    host.tick();
    host.tick();
    expect(lastSnap().s.players.map((p) => p.id)).toEqual(['p1']);
    expect(lastSnap().ev.some((e) => e.kind === 'playerLeft')).toBe(true);
  });
});

describe('the input slots (T2: each input at its own tick, behind a cushion)', () => {
  beforeEach(() => hello('a'));
  const cfg = slotConfig();

  it(`holds the first input for the cushion (coop.inputBufferTicks), then uses one a tick and acks it`, () => {
    expect(cfg.baseCushion).toBe(2);
    input('a', 1, 1);
    host.tick();
    host.tick();
    expect(host.ackOf('a')).toBe(0);
    for (let seq = 2; seq <= 10; seq++) {
      input('a', seq, seq);
      host.tick();
      expect(host.ackOf('a')).toBe(seq - 1);
    }
  });

  it('drops duplicates and inputs already used', () => {
    input('a', 1, 3);
    input('a', 2, 3);
    expect(host.queuedOf('a')).toBe(3);
    for (let i = 0; i < 4; i++) host.tick();
    input('a', 1, 2);
    expect(host.queuedOf('a')).toBe(1);
  });

  it('stands in for a late input with the held buttons, acks it, and carries its presses when it lands', () => {
    // A browser running north, one input a tick; inputs 10 to 21 are held up by a lost packet,
    // and 15 has an attack press in it.
    const north = (seq: number) => cmd({ moveZ: -1, attack: seq === 15 });
    input('a', 1, 2, north);
    for (let seq = 3; seq <= 22; seq++) {
      if (seq < 10 || seq > 21) input('a', seq, seq, north);
      host.tick();
    }
    const s = host.slotsOf('a')!;
    expect(s.stats.guessed).toBeGreaterThan(0);
    // The stood-in inputs are acked: the browser stops replaying them; the server's ticks for them stand.
    const ackBefore = host.ackOf('a');
    // 20 ticks, less the cushion's two at the start.
    expect(ackBefore).toBe(18);
    expect(player('p1').mode).not.toBe('attack');
    input('a', 10, 21, north);
    expect(s.stats.late).toBeGreaterThan(0);
    expect(s.cushion).toBeGreaterThan(cfg.baseCushion);
    host.tick();
    expect(player('p1').mode).toBe('attack');
  });

  it(`repeats held buttons through a gap, lets go after ${cfg.staleTicks} quiet ticks, and stops acking a stalled player`, () => {
    input('a', 1, 2, () => cmd({ moveZ: -1 }));
    for (let seq = 3; seq <= 30; seq++) {
      input('a', seq, seq, () => cmd({ moveZ: -1 }));
      host.tick();
    }
    // Four more ticks use the four still queued (the cushion held the first two ticks).
    for (let i = 0; i < 4; i++) host.tick();
    expect(host.ackOf('a')).toBe(30);
    const z0 = player('p1').z;
    for (let i = 0; i < cfg.staleTicks; i++) host.tick();
    expect(player('p1').z).toBeLessThan(z0 - 0.5);
    // Quiet past the limit: the stick is let go, so the hero slows to a stop.
    for (let i = 0; i < 60; i++) host.tick();
    const z2 = player('p1').z;
    host.tick();
    expect(player('p1').z).toBeCloseTo(z2, 6);
    expect(player('p1').vz).toBeCloseTo(0, 6);
    // Silent past maxGuess: the acks stopped, so the player's next input is the next one used.
    expect(host.ackOf('a')).toBe(30 + cfg.maxGuess);
    input('a', 31 + cfg.maxGuess, 31 + cfg.maxGuess, () => cmd({ moveX: 1 }));
    host.tick();
    expect(host.ackOf('a')).toBe(31 + cfg.maxGuess);
  });

  it('a stalled player whose missing inputs never come picks up from the first that does', () => {
    input('a', 1, 4, () => cmd({ moveZ: -1 }));
    for (let i = 0; i < 6; i++) host.tick();
    // Silent well past the guesses (a long hitch), then inputs resume with a gap: the ones between never arrive.
    for (let i = 0; i < cfg.maxGuess + 20; i++) host.tick();
    const ack = host.ackOf('a');
    input('a', ack + 30, ack + 33, () => cmd({ moveX: 1 }));
    const x0 = player('p1').x;
    for (let i = 0; i < 4; i++) host.tick();
    expect(host.ackOf('a')).toBe(ack + 33);
    expect(host.slotsOf('a')!.stats.resynced).toBe(1);
    expect(player('p1').x).toBeGreaterThan(x0);
  });

  it('a server running slower than the player never lets the inputs back up past the cushion and a few', () => {
    // The player sends by the wall clock; the server, overloaded, ticks three times for every four inputs.
    let seq = 0;
    for (let t = 0; t < 600; t++) {
      const n = t % 3 === 0 ? 2 : 1;
      input('a', seq + 1, seq + n, () => cmd({ moveZ: -1 }));
      seq += n;
      host.tick();
    }
    const s = host.slotsOf('a')!;
    expect(seq - host.ackOf('a')).toBeLessThanOrEqual(s.cushion + cfg.maxExtra + 2);
    expect(s.stats.folded).toBeGreaterThan(100);
  });

  it('narrows the cushion again after a calm spell', () => {
    const s = host.slotsOf('a')!;
    let seq = 0;
    const feed = (ticks: number, skip?: (q: number) => boolean) => {
      const held: number[] = [];
      for (let i = 0; i < ticks; i++) {
        seq++;
        if (skip?.(seq)) held.push(seq);
        else input('a', seq, seq);
        host.tick();
      }
      for (const q of held) input('a', q, q);
    };
    feed(20);
    feed(12, () => true);
    expect(s.cushion).toBeGreaterThan(cfg.baseCushion + 5);
    const wide = s.cushion;
    feed(cfg.calmTicks * 3);
    expect(s.cushion).toBeLessThan(wide);
    expect(s.stats.narrowed).toBeGreaterThan(0);
    // Every input was used or stood in for, in order: the ack is the last one sent less the cushion.
    expect(host.ackOf('a')).toBe(seq - s.cushion);
  });
});

describe('snapshots', () => {
  it('go to everyone every coop.snapshotEveryTicks ticks, with each player’s ack and the events since the last', () => {
    hello('a');
    hello('b');
    const before = snaps().length;
    input('a', 1, 4);
    for (let i = 0; i < 4; i++) host.tick();
    const every = tuning.coop.snapshotEveryTicks;
    expect(snaps().length - before).toBe(4 / every);
    const s = lastSnap();
    // The cushion holds the first input two ticks, so four ticks use two.
    expect(s.acks).toEqual({ p1: 2, p2: 0 });
    expect(s.scale).toBe(1);
    expect(s.s.events).toEqual([]);
    expect(sent.filter((x) => x.msg.k === 'snap').every((x) => x.peer === undefined)).toBe(true);
    // The join's events went out with the hello's snapshot, never twice.
    const joins = snaps().flatMap((x) => x.ev).filter((e) => e.kind === 'playerJoined');
    expect(joins).toHaveLength(2);
  });

  it('carry the slow-motion scale the server runs at', () => {
    hello('a');
    tuning.debug.slowMo = true;
    host.tick();
    host.tick();
    expect(lastSnap().scale).toBe(tuning.debug.slowMoScale);
    expect(host.timeScale()).toBe(tuning.debug.slowMoScale);
  });
});

describe('what the slice’s host did itself', () => {
  beforeEach(() => hello('a'));

  it('a tuning edit applies when it is a fight value inside its range', () => {
    const was = tuning.movement.runSpeed;
    host.onMessage('a', { k: 'tune', edit: { path: 'movement.runSpeed', value: was + 0.5 } });
    expect(tuning.movement.runSpeed).toBe(was + 0.5);
    host.onMessage('a', { k: 'tune', edit: { path: 'movement.runSpeed', value: 1e9 } });
    host.onMessage('a', { k: 'tune', edit: { path: 'camera.fov', value: 10 } });
    host.onMessage('a', { k: 'tune', edit: { path: 'movement.runSpeed', value: true } });
    expect(tuning.movement.runSpeed).toBe(was + 0.5);
    tuning.movement.runSpeed = was;
  });

  it('cheats do nothing unless the server is a dev build', () => {
    host.onMessage('a', { k: 'cheat', cheat: 'warden' });
    expect(host.sim.run.wave).toBe(0);
    const dev = new HostSession(world, () => {}, true);
    dev.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('a') });
    dev.onMessage('a', { k: 'cheat', cheat: 'warden' });
    expect(dev.sim.run.wave).toBe(4);
    expect(dev.sim.enemies.some((e) => e.kind === 'warden')).toBe(true);
  });

  it('a restart starts a run that is over afresh, and does nothing mid-run', () => {
    host.sim.run.phase = 'wave';
    host.onMessage('a', { k: 'restart' });
    expect(host.sim.run.phase).toBe('wave');
    host.sim.run.phase = 'lost';
    player('p1').hp = 1;
    host.onMessage('a', { k: 'restart' });
    expect(host.sim.run.phase).toBe('ante');
    expect(player('p1').hp).toBe(player('p1').maxHp);
  });
});

describe('a change of gear', () => {
  it('heals in the antechamber between runs, but never on a floor between its fights (playtest, 29 Oct)', () => {
    const arenaHost = new HostSession(world, () => {}, true);
    arenaHost.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('a') });
    const a = arenaHost.sim.players[0];
    a.hp = 40;
    arenaHost.onMessage('a', { k: 'loadout', loadout: loadout('a') });
    expect(a.hp).toBe(a.maxHp);

    const floorHost = new HostSession(buildWorld(floorLevel({ seed: 7, pieces: 14, floor: 1, floors: 3 })), () => {}, true);
    floorHost.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('a') });
    const f = floorHost.sim.players[0];
    expect(floorHost.sim.run.phase).toBe('ante');
    f.hp = 40;
    floorHost.onMessage('a', { k: 'loadout', loadout: loadout('a') });
    expect(f.hp).toBe(40);
  });
});
