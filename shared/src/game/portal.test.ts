import { describe, expect, it } from 'vitest';
import { arena, buildWorld } from '../level/arena';
import { village } from '../level/village';
import { PROTOCOL_VERSION } from '../net/protocol';
import { emptyMods } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand } from '../sim/types';
import { HostSession } from './HostSession';
import { ARENA_EXIT_PORTAL, PORTAL_HOLD_S, partyOnPortal, portalFor } from './portal';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function session(world: ReturnType<typeof buildWorld>) {
  let taken = 0;
  const host = new HostSession(world, () => {}, true, () => taken++);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  return { host, taken: () => taken };
}

describe('the village (T3)', () => {
  const world = buildWorld(village);

  it('never starts a run, whoever walks where', () => {
    const { host } = session(world);
    for (const p of host.sim.players) p.z = -20;
    for (let i = 0; i < 600; i++) host.tick();
    expect(host.sim.run.phase).toBe('ante');
    expect(host.sim.enemies).toHaveLength(0);
  });

  it('its buildings and well are solid', () => {
    const { host } = session(world);
    const p = host.sim.players[0];
    p.x = 6;
    p.z = -2.5;
    // Run east into the General Store (its west face is at x = 11), clear of its door at z = -5, which leads inside.
    for (let i = 0; i < 240; i++) stepPlayer(p, { ...idleCommand(), moveX: 1, aimX: 1 }, 1 / 60, world, host.sim);
    expect(p.x).toBeLessThan(11);
    expect(p.x).toBeGreaterThan(10);
  });

  it(`hands the party on once everyone standing has held the ring for ${PORTAL_HOLD_S} s, and only then`, () => {
    const { host, taken } = session(world);
    const ring = portalFor(world, host.sim)!;
    const [a, b] = host.sim.players;
    a.x = ring.x;
    a.z = ring.z;
    for (let i = 0; i < 180; i++) host.tick();
    expect(taken()).toBe(0); // b is still at the spawn
    b.x = ring.x + 1;
    b.z = ring.z;
    expect(partyOnPortal(host.sim, ring)).toBe(true);
    for (let i = 0; i < PORTAL_HOLD_S * 60 - 2; i++) host.tick();
    expect(taken()).toBe(0);
    for (let i = 0; i < 4; i++) host.tick();
    expect(taken()).toBe(1);
    for (let i = 0; i < 120; i++) host.tick();
    expect(taken()).toBe(1); // once, until the room reopens it
    host.reopenPortal();
    for (let i = 0; i < PORTAL_HOLD_S * 60 + 2; i++) host.tick();
    expect(taken()).toBe(2);
  });

  it('can be taken again by a party home from its run (the village outlives it)', () => {
    const { host, taken } = session(world);
    const ring = portalFor(world, host.sim)!;
    const stand = () => {
      for (const [i, p] of host.sim.players.entries()) {
        p.x = ring.x + i;
        p.z = ring.z;
      }
    };
    stand();
    for (let i = 0; i < PORTAL_HOLD_S * 60 + 2; i++) host.tick();
    expect(taken()).toBe(1);
    // Handed on: both leave the room while still standing in the ring.
    host.onPeerLeft('a');
    host.onPeerLeft('b');
    for (let i = 0; i < 30; i++) host.tick();
    // Home from the run, they come back and stand in it again.
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    stand();
    for (let i = 0; i < PORTAL_HOLD_S * 60 + 2; i++) host.tick();
    expect(taken()).toBe(2);
  });

  it('cheats do nothing in the village', () => {
    const { host } = session(world);
    host.onMessage('a', { k: 'cheat', cheat: 'warden' });
    expect(host.sim.enemies).toHaveLength(0);
  });
});

describe('the arena’s way home', () => {
  const world = buildWorld(arena);

  it('opens in the antechamber only when the run is won or lost', () => {
    const { host } = session(world);
    expect(portalFor(world, host.sim)).toBeNull();
    host.sim.run.phase = 'wave';
    expect(portalFor(world, host.sim)).toBeNull();
    host.sim.run.phase = 'won';
    expect(portalFor(world, host.sim)).toMatchObject({ ...ARENA_EXIT_PORTAL, to: 'village' });
    host.sim.run.phase = 'lost';
    expect(portalFor(world, host.sim)).toMatchObject({ ...ARENA_EXIT_PORTAL, to: 'village' });
  });

  it('a downed player does not hold the party back, and nobody standing does not take it', () => {
    const { host } = session(world);
    const [a, b] = host.sim.players;
    a.x = ARENA_EXIT_PORTAL.x;
    a.z = ARENA_EXIT_PORTAL.z;
    b.x = 0;
    b.z = 0;
    b.mode = 'down';
    expect(partyOnPortal(host.sim, ARENA_EXIT_PORTAL)).toBe(true);
    a.mode = 'down';
    expect(partyOnPortal(host.sim, ARENA_EXIT_PORTAL)).toBe(false);
  });
});
