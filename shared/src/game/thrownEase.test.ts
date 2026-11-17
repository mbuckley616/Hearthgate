import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from '../sim/coop';
import { hurtHero } from '../sim/combat';
import { emptyMods, xpForLevel } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimState } from '../sim/types';
import { createSimState } from '../sim/world';
import { SNAP_M, longestKnockbackM, placedBy, thrownBy, thrownEaseM } from './Session';

const world = buildWorld(arena);
const DT = 1 / 60;

function hero(): { s: SimState; p: PlayerState } {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(5), bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.invulnTime = 0;
  return { s, p };
}

const sprint = (): PlayerCommand => ({ ...idleCommand(), moveZ: 1, aimZ: 1, sprint: true });

describe("a heavy hit's throw eases (the Warden's slam, critic 17 Nov)", () => {
  it('a slam into a sprinting hero is past the snap limit and inside the eased one', () => {
    const server = hero();
    const browser = hero();
    for (let t = 0; t < 30; t++) {
      stepPlayer(server.p, sprint(), DT, world, server.s);
      stepPlayer(browser.p, sprint(), DT, world, browser.s);
    }
    // The Warden slams in front of the hero: the throw runs against the sprint, the worst case.
    server.s.events = [];
    const w = tuning.warden;
    expect(hurtHero(server.s, server.p, { damage: 1, heavy: true, push: w.knockbackDealt, fromX: server.p.x, fromZ: server.p.z + 1, late: true })).toBe('hit');
    expect(thrownBy(server.s.events, 'p1')).toBe(true);
    expect(thrownBy(server.s.events, 'p2')).toBe(false);
    expect(placedBy(server.s.events, 'p1')).toBe(false);
    // The browser learns of it a snapshot or a round trip later (up to 300 ms) and has sprinted on meanwhile.
    let worst = 0;
    for (let t = 0; t < 18; t++) {
      stepPlayer(server.p, sprint(), DT, world, server.s);
      stepPlayer(browser.p, sprint(), DT, world, browser.s);
      worst = Math.max(worst, Math.hypot(server.p.x - browser.p.x, server.p.z - browser.p.z));
    }
    expect(worst).toBeGreaterThan(SNAP_M);
    expect(worst).toBeLessThan(thrownEaseM());
  });

  it('a light hit throws nobody, so it never widens the limit', () => {
    const { s, p } = hero();
    s.events = [];
    hurtHero(s, p, { damage: 1, fromX: p.x, fromZ: p.z + 1, late: true });
    expect(thrownBy(s.events, 'p1')).toBe(false);
  });

  it("the longest throw follows the panel's edits", () => {
    const kept = tuning.warden.knockbackDealt;
    try {
      expect(longestKnockbackM()).toBeGreaterThanOrEqual(kept);
      tuning.warden.knockbackDealt = 7;
      expect(longestKnockbackM()).toBe(7);
    } finally {
      tuning.warden.knockbackDealt = kept;
    }
  });
});
