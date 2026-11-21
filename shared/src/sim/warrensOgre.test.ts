import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { brainFor, createEnemy, heavyNumbers, raisable, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { attackType, dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1i: the Cave Ogre, the Warrens' heavy: the Bone Brute's slam, slower to come and wider where it lands.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(kind: EnemyKind): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const e = createEnemy(s, world, kind, 0, EDGE - 5.5, 0);
  Object.assign(e, { x: 0, z: EDGE - 5.5, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0, hasToken: true });
  return { s, p, e };
}

/** Stand in front of it until the slam lands: when the wind-up began and when it landed. */
function slammed(kind: EnemyKind) {
  const { s, p, e } = scene(kind);
  let windAt = -1;
  let t = 0;
  for (let i = 0; i < 300 && p.hp === p.maxHp; i++) {
    Object.assign(p, { x: 0, z: EDGE - 3 });
    stepEnemies(s, DT, world);
    t += DT;
    if (e.ai === 'slamWindup' && windAt < 0) windAt = t;
  }
  return { p, e, windAt, hitAt: t };
}

describe('the Cave Ogre (E1i)', () => {
  it('is the Warrens’ heavy, hits blunt, and takes the Brute’s place there, mini-boss included', () => {
    expect(roleOf('ogre')).toBe('heavy');
    expect(brainFor('ogre')).toBe(brainFor('brute'));
    expect(attackType({ kind: 'ogre', attack: 'slam' })).toBe('blunt');
    expect(dressing('ogre', 'goblinWarrens').name).toBe('Cave Ogre');
    expect(roomKindIn('brute', 'goblinWarrens')).toBe('ogre');
    expect(roomKindIn('brute', 'hauntedCrypt')).toBe('brute');
    expect(heavyNumbers({ kind: 'ogre' })).toBe(tuning.ogre);
    expect(heavyNumbers({ kind: 'brute' })).toBe(tuning.brute);
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'ogre', ai: 'dead' } as never)).toBe(false);
  });

  it('winds up longer than a Brute, lands harder over a wider ring, and stands longer after', () => {
    const ogre = slammed('ogre');
    const brute = slammed('brute');
    expect(ogre.p.hp).toBe(ogre.p.maxHp - tuning.ogre.damage);
    expect(brute.p.hp).toBe(brute.p.maxHp - tuning.brute.damage);
    expect(ogre.hitAt - ogre.windAt).toBeGreaterThan(brute.hitAt - brute.windAt);
    expect(tuning.ogre.slamRadius).toBeGreaterThan(tuning.brute.slamRadius);
    expect(tuning.ogre.recoveryMs).toBeGreaterThan(tuning.brute.recoveryMs);
  });
});
