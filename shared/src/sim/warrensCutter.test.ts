import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import { guardRoomOf } from './floorRun';
import { emptyMods } from './gear';
import { raisable } from './enemies';
import { attackType, dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';

// E1i (Michael's A, 19 Nov): the Goblin Warrens' roster, a kind a session. The Goblin Cutter is the
// Warrens' fodder: a Skeleton Warrior's brain with a goblin's numbers, spawned in a Warrens room
// wherever the composer puts a Skeleton Warrior.

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function fightIn(spec: FloorSpec) {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const host = new HostSession(world, () => {}, true, () => {});
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const room = level.dungeon!.pieces[guardRoomOf(world)];
  const p = host.sim.players[0];
  const mid = openMiddle(room);
  Object.assign(p, { x: mid.x, z: mid.z, y: room.y });
  for (let i = 0; i < Math.ceil((tuning.run.introMs / 1000) * 60) + 4; i++) host.tick();
  return host;
}

describe('the Goblin Cutter (E1i)', () => {
  it('is fodder that cuts, named for the Warrens, and no Bone Priest raises it', () => {
    expect(roleOf('cutter')).toBe('fodder');
    expect(attackType({ kind: 'cutter', attack: '' })).toBe('edge');
    expect(dressing('cutter', 'goblinWarrens').name).toBe('Goblin Cutter');
    expect(roomKindIn('grunt', 'goblinWarrens')).toBe('cutter');
    expect(roomKindIn('grunt', 'hauntedCrypt')).toBe('grunt');
    expect(roomKindIn('brute', 'goblinWarrens')).toBe('brute');
    // Lighter and quicker than the skeleton it stands in for.
    expect(tuning.cutter.maxHp).toBeLessThan(tuning.grunt.maxHp);
    expect(tuning.cutter.moveSpeed).toBeGreaterThan(tuning.grunt.moveSpeed);
    expect(tuning.cutter.telegraphMs).toBeLessThan(tuning.grunt.telegraphMs);
    const priest = { kind: 'priest', ai: 'chase' } as never;
    const state = { enemies: [priest], floor: null } as never;
    expect(raisable(state, { kind: 'grunt', ai: 'dead' } as never)).toBe(true);
    expect(raisable(state, { kind: 'cutter', ai: 'dead' } as never)).toBe(false);
  });

  it('takes the Skeleton Warrior’s place in a Warrens room, the room otherwise the Crypt’s to the spot', () => {
    let cutters = 0;
    for (const seed of [3, 7, 11]) {
      const spec: FloorSpec = { seed, pieces: 20, floor: 2, floors: 3 };
      const crypt = fightIn(spec).sim.enemies;
      const warrens = fightIn({ ...spec, type: 'goblinWarrens' }).sim.enemies;
      expect(warrens.length).toBe(crypt.length);
      warrens.forEach((e, i) => {
        expect(e.kind).toBe(roomKindIn(crypt[i].kind, 'goblinWarrens'));
        expect(e.x).toBeCloseTo(crypt[i].x, 6);
        expect(e.z).toBeCloseTo(crypt[i].z, 6);
        if (e.kind === 'cutter') {
          cutters++;
          expect(e.maxHp).toBeLessThan(crypt[i].maxHp);
        }
      });
      expect(crypt.some((e) => e.kind === 'cutter')).toBe(false);
      expect(warrens.some((e) => e.kind === 'grunt')).toBe(false);
    }
    expect(cutters).toBeGreaterThan(0);
  });

  it('winds up for the cutter’s shorter telegraph and cuts for its damage', () => {
    const host = fightIn({ seed: 7, pieces: 20, floor: 2, floors: 3, type: 'goblinWarrens' });
    const p = host.sim.players[0];
    let cutter = host.sim.enemies.find((e) => e.kind === 'cutter')!;
    const hp0 = p.hp;
    let windAt = -1;
    let cutAt = -1;
    for (let i = 0; i < 60 * 20 && cutAt < 0; i++) {
      // Keep every other enemy out of it, so the blow is the cutter's.
      for (const e of host.sim.enemies) if (e !== cutter) Object.assign(e, { x: p.x + 40, z: p.z + 40, cooldown: 99, hasToken: false });
      host.tick();
      cutter = host.sim.enemies.find((e) => e.id === cutter.id)!;
      if (cutter.ai === 'windup' && windAt < 0) windAt = host.sim.time;
      if (cutter.ai === 'slash1' && windAt >= 0) cutAt = host.sim.time;
    }
    expect(cutAt).toBeGreaterThan(0);
    expect(cutAt - windAt).toBeCloseTo(tuning.cutter.telegraphMs / 1000, 1);
    for (let i = 0; i < 60; i++) host.tick();
    // Its first cut lands after the lag grace, for the cutter's damage (no armour, Normal).
    expect(hp0 - p.hp).toBeGreaterThan(0);
    expect(hp0 - p.hp).toBeLessThanOrEqual(2 * tuning.cutter.damage * (cutter.hitMult ?? 1) + 1e-9);
  });
});
