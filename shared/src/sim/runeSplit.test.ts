import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { emptyMods, xpForLevel, type Mods } from './gear';
import { stepPlayer } from './player';
import { stepProjectiles } from './projectiles';
import { emptyTalents, heroHit } from './talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// Rune of Splitting (the builds pass, Michael's A, 11 Nov): a staff light finisher's orb breaks into
// three bolts where it lands; no other step's does.

const world = buildWorld(arena);
const DT = 1 / 60;

function setup(mods: Partial<Mods>, level = 20) {
  const s = createSimState(arena, [], world);
  const xp = xpForLevel(level);
  const l: Loadout = { name: 'p', xp: { sword: xp, bow: xp, staff: xp }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'staff';
  p.x = 3;
  p.z = -2;
  p.yaw = 0;
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return { s, p };
}

/** Tap through n steps, stepping what they loose; for each step, how many split pieces were made. */
function chain(s: SimState, p: PlayerState, n: number): number[] {
  const pieces: number[] = [];
  let seq = -1;
  let steps = 0;
  for (let t = 0; t < 3000; t++) {
    const h = heroHit(p, p.attackHit);
    const ready = steps < n && (p.mode === 'move' || (p.mode === 'attack' && p.attackSeq !== seq && p.attackTime >= h.windup + h.active - 0.05));
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1, attack: ready };
    if (ready) seq = p.attackSeq;
    const before = p.attackSeq;
    stepPlayer(p, cmd, DT, world, s);
    if (p.attackSeq !== before) {
      steps++;
      pieces.push(0);
    }
    const ids = new Set(s.projectiles.map((pr) => pr.id));
    stepProjectiles(s, DT, world.colliders);
    const fresh = s.projectiles.filter((pr) => !ids.has(pr.id)).length;
    if (fresh && pieces.length) pieces[pieces.length - 1] += fresh;
    if (steps >= n && p.mode === 'move' && s.projectiles.length === 0) break;
  }
  return pieces;
}

describe('Rune of Splitting', () => {
  it('only the light finisher’s orb splits, into three bolts', () => {
    const { s, p } = setup({ runes: ['split'] });
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, tuning.runes.splitBolts]);
  });

  it('without the rune nothing splits', () => {
    const { s, p } = setup({});
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('a low hero’s third step is their finisher, and its burst splits', () => {
    const { s, p } = setup({ runes: ['split'] }, 1);
    expect(chain(s, p, 3)).toEqual([0, 0, tuning.runes.splitBolts]);
  });
});
