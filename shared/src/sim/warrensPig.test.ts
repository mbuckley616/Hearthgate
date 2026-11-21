import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { brainFor, createEnemy, raisable, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { attackType, dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1i: the War Pig, the Warrens' charger: the Crypt Hound's rush on a heavier animal.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(kind: EnemyKind): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const e = createEnemy(s, world, kind, 0, EDGE - 9, 0);
  Object.assign(e, { x: 0, z: EDGE - 9, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, e };
}

/** Stand in the line until the rush lands: when the wind-up began and when the hero was hit. */
function rushed(kind: EnemyKind) {
  const { s, p, e } = scene(kind);
  let windAt = -1;
  let t = 0;
  for (let i = 0; i < 240 && p.hp === p.maxHp; i++) {
    Object.assign(p, { x: 0, z: EDGE - 3 });
    stepEnemies(s, DT, world);
    t += DT;
    if (e.ai === 'chargeWindup' && windAt < 0) windAt = t;
  }
  return { p, windAt, hitAt: t };
}

describe('the War Pig (E1i)', () => {
  it('is the Warrens’ charger, runs blunt, and takes the Hound’s place there', () => {
    expect(roleOf('warPig')).toBe('charger');
    expect(brainFor('warPig')).toBe(brainFor('hound'));
    expect(attackType({ kind: 'warPig', attack: 'charge' })).toBe('blunt');
    expect(dressing('warPig', 'goblinWarrens').name).toBe('War Pig');
    expect(roomKindIn('hound', 'goblinWarrens')).toBe('warPig');
    expect(roomKindIn('hound', 'hauntedCrypt')).toBe('hound');
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'warPig', ai: 'dead' } as never)).toBe(false);
  });

  it('winds up longer than a Hound and lands harder, knocking the hero down', () => {
    const pig = rushed('warPig');
    const hound = rushed('hound');
    expect(pig.p.hp).toBe(pig.p.maxHp - tuning.warPig.chargeDamage);
    expect(pig.p.mode).toBe('hurt');
    expect(tuning.warPig.chargeDamage).toBeGreaterThan(tuning.hound.chargeDamage);
    expect(pig.hitAt - pig.windAt).toBeGreaterThan(hound.hitAt - hound.windAt);
  });
});
