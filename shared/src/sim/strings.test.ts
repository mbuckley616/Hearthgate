import { afterEach, describe, expect, it } from 'vitest';
import { STRING_MOVES, tuning, type Style } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readCommand } from '../net/validate';
import { addPlayer, type Loadout } from './coop';
import { emptyMods, xpForLevel } from './gear';
import { stepPlayer } from './player';
import { emptyTalents, heroHit } from './talents';
import { idleCommand, type PlayerCommand, type SimEvent } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
const DT = 1 / 60;

function hero(style: Style = 'sword') {
  const s = createSimState(arena, [], world);
  const l: Loadout = { name: 'p', xp: { sword: xpForLevel(20), bow: xpForLevel(20), staff: xpForLevel(20) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
  const p = addPlayer(s, world, 'p1', l, false);
  p.style = style;
  p.invulnTime = 0;
  return { s, p };
}

interface Fired {
  tick: number;
  string?: string;
  move?: string;
  charge?: number;
  hit: number;
}

/**
 * Play a string the way a player would: each press lands in the chain's buffer window (or from
 * standing), a light is a tap of two ticks, a heavy is held for holdMs.
 */
function play(seq: string, style: Style = 'sword', holdMs = tuning.combo.heavyHoldMs + 60) {
  const { s, p } = hero(style);
  const fired: Fired[] = [];
  const trace: string[] = [];
  const events: SimEvent[] = [];
  let i = 0;
  let holdTicks = 0;
  let waitSeq = -1;
  let wasFired = false;
  for (let t = 0; t < 900; t++) {
    const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1 };
    if (waitSeq >= 0 && p.attackSeq !== waitSeq) waitSeq = -1;
    if (i < seq.length && holdTicks === 0 && waitSeq < 0) {
      const h = heroHit(p, p.attackHit);
      const ready = p.mode === 'move' || (p.mode === 'attack' && p.attackTime >= h.windup + h.active - tuning.combo.inputBufferMs / 2000);
      if (ready) {
        cmd.attack = true;
        holdTicks = seq[i] === 'H' ? Math.ceil((holdMs / 1000) * 60) : 2;
        waitSeq = p.attackSeq;
        i++;
      }
    }
    if (holdTicks > 0) {
      cmd.attackHeld = true;
      holdTicks--;
    }
    s.events = [];
    stepPlayer(p, cmd, DT, world, s);
    events.push(...s.events);
    trace.push(`${p.mode} ${p.attackHit} ${p.attackTime.toFixed(4)}`);
    const firedNow = p.mode === 'attack' && p.attackFired;
    if (firedNow && !wasFired) fired.push({ tick: t, string: p.attackString, move: p.attackMove, charge: p.attackCharge, hit: p.attackHit });
    wasFired = firedNow;
    if (i >= seq.length && p.mode === 'move' && holdTicks === 0) break;
  }
  return { fired, trace, events };
}

const kept = { ...tuning.combo };
afterEach(() => Object.assign(tuning.combo, kept));

describe('light and heavy strings (C1)', () => {
  it('leaves the five-hit light chain exactly as the slice plays it', () => {
    const on = play('LLLLL');
    tuning.combo.heavies = false;
    const off = play('LLLLL');
    expect(on.trace).toEqual(off.trace);
    expect(on.fired.map((f) => f.hit)).toEqual([0, 1, 2, 3, 4]);
    expect(on.fired.every((f) => f.move === undefined)).toBe(true);
    expect(on.fired[4].string).toBe('LLLLL');
  });

  it('turns a held press into the heavy for the string so far', () => {
    expect(play('H').fired.map((f) => [f.string, f.move, f.charge])).toEqual([['H', 'H', 1]]);
    expect(play('LH').fired.map((f) => f.move)).toEqual([undefined, 'LH']);
    expect(play('LLH').fired.map((f) => f.move)).toEqual([undefined, undefined, 'LLH']);
    expect(play('HH').fired.map((f) => f.move)).toEqual(['H', 'HH']);
    expect(play('HHH').fired.map((f) => f.move)).toEqual(['H', 'HH', 'HHH']);
    // The heavy borrows a chain step's pose: the overhead cleave is the leaping slam.
    expect(play('H').fired[0].hit).toBe(4);
    expect(play('H').events).toContainEqual({ kind: 'stringMove', playerId: 'p1', move: 'H', charge: 1 });
  });

  it('plays heavy, light, light as its own move, Michael’s example', () => {
    const r = play('HLL');
    expect(r.fired.map((f) => f.string)).toEqual(['H', 'HL', 'HLL']);
    expect(r.fired.map((f) => f.move)).toEqual(['H', undefined, 'HLL']);
    expect(r.events).toContainEqual({ kind: 'stringMove', playerId: 'p1', move: 'HLL', charge: 0 });
  });

  it('reaches charge level 2 when held longer, and hits harder for it', () => {
    const r = play('H', 'sword', tuning.combo.heavyHoldMs + tuning.combo.chargeMs + 60);
    expect(r.fired[0].charge).toBe(2);
    const { p } = hero();
    p.attackMove = 'H';
    p.attackCharge = 1;
    const one = heroHit(p, 4).damage;
    p.attackCharge = 2;
    expect(heroHit(p, 4).damage).toBeCloseTo(one * tuning.combo.charge2Damage);
  });

  it('holds a light that is still pressed at the end of its windup, and fires it on release', () => {
    // Held 200 ms: longer than the first slash's windup, shorter than a heavy's hold.
    const held = play('L', 'sword', 200);
    const { p } = hero();
    const r = (() => {
      const { s, p: q } = hero();
      const fired: number[] = [];
      for (let t = 0; t < 60; t++) {
        const cmd: PlayerCommand = { ...idleCommand(), aimX: 0, aimZ: 1, attack: t === 0, attackHeld: t < 12 };
        stepPlayer(q, cmd, DT, world, s);
        if (q.attackFired && fired.length === 0) fired.push(t);
      }
      return { fired, move: q.attackMove };
    })();
    expect(heroHit(p, 0).windup * 60).toBeLessThan(12);
    expect(r.fired[0]).toBeGreaterThanOrEqual(11);
    expect(r.move).toBeUndefined();
    expect(held.fired).toHaveLength(1);
  });

  it('keeps a hold made for the next swing from turning the current one heavy', () => {
    // The bow’s buffer window opens inside the next shot’s windup: L, L, then a held H is L L H, not L H.
    expect(play('LLH', 'bow').fired.map((f) => f.string)).toEqual(['L', 'LL', 'LLH']);
  });

  it('gives every weapon its strings, and a heavy string without its own move plays H', () => {
    for (const style of ['bow', 'staff'] as const) {
      expect(play('H', style).fired[0].move).toBe('H');
      expect(play('LLH', style).fired[2].move).toBe('LLH');
    }
    expect(STRING_MOVES.bow.LLLLH).toBeUndefined();
    expect(play('LLLLH', 'bow').fired[4].move).toBe('H');
  });

  it('takes attackHeld from a browser only as a boolean', () => {
    const base = { ...idleCommand(), aimX: 0, aimZ: 1 };
    expect(readCommand({ ...base, attackHeld: true })?.attackHeld).toBe(true);
    expect(readCommand(base)?.attackHeld).toBeUndefined();
    expect(readCommand({ ...base, attackHeld: 'yes' })).toBeNull();
  });
});
