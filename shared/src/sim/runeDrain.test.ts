import { describe, expect, it } from 'vitest';
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

// Rune of Draining (the builds pass, Michael's A, 11 Nov): every staff heavy's orb gives the caster
// back a share of what it deals; a light orb never does.

const world = buildWorld(arena);
const DT = 1 / 60;
// A lane clear of the arena's pillars, on the floor below the ledge.
const X = 3;

function setup(mods: Partial<Mods>) {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'staff';
  p.x = X;
  p.z = 0;
  p.yaw = 0;
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  p.hp = 40;
  const e = createEnemy(s, world, 'grunt', X, 5, Math.PI);
  e.x = X;
  e.z = 5;
  e.ai = 'chase';
  e.hp = e.maxHp = 1000;
  return { s, p, e };
}

/** Attack (held for a heavy) and let what it looses fly; the hero's health gained and the enemy's lost. */
function cast(s: SimState, p: PlayerState, e: EnemyState, held: boolean): { healed: number; dealt: number; drains: number } {
  const hp = p.hp;
  const ehp = e.hp;
  let drains = 0;
  for (let t = 0; t < 150; t++) {
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: held && t < 90 }, DT, world, s);
    if (s.projectiles.some((pr) => pr.drains)) drains++;
    stepProjectiles(s, DT, world.colliders);
  }
  return { healed: p.hp - hp, dealt: ehp - e.hp, drains };
}

describe('Rune of Draining', () => {
  it('a staff heavy’s orb heals the caster its share of what it dealt', () => {
    const { s, p, e } = setup({ runes: ['drain'] });
    const r = cast(s, p, e, true);
    expect(r.drains).toBeGreaterThan(0);
    expect(r.dealt).toBeGreaterThan(0);
    expect(r.healed).toBeCloseTo(r.dealt * tuning.runes.drainShare, 5);
    expect(s.events.some((ev) => ev.kind === 'runeDrain')).toBe(true);
  });

  it('a light orb, or a heavy without the rune, heals nothing', () => {
    const a = setup({ runes: ['drain'] });
    const light = cast(a.s, a.p, a.e, false);
    expect(light.dealt).toBeGreaterThan(0);
    expect(light.healed).toBe(0);
    const b = setup({});
    const plain = cast(b.s, b.p, b.e, true);
    expect(plain.dealt).toBeGreaterThan(0);
    expect(plain.healed).toBe(0);
  });

  it('never past full health', () => {
    const { s, p, e } = setup({ runes: ['drain'] });
    p.hp = p.maxHp - 0.5;
    cast(s, p, e, true);
    expect(p.hp).toBe(p.maxHp);
  });
});
