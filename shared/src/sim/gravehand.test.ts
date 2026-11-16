import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy, type HitSpec } from './combat';
import { brainFor, createEnemy, separateBodies, stepEnemies } from './enemies';
import { bossOf } from './floorRun';
import { emptyMods } from './gear';
import { gravehandLift, handAloft, palmResting } from './gravehand';
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
