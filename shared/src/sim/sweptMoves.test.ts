import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld, type World } from '../level/arena';
import { sweptDistance, type Collider } from '../level/geometry';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy } from './combat';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand } from './types';
import { createSimState } from './world';

const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const base = buildWorld(arena);
/** A thin wall (0.2 m, full height) across the arena's open west at x = -6. */
const wall: Collider = { kind: 'box', id: 'thin', fadeable: false, min: { x: -6.1, y: 0, z: -14 }, max: { x: -5.9, y: 7, z: 14 }, blocksMovement: true, blocksCamera: true };
const world: World = { ...base, colliders: [...base.colliders, wall] };
const kept = tuning.combat.sweepFastMoves;
afterEach(() => {
  tuning.combat.sweepFastMoves = kept;
});

/** A grunt against the wall's west face, killed by a warhammer heavy along +x (a 7.5 m launch). */
function launchAtWall(): number {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: -9, z: 3 });
  p.mods.family = 'warhammer';
  const e = createEnemy(s, world, 'grunt', -6.6, 3, 0);
  Object.assign(e, { x: -6.6, z: 3, ai: 'chase', aiTime: 0, hp: 1 });
  damageEnemy(s, e, { attackerId: p.id, damage: 30, poise: 0, knockback: 0.5, heavy: true, dirX: 1, dirZ: 0, x: e.x, y: e.y + 1, z: e.z, style: 'sword' });
  expect(e.ai).toBe('dead');
  for (let i = 0; i < 90; i++) stepEnemies(s, DT, world);
  return e.x;
}

describe('fast moves stop at walls (bodies outside the walls, 2 Nov)', () => {
  it('sweptDistance stops a move at a thin wall and lets a body against it move away', () => {
    expect(sweptDistance(-6.6, 0, 3, 1.2, 0, 0.5, [wall])).toBeLessThan(0.5);
    expect(sweptDistance(-6.6, 0, 3, -1.2, 0, 0.5, [wall])).toBeCloseTo(1.2);
  });

  it('a launched corpse stays on its side of a thin wall', () => {
    expect(launchAtWall()).toBeLessThan(-6.1);
  });

  it('switched off (the slice), the same launch tunnels through: the bug this fixes', () => {
    tuning.combat.sweepFastMoves = false;
    expect(launchAtWall()).toBeGreaterThan(-5.9);
  });

  it('soft targeting skips an enemy behind a wall, and a lunge never carries the hero through one', () => {
    const run = (lock = false) => {
      const s = createSimState(arena, [], world);
      const p = addPlayer(s, world, 'p1', loadout, false);
      Object.assign(p, { x: -6.6, z: 3, yaw: Math.PI / 2, invulnTime: 0 });
      const e = createEnemy(s, world, 'grunt', -4.5, 3, 0);
      Object.assign(e, { x: -4.5, z: 3, ai: 'chase', aiTime: 0 });
      const cmd: PlayerCommand = { ...idleCommand(), aimX: 1, aimZ: 0, lockTarget: lock ? e.id : -1 };
      stepPlayer(p, { ...cmd, attack: true }, DT, world, s);
      const target = p.attackTarget;
      let maxX = p.x;
      for (let i = 0; i < 40; i++) {
        stepPlayer(p, cmd, DT, world, s);
        maxX = Math.max(maxX, p.x);
      }
      return { target, enemy: e.id, maxX };
    };
    const on = run();
    expect(on.target).toBe(-1);
    expect(on.maxX).toBeLessThan(-6.1);
    tuning.combat.sweepFastMoves = false;
    const off = run();
    expect(off.target).toBe(off.enemy);
    // A lock-on still takes it, and the lunge stretched toward it stops at the stone.
    tuning.combat.sweepFastMoves = true;
    const locked = run(true);
    expect(locked.target).toBe(locked.enemy);
    expect(locked.maxX).toBeLessThan(-6.1);
  });
});
