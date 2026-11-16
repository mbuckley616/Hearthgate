import { describe, expect, it } from 'vitest';
import { readGearItem } from '../net/validate';
import { CATALOGUE, wornMods, type GearItem } from './catalogue';
import { offerFor, signatureItem, type SignaturePiece } from './signatures';

// B6, part two (docs/bosses.md 1.4 and 1.7): signature pieces as items, folded into Mods, and the
// piece offered by the job a hero did. The list here stands in for a boss's (W1's Warden gives its own).

const LIST: SignaturePiece[] = [
  { job: 'tank', id: 'iron-kiteshield', name: 'Test Tower', signature: { resist: 'blunt' } },
  { job: 'armoured', id: 'ash-staff', name: 'Test Staff', signature: { castSpeed: true } },
  { job: 'boss', id: 'iron-mace', name: 'Test Mace', signature: { bane: 'warden' } },
];

describe('signature pieces by job (B6)', () => {
  it('names real catalogue items', () => {
    for (const p of LIST) expect(CATALOGUE.has(p.id)).toBe(true);
  });

  it('offers each hero the piece of the job they did most', () => {
    expect(offerFor(LIST, { tank: 300, boss: 120 })?.name).toBe('Test Tower');
    expect(offerFor(LIST, { armoured: 90, boss: 60, tank: 10 })?.name).toBe('Test Staff');
    expect(offerFor(LIST, { boss: 400, armoured: 50 })?.name).toBe('Test Mace');
    // Nothing in the list's jobs (only a warded add's damage, and this boss has none): the boss's piece.
    expect(offerFor(LIST, { warded: 80 })?.name).toBe('Test Mace');
    expect(offerFor(LIST, {})?.name).toBe('Test Mace');
    // A tie goes to the list's order.
    expect(offerFor(LIST, { tank: 50, boss: 50 })?.name).toBe('Test Tower');
    expect(offerFor([], { tank: 1 })).toBeNull();
  });

  it('folds two pieces against one type into one resist', () => {
    const tower = signatureItem(LIST[0], 'a');
    const helm: GearItem = { uid: 'b', id: 'iron-fullHelm', rarity: 'rare', perk: null, bonus: null, signature: { resist: 'blunt' } };
    const cap: GearItem = { ...helm, uid: 'c', signature: { resist: 'magic' } };
    expect(wornMods({ shield: tower, head: helm }).resist).toEqual(['blunt']);
    expect(wornMods({ shield: tower, head: cap }).resist?.slice().sort()).toEqual(['blunt', 'magic']);
    expect(wornMods({ head: { ...helm, signature: undefined } }).resist).toBeUndefined();
  });

  it('takes a cast and a bane only from the weapon in hand', () => {
    const staff = signatureItem(LIST[1], 's');
    const mace = signatureItem(LIST[2], 'm');
    expect(wornMods({ weapon: staff }).castSpeed).toBe(true);
    expect(wornMods({ weapon: mace }).bane).toBe('warden');
    expect(wornMods({ weapon: { ...mace, signature: undefined } }).bane).toBeUndefined();
  });

  it('carries a piece through the server’s item check, and refuses a forged one', () => {
    for (const p of LIST) expect(readGearItem(signatureItem(p, 'x'))?.signature).toEqual(p.signature);
    const shield = signatureItem(LIST[0], 'x');
    expect(readGearItem({ ...shield, signature: { castSpeed: true } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { bane: 'warden' } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { resist: 'blunt', castSpeed: true } })).toBeNull();
    expect(readGearItem({ ...shield, signature: { resist: 'fire' } })).toBeNull();
    expect(readGearItem({ ...signatureItem(LIST[2], 'x'), signature: { bane: 'grunt' } })).toBeNull();
  });
});
