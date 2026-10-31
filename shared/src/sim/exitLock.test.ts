import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld } from '../level/arena';
import { floorLevel, insidePiece } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { SIDE_DIR } from '../level/kit';
import { clearsLeft } from './floorRun';
import { stepPlayer } from './player';
import { idleCommand } from './types';
import { createSimState, worldNow } from './world';

// Michael, 31 Oct (A): at least one fight room cleared before the rest room's or the Warden's door
// opens, two from floor 3, and the count on the door. Rushing past the rest stays a choice.

const kept = { ...tuning.dungeon };
afterEach(() => Object.assign(tuning.dungeon, kept));

function floor(spec: FloorSpec) {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const state = createSimState(level, ['p1'], world);
  const layout = level.dungeon!;
  const exit = layout.pieces[layout.def.exit];
  const fights = layout.pieces.filter((p) => p.fight && p.kind !== 'boss' && p.id !== exit.id);
  /** Start just outside the way out's doorway and run in for a second and a half. */
  const runIn = () => {
    const door = exit.doors.find((d) => d.open)!;
    const out = SIDE_DIR[door.side];
    const p = state.players[0];
    Object.assign(p, { x: door.x + out.x * 1.5, z: door.z + out.z * 1.5, y: door.y, vx: 0, vz: 0, mode: 'move' });
    for (let i = 0; i < 90; i++) stepPlayer(p, { ...idleCommand(), moveX: -out.x, moveZ: -out.z }, 1 / 60, worldNow(world, state), state);
    return insidePiece(exit, p.x, p.z);
  };
  return { world, state, exit, fights, runIn };
}

describe('the way out waits for a fight (Michael, 31 Oct)', () => {
  it('keeps the rest room shut until one fight room is cleared on floor 1', () => {
    const f = floor({ seed: 202, pieces: 18, floor: 1, floors: 3 });
    expect(f.exit.kind).toBe('rest');
    expect(f.fights.length).toBeGreaterThan(1);
    expect(clearsLeft(f.world, f.state)).toBe(1);
    expect(f.runIn()).toBe(false);
    f.state.floor!.cleared.push(f.fights[0].id);
    expect(clearsLeft(f.world, f.state)).toBe(0);
    expect(f.runIn()).toBe(true);
  });

  it('asks two from floor 3, and never more than the floor has', () => {
    const f = floor({ seed: 202, pieces: 18, floor: 3, floors: 4 });
    expect(clearsLeft(f.world, f.state)).toBe(Math.min(2, f.fights.length));
    f.state.floor!.cleared.push(f.fights[0].id);
    expect(clearsLeft(f.world, f.state)).toBe(Math.min(2, f.fights.length) - 1);
    tuning.dungeon.clearsBeforeExitDeep = 99;
    expect(clearsLeft(f.world, f.state)).toBe(f.fights.length - 1);
    tuning.dungeon.clearsBeforeExitDeep = 0;
    expect(clearsLeft(f.world, f.state)).toBe(0);
  });

  it('shuts the Warden’s hall the same way', () => {
    const f = floor({ seed: 202, pieces: 18, floor: 3, floors: 3 });
    expect(f.exit.kind).toBe('boss');
    expect(f.runIn()).toBe(false);
    for (const p of f.fights.slice(0, 2)) f.state.floor!.cleared.push(p.id);
    expect(f.runIn()).toBe(true);
  });
});
