import { afterEach, describe, expect, it } from 'vitest';
import { tuningEdits } from '../config/edits';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readToHost } from '../net/validate';
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

  it('the debug panel\'s switch reaches the server, and every joiner after gets it (Michael, 15 Nov, a test switch)', () => {
    const host = new HostSession(world, () => {});
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    const tune = readToHost({ k: 'tune', edit: { path: 'combo.swapInFight', value: true } });
    expect(tune).not.toBeNull();
    host.onMessage('a', tune!);
    expect(tuning.combo.swapInFight).toBe(true);
    expect(tuningEdits()['combo.swapInFight']).toBe(true);
    expect(swapIn('wave')).toBe('bow');
    host.onMessage('a', readToHost({ k: 'tune', edit: { path: 'combo.swapInFight', value: false } })!);
    expect(swapIn('wave')).toBe('sword');
  });
});
