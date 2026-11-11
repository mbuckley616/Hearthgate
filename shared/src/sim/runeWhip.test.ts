import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel, type Mods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type EnemyState, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// Rune of the Whip (the builds pass, Michael's A, 11 Nov): every sword heavy lashes a fire whip ahead,
// hitting what stands in its line past the swing's reach, and with element states leaving it Burning.

const world = buildWorld(arena);
const DT = 1 / 60;
const kept = tuning.combos.elementStates;
afterEach(() => {
  tuning.combos.elementStates = kept;
});

function setup(mods: Partial<Mods>) {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'sword';
  p.x = X;
  p.z = 0;
  p.yaw = 0;
  // Let the hero land from where it was placed.
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return { s, p };
}

function enemyAt(s: SimState, x: number, z: number): EnemyState {
  const e = createEnemy(s, world, 'grunt', x, z, Math.PI);
  e.x = x;
  e.z = z;
  e.ai = 'chase';
  e.hp = e.maxHp = 1000;
  return e;
}

/** A held attack until the heavy's hit has opened; whips lashed. */
function heavy(s: SimState, p: PlayerState): number {
  let whips = 0;
  for (let t = 0; t < 90; t++) {
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: true }, DT, world, s);
    whips += s.events.filter((e) => e.kind === 'whip').length;
    s.events = [];
  }
  return whips;
}

/** Taps a light first step; whips lashed. */
function light(s: SimState, p: PlayerState): number {
  let whips = 0;
  for (let t = 0; t < 60; t++) {
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0 }, DT, world, s);
    whips += s.events.filter((e) => e.kind === 'whip').length;
    s.events = [];
  }
  return whips;
}

// A near enemy draws the heavy's lunge and takes the swing; the whip is for the one behind it.
// A lane clear of the arena's pillars.
const X = 3;
const NEAR = 2.5;
const FAR = 7.5;

describe('Rune of the Whip', () => {
  it('a heavy lashes once and cuts an enemy behind the one it swung at', () => {
    const { s, p } = setup({ runes: ['whip'] });
    enemyAt(s, X, NEAR);
    const far = enemyAt(s, X, FAR);
    const aside = enemyAt(s, X - 3, FAR);
    expect(heavy(s, p)).toBe(1);
    expect(p.attackCharge).toBeDefined();
    expect(far.hp).toBeLessThan(1000);
    expect(aside.hp).toBe(1000);
  });

  it('a light step, or a heavy without the rune, lashes nothing', () => {
    const a = setup({ runes: ['whip'] });
    enemyAt(a.s, X, NEAR);
    const e1 = enemyAt(a.s, X, FAR);
    expect(light(a.s, a.p)).toBe(0);
    expect(e1.hp).toBe(1000);
    const b = setup({});
    enemyAt(b.s, X, NEAR);
    const e2 = enemyAt(b.s, X, FAR);
    expect(heavy(b.s, b.p)).toBe(0);
    expect(e2.hp).toBe(1000);
  });

  it('leaves what it cuts Burning with element states on, and not with them off', () => {
    tuning.combos.elementStates = true;
    const a = setup({ runes: ['whip'] });
    enemyAt(a.s, X, NEAR);
    const e1 = enemyAt(a.s, X, FAR);
    heavy(a.s, a.p);
    expect(e1.detonateUntil).toBeGreaterThan(a.s.time);
    tuning.combos.elementStates = false;
    const b = setup({ runes: ['whip'] });
    enemyAt(b.s, X, NEAR);
    const e2 = enemyAt(b.s, X, FAR);
    heavy(b.s, b.p);
    expect(e2.hp).toBeLessThan(1000);
    expect(e2.detonateUntil).toBeLessThan(b.s.time);
  });

  it('does not reach past its length', () => {
    const { s, p } = setup({ runes: ['whip'] });
    enemyAt(s, X, NEAR);
    const beyond = enemyAt(s, X, p.z + tuning.runes.whipRangeM + 1.5);
    expect(heavy(s, p)).toBe(1);
    expect(beyond.hp).toBe(1000);
  });
});
