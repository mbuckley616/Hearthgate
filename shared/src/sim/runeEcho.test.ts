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

// Rune of Echoes (the builds pass, Michael's A, 12 Nov): a bow light finisher's arrows fly again,
// pale ghosts along the same line a moment later, for half their hit; no other step's do.

const world = buildWorld(arena);
const DT = 1 / 60;

function setup(mods: Partial<Mods>, level = 20) {
  const s = createSimState(arena, [], world);
  const xp = xpForLevel(level);
  const l: Loadout = { name: 'p', xp: { sword: xp, bow: xp, staff: xp }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = 'bow';
  p.x = 3;
  p.z = -2;
  p.yaw = 0;
  for (let t = 0; t < 60; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return { s, p };
}

/** Tap through n steps, stepping what they loose; for each step, how many echoes it made. */
function chain(s: SimState, p: PlayerState, n: number): number[] {
  const echoes: number[] = [];
  const seen = new Set<number>();
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
      echoes.push(0);
    }
    for (const pr of s.projectiles) {
      if (!pr.echo || seen.has(pr.id)) continue;
      seen.add(pr.id);
      echoes[echoes.length - 1]++;
    }
    stepProjectiles(s, DT, world.colliders);
    if (steps >= n && p.mode === 'move' && s.projectiles.length === 0) break;
  }
  return echoes;
}

describe('Rune of Echoes', () => {
  it('only the light finisher’s arrow echoes', () => {
    const { s, p } = setup({ runes: ['echo'] });
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, 1]);
  });

  it('without the rune nothing echoes', () => {
    const { s, p } = setup({});
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('a low hero’s third step is their finisher, and its arrow echoes', () => {
    const { s, p } = setup({ runes: ['echo'] }, 1);
    expect(chain(s, p, 3)).toEqual([0, 0, 1]);
  });

  it('the echo waits where the arrow was loosed, then flies its line for half its hit', () => {
    const { s, p } = setup({ runes: ['echo'] }, 1);
    // Tap the chain until the finisher looses, and stop there.
    let seq = -1;
    let fired = false;
    for (let t = 0; t < 600 && !fired; t++) {
      const h = heroHit(p, p.attackHit);
      const ready = p.mode === 'move' || (p.mode === 'attack' && p.attackSeq !== seq && p.attackTime >= h.windup + h.active - 0.05);
      if (ready) seq = p.attackSeq;
      stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: ready }, DT, world, s);
      fired = s.projectiles.some((pr) => pr.echo);
    }
    expect(fired).toBe(true);
    const echo = s.projectiles.find((pr) => pr.echo)!;
    const arrow = s.projectiles.find((pr) => pr.id === echo.id - 1)!;
    expect([arrow.x, arrow.z, arrow.vx, arrow.vz]).toEqual([echo.x, echo.z, echo.vx, echo.vz]);
    expect(arrow).toBeDefined();
    expect(echo.damage).toBeCloseTo(arrow.damage * tuning.runes.echoDamage);
    const at = { x: echo.x, z: echo.z };
    const waitTicks = Math.round(tuning.runes.echoDelayMs / 1000 / DT);
    for (let t = 0; t < waitTicks - 1; t++) stepProjectiles(s, DT, world.colliders);
    expect(echo.x).toBe(at.x);
    expect(echo.z).toBe(at.z);
    expect(echo.age).toBe(0);
    expect(echo.waits).toBeGreaterThan(0);
    s.events.length = 0;
    stepProjectiles(s, DT, world.colliders);
    stepProjectiles(s, DT, world.colliders);
    expect(echo.waits).toBeUndefined();
    expect(echo.z).toBeGreaterThan(at.z);
    expect(s.events.some((e) => e.kind === 'fire' && e.projectile === 'arrow')).toBe(true);
  });
});
