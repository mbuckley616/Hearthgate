import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { PORTAL_HOLD_S, portalsFor, type PortalTo } from '../game/portal';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import type { GearItem } from './catalogue';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { SimEvent } from './types';

// Michael, 31 Oct (A): the rest room is the way out only. No heal; finds, coin, lumber, stone and the
// henchmen's XP stay carried from floor to floor and bank at the gold ring home or a win.

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const find = (id: string): GearItem => ({ uid: '', id, rarity: 'common', perk: null, bonus: null });
type Banked = Extract<SimEvent, { kind: 'banked' }>;

function session(spec: FloorSpec) {
  const world = buildWorld(floorLevel(spec));
  const taken: PortalTo[] = [];
  const sent: SimEvent[] = [];
  const host = new HostSession(world, (m) => (m.k === 'snap' ? sent.push(...m.ev) : undefined), true, (to) => taken.push(to));
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const events: SimEvent[] = [];
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) events.push(...host.tick());
  };
  const p = (id: string) => host.sim.players.find((pl) => pl.id === id)!;
  const drop = (id: string, item = find('bronze-sword')) => {
    const pl = p(id);
    host.sim.drops.push({ id: host.sim.nextId++, owner: id, x: pl.x, y: pl.y, z: pl.z, age: 1, item });
  };
  const rest = () => {
    const layout = world.level.dungeon!;
    const room = layout.pieces[layout.def.exit];
    const mid = openMiddle(room);
    for (const [i, pl] of host.sim.players.entries()) Object.assign(pl, { x: mid.x + i, z: mid.z, y: room.y });
    tick();
  };
  /** Stand the party in the ring that leads `to` until it is taken. */
  const take = (to: PortalTo) => {
    const ring = portalsFor(world, host.sim).find((r) => r.to === to)!;
    expect(ring).toBeDefined();
    for (const pl of host.sim.players) Object.assign(pl, { x: ring.x, z: ring.z, y: ring.y });
    tick(Math.ceil(PORTAL_HOLD_S * tuning.sim.tickRate) + 2);
  };
  const fights = () => world.level.dungeon!.pieces.filter((pc) => pc.fight && pc.kind !== 'boss');
  return { world, host, taken, sent, events, tick, p, drop, rest, take, fights };
}

describe('the rest room is the way out, not a vault (Michael, 31 Oct)', () => {
  const spec: FloorSpec = { seed: 202, pieces: 18, floor: 1, floors: 3 };

  it('heals nothing and banks nothing on arrival', () => {
    expect(tuning.loop.bankAtRest).toBe(false);
    expect(tuning.dungeon.restHeal).toBe(0);
    const s = session(spec);
    s.drop('p1');
    s.tick();
    s.p('p1').hp = 30;
    s.host.sim.floor!.cleared.push(s.fights()[0].id);
    s.rest();
    expect(s.events.some((e) => e.kind === 'rested')).toBe(true);
    expect(s.events.some((e) => e.kind === 'banked')).toBe(false);
    expect(s.p('p1').hp).toBe(30);
    expect(s.host.sim.floor!.carried.p1).toHaveLength(1);
  });

  it('banks the whole floor at the gold ring, before the hand-off and in a snapshot sent first', () => {
    const s = session(spec);
    s.drop('p1');
    s.tick();
    s.drop('p2', find('oak-shortbow'));
    s.p('p2').x += 30;
    s.host.sim.floor!.cleared.push(s.fights()[0].id, s.fights()[1].id);
    s.host.sim.floor!.found.lumber = 5;
    s.rest();
    s.take('village');
    expect(s.taken).toEqual(['village']);
    const banked = s.events.filter((e): e is Banked => e.kind === 'banked');
    expect(banked).toHaveLength(2);
    const l = tuning.loop;
    expect(banked[0]).toMatchObject({ playerId: 'p1', kept: 1, coin: 2 * l.coinPerRoom, lumber: 2 * l.lumberPerRoom + 5 });
    expect(banked[1].items.map((i) => (i as GearItem).id)).toEqual(['oak-shortbow']);
    expect(s.sent.filter((e) => e.kind === 'banked')).toHaveLength(2);
    // A hand-off that failed and a ring taken again pays nothing twice.
    s.host.reopenPortal();
    for (const pl of s.host.sim.players) pl.x += 10;
    s.tick();
    s.take('village');
    expect(s.events.filter((e) => e.kind === 'banked')).toHaveLength(2);
  });

  it('carries the floor deeper: ground finds picked up, the purse handed on and banked with the next floor', () => {
    const s = session(spec);
    s.drop('p2', find('oak-shortbow'));
    s.p('p2').x += 30;
    s.host.sim.floor!.cleared.push(s.fights()[0].id);
    s.rest();
    s.take('deeper');
    expect(s.taken).toEqual(['deeper']);
    expect(s.events.some((e) => e.kind === 'banked')).toBe(false);
    expect(s.events).toContainEqual(expect.objectContaining({ kind: 'pickup', playerId: 'p2', carried: true }));
    const purse = s.host.runPurse()!;
    expect(purse.coin).toBe(tuning.loop.coinPerRoom);

    const next = session({ ...spec, floor: 2 });
    next.host.receivePurse(purse);
    next.rest();
    expect(next.events.some((e) => e.kind === 'banked')).toBe(false);
    next.take('village');
    const b = next.events.find((e): e is Banked => e.kind === 'banked')!;
    expect(b.coin).toBe(tuning.loop.coinPerRoom);
    expect(b.floor).toBe(2);
  });

  it('loses the purse from the floors before with a wipe', () => {
    const s = session({ ...spec, floor: 2 });
    s.host.receivePurse({ coin: 40, lumber: 8, stone: 6 });
    s.host.sim.floor!.room = s.fights()[0].id;
    s.host.sim.run.phase = 'wave';
    for (const pl of s.host.sim.players) pl.mode = 'down';
    s.tick();
    expect(s.host.sim.run.phase).toBe('lost');
    expect(s.host.sim.floor!.purse).toBeUndefined();
    expect(s.events.some((e) => e.kind === 'banked')).toBe(false);
  });
});
