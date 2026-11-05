import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld } from '../level/arena';
import { floorLevel, insidePiece } from '../level/floor';
import { CRUMBLE_SIZE } from '../level/traps';
import { resolveCircle } from '../level/geometry';
import { createEnemy } from './enemies';
import { floorWorldNow } from './floorRun';
import { crumbleFallsAfter, stepTraps } from './traps';
import { createSimState } from './world';
import { SNAP_M, placedBy, placedEaseM } from '../game/Session';

// G5, a collapsing tile (Michael's B, 4 Nov): it shakes once a hero steps on it, then falls away; a
// fall costs a quarter of a hero's health and puts them back at the edge, an enemy on it is gone, and
// the hole stays for the floor as a wall.

const kept = { ...tuning.traps };
afterEach(() => Object.assign(tuning.traps, kept));

function crumblingFloor() {
  for (let seed = 1; seed < 300; seed++) {
    const level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    const layout = level.dungeon!;
    if (!layout.crumble.length) continue;
    const world = buildWorld(level);
    const state = createSimState(level, ['p1'], world);
    const p = state.players[0];
    return { level, layout, world, state, p, tile: layout.crumble[0] };
  }
  throw new Error('no collapsing tile in 300 seeds');
}

const DT = 1 / 60;
function step(f: ReturnType<typeof crumblingFloor>, n: number) {
  for (let i = 0; i < n; i++) {
    stepTraps(f.state, f.world, DT);
    f.state.time += DT;
  }
}
const fallTicks = () => Math.ceil(crumbleFallsAfter() / DT) + 1;

describe('collapsing tiles (G5)', () => {
  it('lie in fight rooms only, inside the walls, clear of doorways and spawn spots, and the same every time', () => {
    let tiles = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const spec = { seed, pieces: 24, floor: 2, floors: 3 };
      const layout = floorLevel(spec).dungeon!;
      tiles += layout.crumble.length;
      expect(floorLevel(spec).dungeon!.crumble).toEqual(layout.crumble);
      for (const t of layout.crumble) {
        const p = layout.pieces[t.piece];
        expect(p.fight).toBe(true);
        expect(p.kind).not.toBe('boss');
        expect(layout.spikes.some((s) => s.piece === p.id)).toBe(false);
        expect(insidePiece(p, t.x, t.z)).toBe(true);
        for (const d of p.doors.filter((dd) => dd.open)) expect(Math.hypot(d.x - t.x, d.z - t.z)).toBeGreaterThan(CRUMBLE_SIZE + 2);
        for (const sp of p.spots) expect(Math.abs(sp.x - t.x) > CRUMBLE_SIZE / 2 || Math.abs(sp.z - t.z) > CRUMBLE_SIZE / 2).toBe(true);
      }
    }
    expect(tiles).toBeGreaterThan(10);
  });

  it('shakes when a hero steps on it and falls after the shake and the lag grace, taking a quarter of their health and putting them at the edge', () => {
    const f = crumblingFloor();
    Object.assign(f.p, { x: f.tile.x + 0.3, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move', invulnTime: 0, invulnerable: false });
    const hp = f.p.hp;
    step(f, 1);
    expect(f.state.events).toContainEqual({ kind: 'tileCracked', x: f.tile.x, z: f.tile.z });
    expect(f.state.floor!.crumbling).toHaveLength(1);
    step(f, Math.floor(tuning.traps.crumbleShakeS / DT));
    expect(f.state.floor!.fallen).toEqual([]);
    step(f, fallTicks());
    expect(f.state.floor!.fallen).toEqual([0]);
    expect(f.p.hp).toBeCloseTo(hp - f.p.maxHp * tuning.traps.crumbleHeroFrac, 5);
    expect(f.p.x).toBeCloseTo(f.tile.x + CRUMBLE_SIZE / 2 + 0.6, 5);
  });

  it('spares a hero who stepped off in time, and takes an enemy left on it', () => {
    const f = crumblingFloor();
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    const hp = f.p.hp;
    step(f, 1);
    f.p.x = f.tile.x + CRUMBLE_SIZE;
    const e = createEnemy(f.state, f.world, 'grunt', f.tile.x, f.tile.z, 0);
    Object.assign(e, { x: f.tile.x, z: f.tile.z, ai: 'chase' });
    step(f, fallTicks());
    expect(f.p.hp).toBe(hp);
    expect(e.ai).toBe('dead');
    expect(f.state.events.filter((ev) => ev.kind === 'tileFell')).toEqual([{ kind: 'tileFell', x: f.tile.x, z: f.tile.z, caught: 1, put: [] }]);
  });

  it('stays a hole for the floor, a wall nobody walks into, and never shakes again', () => {
    const f = crumblingFloor();
    const before = floorWorldNow(f.world, f.state).colliders.length;
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    step(f, fallTicks() + 1);
    const w = floorWorldNow(f.world, f.state);
    expect(w.colliders.length).toBe(before + 1);
    // Walking into the middle of the hole ends outside it.
    const pos = { x: f.tile.x + 0.2, z: f.tile.z };
    resolveCircle(pos, tuning.movement.radius, f.tile.y + 0.3, f.tile.y + 1.8, w.colliders);
    expect(Math.abs(pos.x - f.tile.x) > CRUMBLE_SIZE / 2 || Math.abs(pos.z - f.tile.z) > CRUMBLE_SIZE / 2).toBe(true);
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z });
    f.state.events = [];
    step(f, 1);
    expect(f.state.events.some((ev) => ev.kind === 'tileCracked')).toBe(false);
    expect(f.state.floor!.fallen).toEqual([0]);
  });

  it('does nothing with traps off', () => {
    const f = crumblingFloor();
    tuning.traps.enabled = false;
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    step(f, fallTicks());
    expect(f.state.floor?.fallen ?? []).toEqual([]);
  });

  it("names whoever it put back, so their browser eases the jump instead of snapping (critic, 5 Nov)", () => {
    const f = crumblingFloor();
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move', invulnTime: 0, invulnerable: false });
    step(f, 1);
    f.state.events = [];
    step(f, fallTicks());
    expect(f.state.events.find((ev) => ev.kind === 'tileFell')).toMatchObject({ put: ['p1'] });
    expect(placedBy(f.state.events, 'p1')).toBe(true);
    expect(placedBy(f.state.events, 'p2')).toBe(false);
    // The critic's falls: the hero predicted on across the tile for a round trip came back 2.73 to 2.85 m.
    // A sprint across the whole tile and on for a 300 ms round trip still eases.
    const putBack = CRUMBLE_SIZE / 2 + 0.6;
    const predicted = CRUMBLE_SIZE / 2 + tuning.movement.sprintSpeed * 0.3;
    expect(putBack + predicted).toBeGreaterThan(SNAP_M);
    expect(putBack + predicted).toBeLessThan(placedEaseM());
  });

  it('names nobody when the tile falls empty', () => {
    const f = crumblingFloor();
    Object.assign(f.p, { x: f.tile.x, z: f.tile.z, y: f.tile.y, grounded: true, mode: 'move' });
    step(f, 1);
    f.p.x = f.tile.x + CRUMBLE_SIZE * 2;
    f.state.events = [];
    step(f, fallTicks());
    expect(placedBy(f.state.events, 'p1')).toBe(false);
  });
});
