import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { readLoadout } from '../net/validate';
import { CATALOGUE, armourOf, entryOf, fromSliceItem, itemName, rollGear, starterGear, wornMods, wornStyle, type GearItem, type Worn } from './catalogue';
import { arena, buildWorld } from '../level/arena';
import { hurtHero } from './combat';
import { emptyMods, rollItem } from './gear';
import { createSimState } from './world';
import { emptyTalents } from './talents';

const item = (id: string, over: Partial<GearItem> = {}): GearItem => ({ uid: id, id, rarity: 'common', perk: null, bonus: null, ...over });

/** A seeded generator for drops in tests. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the item catalogue (T5b)', () => {
  it('names each piece by its material and shape, as Michael’s examples', () => {
    expect(CATALOGUE.get('iron-fullHelm')?.name).toBe('Iron full helm');
    expect(CATALOGUE.get('black-platebody')?.name).toBe('Black platebody');
    expect(CATALOGUE.get('leather-chaps')?.kind).toBe('ranged');
    expect(CATALOGUE.get('linen-robeTop')?.kind).toBe('magic');
    expect(CATALOGUE.get('gold-ring')?.kind).toBe('none');
    expect(CATALOGUE.get('yew-shortbow')?.shape.style).toBe('bow');
    // Every slot of RuneScape's body has something to wear.
    const slots = new Set([...CATALOGUE.values()].map((e) => e.slot));
    expect(slots.size).toBe(10);
  });

  it('gives a heavier piece and a higher tier more armour, metal more than hide or cloth', () => {
    const a = (id: string) => armourOf(CATALOGUE.get(id)!);
    expect(a('iron-platebody')).toBeGreaterThan(a('iron-gauntlets'));
    expect(a('black-platebody')).toBeGreaterThan(a('iron-platebody'));
    expect(a('steel-platebody')).toBeGreaterThan(a('studded-jerkin'));
    expect(a('studded-jerkin')).toBeGreaterThan(a('silk-robeTop'));
  });

  it('costs 5% damage a piece of armour of another kind than the weapon, and none for a match', () => {
    const melee: Worn = { weapon: item('iron-sword'), head: item('iron-fullHelm'), body: item('iron-platebody'), legs: item('iron-platelegs') };
    const m = wornMods(melee);
    expect(wornStyle(melee)).toBe('sword');
    expect(m.damage.sword).toBeCloseTo(tuning.gear.weaponDamagePerTier, 6);
    expect(m.damage.bow).toBeCloseTo(-3 * tuning.gear.mismatchDamagePerPiece, 6);
    expect(m.damage.staff).toBeCloseTo(-3 * tuning.gear.mismatchDamagePerPiece, 6);
    // Kindless pieces (a cape, an amulet, a ring) never count against you.
    const trinkets = wornMods({ ...melee, cape: item('red-cape'), neck: item('gold-amulet'), ring: item('silver-ring') });
    expect(trinkets.damage.bow).toBeCloseTo(m.damage.bow, 6);
    expect(trinkets.maxHp).toBe(3 * tuning.gear.amuletHpPerTier);
    expect(m.armour).toBeGreaterThan(0);
  });

  it('lets a shield do nothing while a bow or staff takes both hands', () => {
    const withSword = wornMods({ weapon: item('iron-sword'), shield: item('iron-kiteshield') });
    const withBow = wornMods({ weapon: item('oak-shortbow'), shield: item('iron-kiteshield') });
    expect(withSword.armour).toBeGreaterThan(0);
    expect(withBow.armour).toBeUndefined();
  });

  it('starts a hero with a plain weapon of each kind, the sword in hand, and no armour', () => {
    const s = starterGear();
    expect(wornStyle(s.worn)).toBe('sword');
    expect(s.bag.map((i) => entryOf(i).shape.style)).toEqual(['bow', 'staff']);
    expect(wornMods(s.worn).armour).toBeUndefined();
  });

  it('rolls drops from the catalogue: commons of tier 3 and below, rares of 3 and up with a bonus', () => {
    const rand = seeded(5);
    for (let i = 0; i < 200; i++) {
      const g = rollGear(rand);
      const e = CATALOGUE.get(g.id)!;
      expect(e).toBeDefined();
      if (g.rarity === 'common') expect(e.tier).toBeLessThanOrEqual(3);
      else {
        expect(e.tier).toBeGreaterThanOrEqual(3);
        expect(g.bonus).not.toBeNull();
      }
    }
  });

  it('carries the slice’s loot over, keeping its name, stat and perk', () => {
    const rand = seeded(9);
    for (let i = 0; i < 50; i++) {
      const old = { ...rollItem(rand, i % 2 === 0), uid: `u${i}` };
      const g = fromSliceItem(old);
      expect(CATALOGUE.has(g.id)).toBe(true);
      expect(itemName(g)).toBe(old.name);
      expect(g.bonus).toEqual(old.stat);
      expect(g.perk).toBe(old.perk);
      const slot = entryOf(g).slot;
      expect(old.slot === 'body' ? slot === 'body' : slot === 'weapon').toBe(true);
    }
  });

  it('takes worn armour’s share off every blow', () => {
    const world = buildWorld(arena);
    const s = createSimState(arena, ['a', 'b'], world);
    const [bare, armoured] = s.players;
    armoured.mods = { ...emptyMods(), armour: 0.25 };
    for (const p of s.players) hurtHero(s, p, { damage: 40, fromX: p.x + 1, fromZ: p.z, late: true });
    expect(bare.maxHp - bare.hp).toBeCloseTo(40, 6);
    expect(armoured.maxHp - armoured.hp).toBeCloseTo(30, 6);
  });

  it('lets the server take worn armour, but no more than the most there is', () => {
    const loadout = (armour: number) => ({ name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: { ...emptyMods(), armour }, maxHp: 100 });
    expect(readLoadout(loadout(0.2))?.mods.armour).toBe(0.2);
    expect(readLoadout(loadout(5))).toBeNull();
    expect('armour' in readLoadout({ ...loadout(0), mods: emptyMods() })!.mods).toBe(false);
  });
});
