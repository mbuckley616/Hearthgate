import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld, type World } from '../level/arena';
import { floorLevel, insidePiece, openMiddle, walkRoute, TOMBS_TITLE } from '../level/floor';
import { sphereCast } from '../level/geometry';
import { rectDistance, sarcCollider, sarcRect, SARC_HEIGHT, type Sarcophagus } from '../level/setPieces';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// G5's B, Michael's C (4 Nov): set pieces first, the sarcophagus rows. Chest-high stone tombs in some
// big fight rooms: solid to walking, an archer's line and a Wraith's sight, so a hero can take cover.

const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

const kept = tuning.debug.passiveEnemies;
afterEach(() => {
  tuning.debug.passiveEnemies = kept;
});

/** The arena with one tomb standing across the line from (0, 2) to (0, 10), its long side along x. */
function coveredArena(): World {
  const base = buildWorld(arena);
  const tomb: Sarcophagus = { x: 0, z: 8.6, y: 0, piece: 0, alongX: true };
  const colliders = [...base.colliders, sarcCollider(tomb, 0)];
  return { ...base, colliders, collidersOpen: colliders };
}

function scene(world: World, kind: 'wraith' | 'archer'): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: 10, mode: 'move', invulnTime: 0, invulnerable: false });
  const e = createEnemy(s, world, kind, 0, 2, 0);
  Object.assign(e, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, e };
}

describe('tomb rows (G5 B)', () => {
  it('stand in some big fight rooms on most floors, the same from the same seed, and never where they would close the way', () => {
    let rooms = 0;
    let floors = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const spec = { seed, pieces: 24, floor: 2, floors: 3 };
      const layout = floorLevel(spec).dungeon!;
      expect(floorLevel(spec).dungeon!.sarcophagi).toEqual(layout.sarcophagi);
      const withTombs = new Set(layout.sarcophagi.map((t) => t.piece));
      rooms += withTombs.size;
      if (withTombs.size) floors++;
      for (const t of layout.sarcophagi) {
        const p = layout.pieces[t.piece];
        expect(p.fight).toBe(true);
        expect(p.kind).not.toBe('boss');
        expect(p.title).toBe(TOMBS_TITLE);
        expect(layout.lava.some((l) => l.piece === p.id)).toBe(false);
        const r = sarcRect(t);
        expect(insidePiece(p, r.minX, r.minZ, 1)).toBe(true);
        expect(insidePiece(p, r.maxX, r.maxZ, 1)).toBe(true);
        for (const d of p.doors.filter((dd) => dd.open)) expect(rectDistance(r, d.x, d.z)).toBeGreaterThan(3.9);
        // Nobody wakes inside one, and no prop stands in one.
        for (const sp of p.spots) expect(rectDistance(r, sp.x, sp.z)).toBeGreaterThan(0.85);
        for (const pr of layout.props) expect(rectDistance(r, pr.x, pr.z)).toBeGreaterThan(0.9);
        for (const k of [...layout.spikes, ...layout.crumble]) expect(rectDistance(r, k.x, k.z)).toBeGreaterThan(1.5);
        expect(rectDistance(r, openMiddle(p).x, openMiddle(p).z)).toBeGreaterThan(1.5);
      }
      // The bots' route from the way in to the way out is never through a tomb.
      const world = buildWorld(floorLevel(spec));
      const tombs = world.colliders.filter((c) => c.id.startsWith('sarc-'));
      expect(tombs.length).toBe(layout.sarcophagi.length);
      const route = walkRoute(layout, layout.def.entrance, layout.def.exit);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1];
        const b = route[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.1) continue;
        const hit = sphereCast({ x: a.x, y: 0.5, z: a.z }, { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len }, len, 0.4, tombs, () => true);
        expect(hit, `seed ${seed} leg ${i}`).toBeGreaterThanOrEqual(len - 1e-6);
      }
    }
    // About a big fight room in two on most floors: a sight a player meets most runs.
    expect(rooms).toBeGreaterThan(30);
    expect(floors).toBeGreaterThan(30);
  });

  it('are chest high and solid: a hero cannot walk through, nor jump one', () => {
    const t: Sarcophagus = { x: 0, z: 0, y: 0, piece: 0, alongX: true };
    const c = sarcCollider(t, 0);
    expect(c.blocksMovement).toBe(true);
    expect(c.max.y).toBe(SARC_HEIGHT);
    expect(SARC_HEIGHT).toBeGreaterThan(tuning.jump.height);
  });

  it('hide a hero from a Wraith: in the open it casts, behind a tomb it does not', () => {
    tuning.debug.passiveEnemies = false;
    const open = scene(buildWorld(arena), 'wraith');
    for (let i = 0; i < 120 && open.e.ai !== 'chant'; i++) stepEnemies(open.s, DT, buildWorld(arena));
    expect(open.e.ai).toBe('chant');
    const world = coveredArena();
    const hid = scene(world, 'wraith');
    for (let i = 0; i < 120; i++) stepEnemies(hid.s, DT, world);
    expect(hid.e.ai).not.toBe('chant');
  });

  it('hide a hero from an archer: in the open it draws, behind a tomb it does not', () => {
    tuning.debug.passiveEnemies = false;
    const draws = (world: World) => {
      const { s, e } = scene(world, 'archer');
      let drew = false;
      for (let i = 0; i < 240 && !drew; i++) {
        stepEnemies(s, DT, world);
        drew = e.tele.shape !== 'none';
      }
      return drew;
    };
    expect(draws(buildWorld(arena))).toBe(true);
    expect(draws(coveredArena())).toBe(false);
  });
});
