import { describe, expect, it } from 'vitest';
import { abilityTiming, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { stepPlayer } from './player';
import { specProblem, specsFor, tauntedBy } from './specs';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const at10 = xpForLevel(tuning.specs.level);
const base = (sword: number): Loadout => ({ name: 'p', xp: { sword, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });

describe('specializations (the builds pass, Michael A, 6 Nov)', () => {
  it('Melee offers the Paladin, the Spellblade and the Rogue; only the Paladin is built yet', () => {
    expect(specsFor('sword').map((s) => s.id)).toEqual(['paladin', 'spellblade', 'rogue']);
    expect(specsFor('sword').filter((s) => s.built).map((s) => s.id)).toEqual(['paladin']);
    expect(specsFor('sword')[0].element).toBe('holy');
  });

  it('is earned at the style level 10, and only for its own style', () => {
    expect(specProblem({ sword: at10, bow: 0, staff: 0 }, { sword: 'paladin' })).toBeNull();
    expect(specProblem({ sword: at10 - 1, bow: 0, staff: 0 }, { sword: 'paladin' })).not.toBeNull();
    expect(specProblem({ sword: at10, bow: at10, staff: 0 }, { bow: 'paladin' })).not.toBeNull();
    expect(specProblem({ sword: at10, bow: 0, staff: 0 }, { sword: 'rogue' })).not.toBeNull();
  });

  it('the server takes a Paladin only from a loadout whose sword could have earned it', () => {
    const ok = readLoadout({ ...base(at10), spec: { sword: 'paladin' } });
    expect(ok?.spec).toEqual({ sword: 'paladin' });
    expect(readLoadout({ ...base(at10 - 1), spec: { sword: 'paladin' } })).toBeNull();
    expect(readLoadout({ ...base(at10), spec: { sword: 'warlord' } })).toBeNull();
    expect(readLoadout(base(0))?.spec).toBeUndefined();
  });
});

/** A Paladin (or not) facing a Skeleton Warrior four metres off, and a friend standing right beside the enemy. */
function scene(paladin: boolean): { s: SimState; p: PlayerState; friend: PlayerState; e: ReturnType<typeof createEnemy> } {
  const s = createSimState(arena, [], world);
  const l = { ...base(at10), ...(paladin ? { spec: { sword: 'paladin' as const } } : {}) };
  const p = addPlayer(s, world, 'p1', l, false);
  const friend = addPlayer(s, world, 'p2', base(0), false);
  // Out in the open, as meleeGuard.test.ts's dash, facing down the arena.
  Object.assign(p, { x: 0, z: 10, yaw: Math.PI, invulnTime: 0 });
  Object.assign(friend, { x: 1.5, z: 5.5, invulnTime: 0 });
  const e = createEnemy(s, world, 'grunt', 0, 6, 0);
  Object.assign(e, { x: 0, z: 6, ai: 'chase', aiTime: 0, cooldown: 0, hp: 9999 });
  return { s, p, friend, e };
}

function charge(s: SimState, p: PlayerState): void {
  const t = abilityTiming('charge');
  stepPlayer(p, { ...idleCommand(), ability1: true, aimX: 0, aimZ: -1 }, DT, world, s);
  for (let i = 0; i < 120 && p.abilityTime < t.windup + t.active; i++) stepPlayer(p, idleCommand(), DT, world, s);
}

describe("the Paladin's Shield Rush", () => {
  it('Charge taunts the enemy it hits: it turns on the Paladin for 3 s, though a friend stands nearer', () => {
    const { s, p, friend, e } = scene(true);
    charge(s, p);
    expect(e.taunt).toEqual({ by: 'p1', until: expect.closeTo(s.time + tuning.specs.tauntSeconds, 1) });
    expect(s.events.some((ev) => ev.kind === 'taunt' && ev.enemyId === e.id)).toBe(true);
    // Walk the Paladin back out so the friend is plainly nearer.
    Object.assign(p, { x: 0, z: 12, mode: 'idle' });
    expect(Math.hypot(friend.x - e.x, friend.z - e.z)).toBeLessThan(Math.hypot(p.x - e.x, p.z - e.z));
    expect(tauntedBy(s, e)).toBe(p);
    s.time = e.taunt!.until + 0.01;
    expect(tauntedBy(s, e)).toBeNull();
    expect(e.taunt).toBeUndefined();
  });

  it('the taunted enemy walks toward the Paladin, not the nearer friend', () => {
    const { s, p, e } = scene(true);
    charge(s, p);
    Object.assign(p, { x: -6, z: 6, mode: 'idle' });
    Object.assign(e, { ai: 'chase', aiTime: 0, x: 0, z: 6, kbx: 0, kbz: 0 });
    const x0 = e.x;
    for (let i = 0; i < 30; i++) stepEnemies(s, DT, world);
    expect(e.x).toBeLessThan(x0 - 0.3);
  });

  it('a hero without the Paladin taunts nothing, and a downed Paladin lets go', () => {
    const a = scene(false);
    charge(a.s, a.p);
    expect(a.e.taunt).toBeUndefined();
    const b = scene(true);
    charge(b.s, b.p);
    b.p.mode = 'down';
    expect(tauntedBy(b.s, b.e)).toBeNull();
  });

  it('a loadout without a specialization takes it off the hero', () => {
    const { p } = scene(true);
    expect(p.spec).toEqual({ sword: 'paladin' });
    applyLoadout(p, base(at10), false);
    expect(p.spec).toBeUndefined();
  });
});
