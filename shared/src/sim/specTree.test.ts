import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { consecrate, holyPulse, specCrescendo, specInfo, taunt, treeProblem, SPECS, TREE_LEVELS } from './specs';
import { emptyTalents } from './talents';
import type { PlayerState, SimState } from './types';
import { createSimState } from './world';

// The specialization trees (Michael's A, 8 Nov): two choices a row at 20, 30 and 40, a Crescendo at 50.
const world = buildWorld(arena);
const xpAt = (level: number) => ({ sword: xpForLevel(level), bow: 0, staff: 0 });
const base = (level: number, tree?: string[]): Loadout => ({
  name: 'p',
  xp: xpAt(level),
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
  spec: { sword: 'paladin' },
  ...(tree ? { tree: { sword: tree } } : {}),
});

const awake = (s: SimState, x: number, z: number) => Object.assign(createEnemy(s, world, 'grunt', x, z, 0), { x, z, ai: 'chase' as const, aiTime: 0 });

function scene(level: number, tree?: string[]): { s: SimState; p: PlayerState; friend: PlayerState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', base(level, tree), false);
  const friend = addPlayer(s, world, 'p2', { ...base(1), spec: undefined }, false);
  Object.assign(p, { x: 0, z: 10 });
  return { s, p, friend };
}

describe("a specialization's tree", () => {
  it('the Paladin has three rows of two and a Crescendo; every node id is unique', () => {
    const tree = specInfo('paladin').tree!;
    expect(tree).toHaveLength(TREE_LEVELS.length);
    expect(specInfo('paladin').crescendo?.[0]).toBe('Judgement');
    const ids = SPECS.flatMap((x) => x.tree ?? []).flat().map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a row opens at its level, takes one pick, and only from the chosen specialization', () => {
    expect(treeProblem(xpAt(20), { sword: 'paladin' }, { sword: ['long-grudge'] })).toBeNull();
    expect(treeProblem(xpAt(19), { sword: 'paladin' }, { sword: ['long-grudge'] })).not.toBeNull();
    expect(treeProblem(xpAt(40), { sword: 'paladin' }, { sword: ['long-grudge', 'sanctuary', 'wide-rush'] })).toBeNull();
    expect(treeProblem(xpAt(39), { sword: 'paladin' }, { sword: ['long-grudge', 'sanctuary', 'wide-rush'] })).not.toBeNull();
    expect(treeProblem(xpAt(40), { sword: 'paladin' }, { sword: ['long-grudge', 'hallowed-ground'] })).not.toBeNull();
    expect(treeProblem(xpAt(40), { sword: 'spellblade' }, { sword: ['long-grudge'] })).not.toBeNull();
    expect(treeProblem(xpAt(40), {}, { sword: ['long-grudge'] })).not.toBeNull();
  });

  it('the server takes picks the sword could have opened, and drops a loadout that claims more', () => {
    expect(readLoadout(base(30, ['hallowed-ground', 'rallying-light']))?.tree).toEqual({ sword: ['hallowed-ground', 'rallying-light'] });
    expect(readLoadout(base(29, ['hallowed-ground', 'rallying-light']))).toBeNull();
    expect(readLoadout(base(40, ['made-up']))).toBeNull();
    expect(readLoadout(base(20))?.tree).toBeUndefined();
  });

  it('a loadout without picks takes them off the hero', () => {
    const { p } = scene(20, ['long-grudge']);
    expect(p.tree).toEqual({ sword: ['long-grudge'] });
    applyLoadout(p, base(20), false);
    expect(p.tree).toBeUndefined();
  });
});

describe("the Paladin's tree", () => {
  it('Long Grudge: the taunt lasts treeTauntSeconds', () => {
    const plain = scene(20);
    const e = awake(plain.s, 0, 6);
    taunt(plain.s, plain.p, e);
    expect(e.taunt!.until).toBeCloseTo(plain.s.time + tuning.specs.tauntSeconds);
    const grudge = scene(20, ['long-grudge']);
    const f = awake(grudge.s, 0, 6);
    taunt(grudge.s, grudge.p, f);
    expect(f.taunt!.until).toBeCloseTo(grudge.s.time + tuning.specs.treeTauntSeconds);
  });

  it('Wide Rush: the enemies within its reach of the one hit are taunted too, those beyond are not', () => {
    const { s, p } = scene(40, ['long-grudge', 'sanctuary', 'wide-rush']);
    const hit = awake(s, 0, 6);
    const near = awake(s, 2, 6);
    const far = awake(s, tuning.specs.treeWideRushRadius + 1, 6);
    taunt(s, p, hit);
    expect(near.taunt?.by).toBe('p1');
    expect(far.taunt).toBeUndefined();
  });

  it('Hallowed Ground widens the ring and Sanctuary lengthens it', () => {
    const wide = scene(30, ['hallowed-ground']);
    consecrate(wide.s, wide.p);
    expect(wide.s.consecrated![0].radius).toBeCloseTo(tuning.specs.consecrateRadius * tuning.specs.treeHallowedRadiusMult);
    expect(wide.s.consecrated![0].until).toBeCloseTo(wide.s.time + tuning.specs.consecrateSeconds);
    const long = scene(30, ['long-grudge', 'sanctuary']);
    consecrate(long.s, long.p);
    expect(long.s.consecrated![0].radius).toBe(tuning.specs.consecrateRadius);
    expect(long.s.consecrated![0].until).toBeCloseTo(long.s.time + tuning.specs.treeSanctuarySeconds);
  });

  it('Rallying Light reaches a friend 6 m off; Oath of Mercy heals twice as much', () => {
    const plain = scene(40);
    Object.assign(plain.friend, { x: 0, z: 16, hp: 50 });
    holyPulse(plain.s, plain.p);
    expect(plain.friend.hp).toBe(50);
    const rally = scene(40, ['long-grudge', 'rallying-light']);
    Object.assign(rally.friend, { x: 0, z: 16, hp: 50 });
    holyPulse(rally.s, rally.p);
    expect(rally.friend.hp).toBeCloseTo(50 + rally.friend.maxHp * tuning.specs.bulwarkHeal);
    const mercy = scene(40, ['long-grudge', 'sanctuary', 'oath-of-mercy']);
    Object.assign(mercy.friend, { x: 0, z: 12, hp: 50 });
    holyPulse(mercy.s, mercy.p);
    expect(mercy.friend.hp).toBeCloseTo(50 + mercy.friend.maxHp * tuning.specs.bulwarkHeal * tuning.specs.treeMercyMult);
  });

  it('Judgement: at sword level 50 a Crescendo consecrates and taunts every enemy in the ring; at 49 nothing', () => {
    const below = scene(49);
    awake(below.s, 0, 11);
    specCrescendo(below.s, below.p);
    expect(below.s.consecrated).toBeUndefined();
    const { s, p } = scene(50);
    const inside = awake(s, 1, 11);
    const outside = awake(s, 0, 10 + tuning.specs.consecrateRadius + 2);
    specCrescendo(s, p);
    expect(s.consecrated).toHaveLength(1);
    expect(inside.taunt?.by).toBe('p1');
    expect(outside.taunt).toBeUndefined();
  });

  it('a Paladin holding a bow fires no Judgement', () => {
    const { s, p } = scene(50);
    p.style = 'bow';
    specCrescendo(s, p);
    expect(s.consecrated).toBeUndefined();
  });
});
