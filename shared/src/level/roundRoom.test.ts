import { describe, expect, it } from 'vitest';
import { buildWorld } from './arena';
import { floorLevel, insidePiece, nearBlock, openMiddle, walkRoute } from './floor';
import { sphereCast } from './geometry';
import { CELL, DOOR_W, KIT, WALL_T } from './kit';
import { rectDistance } from './setPieces';

// G5's B, Michael's C (4 Nov), the second set piece: the round chamber, a 4 x 4 cell room whose
// corners are stepped masonry, so its floor is a circle every doorway opens into.

const def = KIT.round;
const SIZE = def.w * CELL;
const C = SIZE / 2;
const R = C - WALL_T;
const blocks = def.blocks!;

describe('the round chamber (G5 B)', () => {
  it('leaves the whole circle open: no block reaches inside it', () => {
    for (const b of blocks) expect(rectDistance(b, C, C)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  it('is round: just outside the circle is masonry, except in front of a doorway', () => {
    // A slice that overlaps a doorway (with 0.3 m spare) is left out whole, and a slice is 0.8 m.
    const doorSpan = (side: string, along: number) =>
      def.sockets.some((sk) => sk.side === side && Math.abs(along - (sk.at * CELL + CELL / 2)) < DOOR_W / 2 + 0.3 + 0.8);
    let checked = 0;
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const x = C + Math.cos(a) * (R + 0.85);
      const z = C + Math.sin(a) * (R + 0.85);
      if (x < WALL_T || x > SIZE - WALL_T || z < WALL_T || z > SIZE - WALL_T) continue;
      if (doorSpan('n', x) || doorSpan('s', x) || doorSpan('w', z) || doorSpan('e', z)) continue;
      expect(blocks.some((b) => rectDistance(b, x, z) < 1e-6), `${deg} degrees`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('turns up on generated floors, its spawn spots, props and torches clear of the masonry, its routes open, never with lava', () => {
    let rounds = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const level = floorLevel({ seed, pieces: 24, floor: 2, floors: 3 });
      const layout = level.dungeon!;
      const world = buildWorld(level);
      for (const p of layout.pieces.filter((pp) => pp.kind === 'round')) {
        rounds++;
        expect(p.blocks.length).toBe(blocks.length);
        expect(world.colliders.filter((c) => c.id.startsWith(`wall-${p.id}-block-`)).length).toBe(blocks.length);
        const mid = { x: (p.inner.minX + p.inner.maxX) / 2, z: (p.inner.minZ + p.inner.maxZ) / 2 };
        for (const sp of p.spots) {
          expect(Math.hypot(sp.x - mid.x, sp.z - mid.z)).toBeLessThan(R);
          expect(nearBlock(p, sp.x, sp.z, 1.39)).toBe(false);
        }
        expect(p.spots.length).toBeGreaterThan(20);
        for (const pr of layout.props.filter((pp) => pp.piece === p.id)) expect(nearBlock(p, pr.x, pr.z, 0.5)).toBe(false);
        for (const t of layout.torches.filter((tt) => insidePiece(p, tt.x, tt.z, -0.1))) expect(nearBlock(p, t.x, t.z, 0.25)).toBe(false);
        expect(layout.lava.some((l) => l.piece === p.id)).toBe(false);
        expect(openMiddle(p)).toEqual(mid);
      }
      // The bots' way through the floor never runs into the masonry.
      const masonry = world.colliders.filter((c) => /-block-/.test(c.id));
      const route = walkRoute(layout, layout.def.entrance, layout.def.exit);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1];
        const b = route[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.1 || !masonry.length) continue;
        const hit = sphereCast({ x: a.x, y: 0.5, z: a.z }, { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len }, len, 0.4, masonry, () => true);
        expect(hit, `seed ${seed} leg ${i}`).toBeGreaterThanOrEqual(len - 1e-6);
      }
    }
    expect(rounds).toBeGreaterThan(15);
  });
});
