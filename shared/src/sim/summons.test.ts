import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { arena, buildWorld } from '../level/arena';
import { PROTOCOL_VERSION } from '../net/protocol';
import { createEnemy } from './enemies';
import { emptyMods, levelFor, xpForLevel } from './gear';
import { addPlayer } from './coop';
import { stepPlayer } from './player';
import { restartRun } from './run';
import { specCrescendo, specInfo, specProblem, specsFor, treeProblem } from './specs';
import { readLoadout } from '../net/validate';
import { partyOf, raiseSkeleton, skeletonCap, skeletonLevel, stepSummons, summonsOf } from './summons';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand, type SimEvent } from './types';
import { createSimState, stepSim } from './world';

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
    stepSummons(host.sim, world);
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

describe("the Necromancer's Grave Call and Bone Step", () => {
  const DT = 1 / 60;
  /** A staff hero at level 25 (two skeletons), a Necromancer or not, facing a grunt 4 m off. */
  function scene(spec: 'necromancer' | 'warlock' | undefined) {
    const s = createSimState(arena, [], world);
    const p = addPlayer(s, world, 'p1', { name: 'n', xp: { sword: 0, bow: 0, staff: xpForLevel(25) }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 }, false);
    Object.assign(p, { x: 0, z: 10, yaw: Math.PI, style: 'staff', mode: 'move', invulnTime: 0, ...(spec ? { spec: { staff: spec } } : {}) });
    const e = createEnemy(s, world, 'grunt', 0, 6, 0);
    Object.assign(e, { x: 0, z: 6, ai: 'chase', aiTime: 0, cooldown: 0, hp: 9999 });
    s.enemies.push(e);
    return { s, p, e };
  }
  /** Press a slot once and step the server's sim for 40 ticks; the events of every tick. */
  function press(sc: ReturnType<typeof scene>, slot: 'ability1' | 'ability2', moveZ = 0): SimEvent[] {
    const events: SimEvent[] = [];
    for (let i = 0; i < 40; i++) {
      const cmd: PlayerCommand = { ...idleCommand(), [slot]: i === 0, moveZ: i === 0 ? moveZ : 0 };
      stepSim(sc.s, { p1: cmd }, DT, world);
      events.push(...sc.s.events);
    }
    return events;
  }

  it('is the fourth staff specialization, Shadow, offered from staff level 10 and taken by the server with its tree', () => {
    expect(specsFor('staff').filter((x) => x.built).map((x) => x.id)).toContain('necromancer');
    expect(specInfo('necromancer').element).toBe('shadow');
    const at = (l: number) => ({ sword: 0, bow: 0, staff: xpForLevel(l) });
    expect(specProblem(at(tuning.specs.level), { staff: 'necromancer' })).toBeNull();
    expect(specProblem(at(tuning.specs.level - 1), { staff: 'necromancer' })).not.toBeNull();
    expect(specProblem(at(tuning.specs.level), { sword: 'necromancer' })).not.toBeNull();
    const l = { name: 'n', xp: at(30), talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
    const read = readLoadout({ ...l, spec: { staff: 'necromancer' }, tree: { staff: ['thick-bones', 'grasping-dead'] } });
    expect(read?.spec).toEqual({ staff: 'necromancer' });
    expect(read?.tree).toEqual({ staff: ['thick-bones', 'grasping-dead'] });
    expect(readLoadout({ ...l, spec: { staff: 'necromancer' }, elements: { staff: 'fire' } })).toBeNull();
    expect(readLoadout({ ...l, spec: { staff: 'necromancer' }, tree: { staff: ['marrow'] } })).toBeNull();
  });

  it("Grave Call: the ring hits in shadow, freezes nothing, and raises a skeleton a step ahead", () => {
    const sc = scene('necromancer');
    const events = press(sc, 'ability1');
    const ring = events.find((x) => x.kind === 'frostRing');
    expect(ring && ring.kind === 'frostRing' && ring.element).toBe('shadow');
    expect(sc.e.hp).toBeLessThan(9999);
    expect(sc.e.frozen).toBe(0);
    const mine = summonsOf(sc.s, 'p1');
    expect(mine.length).toBe(1);
    expect(events.some((x) => x.kind === 'raised' && x.owner === 'p1')).toBe(true);
    expect(sc.p.raise).toBeUndefined();
  });

  it('Bone Step: a Blink raises a skeleton where the Necromancer stood', () => {
    const sc = scene('necromancer');
    sc.s.enemies = [];
    const from = { x: sc.p.x, z: sc.p.z };
    const events = press(sc, 'ability2', -1);
    expect(events.some((x) => x.kind === 'blink')).toBe(true);
    expect(Math.hypot(sc.p.x - from.x, sc.p.z - from.z)).toBeGreaterThan(2);
    const raised = events.find((x) => x.kind === 'raised');
    expect(raised && raised.kind === 'raised' && Math.hypot(raised.x - from.x, raised.z - from.z)).toBeLessThan(0.01);
  });

  it("a Warlock's ring and Blink raise nothing, and the Necromancer's prediction only asks", () => {
    const w = scene('warlock');
    press(w, 'ability1');
    expect(summonsOf(w.s, 'p1').length).toBe(0);
    // Prediction steps only the hero (stepPlayer): it asks, and no skeleton joins its world.
    const sc = scene('necromancer');
    for (let i = 0; i < 40; i++) {
      stepPlayer(sc.p, { ...idleCommand(), ability1: i === 0 }, DT, world, sc.s);
      sc.s.time += DT;
    }
    expect(sc.p.raise?.length).toBe(1);
    expect(summonsOf(sc.s, 'p1').length).toBe(0);
  });
});

describe("the Necromancer's tree and Crescendo", () => {
  /** A Necromancer at a staff level with these tree picks, alone in the arena (a HostSession, so its ticks are the server's). */
  function necro(level: number, tree: string[]) {
    const { host, me } = solo(level);
    Object.assign(me, { spec: { staff: 'necromancer' }, tree: { staff: tree } });
    return { host, me };
  }

  it('three rows of two, each opened at its level', () => {
    const xp = (l: number) => ({ sword: 0, bow: 0, staff: xpForLevel(l) });
    expect(treeProblem(xp(40), { staff: 'necromancer' }, { staff: ['long-dead', 'grasping-dead', 'corpse-burst'] })).toBeNull();
    expect(treeProblem(xp(39), { staff: 'necromancer' }, { staff: ['marrow'] })).not.toBeNull();
    expect(treeProblem(xp(40), { staff: 'necromancer' }, { staff: ['long-dead', 'thick-bones'] })).not.toBeNull();
    expect(specInfo('necromancer').crescendo?.[0]).toBe('Army of the Dead');
  });

  it('Long Dead, Thick Bones and Marrow: longer, sturdier, at the full staff level', () => {
    const plain = necro(40, []);
    const a = raiseSkeleton(plain.host.sim, world, plain.me);
    const tree = necro(40, ['long-dead', 'restless-dead', 'marrow']);
    const b = raiseSkeleton(tree.host.sim, world, tree.me);
    expect(a.summon!.until - plain.host.sim.time).toBeCloseTo(tuning.necro.skeletonLifeS);
    expect(b.summon!.until - tree.host.sim.time).toBeCloseTo(tuning.necro.treeLongLifeS);
    expect(levelFor(a.xp.sword)).toBe(skeletonLevel(40));
    expect(levelFor(b.xp.sword)).toBe(40);
    const thick = necro(40, ['thick-bones']);
    const c = raiseSkeleton(thick.host.sim, world, thick.me);
    expect(c.maxHp).toBe(Math.round((a.maxHp / tuning.necro.skeletonHealth) * tuning.necro.skeletonHealth * tuning.necro.treeThickBonesMult));
  });

  it('Restless Dead lets one more stand', () => {
    const { host, me } = necro(25, ['long-dead', 'restless-dead']);
    expect(skeletonCap(25, me)).toBe(3);
    for (let i = 0; i < 4; i++) raiseSkeleton(host.sim, world, me);
    expect(summonsOf(host.sim, me.id).length).toBe(3);
  });

  it('Grasping Dead: Grave Call raises two', () => {
    const { host, me } = necro(25, ['long-dead', 'grasping-dead']);
    for (let i = 0; i < 40; i++) {
      stepSim(host.sim, { [me.id]: { ...idleCommand(), ability1: i === 0 } }, 1 / 60, world);
    }
    expect(summonsOf(host.sim, me.id).length).toBe(2);
  });

  it('Corpse Burst: a crumbling skeleton hits the enemies near it, not one 5 m off', () => {
    const { host, me } = necro(40, ['long-dead', 'grasping-dead', 'corpse-burst']);
    me.x = 0;
    me.z = 14;
    const s = raiseSkeleton(host.sim, world, me, 0, 0);
    const near = createEnemy(host.sim, world, 'grunt', 1.5, 0, 0);
    const far = createEnemy(host.sim, world, 'grunt', 5, 0, 0);
    for (const e of [near, far]) Object.assign(e, { hp: 9999, ai: 'idle' });
    host.sim.enemies.push(near, far);
    s.summon!.until = host.sim.time;
    stepSummons(host.sim, world);
    expect(near.hp).toBeLessThan(9999);
    expect(far.hp).toBe(9999);
    // Without the node, a crumble hurts nothing.
    const plain = necro(40, []);
    const t = raiseSkeleton(plain.host.sim, world, plain.me, 0, 0);
    const e = createEnemy(plain.host.sim, world, 'grunt', 1.5, 0, 0);
    Object.assign(e, { hp: 9999, ai: 'idle' });
    plain.host.sim.enemies.push(e);
    t.summon!.until = plain.host.sim.time;
    stepSummons(plain.host.sim, world);
    expect(e.hp).toBe(9999);
  });

  it('Army of the Dead: a Crescendo raises as many as may stand, in a ring', () => {
    const { host, me } = necro(50, []);
    raiseSkeleton(host.sim, world, me);
    specCrescendo(host.sim, me);
    expect(me.raise?.length).toBe(skeletonCap(50));
    stepSummons(host.sim, world);
    const mine = summonsOf(host.sim, me.id);
    expect(mine.length).toBe(skeletonCap(50));
    for (const k of mine) expect(Math.hypot(k.x - me.x, k.z - me.z)).toBeCloseTo(1.6, 1);
  });
});
