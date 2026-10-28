import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { heroInvulnerable } from './combat';
import { addPlayer, type Loadout } from './coop';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** Roll forward holding the stick, and report the tick the roll ended and whether the hero stayed safe through the i-frames. */
function roll() {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  p.invulnTime = 0;
  stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  stepPlayer(p, { ...idleCommand(), moveZ: 1, dodge: true }, DT, world, s);
  expect(p.mode).toBe('dodge');
  let endedAt = -1;
  let safe = true;
  for (let t = 1; t < 40; t++) {
    stepPlayer(p, { ...idleCommand(), moveZ: 1 }, DT, world, s);
    if (endedAt < 0 && p.mode !== 'dodge') endedAt = t;
    if (t * DT * 1000 < tuning.dodge.iframesMs - DT * 1000 && !heroInvulnerable(p)) safe = false;
  }
  return { endedAt, safe };
}

describe('the dodge’s recovery (D9)', () => {
  it('lets a held stick end the roll at cancelAfterMs, sooner than the slice’s 240 ms', () => {
    const { endedAt } = roll();
    expect(tuning.dodge.cancelAfterMs).toBeLessThan(240);
    expect(endedAt * DT * 1000).toBeLessThan(240);
    expect(endedAt * DT * 1000).toBeGreaterThanOrEqual(tuning.dodge.cancelAfterMs - DT * 1000);
  });

  it('keeps the whole i-frame window when the roll is cut short', () => {
    expect(roll().safe).toBe(true);
    tuning.dodge.keepIframesOnCancel = false;
    try {
      expect(roll().safe).toBe(false);
    } finally {
      tuning.dodge.keepIframesOnCancel = true;
    }
  });
});
