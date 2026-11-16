import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, nearestTarget, separateBodies, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { gravehandLift, handAloft, heldLine, palmResting, restSeconds } from './gravehand';
import { attackType, roleOf, telegraphTell } from './roles';
import { emptyTalents } from './talents';
import { idleCommand, type EnemyState, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState, stepSim } from './world';

// H1, the Gravehand (docs/bosses.md 2.1), phase 1: a floating bone hand. Palm slam (a jump does not
// clear it), backhand sweep (low: a jump does), flick (three shards); out of a blade's reach while
// it floats, and its resting palm takes 1.5x.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { ...tuning.gravehand, passive: tuning.debug.passiveEnemies, clearsLow: tuning.jump.clearsLow };
afterEach(() => {
  const { passive, clearsLow, ...g } = kept;
  Object.assign(tuning.gravehand, g);
  tuning.debug.passiveEnemies = passive;
  tuning.jump.clearsLow = clearsLow;
});

function scene(heroZ: number): { s: SimState; p: PlayerState; h: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: heroZ, yaw: 0, mode: 'move', invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1000, maxHp: 1000 });
  const h = createEnemy(s, world, 'gravehand', 0, 2, 0);
  Object.assign(h, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, h };
}

/** Ticks of enemy stepping until `done`; returns how many it took. */
function ticksUntil(s: SimState, done: () => boolean, max = 600): number {
  let i = 0;
  for (; i < max && !done(); i++) stepEnemies(s, DT, world);
  return i;
}

function hit(id: string, e: EnemyState, projectile: boolean): HitSpec {
  return { attackerId: id, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: projectile ? 'bow' : 'sword', projectile };
}

const events = (s: SimState, kind: string) => s.events.filter((e) => e.kind === kind);

describe('the Gravehand (H1)', () => {
  it('is a boss with a brain of its own; its slam has the orange rim, its sweep is blockable, its flick yellow', () => {
    expect(roleOf('gravehand')).toBe('boss');
    expect(brainFor('gravehand')).toBeDefined();
    expect(brainFor('gravehand')).not.toBe(brainFor('warden'));
    expect(telegraphTell({ kind: 'gravehand', attack: 'slam' }, true)).toEqual({ colour: 'strike', type: 'blunt', rim: true });
    expect(telegraphTell({ kind: 'gravehand', attack: 'sweep' }, true)).toEqual({ colour: 'strike', type: 'blunt', rim: false });
    expect(telegraphTell({ kind: 'gravehand', attack: 'flick' }, true)).toEqual({ colour: 'projectile', type: 'pierce', rim: false });
    expect(attackType({ kind: 'gravehand', attack: 'flick' })).toBe('pierce');
  });

  it('ends Mossgate Barrow, and the Warden does with the switch off', () => {
    expect(bossOf('mossgate')).toBe('gravehand');
    expect(bossOf('old-cellar')).toBe('warden');
    tuning.gravehand.enabled = false;
    expect(bossOf('mossgate')).toBe('warden');
  });

  it('slams its palm after slamTelegraphMs on a circle that followed the hero, then rests on the floor', () => {
    const { s, p, h } = scene(7);
    tuning.gravehand.sweepChance = 0;
    ticksUntil(s, () => h.ai === 'slamWindup');
    expect(h.attack).toBe('slam');
    expect(h.tele.shape).toBe('circle');
    const n = ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(Math.abs(n * DT * 1000 - tuning.gravehand.slamTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    // Where the hero stood as it locked (the slam's push has moved them since).
    expect(Math.hypot(h.tele.x, h.tele.z - 7)).toBeLessThan(0.01);
    expect(p.hp).toBeLessThan(1000);
    ticksUntil(s, () => h.ai === 'recover');
    expect(palmResting(h)).toBe(true);
    expect(gravehandLift(h)).toBe(0);
    // It rests slamRestMs before it rises again.
    const rest = ticksUntil(s, () => h.ai !== 'recover');
    expect(rest * DT * 1000).toBeGreaterThanOrEqual(tuning.gravehand.slamRestMs - DT * 1000);
  });

  it('sweeps after sweepTelegraphMs, a cone low along the floor', () => {
    const { s, p, h } = scene(4.5);
    tuning.gravehand.sweepChance = 1;
    ticksUntil(s, () => h.ai === 'sweepWindup');
    expect(h.tele.shape).toBe('cone');
    const n = ticksUntil(s, () => h.ai === 'sweep');
    expect(Math.abs(n * DT * 1000 - tuning.gravehand.sweepTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    expect(p.hp).toBeLessThan(1000);
    expect(handAloft(h)).toBe(false);
  });

  it('flicks three shards in a fan after flickTelegraphMs at a hero out of reach', () => {
    const { s, h } = scene(12);
    ticksUntil(s, () => h.ai === 'aim');
    expect(h.attack).toBe('flick');
    const n = ticksUntil(s, () => s.projectiles.length > 0);
    expect(Math.abs(n * DT * 1000 - tuning.gravehand.flickTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    expect(s.projectiles).toHaveLength(3);
    expect(s.projectiles.every((pr) => pr.hostile)).toBe(true);
    const yaws = s.projectiles.map((pr) => Math.atan2(pr.vx, pr.vz));
    expect(Math.max(...yaws) - Math.min(...yaws)).toBeCloseTo((tuning.gravehand.flickArcDeg * Math.PI) / 180, 3);
  });
});

describe('the jump against the Gravehand (M1)', () => {
  function sceneJump(): { s: SimState; p: PlayerState; h: EnemyState } {
    tuning.jump.clearsLow = true;
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', loadout, false);
    Object.assign(p, { x: 0, z: 10, yaw: 0, invulnTime: 0 });
    const h = createEnemy(s, world, 'gravehand', 0, 12.5, Math.PI);
    Object.assign(h, { x: 0, z: 12.5, yaw: Math.PI, ai: 'idle', aiTime: 0, recoverTime: 99 });
    return { s, p, h };
  }
  const step = (s: SimState, cmd: PlayerCommand = idleCommand()) => stepSim(s, { p1: cmd }, DT, world);
  function jump(s: SimState, p: PlayerState): void {
    step(s, { ...idleCommand(), jump: true });
    for (let i = 0; i < 60 && p.y < 0.6 && p.vy > 0; i++) step(s);
    expect(p.y).toBeGreaterThanOrEqual(tuning.jump.clearHeight);
  }

  it('clears the backhand sweep', () => {
    const { s, p, h } = sceneJump();
    jump(s, p);
    Object.assign(h, { ai: 'sweepWindup', attack: 'sweep', aiTime: 99 });
    h.tele = { shape: 'cone', x: h.x, z: h.z, radius: tuning.gravehand.sweepRadius, yaw: h.yaw, arcDeg: tuning.gravehand.sweepArcDeg };
    step(s);
    expect(events(s, 'cleared')).toEqual([expect.objectContaining({ playerId: 'p1' })]);
    expect(p.hp).toBe(100);
  });

  it('clears a knuckle of the chain', () => {
    const { s, p, h } = sceneJump();
    jump(s, p);
    Object.assign(h, { ai: 'slamWindup', attack: 'knuckles', chain: 1, aiTime: 99, phase: 3 });
    h.tele = { shape: 'circle', x: p.x, z: p.z, radius: tuning.gravehand.knuckleRadius, yaw: h.yaw, arcDeg: 360 };
    step(s);
    expect(events(s, 'cleared')).toEqual([expect.objectContaining({ playerId: 'p1' })]);
    expect(p.hp).toBe(100);
  });

  it('does not clear the palm slam', () => {
    const { s, p, h } = sceneJump();
    jump(s, p);
    Object.assign(h, { ai: 'slamWindup', attack: 'slam', aiTime: 99 });
    h.tele = { shape: 'circle', x: p.x, z: p.z, radius: tuning.gravehand.slamRadius, yaw: h.yaw, arcDeg: 360 };
    step(s);
    expect(events(s, 'enemySlam')).toHaveLength(1);
    expect(events(s, 'cleared')).toHaveLength(0);
    expect(p.hp).toBeLessThan(100);
  });
});

describe('where the Gravehand can be hit (H1)', () => {
  it('floats out of a blade’s reach: a sword misses, an arrow lands', () => {
    const { s, p, h } = scene(6);
    expect(handAloft(h)).toBe(true);
    expect(damageEnemy(s, h, hit(p.id, h, false))).toBe(false);
    expect(h.hp).toBe(h.maxHp);
    expect(damageEnemy(s, h, hit(p.id, h, true))).toBe(true);
    expect(h.hp).toBeLessThan(h.maxHp);
  });

  it('takes restDamageTaken of every hit while its palm rests after a slam, a sword’s too', () => {
    const { s, p, h } = scene(6);
    Object.assign(h, { ai: 'sweep', attack: 'sweep', aiTime: 0 });
    damageEnemy(s, h, hit(p.id, h, false));
    const low = h.maxHp - h.hp;
    expect(low).toBeGreaterThan(0);
    const before = h.hp;
    Object.assign(h, { ai: 'recover', attack: 'slam', aiTime: 0, recoverTime: 99, lastHitAt: -1, hitstop: 0 });
    expect(damageEnemy(s, h, hit(p.id, h, false))).toBe(true);
    expect(before - h.hp).toBeCloseTo(low * tuning.gravehand.restDamageTaken, 5);
  });

  it('lets heroes walk under it while it floats, and pushes them off its resting palm', () => {
    const { p, h } = scene(2.3);
    Object.assign(p, { x: 0, z: 2.3 });
    separateBodies(h, p);
    expect(p.z).toBe(2.3);
    Object.assign(h, { ai: 'recover', attack: 'slam' });
    separateBodies(h, p);
    expect(p.z).toBeGreaterThan(2.3);
  });
});

describe('the Gravehand, phase 2: its rings (H2)', () => {
  function heroes(s: SimState, n: number): void {
    for (let i = 2; i <= n; i++) Object.assign(addPlayer(s, world, `p${i}`, loadout, false), { x: i, z: 9 });
  }

  it('roars at phase2At and twists off a ring a hero, Iron first, round it', () => {
    for (const [n, kinds] of [
      [1, ['ironRing']],
      [3, ['ironRing', 'silverRing', 'boneRing']],
    ] as const) {
      const { s, h } = scene(9);
      heroes(s, n);
      h.hp = h.maxHp * tuning.gravehand.phase2At - 1;
      ticksUntil(s, () => h.ai === 'roar');
      expect(events(s, 'roar')).toEqual([expect.objectContaining({ phase: 2, hand: true })]);
      ticksUntil(s, () => h.phase === 2);
      expect(s.enemies.filter((e) => e !== h).map((e) => e.kind)).toEqual(kinds);
      for (const r of s.enemies.filter((e) => e !== h)) expect(Math.hypot(r.x - h.x, r.z - h.z)).toBeGreaterThan(2);
    }
  });

  it('counts heroes, not henchmen, for its rings', () => {
    const { s, h } = scene(9);
    heroes(s, 2);
    Object.assign(s.players[1], { henchman: true });
    h.hp = h.maxHp * tuning.gravehand.phase2At - 1;
    ticksUntil(s, () => h.phase === 2);
    expect(s.enemies.filter((e) => e !== h).map((e) => e.kind)).toEqual(['ironRing']);
  });

  it("takes wardTaken of a hit while a Silver Ring channels its ward, and an arrow breaks the channel", () => {
    const { s, p, h } = scene(9);
    const r = createEnemy(s, world, 'silverRing', 8, 8, 0);
    Object.assign(r, { ai: 'chase', aiTime: 0, cooldown: 0 });
    stepEnemies(s, DT, world);
    expect(r.ai).toBe('chant');
    expect(r.tele.shape).toBe('circle');
    damageEnemy(s, h, hit(p.id, h, true));
    const warded = h.maxHp - h.hp;
    // A spell is turned aside by the ring's ward: the channel holds.
    expect(damageEnemy(s, r, { ...hit(p.id, r, true), style: 'staff' })).toBe(true);
    expect(r.ai).toBe('chant');
    expect(r.hp).toBe(r.maxHp);
    // An arrow lands and breaks it, and the hand takes full damage again.
    damageEnemy(s, r, hit(p.id, r, true));
    expect(r.ai).toBe('recover');
    const before = h.hp;
    Object.assign(h, { lastHitAt: -1, hitstop: 0 });
    damageEnemy(s, h, hit(p.id, h, true));
    expect(warded).toBeCloseTo((before - h.hp) * tuning.gravehand.wardTaken, 5);
  });

  it('gives the Iron Ring plate against blades, and the Bone Ring no poise against one', () => {
    const { s, p } = scene(9);
    const iron = createEnemy(s, world, 'ironRing', 6, 6, 0);
    const bone = createEnemy(s, world, 'boneRing', -6, 6, 0);
    for (const e of [iron, bone]) Object.assign(e, { ai: 'chase', aiTime: 0 });
    damageEnemy(s, iron, hit(p.id, iron, false));
    expect(iron.maxHp - iron.hp).toBeCloseTo(10 * tuning.bosses.armourTaken, 5);
    damageEnemy(s, bone, { ...hit(p.id, bone, false), poise: 5 });
    expect(bone.ai).toBe('stagger');
    expect(attackType({ kind: 'ironRing', attack: '' })).toBe('blunt');
  });
});

describe('the Gravehand, phase 2: the grab (H2)', () => {
  /** A hand in phase 2 holding p1 (or about to reach for them), with a partner p2 beside. */
  function held(): { s: SimState; p: PlayerState; q: PlayerState; h: EnemyState } {
    const { s, p, h } = scene(6);
    const q = addPlayer(s, world, 'p2', loadout, false);
    Object.assign(q, { x: 3, z: 9, hp: 1000, maxHp: 1000 });
    h.phase = 2;
    tuning.gravehand.grabChance = 1;
    ticksUntil(s, () => h.ai === 'charge');
    return { s, p, q, h };
  }
  const press = (dodge: boolean): PlayerCommand => ({ ...idleCommand(), dodge, moveX: 1 });

  it('reaches for its hero in a rimmed ring, then holds them: down where a blade reaches it', () => {
    const { s, p, h } = scene(6);
    h.phase = 2;
    tuning.gravehand.grabChance = 1;
    ticksUntil(s, () => h.ai === 'chargeWindup');
    expect(h.attack).toBe('grab');
    expect(h.tele.shape).toBe('circle');
    expect(telegraphTell(h, true)).toEqual({ colour: 'strike', type: 'edge', rim: true });
    const n = ticksUntil(s, () => h.ai === 'charge');
    expect(Math.abs(n * DT * 1000 - tuning.gravehand.grabTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    expect(p.held).toMatchObject({ by: h.id, presses: 0 });
    expect(heldLine(p)).toBe(`✊ Held  ·  dodge on the beat to break free  ·  0/${tuning.gravehand.grabEscapePresses}`);
    expect(heldLine({})).toBe('');
    expect(h.grip?.hero).toBe('p1');
    expect(handAloft(h)).toBe(false);
  });

  it('holds its hero still and squeezes them, and lets go when the grip runs down', () => {
    const { s, p, h } = held();
    const x = p.x;
    const hp = p.hp;
    for (let i = 0; i < 90; i++) stepSim(s, { p1: press(false) }, DT, world);
    expect(p.x).toBe(x);
    expect(p.held).toBeDefined();
    for (let i = 0; i < 200 && p.held; i++) stepSim(s, { p1: press(false) }, DT, world);
    expect(p.held).toBeUndefined();
    expect(p.hp).toBeLessThan(hp);
    stepSim(s, { p1: idleCommand() }, DT, world);
    expect(h.grip).toBeUndefined();
    expect(palmResting(h)).toBe(true);
  });

  it("drops a held hero to a partner's heavy, and rests its palm there", () => {
    const { s, p, q, h } = held();
    damageEnemy(s, h, { ...hit(q.id, h, false), heavy: true });
    expect(p.held).toBeUndefined();
    expect(h.grip).toBeUndefined();
    expect(palmResting(h)).toBe(true);
  });

  it('drops a held hero after grabBreakDamage dealt to it, not before', () => {
    const { s, p, q, h } = held();
    const half = { ...hit(q.id, h, true), damage: tuning.gravehand.grabBreakDamage / 2 };
    damageEnemy(s, h, half);
    expect(p.held).toBeDefined();
    Object.assign(h, { hitstop: 0 });
    damageEnemy(s, h, half);
    expect(p.held).toBeUndefined();
  });

  it('lets a solo hero wriggle free with three dodge presses on the beat, and not by mashing', () => {
    const mashed = held();
    for (let i = 0; i < 60; i++) stepSim(mashed.s, { p1: press(i % 4 === 0) }, DT, world);
    expect(mashed.p.held).toBeDefined();
    const { s, p } = held();
    const beat = Math.ceil(tuning.gravehand.grabBeatMs / 1000 / DT) + 1;
    for (let i = 0; i < beat * 3 && p.held; i++) stepSim(s, { p1: press(i % beat === 0) }, DT, world);
    expect(p.held).toBeUndefined();
    expect(p.invulnTime).toBeGreaterThan(0);
  });
});

describe('the Bone Ring goes for the back line (H2)', () => {
  it('passes the nearer blade for the archer or the mage, and takes the blade when there is no one else', () => {
    const { s, p } = scene(4);
    const bone = createEnemy(s, world, 'boneRing', 0, 6, 0);
    Object.assign(bone, { x: 0, z: 6, ai: 'chase' });
    expect(nearestTarget(s, bone)?.id).toBe('p1');
    const archer = addPlayer(s, world, 'p2', loadout, false);
    Object.assign(archer, { x: 0, z: 14, style: 'bow' });
    expect(p.style).toBe('sword');
    expect(nearestTarget(s, bone)?.id).toBe('p2');
    archer.mode = 'down';
    expect(nearestTarget(s, bone)?.id).toBe('p1');
  });
});

describe('the Gravehand, phase 3: the clench (H3)', () => {
  it('roars at phase3At, and only the ring kinds left standing rise again', () => {
    const { s, h } = scene(9);
    Object.assign(h, { phase: 2 });
    const iron = createEnemy(s, world, 'ironRing', 6, 6, 0);
    const silver = createEnemy(s, world, 'silverRing', -6, 6, 0);
    Object.assign(iron, { ai: 'chase' });
    Object.assign(silver, { ai: 'dead', aiTime: 0 });
    h.hp = h.maxHp * tuning.gravehand.phase3At - 1;
    ticksUntil(s, () => h.ai === 'roar');
    expect(events(s, 'roar')).toEqual([expect.objectContaining({ phase: 3, hand: true })]);
    ticksUntil(s, () => h.phase === 3);
    expect(s.enemies.filter((e) => e.kind === 'ironRing' && e.ai !== 'dead')).toHaveLength(2);
    expect(s.enemies.filter((e) => e.kind === 'silverRing' && e.ai !== 'dead')).toHaveLength(0);
    expect(restSeconds(h)).toBe(tuning.gravehand.phase3RestMs / 1000);
    expect(restSeconds({ phase: 2 })).toBe(tuning.gravehand.slamRestMs / 1000);
  });

  it('rolls a knuckle chain: three rimmed circles along the line, the first after knuckleTelegraphMs, each next after knuckleNextMs', () => {
    const { s, h } = scene(8);
    Object.assign(h, { phase: 3 });
    tuning.gravehand.knuckleChance = 1;
    ticksUntil(s, () => h.attack === 'knuckles');
    expect(telegraphTell(h, true)).toEqual({ colour: 'strike', type: 'blunt', rim: true });
    const t0 = { x: h.tele.x, z: h.tele.z };
    const first = ticksUntil(s, () => events(s, 'enemySlam').length > 0);
    expect(Math.abs(first * DT * 1000 - tuning.gravehand.knuckleTelegraphMs)).toBeLessThanOrEqual(DT * 1000 + 1);
    const next = ticksUntil(s, () => events(s, 'enemySlam').length > 1);
    expect(Math.abs(next * DT * 1000 - tuning.gravehand.slamActiveMs - tuning.gravehand.knuckleNextMs)).toBeLessThanOrEqual(2 * DT * 1000 + 1);
    ticksUntil(s, () => h.ai === 'recover');
    const slams = events(s, 'enemySlam') as { x: number; z: number }[];
    expect(slams).toHaveLength(3);
    expect(Math.hypot(slams[0].x - t0.x, slams[0].z - t0.z)).toBeLessThan(1e-6);
    expect(Math.hypot(slams[2].x - slams[1].x, slams[2].z - slams[1].z)).toBeCloseTo(tuning.gravehand.knuckleStepM, 5);
    // A fist on the floor, not floating: a blade reaches it.
    expect(handAloft(h)).toBe(false);
  });
});
