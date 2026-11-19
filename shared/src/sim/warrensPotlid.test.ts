import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, raisable, shieldNumbers, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { attackType, dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1i: the Pot-lid Goblin, the Warrens' shield: the Shieldbearer's brain and block on a goblin's
// numbers, a narrower guard that turns quicker.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function scene(kind: EnemyKind): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: 2, invulnerable: false, invulnTime: 0 });
  const e = createEnemy(s, world, kind, 0, 0, 0);
  Object.assign(e, { x: 0, z: 0, yaw: 0, ai: 'chase', aiTime: 0 });
  return { s, p, e };
}

function swing(p: PlayerState, e: EnemyState, from: { x: number; z: number }): HitSpec {
  const len = Math.hypot(from.x, from.z);
  return { attackerId: p.id, damage: 10, poise: 1, knockback: 0, heavy: false, dirX: -from.x / len, dirZ: -from.z / len, x: e.x, y: 1, z: e.z, style: 'sword' };
}

describe('the Pot-lid Goblin (E1i)', () => {
  it('is the Warrens’ shield, bashes blunt, takes the Shieldbearer’s place there, and stays down', () => {
    expect(roleOf('potlid')).toBe('shield');
    expect(brainFor('potlid')).toBe(brainFor('shieldbearer'));
    expect(attackType({ kind: 'potlid', attack: 'bash' })).toBe('blunt');
    expect(dressing('potlid', 'goblinWarrens').name).toBe('Pot-lid Goblin');
    expect(roomKindIn('shieldbearer', 'goblinWarrens')).toBe('potlid');
    expect(roomKindIn('shieldbearer', 'hauntedCrypt')).toBe('shieldbearer');
    expect(shieldNumbers({ kind: 'potlid' })).toBe(tuning.potlid);
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'potlid', ai: 'dead' } as never)).toBe(false);
  });

  it('blocks from the front, but its narrower lid lets a blow 60° off the front through where a tower shield would not', () => {
    const at60 = { x: Math.sin(Math.PI / 3) * 2, z: Math.cos(Math.PI / 3) * 2 };
    const pot = scene('potlid');
    const full = pot.e.hp;
    damageEnemy(pot.s, pot.e, swing(pot.p, pot.e, { x: 0, z: 2 }));
    expect(pot.e.hp).toBe(full);
    damageEnemy(pot.s, pot.e, swing(pot.p, pot.e, at60));
    expect(pot.e.hp).toBe(full - 10);
    const tower = scene('shieldbearer');
    const tfull = tower.e.hp;
    damageEnemy(tower.s, tower.e, swing(tower.p, tower.e, at60));
    expect(tower.e.hp).toBe(tfull);
  });

  it('turns to face a hero at its side quicker than a Shieldbearer', () => {
    const turned = (kind: EnemyKind) => {
      const { s, p, e } = scene(kind);
      Object.assign(p, { x: 2, z: 0 });
      Object.assign(e, { cooldown: 99 });
      for (let i = 0; i < 15; i++) stepEnemies(s, DT, world);
      return e.yaw;
    };
    expect(turned('potlid')).toBeGreaterThan(turned('shieldbearer') * 1.3);
  });
});
