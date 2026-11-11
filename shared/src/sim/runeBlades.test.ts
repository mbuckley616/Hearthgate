import { describe, expect, it } from 'vitest';
import { tuning, type Style } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel, type Mods } from './gear';
import { stepPlayer } from './player';
import { stepProjectiles } from './projectiles';
import { emptyTalents, heroHit } from './talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// Rune of Blades (the builds pass, Michael's A, 11 Nov): a sword's light finisher looses two spectral
// blades ahead; no other step and no heavy does.

const world = buildWorld(arena);
const DT = 1 / 60;

function hero(mods: Partial<Mods>, style: Style = 'sword') {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = style;
  p.invulnTime = 0;
  return { s, p };
}

/** Tap through n steps of the chain; the blades loosed on each step. */
function chain(s: SimState, p: PlayerState, n: number): number[] {
  const loosed: number[] = [];
  let seq = -1;
  let steps = 0;
  for (let t = 0; t < 2000 && steps <= n; t++) {
    const h = heroHit(p, p.attackHit);
    const ready = steps < n && (p.mode === 'move' || (p.mode === 'attack' && p.attackSeq !== seq && p.attackTime >= h.windup + h.active - 0.05));
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1, attack: ready };
    if (ready) seq = p.attackSeq;
    const before = p.attackSeq;
    stepPlayer(p, cmd, DT, world, s);
    if (p.attackSeq !== before) {
      steps++;
      loosed.push(0);
    }
    const blades = s.events.filter((e) => e.kind === 'fire' && e.projectile === 'blade').length;
    s.events = [];
    if (blades && loosed.length) loosed[loosed.length - 1] += blades;
    if (steps >= n && p.mode === 'move') break;
  }
  return loosed;
}

describe('Rune of Blades', () => {
  it('only the light chain’s last step looses them, once, two blades', () => {
    const { s, p } = hero({ runes: ['blades'] });
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, 1]);
    expect(s.projectiles.filter((pr) => pr.kind === 'blade')).toHaveLength(2);
    expect(s.projectiles.every((pr) => pr.style === 'sword' && pr.owner === 'p1')).toBe(true);
  });

  it('a hero without the rune looses none', () => {
    const { s, p } = hero({});
    expect(chain(s, p, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(s.projectiles).toHaveLength(0);
  });

  it('a low hero’s shorter chain ends in its finisher, and so looses them on its third step', () => {
    const { s, p } = hero({ runes: ['blades'] });
    p.xp.sword = 0;
    expect(chain(s, p, 3)).toEqual([0, 0, 1]);
  });

  it('a held heavy is not the finisher', () => {
    const { s, p } = hero({ runes: ['blades'] });
    for (let t = 0; t < 120; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: true }, DT, world, s);
    expect(p.attackCharge).toBeDefined();
    expect(s.projectiles.filter((pr) => pr.kind === 'blade')).toHaveLength(0);
  });

  it('the blades fly ahead and cut an enemy past the finisher’s reach for half its hit', () => {
    const { s, p } = hero({ runes: ['blades'] });
    p.z = -12;
    chain(s, p, 5);
    const hit = heroHit(p, p.attackHit).damage;
    // Out of the swing's reach: 4 m on from where the blades left the hero, well inside their 8 m.
    const blade = s.projectiles[0];
    const far = createEnemy(s, world, 'grunt', p.x, blade.z + 4, Math.PI);
    far.hp = far.maxHp = 1000;
    far.ai = 'chase';
    far.x = p.x;
    far.z = blade.z + 4;
    for (let t = 0; t < 60; t++) stepProjectiles(s, DT, world.colliders);
    expect(far.hp).toBeLessThan(1000);
    // Both blades find it, each about half the finisher's hit (the hero's level and bonuses on top).
    expect(1000 - far.hp).toBeGreaterThan(hit * tuning.runes.bladesDamage * 1.5);
    expect(s.projectiles.filter((pr) => pr.kind === 'blade')).toHaveLength(0);
  });
});
