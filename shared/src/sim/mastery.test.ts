import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { damageEnemy, payCombo, type HitSpec } from './combat';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { COMBOS, COMBO_NAMES, masteryPayoffMult, masteryRank, readMastery } from './mastery';
import { emptyTalents } from './talents';
import type { SimState } from './types';
import { createSimState } from './world';

// Combo mastery (the builds pass, Michael's A on Soaked, 10 Nov): every payoff a player lands counts
// toward that combo's rank, I to V. The server counts; the browser's save carries the count.

const world = buildWorld(arena);
const kept = tuning.mastery.enabled;
afterEach(() => {
  tuning.mastery.enabled = kept;
});

const loadout = (name: string): Loadout => ({
  name,
  xp: { sword: xpForLevel(30), bow: xpForLevel(30), staff: xpForLevel(30) },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
});

const hit = (attackerId: string, style: HitSpec['style'], over: Partial<HitSpec> = {}): HitSpec => ({
  attackerId, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: 0, y: 1, z: 0, style, ...over,
});

function party(): SimState {
  const s = createSimState(arena, [], world);
  addPlayer(s, world, 'p1', loadout('p1'), false);
  addPlayer(s, world, 'p2', loadout('p2'), false);
  return s;
}

describe('combo mastery', () => {
  it('ranks I to V come at the panel’s counts', () => {
    const m = tuning.mastery;
    expect(masteryRank(undefined)).toBe(0);
    expect(masteryRank(m.rank1 - 1)).toBe(0);
    expect(masteryRank(m.rank1)).toBe(1);
    expect(masteryRank(m.rank3)).toBe(3);
    expect(masteryRank(m.rank5 * 10)).toBe(5);
    // The Talents tab lists every combo by its callout's name.
    expect(COMBOS.map((c) => COMBO_NAMES[c])).toEqual(['Shatter', 'Skewer', 'Detonate', 'Uproot', 'Wildfire']);
  });

  it('a payoff the server decides counts for its payer alone', () => {
    const s = party();
    const e = createEnemy(s, world, 'grunt', 0, 0, 0);
    e.x = 0;
    e.z = 0;
    e.y = 0;
    e.ai = 'chase';
    e.hp = e.maxHp = 1000;
    e.poise = 1000;
    s.enemies.push(e);
    damageEnemy(s, e, hit('p1', 'bow', { slowTime: 1 }));
    damageEnemy(s, e, hit('p2', 'sword', { heavy: true }));
    expect(s.events.some((ev) => ev.kind === 'combo' && ev.combo === 'shatter')).toBe(true);
    expect(s.players[1].mastery).toEqual({ shatter: 1 });
    expect(s.players[0].mastery).toBeUndefined();
  });

  it('reaching a rank says so once, to the payer', () => {
    const s = party();
    const p = s.players[0];
    p.mastery = { detonate: tuning.mastery.rank1 - 1 };
    payCombo(s, 'detonate', p.id, 0, 0, 0);
    payCombo(s, 'detonate', p.id, 0, 0, 0);
    const ranks = s.events.filter((ev) => ev.kind === 'masteryRank');
    expect(ranks).toEqual([{ kind: 'masteryRank', playerId: 'p1', combo: 'detonate', rank: 1 }]);
    expect(p.mastery.detonate).toBe(tuning.mastery.rank1 + 1);
  });

  it('henchmen count nothing, and the slice (switch off) counts nothing', () => {
    const s = party();
    s.players[0].henchman = true;
    payCombo(s, 'skewer', 'p1', 0, 0, 0);
    expect(s.players[0].mastery).toBeUndefined();
    tuning.mastery.enabled = false;
    payCombo(s, 'skewer', 'p2', 0, 0, 0);
    expect(s.players[1].mastery).toBeUndefined();
  });

  it('the save’s count rides the loadout to the server and onto the hero; a bad one is refused', () => {
    const l = readLoadout({ ...loadout('Ann'), mastery: { uproot: 12.7, fan: 0 } });
    expect(l?.mastery).toEqual({ uproot: 12 });
    expect(readLoadout({ ...loadout('Ann'), mastery: { soaked: 3 } })).toBeNull();
    expect(readLoadout({ ...loadout('Ann'), mastery: { shatter: -1 } })).toBeNull();
    expect(readMastery([1])).toBeNull();
    const s = party();
    applyLoadout(s.players[0], l!, false);
    expect(s.players[0].mastery).toEqual({ uproot: 12 });
    applyLoadout(s.players[0], loadout('Ann'), false);
    expect(s.players[0].mastery).toBeUndefined();
  });

  it('ranks I to IV each add the panel’s step to the payoff; V adds no fifth', () => {
    const s = party();
    const p = s.players[0];
    const m = tuning.mastery;
    expect(masteryPayoffMult(p, 'shatter')).toBe(1);
    p.mastery = { shatter: m.rank1, skewer: m.rank4, detonate: m.rank5 };
    expect(masteryPayoffMult(p, 'shatter')).toBeCloseTo(1 + m.payoffPerRank);
    expect(masteryPayoffMult(p, 'skewer')).toBeCloseTo(1 + 4 * m.payoffPerRank);
    expect(masteryPayoffMult(p, 'detonate')).toBeCloseTo(1 + 4 * m.payoffPerRank);
    expect(masteryPayoffMult(undefined, 'shatter')).toBe(1);
    p.henchman = true;
    expect(masteryPayoffMult(p, 'skewer')).toBe(1);
    p.henchman = undefined;
    tuning.mastery.enabled = false;
    expect(masteryPayoffMult(p, 'skewer')).toBe(1);
  });

  it('a rank IV Shatter lands 24% harder than a first one, at the rank before it counts', () => {
    const dealt = (count: number | undefined): number => {
      const s = party();
      if (count !== undefined) s.players[1].mastery = { shatter: count };
      const e = createEnemy(s, world, 'grunt', 0, 0, 0);
      e.x = 0;
      e.z = 0;
      e.y = 0;
      e.ai = 'chase';
      e.hp = e.maxHp = 1000;
      e.poise = 1000;
      s.enemies.push(e);
      damageEnemy(s, e, hit('p1', 'bow', { slowTime: 1 }));
      const before = e.hp;
      damageEnemy(s, e, hit('p2', 'sword', { heavy: true }));
      return before - e.hp;
    };
    const plain = dealt(undefined);
    expect(dealt(tuning.mastery.rank4)).toBeCloseTo(plain * (1 + 4 * tuning.mastery.payoffPerRank));
    // The payoff that reaches rank I is still paid at rank 0.
    expect(dealt(tuning.mastery.rank1 - 1)).toBeCloseTo(plain);
  });

  it('rank V gives the sword’s specializations their twists; rank IV gives none', () => {
    const v = tuning.mastery.rank5;
    // The Rogue's resets Shadowstep.
    let s = party();
    let p = s.players[0];
    p.style = 'sword';
    p.spec = { sword: 'rogue' };
    p.cooldowns.sword[0] = 5;
    p.mastery = { shatter: v - 1 };
    payCombo(s, 'shatter', p.id, 0, 0, 0);
    expect(p.cooldowns.sword[0]).toBe(5);
    payCombo(s, 'shatter', p.id, 0, 0, 0);
    expect(p.cooldowns.sword[0]).toBe(0);
    // The Paladin's heals allies near them a little.
    s = party();
    p = s.players[0];
    p.style = 'sword';
    p.spec = { sword: 'paladin' };
    p.mastery = { uproot: v };
    const ally = s.players[1];
    ally.x = p.x + 1;
    ally.z = p.z;
    ally.hp = ally.maxHp / 2;
    payCombo(s, 'uproot', p.id, 0, 0, 0);
    expect(ally.hp).toBeCloseTo(ally.maxHp * (0.5 + tuning.mastery.paladinHeal));
    expect(s.events.some((ev) => ev.kind === 'holyPulse')).toBe(true);
    // The Spellblade's leaves its element's ground where the payoff landed, and it burns.
    s = party();
    p = s.players[0];
    p.style = 'sword';
    p.spec = { sword: 'spellblade' };
    p.elements = { sword: 'frost' };
    p.mastery = { shatter: v };
    payCombo(s, 'shatter', p.id, 4, 1, 2);
    expect(s.trails).toHaveLength(1);
    const g = s.trails![0];
    expect(g.element).toBe('frost');
    expect((g.x0 + g.x1) / 2).toBeCloseTo(4);
    expect((g.z0 + g.z1) / 2).toBeCloseTo(2);
    expect(g.tickDamage).toBeGreaterThan(0);
    // A henchman gets no twist.
    p.henchman = true;
    payCombo(s, 'shatter', p.id, 4, 1, 2);
    expect(s.trails).toHaveLength(1);
  });

  it('rank V gives the bow’s specializations theirs: brambles, marks, a fresh Smoke Bomb', () => {
    const v = tuning.mastery.rank5;
    const at = (spec: 'ranger' | 'scout' | 'assassin'): SimState => {
      const s = party();
      const p = s.players[0];
      p.style = 'bow';
      p.spec = { bow: spec };
      p.mastery = { skewer: v };
      p.cooldowns.bow[1] = 4;
      for (const [x, z] of [[5, 5], [7, 5], [20, 20]]) {
        const e = createEnemy(s, world, 'grunt', x, 0, z);
        e.x = x;
        e.z = z;
        e.y = 0;
        e.ai = 'chase';
      }
      payCombo(s, 'skewer', p.id, 5, 1, 5);
      return s;
    };
    const ranger = at('ranger');
    expect(ranger.brambles).toHaveLength(1);
    expect(ranger.brambles![0]).toMatchObject({ by: 'p1', x: 5, z: 5, radius: tuning.mastery.rangerBrambleRadius });
    const scout = at('scout');
    expect(scout.enemies.map((e) => e.scoutMark?.by)).toEqual(['p1', 'p1', undefined]);
    const assassin = at('assassin');
    expect(assassin.players[0].cooldowns.bow[1]).toBe(0);
    expect(ranger.players[0].cooldowns.bow[1]).toBe(4);
  });
});
