import { afterEach, describe, expect, it } from 'vitest';
import { enemyStats, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { SimState } from './types';
import { createSimState } from './world';

const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.dungeon.difficultyScalesEnemies;
afterEach(() => {
  tuning.dungeon.difficultyScalesEnemies = kept;
});

/** One grunt's health and the damage of its first slash on a hero standing in front of it. */
function grunt(difficulty: number | undefined, onFloor = true): { maxHp: number; damage: number } {
  const spec: FloorSpec = { seed: 7, pieces: 12, floor: 1, floors: 3, ...(difficulty !== undefined ? { difficulty } : {}) };
  const level = onFloor ? floorLevel(spec) : arena;
  const world = buildWorld(level);
  const s: SimState = createSimState(level, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  // Past the joining grace, so the slash can land.
  Object.assign(p, { invulnerable: false, invulnTime: 0 });
  const e = createEnemy(s, world, 'grunt', p.x, p.z + 1.2, Math.PI);
  Object.assign(e, { x: p.x, z: p.z + 1.2, yaw: Math.PI, ai: 'windup', aiTime: 10 });
  const hpBefore = p.hp;
  stepEnemies(s, DT, world);
  const pending = s.pendingHits.find((h) => h.playerId === p.id);
  return { maxHp: e.maxHp, damage: pending ? pending.hit.damage : hpBefore - p.hp };
}

describe('difficulty makes enemies hit harder (G3; Michael, 2 Nov)', () => {
  it('the same seed\'s grunt has twice the health and hits twice as hard on Nightmare as on Normal', () => {
    const normal = grunt(1);
    const nightmare = grunt(3);
    expect(normal.damage).toBeGreaterThan(0);
    expect(normal.maxHp).toBeCloseTo(enemyStats('grunt').maxHp);
    expect(nightmare.maxHp).toBeCloseTo(normal.maxHp * 2);
    expect(nightmare.damage).toBeCloseTo(normal.damage * 2);
  });

  it('Easy softens, Hard and Legendary follow the list, and no difficulty is Normal', () => {
    const normal = grunt(1);
    expect(grunt(undefined)).toEqual(normal);
    expect(grunt(0).maxHp).toBeCloseTo(normal.maxHp * 0.75);
    expect(grunt(2).damage).toBeCloseTo(normal.damage * 1.5);
    expect(grunt(4).maxHp).toBeCloseTo(normal.maxHp * 2.5);
  });

  it('with the switch off, a difficulty only fills rooms, and the arena never scales', () => {
    tuning.dungeon.difficultyScalesEnemies = false;
    expect(grunt(3)).toEqual(grunt(1));
    tuning.dungeon.difficultyScalesEnemies = true;
    const s = createSimState(arena, [], buildWorld(arena));
    const e = createEnemy(s, buildWorld(arena), 'grunt', 0, 0, 0);
    expect(e.hitMult).toBeUndefined();
    expect(grunt(undefined, false).maxHp).toBeCloseTo(enemyStats('grunt').maxHp);
  });
});
