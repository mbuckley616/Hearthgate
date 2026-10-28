import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { damageEnemy, hurtHero, payCombo } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { stepFlow } from './flow';
import { emptyMods, xpForLevel } from './gear';
import { stepPlayer } from './player';
import { emptyTalents, heroHit } from './talents';
import { idleCommand, type PlayerCommand, type PlayerState, type SimEvent, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout = (name: string): Loadout => ({ name, xp: { sword: xpForLevel(20), bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });

function hero(n = 1) {
  const s = createSimState(arena, [], world);
  const ps = Array.from({ length: n }, (_, i) => addPlayer(s, world, `p${i + 1}`, loadout(`p${i + 1}`), false));
  for (const p of ps) {
    p.invulnTime = 0;
    stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  }
  return { s, p: ps[0], ps };
}

/** A sturdy dummy right in front of the hero, placed exactly. */
function dummy(s: SimState, p: PlayerState) {
  const e = createEnemy(s, world, 'grunt', p.x, p.z + 1.4, Math.PI);
  e.x = p.x;
  e.z = p.z + 1.4;
  e.y = p.y;
  e.hp = e.maxHp = 100000;
  e.poise = 100000;
  e.ai = 'chase';
  s.enemies.push(e);
  return e;
}

/**
 * Tap through `chains` five-hit chains, each press `lead` seconds before the chain's next step
 * opens (0 = right on it, the beat; 0.18 = at the front of the input buffer, off it).
 */
function chains(s: SimState, p: PlayerState, n: number, lead: number) {
  const events: SimEvent[] = [];
  let presses = 0;
  let waitSeq = -1;
  for (let t = 0; t < 4000 && presses < n * 5; t++) {
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1 };
    if (waitSeq >= 0 && p.attackSeq !== waitSeq) waitSeq = -1;
    if (waitSeq < 0) {
      const h = heroHit(p, p.attackHit);
      const open = h.windup + h.active;
      if (p.mode === 'move' || (p.mode === 'attack' && p.attackTime >= open - lead - 1e-9)) {
        cmd.attack = true;
        waitSeq = p.attackSeq;
        presses++;
      }
    }
    s.events = [];
    stepPlayer(p, cmd, DT, world, s);
    events.push(...s.events);
  }
  for (let t = 0; t < 90; t++) stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1 }, DT, world, s);
  return events;
}

const kept = { ...tuning.flow };
afterEach(() => Object.assign(tuning.flow, kept));

describe('Flow (C2)', () => {
  it('pays more for presses on the beat than for presses early in the buffer', () => {
    const on = hero();
    dummy(on.s, on.p);
    chains(on.s, on.p, 1, 0);
    const early = hero();
    dummy(early.s, early.p);
    chains(early.s, early.p, 1, 0.18);
    const f = tuning.flow;
    // The first press of a chain from standing is never on the beat.
    expect(on.p.flow!.v).toBe(f.lightOffBeat + 4 * f.lightOnBeat);
    expect(early.p.flow!.v).toBe(5 * f.lightOffBeat);
  });

  it('pays nothing for swings at the air', () => {
    const { s, p } = hero();
    chains(s, p, 1, 0);
    expect(p.flow!.v).toBe(0);
  });

  it('pays half for the same chain a third time running', () => {
    const { s, p } = hero();
    dummy(s, p);
    tuning.flow.max = 10000;
    chains(s, p, 1, 0);
    const one = p.flow!.v;
    chains(s, p, 1, 0);
    const two = p.flow!.v - one;
    chains(s, p, 1, 0);
    const three = p.flow!.v - one - two;
    expect(two).toBe(one);
    expect(three).toBe(two * tuning.flow.repeatFrac);
  });

  it('costs a tier for a hit taken, and at Flow III a heavy hit does not interrupt', () => {
    const { s, p } = hero();
    const third = tuning.flow.max / 3;
    p.flow!.v = 2.5 * third;
    hurtHero(s, p, { damage: 5, fromX: p.x, fromZ: p.z + 2 });
    expect(p.flow!.v).toBe(1.5 * third);
    p.flow!.v = tuning.flow.max;
    hurtHero(s, p, { damage: 5, heavy: true, push: 2, fromX: p.x, fromZ: p.z + 2 });
    expect(p.mode).not.toBe('hurt');
    expect(p.flow!.v).toBe(2 * third);
    hurtHero(s, p, { damage: 5, heavy: true, push: 2, fromX: p.x, fromZ: p.z + 2 });
    expect(p.mode).toBe('hurt');
  });

  it('pays for a perfect parry, a dodge that slips a hit (once a dodge), and a whole tier for a combo', () => {
    const { s, p } = hero();
    p.mode = 'guard';
    p.parryOpen = true;
    p.guardTime = 0;
    hurtHero(s, p, { damage: 5, fromX: p.x + Math.sin(p.yaw) * 2, fromZ: p.z + Math.cos(p.yaw) * 2 });
    expect(p.flow!.v).toBe(tuning.flow.perfectGain);
    p.mode = 'dodge';
    p.invulnerable = true;
    hurtHero(s, p, { damage: 5, fromX: p.x, fromZ: p.z + 2 });
    hurtHero(s, p, { damage: 5, fromX: p.x, fromZ: p.z + 2 });
    expect(p.flow!.v).toBe(2 * tuning.flow.perfectGain);
    payCombo(s, 'shatter', p.id, 0, 0, 0);
    expect(p.flow!.v).toBe(2 * tuning.flow.perfectGain + tuning.flow.comboGain);
  });

  it('drains once the fighting stops', () => {
    const { p } = hero();
    p.flow!.v = 100;
    for (let t = 0; t < 120; t++) stepFlow(p, DT);
    expect(p.flow!.v).toBe(100);
    for (let t = 0; t < 120; t++) stepFlow(p, DT);
    expect(p.flow!.v).toBeLessThan(100);
  });

  it('turns a charged heavy at a full meter into a Crescendo that spends it', () => {
    const { s, p } = hero();
    dummy(s, p);
    p.flow!.v = tuning.flow.max;
    const events: SimEvent[] = [];
    const hold = Math.ceil(((tuning.combo.heavyHoldMs + tuning.combo.chargeMs + 60) / 1000) * 60);
    for (let t = 0; t < hold + 90; t++) {
      s.events = [];
      stepPlayer(p, { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: t < hold }, DT, world, s);
      events.push(...s.events);
    }
    expect(events).toContainEqual({ kind: 'stringMove', playerId: 'p1', move: 'H', charge: 3 });
    expect(p.flow!.v).toBeLessThan(tuning.flow.max / 3);
    p.attackMove = 'H';
    p.attackCharge = 2;
    const two = heroHit(p, 4).damage;
    p.attackCharge = 3;
    expect(heroHit(p, 4).damage).toBeCloseTo(two * tuning.flow.crescendoDamage);
  });

  it('adds Harmony to a combo payoff when two players are at Flow III', () => {
    const payoff = (both: boolean) => {
      const { s, ps } = hero(2);
      const e = dummy(s, ps[0]);
      ps[1].flow!.v = tuning.flow.max;
      ps[0].flow!.v = both ? tuning.flow.max : 0;
      e.shatterUntil = s.time + 1;
      const before = e.hp;
      damageEnemy(s, e, { attackerId: 'p2', damage: 10, poise: 0, knockback: 0, heavy: true, dirX: 0, dirZ: 1, x: 0, y: 1, z: 0, style: 'sword' });
      return before - e.hp;
    };
    expect(payoff(true) / payoff(false)).toBeCloseTo(1 + tuning.flow.harmonyBonus);
  });

  it('keeps no meter at all when Flow is off, as in the slice', () => {
    tuning.flow.enabled = false;
    const { p } = hero();
    expect(p.flow).toBeUndefined();
  });
});
