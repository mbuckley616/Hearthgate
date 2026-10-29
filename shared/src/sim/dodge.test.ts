import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { heroInvulnerable } from './combat';
import { addPlayer, type Loadout } from './coop';
import { emptyMods, xpForLevel } from './gear';
import { stepPlayer } from './player';
import { dodgeCancelMs, emptyTalents } from './talents';
import { idleCommand, type PlayerState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

/** Roll forward holding the stick, and report the tick the roll ended and whether the hero stayed safe through the i-frames. */
function roll(setup: (p: PlayerState) => void = () => {}) {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  p.invulnTime = 0;
  setup(p);
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
  return { endedAt, safe, p };
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

  it('cuts sooner with Second wind and Light step, never under the floor (Michael, 28 Oct)', () => {
    const dg = tuning.dodge;
    const wind = (ranks: number) => (p: PlayerState) => {
      p.xp.sword = xpForLevel(40);
      p.talents.sword.wind = ranks;
    };
    expect(dodgeCancelMs(roll().p)).toBe(dg.cancelAfterMs);
    const two = roll(wind(2));
    expect(dodgeCancelMs(two.p)).toBe(dg.cancelAfterMs - 2 * tuning.talents.windCancelMsPerRank);
    expect(two.endedAt).toBeLessThan(roll().endedAt);
    // Below level 40 the row is shut, whatever the save says.
    expect(dodgeCancelMs(roll((p) => (p.talents.sword.wind = 4)).p)).toBe(dg.cancelAfterMs);
    const both = roll((p) => {
      wind(4)(p);
      p.champion = { xp: 0, ranks: { lightstep: 5 } };
    });
    const cut = 4 * tuning.talents.windCancelMsPerRank + 5 * tuning.champion.lightstepCancelMsPerRank;
    expect(dodgeCancelMs(both.p)).toBe(Math.max(dg.cancelFloorMs, dg.cancelAfterMs - cut));
    expect(dodgeCancelMs(roll((p) => (p.champion = { xp: 0, ranks: { lightstep: 99 } })).p)).toBeGreaterThanOrEqual(dg.cancelFloorMs);
    expect(both.safe).toBe(true);
  });
});
