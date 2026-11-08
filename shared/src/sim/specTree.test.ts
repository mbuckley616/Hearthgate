import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { bladeCount, bladeStorm, blazingTrail, consecrate, fanOfKnives, shadowStrike, shadowstep, holyPulse, specCrescendo, specInfo, spectralBlades, taunt, treeProblem, SPECS, TREE_LEVELS } from './specs';
import { emptyTalents } from './talents';
import type { PlayerState, SimState } from './types';
import { createSimState } from './world';

// The specialization trees (Michael's A, 8 Nov): two choices a row at 20, 30 and 40, a Crescendo at 50.
const world = buildWorld(arena);
const xpAt = (level: number) => ({ sword: xpForLevel(level), bow: 0, staff: 0 });
const base = (level: number, tree?: string[], spec: 'paladin' | 'spellblade' | 'rogue' = 'paladin'): Loadout => ({
  name: 'p',
  xp: xpAt(level),
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
  spec: { sword: spec },
  ...(tree ? { tree: { sword: tree } } : {}),
});

const awake = (s: SimState, x: number, z: number) => Object.assign(createEnemy(s, world, 'grunt', x, z, 0), { x, z, ai: 'chase' as const, aiTime: 0 });

function scene(level: number, tree?: string[], spec: 'paladin' | 'spellblade' | 'rogue' = 'paladin'): { s: SimState; p: PlayerState; friend: PlayerState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', base(level, tree, spec), false);
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

describe("the Spellblade's tree", () => {
  const blade = (level: number, tree?: string[]) => scene(level, tree, 'spellblade');

  it('Lingering Flame lengthens the trail, Wide Wake widens it, Searing Path burns it hotter', () => {
    const plain = blade(40);
    blazingTrail(plain.s, plain.p, 0, 0, 100);
    const t0 = plain.s.trails![0];
    expect(t0.until).toBeCloseTo(plain.s.time + tuning.specs.blazingTrailSeconds);
    const all = blade(40, ['lingering-flame', 'wide-wake', 'searing-path']);
    blazingTrail(all.s, all.p, 0, 0, 100);
    const t1 = all.s.trails![0];
    expect(t1.until).toBeCloseTo(all.s.time + tuning.specs.treeLingerSeconds);
    expect(t1.width).toBeCloseTo(t0.width * tuning.specs.treeWakeWidthMult);
    expect(t1.tickDamage).toBeCloseTo(t0.tickDamage * tuning.specs.treeSearingMult);
  });

  it('Third Blade adds a blade', () => {
    expect(bladeCount(blade(20).p)).toBe(tuning.specs.spectralBlades);
    expect(bladeCount(blade(20, ['third-blade']).p)).toBe(tuning.specs.spectralBlades + 1);
  });

  it('Eye of the Storm draws a skeleton in from 8 m', () => {
    const plain = blade(30);
    const e = awake(plain.s, 0, 18);
    bladeStorm(plain.s, plain.p);
    expect(e.kbz).toBe(0);
    const eye = blade(30, ['third-blade', 'eye-of-the-storm']);
    const f = awake(eye.s, 0, 18);
    bladeStorm(eye.s, eye.p);
    expect(f.kbz).toBeLessThan(0);
  });

  it('Keen Edges: a blade hits for treeKeenBladeDamage of the Whirlwind', () => {
    const hit = (tree?: string[]) => {
      const { s, p } = blade(40, tree);
      const e = awake(s, 0, 13);
      e.hp = 9999;
      p.yaw = 0;
      spectralBlades(s, p, 0, 0.02, 2.4, 100);
      return 9999 - e.hp;
    };
    const plain = hit();
    const keen = hit(['third-blade', 'wide-wake', 'keen-edges']);
    expect(plain).toBeGreaterThan(0);
    expect(keen / plain).toBeCloseTo(tuning.specs.treeKeenBladeDamage / tuning.specs.spectralBladeDamage, 1);
  });

  it('Blade Tempest: at 50 a Crescendo lays a trail through the hero and every blade strikes those near at once', () => {
    const { s, p } = blade(50);
    p.yaw = 0;
    const near = awake(s, 1, 11);
    near.hp = 9999;
    const far = awake(s, 0, 20);
    far.hp = 9999;
    specCrescendo(s, p);
    const t = s.trails![0];
    expect(Math.hypot(t.x1 - t.x0, t.z1 - t.z0)).toBeCloseTo(tuning.specs.tempestTrailLength);
    expect(near.hp).toBeLessThan(9999);
    expect(far.hp).toBe(9999);
    const below = blade(49);
    specCrescendo(below.s, below.p);
    expect(below.s.trails).toBeUndefined();
  });
});

describe("the Rogue's tree", () => {
  const rogue = (level: number, tree?: string[]) => scene(level, tree, 'rogue');
  const knives = (s: SimState) => s.projectiles.filter((pr) => pr.owner === 'p1').length;

  it('Long Shadow steps behind a target 2 m past where Shadowstep reaches', () => {
    const at = tuning.abilities.chargeDistance + tuning.specs.shadowstepReach + 2;
    const plain = rogue(20);
    const e = awake(plain.s, 0, 10 - at);
    plain.p.attackTarget = e.id;
    expect(shadowstep(plain.s, plain.p, world.colliders)).toBeNull();
    const long = rogue(20, ['long-shadow']);
    const f = awake(long.s, 0, 10 - at);
    long.p.attackTarget = f.id;
    expect(shadowstep(long.s, long.p, world.colliders)).toBe(f);
  });

  it('Vanishing Step: the step primes From the shadows', () => {
    const { s, p } = rogue(40, ['long-shadow', 'patient-blade', 'vanishing-step']);
    const e = awake(s, 0, 7);
    p.attackTarget = e.id;
    shadowstep(s, p, world.colliders);
    expect(p.shadowUntil).toBeCloseTo(s.time + tuning.specs.treeShadowWindowS);
  });

  it('Knife Storm throws twelve; Honed Knives doubles each', () => {
    const plain = rogue(30);
    fanOfKnives(plain.s, plain.p);
    expect(knives(plain.s)).toBe(tuning.specs.fanKnives);
    const storm = rogue(30, ['knife-storm', 'honed-knives']);
    fanOfKnives(storm.s, storm.p);
    expect(knives(storm.s)).toBe(tuning.specs.treeFanKnives);
    const dmg = (s: SimState) => s.projectiles.find((pr) => pr.owner === 'p1')!.damage;
    expect(dmg(storm.s) / dmg(plain.s)).toBeCloseTo(tuning.specs.treeKnifeMult);
  });

  it('Deep Cut: a primed hit crits for treeShadowCritMult', () => {
    const { s, p } = rogue(40, ['long-shadow', 'honed-knives', 'deep-cut']);
    p.shadowUntil = s.time + 1;
    expect(shadowStrike(s, p, { damage: 10 } as never)).toBe(tuning.specs.treeShadowCritMult);
  });

  it('Thousand Cuts: at 50 a Crescendo throws the fan and primes; at 49 neither', () => {
    const { s, p } = rogue(50);
    specCrescendo(s, p);
    expect(knives(s)).toBe(tuning.specs.fanKnives);
    expect(p.shadowUntil).toBeGreaterThan(s.time);
    const below = rogue(49);
    specCrescendo(below.s, below.p);
    expect(knives(below.s)).toBe(0);
    expect(below.p.shadowUntil).toBeUndefined();
  });
});
