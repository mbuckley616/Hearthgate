import { afterEach, describe, expect, it } from 'vitest';
import { abilityTiming, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { hurtHero } from './combat';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.abilities.meleeGuard;
afterEach(() => {
  tuning.abilities.meleeGuard = kept;
});

function hero(): { s: SimState; p: PlayerState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  // Out in the open, facing an empty stretch of floor, so the dash runs its length.
  // Without the joiner's few seconds of grace (coop.ts), so every hit is the ability's to turn.
  Object.assign(p, { x: 0, z: 10, yaw: Math.PI, invulnTime: 0 });
  return { s, p };
}

/** Step until `until` holds, a tick at a time. */
function stepUntil(s: SimState, p: PlayerState, until: () => boolean, first = idleCommand()): void {
  stepPlayer(p, first, DT, world, s);
  for (let i = 0; i < 240 && !until(); i++) stepPlayer(p, idleCommand(), DT, world, s);
}

/** Put a hero in a Whirlwind's spin, partway through. */
function spin(p: PlayerState): void {
  const t = abilityTiming('whirlwind');
  Object.assign(p, { mode: 'ability', ability: 'whirlwind', abilityTime: t.windup + t.active / 2, abilityFired: true });
}

const heavy = (p: PlayerState) => ({ damage: 20, heavy: true, push: 4, fromX: p.x + 1, fromZ: p.z, late: true });

describe('melee abilities that protect (C6; Michael, 29 Oct)', () => {
  it('Charge: invulnerable for its dash, as a roll is, and not in its windup or recovery', () => {
    const { s, p } = hero();
    const t = abilityTiming('charge');
    stepUntil(s, p, () => p.abilityTime >= t.windup + 0.05, { ...idleCommand(), ability1: true, aimX: 0, aimZ: -1 });
    expect(p.mode).toBe('ability');
    expect(p.ability).toBe('charge');
    expect(p.invulnerable).toBe(true);
    expect(hurtHero(s, p, heavy(p))).toBe('none');
    expect(p.hp).toBe(100);
    stepUntil(s, p, () => p.abilityTime >= t.windup + t.active + 0.02);
    expect(p.invulnerable).toBe(false);
    expect(hurtHero(s, p, heavy(p))).toBe('hit');
    expect(p.hp).toBe(80);
  });

  it('Whirlwind: a heavy hit mid-spin costs whirlwindDamageTaken of it and the spin goes on', () => {
    const { s, p } = hero();
    spin(p);
    expect(hurtHero(s, p, heavy(p))).toBe('hit');
    expect(p.hp).toBeCloseTo(100 - 20 * tuning.abilities.whirlwindDamageTaken);
    expect(p.hp).toBeCloseTo(94);
    expect(p.mode).toBe('ability');
    expect(p.ability).toBe('whirlwind');
  });

  it('is off for the slice: the dash takes hits and a heavy hit ends the spin', () => {
    tuning.abilities.meleeGuard = false;
    const a = hero();
    const t = abilityTiming('charge');
    stepUntil(a.s, a.p, () => a.p.abilityTime >= t.windup + 0.05, { ...idleCommand(), ability1: true, aimX: 0, aimZ: -1 });
    expect(a.p.invulnerable).toBe(false);
    const b = hero();
    spin(b.p);
    expect(hurtHero(b.s, b.p, heavy(b.p))).toBe('hit');
    expect(b.p.hp).toBe(80);
    expect(b.p.mode).toBe('hurt');
  });
});
