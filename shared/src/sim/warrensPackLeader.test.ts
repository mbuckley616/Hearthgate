import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { breakChannel } from './combat';
import { brainFor, createEnemy, raisable, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, SimState } from './types';
import { createSimState } from './world';

// E1i: the Goblin Pack Leader, the Warrens' leader: a war cry that quickens its pack, in the Priest's place.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(withPack: boolean): { s: SimState; leader: EnemyState; cutter?: EnemyState; far?: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const leader = createEnemy(s, world, 'packLeader', 0, EDGE - 10, 0);
  Object.assign(leader, { x: 0, z: EDGE - 10, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  if (!withPack) return { s, leader };
  const cutter = createEnemy(s, world, 'cutter', 3, EDGE - 10, 0);
  Object.assign(cutter, { x: 3, z: EDGE - 10, ai: 'chase', aiTime: 0 });
  // A Skeleton Warrior in reach is not of the pack.
  const far = createEnemy(s, world, 'grunt', -3, EDGE - 10, 0);
  Object.assign(far, { x: -3, z: EDGE - 10, ai: 'chase', aiTime: 0 });
  return { s, leader, cutter, far };
}

describe('the Goblin Pack Leader (E1i)', () => {
  it('is the Warrens’ leader on its own brain, and takes the Priest’s place there', () => {
    expect(roleOf('packLeader')).toBe('leader');
    expect(brainFor('packLeader')).toBe(brainFor('priest'));
    expect(dressing('packLeader', 'goblinWarrens').name).toBe('Pack Leader');
    expect(roomKindIn('priest', 'goblinWarrens')).toBe('packLeader');
    expect(roomKindIn('priest', 'hauntedCrypt')).toBe('priest');
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'packLeader', ai: 'dead' } as never)).toBe(false);
  });

  it('cries after drawing breath and quickens the goblins in reach, not the skeletons', () => {
    const { s, leader, cutter, far } = scene(true);
    let cried = -1;
    for (let i = 0; i < 200 && cried < 0; i++) {
      stepEnemies(s, DT, world);
      const ev = s.events.find((e) => e.kind === 'warCry');
      if (ev && ev.kind === 'warCry') cried = ev.quickened;
      s.events.length = 0;
    }
    expect(cried).toBe(2);
    expect(cutter!.quickUntil).toBeCloseTo(s.time + tuning.packLeader.quickMs / 1000, 1);
    expect(leader.quickUntil).toBeDefined();
    expect(far!.quickUntil).toBeUndefined();
  });

  it('a quickened goblin’s step runs quickMult faster, and the quickening runs out', () => {
    const { s, cutter } = scene(true);
    cutter!.quickUntil = s.time + 1;
    Object.assign(cutter!, { ai: 'recover', aiTime: 0, recoverTime: 100 });
    stepEnemies(s, DT, world);
    expect(cutter!.aiTime).toBeCloseTo(DT * tuning.packLeader.quickMult, 6);
    cutter!.quickUntil = s.time - 0.01;
    stepEnemies(s, DT, world);
    expect(cutter!.quickUntil).toBeUndefined();
  });

  it('does not cry alone, and a hit breaks the cry', () => {
    const alone = scene(false);
    for (let i = 0; i < 120; i++) stepEnemies(alone.s, DT, world);
    expect(alone.leader.ai).not.toBe('chant');

    const { s, leader, cutter } = scene(true);
    for (let i = 0; i < 60 && leader.ai !== 'chant'; i++) stepEnemies(s, DT, world);
    expect(leader.ai).toBe('chant');
    breakChannel(leader);
    expect(leader.ai).toBe('recover');
    for (let i = 0; i < 90; i++) stepEnemies(s, DT, world);
    expect(cutter!.quickUntil).toBeUndefined();
  });
});
