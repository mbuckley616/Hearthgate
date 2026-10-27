import { describe, expect, it } from 'vitest';
import { HostSession } from '../game/HostSession';
import { portalsFor } from '../game/portal';
import { floorSpecFor, planRun, readRunPlan } from '../game/runPlan';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
import { emptyMods } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand } from '../sim/types';
import { createSimState } from '../sim/world';
import { buildWorld, groundHeight } from './arena';
import { floorLevel, insidePiece, walkRoute } from './floor';
import { DUNGEONS } from './dungeons';
import { checkDungeon, checkHandDungeon, handFloor, readDungeon, type HandDungeon, type HandFloor } from './handmade';
import { village } from './village';

const cellar = DUNGEONS.find((d) => d.name === 'The Old Cellar')!;
const first: HandFloor = handFloor(cellar, 1);
const without = (f: HandFloor, kind: string): HandFloor => ({ ...f, pieces: f.pieces.filter((p) => p.kind !== kind) });
/** The cellar with its first floor changed. */
const withFirst = (f: HandFloor): HandDungeon => ({ ...cellar, floors: [{ pieces: f.pieces }, ...cellar.floors.slice(1)] });

describe('hand-built dungeons (T4b)', () => {
  it('ships dungeons that are all playable, floor by floor', () => {
    expect(DUNGEONS.length).toBeGreaterThan(0);
    for (const d of DUNGEONS) expect(checkHandDungeon(d)).toMatchObject({ errors: [], playable: true });
    expect(cellar.floors).toHaveLength(2);
  });

  it('joins doorways that face each other at one height, as the generator does', () => {
    const { def } = checkDungeon(first);
    const links = def!.pieces.reduce((n, p) => n + p.sockets.filter((sk) => sk.link >= 0).length, 0) / 2;
    expect(links).toBe(first.pieces.length - 1);
    expect(def!.pieces[def!.entrance].kind).toBe('entrance');
    expect(def!.pieces[def!.exit].kind).toBe('rest');
    // The entrance sits on the grid's origin, as a generated floor's does.
    expect([def!.pieces[def!.entrance].gx, def!.pieces[def!.entrance].gz]).toEqual([0, 0]);
  });

  it('says what is missing or wrong, in words', () => {
    expect(checkDungeon(without(first, 'entrance')).errors.join(' ')).toMatch(/entrance/);
    expect(checkDungeon(without(first, 'rest')).errors.join(' ')).toMatch(/rest room/);
    // Take the staircase out: the room above can no longer be reached.
    expect(checkDungeon(without(first, 'stair')).errors.join(' ')).toMatch(/can’t be reached/);
    const stacked = { ...first, pieces: [...first.pieces, { kind: 'hall' as const, gx: 0, gz: 0, rot: 0, level: 0 }] };
    expect(checkDungeon(stacked).errors.join(' ')).toMatch(/overlaps/);
    // A staircase turned the wrong way meets its room at another height: walled up, and the room cut off.
    const flipped = { ...first, pieces: first.pieces.map((p) => (p.kind === 'stair' ? { ...p, rot: 2 } : p)) };
    const f = checkDungeon(flipped);
    expect(f.def).toBeNull();
    expect(f.notes.join(' ')).toMatch(/another height/);
  });

  it('lets only the last floor end at the Warden', () => {
    const swapped: HandDungeon = { ...cellar, floors: [...cellar.floors].reverse() };
    const c = checkHandDungeon(swapped);
    expect(c.playable).toBe(false);
    expect(c.errors.join(' ')).toMatch(/Floor 1 ends at the Warden’s hall/);
    // One broken floor stops the whole dungeon.
    expect(checkHandDungeon(withFirst(without(first, 'entrance'))).playable).toBe(false);
  });

  it('reads only clean dungeons from outside: whole numbers on the grid, known pieces, a short name, at most five floors', () => {
    const floor = (pieces: unknown[]) => ({ name: 'x', floors: [{ pieces }] });
    expect(readDungeon(floor([{ kind: 'dragon', gx: 0, gz: 0, rot: 0, level: 0 }]))).toBeNull();
    expect(readDungeon(floor([{ kind: 'hall', gx: 0.5, gz: 0, rot: 0, level: 0 }]))).toBeNull();
    expect(readDungeon(floor([{ kind: 'hall', gx: 999, gz: 0, rot: 0, level: 0 }]))).toBeNull();
    expect(readDungeon(floor(new Array(51).fill({ kind: 'hall', gx: 0, gz: 0, rot: 0, level: 0 })))).toBeNull();
    expect(readDungeon({ name: 'x', floors: new Array(6).fill({ pieces: [] }) })).toBeNull();
    expect(readDungeon({ name: 'x', floors: [] })).toBeNull();
    expect(readDungeon({ name: '<b>' + 'a'.repeat(80), floors: [{ pieces: [] }] })!.name.length).toBeLessThanOrEqual(32);
    // A one-floor file from before floors still opens.
    expect(readDungeon({ name: 'Old', pieces: first.pieces })).toEqual({ name: 'Old', floors: [{ pieces: first.pieces }] });
  });

  it('plays as a floor: a hero walks it from the entrance to the rest room, up its staircase', () => {
    const level = floorLevel({ seed: 0, pieces: first.pieces.length, floor: 1, floors: 2, hand: first });
    const world = buildWorld(level);
    const layout = level.dungeon!;
    const state = createSimState(level, ['p1'], world);
    const hero = state.players[0];
    expect(insidePiece(layout.pieces[layout.def.entrance], hero.x, hero.z)).toBe(true);
    for (const pt of walkRoute(layout, layout.def.entrance, layout.def.exit)) {
      for (let t = 0; Math.hypot(pt.x - hero.x, pt.z - hero.z) > 0.5; t++) {
        const dx = pt.x - hero.x;
        const dz = pt.z - hero.z;
        const len = Math.hypot(dx, dz);
        stepPlayer(hero, { ...idleCommand(), moveX: dx / len, moveZ: dz / len, aimX: dx / len, aimZ: dz / len }, 1 / 60, world, state);
        if (t > 1200) throw new Error(`stuck at ${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`);
      }
    }
    expect(insidePiece(layout.pieces[layout.def.exit], hero.x, hero.z)).toBe(true);
    expect(hero.y).toBeCloseTo(groundHeight(world, hero.x, hero.z), 5);
    expect(hero.y).toBeGreaterThan(2);
  });

  it('runs exactly its floors: deeper to the next, and a last rest room leads only home', () => {
    const plan = planRun([], 7, cellar);
    expect(plan.floors).toBe(2);
    expect(floorSpecFor(plan, 1).hand).toEqual(handFloor(cellar, 1));
    expect(floorSpecFor(plan, 2).hand).toEqual(handFloor(cellar, 2));
    expect(floorSpecFor(plan, 2).floors).toBe(2);
    const rings = (d: HandDungeon, n: number) => {
      const world = buildWorld(floorLevel(floorSpecFor(planRun([], 1, d), n)));
      return portalsFor(world, createSimState(world.level, [], world)).map((r) => r.to);
    };
    expect(rings(cellar, 1)).toEqual(['deeper', 'village']);
    // The first floor alone, as a dungeon of one floor: its rest room has only the way home.
    expect(rings({ ...cellar, floors: [cellar.floors[0]] }, 1)).toEqual(['village']);
    // From a room's create options (a browser's): checked, and dropped if any floor is not playable.
    expect(readRunPlan({ seed: 3, hand: cellar }).hand).toEqual(cellar);
    expect(readRunPlan({ seed: 3, hand: withFirst(without(first, 'entrance')) }).hand).toBeUndefined();
  });

  it('is what Keeper Wren sends the village: the ring then leads there, and a broken dungeon is dropped', () => {
    const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    const host = new HostSession(buildWorld(village), () => {});
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    const ask = (dungeon: unknown) => {
      const msg = readToHost({ k: 'destination', dungeon });
      if (msg) host.onMessage('a', msg);
      return msg;
    };
    expect(ask(cellar)).not.toBeNull();
    expect(host.destination?.name).toBe('The Old Cellar');
    expect(ask(withFirst(without(first, 'rest')))).toBeNull();
    expect(host.destination?.name).toBe('The Old Cellar');
    expect(ask(null)).not.toBeNull();
    expect(host.destination).toBeNull();
  });
});
