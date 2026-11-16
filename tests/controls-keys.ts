// The controls from the playtest with Nick (Michael, 15 Nov, A): Space is jump-or-interact (Game
// decides by the prompt), B opens the bag, X takes the next kind of weapon from the bag, through the
// styles and their families in turn and the best of each kind. Run by `npm run check`.
import assert from 'node:assert/strict';
import { gamepadBindings, keyboardBindings } from '../client/src/input/bindings';
import { BUTTON_ACTIONS } from '../client/src/input/actions';
import { Profile } from '../client/src/game/Profile';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const ok = (what: string) => console.log(`ok    ${what}`);

const keysOf = (code: string) => BUTTON_ACTIONS.filter((a) => keyboardBindings[a].includes(code));
assert.deepEqual(keysOf('Space'), ['jumpOrUse']);
assert.deepEqual(keysOf('KeyB'), ['bag']);
assert.deepEqual(keysOf('KeyX'), ['nextWeapon']);
assert.deepEqual(keysOf('KeyF'), ['interact']);
ok('Space, B and X each have one action, and F still interacts');
assert.deepEqual(gamepadBindings.jump, [3]);
assert.deepEqual(gamepadBindings.interact, [0]);
assert.equal(gamepadBindings.bag, undefined);
ok('the pad plays as before: Y jumps, A interacts');

const item = (uid: string, id: string, rarity: 'common' | 'rare' = 'common') => ({ uid, id, rarity, perk: null, bonus: null });
const p = new Profile();
p.data.worn.weapon = item('s1', 'bronze-sword');
p.data.bag = Array(28).fill(null);
p.data.bag[0] = item('st', 'ash-staff');
p.data.bag[1] = item('b1', 'ash-shortbow');
p.data.bag[2] = item('b2', 'elm-shortbow');
p.data.bag[3] = item('h', 'iron-warhammer');
p.data.bag[4] = item('s2', 'steel-sword');
const seen: string[] = [];
for (let i = 0; i < 5; i++) seen.push(p.nextWeapon()!);
assert.deepEqual(seen, ['iron-warhammer', 'elm-shortbow', 'ash-staff', 'steel-sword', 'iron-warhammer']);
ok('X goes sword, warhammer, bow, staff and round, the best of each kind, never the kind in hand');
assert.equal(p.style, 'sword');
assert.equal(p.data.bag.filter(Boolean).length, 5);
ok('what was in hand goes back into the bag');

const lone = new Profile();
lone.data.worn.weapon = item('s1', 'bronze-sword');
lone.data.bag = Array(28).fill(null);
lone.data.bag[0] = item('s2', 'steel-sword');
assert.equal(lone.nextWeapon(), null);
ok('another sword alone is not another kind: X says so and leaves the hand');
