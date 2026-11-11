// Runes in the browser's save (the builds pass, Michael's A, 11 Nov): E or Y on a weapon sets a rune
// from the pouch in its next free socket, of its style only, and when none fits takes them all back
// out; a carried find and a weapon with no sockets refuse; the pouch survives a reload. Run by
// `npm run check`.
import assert from 'node:assert/strict';
import { wornMods } from '@hearthgate/shared/sim/catalogue';
import { Profile } from '../client/src/game/Profile';

// Profile reads the save only when made, so the stub is in place in time.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};


const ok = (what: string) => console.log(`ok    ${what}`);

const p = new Profile();
const sword = { uid: 'rare-sword', id: 'steel-sword', rarity: 'rare' as const, perk: null, bonus: null };
p.data.worn.weapon = sword;
p.data.runes = { blades: 1, whip: 1, drain: 1 };

assert.match(p.turnRune(sword), /Rune of Blades/);
assert.match(p.turnRune(sword), /Rune of the Whip/);
assert.deepEqual(sword.runes, ['blades', 'whip']);
assert.deepEqual(p.runePouch(), [['drain', 1]]);
assert.deepEqual(wornMods(p.data.worn).runes, ['blades', 'whip']);
ok('E sets the pouch’s sword runes in order, and the fight sees them');

assert.match(p.turnRune(sword), /Took out Rune of Blades and Rune of the Whip/);
assert.equal(sword.runes, undefined);
assert.deepEqual(p.runePouch(), [['blades', 1], ['whip', 1], ['drain', 1]]);
ok('full, E takes them all back into the pouch');

const staff = { uid: 'plain-staff', id: 'ash-staff', rarity: 'common' as const, perk: null, bonus: null };
p.data.bag[5] = staff;
assert.match(p.turnRune(staff), /No sockets/);
const steelStaff = { uid: 'steel-staff', id: 'elm-staff', rarity: 'rare' as const, perk: null, bonus: null };
p.data.bag[6] = steelStaff;
assert.match(p.turnRune(steelStaff), /Rune of Draining/);
assert.match(p.turnRune(steelStaff), /Took out/);
ok('a staff takes only the staff’s rune; a bronze-tier common has no sockets');

p.data.carried = ['steel-staff'];
assert.match(p.turnRune(steelStaff), /Bank it first/);
p.data.carried = [];
ok('a carried find refuses');

p.turnRune(sword);
p.save();
const again = new Profile();
assert.deepEqual(again.data.worn.weapon?.runes, ['blades']);
assert.deepEqual(again.runePouch(), [['whip', 1], ['drain', 1]]);
ok('the pouch and a socketed weapon survive a reload');
