import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { readGearItem, readLoadout } from '../net/validate';
import { entryOf, rollGear, socketRune, socketsOf, unsocketRune, wornMods, type GearItem } from './catalogue';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import { activeRunes, hasRune, socketCount } from './runes';

// Runes in weapon sockets (the builds pass, Michael's A, 11 Nov): 0 to 2 sockets by rarity, a rune in
// one changes the finisher or every heavy. This is the sockets and the path to the fight.

const kept = { ...tuning.runes };
afterEach(() => Object.assign(tuning.runes, kept));

const item = (id: string, rarity: 'common' | 'rare' = 'common', runes?: GearItem['runes']): GearItem => ({
  uid: 'u1',
  id,
  rarity,
  perk: null,
  bonus: null,
  ...(runes ? { runes } : {}),
});

describe('sockets', () => {
  it('a rare weapon has two, a steel common one, a bronze common none', () => {
    expect(socketsOf(item('steel-sword', 'rare'))).toBe(2);
    expect(socketsOf(item('steel-sword'))).toBe(1);
    expect(socketsOf(item('bronze-sword'))).toBe(0);
  });
  it('nothing but a weapon has any', () => {
    expect(socketsOf(item('steel-platebody', 'rare'))).toBe(0);
    expect(socketCount('shield', 'rare', 6)).toBe(0);
  });
  it('the panel moves them, never past two', () => {
    tuning.runes.commonSocketTier = 1;
    expect(socketsOf(item('bronze-sword'))).toBe(1);
    tuning.runes.rareSockets = 9;
    expect(socketsOf(item('bronze-sword', 'rare'))).toBe(2);
  });
});

describe('setting and taking out', () => {
  it('fills sockets in order, refuses a third and a second of the same', () => {
    const one = socketRune(item('steel-sword', 'rare'), 'blades', 0)!;
    expect(one.runes).toEqual(['blades']);
    expect(socketRune(one, 'whip', 2)).toBeNull();
    expect(socketRune(one, 'blades', 1)).toBeNull();
    const two = socketRune(one, 'whip', 1)!;
    expect(two.runes).toEqual(['blades', 'whip']);
    expect(socketRune(item('bronze-sword'), 'blades', 0)).toBeNull();
    expect(socketRune(item('steel-sword', 'rare'), 'blades', 1)).toBeNull();
  });
  it('taking one out hands it back and closes the gap', () => {
    const { item: left, rune } = unsocketRune(item('steel-sword', 'rare', ['blades', 'whip']), 0);
    expect(rune).toBe('blades');
    expect(left.runes).toEqual(['whip']);
    const { item: none } = unsocketRune(left, 0);
    expect(none.runes).toBeUndefined();
  });
});

describe('the fight sees the worn weapon’s', () => {
  it('runes of its style act, others are carried idle', () => {
    expect(wornMods({ weapon: item('steel-sword', 'rare', ['blades', 'drain']) }).runes).toEqual(['blades']);
    expect(wornMods({ weapon: item('steel-sword', 'rare', ['drain']) }).runes).toBeUndefined();
    expect(wornMods({ weapon: item('elm-staff', 'rare', ['drain', 'split']) }).runes).toEqual(['drain', 'split']);
  });
  it('no more than its sockets act', () => {
    expect(wornMods({ weapon: item('steel-sword', 'common', ['blades', 'whip']) }).runes).toEqual(['blades']);
    expect(activeRunes(['whip', 'whip'], 2, 'sword')).toEqual(['whip']);
  });
  it('a weapon with none leaves the slice’s Mods as they were', () => {
    expect('runes' in wornMods({ weapon: item('steel-sword', 'rare') })).toBe(false);
    expect(hasRune(emptyMods(), 'blades')).toBe(false);
  });
});

describe('found', () => {
  // A seeded stand-in for state.rng.
  const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  it('a rare weapon sometimes comes with one of its style’s runes set; nothing else ever does', () => {
    tuning.runes.foundChance = 1;
    const rand = seeded(7);
    let set = 0;
    for (let n = 0; n < 400; n++) {
      const item = rollGear(rand, n % 2 === 0);
      const e = entryOf(item);
      if (!item.runes) continue;
      set++;
      expect(item.rarity).toBe('rare');
      expect(e.slot).toBe('weapon');
      expect(item.runes).toHaveLength(1);
      expect(wornMods({ weapon: item }).runes).toEqual(item.runes);
    }
    expect(set).toBeGreaterThan(5);
  });
  it('with the chance at nought none is ever found', () => {
    tuning.runes.foundChance = 0;
    const a = seeded(11);
    const items = Array.from({ length: 50 }, () => rollGear(a, true));
    expect(items.every((i) => !i.runes)).toBe(true);
  });
});

describe('the server checks', () => {
  const loadout = (runes: unknown) => ({
    name: 'Ash',
    xp: { sword: 0, bow: 0, staff: 0 },
    talents: emptyTalents(),
    mods: { ...emptyMods(), runes },
    maxHp: 100,
  });
  it('takes known runes, two at most, each once', () => {
    expect(readLoadout(loadout(['blades', 'whip']))?.mods.runes).toEqual(['blades', 'whip']);
    expect(readLoadout(loadout(['blades', 'whip', 'drain']))).toBeNull();
    expect(readLoadout(loadout(['blades', 'blades']))).toBeNull();
    expect(readLoadout(loadout(['fireball']))).toBeNull();
    expect(readLoadout(loadout([]))).toBeNull();
  });
  it('an item dropped or sold keeps runes its sockets can hold, and no more', () => {
    expect(readGearItem(item('steel-sword', 'rare', ['blades', 'whip']))?.runes).toEqual(['blades', 'whip']);
    expect(readGearItem(item('steel-sword', 'common', ['blades', 'whip']))).toBeNull();
    expect(readGearItem(item('bronze-sword', 'common', ['blades']))).toBeNull();
  });
});
