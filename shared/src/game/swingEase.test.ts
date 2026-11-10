import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from '../sim/coop';
import { emptyMods, xpForLevel } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents, heroHit } from '../sim/talents';
import { idleCommand, type PlayerCommand, type PlayerState } from '../sim/types';
import { createSimState } from '../sim/world';
import { SNAP_M, swingEaseM, swingMispredicted } from './Session';

const world = buildWorld(arena);
const DT = 1 / 60;

/**
 * An archer playing a string with each press held `holds[i]` ticks, pressing as the chain's buffer
 * opens. Returns the hero after every tick.
 */
function archer(holds: number[]): PlayerState[] {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'bow';
  p.invulnTime = 0;
  const out: PlayerState[] = [];
  let i = 0;
  let held = 0;
  let waitSeq = -1;
  for (let t = 0; t < 400; t++) {
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1 };
    if (waitSeq >= 0 && p.attackSeq !== waitSeq) waitSeq = -1;
    if (i < holds.length && held === 0 && waitSeq < 0) {
      const h = heroHit(p, p.attackHit);
      if (p.mode === 'move' || (p.mode === 'attack' && p.attackTime >= h.windup + h.active - tuning.combo.inputBufferMs / 2000)) {
        cmd.attack = true;
        held = holds[i++];
        waitSeq = p.attackSeq;
      }
    }
    if (held > 0) {
      cmd.attackHeld = true;
      held--;
    }
    s.events = [];
    stepPlayer(p, cmd, DT, world, s);
    out.push(structuredClone(p));
  }
  return out;
}

describe("a mispredicted swing eases (the bow's backflip, critic 9 Nov)", () => {
  it('a heavy decided a tick apart runs a different step, past the snap limit and inside the eased one', () => {
    const line = Math.ceil((tuning.combo.heavyHoldMs / 1000) * 60);
    // The browser held the second press to the heavy line; the server saw it a tick or two short.
    const browser = archer([line + 3, line + 2]);
    const server = archer([line + 3, line - 2]);
    let worst = 0;
    let witnessed = true;
    for (let t = 0; t < browser.length; t++) {
      const a = browser[t];
      const b = server[t];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > worst) worst = d;
      if (d > 0.01 && !swingMispredicted(a, b)) witnessed = false;
    }
    expect(browser.some((p) => p.attackString === 'HH')).toBe(true);
    expect(server.some((p) => p.attackString === 'HL')).toBe(true);
    // Over the snap limit (this is the snap the critic saw), and the ease takes it.
    expect(worst).toBeGreaterThanOrEqual(SNAP_M - 1e-6);
    expect(worst).toBeLessThan(swingEaseM());
    // Every tick the two stand apart, the swing itself says why.
    expect(witnessed).toBe(true);
  });

  it('the same swing on both sides, or no swing, is no witness', () => {
    const a = archer([3, 3]);
    for (const p of a) expect(swingMispredicted(p, structuredClone(p))).toBe(false);
    const still = { ...a[0], mode: 'move' as const };
    expect(swingMispredicted(still, { ...still, x: still.x + 3 })).toBe(false);
  });
});
