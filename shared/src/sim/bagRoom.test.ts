import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import { readLoadout } from '../net/validate';
import { bagRoomOf, materialSpaces, roomFor, type BagRoom } from './bagRoom';
import { addPlayer, type Loadout } from './coop';
import { emptyMods } from './gear';
import { stepLoot } from './smash';
import { emptyTalents } from './talents';
import type { FloorLoot } from './floorRun';
import { createSimState } from './world';

/** Lumber and stone in the bag (Michael, 31 Oct, A): stacks of 50, and a full bag leaves them on the floor. */

const base: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const level = floorLevel({ seed: 202, pieces: 18, floor: 1, floors: 3 });
const world = buildWorld(level);
const kept = { inBag: tuning.loop.materialsInBag, enemies: tuning.debug.enemiesEnabled };
afterEach(() => {
  tuning.loop.materialsInBag = kept.inBag;
  tuning.debug.enemiesEnabled = kept.enemies;
});

const piece = (id: number, kind: FloorLoot['kind'], x: number, z: number): FloorLoot => ({ id, kind, amount: kind === 'coin' ? 5 : 1, x, y: 0, z, fromX: x, fromZ: z, at: -10 });

/** One hero standing on `n` pieces of `kind`, with this bag room (or none). */
function standOn(kind: FloorLoot['kind'], n: number, bagRoom?: BagRoom) {
  tuning.debug.enemiesEnabled = false;
  const s = createSimState(level, [], world);
  const p = addPlayer(s, world, 'p1', bagRoom ? { ...base, bagRoom } : base, false);
  s.floor!.loot = Array.from({ length: n }, (_, i) => piece(i, kind, p.x, p.z));
  for (const d of s.floor!.loot) d.y = p.y;
  stepLoot(s);
  return { s, p, taken: s.events.filter((e) => e.kind === 'lootTaken').length };
}

describe('lumber and stone in the bag', () => {
  it('counts stacks of 50 a space, topping up a part-filled stack first', () => {
    expect(materialSpaces({ lumber: 0, stone: 0 })).toBe(0);
    expect(materialSpaces({ lumber: 50, stone: 1 })).toBe(2);
    expect(materialSpaces({ lumber: 51, stone: 0 })).toBe(2);
    expect(bagRoomOf(10, { lumber: 30, stone: 0 })).toEqual({ spaces: 9, lumber: 20, stone: 0 });
    const room = { spaces: 1, lumber: 1, stone: 0 };
    expect(roomFor(room, 'lumber')).toBe(true);
    expect(room).toEqual({ spaces: 1, lumber: 0, stone: 0 });
    expect(roomFor(room, 'stone')).toBe(true);
    expect(room).toEqual({ spaces: 0, lumber: 0, stone: 49 });
    expect(roomFor(room, 'lumber')).toBe(false);
  });

  it('a full bag leaves lumber on the floor; coin is still taken', () => {
    const full = standOn('lumber', 3, { spaces: 0, lumber: 0, stone: 0 });
    expect(full.taken).toBe(0);
    expect(full.s.floor!.loot).toHaveLength(3);
    expect(full.s.floor!.found.lumber).toBe(0);
    expect(standOn('coin', 2, { spaces: 0, lumber: 0, stone: 0 }).taken).toBe(2);
  });

  it('a bag with two units of room takes two and leaves the third', () => {
    const r = standOn('stone', 3, { spaces: 0, lumber: 0, stone: 2 });
    expect(r.taken).toBe(2);
    expect(r.s.floor!.loot).toHaveLength(1);
    expect(r.s.floor!.found.stone).toBe(2);
    expect(r.p.bagRoom).toEqual({ spaces: 0, lumber: 0, stone: 0 });
  });

  it('an empty space opens a new stack of 50', () => {
    const r = standOn('lumber', 3, { spaces: 1, lumber: 0, stone: 0 });
    expect(r.taken).toBe(3);
    expect(r.p.bagRoom).toEqual({ spaces: 0, lumber: 47, stone: 0 });
  });

  it('no room sent, or the switch off, takes everything as before', () => {
    expect(standOn('lumber', 3).taken).toBe(3);
    tuning.loop.materialsInBag = false;
    expect(standOn('lumber', 3, { spaces: 0, lumber: 0, stone: 0 }).taken).toBe(3);
  });

  it('a loadout carries whole room within a bag, or is refused', () => {
    expect(readLoadout({ ...base, bagRoom: { spaces: 4, lumber: 10, stone: 0 } })?.bagRoom).toEqual({ spaces: 4, lumber: 10, stone: 0 });
    expect(readLoadout({ ...base, bagRoom: { spaces: 99, lumber: 0, stone: 0 } })).toBeNull();
    expect(readLoadout({ ...base, bagRoom: { spaces: 1, lumber: -1, stone: 0 } })).toBeNull();
    expect(readLoadout(base)?.bagRoom).toBeUndefined();
  });
});
