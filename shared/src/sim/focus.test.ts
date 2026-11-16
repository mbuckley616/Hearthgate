import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { styleDamageBonus } from './combat';
import { addPlayer, type Loadout } from './coop';
import { earnFocus, focusBonus } from './focus';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState } from './world';

// B7, focus (docs/bosses.md 1.7; Michael's A on specializing, 16 Nov): +3% a floor in one style, up
// to +9%, lost on a swap.

const world = buildWorld(arena);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.bosses.focus;
afterEach(() => {
  tuning.bosses.focus = kept;
});

function hero() {
  const s = createSimState(arena, [], world);
  return { s, p: addPlayer(s, world, 'p1', loadout, false) };
}

describe('focus (B7)', () => {
  it('adds 3% a floor in one style over three floors, and no more after', () => {
    const { p } = hero();
    const plain = styleDamageBonus(p, 'sword');
    const seen: number[] = [];
    for (let floor = 0; floor < 4; floor++) {
      earnFocus(p);
      seen.push(styleDamageBonus(p, 'sword') - plain);
    }
    expect(seen[0]).toBeCloseTo(0.03, 9);
    expect(seen[1]).toBeCloseTo(0.06, 9);
    expect(seen[2]).toBeCloseTo(0.09, 9);
    expect(seen[3]).toBeCloseTo(0.09, 9);
    // Only in the style it was earned in.
    expect(focusBonus(p, 'bow')).toBe(0);
  });

  it('loses it all on a swap, caught by the next step', () => {
    const { s, p } = hero();
    earnFocus(p);
    earnFocus(p);
    p.style = 'bow';
    stepPlayer(p, idleCommand(), 1 / 60, world, s);
    expect(p.styleFocus).toBeUndefined();
    expect(focusBonus(p, 'sword')).toBe(0);
    // A floor in the new style starts again at one.
    earnFocus(p);
    expect(p.styleFocus).toEqual({ style: 'bow', floors: 1 });
  });

  it('changes nothing with the switch off', () => {
    tuning.bosses.focus = false;
    const { p } = hero();
    earnFocus(p);
    expect(p.styleFocus).toBeUndefined();
    expect(focusBonus(p, 'sword')).toBe(0);
  });
});
