import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import { guardRoomOf } from './floorRun';
import { emptyMods } from './gear';
import { minibossNames } from './roles';
import { emptyTalents } from './talents';

// G4, Michael's A (4 Nov): a mini-boss is a named elite, a Knight or Brute with a crown, a name and
// more health, at most one a floor, guarding the rest room's door.

const kept = { ...tuning.miniboss };
afterEach(() => Object.assign(tuning.miniboss, kept));

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** One hero walks into a room and stands through the intro. */
function fightIn(spec: FloorSpec, roomId: number) {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const host = new HostSession(world, () => {}, true, () => {});
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const room = level.dungeon!.pieces[roomId];
  const p = host.sim.players[0];
  const mid = openMiddle(room);
  Object.assign(p, { x: mid.x, z: mid.z, y: room.y });
  for (let i = 0; i < Math.ceil((tuning.run.introMs / 1000) * 60) + 4; i++) host.tick();
  return { host, world, level };
}

const named = (host: HostSession) => host.sim.enemies.filter((e) => e.named);

describe('mini-bosses guard the rest room (G4)', () => {
  it('picks the fight room nearest the rest room, and none on the Warden’s floor', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rest = buildWorld(floorLevel({ seed, pieces: 20, floor: 1, floors: 3 }));
      const layout = rest.level.dungeon!;
      const g = guardRoomOf(rest);
      expect(g).toBeGreaterThanOrEqual(0);
      const piece = layout.def.pieces[g];
      expect(piece.fight).toBe(true);
      expect(piece.kind).not.toBe('boss');
      expect(g).not.toBe(layout.def.exit);
      const boss = buildWorld(floorLevel({ seed, pieces: 20, floor: 3, floors: 3 }));
      expect(guardRoomOf(boss)).toBe(-1);
    }
    // The same floor always picks the same room.
    const spec = { seed: 7, pieces: 20, floor: 1, floors: 3 };
    expect(guardRoomOf(buildWorld(floorLevel(spec)))).toBe(guardRoomOf(buildWorld(floorLevel(spec))));
  });

  it('meets the party there: one named Brute on Normal floor 1, with its health raised and the boss bar', () => {
    const spec = { seed: 7, pieces: 20, floor: 1, floors: 3 };
    const g = guardRoomOf(buildWorld(floorLevel(spec)));
    const { host } = fightIn(spec, g);
    expect(host.sim.run.phase).toBe('wave');
    const boss = named(host);
    expect(boss.length).toBe(1);
    expect(boss[0].kind).toBe('brute');
    expect(minibossNames()).toContain(boss[0].named);
    expect(host.sim.run.bossId).toBe(boss[0].id);
    const plain = host.sim.enemies.find((e) => e.kind === 'brute' && !e.named);
    const base = tuning.brute.maxHp;
    expect(boss[0].maxHp).toBeGreaterThanOrEqual(base * tuning.miniboss.healthMult * 0.99);
    if (plain) expect(boss[0].maxHp).toBeCloseTo(plain.maxHp * tuning.miniboss.healthMult, 5);
    expect(boss[0].hp).toBe(boss[0].maxHp);
  });

  it('is a Barrow Knight from its tier, and only in the guard room', () => {
    const spec = { seed: 7, pieces: 20, floor: 2, floors: 3, difficulty: 2 };
    const world = buildWorld(floorLevel(spec));
    const g = guardRoomOf(world);
    expect(named(fightIn(spec, g).host)[0].kind).toBe('knight');
    const other = world.level.dungeon!.pieces.find((p) => p.fight && p.kind !== 'boss' && p.id !== g && p.id !== world.level.dungeon!.def.exit)!;
    const elsewhere = fightIn(spec, other.id).host;
    expect(named(elsewhere).length).toBe(0);
    expect(elsewhere.sim.run.bossId).toBe(-1);
  });

  it('stays away with the switch off', () => {
    tuning.miniboss.enabled = false;
    const spec = { seed: 7, pieces: 20, floor: 1, floors: 3 };
    const { host } = fightIn(spec, guardRoomOf(buildWorld(floorLevel(spec))));
    expect(named(host).length).toBe(0);
  });
});
