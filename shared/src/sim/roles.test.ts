import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { DUNGEON_TYPES, DUNGEON_TYPE_IDS, dungeonTypeOf } from '../level/dungeonTypes';
import { generateFloor } from '../level/generate';
import { floorLevel } from '../level/floor';
import { readToHost } from '../net/validate';
import { STORY, choiceLabel, readPortalChoice } from '../game/portalChoice';
import { floorSpecFor, planChoice, readRunPlan } from '../game/runPlan';
import { brainFor } from './enemies';
import { KIND_ROLE, ROSTERS, dressing, roleOf, telegraphColour } from './roles';

const KINDS = Object.keys(KIND_ROLE) as EnemyKind[];

describe('enemy roles (E1a)', () => {
  it('steps every kind through its role brain, and kinds of one role through the same one', () => {
    for (const k of KINDS) expect(brainFor(k), k).toBeTypeOf('function');
    expect(roleOf('grunt')).toBe('fodder');
    expect(roleOf('archer')).toBe('archer');
    expect(roleOf('brute')).toBe('heavy');
    expect(roleOf('warden')).toBe('boss');
    expect(new Set(KINDS.map((k) => brainFor(k))).size).toBe(new Set(KINDS.map(roleOf)).size);
  });

  it('keeps every kind’s numbers in tuning', () => {
    for (const k of KINDS) expect(tuning[k].maxHp, k).toBeGreaterThan(0);
  });

  it('names today’s three as the Crypt’s, and lends the Crypt’s names to a type with no roster yet', () => {
    expect(dressing('grunt').name).toBe('Skeleton Warrior');
    expect(dressing('archer').name).toBe('Skeleton Archer');
    expect(dressing('brute').name).toBe('Bone Brute');
    expect(dressing('brute', 'goblinWarrens')).toEqual(ROSTERS.hauntedCrypt!.brute);
  });

  it('speaks the colour language: red a strike, orange a heavy, yellow a shot', () => {
    expect(telegraphColour({ kind: 'grunt', attack: '' })).toBe('strike');
    expect(telegraphColour({ kind: 'archer', attack: '' })).toBe('projectile');
    expect(telegraphColour({ kind: 'brute', attack: '' })).toBe('heavy');
    expect(telegraphColour({ kind: 'warden', attack: 'sweep' })).toBe('strike');
    expect(telegraphColour({ kind: 'warden', attack: 'slam' })).toBe('heavy');
    expect(telegraphColour({ kind: 'warden', attack: 'farSlam' })).toBe('heavy');
    // Armoured after a stagger (G1): nothing stops the blow, so it is heavy whatever it is.
    expect(telegraphColour({ kind: 'grunt', attack: '', armour: 2 })).toBe('heavy');
  });
});

describe('dungeon types (E1a)', () => {
  it('lists the design doc’s eight, with only the Haunted Crypt open', () => {
    expect(DUNGEON_TYPE_IDS).toHaveLength(8);
    expect(DUNGEON_TYPE_IDS.filter((t) => DUNGEON_TYPES[t].open)).toEqual(['hauntedCrypt']);
    expect(dungeonTypeOf({})).toBe('hauntedCrypt');
  });

  it('builds the same floor from a spec with and without a type', () => {
    for (const seed of [1, 77, 5404]) {
      const bare = { seed, pieces: 24, floor: 2, floors: 3 };
      const typed = { ...bare, type: 'hauntedCrypt' as const };
      // The spec rides along in what is built; everything else must be the same to the byte.
      const same = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'spec' ? undefined : x));
      expect(same(generateFloor(typed))).toBe(same(generateFloor(bare)));
      expect(same(floorLevel(typed))).toBe(same(floorLevel(bare)));
    }
  });

  it('carries a story dungeon’s type from Wren’s menu to every floor and over the ring', () => {
    for (const s of STORY) {
      const plan = planChoice([], 3, { kind: 'story', id: s.id });
      expect(plan.type).toBe(s.type);
      expect(floorSpecFor(plan, 1).type).toBe(s.type);
      expect(choiceLabel({ kind: 'story', id: s.id })).toBe(`${s.name}, a ${DUNGEON_TYPES[s.type].name}`);
    }
  });

  it('takes an open type from a browser, an old browser’s missing one as the Crypt, and refuses a locked one', () => {
    const base = { kind: 'random', floors: 2, size: 'small', difficulty: 1, modifier: null };
    expect(readPortalChoice({ ...base, type: 'hauntedCrypt' })).toMatchObject({ type: 'hauntedCrypt' });
    expect(readPortalChoice(base)).toMatchObject({ type: 'hauntedCrypt' });
    expect(readPortalChoice({ ...base, type: 'goblinWarrens' })).toBeNull();
    expect(readPortalChoice({ ...base, type: 'lava' })).toBeNull();
    expect(readToHost({ k: 'portal', choice: { ...base, type: 'forgeDepths' } })).toBeNull();
    const plan = planChoice([], 9, readPortalChoice(base)!);
    expect(floorSpecFor(plan, 2).type).toBe('hauntedCrypt');
  });

  it('ignores a locked or unknown type in a room’s create options', () => {
    expect(readRunPlan({ seed: 4, type: 'hauntedCrypt' }).type).toBe('hauntedCrypt');
    expect(readRunPlan({ seed: 4, type: 'wizardTower' }).type).toBeUndefined();
    expect(readRunPlan({ seed: 4, type: 7 }).type).toBeUndefined();
  });
});
