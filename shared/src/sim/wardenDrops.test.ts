import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem, readLoadout } from '../net/validate';
import { CATALOGUE, wornMods } from './catalogue';
import { clearsLow } from './combat';
import { addPlayer, type Loadout } from './coop';
import { emptyMods, type Mods } from './gear';
import { SIGNATURES, offerFor, signatureItem } from './signatures';
import { emptyTalents } from './talents';
import { createSimState } from './world';

// W1, part one (docs/bosses.md 2.3): the Warden's signature drops by job, the tank's tower against
// its slams, boots that clear its low sweep from lower, and a mace that is its bane.

const world = buildWorld(arena);
const list = SIGNATURES.warden!;
const piece = (name: string) => list.find((p) => p.name === name)!;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { on: tuning.bosses.signatureDrops, clears: tuning.jump.clearsLow };
afterEach(() => {
  tuning.bosses.signatureDrops = kept.on;
  tuning.jump.clearsLow = kept.clears;
});

/** A hero in the air `height` over the ground, in `mods`. */
function jumper(height: number, mods: Partial<Mods> = {}) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...mods } }, false);
  p.grounded = false;
  p.y = height;
  return p;
}

describe("the Warden's signature drops (W1)", () => {
  it('offers the tower to the tank, the greaves to the archer who broke the chant, and the mace to anyone else', () => {
    expect(list.map((p) => p.job)).toEqual(['tank', 'warded', 'boss']);
    expect(offerFor(list, { tank: 300, boss: 100 })?.name).toBe("Warden's Tower");
    expect(offerFor(list, { warded: 80, boss: 40 })?.name).toBe('Sweepbreaker Greaves');
    expect(offerFor(list, {})?.name).toBe('Ward-iron Mace');
  });

  it('makes each a real item the server takes back, worn in its slot', () => {
    for (const p of list) expect(readGearItem(signatureItem(p, 'x'))?.signature).toEqual(p.signature);
    const tower = signatureItem(piece("Warden's Tower"), 'a');
    const greaves = signatureItem(piece('Sweepbreaker Greaves'), 'b');
    const mace = signatureItem(piece('Ward-iron Mace'), 'c');
    expect(CATALOGUE.get(tower.id)?.slot).toBe('shield');
    expect(CATALOGUE.get(greaves.id)?.slot).toBe('feet');
    expect(CATALOGUE.get(mace.id)?.slot).toBe('weapon');
    const m = wornMods({ weapon: mace, shield: tower, feet: greaves });
    expect(m.resist).toEqual(['blunt']);
    expect(m.bane).toBe('warden');
    expect(m.lowClear).toBe(true);
    expect(wornMods({ weapon: mace }).lowClear).toBeUndefined();
    // Clearing from lower only from boots, and only as a flag.
    expect(readGearItem({ ...tower, signature: { lowClear: true } })).toBeNull();
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), lowClear: true } })?.mods.lowClear).toBe(true);
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), lowClear: 1 } })).toBeNull();
  });

  it('clears a low attack greavesClearLessM lower in the greaves, and only with signature drops on', () => {
    tuning.jump.clearsLow = true;
    tuning.bosses.signatureDrops = true;
    const h = tuning.jump.clearHeight - tuning.warden.greavesClearLessM / 2;
    expect(clearsLow(jumper(h), 0)).toBe(false);
    expect(clearsLow(jumper(h, { lowClear: true }), 0)).toBe(true);
    expect(clearsLow(jumper(tuning.jump.clearHeight - tuning.warden.greavesClearLessM - 0.05, { lowClear: true }), 0)).toBe(false);
    tuning.bosses.signatureDrops = false;
    expect(clearsLow(jumper(h, { lowClear: true }), 0)).toBe(false);
  });
});
