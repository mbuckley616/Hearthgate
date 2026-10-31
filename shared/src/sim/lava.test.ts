import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld, type LevelDef } from '../level/arena';
import { LAVA_TITLE, floorLevel } from '../level/floor';
import { LAVA_WIDTH, type LavaStrip } from '../level/lava';
import { addPlayer, type Loadout } from './coop';
import { emptyMods } from './gear';
import { stepLava } from './lava';
import { emptyTalents } from './talents';
import { createSimState, stepSim } from './world';

const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const DT = 1 / 60;
const kept = { enemies: tuning.debug.enemiesEnabled };

afterEach(() => {
  tuning.debug.enemiesEnabled = kept.enemies;
});

/** Floors of a run of three, for seeds 1 to n; a spec the generator cannot meet is skipped. */
function floors(n: number, floor: number): LevelDef[] {
  const out: LevelDef[] = [];
  for (let seed = 1; seed <= n; seed++) {
    try {
      out.push(floorLevel({ seed, pieces: 18, floor, floors: 3 }));
    } catch {
      // A seed with no floor of that size: not this test's business.
    }
  }
  return out;
}

const narrow = (l: LavaStrip) => Math.min(l.maxX - l.minX, l.maxZ - l.minZ);
const across = (l: LavaStrip) => l.maxZ - l.minZ <= l.maxX - l.minX;
const inStrip = (l: LavaStrip, x: number, z: number, m = 0) => x > l.minX - m && x < l.maxX + m && z > l.minZ - m && z < l.maxZ + m;
/** Distance from a point to a strip's rectangle. */
const toStrip = (l: LavaStrip, x: number, z: number) => Math.hypot(Math.max(l.minX - x, 0, x - l.maxX), Math.max(l.minZ - z, 0, z - l.maxZ));

describe('rooms that need jumping (D6, Michael 30 Oct: A)', () => {
  const deep = [...floors(60, 2), ...floors(60, 3)];

  it('never lays lava on a run’s first floor', () => {
    for (const lv of floors(30, 1)) expect(lv.dungeon!.lava).toEqual([]);
  });

  it('lays it in one flat fight room on part of the deeper floors, renamed for its banner', () => {
    const withLava = deep.filter((lv) => lv.dungeon!.lava.length);
    expect(withLava.length / deep.length).toBeGreaterThan(0.3);
    expect(withLava.length / deep.length).toBeLessThan(0.9);
    for (const lv of withLava) {
      const pieces = new Set(lv.dungeon!.lava.map((l) => l.piece));
      expect(pieces.size).toBe(1);
      const room = lv.dungeon!.pieces[[...pieces][0]];
      expect(room.fight).toBe(true);
      expect(room.kind).not.toBe('boss');
      expect(room.title).toBe(LAVA_TITLE);
      for (const l of lv.dungeon!.lava) expect(l.y).toBe(room.y);
    }
  });

  it('keeps every strip a hop wide, inside the walls, clear of doorways, with a walkway at one end, in turn', () => {
    for (const lv of deep) {
      const lava = lv.dungeon!.lava;
      if (!lava.length) continue;
      const room = lv.dungeon!.pieces[lava[0].piece];
      const i = room.inner;
      lava.forEach((l, k) => {
        // A running hop covers about 3.2 m; the strip is under 2 m.
        expect(narrow(l)).toBeCloseTo(LAVA_WIDTH, 6);
        expect(l.minX >= i.minX - 1e-6 && l.maxX <= i.maxX + 1e-6 && l.minZ >= i.minZ - 1e-6 && l.maxZ <= i.maxZ + 1e-6).toBe(true);
        for (const d of room.doors) if (d.open) expect(toStrip(l, d.x, d.z)).toBeGreaterThan(2.4);
        // The walkway: the strip stops 2 m short of one wall, and the next stops short of the other.
        const run = across(l) ? [l.minX - i.minX, i.maxX - l.maxX] : [l.minZ - i.minZ, i.maxZ - l.maxZ];
        expect(Math.max(...run)).toBeGreaterThan(1.99);
        expect(Math.min(...run)).toBeLessThan(1e-6);
        // Nothing stands in the walkway: no pillar within a hero's width of it.
        const wx = across(l) ? (run[0] > 1 ? [i.minX, l.minX] : [l.maxX, i.maxX]) : [l.minX, l.maxX];
        const wz = across(l) ? [l.minZ, l.maxZ] : run[0] > 1 ? [i.minZ, l.minZ] : [l.maxZ, i.maxZ];
        for (const pl of room.pillars) {
          const dx = Math.max(wx[0] - pl.x, 0, pl.x - wx[1]);
          const dz = Math.max(wz[0] - pl.z, 0, pl.z - wz[1]);
          expect(Math.hypot(dx, dz)).toBeGreaterThan(pl.radius);
        }
        const next = lava[k + 1];
        if (next) {
          const gap = across(l) ? next.minZ - l.maxZ : next.minX - l.maxX;
          expect(gap).toBeGreaterThan(3);
          const nextRun = across(next) ? next.minX - i.minX : next.minZ - i.minZ;
          expect(nextRun > 1 !== run[0] > 1).toBe(true);
        }
      });
      // Nobody wakes in it, and no crate stands in it or across its walkway.
      for (const sp of room.spots) for (const l of lava) expect(inStrip(l, sp.x, sp.z)).toBe(false);
      for (const pr of lv.dungeon!.props) {
        if (pr.piece !== room.id) continue;
        for (const l of lava) expect(across(l) ? pr.z > l.minZ - 1 && pr.z < l.maxZ + 1 : pr.x > l.minX - 1 && pr.x < l.maxX + 1).toBe(false);
      }
    }
  });

  it('is the same floor every time from the same spec', () => {
    const lv = deep.find((l) => l.dungeon!.lava.length)!;
    const spec = lv.dungeon!.def.spec;
    expect(floorLevel(spec).dungeon!.lava).toEqual(lv.dungeon!.lava);
  });

  describe('the burn, the server’s alone', () => {
    const level = deep.find((l) => l.dungeon!.lava.length)!;
    const world = buildWorld(level);
    const strip = level.dungeon!.lava[0];
    const mid = { x: (strip.minX + strip.maxX) / 2, z: (strip.minZ + strip.maxZ) / 2 };

    function standing() {
      const s = createSimState(level, [], world);
      const p = addPlayer(s, world, 'p1', loadout, false);
      Object.assign(p, { x: mid.x, z: mid.z, y: strip.y, grounded: true });
      return { s, p };
    }

    it('burns a share of health a second, the first pulse the tick a hero steps in', () => {
      tuning.debug.enemiesEnabled = false;
      const { s, p } = standing();
      stepSim(s, {}, DT, world);
      expect(p.hp).toBeCloseTo(100 - 100 * tuning.lava.burnFracPerS * tuning.lava.tickS, 6);
      expect(s.events).toContainEqual(expect.objectContaining({ kind: 'heroHurt', playerId: 'p1' }));
      for (let i = 1; i < 120; i++) stepSim(s, {}, DT, world);
      // Two seconds: four pulses, 30% of a hundred.
      expect(p.hp).toBeCloseTo(100 - 100 * tuning.lava.burnFracPerS * 2, 6);
    });

    it('spares a hero in the air, a henchman, and one who steps off', () => {
      const { s, p } = standing();
      p.grounded = false;
      p.y = strip.y + 0.8;
      stepLava(s, world, DT);
      expect(p.hp).toBe(100);
      expect(p.burn).toBeUndefined();
      p.henchman = true;
      p.grounded = true;
      p.y = strip.y;
      stepLava(s, world, DT);
      expect(p.hp).toBe(100);
      p.henchman = undefined;
      stepLava(s, world, DT);
      expect(p.hp).toBeLessThan(100);
      expect(p.burn).toBeGreaterThan(0);
      p.x = strip.maxX + 3;
      p.z = strip.maxZ + 3;
      stepLava(s, world, DT);
      expect(p.burn).toBeUndefined();
    });

    it('puts a hero down at nothing', () => {
      const { s, p } = standing();
      p.hp = 1;
      stepLava(s, world, DT);
      expect(p.hp).toBe(0);
      expect(p.mode).toBe('down');
      expect(s.events).toContainEqual(expect.objectContaining({ kind: 'heroDown', playerId: 'p1' }));
    });
  });
});
