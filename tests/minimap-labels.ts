// The minimap's words (critic, 19 Nov): every boss hall said WARDEN, the Gravehand's, Grubnose's,
// the Mason's and the King's too. Run by `npm run check`.
import assert from 'node:assert/strict';
import { pieceLabel } from '../client/src/ui/Minimap';

assert.equal(pieceLabel('boss'), 'BOSS');
assert.equal(pieceLabel('entrance'), 'IN');
assert.equal(pieceLabel('rest'), 'REST');
console.log('ok    a boss hall reads BOSS on the map, whoever waits in it');
