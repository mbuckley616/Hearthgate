import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { buildWorld, groundHeight, type World } from '../level/arena';
import { DAIS_TITLE, floorLevel, insidePiece, openMiddle } from '../level/floor';
import { daisHeight, daisRect, DAIS_STEP, rectDistance, sarcRect, type Dais } from '../level/setPieces';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState } from './world';

// G5's B, Michael's C (4 Nov), the third set piece: a dais raised in two low steps in the middle of
// some big fight rooms, walked onto from any side by heroes and enemies alike.

const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

const kept = tuning.debug.passiveEnemies;
afterEach(() => {
  tuning.debug.passiveEnemies = kept;
});

/** The first generated floor with a dais, its world and the dais. */
function daisFloor(): { world: World; d: Dais } {
  for (let seed = 1; ; seed++) {
    const level = floorLevel({ seed, pieces: 24, floor: 1, floors: 3 });
    const d = level.dungeon!.daises[0];
    if (d) return { world: buildWorld(level), d };
  }
}

describe('the dais (G5 B)', () => {
  it('stands in the middle of some big fight rooms, the same from the same seed, clear of the room\'s other things', () => {
    let rooms = 0;
    let floors = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const spec = { seed, pieces: 24, floor: 1, floors: 3 };
      const level = floorLevel(spec);
      const layout = level.dungeon!;
      expect(floorLevel(spec).dungeon!.daises).toEqual(layout.daises);
      rooms += layout.daises.length;
      if (layout.daises.length) floors++;
      const world = buildWorld(level);
      for (const d of layout.daises) {
        const p = layout.pieces[d.piece];
        expect(p.fight).toBe(true);
        expect(p.kind).not.toBe('boss');
        expect(p.title).toBe(DAIS_TITLE);
        expect(layout.lava.some((l) => l.piece === p.id)).toBe(false);
        expect(layout.sarcophagi.some((t) => t.piece === p.id)).toBe(false);
        expect(layout.daises.filter((o) => o.piece === p.id).length).toBe(1);
        const r = daisRect(d);
        expect(insidePiece(p, r.minX, r.minZ, 1.4)).toBe(true);
        expect(insidePiece(p, r.maxX, r.maxZ, 1.4)).toBe(true);
        for (const dr of p.doors.filter((dd) => dd.open)) expect(rectDistance(r, dr.x, dr.z)).toBeGreaterThanOrEqual(3);
        for (const pl of p.pillars) expect(rectDistance(r, pl.x, pl.z)).toBeGreaterThanOrEqual(pl.radius + 1.2);
        for (const b of p.braziers) expect(rectDistance(r, b.x, b.z)).toBeGreaterThanOrEqual(1.2);
        for (const k of [...layout.spikes, ...layout.crumble].filter((t) => t.piece === p.id)) expect(rectDistance(r, k.x, k.z)).toBeGreaterThan(1.5);
        // Nobody wakes on the steps.
        for (const sp of p.spots) expect(rectDistance(r, sp.x, sp.z)).toBeGreaterThan(0.6);
        expect(p.spots.length).toBeGreaterThanOrEqual(4);
        for (const pr of layout.props) expect(rectDistance(r, pr.x, pr.z)).toBeGreaterThan(1);
        for (const t of layout.sarcophagi) expect(rectDistance(r, sarcRect(t).minX, sarcRect(t).minZ)).toBeGreaterThan(0);
        // The ground: the top, the step, the room's floor, as the sim reads it.
        expect(groundHeight(world, d.x, d.z)).toBeCloseTo(d.y + DAIS_STEP * 2, 6);
        expect(groundHeight(world, r.minX + 0.5, d.z)).toBeCloseTo(d.y + DAIS_STEP, 6);
        expect(groundHeight(world, r.minX - 0.5, d.z)).toBeCloseTo(d.y, 6);
        expect(daisHeight(d, d.x, d.z)).toBe(groundHeight(world, d.x, d.z));
        // The bots' way through the room crosses its middle, which is the dais top: walkable.
        expect(rectDistance(daisRect(d, true), openMiddle(p).x, openMiddle(p).z)).toBe(0);
      }
    }
    expect(rooms).toBeGreaterThan(25);
    expect(floors).toBeGreaterThan(20);
  });

  it('has steps lower than a stride, so a hero walks up it and off the far side', () => {
    expect(DAIS_STEP).toBeLessThan(tuning.combat.stepHeight);
    const { world, d } = daisFloor();
    const s = createSimState(world.level, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    Object.assign(p, { x: d.x, z: d.z - d.size / 2 - 1.2, y: d.y });
    let top = 0;
    for (let i = 0; i < 150 && p.z < d.z + d.size / 2 + 1; i++) {
      stepPlayer(p, { ...idleCommand(), moveZ: 1, aimX: 0, aimZ: 1 }, DT, world, s);
      if (Math.abs(p.z - d.z) < 1) top = Math.max(top, p.y);
    }
    expect(top).toBeCloseTo(d.y + DAIS_STEP * 2, 6);
    expect(p.z).toBeGreaterThan(d.z + d.size / 2 + 1);
    expect(p.y).toBeCloseTo(d.y, 6);
  });

  it('is no refuge: a grunt walks up it to a hero on top and strikes', () => {
    tuning.debug.passiveEnemies = false;
    const { world, d } = daisFloor();
    const s = createSimState(world.level, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    Object.assign(p, { x: d.x, z: d.z, y: d.y + DAIS_STEP * 2, mode: 'move', invulnTime: 0, invulnerable: false });
    const e = createEnemy(s, world, 'grunt', d.x, d.z - d.size / 2 - 2, 0);
    Object.assign(e, { ai: 'chase', aiTime: 0, cooldown: 0 });
    const hp = p.hp;
    for (let i = 0; i < 600 && p.hp === hp; i++) stepEnemies(s, DT, world);
    expect(e.y).toBeCloseTo(d.y + DAIS_STEP * 2, 6);
    expect(p.hp).toBeLessThan(hp);
  });
});
