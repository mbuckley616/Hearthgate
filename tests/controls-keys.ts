// The controls from the playtest with Nick (Michael, 15 Nov, A): Space is jump-or-interact (Game
// decides by the prompt), B opens the bag, X takes the next kind of weapon from the bag, through the
// styles and their families in turn and the best of each kind. Run by `npm run check`.
import assert from 'node:assert/strict';
import { gamepadBindings, keyboardBindings } from '../client/src/input/bindings';
import { BUTTON_ACTIONS } from '../client/src/input/actions';
import { Profile } from '../client/src/game/Profile';
import { SprintToggle } from '../client/src/input/sprintToggle';
import { tuning } from '../shared/src/config/tuning';

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

// Dodge on Shift, sprint a toggle on Ctrl and a double W (Michael, 16 Nov, A and his note).
assert.deepEqual(keysOf('ShiftLeft'), ['dodge']);
assert.deepEqual(keysOf('ControlLeft'), ['sprintToggle']);
assert.deepEqual(keyboardBindings.sprint, []);
assert.deepEqual(gamepadBindings.sprint, [10]);
assert.deepEqual(gamepadBindings.dodge, [1]);
ok('Shift dodges and Ctrl toggles sprint; no key is held to sprint, and the pad still holds its stick click');
{
  const F = 1000 / 60;
  const s = new SprintToggle();
  let now = 0;
  const frame = (toggle: boolean, forward: boolean, moving: boolean) => s.step(toggle, forward, moving, (now += F), F);
  assert.equal(frame(true, false, false), true);
  for (let i = 0; i < 30; i++) assert.equal(frame(false, false, false), true);
  ok('Ctrl tapped while standing waits for the first step');
  for (let i = 0; i < 30; i++) assert.equal(frame(false, false, true), true);
  assert.equal(frame(false, false, false), true);
  ok('a frame between letting go of one key and pressing the next keeps it');
  for (let i = 0; i < Math.ceil(tuning.input.sprintStopGraceMs / F) + 1; i++) frame(false, false, false);
  assert.equal(s.on, false);
  ok('stopping ends it');
  frame(true, false, true);
  assert.equal(frame(true, false, true), false);
  ok('Ctrl again ends it while moving');
  s.reset();
  now = 0;
  frame(false, true, true);
  frame(false, false, false);
  assert.equal(frame(false, true, true), true);
  ok('two W taps inside the window start it');
  s.reset();
  frame(false, true, true);
  for (let i = 0; i < Math.ceil(tuning.input.sprintDoubleTapMs / F) + 2; i++) frame(false, false, i < 5);
  assert.equal(frame(false, true, true), false);
  ok('two W taps further apart do not');
}

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
