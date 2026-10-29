import { afterEach, describe, expect, it } from 'vitest';
import { enemyStats, tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { HostSession } from '../game/HostSession';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readLoadout } from '../net/validate';
import { championProblem, championXpFor, slotted, slottedUnlockAt, type ChampionRanks, type ChampionState, type SlottedId } from './champion';
import { damageEnemy, hurtHero, payCombo, type HitSpec } from './combat';
import { addPlayer, slotsOpen, stepRevives, type Loadout } from './coop';
import { stepDrops } from './drops';
import { createEnemy } from './enemies';
import { initialFloorRun } from './floorRun';
import { emptyMods, xpForLevel } from './gear';
import { emptyTalents } from './talents';
import { idleCommand, type EnemyState, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

const world = buildWorld(arena);
/** Enough in every constellation to open all nine. */
const FULL: ChampionRanks = { precision: 15, vitality: 10, toughness: 5, will: 5, lightstep: 5, stride: 5 };

const loadout = (name: string, slots?: SlottedId[], ranks: ChampionRanks = FULL): Loadout => ({
  name,
  xp: { sword: xpForLevel(50), bow: 0, staff: 0 },
  talents: emptyTalents(),
  mods: emptyMods(),
  maxHp: 100,
  champion: { xp: championXpFor(60), ranks, ...(slots ? { slots } : {}) },
});

function fight(...heroes: (SlottedId[] | undefined)[]): { s: SimState; ps: PlayerState[] } {
  const s = createSimState(arena, [], world);
  const ps = heroes.map((slots, i) => addPlayer(s, world, `p${i + 1}`, loadout(`p${i + 1}`, slots), false));
  for (const p of ps) p.invulnTime = 0;
  return { s, ps };
}

function grunt(s: SimState, x: number, z: number): EnemyState {
  const e = createEnemy(s, world, 'grunt', x, z, 0);
  // Placed exactly, wherever createEnemy found room.
  e.x = x;
  e.z = z;
  e.y = 0;
  e.ai = 'chase';
  e.hp = e.maxHp = 1000;
  e.poise = 1000;
  s.enemies.push(e);
  return e;
}

const hit = (attackerId: string, style: HitSpec['style'], over: Partial<HitSpec> = {}): HitSpec => ({
  attackerId,
  damage: 10,
  poise: 0,
  knockback: 0,
  heavy: false,
  dirX: 0,
  dirZ: 1,
  x: 0,
  y: 1,
  z: 0,
  style,
  ...over,
});

const kept = { ...tuning.champion };
afterEach(() => Object.assign(tuning.champion, kept));

describe('slotted perks (T6c)', () => {
  it('opens each in turn by the points spent in its constellation, and four at most', () => {
    expect([slottedUnlockAt('wideShatter'), slottedUnlockAt('teamwork'), slottedUnlockAt('deepWounds')]).toEqual([5, 10, 15]);
    const p = fight(['wideShatter', 'teamwork']).ps[0];
    p.champion!.ranks = { precision: 9 };
    expect(slotted(p, 'wideShatter')).toBe(true);
    expect(slotted(p, 'teamwork')).toBe(false);
    p.champion!.ranks = { precision: 7, heft: 3 };
    expect(slotted(p, 'teamwork')).toBe(true);
    // Unslotted, or a hero without champion points (the slice): nothing.
    expect(slotted(p, 'magnet')).toBe(false);
    expect(slotted(undefined, 'magnet')).toBe(false);

    const c = (slots: SlottedId[]): ChampionState => ({ xp: championXpFor(60), ranks: FULL, slots });
    expect(championProblem(c(['wideShatter', 'counterstep', 'longFuse', 'magnet']))).toBeNull();
    expect(championProblem(c(['wideShatter', 'counterstep', 'longFuse', 'magnet', 'bulwark']))).toMatch(/more slotted/);
    expect(championProblem(c(['magnet', 'magnet']))).toMatch(/twice/);
    // A locked one is kept (a respec on a floor must not refuse the loadout) but does nothing.
    expect(readLoadout(loadout('a', ['deepWounds'], {}))?.champion?.slots).toEqual(['deepWounds']);
    expect(readLoadout(loadout('a', ['flight' as SlottedId]))).toBeNull();
  });

  it('Wide shatter: the splash reaches twice as far', () => {
    const splash = (slots?: SlottedId[]) => {
      const { s, ps } = fight(slots);
      const e = grunt(s, 0, 0);
      const far = grunt(s, tuning.combos.shatterRadius + enemyStats('grunt').radius + 1, 0);
      e.shatterUntil = s.time + 1;
      damageEnemy(s, e, hit(ps[0].id, 'sword', { heavy: true }));
      return far.maxHp - far.hp;
    };
    expect(splash()).toBe(0);
    expect(splash(['wideShatter'])).toBeGreaterThan(0);
  });

  it('Teamwork: a payoff on an ally’s setup hits harder, one’s own does not', () => {
    const payoff = (slots: SlottedId[] | undefined, setter: 0 | 1) => {
      const { s, ps } = fight(undefined, slots);
      const e = grunt(s, 0, 0);
      damageEnemy(s, e, hit(ps[setter].id, 'staff', { slowTime: 1 }));
      const before = e.hp;
      damageEnemy(s, e, hit(ps[1].id, 'sword', { heavy: true }));
      return before - e.hp;
    };
    expect(payoff(['teamwork'], 0) / payoff(undefined, 0)).toBeCloseTo(1 + tuning.champion.teamworkBonus);
    expect(payoff(['teamwork'], 1)).toBeCloseTo(payoff(undefined, 1));
  });

  it('Deep wounds: a bleed lasts twice as long', () => {
    const ticks = (slots?: SlottedId[]) => {
      const { s, ps } = fight(slots);
      ps[0].mods.perks = ['bleed'];
      const e = grunt(s, 0, 0);
      damageEnemy(s, e, hit(ps[0].id, 'sword', { heavy: true }));
      return e.bleedTicks;
    };
    expect(ticks(['deepWounds'])).toBe(2 * ticks());
  });

  it('Counterstep gives back a dodge charge on a parry; Bulwark halves a block’s chip', () => {
    const guarded = (slots: SlottedId[] | undefined, parry: boolean) => {
      const { s, ps } = fight(slots);
      const p = ps[0];
      p.mode = 'guard';
      p.parryOpen = parry;
      p.guardTime = 0;
      p.dodgeCharges = 0;
      const result = hurtHero(s, p, { damage: 20, fromX: p.x + Math.sin(p.yaw) * 2, fromZ: p.z + Math.cos(p.yaw) * 2 });
      return { result, charges: p.dodgeCharges, lost: p.maxHp - p.hp };
    };
    expect(guarded(undefined, true)).toMatchObject({ result: 'parried', charges: 0 });
    expect(guarded(['counterstep'], true)).toMatchObject({ result: 'parried', charges: 1 });
    expect(guarded(['bulwark'], false).lost).toBeCloseTo(guarded(undefined, false).lost * tuning.champion.bulwarkChipMult);
  });

  it('Lifeline: a friend gets up with twice the health', () => {
    const revivedHp = (slots?: SlottedId[]) => {
      const { s, ps } = fight(slots, undefined);
      const [helper, down] = ps;
      down.mode = 'down';
      down.hp = 0;
      down.x = helper.x + 0.5;
      down.z = helper.z;
      down.y = helper.y;
      for (let t = 0; down.mode === 'down' && t < 600; t++) stepRevives(s, { [helper.id]: { ...idleCommand(), interact: true } }, 1 / 60);
      return down.hp / down.maxHp;
    };
    expect(revivedHp()).toBeCloseTo(tuning.coop.reviveHpFrac);
    expect(revivedHp(['lifeline'])).toBeCloseTo(tuning.coop.reviveHpFrac * 2);
  });

  it('Long fuse keeps the setter’s combos open longer; Momentum cuts cooldowns on a payoff', () => {
    const window = (slots?: SlottedId[]) => {
      const { s, ps } = fight(slots);
      const e = grunt(s, 0, 0);
      damageEnemy(s, e, hit(ps[0].id, 'staff', { slowTime: 1 }));
      return e.shatterUntil - s.time;
    };
    expect(window(['longFuse'])).toBeCloseTo(window() * tuning.champion.longFuseWindowMult);

    const { s, ps } = fight(['momentum'], undefined);
    for (const p of ps) p.cooldowns = { sword: [5, 1], bow: [3, 0], staff: [0, 8] };
    payCombo(s, 'detonate', ps[0].id, 0, 0, 0);
    payCombo(s, 'detonate', ps[1].id, 0, 0, 0);
    expect(ps[0].cooldowns).toEqual({ sword: [3, 0], bow: [1, 0], staff: [0, 6] });
    expect(ps[1].cooldowns).toEqual({ sword: [5, 1], bow: [3, 0], staff: [0, 8] });
  });

  it('Magnet: drops come from twice as far', () => {
    const picked = (slots?: SlottedId[]) => {
      const { s, ps } = fight(slots);
      const p = ps[0];
      s.drops.push({ id: 99, owner: p.id, x: p.x + tuning.gear.pickupRadius * 1.5, y: p.y, z: p.z, age: 1, item: {} as never });
      stepDrops(s, 1 / 60);
      return s.drops.length === 0;
    };
    expect(picked()).toBe(false);
    expect(picked(['magnet'])).toBe(true);
  });

  it('changes slots only where the plan allows: the village, a rest room, the antechamber', () => {
    const { s } = fight();
    expect(slotsOpen(s, true)).toBe(true);
    s.run.phase = 'ante';
    expect(slotsOpen(s, false)).toBe(true);
    s.run.phase = 'wave';
    expect(slotsOpen(s, false)).toBe(false);
    s.floor = { ...initialFloorRun(), room: 3, fights: 1 };
    expect(slotsOpen(s, false)).toBe(false);
    s.floor.rested = true;
    expect(slotsOpen(s, false)).toBe(true);

    const host = new HostSession(world, () => {});
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('a', ['magnet']) });
    const p = host.sim.players[0];
    host.sim.run.phase = 'wave';
    host.onMessage('a', { k: 'loadout', loadout: loadout('a', ['counterstep'], { ...FULL, precision: 14 }) });
    // Mid-fight the ranks move but the slots stay; back in the antechamber they change.
    expect(p.champion).toMatchObject({ ranks: { precision: 14 }, slots: ['magnet'] });
    host.sim.run.phase = 'ante';
    host.onMessage('a', { k: 'loadout', loadout: loadout('a', ['counterstep']) });
    expect(p.champion?.slots).toEqual(['counterstep']);
  });
});
