import { beforeEach, describe, expect, it } from 'vitest';
import { tuning, tuningDefaults } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { PROTOCOL_VERSION, type ToPeer } from '../net/protocol';
import type { Loadout } from '../sim/coop';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerCommand } from '../sim/types';
import { HostSession, MAX_QUEUE, STALE_TICKS } from './HostSession';

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

describe('the input queue (the slice host’s jitter cushion)', () => {
  beforeEach(() => hello('a'));

  it('waits for coop.inputBufferTicks inputs before using any, then applies one a tick and acks it', () => {
    expect(tuning.coop.inputBufferTicks).toBe(2);
    input('a', 1, 1);
    host.tick();
    expect(host.ackOf('a')).toBe(0);
    input('a', 2, 2);
    host.tick();
    expect(host.ackOf('a')).toBe(1);
    host.tick();
    expect(host.ackOf('a')).toBe(2);
    // Ran dry: the cushion refills before the next one is used.
    host.tick();
    input('a', 3, 3);
    host.tick();
    expect(host.ackOf('a')).toBe(2);
    input('a', 4, 4);
    host.tick();
    expect(host.ackOf('a')).toBe(3);
  });

  it('drops duplicates and anything already applied', () => {
    input('a', 1, 3);
    input('a', 2, 3);
    expect(host.queuedOf('a')).toBe(3);
    host.tick();
    host.tick();
    input('a', 1, 2);
    expect(host.queuedOf('a')).toBe(1);
  });

  it(`folds a backlog past ${MAX_QUEUE} into one tick, keeping every press`, () => {
    // Eight frames at once (a stalled tab waking): the attack press is in the first.
    input('a', 1, 8, (seq) => cmd({ attack: seq === 1 }));
    host.tick();
    expect(host.ackOf('a')).toBe(8 - MAX_QUEUE + 1);
    expect(host.queuedOf('a')).toBe(MAX_QUEUE - 1);
    expect(player('p1').mode).toBe('attack');
  });

  it(`repeats held buttons through a gap, and lets go after ${STALE_TICKS} quiet ticks`, () => {
    // One input a tick, as a browser sends them, two ahead for the cushion.
    input('a', 1, 2, () => cmd({ moveZ: -1 }));
    for (let seq = 3; seq <= 30; seq++) {
      input('a', seq, seq, () => cmd({ moveZ: -1 }));
      host.tick();
    }
    expect(host.ackOf('a')).toBe(28);
    host.tick();
    host.tick();
    expect(host.ackOf('a')).toBe(30);
    const z0 = player('p1').z;
    for (let i = 0; i < STALE_TICKS; i++) host.tick();
    const z1 = player('p1').z;
    expect(z1).toBeLessThan(z0 - 0.5);
    // Quiet past the limit: the stick is let go, so the hero slows to a stop.
    for (let i = 0; i < 60; i++) host.tick();
    const z2 = player('p1').z;
    host.tick();
    expect(player('p1').z).toBeCloseTo(z2, 6);
    expect(player('p1').vz).toBeCloseTo(0, 6);
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
    expect(s.acks).toEqual({ p1: 4, p2: 0 });
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
