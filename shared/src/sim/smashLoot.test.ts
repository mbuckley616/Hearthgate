import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle, type PropInfo } from '../level/floor';
import { PROTOCOL_VERSION } from '../net/protocol';
import { addPlayer, type Loadout } from './coop';
import { smashCircle, stepLoot } from './smash';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand, type SimEvent, type SimState } from './types';
import { createSimState, stepSim } from './world';

// These pin P1's rest-room bank and D7's full heal, kept behind loop.bankAtRest and dungeon.restHeal;
// Michael's 31 Oct A (no heal, banking only at home or a win) is restRoomStakes.test.ts.
const restKept = { bankAtRest: tuning.loop.bankAtRest, restHeal: tuning.dungeon.restHeal };
beforeEach(() => {
  tuning.loop.bankAtRest = true;
  tuning.dungeon.restHeal = 1;
});
afterAll(() => {
  tuning.loop.bankAtRest = restKept.bankAtRest;
  tuning.dungeon.restHeal = restKept.restHeal;
});

/** Lumber, stone and coin as drops (Michael, 29 Oct): a smashed prop sprays them, a player walks over them. */

const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const spec = { seed: 202, pieces: 18, floor: 1, floors: 3 };
const level = floorLevel(spec);
const world = buildWorld(level);
const DT = 1 / 60;
const kept = { ...tuning.loop, enemies: tuning.debug.enemiesEnabled };

afterEach(() => {
  tuning.loop.smashCoinChance = kept.smashCoinChance;
  tuning.loop.potionChance = kept.potionChance;
  tuning.debug.enemiesEnabled = kept.enemies;
});

const crate = () => level.dungeon!.props.find((pr) => pr.kind !== 'urn' && level.dungeon!.pieces[pr.piece].fight)!;

/** A hero facing the prop from the room's side, `dist` m off, in a fresh state with no enemies. */
function beside(pr: PropInfo, dist: number) {
  tuning.debug.enemiesEnabled = false;
  const s = createSimState(level, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  const ax = Math.sin(pr.inward);
  const az = Math.cos(pr.inward);
  p.x = pr.x + ax * dist;
  p.z = pr.z + az * dist;
  p.y = pr.y;
  p.yaw = Math.atan2(-ax, -az);
  p.style = 'sword';
  const cmd: PlayerCommand = { ...idleCommand(), aimX: -ax, aimZ: -az };
  return { s, p, cmd };
}

/** Smash it with one swing and let the spray settle, the hero stepped well away first. */
function smashAndSettle(pr: PropInfo): { s: SimState; events: SimEvent[]; p: ReturnType<typeof beside>['p'] } {
  const { s, p, cmd } = beside(pr, 1.2);
  const events: SimEvent[] = [];
  stepSim(s, { p1: { ...cmd, attack: true } }, DT, world);
  events.push(...s.events);
  for (let i = 0; i < 20 && s.floor!.broken.length === 0; i++) {
    stepSim(s, { p1: cmd }, DT, world);
    events.push(...s.events);
  }
  p.x = pr.x + Math.sin(pr.inward) * 5;
  p.z = pr.z + Math.cos(pr.inward) * 5;
  for (let i = 0; i < 40; i++) {
    stepSim(s, { p1: idleCommand() }, DT, world);
    events.push(...s.events);
  }
  return { s, events, p };
}

describe('lumber, stone and coin as drops', () => {
  it('spray out of a smashed crate the same way in every run, inside the room and within the spray', () => {
    tuning.loop.smashCoinChance = 1;
    const pr = crate();
    const a = smashAndSettle(pr).s.floor!.loot!;
    const b = smashAndSettle(pr).s.floor!.loot!;
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(a.some((d) => d.kind === 'lumber')).toBe(true);
    expect(a.some((d) => d.kind === 'coin')).toBe(true);
    const coin = a.filter((d) => d.kind === 'coin').reduce((n, d) => n + d.amount, 0);
    expect(coin).toBeGreaterThanOrEqual(tuning.loop.smashCoinMin);
    expect(coin).toBeLessThanOrEqual(tuning.loop.smashCoinMax);
    expect(new Set(a.map((d) => d.id)).size).toBe(a.length);
    for (const d of a) {
      expect(Math.hypot(d.x - pr.x, d.z - pr.z)).toBeLessThanOrEqual(tuning.loop.smashSpray + 1e-9);
      expect(d.x).toBeGreaterThan(pr.room.minX);
      expect(d.x).toBeLessThan(pr.room.maxX);
      expect(d.z).toBeGreaterThan(pr.room.minZ);
      expect(d.z).toBeLessThan(pr.room.maxZ);
      // Out into the room, never back at the wall it stood against.
      expect((d.x - pr.x) * Math.sin(pr.inward) + (d.z - pr.z) * Math.cos(pr.inward)).toBeGreaterThan(0);
    }
  });

  it('are not every crate the same: the amounts are random from the sim\'s dice', () => {
    tuning.loop.smashCoinChance = 0.5;
    const { s } = beside(crate(), 3);
    const props = level.dungeon!.props;
    smashCircle(s, props, 'p1', 0, props[0].y, 0, 1e4);
    const totals = new Set<string>();
    for (const pr of props.filter((x) => x.kind !== 'urn')) {
      const mine = s.floor!.loot!.filter((d) => d.id >> 3 === pr.id);
      totals.add(['lumber', 'coin'].map((k) => mine.filter((d) => d.kind === k).reduce((n, d) => n + d.amount, 0)).join('/'));
    }
    expect(totals.size).toBeGreaterThan(3);
  });

  it('wait to land, then go to the player who walks over them, into the party\'s found tally', () => {
    tuning.loop.smashCoinChance = 1;
    const pr = crate();
    const { s, p, cmd } = beside(pr, 1.2);
    stepSim(s, { p1: { ...cmd, attack: true } }, DT, world);
    for (let i = 0; i < 20 && s.floor!.broken.length === 0; i++) stepSim(s, { p1: cmd }, DT, world);
    const loot = [...s.floor!.loot!];
    const first = loot[0];
    // Still in the air: standing on it takes nothing.
    p.x = first.x;
    p.z = first.z;
    stepSim(s, { p1: idleCommand() }, DT, world);
    expect(s.floor!.loot!.some((d) => d.id === first.id)).toBe(true);
    for (let i = 0; i < 40; i++) stepSim(s, { p1: idleCommand() }, DT, world);
    expect(s.floor!.loot!.some((d) => d.id === first.id)).toBe(false);
    // Walk over every piece: the found tally is the spray's whole.
    const events: SimEvent[] = [];
    for (const d of loot) {
      p.x = d.x;
      p.z = d.z;
      stepSim(s, { p1: idleCommand() }, DT, world);
      events.push(...s.events);
    }
    expect(s.floor!.loot).toEqual([]);
    const sum = (k: string) => loot.filter((d) => d.kind === k).reduce((n, d) => n + d.amount, 0);
    expect(s.floor!.found).toEqual({ lumber: sum('lumber'), stone: sum('stone'), coin: sum('coin') });
    expect(events.filter((e) => e.kind === 'lootTaken').length).toBeGreaterThan(0);
  });

  it('are passed by a henchman and a downed player', () => {
    const pr = crate();
    const { s, p } = smashAndSettle(pr);
    const d = s.floor!.loot![0];
    p.x = d.x;
    p.z = d.z;
    p.henchman = true;
    stepSim(s, { p1: idleCommand() }, DT, world);
    expect(s.floor!.loot![0].id).toBe(d.id);
    delete p.henchman;
    // Outside a fight a down does not last a tick, so the step alone.
    p.mode = 'down';
    stepLoot(s);
    expect(s.floor!.loot!.some((x) => x.id === d.id)).toBe(true);
  });

  const onFloor = () => {
    const host = new HostSession(buildWorld(floorLevel(spec)), () => {});
    host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
    host.tick();
    const f = host.sim.floor!;
    f.found = { lumber: 0, stone: 0, coin: 0 };
    f.loot = [{ id: 0, kind: 'coin', amount: 7, x: 0, y: 0, z: 0, fromX: 0, fromZ: 0, at: 0 }, { id: 1, kind: 'lumber', amount: 1, x: 0, y: 0, z: 0, fromX: 0, fromZ: 0, at: 0 }];
    return host;
  };

  it('still on the ground at the rest room: the coin goes home with the party, the lumber nobody carried stays', () => {
    const plainHost = onFloor();
    plainHost.sim.floor!.loot = [];
    const host = onFloor();
    const bank = (h: HostSession) => {
      const p = h.sim.players[0];
      const rest = level.dungeon!.pieces[level.dungeon!.def.exit];
      const at = openMiddle(rest);
      p.x = at.x;
      p.z = at.z;
      p.y = rest.y;
      const events: SimEvent[] = [];
      for (let i = 0; i < 3; i++) events.push(...h.tick());
      return events.find((e) => e.kind === 'banked');
    };
    const plain = bank(plainHost);
    const more = bank(host);
    if (plain?.kind !== 'banked' || more?.kind !== 'banked') throw new Error('no bank');
    expect(more.coin - plain.coin).toBe(7);
    // Lumber and stone go home only in a bag (Michael, 31 Oct, A on materials in the bag).
    expect(more.lumber - plain.lumber).toBe(0);
    expect(host.sim.floor!.loot).toEqual([]);
  });

  it('are lost with a wipe, on the ground and picked up alike', () => {
    const host = onFloor();
    host.sim.floor!.found = { lumber: 2, stone: 1, coin: 5 };
    const p = host.sim.players[0];
    host.sim.run.phase = 'wave';
    host.sim.floor!.room = level.dungeon!.pieces.find((pc) => pc.fight)!.id;
    p.hp = 0;
    p.mode = 'down';
    const events: SimEvent[] = [];
    for (let i = 0; i < 3; i++) events.push(...host.tick());
    expect(events.some((e) => e.kind === 'banked')).toBe(false);
    expect(host.sim.floor!.found).toEqual({ lumber: 0, stone: 0, coin: 0 });
    expect(host.sim.floor!.loot).toEqual([]);
  });
});
