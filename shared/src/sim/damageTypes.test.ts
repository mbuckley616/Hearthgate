import { afterEach, describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { stepProjectiles } from './projectiles';
import { emptyTalents } from './talents';
import type { DamageType, SimEvent } from './types';
import { createSimState } from './world';

// B3, damage types (docs/bosses.md 1.5; Michael's A on the document, 16 Nov): every enemy hit on a
// hero says what it is, blunt or edge for melee, pierce for ranged, magic for magic. Nothing in the
// fight reads it yet; B4's colours and B6's resists will.

const world = buildWorld(arena);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const OZ = -9;
const kept = { types: tuning.bosses.damageTypes, passive: tuning.debug.passiveEnemies };
afterEach(() => {
  tuning.bosses.damageTypes = kept.types;
  tuning.debug.passiveEnemies = kept.passive;
});

/** Every type of hit `kind` lands on a hero standing `at` metres off in `seconds`. */
function typesFrom(kind: EnemyKind, at: number, seconds = 20): Set<DamageType | undefined> {
  tuning.debug.passiveEnemies = false;
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  // Open floor south of the arena's middle, where even a Brute rises where it is put.
  const e = createEnemy(s, world, kind, 0, OZ, 0);
  Object.assign(e, { ai: 'chase', aiTime: 0, cooldown: 0 });
  const seen = new Set<DamageType | undefined>();
  for (let i = 0; i < seconds * 60; i++) {
    // A hero who neither moves nor falls: put back each tick, hit after hit.
    // An archer keeps its distance along the arena's edge and waits for a clear line: it gets one, its
    // hero in front of it wherever it stands.
    const ranged = kind === 'archer';
    if (ranged && e.ai === 'chase' && e.cooldown <= 0) Object.assign(e, { hasToken: true, ai: 'aim', aiTime: 0 });
    Object.assign(p, { x: ranged ? e.x : 0, z: ranged ? e.z + at : OZ + at, y: 0, vx: 0, vz: 0, mode: 'move', hp: 1e6, maxHp: 1e6, invulnerable: false, invulnTime: 0, lagGrace: 0, guard: false });
    // Its turn to attack: the token a crowd shares out, which a lone enemy may still wait on.
    if (kind === 'brute' && e.ai === 'chase') e.hasToken = true;
    s.events = [];
    stepEnemies(s, 1 / 60, world);
    stepProjectiles(s, 1 / 60, world.colliders);
    s.time += 1 / 60;
    for (const ev of s.events as SimEvent[]) if (ev.kind === 'heroHurt') seen.add(ev.type);
  }
  return seen;
}

describe('damage types on enemy hits (B3)', () => {
  it('gives the skeleton warrior’s sword edge', () => {
    expect([...typesFrom('grunt', 1.4)]).toEqual(['edge']);
  });

  it('gives the archer’s arrows pierce', () => {
    expect([...typesFrom('archer', 5)]).toEqual(['pierce']);
  });

  it('gives the Bone Brute’s slam blunt', () => {
    expect([...typesFrom('brute', 3)]).toEqual(['blunt']);
  });

  it('gives the Warden’s slam blunt and its sweep edge', () => {
    const seen = typesFrom('warden', 2.4, 40);
    expect(seen.has('blunt')).toBe(true);
    expect(seen.has('edge')).toBe(true);
    expect(seen.has(undefined)).toBe(false);
  });

  it('gives the Hollow King’s string edge', () => {
    const seen = typesFrom('king', 1.8);
    expect(seen.has('edge')).toBe(true);
    expect(seen.has(undefined)).toBe(false);
  });

  it('gives a hit no type with the switch off, as the slice had none', () => {
    tuning.bosses.damageTypes = false;
    expect([...typesFrom('grunt', 1.4)]).toEqual([undefined]);
  });
});
