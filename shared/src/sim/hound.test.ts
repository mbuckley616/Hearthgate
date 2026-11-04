import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { roleOf, telegraphColour } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

/** A Hound facing a hero six metres off, both on the arena's floor, the Hound's back to the middle and the wall beyond the hero. */
function scene(): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const e = createEnemy(s, world, 'hound', 0, EDGE - 9, 0);
  Object.assign(e, { x: 0, z: EDGE - 9, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, e };
}

describe('the Crypt Hound (E1c)', () => {
  it('is the charger role, with a brain, telling in yellow', () => {
    expect(roleOf('hound')).toBe('charger');
    expect(brainFor('hound')).toBeDefined();
    expect(telegraphColour({ kind: 'hound', attack: 'charge' })).toBe('projectile');
  });

  it('winds up a yellow line along its path; standing in it knocks a hero down', () => {
    const { s, p, e } = scene();
    let line = false;
    for (let i = 0; i < 180 && p.hp === p.maxHp; i++) {
      Object.assign(p, { x: 0, z: EDGE - 3 });
      stepEnemies(s, DT, world);
      if (e.ai === 'chargeWindup' && e.tele.shape === 'line' && e.tele.radius === tuning.hound.chargeLength) line = true;
    }
    expect(line).toBe(true);
    expect(p.hp).toBe(p.maxHp - tuning.hound.chargeDamage);
    expect(p.mode).toBe('hurt');
  });

  it('a sidestep after the line locks makes it miss and stun against the wall: the punish window', () => {
    const { s, p, e } = scene();
    let stunned = false;
    for (let i = 0; i < 240 && !stunned; i++) {
      // Stand in the line until it locks, then step two metres aside.
      const locked = e.ai === 'charge' || (e.ai === 'chargeWindup' && e.aiTime >= (tuning.hound.telegraphMs / 1000) * tuning.hound.trackFrac);
      Object.assign(p, { x: locked ? 2.5 : 0, z: EDGE - 3 });
      stepEnemies(s, DT, world);
      if (e.ai === 'stagger') stunned = true;
    }
    expect(p.hp).toBe(p.maxHp);
    expect(stunned).toBe(true);
    expect(e.z).toBeGreaterThan(EDGE - 2);
    // It stays stunned for wallStunMs, then hunts again.
    let ticks = 0;
    while (e.ai === 'stagger' && ticks < 600) {
      stepEnemies(s, DT, world);
      ticks++;
    }
    expect(ticks * DT).toBeCloseTo(tuning.hound.wallStunMs / 1000, 1);
  });

  it('a rush that meets nothing runs its length and stops, short of the wall', () => {
    const { s, p, e } = scene();
    Object.assign(e, { z: EDGE - 15 });
    let ran = false;
    for (let i = 0; i < 300; i++) {
      Object.assign(p, { x: e.ai === 'charge' ? 3 : 0, z: EDGE - 9 });
      if (e.ai === 'charge') ran = true;
      stepEnemies(s, DT, world);
      if (ran && e.ai !== 'charge') break;
    }
    expect(ran).toBe(true);
    expect(e.ai).toBe('recover');
    expect(e.z).toBeGreaterThan(EDGE - 15 + tuning.hound.chargeLength - 1.5);
    expect(p.hp).toBe(p.maxHp);
  });
});
