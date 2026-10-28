import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer } from './coop';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type RunState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** Ask for the bow for a second in this phase of the run; what is in hand after? */
function swapIn(phase: RunState['phase']) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  s.run.phase = phase;
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, swapTo: 'bow' }, 1 / 60, world, s);
  return p.style;
}

const kept = tuning.combo.swapInFight;
afterEach(() => (tuning.combo.swapInFight = kept));

describe('one weapon set per outing (C3)', () => {
  it('changes weapon only outside a fight', () => {
    expect(swapIn('ante')).toBe('bow');
    expect(swapIn('won')).toBe('bow');
    expect(swapIn('intro')).toBe('sword');
    expect(swapIn('wave')).toBe('sword');
  });

  it('swaps mid-fight as the slice did when the switch is on', () => {
    tuning.combo.swapInFight = true;
    expect(swapIn('wave')).toBe('bow');
  });
});
