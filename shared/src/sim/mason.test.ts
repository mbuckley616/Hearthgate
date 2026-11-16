import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, masonAdds, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { boundMult, masonBound, raiseRidge, ridgeCollider, stepRidges } from './mason';
import { resolveCircle, segmentTouches } from '../level/geometry';
import { ADD_WEAKNESS, attackType, roleOf, telegraphTell } from './roles';
import { SIGNATURES, offerFor, signatureItem } from './signatures';
import { CATALOGUE, wornMods } from './catalogue';
import { readGearItem } from '../net/validate';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState, worldNow } from './world';

// M1, the Ossuary Mason (docs/bosses.md 2.2): tanky by rule, not by health. Bound while a Wardstone
// stands, it takes 25% of every hit; its maul string and hod throw.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { ...tuning.mason, passive: tuning.debug.passiveEnemies };
afterEach(() => {
  const { passive, ...m } = kept;
  Object.assign(tuning.mason, m);
  tuning.debug.passiveEnemies = passive;
});

function scene(heroZ: number): { s: SimState; p: PlayerState; m: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: heroZ, yaw: Math.PI, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
  const m = createEnemy(s, world, 'mason', 0, 2, 0);
  Object.assign(m, { x: 0, z: 2, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, m };
}

function ticksUntil(s: SimState, done: () => boolean, max = 900): number {
  let i = 0;
  for (; i < max && !done(); i++) stepEnemies(s, DT, world);
  return i;
}

function hit(e: EnemyState, style: 'sword' | 'bow' | 'staff' = 'sword'): HitSpec {
  return { attackerId: 'p1', damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style, projectile: style !== 'sword' };
}

const stones = (s: SimState) => s.enemies.filter((e) => e.kind === 'wardstone');
const events = (s: SimState, kind: string) => s.events.filter((e) => e.kind === kind);

describe('the Ossuary Mason (M1)', () => {
  it('is a boss with a brain of its own; its maul string blockable, its hod rimmed, both blunt', () => {
    expect(roleOf('mason')).toBe('boss');
    expect(brainFor('mason')).toBeDefined();
    expect(brainFor('mason')).not.toBe(brainFor('warden'));
    expect(telegraphTell({ kind: 'mason', attack: 'string' }, true).rim).toBe(false);
    expect(telegraphTell({ kind: 'mason', attack: 'hod' }, true).rim).toBe(true);
    expect(attackType({ kind: 'mason', attack: 'string' })).toBe('blunt');
    expect(attackType({ kind: 'mason', attack: 'hod' })).toBe('blunt');
  });

  it('ends Emberhall, and the Warden does with the switch off', () => {
    expect(bossOf('emberhall')).toBe('mason');
    expect(bossOf('old-cellar')).toBe('warden');
    tuning.mason.enabled = false;
    expect(bossOf('emberhall')).toBe('warden');
  });

  it('raises its Wardstones round it as it wakes, once', () => {
    const { s } = scene(20);
    stepEnemies(s, DT, world);
    expect(stones(s)).toHaveLength(tuning.mason.wardstones);
    expect(events(s, 'enemyRose').filter((ev) => 'enemyId' in ev && stones(s).some((st) => st.id === ev.enemyId))).toHaveLength(tuning.mason.wardstones);
    for (let i = 0; i < 30; i++) stepEnemies(s, DT, world);
    expect(stones(s)).toHaveLength(tuning.mason.wardstones);
  });

  it('takes boundTaken while a stone stands, and full damage once all fall (the gate)', () => {
    const { s, m } = scene(20);
    stepEnemies(s, DT, world);
    const [a, b, c] = stones(s);
    for (const st of [a, b, c]) st.ai = 'chase';
    expect(masonBound(s)).toBe(true);
    let hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    // A staff's bolt is held as much: the rule is any style's.
    hp = m.hp;
    damageEnemy(s, m, hit(m, 'staff'));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    // Two stones down, one standing: still Bound.
    for (const st of [a, b]) while (st.ai !== 'dead') damageEnemy(s, st, { ...hit(st), damage: 1000 });
    hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10 * tuning.mason.boundTaken, 5);
    while (c.ai !== 'dead') damageEnemy(s, c, { ...hit(c), damage: 1000 });
    expect(masonBound(s)).toBe(false);
    hp = m.hp;
    damageEnemy(s, m, hit(m));
    expect(hp - m.hp).toBeCloseTo(10, 5);
  });

  it('binds only the Mason: a stone and any other kind take their full hit', () => {
    const { s } = scene(20);
    stepEnemies(s, DT, world);
    expect(boundMult(s, stones(s)[0])).toBe(1);
    expect(boundMult(s, { kind: 'warden' })).toBe(1);
  });

  it('never moves a Wardstone, and its stones crumble when it falls, so the hall clears', () => {
    const { s, m } = scene(20);
    stepEnemies(s, DT, world);
    const st = stones(s)[0];
    const at = { x: st.x, z: st.z };
    for (let i = 0; i < 120; i++) stepEnemies(s, DT, world);
    expect(Math.hypot(st.x - at.x, st.z - at.z)).toBeLessThan(1e-6);
    // A fallen stone lies there while the Mason stands, past its death time, for a Chanter.
    st.ai = 'chase';
    damageEnemy(s, st, { ...hit(st), damage: 10000 });
    for (let i = 0; i < 240; i++) stepEnemies(s, DT, world);
    expect(s.enemies).toContain(st);
    m.hp = 0;
    m.ai = 'dead';
    ticksUntil(s, () => stones(s).every((e) => e.ai === 'dead'), 120);
    expect(stones(s).every((e) => e.ai === 'dead')).toBe(true);
  });

  it('swings a string of stringSteps cones at its front hero, the last an overhead', () => {
    Object.assign(tuning.mason, { wardstones: 0, guards: 0, chanters: 0 });
    const { s, p, m } = scene(4.5);
    ticksUntil(s, () => m.ai === 'windup');
    expect(m.attack).toBe('string');
    expect(m.tele.shape).toBe('cone');
    const taken: number[] = [];
    let last = p.hp;
    const n = ticksUntil(s, () => m.ai === 'slash1');
    expect(Math.abs(n * DT * 1000 - tuning.mason.stringTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    let swings = 0;
    ticksUntil(s, () => {
      if (p.hp < last) {
        taken.push(last - p.hp);
        last = p.hp;
      }
      // Keep the hero in front, and never i-framed, so every swing can land.
      Object.assign(p, { x: m.x + Math.sin(m.yaw) * 2, z: m.z + Math.cos(m.yaw) * 2, invulnTime: 0, mode: 'move' });
      swings = events(s, 'enemySwing').length;
      return m.ai === 'recover';
    });
    expect(swings).toBe(tuning.mason.stringSteps);
    expect(s.enemies).toHaveLength(1);
    expect(taken).toHaveLength(tuning.mason.stringSteps);
    expect(taken[taken.length - 1]).toBeGreaterThan(taken[0]);
  });

  it('throws its hod at a far hero: the circle follows them half the wind-up, then lands where it locked', () => {
    Object.assign(tuning.mason, { wardstones: 0, guards: 0, chanters: 0 });
    const { s, p, m } = scene(12);
    ticksUntil(s, () => m.ai === 'slamWindup');
    expect(m.attack).toBe('hod');
    expect(m.tele.shape).toBe('circle');
    // Past the lock the hero steps out of the circle: the load misses.
    ticksUntil(s, () => m.aiTime >= (tuning.mason.hodTelegraphMs / 1000) * 0.6);
    const locked = { x: m.tele.x, z: m.tele.z };
    p.x = locked.x + tuning.mason.hodRadius + 2;
    ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(m.tele.x).toBeCloseTo(locked.x, 6);
    expect(p.hp).toBe(1000);
  });

  it('lands its hod on a hero who stays in the circle', () => {
    Object.assign(tuning.mason, { wardstones: 0, guards: 0, chanters: 0 });
    const { s, p, m } = scene(12);
    ticksUntil(s, () => m.ai === 'slamWindup');
    const n = ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(Math.abs(n * DT * 1000 - tuning.mason.hodTelegraphMs)).toBeLessThanOrEqual(2 * DT * 1000 + 1);
    expect(p.hp).toBeLessThan(1000);
  });
});

describe('the Mason’s adds (M2)', () => {
  const keptC = { ...tuning.chanter };
  afterEach(() => Object.assign(tuning.chanter, keptC));

  function party(n: number): SimState {
    const { s } = scene(20);
    for (let i = 1; i < n; i++) {
      const q = addPlayer(s, world, `p${i + 1}`, loadout, false);
      Object.assign(q, { x: i, z: 20 });
    }
    return s;
  }
  const kinds = (s: SimState, k: string) => s.enemies.filter((e) => e.kind === k);

  it('raises one fewer of each add than the heroes, one at least, up to two', () => {
    expect(masonAdds(party(1), 2)).toBe(1);
    expect(masonAdds(party(2), 2)).toBe(1);
    expect(masonAdds(party(3), 2)).toBe(2);
    expect(masonAdds(party(4), 2)).toBe(2);
    expect(masonAdds(party(3), 0)).toBe(0);
    const s = party(3);
    stepEnemies(s, DT, world);
    expect(kinds(s, 'mortarGuard')).toHaveLength(2);
    expect(kinds(s, 'chanter')).toHaveLength(2);
  });

  it('makes the Guard armoured (a shield’s brain) and the Chanter warded (a caster’s)', () => {
    expect(roleOf('mortarGuard')).toBe('shield');
    expect(roleOf('chanter')).toBe('caster');
    expect(ADD_WEAKNESS.mortarGuard).toBe('armoured');
    expect(ADD_WEAKNESS.chanter).toBe('warded');
  });

  /** A Mason with one stone, fallen, and one Chanter in reach of it. */
  function fallen(): { s: SimState; stone: EnemyState; ch: EnemyState } {
    tuning.mason.wardstones = 1;
    tuning.mason.guards = 0;
    tuning.mason.chanters = 0;
    const { s, m } = scene(20);
    stepEnemies(s, DT, world);
    const stone = stones(s)[0];
    stone.ai = 'chase';
    damageEnemy(s, stone, { ...hit(stone), damage: 10000 });
    expect(stone.ai).toBe('dead');
    const ch = createEnemy(s, world, 'chanter', m.x - 6, m.z, 0);
    Object.assign(ch, { x: stone.x + 4, z: stone.z, ai: 'chase', aiTime: 0, cooldown: 0 });
    return { s, stone, ch };
  }

  it('stands a fallen Wardstone back up after rebuildMs of channel, and the Mason is Bound again', () => {
    const { s, stone, ch } = fallen();
    expect(masonBound(s)).toBe(false);
    ticksUntil(s, () => ch.ai === 'chant', 120);
    expect(ch.ai).toBe('chant');
    expect(Math.hypot(ch.tele.x - stone.x, ch.tele.z - stone.z)).toBeLessThan(0.01);
    const n = ticksUntil(s, () => stone.ai !== 'dead', 900);
    expect(Math.abs(n * DT * 1000 - tuning.chanter.rebuildMs)).toBeLessThanOrEqual(2 * DT * 1000 + 1);
    expect(stone.hp).toBeCloseTo(stone.maxHp * tuning.chanter.rebuildHpFrac, 5);
    expect(masonBound(s)).toBe(true);
  });

  it('breaks the channel on an arrow (the gate), and the stone stays down', () => {
    const { s, stone, ch } = fallen();
    ticksUntil(s, () => ch.ai === 'chant', 120);
    ticksUntil(s, () => ch.aiTime >= 2, 300);
    const hp = ch.hp;
    damageEnemy(s, ch, hit(ch, 'bow'));
    expect(ch.ai).not.toBe('chant');
    // Warded: an arrow lands at wardArrowMult.
    expect(hp - ch.hp).toBeCloseTo(10 * tuning.bosses.wardArrowMult, 5);
    for (let i = 0; i < 60; i++) stepEnemies(s, DT, world);
    expect(stone.ai).toBe('dead');
  });

  it('turns a spell aside and keeps channelling', () => {
    const { s, ch } = fallen();
    ticksUntil(s, () => ch.ai === 'chant', 120);
    const hp = ch.hp;
    damageEnemy(s, ch, hit(ch, 'staff'));
    expect(ch.hp).toBe(hp);
    expect(ch.ai).toBe('chant');
  });

  it('raises nothing once the Mason has fallen', () => {
    const { s, stone, ch } = fallen();
    const m = s.enemies.find((e) => e.kind === 'mason')!;
    m.hp = 0;
    m.ai = 'dead';
    for (let i = 0; i < 600; i++) stepEnemies(s, DT, world);
    expect(ch.ai).not.toBe('chant');
    expect(stone.ai).toBe('dead');
  });
});

describe('the Mason’s phases (M3, part one)', () => {
  function roared(phase: 2 | 3): { s: SimState; p: PlayerState; m: EnemyState } {
    Object.assign(tuning.mason, { guards: 0, chanters: 0 });
    const sc = scene(20);
    stepEnemies(sc.s, DT, world);
    sc.m.hp = sc.m.maxHp * (phase === 2 ? tuning.mason.phase2At : tuning.mason.phase3At) - 1;
    if (phase === 3) sc.m.phase = 2;
    ticksUntil(sc.s, () => sc.m.phase === phase);
    return sc;
  }

  it('roars at phase2At', () => {
    const { s, m } = roared(2);
    expect(m.phase).toBe(2);
    expect(events(s, 'roar')).toEqual([{ kind: 'roar', enemyId: m.id, phase: 2, mason: true }]);
    // One hero: no Guard more; phase 2's are one fewer than the heroes with no floor of one.
    expect(s.enemies.filter((e) => e.kind === 'mortarGuard')).toHaveLength(0);
    expect(masonBound(s)).toBe(true);
  });

  it('raises one fewer Guard than the heroes at phase 2: none alone, one for two, two for three', () => {
    for (const [heroes, want] of [[1, 0], [2, 1], [3, 2], [4, 2]] as const) {
      Object.assign(tuning.mason, { guards: 0, chanters: 0 });
      const { s, m } = scene(20);
      for (let i = 2; i <= heroes; i++) addPlayer(s, world, `p${i}`, loadout, false);
      stepEnemies(s, DT, world);
      m.hp = m.maxHp * tuning.mason.phase2At - 1;
      ticksUntil(s, () => m.phase === 2);
      expect(s.enemies.filter((e) => e.kind === 'mortarGuard' && e.ai !== 'dead')).toHaveLength(want);
    }
  });

  it('pools grout under every hero from phase 2: it lands after the channel and Chills whoever stayed', () => {
    const { s, p, m } = roared(2);
    tuning.mason.groutChance = 1;
    Object.assign(p, { x: m.x, z: m.z + 10 });
    ticksUntil(s, () => m.ai === 'chant');
    expect(m.attack).toBe('grout');
    expect(telegraphTell({ kind: 'mason', attack: 'grout' }, true).colour).toBe('magic');
    expect(attackType({ kind: 'mason', attack: 'grout' })).toBe('magic');
    expect(m.circles).toEqual([{ x: p.x, z: p.z }]);
    const n = ticksUntil(s, () => events(s, 'circleLanded').length > 0);
    expect(Math.abs(n * DT * 1000 - tuning.mason.groutChannelMs - tuning.coop.lagGraceMs)).toBeLessThanOrEqual(2 * DT * 1000 + 1);
    expect(p.hp).toBeLessThan(1000);
    expect(p.chill).toBeGreaterThan(0);
  });

  it('puts the stones out for good at phase3At: never Bound again, and no Chanter raises them', () => {
    const { s, m } = roared(3);
    for (let i = 0; i < 5; i++) stepEnemies(s, DT, world);
    expect(stones(s).every((e) => e.ai === 'dead')).toBe(true);
    expect(masonBound(s)).toBe(false);
    expect(events(s, 'roar').at(-1)).toEqual({ kind: 'roar', enemyId: m.id, phase: 3, mason: true });
    const ch = createEnemy(s, world, 'chanter', m.x + 6, m.z, 0);
    Object.assign(ch, { ai: 'chase', aiTime: 0, cooldown: 0 });
    for (let i = 0; i < 600; i++) stepEnemies(s, DT, world);
    expect(ch.ai).not.toBe('chant');
    expect(masonBound(s)).toBe(false);
  });

  it('enraged, swings enragedSteps, and the last rolls a shockwave round it that reaches a hero behind it', () => {
    tuning.mason.groutChance = 0;
    const { s, p, m } = roared(3);
    Object.assign(p, { x: m.x + Math.sin(m.yaw) * 2, z: m.z + Math.cos(m.yaw) * 2 });
    ticksUntil(s, () => m.ai === 'windup' && m.attack === 'string');
    // A partner out of the maul's cone, behind it, inside the shockwave's reach.
    const q = addPlayer(s, world, 'p2', loadout, false);
    Object.assign(q, { mode: 'move', invulnTime: 0, lagGrace: 0, hp: 1000, maxHp: 1000 });
    let swings = 0;
    let shockwave = false;
    ticksUntil(s, () => {
      Object.assign(q, { x: m.x - Math.sin(m.yaw) * 3.5, z: m.z - Math.cos(m.yaw) * 3.5, y: m.y });
      if (m.ai === 'windup' && m.tele.shape === 'circle') shockwave = true;
      swings = events(s, 'enemySwing').filter((ev) => 'enemyId' in ev && ev.enemyId === m.id).length;
      return m.ai === 'slash1' && swings === tuning.mason.enragedSteps;
    });
    expect(swings).toBe(tuning.mason.enragedSteps);
    expect(shockwave).toBe(true);
    expect(q.hp).toBeLessThan(1000);
  });
});

describe("the Mason's bone ridges (M3, phase 2)", () => {
  function phase(n: 1 | 2): { s: SimState; p: PlayerState; m: EnemyState } {
    Object.assign(tuning.mason, { guards: 0, chanters: 0, wardstones: 0, groutChance: 0 });
    const sc = scene(4);
    sc.m.phase = n;
    return sc;
  }
  const strings = (s: SimState, m: EnemyState) => {
    // Through the whole string: every swing and the recovery after it.
    ticksUntil(s, () => m.ai === 'windup' && m.attack === 'string');
    ticksUntil(s, () => m.ai === 'recover');
  };

  it('raises a ridge with the overhead in phase 2, across the swing and past the maul, behind the hero struck', () => {
    const { s, p, m } = phase(2);
    strings(s, m);
    expect(s.ridges).toHaveLength(1);
    const r = s.ridges![0];
    expect(events(s, 'ridgeRaised')).toHaveLength(1);
    // The Mason faces +z at the hero: the ridge runs along x, farther out than the hero.
    expect(r.alongX).toBe(true);
    // From where it stood as the overhead landed; it has stepped on a little since.
    expect(Math.hypot(r.x - m.x, r.z - m.z)).toBeCloseTo(tuning.mason.stringReach + tuning.mason.ridgeAheadM, 0);
    expect(r.z - m.z).toBeGreaterThan(p.z - m.z - 0.5);
    expect(r.until).toBeCloseTo(s.time + tuning.mason.ridgeLifeMs / 1000, 3);
  });

  it('raises none in phase 1', () => {
    const { s, m } = phase(1);
    strings(s, m);
    expect(s.ridges).toBeUndefined();
  });

  it('is a wall to everyone while it stands: a hero is pushed out of it, and an arrow through it is stopped', () => {
    const { s, m } = phase(2);
    const r = raiseRidge(s, m)!;
    const cols = worldNow(world, s).colliders;
    expect(cols.some((c) => c.id === `ridge-${r.id}`)).toBe(true);
    const at = resolveCircle({ x: r.x, z: r.z }, 0.4, 0, 1.8, cols);
    expect(Math.abs(at.z - r.z)).toBeGreaterThanOrEqual(tuning.mason.ridgeThickM / 2 + 0.4 - 1e-6);
    // An arrow at chest height, across it.
    expect(segmentTouches({ x: r.x, y: 1.3, z: r.z - 3 }, { x: r.x, y: 1.3, z: r.z + 3 }, 0.05, ridgeCollider(r))).toBe(true);
    // Taller than a jump clears.
    expect(tuning.mason.ridgeHeightM).toBeGreaterThan(2);
  });

  it('keeps at most maxRidges, crumbles each after ridgeLifeMs, and every one when the Mason falls', () => {
    const { s, m } = phase(2);
    for (let i = 0; i < tuning.mason.maxRidges + 2; i++) raiseRidge(s, m);
    expect(s.ridges).toHaveLength(tuning.mason.maxRidges);
    s.time += tuning.mason.ridgeLifeMs / 1000 + 0.01;
    stepRidges(s);
    expect(s.ridges).toBeUndefined();
    raiseRidge(s, m);
    m.ai = 'dead';
    stepRidges(s);
    expect(s.ridges).toBeUndefined();
    expect(worldNow(world, s).colliders).toBe(worldNow(world, createSimState(arena, [], world)).colliders);
  });
});

describe("the Mason's signature drops (M3)", () => {
  const list = SIGNATURES.mason!;

  it('offers the shield to the tank and the staff to the mage who broke the Guards', () => {
    expect(list.map((p) => p.job)).toEqual(['tank', 'armoured']);
    expect(offerFor(list, { tank: 300, armoured: 100 })?.name).toBe('Mortarward Shield');
    expect(offerFor(list, { armoured: 200, boss: 400 })?.name).toBe("Chanter's Staff");
    // Nobody's job on the list: the first piece.
    expect(offerFor(list, { warded: 90 })?.name).toBe('Mortarward Shield');
  });

  it('makes each a real item the server takes back, worn in its slot', () => {
    for (const p of list) expect(readGearItem(signatureItem(p, 'x'))?.signature).toEqual(p.signature);
    const shield = signatureItem(list[0], 'a');
    const staff = signatureItem(list[1], 'b');
    expect(CATALOGUE.get(shield.id)?.slot).toBe('shield');
    expect(CATALOGUE.get(staff.id)?.slot).toBe('weapon');
    expect(CATALOGUE.get(staff.id)?.kind).toBe('magic');
    expect(wornMods({ shield }).resist).toEqual(['blunt']);
    expect(wornMods({ weapon: staff }).castSpeed).toBe(true);
  });
});
