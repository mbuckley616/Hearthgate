import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { PROTOCOL_VERSION } from '../net/protocol';
import { killEnemy } from './combat';
import { guardRoomOf } from './floorRun';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import type { EnemyState } from './types';

// E1i's twist, Pilfer (Michael's A, 19 Nov): a Goblin Cutter's cut snatches a share of the party's
// carried coin, the thief runs, and killing it drops the share back.

const kept = { ...tuning.pilfer };
afterEach(() => Object.assign(tuning.pilfer, kept));

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const spec: FloorSpec = { seed: 7, pieces: 20, floor: 2, floors: 3, type: 'goblinWarrens' };

function fightIn() {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const host = new HostSession(world, () => {}, true, () => {});
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const room = level.dungeon!.pieces[guardRoomOf(world)];
  const p = host.sim.players[0];
  const mid = openMiddle(room);
  Object.assign(p, { x: mid.x, z: mid.z, y: room.y, maxHp: 10000, hp: 10000 });
  for (let i = 0; i < Math.ceil((tuning.run.introMs / 1000) * 60) + 4; i++) host.tick();
  return host;
}

/** Tick until the first Cutter's cut lands, the rest of the room held off. */
function untilCut(host: HostSession): { thief: EnemyState; events: { kind: string }[] } {
  const p = host.sim.players[0];
  const thief = host.sim.enemies.find((e) => e.kind === 'cutter')!;
  const events: { kind: string }[] = [];
  for (let i = 0; i < 60 * 20; i++) {
    for (const e of host.sim.enemies) if (e !== thief && e.ai !== 'dead') Object.assign(e, { x: p.x + 40, z: p.z + 40, cooldown: 99, hasToken: false });
    host.tick();
    events.push(...host.sim.events);
    if (host.sim.events.some((ev) => ev.kind === 'heroHurt')) break;
  }
  return { thief, events };
}

describe('Pilfer, the Warrens’ twist (E1i)', () => {
  it('a cut snatches a share of the found coin, and the thief runs with it', () => {
    const host = fightIn();
    const f = host.sim.floor!;
    f.found.coin = 40;
    const { thief, events } = untilCut(host);
    const share = Math.round(40 * tuning.pilfer.share);
    expect(thief.sack).toBe(share);
    expect(f.found.coin).toBe(40 - share);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'pilfered', coin: share, enemyId: thief.id }));
    // A second cut on the same swing takes nothing more.
    const p = host.sim.players[0];
    const d0 = Math.hypot(thief.x - p.x, thief.z - p.z);
    let hurt = 0;
    for (let i = 0; i < 60 * 3; i++) {
      for (const e of host.sim.enemies) if (e !== thief && e.ai !== 'dead') Object.assign(e, { x: p.x + 40, z: p.z + 40, cooldown: 99, hasToken: false });
      host.tick();
      hurt += host.sim.events.filter((ev) => ev.kind === 'heroHurt').length;
    }
    expect(f.found.coin).toBe(40 - share);
    expect(Math.hypot(thief.x - p.x, thief.z - p.z)).toBeGreaterThan(d0 + 2);
    // It fights no more: at most the second slash of the string it was in.
    expect(hurt).toBeLessThanOrEqual(1);
    expect(thief.hasToken).toBe(false);
  });

  it('killing the thief spills the share back, and walking over it banks it again', () => {
    const host = fightIn();
    const f = host.sim.floor!;
    f.found.coin = 40;
    const { thief } = untilCut(host);
    const share = thief.sack!;
    killEnemy(host.sim, thief, 1);
    expect(thief.sack).toBeUndefined();
    const pile = f.loot!.find((d) => d.kind === 'coin' && d.amount === share)!;
    expect(pile).toBeDefined();
    expect(Math.hypot(pile.x - thief.x, pile.z - thief.z)).toBeLessThan(1e-6);
    const p = host.sim.players[0];
    for (let i = 0; i < 60 * 2; i++) {
      Object.assign(p, { x: pile.x, z: pile.z });
      for (const e of host.sim.enemies) if (e.ai !== 'dead') Object.assign(e, { x: p.x + 40, z: p.z + 40, cooldown: 99, hasToken: false });
      host.tick();
    }
    expect(f.found.coin).toBe(40);
  });

  it('takes nothing when there is no coin, or with the switch off, and the Cutter fights on', () => {
    for (const off of [false, true]) {
      tuning.pilfer.enabled = !off;
      const host = fightIn();
      const f = host.sim.floor!;
      f.found.coin = off ? 40 : 0;
      const { thief } = untilCut(host);
      expect(thief.sack).toBeUndefined();
      expect(f.found.coin).toBe(off ? 40 : 0);
    }
  });
});
