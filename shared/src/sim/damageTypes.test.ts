import { afterEach, describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { stepProjectiles } from './projectiles';
import { attackType, telegraphTell } from './roles';
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
function typesFrom(kind: EnemyKind, at: number, seconds = 20, told?: Array<{ told: DamageType; landed?: DamageType }>): Set<DamageType | undefined> {
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
    for (const ev of s.events as SimEvent[]) if (ev.kind === 'heroHurt') {
      seen.add(ev.type);
      // What the telegraph showed for the blow that landed (B4): the enemy's attack as it lands.
      told?.push({ told: attackType(e), landed: ev.type });
    }
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

describe('telegraphs by type (B4)', () => {
  const CASES: Array<[EnemyKind, number, number]> = [
    ['grunt', 1.4, 20],
    ['archer', 5, 20],
    ['brute', 3, 20],
    ['warden', 2.4, 40],
    ['king', 1.8, 20],
  ];
  for (const [kind, at, seconds] of CASES) {
    it(`shows the ${kind}'s blows in the type they land as`, () => {
      const told: Array<{ told: DamageType; landed?: DamageType }> = [];
      typesFrom(kind, at, seconds, told);
      expect(told.length).toBeGreaterThan(0);
      for (const t of told) expect(t.told).toBe(t.landed);
    });
  }

  it('colours by type and rims what was orange, with types on', () => {
    expect(telegraphTell({ kind: 'grunt', attack: '' }, true)).toEqual({ colour: 'strike', type: 'edge', rim: false });
    expect(telegraphTell({ kind: 'archer', attack: '' }, true)).toEqual({ colour: 'projectile', type: 'pierce', rim: false });
    // A slam was an orange fill; it is a red blunt blow with the rim now.
    expect(telegraphTell({ kind: 'brute', attack: '' }, true)).toEqual({ colour: 'strike', type: 'blunt', rim: true });
    expect(telegraphTell({ kind: 'warden', attack: 'slam' }, true)).toEqual({ colour: 'strike', type: 'blunt', rim: true });
    expect(telegraphTell({ kind: 'warden', attack: 'sweep' }, true)).toEqual({ colour: 'strike', type: 'edge', rim: false });
    // A charge was yellow; a Hound's teeth are melee, red.
    expect(telegraphTell({ kind: 'hound', attack: 'charge' }, true)).toEqual({ colour: 'strike', type: 'edge', rim: false });
    expect(telegraphTell({ kind: 'knight', attack: 'charge' }, true)).toEqual({ colour: 'strike', type: 'blunt', rim: true });
    expect(telegraphTell({ kind: 'wraith', attack: '' }, true)).toEqual({ colour: 'magic', type: 'magic', rim: false });
    // The King (docs/bosses.md 1.5): string red, crown yellow, circles violet, the crown's sweep red with a rim.
    expect(telegraphTell({ kind: 'king', attack: 'string' }, true).rim).toBe(false);
    expect(telegraphTell({ kind: 'king', attack: 'crown' }, true).colour).toBe('projectile');
    expect(telegraphTell({ kind: 'king', attack: 'circles' }, true).colour).toBe('magic');
    expect(telegraphTell({ kind: 'king', attack: 'crownSweep' }, true)).toEqual({ colour: 'strike', type: 'edge', rim: true });
    // An enemy armoured after a stagger: its own type, rimmed.
    expect(telegraphTell({ kind: 'grunt', attack: '', armour: 2 }, true)).toEqual({ colour: 'strike', type: 'edge', rim: true });
  });

  it('keeps E1a\'s colours with no rim when types are off', () => {
    expect(telegraphTell({ kind: 'brute', attack: '' }, false)).toEqual({ colour: 'heavy', rim: false });
    expect(telegraphTell({ kind: 'hound', attack: 'charge' }, false)).toEqual({ colour: 'projectile', rim: false });
  });
});
