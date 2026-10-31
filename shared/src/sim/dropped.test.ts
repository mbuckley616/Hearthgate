import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld, type LevelDef } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import { village } from '../level/village';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import type { GearItem } from './catalogue';
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
const sword: GearItem = { uid: 'u1', id: 'bronze-sword', rarity: 'common', perk: null, bonus: null };

function session(level: LevelDef) {
  const world = buildWorld(level);
  const host = new HostSession(world, () => {});
  const events: SimEvent[] = [];
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) events.push(...host.tick());
  };
  const [p1, p2] = host.sim.players;
  return { host, events, tick, p1, p2 };
}

describe('dropping an item to the floor (D13)', () => {
  it('lays it at the feet, for its owner alone, taken back only after stepping away', () => {
    const s = session(village);
    s.host.onMessage('a', { k: 'drop', item: sword });
    expect(s.host.sim.drops).toHaveLength(1);
    const d = s.host.sim.drops[0];
    expect(d.owner).toBe(s.p1.id);
    expect(Math.hypot(d.x - s.p1.x, d.z - s.p1.z)).toBeLessThan(0.01);
    // Standing on it, nothing happens; a friend standing on it takes nothing either.
    s.p2.x = d.x;
    s.p2.z = d.z;
    s.tick(90);
    expect(s.host.sim.drops).toHaveLength(1);
    // Away and back: it comes back as it was, not as a find.
    s.p1.x += 5;
    s.tick(2);
    s.p1.x = d.x;
    s.tick(60);
    expect(s.host.sim.drops).toHaveLength(0);
    const picked = s.events.filter((e) => e.kind === 'pickup');
    expect(picked).toEqual([{ kind: 'pickup', playerId: s.p1.id, item: sword }]);
  });

  it('on a floor is neither banked nor carried, and stays when the rest room banks', () => {
    const s = session(floorLevel({ seed: 202, pieces: 18, floor: 1, floors: 3 }));
    const level = s.host.sim;
    s.host.onMessage('a', { k: 'drop', item: sword });
    const world = floorLevel({ seed: 202, pieces: 18, floor: 1, floors: 3 });
    const rest = world.dungeon!.pieces[world.dungeon!.def.exit];
    const at = openMiddle(rest);
    for (const p of level.players) {
      p.x = at.x;
      p.z = at.z;
      p.y = rest.y;
    }
    s.tick(1);
    const banked = s.events.filter((e) => e.kind === 'banked' && e.playerId === s.p1.id);
    expect(banked).toHaveLength(1);
    expect(banked[0].kind === 'banked' && banked[0].items).toEqual([]);
    expect(level.drops).toHaveLength(1);
    expect(level.floor!.carried[s.p1.id] ?? []).toEqual([]);
  });

  it('keeps at most gear.maxDropped a player, the oldest going first', () => {
    const s = session(village);
    for (let i = 0; i < tuning.gear.maxDropped + 2; i++) s.host.onMessage('a', { k: 'drop', item: { ...sword, uid: `u${i}` } });
    const mine = s.host.sim.drops.filter((d) => d.owner === s.p1.id);
    expect(mine).toHaveLength(tuning.gear.maxDropped);
    expect((mine[0].item as GearItem).uid).toBe('u2');
  });

  it('refuses an item that is not the catalogue’s, or a bonus no roll could give', () => {
    expect(readToHost({ k: 'drop', item: sword })).toEqual({ k: 'drop', item: sword });
    expect(readToHost({ k: 'drop', item: { ...sword, id: 'excalibur' } })).toBeNull();
    expect(readToHost({ k: 'drop', item: { ...sword, rarity: 'legendary' } })).toBeNull();
    expect(readToHost({ k: 'drop', item: { ...sword, bonus: { kind: 'damage', value: 9 } } })).toBeNull();
    expect(readToHost({ k: 'drop', item: { ...sword, bonus: { kind: 'damage', value: 0.12 } } })).not.toBeNull();
  });
});
