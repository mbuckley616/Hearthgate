import { describe, expect, it } from 'vitest';
import { enemyStats, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy } from './combat';
import { brainFor, createEnemy, raisable, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { roleOf, telegraphColour } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function kill(s: SimState, p: PlayerState, e: EnemyState): void {
  damageEnemy(s, e, { attackerId: p.id, damage: 10_000, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z });
  expect(e.ai).toBe('dead');
}

/** A hero, a Skeleton Warrior between them and a Bone Priest behind it. */
function scene(): { s: SimState; p: PlayerState; g: EnemyState; priest: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: 10 });
  const g = createEnemy(s, world, 'grunt', 0, 6, Math.PI);
  const priest = createEnemy(s, world, 'priest', 0, 2, 0);
  Object.assign(priest, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  Object.assign(g, { x: 0, z: 6, ai: 'chase', aiTime: 0 });
  // Out of reach, so the grunt never swings.
  tuning.debug.passiveEnemies = true;
  return { s, p, g, priest };
}

describe('the Bone Priest (E1e)', () => {
  it('is the leader role, with a brain, telling in violet', () => {
    expect(roleOf('priest')).toBe('leader');
    expect(brainFor('priest')).toBeDefined();
    expect(telegraphColour({ kind: 'priest', attack: '' })).toBe('magic');
  });

  it('a pack with a Priest refills until the Priest falls', () => {
    const { s, p, g, priest } = scene();
    try {
      // Killed three times, the warrior stands again each time while the Priest lives.
      for (let round = 0; round < 3; round++) {
        kill(s, p, g);
        let chanted = false;
        for (let i = 0; i < 600 && g.ai === 'dead'; i++) {
          stepEnemies(s, DT, world);
          if (priest.ai === 'chant' && priest.tele.shape === 'circle') chanted = true;
        }
        expect(chanted).toBe(true);
        expect(s.enemies).toContain(g);
        expect(g.ai).not.toBe('dead');
        expect(g.hp).toBeCloseTo(enemyStats('grunt').maxHp * tuning.priest.raiseHp);
        expect(g.risen).toBe(true);
        for (let i = 0; i < 120 && g.ai === 'spawn'; i++) stepEnemies(s, DT, world);
      }
      // The Priest falls: the warrior's next death is its last.
      for (let i = 0; i < 120 && priest.ai !== 'chase'; i++) stepEnemies(s, DT, world);
      kill(s, p, priest);
      kill(s, p, g);
      expect(raisable(s, g)).toBe(false);
      for (let i = 0; i < Math.ceil(enemyStats('grunt').deathMs / 1000 / DT) + 5; i++) stepEnemies(s, DT, world);
      expect(s.enemies).not.toContain(g);
    } finally {
      tuning.debug.passiveEnemies = false;
    }
  });

  it('keeps its distance behind the pack', () => {
    const { s, p, priest } = scene();
    try {
      Object.assign(priest, { x: 0, z: 7 });
      for (let i = 0; i < 120; i++) stepEnemies(s, DT, world);
      expect(Math.hypot(priest.x - p.x, priest.z - p.z)).toBeGreaterThan(tuning.priest.keepDistance - 1);
    } finally {
      tuning.debug.passiveEnemies = false;
    }
  });

  it('under Haunted, a raised one is the Priest\'s to raise again, never Haunted\'s', () => {
    const { s, p, g } = scene();
    try {
      s.floor = { modifier: 'haunted' } as SimState['floor'];
      kill(s, p, g);
      g.risen = true;
      expect(raisable(s, g)).toBe(true);
      s.floor = undefined;
    } finally {
      tuning.debug.passiveEnemies = false;
    }
  });
});
