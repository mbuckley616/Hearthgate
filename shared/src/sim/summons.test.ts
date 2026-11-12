import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { arena, buildWorld } from '../level/arena';
import { PROTOCOL_VERSION } from '../net/protocol';
import { createEnemy } from './enemies';
import { emptyMods, levelFor, xpForLevel } from './gear';
import { restartRun } from './run';
import { partyOf, raiseSkeleton, skeletonCap, skeletonLevel, stepSummons, summonsOf } from './summons';
import { emptyTalents } from './talents';
import type { SimEvent } from './types';

const world = buildWorld(arena);

/** The arena with one Necromancer-to-be at a staff level. */
function solo(level: number) {
  const host = new HostSession(world, () => {}, true);
  const loadout = { name: 'n', xp: { sword: 0, bow: 0, staff: xpForLevel(level) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const me = host.sim.players[0];
  me.style = 'staff';
  return { host, me };
}

describe("the Necromancer's skeletons (summons)", () => {
  it('more stand at once as the staff level grows, and each fights at a share of it', () => {
    expect(skeletonCap(tuning.specs.level)).toBe(1);
    expect(skeletonCap(24)).toBe(1);
    expect(skeletonCap(25)).toBe(2);
    expect(skeletonCap(40)).toBe(3);
    expect(skeletonCap(50)).toBe(3);
    expect(skeletonLevel(10)).toBe(6);
    expect(skeletonLevel(50)).toBe(30);
  });

  it('a skeleton is a sword henchman of its level at half a hero\'s health, fights on its own, and crumbles when its time is up', () => {
    const { host, me } = solo(30);
    const events: SimEvent[] = [];
    const s = raiseSkeleton(host.sim, world, me);
    events.push(...host.sim.events);
    expect(events.some((e) => e.kind === 'raised' && e.playerId === s.id && e.owner === me.id)).toBe(true);
    expect(s.henchman).toBe(true);
    expect(s.style).toBe('sword');
    expect(levelFor(s.xp.sword)).toBe(skeletonLevel(30));
    const hero = Math.round(tuning.combat.heroMaxHp + tuning.progression.healthPerLevel * (skeletonLevel(30) - 1));
    expect(s.maxHp).toBe(Math.round(hero * tuning.necro.skeletonHealth));
    // An enemy near: its brain closes on it.
    const e = createEnemy(host.sim, world, 'grunt', s.x, s.z - 6, 0);
    e.ai = 'chase';
    host.sim.enemies.push(e);
    const startD = Math.hypot(e.x - s.x, e.z - s.z);
    for (let i = 0; i < 30; i++) host.tick();
    expect(host.sim.players.includes(s)).toBe(true);
    expect(Math.hypot(e.x - s.x, e.z - s.z)).toBeLessThan(startD);
    host.sim.enemies = [];
    const ticks = Math.ceil(tuning.necro.skeletonLifeS * tuning.sim.tickRate) + 2;
    let crumbled = false;
    for (let i = 0; i < ticks; i++) crumbled ||= host.tick().some((ev) => ev.kind === 'crumbled' && ev.playerId === s.id);
    expect(crumbled).toBe(true);
    expect(host.sim.players.some((p) => p.id === s.id)).toBe(false);
  });

  it('at the cap the oldest crumbles to make room; a fallen one crumbles at once', () => {
    const { host, me } = solo(25);
    const a = raiseSkeleton(host.sim, world, me);
    const b = raiseSkeleton(host.sim, world, me);
    expect(summonsOf(host.sim, me.id)).toEqual([a, b]);
    const c = raiseSkeleton(host.sim, world, me);
    expect(summonsOf(host.sim, me.id)).toEqual([b, c]);
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    b.hp = 0;
    b.mode = 'down';
    // Straight to the step: the arena's antechamber would stand a downed hero up first.
    stepSummons(host.sim);
    expect(summonsOf(host.sim, me.id).map((p) => p.id)).toEqual([c.id]);
  });

  it('is not a seat: a hire and a friend still join, its Necromancer leaving takes it, and it never travels, banks or outlives a restart', () => {
    const { host, me } = solo(50);
    for (let i = 0; i < 3; i++) raiseSkeleton(host.sim, world, me);
    expect(partyOf(host.sim).length).toBe(1);
    expect(host.addHenchman(me, 'bow')).not.toBeNull();
    host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout: { name: 'f', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 } });
    expect(partyOf(host.sim).length).toBe(3);
    expect(summonsOf(host.sim, me.id).length).toBe(3);
    // Only the hire travels to the next room.
    const cards = host.takeHenchmen();
    expect(cards.map((c) => c.style)).toEqual(['bow']);
    expect(summonsOf(host.sim, me.id).length).toBe(3);
    // A restart leaves none behind.
    restartRun(host.sim, world);
    expect(host.sim.players.some((p) => p.summon)).toBe(false);
    // Raised again (by the restarted hero), and their Necromancer goes: they crumble with the next tick.
    raiseSkeleton(host.sim, world, host.sim.players.find((p) => p.id === me.id)!);
    host.sim.players = host.sim.players.filter((p) => p.id !== me.id);
    host.tick();
    expect(host.sim.players.some((p) => p.summon)).toBe(false);
  });
});
