import { describe, expect, it } from 'vitest';
import { HostSession } from '../game/HostSession';
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
import { checkDungeon, readDungeon, type HandDungeon } from './handmade';
import { village } from './village';

const cellar = DUNGEONS.find((d) => d.name === 'The Old Cellar')!;
const without = (d: HandDungeon, kind: string): HandDungeon => ({ ...d, pieces: d.pieces.filter((p) => p.kind !== kind) });

describe('hand-built dungeons (T4b)', () => {
  it('ships dungeons that are all playable floors', () => {
    expect(DUNGEONS.length).toBeGreaterThan(0);
    for (const d of DUNGEONS) expect(checkDungeon(d).errors).toEqual([]);
  });

  it('joins doorways that face each other at one height, as the generator does', () => {
    const { def } = checkDungeon(cellar);
    const links = def!.pieces.reduce((n, p) => n + p.sockets.filter((sk) => sk.link >= 0).length, 0) / 2;
    expect(links).toBe(cellar.pieces.length - 1);
    expect(def!.pieces[def!.entrance].kind).toBe('entrance');
    expect(def!.pieces[def!.exit].kind).toBe('rest');
    // The entrance sits on the grid's origin, as a generated floor's does.
    expect([def!.pieces[def!.entrance].gx, def!.pieces[def!.entrance].gz]).toEqual([0, 0]);
  });

  it('says what is missing or wrong, in words', () => {
    expect(checkDungeon(without(cellar, 'entrance')).errors.join(' ')).toMatch(/entrance/);
    expect(checkDungeon(without(cellar, 'rest')).errors.join(' ')).toMatch(/rest room/);
    // Take the staircase out: the room above can no longer be reached.
    expect(checkDungeon(without(cellar, 'stair')).errors.join(' ')).toMatch(/can’t be reached/);
    const stacked = { ...cellar, pieces: [...cellar.pieces, { kind: 'hall' as const, gx: 0, gz: 0, rot: 0, level: 0 }] };
    expect(checkDungeon(stacked).errors.join(' ')).toMatch(/overlaps/);
    // A staircase turned the wrong way meets its room at another height: walled up, and the room cut off.
    const flipped = { ...cellar, pieces: cellar.pieces.map((p) => (p.kind === 'stair' ? { ...p, rot: 2 } : p)) };
    const f = checkDungeon(flipped);
    expect(f.def).toBeNull();
    expect(f.notes.join(' ')).toMatch(/another height/);
  });

  it('reads only clean layouts from outside: whole numbers on the grid, known pieces, a short name', () => {
    expect(readDungeon({ name: 'x', pieces: [{ kind: 'dragon', gx: 0, gz: 0, rot: 0, level: 0 }] })).toBeNull();
    expect(readDungeon({ name: 'x', pieces: [{ kind: 'hall', gx: 0.5, gz: 0, rot: 0, level: 0 }] })).toBeNull();
    expect(readDungeon({ name: 'x', pieces: [{ kind: 'hall', gx: 999, gz: 0, rot: 0, level: 0 }] })).toBeNull();
    expect(readDungeon({ name: 'x', pieces: new Array(51).fill({ kind: 'hall', gx: 0, gz: 0, rot: 0, level: 0 }) })).toBeNull();
    expect(readDungeon({ name: '<b>' + 'a'.repeat(80), pieces: [] })!.name.length).toBeLessThanOrEqual(32);
  });

  it('plays as a floor: a hero walks it from the entrance to the rest room, up its staircase', () => {
    const level = floorLevel({ seed: 0, pieces: cellar.pieces.length, floor: 1, floors: 3, hand: cellar });
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

  it('starts a run: the hand-built floor first, then generated ones (or that floor alone if it ends at the Warden)', () => {
    const plan = planRun([], 7, cellar);
    expect(floorSpecFor(plan, 1).hand).toEqual(cellar);
    expect(floorSpecFor(plan, 2).hand).toBeUndefined();
    expect(plan.floors).toBe(3);
    const boss: HandDungeon = { ...cellar, pieces: cellar.pieces.map((p) => (p.kind === 'rest' ? { ...p, kind: 'boss' as const } : p)) };
    // The Warden's hall is bigger than the rest room; only its exit kind matters to the plan.
    expect(planRun([], 7, boss).floors).toBe(1);
    // From a room's create options (a browser's): checked, and dropped if it is not a floor.
    expect(readRunPlan({ seed: 3, hand: cellar }).hand).toEqual(cellar);
    expect(readRunPlan({ seed: 3, hand: without(cellar, 'entrance') }).hand).toBeUndefined();
  });

  it('is what Keeper Wren sends the village: the ring then leads there, and a broken layout is dropped', () => {
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
    expect(ask(without(cellar, 'rest'))).toBeNull();
    expect(host.destination?.name).toBe('The Old Cellar');
    expect(ask(null)).not.toBeNull();
    expect(host.destination).toBeNull();
  });
});
