import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { arena, buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import { rollGear, type GearItem } from './catalogue';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { SimEvent } from './types';

// These pin P1's rest-room bank and D7's full heal, kept behind loop.bankAtRest and dungeon.restHeal;
// Michael's 31 Oct A (no heal, banking only at home or a win) is restRoomStakes.test.ts.
const restKept = { bankAtRest: tuning.loop.bankAtRest, restHeal: tuning.dungeon.restHeal };
beforeEach(() => {
  tuning.loop.bankAtRest = true;
  tuning.dungeon.restHeal = 1;
});
afterAll(() => {
  tuning.loop.bankAtRest = restKept.bankAtRest;
  tuning.dungeon.restHeal = restKept.restHeal;
});

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const find = (id: string): GearItem => ({ uid: '', id, rarity: 'common', perk: null, bonus: null });

function session(spec: FloorSpec | null) {
  const world = buildWorld(spec ? floorLevel(spec) : arena);
  const host = new HostSession(world, () => {}, true);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const events: SimEvent[] = [];
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) events.push(...host.tick());
  };
  const p = (id: string) => host.sim.players.find((pl) => pl.id === id)!;
  /** Lay a find at a player's feet, old enough to be picked up. */
  const drop = (id: string, item = find('bronze-sword')) => {
    const pl = p(id);
    host.sim.drops.push({ id: host.sim.nextId++, owner: id, x: pl.x, y: pl.y, z: pl.z, age: 1, item });
  };
  const rest = () => {
    const layout = world.level.dungeon!;
    const room = layout.pieces[layout.def.exit];
    const mid = openMiddle(room);
    for (const [i, pl] of host.sim.players.entries()) {
      pl.x = mid.x + i;
      pl.z = mid.z;
      pl.y = room.y;
    }
    tick();
  };
  return { world, host, events, tick, p, drop, rest };
}

const kept = { ...tuning.loop };
afterEach(() => Object.assign(tuning.loop, kept));

describe('the loop’s stakes and rewards (P1)', () => {
  const spec: FloorSpec = { seed: 202, pieces: 18, floor: 1, floors: 3 };

  it('carries a find picked up on a floor instead of handing it over', () => {
    const s = session(spec);
    s.drop('p1');
    s.tick();
    expect(s.events).toContainEqual(expect.objectContaining({ kind: 'pickup', playerId: 'p1', carried: true }));
    expect(s.host.sim.floor!.carried.p1).toHaveLength(1);
    // The slice's arena still hands it over at once.
    const a = session(null);
    a.drop('p1');
    a.tick();
    const pickup = a.events.find((e) => e.kind === 'pickup');
    expect(pickup).toBeDefined();
    expect(pickup).not.toHaveProperty('carried');
  });

  it('banks what each player carries in the rest room, with coin for the rooms cleared', () => {
    const s = session(spec);
    s.drop('p1');
    s.tick();
    // A find still on the ground for p2 is banked too.
    s.drop('p2', find('oak-shortbow'));
    s.p('p2').x += 30;
    const fights = s.world.level.dungeon!.pieces.filter((pc) => pc.fight && pc.kind !== 'boss');
    s.host.sim.floor!.cleared.push(fights[0].id, fights[1].id);
    s.rest();
    const banked = s.events.filter((e) => e.kind === 'banked');
    expect(banked).toHaveLength(2);
    const l = tuning.loop;
    expect(banked[0]).toMatchObject({ playerId: 'p1', coin: 2 * l.coinPerRoom, lumber: 2 * l.lumberPerRoom, stone: 2 * l.stonePerRoom, floor: 1 });
    // p1's find was carried, so the browser holds it already (D3): banked as kept, not handed over again.
    expect((banked[0] as Extract<SimEvent, { kind: 'banked' }>).items).toHaveLength(0);
    expect((banked[0] as Extract<SimEvent, { kind: 'banked' }>).kept).toBe(1);
    expect((banked[1] as Extract<SimEvent, { kind: 'banked' }>).items.map((i) => (i as GearItem).id)).toEqual(['oak-shortbow']);
    expect(s.host.sim.floor!.carried).toEqual({});
    expect(s.host.sim.drops).toEqual([]);
    // Banked once: staying in the rest room pays nothing more.
    s.tick(10);
    expect(s.events.filter((e) => e.kind === 'banked')).toHaveLength(2);
  });

  it('banks the henchmen’s XP with the floor (P12), and says nothing of henchmen when there are none', () => {
    const plain = session(spec);
    plain.rest();
    expect((plain.events.find((e) => e.kind === 'banked') as Extract<SimEvent, { kind: 'banked' }>).hench).toBeUndefined();
    const s = session(spec);
    const h = s.host.addHenchman(s.p('p1'), 'bow', { xp: 1234.5 })!;
    s.rest();
    const b = s.events.find((e) => e.kind === 'banked') as Extract<SimEvent, { kind: 'banked' }>;
    expect(b.hench).toEqual([{ style: 'bow', xp: Math.floor(h.xp.bow) }]);
  });

  it('pays more for each floor deeper', () => {
    const deeper = session({ ...spec, floor: 3, floors: 4 });
    const fight = deeper.world.level.dungeon!.pieces.find((pc) => pc.fight && pc.kind !== 'boss')!;
    deeper.host.sim.floor!.cleared.push(fight.id);
    deeper.rest();
    const b = deeper.events.find((e) => e.kind === 'banked') as Extract<SimEvent, { kind: 'banked' }>;
    expect(b.coin).toBe(Math.round(tuning.loop.coinPerRoom * (1 + 2 * tuning.loop.depthBonus)));
    expect(b.floor).toBe(3);
    // And a rare is that much likelier: a roll that misses on floor 1 hits deeper.
    const roll = () => 0.36;
    expect(rollGear(roll, false, 1).rarity).toBe('common');
    expect(rollGear(roll, false, 1 + 2 * tuning.loop.depthBonus).rarity).toBe('rare');
  });

  it('loses what was not banked when the party wipes', () => {
    const s = session(spec);
    s.drop('p1');
    s.tick();
    s.drop('p2');
    s.p('p2').x += 30;
    s.host.sim.floor!.room = s.world.level.dungeon!.pieces.find((pc) => pc.fight)!.id;
    s.host.sim.run.phase = 'wave';
    for (const pl of s.host.sim.players) pl.mode = 'down';
    s.tick();
    expect(s.host.sim.run.phase).toBe('lost');
    expect(s.events.filter((e) => e.kind === 'findsLost')).toEqual([
      { kind: 'findsLost', playerId: 'p1', count: 1 },
      { kind: 'findsLost', playerId: 'p2', count: 1 },
    ]);
    expect(s.events.some((e) => e.kind === 'banked' || (e.kind === 'pickup' && !e.carried))).toBe(false);
    expect(s.host.sim.floor!.carried).toEqual({});
    // D5: the server tells each browser its bag is gone, all but the safe pocket.
    expect(s.events.filter((e) => e.kind === 'bagLost')).toEqual([
      { kind: 'bagLost', playerId: 'p1' },
      { kind: 'bagLost', playerId: 'p2' },
    ]);
  });

  it('gives up a leaver’s carried finds, so whoever takes their place starts with none', () => {
    const s = session(spec);
    s.drop('p2');
    s.tick();
    expect(s.host.sim.floor!.carried.p2).toHaveLength(1);
    s.host.onPeerLeft('b');
    expect(s.host.sim.floor!.carried.p2).toBeUndefined();
  });
});
