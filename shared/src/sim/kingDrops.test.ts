import { afterEach, describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem } from '../net/validate';
import { CATALOGUE, wornMods } from './catalogue';
import { damageEnemy } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { SIGNATURES, offerFor, signatureItem } from './signatures';
import { emptyTalents } from './talents';
import { createSimState } from './world';

// K1, part one (docs/bosses.md 2.4): the Hollow King's signature drops by job, a circlet against his
// violet circles and Kingsbane, a bane to him and to his Knights while he is on the floor.

const world = buildWorld(arena);
const list = SIGNATURES.king!;
const kept = { on: tuning.bosses.signatureDrops };
afterEach(() => {
  tuning.bosses.signatureDrops = kept.on;
});

/** What one 10 sword hit takes off a fresh `kind`, from a hero with `bane` or none, with `others` on the floor. */
function dealt(kind: EnemyKind, bane?: EnemyKind, others: EnemyKind[] = []): number {
  const s = createSimState(arena, [], world);
  const loadout: Loadout = { name: 'p', xp: { sword: 1e6, bow: 0, staff: 0 }, talents: emptyTalents(), mods: { ...emptyMods(), ...(bane ? { bane } : {}) }, maxHp: 1000 };
  const p = addPlayer(s, world, 'p1', loadout, false);
  others.forEach((k, i) => createEnemy(s, world, k, 12 + i * 3, 12, 0));
  const e = createEnemy(s, world, kind, 0, -9, 0);
  Object.assign(e, { ai: 'chase', hp: 1e4, maxHp: 1e4, poise: 1e6, armour: 0 });
  damageEnemy(s, e, { attackerId: p.id, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'sword' });
  return 1e4 - e.hp;
}

describe("the Hollow King's signature drops (K1)", () => {
  it('offers the circlet to the archer who broke the channel and Kingsbane to anyone else', () => {
    expect(list.map((p) => p.job)).toEqual(['warded', 'boss']);
    expect(offerFor(list, { warded: 80, boss: 40 })?.name).toBe('Hollow Circlet');
    expect(offerFor(list, { boss: 40 })?.name).toBe('Kingsbane');
    expect(offerFor(list, {})?.name).toBe('Kingsbane');
  });

  it('makes each a real item the server takes back, worn in its slot', () => {
    for (const p of list) expect(readGearItem(signatureItem(p, 'x'))?.signature).toEqual(p.signature);
    const circlet = signatureItem(list[0], 'a');
    const sword = signatureItem(list[1], 'b');
    expect(CATALOGUE.get(circlet.id)?.slot).toBe('head');
    expect(CATALOGUE.get(sword.id)?.slot).toBe('weapon');
    expect(wornMods({ head: circlet }).resist).toEqual(['magic']);
    expect(wornMods({ weapon: sword }).bane).toBe('king');
  });

  it('is a bane to the King, and to a Knight only while the King is on the floor', () => {
    tuning.bosses.signatureDrops = true;
    const plain = dealt('king');
    expect(dealt('king', 'king')).toBeCloseTo(plain * tuning.bosses.baneMult, 5);
    const knight = dealt('knight', undefined, ['king']);
    expect(plain).toBeGreaterThan(0);
    expect(knight).toBeGreaterThan(0);
    expect(dealt('knight', 'king', ['king'])).toBeCloseTo(knight * tuning.bosses.baneMult, 5);
    expect(dealt('knight', 'king')).toBeCloseTo(dealt('knight'), 5);
    // The Warden's bane does nothing to a Knight, King or not.
    expect(dealt('knight', 'warden', ['king'])).toBeCloseTo(knight, 5);
    tuning.bosses.signatureDrops = false;
    expect(dealt('knight', 'king', ['king'])).toBeCloseTo(dealt('knight', undefined, ['king']), 5);
  });
});
