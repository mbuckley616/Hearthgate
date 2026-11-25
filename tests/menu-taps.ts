// A menu's up or down tap that goes down and up between two frames still moves the choice (the
// critic, 25 Nov: S tapped between frames left Keeper Wren's card on her portal menu, 4 of 4).
// Run by `npm run check`.
import assert from 'node:assert/strict';
import { KeyboardMouseSource } from '../client/src/input/KeyboardMouseSource';
import { emptyFrame } from '../client/src/input/actions';
import { menuDir } from '../client/src/ui/KeeperCard';

type Handler = (e: unknown) => void;
const on: Record<string, Handler> = {};
const target = { addEventListener: () => {}, contains: () => false };
(globalThis as Record<string, unknown>).window = { addEventListener: (t: string, f: Handler) => void (on[t] = f) };
(globalThis as Record<string, unknown>).document = { addEventListener: () => {}, pointerLockElement: null };

const src = new KeyboardMouseSource(target as unknown as HTMLElement);
const key = (type: 'keydown' | 'keyup', code: string) =>
  on[type]!({ code, repeat: false, timeStamp: 0, target: null, ctrlKey: false, preventDefault: () => {} });
const frame = () => {
  const f = emptyFrame();
  src.contribute(f, 1 / 60);
  src.endFrame();
  return f;
};
const ok = (what: string) => console.log(`ok    ${what}`);

for (const [code, want] of [['KeyS', 'down'], ['KeyW', 'up'], ['ArrowDown', 'down'], ['ArrowUp', 'up']] as const) {
  key('keydown', code);
  key('keyup', code);
  const f = frame();
  assert.equal(f.move.y, 0, `${code} is not held at the frame`);
  assert.equal(menuDir(f), want, `${code} tapped between frames`);
  assert.equal(menuDir(frame()), '', 'the tap counts once');
}
ok('W, S and the arrows tapped between two frames each move a menu once');

key('keydown', 'KeyS');
const held = frame();
assert.equal(menuDir(held), 'down');
assert.equal(menuDir(frame()), 'down', 'a held key still repeats');
key('keyup', 'KeyS');
assert.equal(menuDir(frame()), '');
ok('a held key reads as before');
