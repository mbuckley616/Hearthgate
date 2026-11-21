import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy } from './combat';
import { brainFor, createEnemy, raisable, shieldNumbers, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1i: the Goblin Chieftain, the Warrens' elite: a pot-lid behind a war cry, in the Barrow Knight's place.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(withPack: boolean): { s: SimState; p: PlayerState; chief: EnemyState; cutter?: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const chief = createEnemy(s, world, 'chieftain', 0, EDGE - 9, 0);
  Object.assign(chief, { x: 0, z: EDGE - 9, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  if (!withPack) return { s, p, chief };
  const cutter = createEnemy(s, world, 'cutter', 3, EDGE - 9, 0);
  Object.assign(cutter, { x: 3, z: EDGE - 9, ai: 'chase', aiTime: 0 });
  return { s, p, chief, cutter };
}

/** A sword blow from the hero's side: from in front of the Chieftain when the hero stands ahead of it. */
function blow(s: SimState, p: PlayerState, e: EnemyState, dirZ: number) {
  return damageEnemy(s, e, { attackerId: p.id, damage: 10, poise: 1, knockback: 0, heavy: false, dirX: 0, dirZ, x: e.x, y: 1, z: e.z, style: 'sword' });
}

describe('the Goblin Chieftain (E1i)', () => {
  it('is the Warrens’ elite and takes the Knight’s place there, a mini-boss’s included', () => {
    expect(roleOf('chieftain')).toBe('elite');
    expect(brainFor('chieftain')).toBe(brainFor('knight'));
    expect(dressing('chieftain', 'goblinWarrens').name).toBe('Goblin Chieftain');
    expect(roomKindIn('knight', 'goblinWarrens')).toBe('chieftain');
    expect(roomKindIn('knight', 'hauntedCrypt')).toBe('knight');
    expect(shieldNumbers({ kind: 'chieftain' })).toBe(tuning.chieftain);
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'chieftain', ai: 'dead' } as never)).toBe(false);
  });

  it('with a goblin in reach it cries behind its lid, quickening the pack, then fights as a shield', () => {
    const { s, p, chief, cutter } = scene(true);
    stepEnemies(s, DT, world);
    expect(chief.ai).toBe('chant');
    // Facing the hero, the lid takes a front blow during the cry and the cry goes on.
    const hp = chief.hp;
    blow(s, p, chief, -1);
    expect(chief.hp).toBe(hp);
    expect(chief.ai).toBe('chant');
    let cried = false;
    for (let i = 0; i < 120 && !cried; i++) {
      stepEnemies(s, DT, world);
      cried = s.events.some((e) => e.kind === 'warCry');
      s.events.length = 0;
    }
    expect(cried).toBe(true);
    expect(cutter!.quickUntil).toBeDefined();
    expect(chief.quickUntil).toBeDefined();
    // It does not cry again until its wait is out; it closes and bashes as a shield does.
    let bashed = false;
    for (let i = 0; i < 300 && !bashed; i++) {
      Object.assign(p, { x: 0, z: chief.z + 1.5 });
      stepEnemies(s, DT, world);
      expect(chief.ai).not.toBe('chant');
      bashed = chief.ai === 'windup';
    }
    expect(bashed).toBe(true);
  });

  it('a blow from behind breaks the cry, and alone it never cries', () => {
    const { s, p, chief } = scene(true);
    stepEnemies(s, DT, world);
    expect(chief.ai).toBe('chant');
    blow(s, p, chief, 1);
    expect(chief.ai).toBe('recover');
    expect(chief.cryAt).toBeGreaterThan(s.time);

    const alone = scene(false);
    for (let i = 0; i < 60; i++) stepEnemies(alone.s, DT, world);
    expect(alone.chief.ai).not.toBe('chant');
  });
});
