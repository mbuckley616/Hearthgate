import { describe, expect, it } from 'vitest';
import { buildWorld } from '../level/arena';
import { floorLevel } from '../level/floor';
import { bossDropCount } from './floorRun';

// Michael, 31 Oct (A): the Warden always drops special items, more the harder the portal.
describe('the Warden’s drops by difficulty', () => {
  it('leaves 1 at Easy and Normal, 2 at Hard, 3 at Nightmare and Legendary', () => {
    const count = (difficulty: number | undefined) => bossDropCount(buildWorld(floorLevel({ seed: 202, pieces: 18, floor: 3, floors: 3, difficulty })));
    expect([undefined, 0, 1, 2, 3, 4].map(count)).toEqual([1, 1, 1, 2, 3, 3]);
  });
});
