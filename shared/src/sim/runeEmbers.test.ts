import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel, type Mods } from './gear';
import { stepPlayer } from './player';
import { stepProjectiles } from './projectiles';
import { emptyTalents } from './talents';
import { idleCommand, type EnemyState, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// Rune of Embers (the builds pass, Michael's A, 12 Nov): every charged shot from a bow bursts in a
// ring of fire where it stops, hitting what stands in it and, with the element states, leaving it Burning.

const world = buildWorld(arena);
const DT = 1 / 60;
const kept = tuning.combos.elementStates;
const pierce = tuning.rangedCombo.powerPierce;
afterEach(() => {
  tuning.combos.elementStates = kept;
  tuning.rangedCombo.powerPierce = pierce;
});

function setup(mods: Partial<Mods>) {
  const s = createSimState(arena, [], world);
  const xp = xpForLevel(20);
  const l: Loadout = { name: 'p', xp: { sword: xp, bow: xp, staff: xp }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'bow';
  p.x = 3;
  p.z = -2;
  p.yaw = 0;
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return { s, p };
}

function enemyAt(s: SimState, x: number, z: number): EnemyState {
  const e = createEnemy(s, world, 'grunt', x, z, Math.PI);
  e.x = x;
  e.z = z;
  // Not stepped, so it stands where it was put.
  e.ai = 'chase';
  e.hp = e.maxHp = 1000;
  return e;
}

/** One attack (held for a heavy), stepping the hero and what it looses for `ticks`; the bursts seen. */
function shoot(s: SimState, p: PlayerState, held: boolean, ticks = 150): number {
  let bursts = 0;
  for (let t = 0; t < ticks; t++) {
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: held && t < 60 }, DT, world, s);
    stepProjectiles(s, DT, world.colliders);
    bursts += s.events.filter((e) => e.kind === 'embers').length;
    s.events = [];
  }
  return bursts;
}

describe('Rune of Embers', () => {
  it('a charged shot bursts once where it stops; a light shot does not', () => {
    const a = setup({ runes: ['embers'] });
    expect(shoot(a.s, a.p, true)).toBe(1);
    const b = setup({ runes: ['embers'] });
    expect(shoot(b.s, b.p, false)).toBe(0);
  });

  it('without the rune a charged shot does not burst', () => {
    const { s, p } = setup({});
    expect(shoot(s, p, true)).toBe(0);
  });

  it('the ring hits the struck enemy and its neighbour, and leaves them Burning', () => {
    tuning.combos.elementStates = true;
    // A charged shot pierces; here the first enemy stops it.
    tuning.rangedCombo.powerPierce = 1;
    const { s, p } = setup({ runes: ['embers'] });
    const struck = enemyAt(s, 3, 4);
    const beside = enemyAt(s, 4.2, 4.6);
    const far = enemyAt(s, 8, 4);
    const before = { beside: beside.hp, far: far.hp };
    expect(shoot(s, p, true, 90)).toBe(1);
    expect(struck.detonateUntil).toBeGreaterThan(s.time);
    expect(beside.hp).toBeLessThan(before.beside);
    expect(beside.detonateUntil).toBeGreaterThan(s.time);
    expect(far.hp).toBe(before.far);
  });

  it('a piercing shot bursts where it is spent, past the enemies it went through', () => {
    const { s, p } = setup({ runes: ['embers'] });
    const near = enemyAt(s, 3, 3);
    const at: { z: number }[] = [];
    for (let t = 0; t < 150; t++) {
      stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: t < 60 }, DT, world, s);
      stepProjectiles(s, DT, world.colliders);
      for (const e of s.events) if (e.kind === 'embers') at.push(e);
      s.events = [];
    }
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(at).toHaveLength(1);
    expect(at[0].z).toBeGreaterThan(near.z + 3);
  });

  it('with the element states off it burns nothing', () => {
    tuning.combos.elementStates = false;
    tuning.rangedCombo.powerPierce = 1;
    const { s, p } = setup({ runes: ['embers'] });
    const beside = enemyAt(s, 4.2, 4.6);
    enemyAt(s, 3, 4);
    const hp = beside.hp;
    shoot(s, p, true, 90);
    expect(beside.hp).toBeLessThan(hp);
    expect(beside.detonateUntil).toBeLessThan(s.time);
  });
});
