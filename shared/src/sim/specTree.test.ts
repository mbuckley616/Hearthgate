import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { curseRing, hexedMult, shadowSwap, warlockHex, deadeye, smokeBomb, stepVenom, venomVolley, galeStep, markedMult, scoutMark, stormChain, brambleRain, snareTrap, stepSnares, thornshot, bladeCount, bladeStorm, blazingTrail, consecrate, fanOfKnives, shadowStrike, shadowstep, holyPulse, specCrescendo, specInfo, spectralBlades, taunt, treeProblem, SPECS, TREE_LEVELS } from './specs';
import { emptyTalents } from './talents';
import type { PlayerState, SimState } from './types';
import type { SpecId } from './specs';
import type { ProjectileState } from './types';
import { newFlow } from './flow';
import { createSimState } from './world';

// The specialization trees (Michael's A, 8 Nov): two choices a row at 20, 30 and 40, a Crescendo at 50.
const world = buildWorld(arena);
const xpAt = (level: number) => ({ sword: xpForLevel(level), bow: 0, staff: 0 });
const base = (level: number, tree?: string[], spec: SpecId = 'paladin'): Loadout => ({
  name: 'p',
  xp: { sword: xpForLevel(level), bow: xpForLevel(level), staff: xpForLevel(level) },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
  spec: { [specInfo(spec).style]: spec },
  ...(tree ? { tree: { [specInfo(spec).style]: tree } } : {}),
});

const awake = (s: SimState, x: number, z: number) => Object.assign(createEnemy(s, world, 'grunt', x, z, 0), { x, z, ai: 'chase' as const, aiTime: 0 });

function scene(level: number, tree?: string[], spec: SpecId = 'paladin'): { s: SimState; p: PlayerState; friend: PlayerState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', base(level, tree, spec), false);
  p.style = specInfo(spec).style;
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

describe("the Ranger's tree", () => {
  const ranger = (level: number, tree?: string[]) => scene(level, tree, 'ranger');

  it('Deep Roots holds a skeleton longer; Grasping Thorns roots a Brute but never a boss', () => {
    const plain = ranger(20);
    const e = awake(plain.s, 0, 6);
    thornshot(plain.s, plain.p, e);
    expect(e.rootUntil).toBeCloseTo(plain.s.time + tuning.specs.thornRootS);
    const deep = ranger(20, ['deep-roots']);
    const f = awake(deep.s, 0, 6);
    thornshot(deep.s, deep.p, f);
    expect(f.rootUntil).toBeCloseTo(deep.s.time + tuning.specs.treeThornRootS);
    const grasp = ranger(40, ['thicket', 'overgrowth', 'grasping-thorns']);
    const brute = Object.assign(createEnemy(grasp.s, world, 'brute', 0, 6, 0), { ai: 'chase' as const });
    const boss = Object.assign(createEnemy(grasp.s, world, 'warden', 0, 4, 0), { ai: 'chase' as const });
    thornshot(grasp.s, grasp.p, brute);
    thornshot(grasp.s, grasp.p, boss);
    expect(brute.rootUntil).toBeGreaterThan(grasp.s.time);
    expect(boss.rootUntil ?? 0).toBeLessThanOrEqual(grasp.s.time);
  });

  it('Thicket widens the patch and Overgrowth lengthens it', () => {
    const { s, p } = ranger(30, ['thicket', 'overgrowth']);
    brambleRain(s, p, world.colliders);
    expect(s.brambles![0].radius).toBeCloseTo(tuning.specs.brambleRadius * tuning.specs.treeThicketMult);
    expect(s.brambles![0].until).toBeCloseTo(s.time + tuning.specs.treeBrambleSeconds);
  });

  it('Iron Jaws holds longer; Twin Snares keeps two traps waiting', () => {
    const jaws = ranger(30, ['thicket', 'iron-jaws']);
    snareTrap(jaws.s, jaws.p);
    const e = awake(jaws.s, jaws.p.x, jaws.p.z);
    stepSnares(jaws.s);
    expect(e.rootUntil).toBeCloseTo(jaws.s.time + tuning.specs.treeSnareRootS);
    const one = ranger(40);
    snareTrap(one.s, one.p);
    snareTrap(one.s, one.p);
    expect(one.s.snares).toHaveLength(1);
    const twin = ranger(40, ['thicket', 'iron-jaws', 'twin-snares']);
    snareTrap(twin.s, twin.p);
    snareTrap(twin.s, twin.p);
    snareTrap(twin.s, twin.p);
    expect(twin.s.snares).toHaveLength(2);
  });

  it('Wildwood: at 50 a Crescendo grows a patch twice as wide at the Ranger\'s feet', () => {
    const { s, p } = ranger(50);
    specCrescendo(s, p);
    expect(s.brambles![0]).toMatchObject({ x: p.x, z: p.z });
    expect(s.brambles![0].radius).toBeCloseTo(tuning.specs.brambleRadius * tuning.specs.wildwoodRadiusMult);
  });
});

describe("the Scout's tree", () => {
  const scout = (level: number, tree?: string[]) => scene(level, tree, 'scout');
  const arrow = (damage: number) => ({ damage, marks: true, hitIds: [] as number[] }) as unknown as ProjectileState;

  it("Hunter's Mark lasts longer; Exposed adds more; Rising Tempo fills Flow faster", () => {
    const plain = scout(30);
    plain.p.flow = newFlow();
    const e = awake(plain.s, 0, 6);
    scoutMark(plain.s, plain.p, e);
    expect(e.scoutMark!.until).toBeCloseTo(plain.s.time + tuning.specs.markSeconds);
    expect(markedMult(plain.s, e, plain.friend, false)).toBeCloseTo(1 + tuning.specs.markDamageBonus);
    const v0 = plain.p.flow.v;
    const all = scout(40, ['hunters-mark', 'exposed', 'rising-tempo']);
    all.p.flow = newFlow();
    const f = awake(all.s, 0, 6);
    scoutMark(all.s, all.p, f);
    expect(f.scoutMark!.until).toBeCloseTo(all.s.time + tuning.specs.treeMarkSeconds);
    expect(markedMult(all.s, f, all.friend, false)).toBeCloseTo(1 + tuning.specs.treeExposedBonus);
    expect(all.p.flow.v).toBeCloseTo(v0 * tuning.specs.treeTempoFlowMult);
  });

  it('Forked Lightning hops on twice more; Long Arc leaps further', () => {
    const chains = (tree?: string[], gap = 4) => {
      const { s, p } = scout(30, tree);
      const from = awake(s, 0, 0);
      for (let i = 1; i <= 4; i++) Object.assign(awake(s, i * gap, 0), { hp: 9999 });
      stormChain(s, p, arrow(10), from);
      return s.events.filter((ev) => ev.kind === 'stormChain').length;
    };
    expect(chains()).toBe(1);
    expect(chains(['forked-lightning'])).toBe(1 + tuning.specs.treeForkHops);
    expect(chains(undefined, 7)).toBe(0);
    expect(chains(['hunters-mark', 'long-arc'], 7)).toBe(1);
  });

  it("Tailwind: Gale Step's window is longer", () => {
    const { s, p } = scout(40, ['hunters-mark', 'exposed', 'tailwind']);
    galeStep(s, p, 0);
    expect(p.galeUntil).toBeCloseTo(s.time + tuning.specs.treeGaleWindowS);
  });

  it('Stormcaller: at 50 a Crescendo marks every enemy within its reach', () => {
    const { s, p } = scout(50);
    const near = awake(s, 4, 10);
    const far = awake(s, 0, 10 + tuning.specs.stormcallRadius + 2);
    specCrescendo(s, p);
    expect(near.scoutMark?.by).toBe('p1');
    expect(far.scoutMark).toBeUndefined();
  });
});

describe("the Assassin's tree", () => {
  const assassin = (level: number, tree?: string[]) => scene(level, tree, 'assassin');
  const shot = { charged: true, style: 'bow', marks: true, hitIds: [] } as unknown as ProjectileState;

  it('Cold Eye finds a back at 75 degrees off; Killing Blow crits harder', () => {
    // The enemy faces +z; the arrow flies 75 degrees off its facing.
    const a = (75 * Math.PI) / 180;
    const plain = assassin(40);
    const e = awake(plain.s, 0, 6);
    e.yaw = 0;
    expect(deadeye(plain.p, shot, e, Math.sin(a), Math.cos(a))).toBe(1);
    const cold = assassin(40, ['cold-eye']);
    expect(deadeye(cold.p, shot, e, Math.sin(a), Math.cos(a))).toBe(tuning.specs.deadeyeCritMult);
    const kill = assassin(40, ['cold-eye', 'thick-smoke', 'killing-blow']);
    expect(deadeye(kill.p, shot, e, 0, 1)).toBe(tuning.specs.treeDeadeyeCritMult);
  });

  it('Virulence stacks higher, Lingering Venom lasts longer, Toxic Bite bites harder', () => {
    const { s, p } = assassin(40, ['virulence', 'lingering-venom', 'toxic-bite']);
    const e = awake(s, 0, 6);
    e.hp = 9999;
    for (let i = 0; i < 10; i++) venomVolley(s, p, shot, e);
    expect(e.venom!.stacks).toBe(tuning.specs.treeVenomStacks);
    expect(e.venom!.until).toBeCloseTo(s.time + tuning.specs.treeVenomSeconds);
    s.time = e.venom!.next;
    stepVenom(s, e, 1.8);
    expect(9999 - e.hp).toBeCloseTo(tuning.specs.venomDamage * tuning.specs.treeVenomStacks * tuning.specs.treeVenomMult);
  });

  it('Thick Smoke hides longer; Vanish at 50 smokes on a Crescendo', () => {
    const thick = assassin(30, ['cold-eye', 'thick-smoke']);
    smokeBomb(thick.s, thick.p);
    expect(thick.p.hiddenUntil).toBeCloseTo(thick.s.time + tuning.specs.treeSmokeSeconds);
    const { s, p } = assassin(50);
    specCrescendo(s, p);
    expect(p.hiddenUntil).toBeCloseTo(s.time + tuning.specs.smokeSeconds);
    const below = assassin(49);
    specCrescendo(below.s, below.p);
    expect(below.p.hiddenUntil).toBeUndefined();
  });
});

describe("the Warlock's tree", () => {
  const warlock = (level: number, tree?: string[]) => scene(level, tree, 'warlock');
  const bolt = { style: 'staff', damage: 10 } as never;

  it('Lasting Hex lengthens a hex; Deep Hex deepens it for everyone; Leech drains more', () => {
    const plain = warlock(30);
    const e = awake(plain.s, 0, 6);
    warlockHex(plain.s, e, plain.p, bolt, 10, false);
    expect(e.hex!.until).toBeCloseTo(plain.s.time + tuning.specs.hexSeconds);
    expect(hexedMult(plain.s, e, plain.friend, false)).toBeCloseTo(1 + tuning.specs.hexDamageBonus);
    const deep = warlock(30, ['lasting-hex', 'deep-hex']);
    const f = awake(deep.s, 0, 6);
    warlockHex(deep.s, f, deep.p, bolt, 10, false);
    expect(f.hex!.until).toBeCloseTo(deep.s.time + tuning.specs.treeHexSeconds);
    expect(hexedMult(deep.s, f, deep.friend, false)).toBeCloseTo(1 + tuning.specs.treeHexBonus);
    const leech = warlock(30, ['lasting-hex', 'leech']);
    const g = awake(leech.s, 0, 6);
    leech.p.hp = 50;
    warlockHex(leech.s, g, leech.p, bolt, 10, true);
    expect(leech.p.hp).toBeCloseTo(50 + 10 * tuning.specs.treeHexDrain);
  });

  it('Long Curse: the ring hexes longer', () => {
    const { s, p } = warlock(20, ['long-curse']);
    const e = awake(s, 0, 6);
    curseRing(s, p, e);
    expect(e.hex!.until).toBeCloseTo(s.time + tuning.specs.treeCurseRingHexS);
  });

  it('Far Swap reaches further; Binding Swap hexes the one swapped', () => {
    const at = 5 + tuning.specs.swapReach + 1;
    const plain = warlock(40);
    const e = awake(plain.s, 0, 10 - at);
    plain.p.attackTarget = e.id;
    expect(shadowSwap(plain.s, plain.p, 5)).toBe(false);
    const far = warlock(40, ['lasting-hex', 'deep-hex', 'far-swap']);
    const f = awake(far.s, 0, 10 - at);
    far.p.attackTarget = f.id;
    expect(shadowSwap(far.s, far.p, 5)).toBe(true);
    expect(f.hex).toBeUndefined();
    const bind = warlock(40, ['lasting-hex', 'deep-hex', 'binding-swap']);
    const g = awake(bind.s, 0, 7);
    bind.p.attackTarget = g.id;
    expect(shadowSwap(bind.s, bind.p, 5)).toBe(true);
    expect(g.hex?.by).toBe('p1');
  });

  it('Doom: at 50 a Crescendo hexes every enemy within its reach', () => {
    const { s, p } = warlock(50);
    const near = awake(s, 3, 10);
    const far = awake(s, 0, 10 + tuning.specs.doomRadius + 2);
    specCrescendo(s, p);
    expect(near.hex?.by).toBe('p1');
    expect(far.hex).toBeUndefined();
  });
});
