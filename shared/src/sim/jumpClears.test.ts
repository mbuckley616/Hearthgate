import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { clearsLow, hurtHero } from './combat';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import { idleCommand, type EnemyState, type PlayerCommand, type PlayerState, type SimState } from './types';
import { createSimState, stepSim } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { clearsLow: tuning.jump.clearsLow, clearHeight: tuning.jump.clearHeight };
afterEach(() => {
  tuning.jump.clearsLow = kept.clearsLow;
  tuning.jump.clearHeight = kept.clearHeight;
});

/** A hero in the open with the Warden 2.5 m in front, idle until a test sets its attack going. */
function scene(remote = false): { s: SimState; p: PlayerState; w: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, remote);
  Object.assign(p, { x: 0, z: 10, yaw: 0, invulnTime: 0 });
  const w = createEnemy(s, world, 'warden', 0, 12.5, Math.PI);
  Object.assign(w, { x: 0, z: 12.5, yaw: Math.PI, ai: 'idle', aiTime: 0, recoverTime: 99 });
  return { s, p, w };
}

/** The Warden's attack lands on its next step: its telegraph already run out. */
function swing(s: SimState, w: EnemyState, p: PlayerState, kind: 'sweep' | 'slam' | 'farSlam'): void {
  const t = tuning.warden;
  if (kind === 'sweep') {
    Object.assign(w, { ai: 'sweepWindup', attack: 'sweep', aiTime: 99, recoverTime: 0 });
    w.tele = { shape: 'cone', x: w.x, z: w.z, radius: t.sweepRadius, yaw: w.yaw, arcDeg: t.sweepArcDeg };
  } else {
    Object.assign(w, { ai: 'slamWindup', attack: kind, aiTime: 99, recoverTime: 0 });
    w.tele = { shape: 'circle', x: p.x, z: p.z, radius: t.slamRadius, yaw: w.yaw, arcDeg: 360 };
  }
  void s;
}

function step(s: SimState, cmd: PlayerCommand = idleCommand()): void {
  stepSim(s, { p1: cmd }, DT, world);
}

/** Jump and rise until the feet are `h` up (or the jump peaks), a tick at a time. */
function jumpTo(s: SimState, p: PlayerState, h: number): void {
  step(s, { ...idleCommand(), jump: true });
  for (let i = 0; i < 60 && p.y < h && p.vy > 0; i++) step(s);
}

const events = (s: SimState, kind: string) => s.events.filter((e) => e.kind === kind);

describe('the jump clears low attacks (M1; Michael, 30 Oct, A)', () => {
  for (const kind of ['sweep', 'slam', 'farSlam'] as const) {
    it(`clears the Warden's ${kind} above clearHeight, with a cleared event and no damage`, () => {
      const { s, p, w } = scene();
      jumpTo(s, p, 0.6);
      expect(p.y).toBeGreaterThanOrEqual(tuning.jump.clearHeight);
      swing(s, w, p, kind);
      step(s);
      expect(events(s, 'heroHurt')).toHaveLength(0);
      expect(events(s, 'cleared')).toEqual([expect.objectContaining({ playerId: 'p1' })]);
      expect(p.hp).toBe(100);
      expect(p.mode).not.toBe('hurt');
    });
  }

  it("clears the Brute's slam too", () => {
    const { s, p, w } = scene();
    w.ai = 'dead';
    const b = createEnemy(s, world, 'brute', 0, 11.5, Math.PI);
    Object.assign(b, { x: 0, z: 11.5, yaw: Math.PI, ai: 'slamWindup', aiTime: -1 });
    jumpTo(s, p, 0.6);
    Object.assign(b, { aiTime: 99 });
    b.tele = { shape: 'circle', x: p.x, z: p.z, radius: tuning.brute.slamRadius, yaw: b.yaw, arcDeg: 360 };
    step(s);
    expect(events(s, 'enemySlam')).toHaveLength(1);
    expect(events(s, 'cleared')).toHaveLength(1);
    expect(p.hp).toBe(100);
  });

  it('a hop below the height, or standing, does not clear', () => {
    const a = scene();
    jumpTo(a.s, a.p, 0.3);
    expect(a.p.grounded).toBe(false);
    expect(a.p.y).toBeLessThan(tuning.jump.clearHeight);
    swing(a.s, a.w, a.p, 'slam');
    a.s.players[0].vy = 0; // hold the hop low for the tick
    step(a.s);
    expect(events(a.s, 'cleared')).toHaveLength(0);
    expect(a.p.hp).toBeLessThan(100);

    const b = scene();
    swing(b.s, b.w, b.p, 'sweep');
    step(b.s);
    expect(events(b.s, 'cleared')).toHaveLength(0);
    expect(b.p.hp).toBeLessThan(100);
  });

  it('is not i-frames: a hit that is not low still lands on a jumper', () => {
    const { s, p } = scene();
    jumpTo(s, p, 0.8);
    expect(clearsLow(p, 0)).toBe(true);
    expect(hurtHero(s, p, { damage: 10, fromX: 0, fromZ: 11, enemyId: 1 })).toBe('hit');
    expect(hurtHero(s, p, { damage: 10, fromX: 0, fromZ: 11, arrow: true })).toBe('hit');
    expect(p.hp).toBe(80);
  });

  it("measures from the attack's ground, not the hero's", () => {
    const { s, p } = scene();
    jumpTo(s, p, 0.8);
    // An attack along a floor 0.5 m higher than the hero's leaves them only 0.3 m over it.
    expect(hurtHero(s, p, { damage: 10, heavy: true, fromX: 0, fromZ: 11, low: p.y - 0.3 })).toBe('hit');
  });

  it('a remote player is judged as the hit lands, after the lag grace', () => {
    // Swung while they stand, landing 150 ms later while they are up: cleared.
    const a = scene(true);
    expect(a.p.lagGrace).toBeGreaterThan(0);
    swing(a.s, a.w, a.p, 'slam');
    step(a.s);
    expect(a.s.pendingHits).toHaveLength(1);
    step(a.s, { ...idleCommand(), jump: true });
    for (let i = 0; i < 30 && a.s.pendingHits.length > 0; i++) step(a.s);
    expect(a.s.pendingHits).toHaveLength(0);
    expect(a.p.hp).toBe(100);

    // Swung while they are up, landing after they are down again: hit.
    const b = scene(true);
    jumpTo(b.s, b.p, 1);
    for (let i = 0; i < 60 && b.p.y > 0.7; i++) step(b.s);
    swing(b.s, b.w, b.p, 'slam');
    step(b.s);
    expect(clearsLow(b.p, 0)).toBe(true);
    for (let i = 0; i < 30 && b.s.pendingHits.length > 0; i++) step(b.s);
    expect(b.p.grounded).toBe(true);
    expect(b.p.hp).toBeLessThan(100);
  });

  it('is off for the slice: the jump clears nothing and hits carry no tag', () => {
    tuning.jump.clearsLow = false;
    const { s, p, w } = scene(true);
    jumpTo(s, p, 0.8);
    swing(s, w, p, 'slam');
    step(s);
    expect(s.pendingHits).toHaveLength(1);
    expect('low' in s.pendingHits[0].hit).toBe(false);
    for (let i = 0; i < 30 && s.pendingHits.length > 0; i++) step(s);
    expect(p.hp).toBeLessThan(100);
  });

  it('is deterministic: the same jump and slam twice make the same state', () => {
    const run = (): string => {
      const { s, p, w } = scene(true);
      jumpTo(s, p, 0.6);
      swing(s, w, p, 'sweep');
      for (let i = 0; i < 40; i++) step(s, i % 7 === 0 ? { ...idleCommand(), jump: true } : idleCommand());
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
