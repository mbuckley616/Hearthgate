// A floor's arrival line names who waits in its boss hall (Session 274): with the Warrens open on Wren's
// tab, a random Warrens run ends on Chief Grubnose, and the line said "the Warden" for every run.
// Run by `npm run check`.
import assert from 'node:assert/strict';
import { bossName } from '../client/src/ui/RunUi';
import type { FloorSpec } from '@hearthgate/shared/level/generate';

const spec = (o: Partial<FloorSpec>) => ({ seed: 1, floor: 3, floors: 3, pieces: 20, ...o }) as FloorSpec;
assert.equal(bossName(spec({})), 'the Warden');
assert.equal(bossName(spec({ type: 'hauntedCrypt' })), 'the Warden');
assert.equal(bossName(spec({ type: 'goblinWarrens' })), 'Chief Grubnose');
assert.equal(bossName(spec({ story: 'mossgate' })), 'the Gravehand');
console.log('ok    a floor says who waits at the far end: Chief Grubnose in a random Warrens run, the Warden in the Crypt');
