import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { createPlayer, stepPlayer } from '../sim/player';
import { idleCommand, type SimState } from '../sim/types';
import { createSimState } from '../sim/world';
import { buildWorld, groundHeight, type World } from './arena';
import { floorLevel, insidePiece, walkRoute } from './floor';
import { generateFloor, loopCount, type FloorDef, type FloorSpec } from './generate';
import type { Collider } from './geometry';
import { resolveCircle } from './geometry';
import { OPPOSITE, SIDE_DIR } from './kit';

/** The gate's five floors (T4): small to large, each its own seed. */
const SPECS: FloorSpec[] = [
  { seed: 101, pieces: 10, floor: 1, floors: 3 },
  { seed: 202, pieces: 18, floor: 2, floors: 3 },
  { seed: 303, pieces: 28, floor: 3, floors: 3 },
  { seed: 404, pieces: 40, floor: 1, floors: 5 },
  { seed: 505, pieces: 50, floor: 5, floors: 5 },
];

function distances(def: FloorDef, from: number): number[] {
  const dist = def.pieces.map(() => Infinity);
  dist[from] = 0;
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const sk of def.pieces[p].sockets) if (sk.link >= 0 && dist[sk.link] === Infinity) queue.push(sk.link), (dist[sk.link] = dist[p] + 1);
  }
  return dist;
}

function boxesOverlap(a: Collider, b: Collider): boolean {
  if (a.kind !== 'box' || b.kind !== 'box') return false;
  const e = 1e-6;
  return (
    a.min.x < b.max.x - e && b.min.x < a.max.x - e && a.min.y < b.max.y - e && b.min.y < a.max.y - e && a.min.z < b.max.z - e && b.min.z < a.max.z - e
  );
}

function cylinderInBox(c: Collider, b: Collider): boolean {
  if (c.kind !== 'cylinder' || b.kind !== 'box') return false;
  const cx = Math.max(b.min.x, Math.min(c.x, b.max.x));
  const cz = Math.max(b.min.z, Math.min(c.z, b.max.z));
  return Math.hypot(c.x - cx, c.z - cz) < c.radius - 1e-6;
}

/** Is (x, z) open ground for a hero, at the height the floor has there? */
function open(world: World, x: number, z: number): boolean {
  const pos = { x, z };
  const y = groundHeight(world, x, z);
  resolveCircle(pos, tuning.movement.radius, y + 0.3, y + 1.8, world.colliders);
  return Math.hypot(pos.x - x, pos.z - z) < 1e-6;
}

describe('the dungeon generator (T4)', () => {
  const floors = SPECS.map((spec) => ({ spec, def: generateFloor(spec), level: floorLevel(spec) }));

  it('gives the same floor for the same spec, and a different shape for each seed', () => {
    for (const { spec, def } of floors) expect(JSON.stringify(generateFloor(spec))).toBe(JSON.stringify(def));
    const shapes = floors.map(({ def }) => def.pieces.map((p) => `${p.kind}@${p.gx},${p.gz}/${p.rot}`).join(' '));
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('makes 10 to 50 pieces, near what was asked', () => {
    for (const { spec, def } of floors) {
      expect(def.pieces.length).toBeGreaterThanOrEqual(Math.max(10, spec.pieces - 3));
      expect(def.pieces.length).toBeLessThanOrEqual(Math.min(50, spec.pieces + 2));
    }
  });

  it('reaches every piece from the entrance, the exit far from it', () => {
    for (const { spec, def } of floors) {
      const dist = distances(def, def.entrance);
      expect(dist.every((d) => d < Infinity)).toBe(true);
      expect(dist[def.exit]).toBeGreaterThanOrEqual(3);
      expect(def.pieces[def.exit].kind).toBe(spec.floor >= spec.floors ? 'boss' : 'rest');
    }
  });

  it('joins doorways face to face at one height, never two pieces in one cell', () => {
    for (const { def } of floors) {
      const cells = new Set<string>();
      for (const p of def.pieces) {
        for (let x = 0; x < p.w; x++)
          for (let z = 0; z < p.d; z++) {
            const k = `${p.gx + x},${p.gz + z}`;
            expect(cells.has(k)).toBe(false);
            cells.add(k);
          }
        for (const sk of p.sockets) {
          if (sk.link < 0) continue;
          const other = def.pieces[sk.link].sockets[sk.linkSocket];
          expect(other.link).toBe(p.id);
          expect(other.side).toBe(OPPOSITE[sk.side]);
          expect(other.level).toBe(sk.level);
          expect(other.cx).toBe(sk.cx + SIDE_DIR[sk.side].x);
          expect(other.cz).toBe(sk.cz + SIDE_DIR[sk.side].z);
        }
      }
    }
  });

  it('branches and loops: never one corridor', () => {
    for (const { spec, def } of floors) {
      const links = def.pieces.map((p) => p.sockets.filter((sk) => sk.link >= 0).length);
      expect(Math.max(...links)).toBeGreaterThanOrEqual(3);
      if (spec.pieces >= 14) expect(loopCount(def)).toBeGreaterThanOrEqual(1);
      // No hall that leads nowhere.
      for (const p of def.pieces) if (['hall', 'hallLong', 'corner', 'tee', 'cross', 'stair'].includes(p.kind)) expect(links[p.id]).toBeGreaterThanOrEqual(2);
    }
  });

  it('climbs or drops: a staircase joins pieces at two heights', () => {
    for (const { def } of floors) {
      const stairs = def.pieces.filter((p) => p.kind === 'stair' && p.sockets.every((sk) => sk.link >= 0));
      expect(stairs.length).toBeGreaterThanOrEqual(1);
      expect(new Set(def.pieces.map((p) => p.level)).size).toBeGreaterThanOrEqual(2);
      expect(Math.min(...def.pieces.map((p) => p.level))).toBe(0);
    }
  });

  it('builds colliders that never overlap, even with a fight room shut', () => {
    for (const { level } of floors) {
      const world = buildWorld(level);
      const solid = (cs: readonly Collider[]) => cs.filter((c) => c.blocksMovement);
      const all = solid(world.colliders);
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          if (boxesOverlap(all[i], all[j]) || cylinderInBox(all[i], all[j]) || cylinderInBox(all[j], all[i])) throw new Error(`${all[i].id} overlaps ${all[j].id}`);
        }
      for (const room of level.dungeon!.pieces.filter((p) => p.fight)) {
        const gates = solid(world.roomColliders![room.id]).filter((c) => c.id.startsWith('gate-'));
        expect(gates.length).toBe(room.doors.filter((d) => d.open).length);
        for (const g of gates) for (const c of all) expect(boxesOverlap(g, c)).toBe(false);
      }
    }
  });

  it('leaves every doorway open and level, and every fight room room to spawn', () => {
    for (const { level } of floors) {
      const world = buildWorld(level);
      const pieces = level.dungeon!.pieces;
      expect(open(world, level.spawn.x, level.spawn.z)).toBe(true);
      for (const p of pieces) {
        for (const d of p.doors.filter((dd) => dd.open)) {
          expect(open(world, d.x, d.z)).toBe(true);
          expect(groundHeight(world, d.x, d.z)).toBeCloseTo(d.y, 6);
        }
        if (p.fight) expect(p.spots.length).toBeGreaterThanOrEqual(4);
        for (const s of p.spots) {
          expect(open(world, s.x, s.z)).toBe(true);
          expect(groundHeight(world, s.x, s.z)).toBeCloseTo(p.y, 6);
        }
      }
    }
  });

  it('can be walked from the entrance to the exit by a hero in the sim, up and down the stairs', () => {
    for (const { def, level } of floors) {
      const world = buildWorld(level);
      const pieces = level.dungeon!.pieces;
      const state: SimState = createSimState(level, [], world);
      const hero = createPlayer('p1', level.spawn.x, level.spawn.z, 0);
      hero.y = groundHeight(world, hero.x, hero.z);
      state.players.push(hero);
      const points = walkRoute(level.dungeon!, def.entrance, def.exit);
      let climbed = 0;
      let dropped = 0;
      for (const pt of points) {
        let t = 0;
        const y0 = hero.y;
        while (Math.hypot(pt.x - hero.x, pt.z - hero.z) > 0.5) {
          const dx = pt.x - hero.x;
          const dz = pt.z - hero.z;
          const len = Math.hypot(dx, dz);
          stepPlayer(hero, { ...idleCommand(), moveX: dx / len, moveZ: dz / len, aimX: dx / len, aimZ: dz / len }, 1 / 60, world, state);
          if (++t > 60 * 20) throw new Error(`seed ${def.spec.seed}: stuck at (${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}) on the way to (${pt.x.toFixed(1)}, ${pt.z.toFixed(1)})`);
        }
        if (hero.y > y0 + 1) climbed++;
        if (hero.y < y0 - 1) dropped++;
      }
      expect(insidePiece(pieces[def.exit], hero.x, hero.z)).toBe(true);
      expect(hero.y).toBeCloseTo(pieces[def.exit].y, 3);
      // A big floor always has a staircase (the generator forces one), though the way through may go round it;
      // when the exit stands at another height than the way in, the walk climbed or dropped to get there.
      if (def.pieces.length >= 25) expect(def.pieces.some((p) => p.kind === 'stair')).toBe(true);
      if (Math.abs(pieces[def.exit].y - pieces[def.entrance].y) > 1) expect(climbed + dropped).toBeGreaterThanOrEqual(1);
    }
  });
});

