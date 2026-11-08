import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { chills, damageEnemy, shatterPays, skewerSets, type HitSpec } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// The states (the builds pass, Michael's A, 8 Nov): Shatter first. Frost's slows and freezes leave an
// enemy Chilled from any style, and any style's heavy cashes it in.

const world = buildWorld(arena);
const kept = tuning.combos.elementStates;
afterEach(() => {
  tuning.combos.elementStates = kept;
});

const loadout = (name: string): Loadout => ({
  name,
  xp: { sword: xpForLevel(30), bow: xpForLevel(30), staff: xpForLevel(30) },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
});

function fight(): { s: SimState; a: PlayerState; b: PlayerState } {
  const s = createSimState(arena, [], world);
  const a = addPlayer(s, world, 'p1', loadout('p1'), false);
  const b = addPlayer(s, world, 'p2', loadout('p2'), false);
  return { s, a, b };
}

function grunt(s: SimState): EnemyState {
  const e = createEnemy(s, world, 'grunt', 0, 0, 0);
  e.x = 0;
  e.z = 0;
  e.y = 0;
  e.ai = 'chase';
  e.hp = e.maxHp = 1000;
  e.poise = 1000;
  s.enemies.push(e);
  return e;
}

const hit = (attackerId: string, style: HitSpec['style'], over: Partial<HitSpec> = {}): HitSpec => ({
  attackerId,
  damage: 10,
  poise: 0,
  knockback: 0,
  heavy: false,
  dirX: 0,
  dirZ: 1,
  x: 0,
  y: 1,
  z: 0,
  style,
  ...over,
});

describe('the states: Shatter (the builds pass)', () => {
  it('a frost arrow chills an enemy, and a bow heavy or a staff heavy shatters it', () => {
    for (const payer of ['bow', 'staff', 'sword'] as const) {
      const { s, a, b } = fight();
      const e = grunt(s);
      damageEnemy(s, e, hit(a.id, 'bow', { slowTime: 1 }));
      expect(e.shatterUntil).toBeGreaterThan(s.time);
      const before = e.hp;
      damageEnemy(s, e, hit(b.id, payer, { heavy: true }));
      expect(e.shatterUntil).toBe(-1);
      expect(s.events.some((ev) => ev.kind === 'combo' && ev.combo === 'shatter')).toBe(true);
      expect(before - e.hp).toBeCloseTo(10 * (1 + tuning.combos.shatterDamageBonus), 0);
    }
  });

  it('a light hit leaves the Chill for a heavy', () => {
    const { s, a, b } = fight();
    const e = grunt(s);
    damageEnemy(s, e, hit(a.id, 'staff', { freezeTime: 0.5 }));
    damageEnemy(s, e, hit(b.id, 'bow'));
    expect(e.shatterUntil).toBeGreaterThan(s.time);
  });

  it('Frost ground chills; a Frost Spellblade’s own swings do not; other elements’ ground does not', () => {
    const { a } = fight();
    a.spec = { sword: 'spellblade' };
    a.elements = { sword: 'frost' };
    expect(chills(a, hit(a.id, 'sword', { dot: true }))).toBe(true);
    expect(chills(a, hit(a.id, 'sword'))).toBe(false);
    a.elements = { sword: 'fire' };
    expect(chills(a, hit(a.id, 'sword', { dot: true }))).toBe(false);
    // A bleed tick from a hero with no element chills nothing.
    expect(chills(undefined, hit('p9', 'sword', { dot: true, slowTime: 1 }))).toBe(false);
  });

  it('switched off (the slice): only a staff sets it up and only a sword heavy cashes it in', () => {
    tuning.combos.elementStates = false;
    const { a } = fight();
    expect(chills(a, hit(a.id, 'bow', { slowTime: 1 }))).toBe(false);
    expect(chills(a, hit(a.id, 'staff', { slowTime: 1 }))).toBe(true);
    expect(shatterPays(hit(a.id, 'bow', { heavy: true }))).toBe(false);
    expect(shatterPays(hit(a.id, 'sword', { heavy: true }))).toBe(true);
    tuning.combos.elementStates = true;
    expect(shatterPays(hit(a.id, 'bow', { heavy: true }))).toBe(true);
    expect(shatterPays(hit(a.id, 'staff', { heavy: true, dot: true }))).toBe(false);
  });

  it('Skewer: an Earth Sorcerer’s staggering bolt opens it, a Fire one’s does not, and the slice’s only by a blade', () => {
    const staggered = (element: 'earth' | 'fire', on = true) => {
      tuning.combos.elementStates = on;
      const { s, a } = fight();
      a.spec = { staff: 'sorcerer' };
      a.elements = { staff: element };
      const e = grunt(s);
      e.poise = 5;
      damageEnemy(s, e, hit(a.id, 'staff', { poise: 50, projectile: true }));
      expect(e.ai).toBe('stagger');
      return e.skewerUntil > s.time;
    };
    expect(staggered('earth')).toBe(true);
    expect(staggered('fire')).toBe(false);
    expect(staggered('earth', false)).toBe(false);
    const { a } = fight();
    expect(skewerSets(a, hit(a.id, 'sword'))).toBe(true);
    expect(skewerSets(a, hit(a.id, 'bow'))).toBe(false);
  });
});
