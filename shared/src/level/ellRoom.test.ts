import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { addPlayer, type Loadout } from '../sim/coop';
import { createEnemy, stepEnemies } from '../sim/enemies';
import { emptyMods } from '../sim/gear';
import { emptyTalents } from '../sim/talents';
import { createSimState } from '../sim/world';
import { buildWorld } from './arena';
import { floorLevel, insidePiece, nearBlock, openMiddle, walkRoute, type PieceInfo } from './floor';
import { sphereCast } from './geometry';
import { KIT } from './kit';
import { rectDistance } from './setPieces';

// G5's B, Michael's C (4 Nov), the fourth: the L-room, a 4 x 4 cell room with one quarter solid, so a
// fight has a corner to fall back round. Enemies head for its elbow when the corner is in their way.

const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.debug.passiveEnemies;
afterEach(() => {
  tuning.debug.passiveEnemies = kept;
});

const INWARD = { n: { x: 0, z: 1 }, s: { x: 0, z: -1 }, e: { x: -1, z: 0 }, w: { x: 1, z: 0 } };
const inside = (d: PieceInfo['doors'][number], by: number) => ({ x: d.x + INWARD[d.side].x * by, z: d.z + INWARD[d.side].z * by });

/** Is the straight line between two points clear of the masonry by `margin`? */
function clearLine(p: PieceInfo, a: { x: number; z: number }, b: { x: number; z: number }, margin: number): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
  for (let i = 0; i <= n; i++) {
    if (nearBlock(p, a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, margin)) return false;
  }
  return true;
}

function ells(seeds: number) {
  const out: { seed: number; level: ReturnType<typeof floorLevel>; p: PieceInfo }[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    for (const p of level.dungeon!.pieces.filter((pp) => pp.kind === 'ell')) out.push({ seed, level, p });
  }
  return out;
}

describe('the L-room (G5 B)', () => {
  it('is a square with one quarter solid, its doorways all in the open part', () => {
    const def = KIT.ell;
    expect(def.blocks!.length).toBe(1);
    const b = def.blocks![0];
    expect(rectDistance(b, def.elbow!.x, def.elbow!.z)).toBeGreaterThan(2.5);
    for (const sk of def.sockets) {
      // A doorway's middle, a stride in from its wall, is open floor.
      const along = sk.at * 6 + 3;
      const pt = { n: { x: along, z: 1 }, s: { x: along, z: def.d * 6 - 1 }, w: { x: 1, z: along }, e: { x: def.w * 6 - 1, z: along } }[sk.side];
      expect(rectDistance(b, pt.x, pt.z), `${sk.side} ${sk.at}`).toBeGreaterThan(2);
    }
  });

  it('turns up on generated floors with its spots, props and torches clear of the masonry, its elbow seeing every doorway', () => {
    const found = ells(80);
    expect(found.length).toBeGreaterThan(15);
    for (const { seed, level, p } of found) {
      const layout = level.dungeon!;
      const world = buildWorld(level);
      expect(world.colliders.filter((c) => c.id.startsWith(`wall-${p.id}-block-`)).length).toBe(1);
      expect(p.elbow).toBeDefined();
      expect(insidePiece(p, p.elbow!.x, p.elbow!.z, 2)).toBe(true);
      expect(openMiddle(p)).toEqual(p.elbow);
      expect(p.spots.length).toBeGreaterThan(15);
      for (const sp of p.spots) expect(nearBlock(p, sp.x, sp.z, 1.39)).toBe(false);
      for (const pr of layout.props.filter((pp) => pp.piece === p.id)) expect(nearBlock(p, pr.x, pr.z, 0.5)).toBe(false);
      for (const t of layout.torches.filter((tt) => insidePiece(p, tt.x, tt.z, -0.1))) expect(nearBlock(p, t.x, t.z, 0.25)).toBe(false);
      expect(layout.lava.some((l) => l.piece === p.id)).toBe(false);
      expect(layout.daises.some((d) => d.piece === p.id)).toBe(false);
      for (const d of p.doors) expect(clearLine(p, inside(d, 1.5), p.elbow!, 1), `seed ${seed} door ${d.side}`).toBe(true);
      // The bots' way through the floor never runs into the masonry.
      const masonry = world.colliders.filter((c) => /-block-/.test(c.id));
      const route = walkRoute(layout, layout.def.entrance, layout.def.exit);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1];
        const b = route[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.1) continue;
        const hit = sphereCast({ x: a.x, y: 0.5, z: a.z }, { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len }, len, 0.4, masonry, () => true);
        expect(hit, `seed ${seed} leg ${i}`).toBeGreaterThanOrEqual(len - 1e-6);
      }
    }
  });

  it('does not hold an enemy against its corner: a grunt goes round by the elbow to a hero down the other arm', () => {
    tuning.debug.passiveEnemies = false;
    let tried = 0;
    for (const { level, p } of ells(40).slice(0, 6)) {
      // Two doorways whose straight line runs through the masonry: one arm's end and the other's.
      const pairs = p.doors.flatMap((a) => p.doors.map((b) => [a, b] as const)).filter(([a, b]) => a !== b && !clearLine(p, inside(a, 2.5), inside(b, 2.5), 0.8));
      if (!pairs.length) continue;
      const [from, to] = pairs[0];
      tried++;
      const world = buildWorld(level);
      const s = createSimState(level, [], world);
      const hero = addPlayer(s, world, 'p1', loadout, false);
      const h = inside(to, 2.5);
      Object.assign(hero, { x: h.x, z: h.z, y: p.y, mode: 'move', invulnTime: 0, invulnerable: false });
      const e0 = inside(from, 2.5);
      const e = createEnemy(s, world, 'grunt', e0.x, e0.z, 0);
      Object.assign(e, { ai: 'chase', aiTime: 0, cooldown: 0 });
      const hp = hero.hp;
      let ticks = 0;
      let closest = Infinity;
      for (; ticks < 900 && hero.hp === hp; ticks++) {
        stepEnemies(s, DT, world);
        closest = Math.min(closest, ...p.blocks.map((b) => rectDistance(b, e.x, e.z)));
      }
      expect(hero.hp, `piece ${p.id}`).toBeLessThan(hp);
      // Walking straight at the hero it slid along the stone at its own radius (0.42 m) and arrived a
      // quarter later; going by the elbow it keeps off it.
      expect(closest, `piece ${p.id}`).toBeGreaterThan(0.6);
    }
    expect(tried).toBeGreaterThan(2);
  });
});
