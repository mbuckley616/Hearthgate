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

// E1i: the Goblin Slinger, the Warrens' archer: a Skeleton Archer's brain, a goblin's numbers and a
// lobbed stone that lands blunt where the aim locked.

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function fightIn(spec: FloorSpec) {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const host = new HostSession(world, () => {}, true, () => {});
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const room = level.dungeon!.pieces[guardRoomOf(world)];
  const p = host.sim.players[0];
  const mid = openMiddle(room);
  Object.assign(p, { x: mid.x, z: mid.z, y: room.y, maxHp: 10000, hp: 10000 });
  for (let i = 0; i < Math.ceil((tuning.run.introMs / 1000) * 60) + 4; i++) host.tick();
  return host;
}

describe('the Goblin Slinger (E1i)', () => {
  it('is the Warrens’ archer, throws blunt, and no Bone Priest raises it', () => {
    expect(roleOf('slinger')).toBe('archer');
    expect(attackType({ kind: 'slinger', attack: '' })).toBe('blunt');
    expect(dressing('slinger', 'goblinWarrens').name).toBe('Goblin Slinger');
    expect(roomKindIn('archer', 'goblinWarrens')).toBe('slinger');
    expect(roomKindIn('archer', 'hauntedCrypt')).toBe('archer');
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'slinger', ai: 'dead' } as never)).toBe(false);
  });

  it('stands in a Warrens room where the Crypt’s would have a Skeleton Archer', () => {
    let slingers = 0;
    for (const seed of [3, 7, 11, 19]) {
      const spec: FloorSpec = { seed, pieces: 20, floor: 2, floors: 3 };
      const crypt = fightIn(spec).sim.enemies;
      const warrens = fightIn({ ...spec, type: 'goblinWarrens' }).sim.enemies;
      crypt.forEach((e, i) => {
        if (e.kind === 'archer') expect(warrens[i].kind).toBe('slinger');
      });
      slingers += warrens.filter((e) => e.kind === 'slinger').length;
      expect(warrens.some((e) => e.kind === 'archer')).toBe(false);
    }
    expect(slingers).toBeGreaterThan(0);
  });

  it('lobs a stone up and over that comes down on a hero standing still, blunt, for its damage', () => {
    let seed = 0;
    let host!: HostSession;
    do host = fightIn({ seed: ++seed, pieces: 20, floor: 2, floors: 3, type: 'goblinWarrens' });
    while (!host.sim.enemies.some((e) => e.kind === 'slinger') && seed < 40);
    const p = host.sim.players[0];
    const slinger = host.sim.enemies.find((e) => e.kind === 'slinger')!;
    let launchVy: number | undefined;
    let landed: { damage: number; type?: string } | undefined;
    for (let i = 0; i < 60 * 20 && !landed; i++) {
      for (const e of host.sim.enemies) if (e !== slinger && e.ai !== 'dead') Object.assign(e, { x: p.x + 40, z: p.z + 40, cooldown: 99, hasToken: false });
      host.tick();
      const stone = host.sim.projectiles.find((pr) => pr.stone);
      if (stone && launchVy === undefined) launchVy = stone.vy;
      const hurt = host.sim.events.find((ev) => ev.kind === 'heroHurt');
      if (hurt && hurt.kind === 'heroHurt') landed = hurt;
    }
    expect(launchVy).toBeGreaterThan(0);
    expect(landed).toBeDefined();
    expect(landed!.type).toBe('blunt');
    expect(landed!.damage).toBeCloseTo(tuning.slinger.damage * (slinger.hitMult ?? 1), 5);
  });
});
