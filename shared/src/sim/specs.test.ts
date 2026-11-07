import { describe, expect, it } from 'vitest';
import { abilityTiming, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { addPlayer, applyLoadout, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods, xpForLevel } from './gear';
import { stepPlayer } from './player';
import { spawnArrow, spawnBolt, stepProjectiles } from './projectiles';
import { bladeStorm, blazingTrail, stepTrails, brambleRain, elementalNova, isRooted, stepGroves, wildGrowth, markedMult, snareTrap, stepBrambles, stepSnares, consecratedMult, fanOfKnives, elementFor, elementProblem, fadeConsecrated, specInfo, specProblem, specsFor, tauntedBy } from './specs';
import { damageEnemy, hurtHero } from './combat';
import { emptyTalents } from './talents';
import { newFlow } from './flow';
import { idleCommand, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const at10 = xpForLevel(tuning.specs.level);
const base = (sword: number): Loadout => ({ name: 'p', xp: { sword, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });

describe('specializations (the builds pass, Michael A, 6 Nov)', () => {
  it('Melee offers the Paladin, the Spellblade and the Rogue, all three built', () => {
    expect(specsFor('sword').map((s) => s.id)).toEqual(['paladin', 'spellblade', 'rogue']);
    expect(specsFor('sword').filter((s) => s.built).map((s) => s.id)).toEqual(['paladin', 'spellblade', 'rogue']);
    expect(specsFor('sword')[0].element).toBe('holy');
  });

  it('is earned at the style level 10, and only for its own style', () => {
    expect(specProblem({ sword: at10, bow: 0, staff: 0 }, { sword: 'paladin' })).toBeNull();
    expect(specProblem({ sword: at10 - 1, bow: 0, staff: 0 }, { sword: 'paladin' })).not.toBeNull();
    expect(specProblem({ sword: at10, bow: at10, staff: 0 }, { bow: 'paladin' })).not.toBeNull();
    expect(specProblem({ sword: at10, bow: 0, staff: 0 }, { sword: 'sorcerer' })).not.toBeNull();
  });

  it('the server takes a Paladin only from a loadout whose sword could have earned it', () => {
    const ok = readLoadout({ ...base(at10), spec: { sword: 'paladin' } });
    expect(ok?.spec).toEqual({ sword: 'paladin' });
    expect(readLoadout({ ...base(at10 - 1), spec: { sword: 'paladin' } })).toBeNull();
    expect(readLoadout({ ...base(at10), spec: { sword: 'warlord' } })).toBeNull();
    expect(readLoadout(base(0))?.spec).toBeUndefined();
  });
});

describe("a specialization's element (the Spellblade chooses Fire, Frost, Earth or Air)", () => {
  it('the Spellblade offers four, the Paladin only holy, and a specialization starts at its first', () => {
    expect(specInfo('spellblade').elements).toEqual(['fire', 'frost', 'earth', 'air']);
    expect(specInfo('paladin').elements).toEqual(['holy']);
    for (const x of specsFor('sword')) expect(x.elements[0]).toBe(x.element);
    expect(elementFor({ spec: { sword: 'spellblade' } }, 'sword')).toBe('fire');
    expect(elementFor({ spec: { sword: 'spellblade' }, elements: { sword: 'frost' } }, 'sword')).toBe('frost');
    expect(elementFor({}, 'sword')).toBeUndefined();
  });

  it("an element must be one its style's specialization offers", () => {
    expect(elementProblem({ sword: 'spellblade' }, { sword: 'air' })).toBeNull();
    expect(elementProblem({ sword: 'spellblade' }, { sword: 'holy' })).not.toBeNull();
    expect(elementProblem({ sword: 'paladin' }, { sword: 'fire' })).not.toBeNull();
    expect(elementProblem({}, { sword: 'fire' })).not.toBeNull();
    // A stale choice never colours anything: one the specialization does not offer reads as its own.
    expect(elementFor({ spec: { sword: 'paladin' }, elements: { sword: 'fire' } }, 'sword')).toBe('holy');
  });

  it('the server takes an element only with a specialization that offers it, and the hero carries it', () => {
    const ok = readLoadout({ ...base(at10), spec: { sword: 'paladin' }, elements: { sword: 'holy' } });
    expect(ok?.elements).toEqual({ sword: 'holy' });
    expect(readLoadout({ ...base(at10), spec: { sword: 'paladin' }, elements: { sword: 'fire' } })).toBeNull();
    expect(readLoadout({ ...base(at10), elements: { sword: 'holy' } })).toBeNull();
    expect(readLoadout({ ...base(at10), spec: { sword: 'rogue' }, elements: { sword: 'nature' } })?.elements).toEqual({ sword: 'nature' });
    expect(readLoadout({ ...base(at10), spec: { sword: 'spellblade' }, elements: { sword: 'frost' } })?.elements).toEqual({ sword: 'frost' });
    expect(readLoadout({ ...base(at10), spec: { sword: 'paladin' }, elements: { sword: 'plasma' } })).toBeNull();
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', ok!, false);
    expect(p.elements).toEqual({ sword: 'holy' });
    applyLoadout(p, base(at10), false);
    expect(p.elements).toBeUndefined();
  });
});

/** A Paladin (or not) facing a Skeleton Warrior four metres off, and a friend standing right beside the enemy. */
function scene(paladin: boolean): { s: SimState; p: PlayerState; friend: PlayerState; e: ReturnType<typeof createEnemy> } {
  const s = createSimState(arena, [], world);
  const l = { ...base(at10), ...(paladin ? { spec: { sword: 'paladin' as const } } : {}) };
  const p = addPlayer(s, world, 'p1', l, false);
  const friend = addPlayer(s, world, 'p2', base(0), false);
  // Out in the open, as meleeGuard.test.ts's dash, facing down the arena.
  Object.assign(p, { x: 0, z: 10, yaw: Math.PI, invulnTime: 0 });
  Object.assign(friend, { x: 1.5, z: 5.5, invulnTime: 0 });
  const e = createEnemy(s, world, 'grunt', 0, 6, 0);
  Object.assign(e, { x: 0, z: 6, ai: 'chase', aiTime: 0, cooldown: 0, hp: 9999 });
  return { s, p, friend, e };
}

function charge(s: SimState, p: PlayerState): void {
  const t = abilityTiming('charge');
  stepPlayer(p, { ...idleCommand(), ability1: true, aimX: 0, aimZ: -1 }, DT, world, s);
  for (let i = 0; i < 120 && p.abilityTime < t.windup + t.active; i++) stepPlayer(p, idleCommand(), DT, world, s);
}

describe("the Paladin's Shield Rush", () => {
  it('Charge taunts the enemy it hits: it turns on the Paladin for 3 s, though a friend stands nearer', () => {
    const { s, p, friend, e } = scene(true);
    charge(s, p);
    expect(e.taunt).toEqual({ by: 'p1', until: expect.closeTo(s.time + tuning.specs.tauntSeconds, 1) });
    expect(s.events.some((ev) => ev.kind === 'taunt' && ev.enemyId === e.id)).toBe(true);
    // Walk the Paladin back out so the friend is plainly nearer.
    Object.assign(p, { x: 0, z: 12, mode: 'idle' });
    expect(Math.hypot(friend.x - e.x, friend.z - e.z)).toBeLessThan(Math.hypot(p.x - e.x, p.z - e.z));
    expect(tauntedBy(s, e)).toBe(p);
    s.time = e.taunt!.until + 0.01;
    expect(tauntedBy(s, e)).toBeNull();
    expect(e.taunt).toBeUndefined();
  });

  it('the taunted enemy walks toward the Paladin, not the nearer friend', () => {
    const { s, p, e } = scene(true);
    charge(s, p);
    Object.assign(p, { x: -6, z: 6, mode: 'idle' });
    Object.assign(e, { ai: 'chase', aiTime: 0, x: 0, z: 6, kbx: 0, kbz: 0 });
    const x0 = e.x;
    for (let i = 0; i < 30; i++) stepEnemies(s, DT, world);
    expect(e.x).toBeLessThan(x0 - 0.3);
  });

  it('a hero without the Paladin taunts nothing, and a downed Paladin lets go', () => {
    const a = scene(false);
    charge(a.s, a.p);
    expect(a.e.taunt).toBeUndefined();
    const b = scene(true);
    charge(b.s, b.p);
    b.p.mode = 'down';
    expect(tauntedBy(b.s, b.e)).toBeNull();
  });

  it('a loadout without a specialization takes it off the hero', () => {
    const { p } = scene(true);
    expect(p.spec).toEqual({ sword: 'paladin' });
    applyLoadout(p, base(at10), false);
    expect(p.spec).toBeUndefined();
  });
});

describe("the Rogue's Shadowstep", () => {
  /** The scene with a Rogue (not offered yet, so set on the hero as the server would), the enemy facing them. */
  function rogue() {
    const sc = scene(false);
    sc.p.spec = { sword: 'rogue' };
    sc.e.yaw = 0;
    return sc;
  }

  it('Charge steps the Rogue behind its target, facing it, and lands there', () => {
    const { s, p, e } = rogue();
    charge(s, p);
    const er = 0.5;
    expect(p.z).toBeLessThan(e.z - er);
    expect(Math.abs(p.x - e.x)).toBeLessThan(0.05);
    // Facing back up the arena, at the enemy.
    expect(Math.cos(p.yaw)).toBeGreaterThan(0.99);
    expect(e.hp).toBeLessThan(9999);
    expect(s.events.some((ev) => ev.kind === 'shadowstep' && ev.playerId === 'p1')).toBe(true);
  });

  it('anyone else stops in front of it, and a Rogue with nothing in reach dashes as before', () => {
    const plain = scene(false);
    plain.e.yaw = 0;
    charge(plain.s, plain.p);
    expect(plain.p.z).toBeGreaterThan(plain.e.z);
    const far = rogue();
    Object.assign(far.e, { z: 10 - tuning.abilities.chargeDistance - tuning.specs.shadowstepReach - 4 });
    charge(far.s, far.p);
    expect(far.s.events.some((ev) => ev.kind === 'shadowstep')).toBe(false);
    expect(far.p.z).toBeGreaterThan(far.e.z);
  });
});

describe("the Rogue's Fan of Knives", () => {
  it('a Rogue throws knives evenly round as the spin starts; anyone else throws none', () => {
    const { s, p } = scene(false);
    fanOfKnives(s, p);
    expect(s.projectiles.length).toBe(0);
    p.spec = { sword: 'rogue' };
    fanOfKnives(s, p);
    const n = tuning.specs.fanKnives;
    expect(s.projectiles.length).toBe(n);
    const yaws = s.projectiles.map((pr) => Math.atan2(pr.vx, pr.vz)).sort((a, b) => a - b);
    for (let i = 1; i < n; i++) expect(yaws[i] - yaws[i - 1]).toBeCloseTo((Math.PI * 2) / n, 3);
  });

  it('a knife thrown at an enemy hurts it', () => {
    const { s, p, e } = scene(false);
    p.spec = { sword: 'rogue' };
    Object.assign(p, { mode: 'idle', yaw: Math.PI });
    fanOfKnives(s, p);
    for (let i = 0; i < 60; i++) stepProjectiles(s, DT, world.colliders);
    expect(e.hp).toBeLessThan(9999);
  });
});

describe("the Rogue's From the shadows", () => {
  /** Roll from four metres out straight down the arena through the enemy (or not, if `through` is false). */
  function roll(rogue: boolean, through = true) {
    const sc = scene(false);
    if (rogue) sc.p.spec = { sword: 'rogue' };
    Object.assign(sc.e, { ai: 'idle', x: through ? 0 : 4, z: 8.5 });
    stepPlayer(sc.p, { ...idleCommand(), dodge: true, moveX: 0, moveZ: -1 }, DT, world, sc.s);
    for (let i = 0; i < 60 && sc.p.mode === 'dodge'; i++) stepPlayer(sc.p, { ...idleCommand(), moveX: 0, moveZ: -1 }, DT, world, sc.s);
    return sc;
  }
  const blow = (p: PlayerState, e: { x: number; z: number }) => ({
    attackerId: p.id, damage: 10, poise: 0, knockback: 0, heavy: false, style: 'sword' as const, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z,
  });

  it("a Rogue's roll through an enemy primes the next hit to crit, once", () => {
    const { s, p, e } = roll(true);
    expect(p.shadowUntil).toBeGreaterThan(s.time);
    expect(s.events.filter((ev) => ev.kind === 'shadowPrimed').length).toBe(1);
    Object.assign(e, { hp: 1000 });
    damageEnemy(s, e, blow(p, e));
    const first = 1000 - e.hp;
    expect(p.shadowUntil).toBeUndefined();
    damageEnemy(s, e, blow(p, e));
    const second = 1000 - first - e.hp;
    expect(first).toBeCloseTo(second * tuning.specs.shadowCritMult, 5);
    expect(s.events.some((ev) => ev.kind === 'hit' && ev.crit)).toBe(true);
  });

  it('a roll that misses, or a hero who is not a Rogue, primes nothing; a priming fades', () => {
    expect(roll(true, false).p.shadowUntil).toBeUndefined();
    expect(roll(false).p.shadowUntil).toBeUndefined();
    const { s, p, e } = roll(true);
    s.time = p.shadowUntil! + 0.01;
    Object.assign(e, { hp: 1000 });
    damageEnemy(s, e, blow(p, e));
    const late = 1000 - e.hp;
    damageEnemy(s, e, blow(p, e));
    expect(late).toBeCloseTo(1000 - late - e.hp, 5);
  });

  it("a primed hit from the front gets past a Shieldbearer's shield", () => {
    const { s, p } = roll(true);
    const sh = createEnemy(s, world, 'shieldbearer', 0, 0, 0);
    // Facing the blow: its push runs +z, so the shield faces -z.
    Object.assign(sh, { ai: 'chase', yaw: Math.PI, hp: 1000 });
    damageEnemy(s, sh, blow(p, sh));
    expect(sh.hp).toBeLessThan(1000);
    const before = sh.hp;
    damageEnemy(s, sh, blow(p, sh));
    expect(sh.hp).toBe(before);
  });
});

describe("the Paladin's Consecrate", () => {
  /** Spin to the end of a Whirlwind, standing still. */
  function spin(s: SimState, p: PlayerState): void {
    const t = abilityTiming('whirlwind');
    stepPlayer(p, { ...idleCommand(), ability2: true }, DT, world, s);
    for (let i = 0; i < 240 && p.abilityTime < t.windup + t.active + 0.02; i++) stepPlayer(p, idleCommand(), DT, world, s);
  }

  it('Whirlwind leaves a holy ring where the spin ends; an ally inside takes less of a hit', () => {
    const { s, p, friend, e } = scene(true);
    s.enemies.splice(s.enemies.indexOf(e), 1);
    spin(s, p);
    expect(p.ability).toBe('whirlwind');
    expect(s.consecrated).toHaveLength(1);
    const ring = s.consecrated![0];
    expect(ring).toMatchObject({ by: 'p1', radius: tuning.specs.consecrateRadius });
    expect(ring.until).toBeCloseTo(s.time + tuning.specs.consecrateSeconds, 1);
    // The friend steps in; a hit costs them consecrateDamageTaken of it.
    Object.assign(friend, { x: ring.x + 1, z: ring.z, lagGrace: 0 });
    expect(consecratedMult(s, friend)).toBe(tuning.specs.consecrateDamageTaken);
    expect(hurtHero(s, friend, { damage: 20, fromX: friend.x + 1, fromZ: friend.z })).toBe('hit');
    expect(friend.hp).toBeCloseTo(100 - 20 * tuning.specs.consecrateDamageTaken);
    // Outside it, or once it fades, a hit is whole.
    Object.assign(friend, { x: ring.x + tuning.specs.consecrateRadius + 1 });
    expect(consecratedMult(s, friend)).toBe(1);
    Object.assign(friend, { x: ring.x + 1 });
    s.time = ring.until + 0.01;
    expect(consecratedMult(s, friend)).toBe(1);
    fadeConsecrated(s);
    expect(s.consecrated).toBeUndefined();
  });

  it('a second spin moves the Paladin\'s ring rather than adding one; a hero with no specialization leaves none', () => {
    const { s, p, e } = scene(true);
    s.enemies.splice(s.enemies.indexOf(e), 1);
    spin(s, p);
    for (let i = 0; i < 120 && p.mode === 'ability'; i++) stepPlayer(p, idleCommand(), DT, world, s);
    p.cooldowns.sword[1] = 0;
    Object.assign(p, { x: 3 });
    spin(s, p);
    expect(s.consecrated).toHaveLength(1);
    expect(s.consecrated![0].x).toBeCloseTo(3, 0);
    const b = scene(false);
    spin(b.s, b.p);
    expect(b.s.consecrated).toBeUndefined();
  });
});

describe("the Paladin's Bulwark", () => {
  /** A hero with their guard up facing +z, past the parry window unless `parry`. */
  function guarding(p: PlayerState, parry: boolean): void {
    Object.assign(p, { mode: 'guard', yaw: 0, parryOpen: parry, guardTime: parry ? 0 : 2, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  }
  const heavyFront = (p: PlayerState) => ({ damage: 30, heavy: true, push: 4, fromX: p.x, fromZ: p.z + 1.5 });

  it("a Paladin's guard holds against a heavy: the heavy's chip, and the guard stays up", () => {
    const { s, p } = scene(true);
    guarding(p, false);
    expect(hurtHero(s, p, heavyFront(p))).toBe('blocked');
    expect(p.mode).toBe('guard');
    expect(p.hp).toBeCloseTo(p.maxHp - 30 * tuning.guard.heavyBlockDamageFrac);
  });

  it('anyone else is broken by the same heavy', () => {
    const { s, p } = scene(false);
    guarding(p, false);
    expect(hurtHero(s, p, heavyFront(p))).toBe('hit');
    expect(p.mode).toBe('hurt');
  });

  it("a Paladin's perfect parry heals every standing hero within 4 m, and no one further", () => {
    const { s, p, friend } = scene(true);
    const far = addPlayer(s, world, 'p3', base(0), false);
    Object.assign(friend, { x: p.x + 2, z: p.z, hp: 50 });
    Object.assign(far, { x: p.x + tuning.specs.bulwarkRadius + 2, z: p.z, hp: 50 });
    p.hp = 80;
    guarding(p, true);
    expect(hurtHero(s, p, heavyFront(p))).toBe('parried');
    // Each by a share of their own health: the Paladin's level 10 has more of it.
    expect(friend.hp).toBeCloseTo(50 + friend.maxHp * tuning.specs.bulwarkHeal);
    expect(p.hp).toBeCloseTo(80 + p.maxHp * tuning.specs.bulwarkHeal);
    expect(far.hp).toBe(50);
    expect(s.events.find((ev) => ev.kind === 'holyPulse')).toMatchObject({ playerId: 'p1', healed: 2 });
  });

  it('a parry by anyone else heals no one', () => {
    const { s, p, friend } = scene(false);
    Object.assign(friend, { x: p.x + 2, z: p.z, hp: 50 });
    guarding(p, true);
    expect(hurtHero(s, p, heavyFront(p))).toBe('parried');
    expect(friend.hp).toBe(50);
  });
});

describe("the Spellblade's Blazing Charge (Michael, 6 Nov, A)", () => {
  /** A sword hero, a Spellblade or not, dashes down the arena with nothing in the way. */
  function dash(spellblade: boolean, element?: 'frost') {
    const sc = scene(false);
    if (spellblade) Object.assign(sc.p, { spec: { sword: 'spellblade' }, elements: element ? { sword: element } : undefined });
    Object.assign(sc.e, { x: 15, z: -15 });
    const from = { x: sc.p.x, z: sc.p.z };
    charge(sc.s, sc.p);
    return { ...sc, from };
  }

  it("a Spellblade's dash leaves a strip along its path, in their element", () => {
    const { s, p, from } = dash(true, 'frost');
    expect(s.trails).toHaveLength(1);
    const g = s.trails![0];
    expect(g).toMatchObject({ by: p.id, x0: from.x, z0: from.z, width: tuning.specs.blazingTrailWidth, element: 'frost' });
    expect(Math.hypot(g.x1 - g.x0, g.z1 - g.z0)).toBeGreaterThan(tuning.abilities.chargeDistance * 0.8);
    expect(g.until).toBeCloseTo(s.time + tuning.specs.blazingTrailSeconds, 5);
  });

  it('anyone else\'s Charge leaves nothing', () => {
    expect(dash(false).s.trails).toBeUndefined();
  });

  it('an enemy standing in it takes 15% of the Charge a second, one beside it nothing, then it fades', () => {
    const { s, e, friend } = dash(true);
    const g = s.trails![0];
    Object.assign(friend, { x: 30, z: 30 });
    const inside = createEnemy(s, world, 'grunt', (g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2, 0);
    Object.assign(inside, { ai: 'idle', hp: 9999, maxHp: 9999 });
    const beside = createEnemy(s, world, 'grunt', (g.x0 + g.x1) / 2 + 3, (g.z0 + g.z1) / 2, 0);
    Object.assign(beside, { ai: 'idle', hp: 9999, maxHp: 9999 });
    const charge = tuning.abilities.chargeDamage * tuning.combat.baseDamage;
    // One whole second of the trail, its second tick on the second's last step.
    for (let i = 0; i <= 60; i++) {
      if (s.trails) stepTrails(s);
      s.time += DT;
    }
    expect(9999 - inside.hp).toBeCloseTo(charge * tuning.specs.blazingTrailDamage, 1);
    expect(beside.hp).toBe(9999);
    expect(e.hp).toBe(9999);
    s.time = g.until + 0.01;
    stepTrails(s);
    expect(s.trails).toBeUndefined();
  });

  it("a second Charge's trail replaces the first", () => {
    const { s, p } = dash(true);
    p.abilitySeq++;
    blazingTrail(s, p, 0, 0, 100);
    expect(s.trails).toHaveLength(1);
    expect(s.trails![0]).toMatchObject({ x0: 0, z0: 0, seq: p.abilitySeq });
  });
});

describe("the Sorcerer's Elemental Step (by the Spellblade's A, 6 Nov)", () => {
  function blink(sorcerer: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', yaw: 0, spec: sorcerer ? { staff: 'sorcerer' } : undefined, elements: sorcerer ? { staff: 'air' } : undefined });
    sc.p.xp = { ...sc.p.xp, staff: at10 };
    Object.assign(sc.e, { x: 15, z: -15 });
    Object.assign(sc.friend, { x: 20, z: 20 });
    const from = { x: sc.p.x, z: sc.p.z };
    let ev = false;
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0 }, DT, world, sc.s);
      if (sc.s.events.some((x) => x.kind === 'blink' && x.trail)) ev = true;
      sc.s.time += DT;
    }
    return { ...sc, from, ev };
  }

  it("a Sorcerer's Blink leaves Blazing Charge's strip from where they stood to where they landed, in their element", () => {
    const { s, p, from, ev } = blink(true);
    expect(s.trails).toHaveLength(1);
    expect(s.trails![0]).toMatchObject({ by: p.id, style: 'staff', element: 'air', x0: from.x, z0: from.z, x1: p.x, z1: p.z, width: tuning.specs.blazingTrailWidth });
    expect(Math.hypot(p.x - from.x, p.z - from.z)).toBeGreaterThan(1);
    expect(ev).toBe(true);
  });

  it('it burns an enemy in it as the Charge\'s trail does, credited to the staff', () => {
    const { s } = blink(true);
    const g = s.trails![0];
    const inside = createEnemy(s, world, 'grunt', (g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2, 0);
    Object.assign(inside, { ai: 'idle', hp: 9999, maxHp: 9999 });
    s.time = g.next;
    stepTrails(s);
    expect(9999 - inside.hp).toBeCloseTo(tuning.abilities.chargeDamage * tuning.combat.baseDamage * tuning.specs.blazingTrailDamage * tuning.specs.blazingTrailTickMs / 1000, 3);
  });

  it("anyone else's Blink leaves nothing", () => {
    expect(blink(false).s.trails).toBeUndefined();
  });
});

describe("the Spellblade's spectral blades (Michael, 6 Nov, A)", () => {
  /** A sword hero, a Spellblade or not, spins with one enemy in the blades' band and one well inside the Whirlwind. */
  function spin(spellblade: boolean) {
    const sc = scene(false);
    if (spellblade) Object.assign(sc.p, { spec: { sword: 'spellblade' } });
    Object.assign(sc.friend, { x: 30, z: 30 });
    const reach = tuning.abilities.whirlwindRadius;
    // Behind the hero and to the side, so a blade has to come round to it.
    const band = sc.e;
    Object.assign(band, { x: sc.p.x - (reach + 0.8) * 0.6, z: sc.p.z + (reach + 0.8) * 0.8, ai: 'idle', hp: 9999, maxHp: 9999 });
    const near = createEnemy(sc.s, world, 'grunt', sc.p.x + 1, sc.p.z, 0);
    Object.assign(near, { ai: 'idle', hp: 9999, maxHp: 9999 });
    // Freeze the enemies in place: only the hero steps.
    for (let i = 0; i < 120; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return { ...sc, band, near };
  }
  const whirl = tuning.abilities.whirlwindDamage * tuning.combat.baseDamage;

  it("each blade hits an enemy in its band once a spin, for 30% of the Whirlwind's hit", () => {
    const { band, p } = spin(true);
    expect(9999 - band.hp).toBeCloseTo(tuning.specs.spectralBlades * whirl * tuning.specs.spectralBladeDamage, 3);
    expect(p.mode).not.toBe('ability');
  });

  it('an enemy inside the reach is the Whirlwind\'s alone, and anyone else\'s spin has no blades', () => {
    const a = spin(true);
    const b = spin(false);
    expect(a.near.hp).toBe(b.near.hp);
    expect(b.band.hp).toBe(9999);
  });
});

describe("the Spellblade's Blade Storm", () => {
  it('a Spellblade\'s spin draws light enemies in and leaves heavy ones be', () => {
    const { s, p, e } = scene(false);
    p.spec = { sword: 'spellblade' };
    Object.assign(e, { x: p.x + 4, z: p.z, kbx: 0, kbz: 0 });
    const brute = createEnemy(s, world, 'brute', p.x - 4, p.z, 0);
    Object.assign(brute, { x: p.x - 4, z: p.z, ai: 'chase', kbx: 0, kbz: 0 });
    bladeStorm(s, p);
    expect(e.kbx).toBeCloseTo(-tuning.specs.bladeStormPull);
    expect(brute.kbx).toBe(0);
    // Close enough to be in the spin's edge, it is let go.
    Object.assign(e, { x: p.x + tuning.specs.bladeStormHold - 0.1, kbx: 0 });
    bladeStorm(s, p);
    expect(e.kbx).toBe(0);
  });

  it('pulls nothing for a Paladin, and the Spellblade is offered at sword level 10', () => {
    const { s, p, e } = scene(true);
    Object.assign(e, { x: p.x + 4, z: p.z, kbx: 0, kbz: 0 });
    bladeStorm(s, p);
    expect(e.kbx).toBe(0);
    expect(specProblem({ sword: at10, bow: 0, staff: 0 }, { sword: 'spellblade' })).toBeNull();
  });
});

describe("the Ranger's Thornshot", () => {
  /** A bow hero (a Ranger or not) looses one arrow, charged or not, down the arena at the target. */
  function shoot(ranger: boolean, charged: boolean, kind: 'grunt' | 'brute' = 'grunt') {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'idle', yaw: Math.PI, spec: ranger ? { bow: 'ranger' } : undefined });
    let e = sc.e;
    if (kind !== 'grunt') {
      e.ai = 'dead';
      e = createEnemy(sc.s, world, kind, 0, 6, 0);
      Object.assign(e, { x: 0, z: 6, ai: 'chase', aiTime: 0, cooldown: 0, hp: 9999 });
    }
    const payload = { damage: 1, poise: 0, knockback: 0, heavy: false };
    spawnArrow(sc.s, sc.p, payload, 0, tuning.rangedCombo.powerArrowSpeed, charged);
    for (let i = 0; i < 40; i++) stepProjectiles(sc.s, DT, world.colliders);
    expect(e.hp).toBeLessThan(9999);
    return { ...sc, e };
  }

  it("a Ranger's charged shot roots a light enemy: it stops walking, then walks again", () => {
    const { s, p, e } = shoot(true, true);
    expect(isRooted(s, e)).toBe(true);
    expect(s.events.some((ev) => ev.kind === 'rooted' && ev.enemyId === e.id)).toBe(true);
    // Hold it far from the hero, so it wants to walk in.
    Object.assign(e, { z: p.z - 8, vx: 0, vz: 0, kbx: 0, kbz: 0, cooldown: 99 });
    const z0 = e.z;
    for (let i = 0; i < 30; i++) {
      stepEnemies(s, DT, world);
      s.time += DT;
    }
    expect(Math.abs(e.z - z0)).toBeLessThan(0.01);
    for (let i = 0; i < Math.ceil(tuning.specs.thornRootS * 60) + 30; i++) {
      stepEnemies(s, DT, world);
      s.time += DT;
    }
    expect(isRooted(s, e)).toBe(false);
    expect(e.rootUntil).toBeUndefined();
    expect(e.z - z0).toBeGreaterThan(0.2);
  });

  it('a heavier enemy is slowed, not rooted', () => {
    const { s, e } = shoot(true, true, 'brute');
    expect(isRooted(s, e)).toBe(false);
    expect(e.slowTime).toBeCloseTo(tuning.specs.thornSlowS);
  });

  it('a quick shot, or anyone but a Ranger, roots nothing', () => {
    for (const [ranger, charged] of [[true, false], [false, true]] as const) {
      const { s, e } = shoot(ranger, charged);
      expect(isRooted(s, e)).toBe(false);
      expect(s.events.some((ev) => ev.kind === 'rooted')).toBe(false);
    }
  });
});

describe("the Ranger's Bramble Rain", () => {
  function ranger(is: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: is ? { bow: 'ranger' } : undefined });
    return sc;
  }

  it('a Volley seeds a patch ahead in the Ranger\'s element; a second replaces the first', () => {
    const { s, p } = ranger(true);
    p.elements = { bow: 'earth' };
    brambleRain(s, p, world.colliders);
    expect(s.brambles).toHaveLength(1);
    const g = s.brambles![0];
    expect(g).toMatchObject({ by: 'p1', element: 'earth', radius: tuning.specs.brambleRadius });
    expect(Math.hypot(g.x - p.x, g.z - p.z)).toBeCloseTo(tuning.specs.brambleRange, 1);
    expect(g.z).toBeLessThan(p.z);
    brambleRain(s, p, world.colliders);
    expect(s.brambles).toHaveLength(1);
  });

  it('roots a light enemy inside while it stands there, slows a heavy one, and fades', () => {
    const { s, p, e } = ranger(true);
    brambleRain(s, p, world.colliders);
    const g = s.brambles![0];
    Object.assign(e, { x: g.x, z: g.z });
    const brute = createEnemy(s, world, 'brute', g.x + 1, g.z, 0);
    Object.assign(brute, { x: g.x + 1, z: g.z, ai: 'chase', slowTime: 0 });
    stepBrambles(s);
    expect(isRooted(s, e)).toBe(true);
    expect(isRooted(s, brute)).toBe(false);
    expect(brute.slowTime).toBeGreaterThan(0);
    // Out of the patch, it lets go within a tick or so.
    Object.assign(e, { x: g.x + 10 });
    s.time += 0.2;
    stepBrambles(s);
    expect(isRooted(s, e)).toBe(false);
    s.time = g.until;
    stepBrambles(s);
    expect(s.brambles).toBeUndefined();
  });

  it('a Volley by anyone but a Ranger seeds nothing', () => {
    const { s, p } = ranger(false);
    brambleRain(s, p, world.colliders);
    expect(s.brambles).toBeUndefined();
  });

  it("the Volley ability itself seeds it for a Ranger", () => {
    const { s, p } = ranger(true);
    for (let i = 0; i < 60 && !s.brambles; i++) {
      stepPlayer(p, { ...idleCommand(), ability1: i === 0, aimX: 0, aimZ: -1 }, DT, world, s);
      s.time += DT;
    }
    expect(s.brambles).toHaveLength(1);
  });
});

describe("the Ranger's Snare Trap", () => {
  function ranger(is: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: is ? { bow: 'ranger' } : undefined });
    Object.assign(sc.e, { x: 6, z: 0 });
    return sc;
  }

  it('the Disengage leaves a trap where the Ranger stood, and leaps away from it', () => {
    const { s, p } = ranger(true);
    // The second ability opens at bow level 2.
    p.xp = { ...p.xp, bow: at10 };
    const at = { x: p.x, z: p.z };
    for (let i = 0; i < 60; i++) {
      stepPlayer(p, { ...idleCommand(), ability2: i === 0, aimX: 0, aimZ: -1 }, DT, world, s);
      s.time += DT;
    }
    expect(s.snares).toHaveLength(1);
    expect(s.snares![0]).toMatchObject({ by: 'p1', x: at.x, z: at.z, radius: tuning.specs.snareRadius });
    expect(Math.hypot(p.x - at.x, p.z - at.z)).toBeGreaterThan(1);
  });

  it('the first enemy in it springs it: rooted, and the trap is spent; a heavier one is slowed', () => {
    const { s, p, e } = ranger(true);
    snareTrap(s, p);
    stepSnares(s);
    expect(s.snares).toHaveLength(1);
    Object.assign(e, { x: p.x + 0.5, z: p.z });
    stepSnares(s);
    expect(isRooted(s, e)).toBe(true);
    expect(e.rootUntil! - s.time).toBeCloseTo(tuning.specs.snareRootS);
    expect(s.snares).toBeUndefined();
    expect(s.events.some((ev) => ev.kind === 'rooted' && ev.enemyId === e.id)).toBe(true);
    snareTrap(s, p);
    const brute = createEnemy(s, world, 'brute', p.x, p.z, 0);
    Object.assign(brute, { x: p.x, z: p.z, ai: 'chase', slowTime: 0 });
    e.ai = 'dead';
    stepSnares(s);
    expect(isRooted(s, brute)).toBe(false);
    expect(brute.slowTime).toBeCloseTo(tuning.specs.snareRootS);
  });

  it('a trap unsprung fades; anyone but a Ranger sets none', () => {
    const { s, p } = ranger(true);
    snareTrap(s, p);
    s.time += tuning.specs.snareSeconds;
    stepSnares(s);
    expect(s.snares).toBeUndefined();
    const other = ranger(false);
    snareTrap(other.s, other.p);
    expect(other.s.snares).toBeUndefined();
  });
});

describe('the Ranger is offered (the builds pass)', () => {
  it('from bow level 10, Nature or Earth, and the server takes it', () => {
    expect(specProblem({ sword: 0, bow: at10, staff: 0 }, { bow: 'ranger' })).toBeNull();
    expect(specProblem({ sword: 0, bow: at10 - 1, staff: 0 }, { bow: 'ranger' })).not.toBeNull();
    expect(specInfo('ranger').elements).toEqual(['nature', 'earth']);
    const l = { ...base(0), xp: { sword: 0, bow: at10, staff: 0 } };
    expect(readLoadout({ ...l, spec: { bow: 'ranger' }, elements: { bow: 'earth' } })?.elements).toEqual({ bow: 'earth' });
    expect(readLoadout({ ...l, spec: { bow: 'ranger' }, elements: { bow: 'fire' } })).toBeNull();
  });
});

describe("the Scout's Marked", () => {
  function scout(is: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: is ? { bow: 'scout' } : undefined, flow: newFlow() });
    return sc;
  }
  const arrow = (s: SimState, p: PlayerState) => {
    spawnArrow(s, p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, false);
    for (let i = 0; i < 40; i++) stepProjectiles(s, DT, world.colliders);
  };

  it("a Scout's arrow marks what it hits, after its own damage", () => {
    const { s, p, e } = scout(true);
    arrow(s, p);
    const plain = scout(false);
    arrow(plain.s, plain.p);
    expect(e.hp).toBeCloseTo(plain.e.hp);
    expect(e.scoutMark).toEqual({ by: 'p1', until: s.time + tuning.specs.markSeconds });
    expect(s.events.some((ev) => ev.kind === 'scoutMarked' && ev.enemyId === e.id)).toBe(true);
  });

  it("a friend's hit on the mark lands harder and fills the Scout's Flow", () => {
    const { s, p, friend, e } = scout(true);
    arrow(s, p);
    const hp = e.hp;
    const flow = p.flow!.v;
    damageEnemy(s, e, { attackerId: friend.id, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z });
    expect(hp - e.hp).toBeCloseTo(10 * (1 + tuning.specs.markDamageBonus));
    expect(p.flow!.v).toBeCloseTo(flow + tuning.specs.markFlowGain);
  });

  it('a mark fades; anyone but a Scout marks nothing', () => {
    const { s, p, e } = scout(true);
    arrow(s, p);
    s.time += tuning.specs.markSeconds;
    expect(markedMult(s, e, p, false)).toBe(1);
    expect(e.scoutMark).toBeUndefined();
    const other = scout(false);
    arrow(other.s, other.p);
    expect(other.e.scoutMark).toBeUndefined();
  });
});

describe("the Scout's Storm Volley", () => {
  /** A Scout (or not) looses one Volley arrow at the grunt, with a second grunt `gap` metres past it. */
  function volleyAt(scout: boolean, gap: number) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: scout ? { bow: 'scout' } : undefined });
    const next = createEnemy(sc.s, world, 'grunt', gap, 6, 0);
    Object.assign(next, { x: gap, z: 6, ai: 'chase', hp: 9999 });
    spawnArrow(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, false);
    sc.s.projectiles[sc.s.projectiles.length - 1].marks = true;
    for (let i = 0; i < 40; i++) stepProjectiles(sc.s, DT, world.colliders);
    return { ...sc, next };
  }

  it("a Scout's Volley arrow arcs on to the nearest other enemy for half its hit", () => {
    const { s, e, next } = volleyAt(true, 3);
    const first = 9999 - e.hp;
    expect(first).toBeGreaterThan(0);
    expect(9999 - next.hp).toBeCloseTo(first * tuning.specs.stormChainDamage, 3);
    expect(s.events.some((ev) => ev.kind === 'stormChain')).toBe(true);
  });

  it('nothing in range, or anyone but a Scout, arcs nowhere', () => {
    expect(volleyAt(true, tuning.specs.stormChainRange + 2).next.hp).toBe(9999);
    expect(volleyAt(false, 3).next.hp).toBe(9999);
  });
});

describe("the Scout's Gale Step", () => {
  /** Disengage, then press it again `after` ticks later; returns the hero and what happened. */
  function twice(scout: boolean, after: number) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: scout ? { bow: 'scout' } : undefined });
    sc.p.xp = { ...sc.p.xp, bow: at10 };
    Object.assign(sc.e, { x: 8, z: 0 });
    const charges = sc.p.dodgeCharges;
    let rolled = false;
    for (let i = 0; i <= after + 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0 || i === after }, DT, world, sc.s);
      sc.s.time += DT;
      if (sc.p.mode === 'dodge') rolled = true;
    }
    return { ...sc, rolled, charges };
  }
  const afterFlip = () => {
    const t = abilityTiming('disengage');
    return Math.ceil(((t.windup + t.active) * 1000) / (1000 / 60)) + 2;
  };

  it("a Scout's second press after the backflip is a full roll that spends no charge", () => {
    const { s, p, rolled, charges } = twice(true, afterFlip());
    expect(rolled).toBe(true);
    expect(p.dodgeCharges).toBe(charges);
    expect(s.events.some((ev) => ev.kind === 'galeStep')).toBe(true);
    expect(p.galeUntil).toBeUndefined();
  });

  it('too late, or anyone but a Scout, and the press does nothing', () => {
    const late = afterFlip() + Math.ceil(tuning.specs.galeWindowS * 60) + 20;
    expect(twice(true, late).rolled).toBe(false);
    expect(twice(false, afterFlip()).rolled).toBe(false);
  });
});

describe('the Scout is offered (the builds pass)', () => {
  it('from bow level 10, Air alone, beside the Ranger', () => {
    expect(specsFor('bow').filter((x) => x.built).map((x) => x.id)).toContain('scout');
    expect(specProblem({ sword: 0, bow: at10, staff: 0 }, { bow: 'scout' })).toBeNull();
    const l = { ...base(0), xp: { sword: 0, bow: at10, staff: 0 } };
    expect(readLoadout({ ...l, spec: { bow: 'scout' }, elements: { bow: 'nature' } })).toBeNull();
    expect(readLoadout({ ...l, spec: { bow: 'scout' } })?.spec).toEqual({ bow: 'scout' });
  });
});

describe("the Assassin's Deadeye", () => {
  /** A bow hero looses one arrow down the arena at the grunt, which faces `yaw`. */
  function shot(assassin: boolean, charged: boolean, yaw: number) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: assassin ? { bow: 'assassin' } : undefined });
    sc.e.yaw = yaw;
    spawnArrow(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.powerArrowSpeed, charged);
    for (let i = 0; i < 40; i++) stepProjectiles(sc.s, DT, world.colliders);
    return { ...sc, dealt: 9999 - sc.e.hp };
  }

  it("an Assassin's charged shot in an enemy's back deals double and shows as a crit", () => {
    const face = shot(true, true, 0);
    const back = shot(true, true, Math.PI);
    expect(face.dealt).toBeGreaterThan(0);
    expect(back.dealt).toBeCloseTo(face.dealt * tuning.specs.deadeyeCritMult);
    expect(back.s.events.some((ev) => ev.kind === 'hit' && ev.crit)).toBe(true);
  });

  it('a quick shot in the back, or anyone but an Assassin, is a plain hit', () => {
    const face = shot(true, true, 0).dealt;
    expect(shot(true, false, Math.PI).dealt).toBeCloseTo(shot(true, false, 0).dealt);
    expect(shot(false, true, Math.PI).dealt).toBeCloseTo(face);
  });
});

describe("the Assassin's Smoke Bomb", () => {
  function flip(assassin: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: assassin ? { bow: 'assassin' } : undefined });
    sc.p.xp = { ...sc.p.xp, bow: at10 };
    // The friend stands far off, so the enemy would choose the Assassin if it could.
    Object.assign(sc.friend, { x: 20, z: 20 });
    Object.assign(sc.e, { x: 0, z: 4, ai: 'chase', aiTime: 0, cooldown: 99 });
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return sc;
  }

  it('the Disengage leaves smoke: enemies lose the Assassin and turn to whoever else stands', () => {
    const { s, p, friend, e } = flip(true);
    expect(p.hiddenUntil).toBeGreaterThan(s.time);
    expect(s.events.some((ev) => ev.kind === 'smokeBomb')).toBe(true);
    const z0 = e.z;
    for (let i = 0; i < 20; i++) {
      stepEnemies(s, DT, world);
      s.time += DT;
    }
    // It walks off toward the friend (up the arena), not toward the Assassin (down it).
    expect(Math.hypot(e.x - friend.x, e.z - friend.z)).toBeLessThan(Math.hypot(0 - friend.x, z0 - friend.z));
  });

  it('it fades; anyone but an Assassin is never hidden', () => {
    const { s, p } = flip(true);
    s.time = p.hiddenUntil!;
    stepEnemies(s, DT, world);
    expect(p.hiddenUntil).toBeUndefined();
    expect(flip(false).p.hiddenUntil).toBeUndefined();
  });
});

describe("the Assassin's Venom Volley", () => {
  /** A bow hero (an Assassin or not) looses `arrows` Volley arrows at the grunt, one after another. */
  function volley(assassin: boolean, arrows: number) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: assassin ? { bow: 'assassin' } : undefined });
    for (let a = 0; a < arrows; a++) {
      spawnArrow(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, false);
      sc.s.projectiles[sc.s.projectiles.length - 1].marks = true;
      for (let i = 0; i < 40; i++) stepProjectiles(sc.s, DT, world.colliders);
    }
    return sc;
  }
  /** Steps the enemies `seconds` on, returning the damage the poison dealt in that time. */
  function wait(sc: ReturnType<typeof volley>, seconds: number): number {
    const hp = sc.e.hp;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      stepEnemies(sc.s, DT, world);
      sc.s.time += DT;
    }
    return hp - sc.e.hp;
  }

  it("each Assassin Volley arrow that lands stacks the poison, up to its cap", () => {
    const one = volley(true, 1);
    expect(one.e.venom?.stacks).toBe(1);
    expect(one.s.events.some((ev) => ev.kind === 'venom')).toBe(true);
    expect(volley(true, 3).e.venom?.stacks).toBe(3);
    expect(volley(true, tuning.specs.venomMaxStacks + 3).e.venom?.stacks).toBe(tuning.specs.venomMaxStacks);
  });

  it('it ticks for its damage a stack every beat, then runs out', () => {
    const sc = volley(true, 3);
    Object.assign(sc.e, { ai: 'idle', cooldown: 99 });
    const s = tuning.specs;
    const ticks = Math.floor(s.venomSeconds / (s.venomTickMs / 1000));
    expect(wait(sc, s.venomSeconds + 1)).toBeCloseTo(ticks * 3 * s.venomDamage, 3);
    expect(sc.e.venom).toBeUndefined();
    expect(wait(sc, 1)).toBe(0);
  });

  it('a fresh stack keeps it going longer; anyone but an Assassin, or a plain shot, poisons nothing', () => {
    const sc = volley(true, 1);
    const until = sc.e.venom!.until;
    sc.s.time += 1;
    spawnArrow(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, false);
    sc.s.projectiles[sc.s.projectiles.length - 1].marks = true;
    for (let i = 0; i < 40; i++) stepProjectiles(sc.s, DT, world.colliders);
    expect(sc.e.venom!.until).toBeGreaterThan(until);
    expect(volley(false, 3).e.venom).toBeUndefined();
    const plain = scene(false);
    Object.assign(plain.p, { style: 'bow', mode: 'move', yaw: Math.PI, spec: { bow: 'assassin' } });
    spawnArrow(plain.s, plain.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0, tuning.rangedCombo.arrowSpeed, false);
    for (let i = 0; i < 40; i++) stepProjectiles(plain.s, DT, world.colliders);
    expect(plain.e.venom).toBeUndefined();
  });

  it('the poison kills, and its XP goes to the bow', () => {
    const sc = volley(true, 5);
    Object.assign(sc.e, { ai: 'idle', cooldown: 99, hp: 1 });
    const bow = sc.p.xp.bow;
    wait(sc, 1);
    expect(sc.e.ai).toBe('dead');
    expect(sc.e.venom).toBeUndefined();
    expect(sc.p.xp.bow).toBeGreaterThan(bow);
  });
});

describe('the Assassin is offered (the builds pass)', () => {
  it('from bow level 10, Shadow or Nature; Ranged is whole', () => {
    expect(specsFor('bow').filter((x) => x.built).map((x) => x.id)).toEqual(['ranger', 'scout', 'assassin']);
    expect(specProblem({ sword: 0, bow: at10, staff: 0 }, { bow: 'assassin' })).toBeNull();
    const l = { ...base(0), xp: { sword: 0, bow: at10, staff: 0 } };
    expect(readLoadout({ ...l, spec: { bow: 'assassin' }, elements: { bow: 'nature' } })?.elements).toEqual({ bow: 'nature' });
    expect(readLoadout({ ...l, spec: { bow: 'assassin' }, elements: { bow: 'air' } })).toBeNull();
  });
});

describe("the Warlock's Hex", () => {
  /** One staff hit (a burst's, the server's) from p on the grunt, as a Warlock or not. */
  function staffHit(sc: ReturnType<typeof scene>, by: PlayerState, damage = 10): number {
    const hp = sc.e.hp;
    damageEnemy(sc.s, sc.e, { attackerId: by.id, damage, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: sc.e.x, y: 1, z: sc.e.z, style: 'staff', projectile: true });
    return hp - sc.e.hp;
  }
  function warlock(on: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', spec: on ? { staff: 'warlock' } : undefined });
    return sc;
  }

  it("a Warlock's staff hit hexes, after its own damage; the hex fades", () => {
    const sc = warlock(true);
    const first = staffHit(sc, sc.p);
    expect(sc.e.hex?.by).toBe('p1');
    expect(sc.s.events.some((ev) => ev.kind === 'hexed')).toBe(true);
    // The next hit, the same in every other way, lands 10% harder.
    expect(staffHit(sc, sc.p)).toBeCloseTo(first * (1 + tuning.specs.hexDamageBonus), 3);
    sc.s.time = sc.e.hex!.until;
    expect(staffHit(sc, sc.friend)).toBeCloseTo(staffHit(warlock(false), warlock(false).friend), 3);
  });

  it("everyone's hits on the hex land harder; only the Warlock's drain", () => {
    const sc = warlock(true);
    staffHit(sc, sc.p);
    const plain = warlock(false);
    expect(staffHit(sc, sc.friend)).toBeCloseTo(staffHit(plain, plain.friend) * (1 + tuning.specs.hexDamageBonus), 3);
    sc.friend.hp = 10;
    staffHit(sc, sc.friend);
    expect(sc.friend.hp).toBe(10);
    sc.p.hp = 10;
    const dealt = staffHit(sc, sc.p);
    expect(sc.p.hp).toBeCloseTo(10 + dealt * tuning.specs.hexDrain, 3);
    sc.p.hp = sc.p.maxHp;
    staffHit(sc, sc.p, 5000);
    expect(sc.p.hp).toBe(sc.p.maxHp);
  });

  it('anyone but a Warlock, or a Warlock\'s sword, hexes nothing', () => {
    const sc = warlock(false);
    staffHit(sc, sc.p);
    expect(sc.e.hex).toBeUndefined();
    const w = warlock(true);
    damageEnemy(w.s, w.e, { attackerId: 'p1', damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: 0, y: 1, z: 6, style: 'sword' });
    expect(w.e.hex).toBeUndefined();
  });
});

describe("the Warlock's Curse Ring", () => {
  /** A staff hero, a Warlock or not, casts the frost ring with the grunt 4 m off. */
  function ring(warlock: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', spec: warlock ? { staff: 'warlock' } : undefined });
    Object.assign(sc.friend, { x: 20, z: 20 });
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability1: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return sc;
  }

  it("a Warlock's ring hexes everything it reaches for longer, in shadow, and freezes nothing", () => {
    const { s, e } = ring(true);
    const ev = s.events.find((x) => x.kind === 'frostRing');
    expect(ev && ev.kind === 'frostRing' && ev.curse).toBe(true);
    expect(e.hp).toBeLessThan(9999);
    expect(e.frozen).toBe(0);
    expect(e.hex!.until - s.time).toBeGreaterThan(tuning.specs.hexSeconds);
    expect(e.hex!.until - s.time).toBeLessThanOrEqual(tuning.specs.curseRingHexS);
  });

  it("an orb after it never cuts the ring's hex short", () => {
    const sc = ring(true);
    const until = sc.e.hex!.until;
    damageEnemy(sc.s, sc.e, { attackerId: 'p1', damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: 0, y: 1, z: 6, style: 'staff', projectile: true });
    expect(sc.e.hex!.until).toBe(until);
  });

  it("anyone else's ring freezes as ever and hexes nothing", () => {
    const { s, e } = ring(false);
    const ev = s.events.find((x) => x.kind === 'frostRing');
    expect(ev && ev.kind === 'frostRing' && ev.curse).toBeFalsy();
    expect(e.frozen).toBeGreaterThan(0);
    expect(e.hex).toBeUndefined();
  });
});

describe("the Warlock's Shadow Swap", () => {
  /** A staff hero, a Warlock or not, Blinks with the grunt `gap` metres ahead targeted. */
  function blink(warlock: boolean, gap: number, kind: 'grunt' | 'warden' = 'grunt') {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', spec: warlock ? { staff: 'warlock' } : undefined });
    sc.p.xp = { ...sc.p.xp, staff: at10 };
    const e = kind === 'grunt' ? sc.e : createEnemy(sc.s, world, kind, 0, 10 - gap, 0);
    Object.assign(e, { x: 0, z: 10 - gap, ai: 'chase', hp: 9999 });
    if (kind !== 'grunt') Object.assign(sc.e, { x: 15, z: 15 });
    Object.assign(sc.friend, { x: 20, z: 20 });
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0, lockTarget: e.id, aimX: 0, aimZ: -1 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return { ...sc, e };
  }

  it('a Warlock with an enemy targeted trades places with it, and the next bolt crits', () => {
    const { s, p, e } = blink(true, 4);
    expect(p.z).toBeCloseTo(6, 3);
    expect(e.z).toBeCloseTo(10, 3);
    expect(p.nextBoltCrit).toBe(true);
    expect(s.events.some((ev) => ev.kind === 'blink' && ev.swap)).toBe(true);
  });

  it('too far, a boss, or anyone but a Warlock, and the Blink goes as ever', () => {
    const far = tuning.abilities.blinkDistance + tuning.specs.swapReach + 2;
    const out = blink(true, far);
    expect(out.e.z).toBeCloseTo(10 - far, 3);
    expect(out.s.events.some((ev) => ev.kind === 'blink' && !ev.swap)).toBe(true);
    const boss = blink(true, 4, 'warden');
    expect(boss.e.z).toBeCloseTo(6, 3);
    const plain = blink(false, 4);
    expect(plain.e.z).toBeCloseTo(6, 3);
    expect(plain.s.events.some((ev) => ev.kind === 'blink' && ev.swap)).toBe(false);
  });
});

describe('the Warlock is offered (the builds pass)', () => {
  it('from staff level 10, Shadow alone', () => {
    expect(specsFor('staff').filter((x) => x.built).map((x) => x.id)).toContain('warlock');
    expect(specProblem({ sword: 0, bow: 0, staff: at10 }, { staff: 'warlock' })).toBeNull();
    expect(specProblem({ sword: 0, bow: 0, staff: at10 - 1 }, { staff: 'warlock' })).not.toBeNull();
    const l = { ...base(0), xp: { sword: 0, bow: 0, staff: at10 } };
    expect(readLoadout({ ...l, spec: { staff: 'warlock' } })?.spec).toEqual({ staff: 'warlock' });
    expect(readLoadout({ ...l, spec: { staff: 'warlock' }, elements: { staff: 'fire' } })).toBeNull();
  });
});

describe("the Druid's Bloom", () => {
  /** A staff hero, a Druid or not, casts one bolt down the arena through a hurt friend at the grunt. */
  function bolt(druid: boolean, flowV = 0) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', yaw: Math.PI, spec: druid ? { staff: 'druid' } : undefined, flow: { ...newFlow(), v: flowV } });
    Object.assign(sc.friend, { x: 0, z: 8, hp: 50 });
    spawnBolt(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0);
    for (let i = 0; i < 60; i++) {
      stepProjectiles(sc.s, DT, world.colliders);
      sc.s.time += DT;
    }
    return sc;
  }

  it("a Druid's bolt heals the friend it passes through, once, and flies on to hurt the enemy", () => {
    const { s, friend, e } = bolt(true);
    expect(friend.hp).toBeCloseTo(50 + friend.maxHp * tuning.specs.bloomHeal, 3);
    expect(s.events.filter((ev) => ev.kind === 'bloom').length).toBe(1);
    expect(e.hp).toBeLessThan(9999);
  });

  it("anyone else's bolt heals nobody; a full friend takes nothing", () => {
    expect(bolt(false).friend.hp).toBe(50);
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', yaw: Math.PI, spec: { staff: 'druid' } });
    Object.assign(sc.friend, { x: 0, z: 8 });
    spawnBolt(sc.s, sc.p, { damage: 10, poise: 0, knockback: 0, heavy: false }, 0);
    for (let i = 0; i < 60; i++) stepProjectiles(sc.s, DT, world.colliders);
    expect(sc.friend.hp).toBe(sc.friend.maxHp);
    expect(sc.s.events.some((ev) => ev.kind === 'bloom')).toBe(false);
  });

  it('at Flow II and up its bolt roots a light enemy; below, it does not', () => {
    const third = tuning.flow.max / 3;
    const high = bolt(true, third * tuning.specs.bloomRootTier + 1);
    expect(isRooted(high.s, high.e)).toBe(true);
    const low = bolt(true, third * tuning.specs.bloomRootTier - 1);
    expect(isRooted(low.s, low.e)).toBe(false);
  });
});

describe("the Druid's Thorn Ring", () => {
  function ring(druid: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', spec: druid ? { staff: 'druid' } : undefined });
    Object.assign(sc.friend, { x: 20, z: 20 });
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability1: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return sc;
  }

  it("a Druid's ring roots the light enemies it reaches, in thorns, and freezes nothing", () => {
    const { s, e } = ring(true);
    const ev = s.events.find((x) => x.kind === 'frostRing');
    expect(ev && ev.kind === 'frostRing' && ev.thorns).toBe(true);
    expect(e.hp).toBeLessThan(9999);
    expect(e.frozen).toBe(0);
    expect(isRooted(s, e)).toBe(true);
  });

  it("anyone else's ring freezes as ever and roots nothing", () => {
    const { s, e } = ring(false);
    expect(e.frozen).toBeGreaterThan(0);
    expect(isRooted(s, e)).toBe(false);
  });
});

describe("the Druid's Wild Growth", () => {
  /** A staff hero, a Druid or not, Blinks forward from the arena's middle. */
  function blink(druid: boolean) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', yaw: 0, spec: druid ? { staff: 'druid' } : undefined });
    sc.p.xp = { ...sc.p.xp, staff: at10 };
    Object.assign(sc.e, { x: 15, z: -15 });
    Object.assign(sc.friend, { x: 20, z: 20 });
    const from = { x: sc.p.x, z: sc.p.z };
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability2: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    return { ...sc, from };
  }

  it("a Druid's Blink leaves a grove where they stood, and the Blink still goes", () => {
    const { s, p, from } = blink(true);
    expect(s.groves).toHaveLength(1);
    expect(s.groves![0]).toMatchObject({ by: p.id, x: from.x, z: from.z, radius: tuning.specs.groveRadius });
    expect(Math.hypot(p.x - from.x, p.z - from.z)).toBeGreaterThan(1);
    expect(s.events.some((ev) => ev.kind === 'blink' && ev.grove)).toBe(true);
  });

  it('the grove heals a hurt ally standing in it over its seconds, never past full, then fades', () => {
    const { s, friend, from } = blink(true);
    Object.assign(friend, { x: from.x + 1, z: from.z, hp: 20 });
    // The Blink went off within the setup's ticks, so only what is left of the grove heals.
    const left = s.groves![0].until - s.time;
    for (let i = 0; i < Math.round(left * 60) + 5; i++) {
      if (s.groves) stepGroves(s, DT);
      s.time += DT;
    }
    expect(friend.hp).toBeCloseTo(20 + friend.maxHp * tuning.specs.groveHealPerS * left, 0);
    expect(s.groves).toBeUndefined();
    friend.hp = friend.maxHp - 1;
    wildGrowth(s, s.players.find((o) => o.spec?.staff === 'druid')!, friend.x, friend.z);
    for (let i = 0; i < 120; i++) stepGroves(s, DT);
    expect(friend.hp).toBe(friend.maxHp);
  });

  it('outside it, or a downed ally, heals nothing; anyone else blinks and grows nothing', () => {
    const { s, friend, from } = blink(true);
    Object.assign(friend, { x: from.x + tuning.specs.groveRadius + 1, z: from.z, hp: 20 });
    for (let i = 0; i < 60; i++) stepGroves(s, DT);
    expect(friend.hp).toBe(20);
    Object.assign(friend, { x: from.x, mode: 'down' });
    for (let i = 0; i < 60; i++) stepGroves(s, DT);
    expect(friend.hp).toBe(20);
    const plain = blink(false);
    expect(plain.s.groves).toBeUndefined();
    expect(plain.s.events.some((ev) => ev.kind === 'blink' && ev.grove)).toBe(false);
  });
});

describe('the Druid is offered (the builds pass)', () => {
  it('from staff level 10, Nature or Earth', () => {
    expect(specsFor('staff').filter((x) => x.built).map((x) => x.id)).toEqual(['warlock', 'druid', 'sorcerer']);
    expect(specProblem({ sword: 0, bow: 0, staff: at10 }, { staff: 'druid' })).toBeNull();
    expect(specProblem({ sword: 0, bow: 0, staff: at10 - 1 }, { staff: 'druid' })).not.toBeNull();
    const l = { ...base(0), xp: { sword: 0, bow: 0, staff: at10 } };
    expect(readLoadout({ ...l, spec: { staff: 'druid' } })?.spec).toEqual({ staff: 'druid' });
    expect(readLoadout({ ...l, spec: { staff: 'druid' }, elements: { staff: 'earth' } })?.elements).toEqual({ staff: 'earth' });
    expect(readLoadout({ ...l, spec: { staff: 'druid' }, elements: { staff: 'shadow' } })).toBeNull();
  });
});

describe("the Sorcerer's Attunement", () => {
  /** A staff hero, a Sorcerer of `el` or nobody's, casts `n` bolts down the arena at the grunt, a second grunt 1.5 m beyond it. */
  function bolts(el: 'fire' | 'frost' | 'earth' | 'air' | undefined, n = 1) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', yaw: Math.PI, spec: el ? { staff: 'sorcerer' } : undefined, elements: el ? { staff: el } : undefined });
    Object.assign(sc.friend, { x: 20, z: 20 });
    const other = createEnemy(sc.s, world, 'grunt', 0, 4.5, 0);
    Object.assign(other, { x: 1.5, z: 6, ai: 'chase', aiTime: 0, cooldown: 0, hp: 9999 });
    for (let k = 0; k < n; k++) {
      spawnBolt(sc.s, sc.p, { damage: 10, poise: 0.5, knockback: 0, heavy: false }, 0);
      for (let i = 0; i < 40; i++) {
        stepProjectiles(sc.s, DT, world.colliders);
        sc.s.time += DT;
      }
      Object.assign(sc.e, { x: 0, z: 6, kbx: 0, kbz: 0 });
    }
    return { ...sc, other };
  }

  it('four elements, offered from staff level 10', () => {
    expect(specInfo('sorcerer').elements).toEqual(['fire', 'frost', 'earth', 'air']);
    expect(specInfo('sorcerer').built).toBe(true);
    expect(specProblem({ sword: 0, bow: 0, staff: at10 }, { staff: 'sorcerer' })).toBeNull();
    expect(specProblem({ sword: 0, bow: 0, staff: at10 - 1 }, { staff: 'sorcerer' })).not.toBeNull();
  });

  it("anyone else's bolt is the staff's own: no burst, no arc, no event", () => {
    const { s, e, other } = bolts(undefined);
    expect(e.hp).toBeLessThan(9999);
    expect(other.hp).toBe(9999);
    expect(s.events.some((ev) => ev.kind === 'attune')).toBe(false);
  });

  it('Fire bursts: the enemy beside the one it hits takes a share of the bolt', () => {
    const { s, e, other } = bolts('fire');
    expect(e.hp).toBeLessThan(9999);
    expect(9999 - other.hp).toBeGreaterThan(0);
    expect(9999 - other.hp).toBeLessThan(9999 - e.hp);
    const ev = s.events.find((x) => x.kind === 'attune');
    expect(ev && ev.kind === 'attune' && ev.element === 'fire' && ev.radius).toBe(tuning.specs.attuneFireRadius);
  });

  it('Frost chills, and the third bolt on a still-Chilled enemy freezes it', () => {
    const one = bolts('frost', 1);
    expect(one.e.slowTime).toBeGreaterThan(0);
    expect(one.e.frozen).toBe(0);
    expect(one.e.attuneChill?.hits).toBe(1);
    const three = bolts('frost', tuning.specs.attuneFreezeHits);
    expect(three.e.frozen).toBeGreaterThan(0);
    expect(three.e.attuneChill).toBeUndefined();
    expect(three.s.events.some((ev) => ev.kind === 'freeze' && ev.enemyId === three.e.id)).toBe(true);
  });

  it("Earth's bolt drains more poise than a plain one", () => {
    const plain = bolts(undefined);
    const earth = bolts('earth');
    expect(earth.e.poise).toBeLessThan(plain.e.poise);
  });

  it('Air pushes the enemy and arcs on to its neighbour', () => {
    const { s, other } = bolts('air');
    expect(other.hp).toBeLessThan(9999);
    const ev = s.events.find((x) => x.kind === 'attune');
    expect(ev && ev.kind === 'attune' && ev.toX).toBeCloseTo(other.x, 0);
  });
});

describe("the Sorcerer's Elemental Nova", () => {
  /** A staff hero, a Sorcerer of `el` or nobody's, casts the frost ring over the grunt. */
  function nova(el: 'fire' | 'frost' | 'earth' | 'air' | undefined) {
    const sc = scene(false);
    Object.assign(sc.p, { style: 'staff', mode: 'move', spec: el ? { staff: 'sorcerer' } : undefined, elements: el ? { staff: el } : undefined });
    Object.assign(sc.friend, { x: 20, z: 20 });
    Object.assign(sc.e, { x: 0, z: 8 });
    stepPlayer(sc.p, { ...idleCommand(), ability1: true }, DT, world, sc.s);
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, idleCommand(), DT, world, sc.s);
      sc.s.time += DT;
    }
    return sc;
  }

  it("a Frost Sorcerer's ring is the frost ring: it freezes, and names no element", () => {
    const { s, e } = nova('frost');
    expect(e.frozen).toBeGreaterThan(0);
    const ev = s.events.find((x) => x.kind === 'frostRing');
    expect(ev && ev.kind === 'frostRing' && ev.element).toBeUndefined();
  });

  it("a Fire Sorcerer's ring burns harder than the frost ring and freezes nothing", () => {
    const plain = nova(undefined);
    const fire = nova('fire');
    expect(fire.e.frozen).toBe(0);
    expect(9999 - fire.e.hp).toBeCloseTo((9999 - plain.e.hp) * tuning.specs.novaFireDamage, 3);
    const ev = fire.s.events.find((x) => x.kind === 'frostRing');
    expect(ev && ev.kind === 'frostRing' && ev.element).toBe('fire');
  });

  it("an Earth Sorcerer's ring hits with Attunement's poise; an Air Sorcerer's throws the enemy outward", () => {
    const { p } = scene(false);
    Object.assign(p, { style: 'staff', spec: { staff: 'sorcerer' }, elements: { staff: 'earth' } });
    const hit = { attackerId: p.id, damage: 10, poise: 1, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: 0, y: 0, z: 0, freezeTime: 1 };
    elementalNova(p, hit);
    expect(hit.poise).toBeCloseTo(tuning.specs.attuneEarthPoise, 5);
    expect(hit.freezeTime).toBeUndefined();
    const earth = nova('earth');
    expect(earth.e.frozen).toBe(0);
    const air = nova('air');
    expect(air.e.frozen).toBe(0);
    expect(air.e.kbz).toBeLessThan(-0.5);
    expect(nova(undefined).e.kbz).toBe(0);
  });
});
