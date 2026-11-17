import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { hurtHero } from './combat';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { holyPulse } from './specs';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// B8 (Michael, 17 Nov, A; docs/bosses.md 1.6): with a shield in the off-hand the guard is the tank's
// stance: a half-speed walk, and a heavy pushes the tank back at half damage instead of breaking it.
// The Paladin's Bulwark pulse also gives it 30% less damage for 3 s.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { stance: tuning.guard.shieldStance };
afterEach(() => {
  tuning.guard.shieldStance = kept.stance;
});

/** A guarding hero at the arena's middle, facing +z, with `offhand` held (or nothing). */
function guarding(offhand?: 'shield' | 'buckler' | 'tome'): { s: SimState; p: PlayerState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...(offhand ? { offhand } : {}) } }, false);
  Object.assign(p, { x: 0, z: -6, yaw: 0, mode: 'guard', guardTime: 1, parryOpen: false, invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
  return { s, p };
}

/** Metres walked forward behind the guard in half a second. */
function walk(offhand?: 'shield' | 'buckler' | 'tome'): number {
  const { s, p } = guarding(offhand);
  const z0 = p.z;
  for (let i = 0; i < 30; i++) stepPlayer(p, { ...idleCommand(), block: true, moveZ: 1, aimX: 0, aimZ: 1 }, DT, world, s);
  expect(p.mode).toBe('guard');
  return p.z - z0;
}

describe("the tank's stance (B8)", () => {
  it('walks at half speed behind a shield or a buckler, and at the old guard speed without one', () => {
    tuning.guard.shieldStance = true;
    const bare = walk();
    const shield = walk('shield');
    expect(walk('buckler')).toBeCloseTo(shield, 5);
    expect(walk('tome')).toBeCloseTo(bare, 5);
    expect(shield / bare).toBeCloseTo(tuning.guard.stanceMoveFrac / tuning.guard.moveSpeedFrac, 1);
    tuning.guard.shieldStance = false;
    expect(walk('shield')).toBeCloseTo(bare, 5);
  });

  it('a heavy on the shield pushes the tank back at half damage, guard still up', () => {
    tuning.guard.shieldStance = true;
    const { s, p } = guarding('shield');
    const r = hurtHero(s, p, { damage: 100, heavy: true, push: 3, fromX: 0, fromZ: -3 });
    expect(r).toBe('blocked');
    expect(p.mode).toBe('guard');
    expect(p.hp).toBeCloseTo(1000 - 100 * tuning.guard.stanceHeavyDamageFrac, 5);
    expect(s.events.some((e) => e.kind === 'block' && !e.broke)).toBe(true);
    // Driven back: away from the blow (it came from in front, at +z).
    const z0 = p.z;
    for (let i = 0; i < 20; i++) stepPlayer(p, { ...idleCommand(), block: true, aimX: 0, aimZ: 1 }, DT, world, s);
    expect(z0 - p.z).toBeGreaterThan(0.3);
  });

  it('without a shield, or with the switch off, a heavy still breaks the guard', () => {
    tuning.guard.shieldStance = true;
    const bare = guarding();
    hurtHero(bare.s, bare.p, { damage: 100, heavy: true, fromX: 0, fromZ: -3 });
    expect(bare.p.mode).toBe('hurt');
    tuning.guard.shieldStance = false;
    const off = guarding('shield');
    hurtHero(off.s, off.p, { damage: 100, heavy: true, fromX: 0, fromZ: -3 });
    expect(off.p.mode).toBe('hurt');
  });

  it("Bulwark's pulse gives the Paladin 30% less damage for 3 s, and nobody else", () => {
    const { s, p } = guarding();
    p.spec = { sword: 'paladin' };
    p.style = 'sword';
    p.mode = 'move';
    holyPulse(s, p);
    expect(p.bulwarkUntil).toBeCloseTo(s.time + tuning.specs.bulwarkReductionMs / 1000, 5);
    p.hp = 1000;
    hurtHero(s, p, { damage: 100, fromX: 0, fromZ: -3, late: true });
    expect(1000 - p.hp).toBeCloseTo(100 * (1 - tuning.specs.bulwarkReduction), 5);
    // Past its time it is gone.
    s.time += tuning.specs.bulwarkReductionMs / 1000 + 0.1;
    p.hp = 1000;
    p.mode = 'move';
    hurtHero(s, p, { damage: 100, fromX: 0, fromZ: -3, late: true });
    expect(1000 - p.hp).toBeCloseTo(100, 5);
    expect(p.bulwarkUntil).toBeUndefined();

    const other = guarding();
    holyPulse(other.s, other.p);
    expect(other.p.bulwarkUntil).toBeUndefined();
  });
});
