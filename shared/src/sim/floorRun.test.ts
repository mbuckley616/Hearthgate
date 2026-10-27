import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { PORTAL_HOLD_S, portalsFor, type PortalTo } from '../game/portal';
import { arena, buildWorld } from '../level/arena';
import { floorLevel, insidePiece, openMiddle, type PieceInfo } from '../level/floor';
import type { FloorSpec } from '../level/generate';
import { SIDE_DIR } from '../level/kit';
import { PROTOCOL_VERSION } from '../net/protocol';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type SimEvent } from './types';
import { createSimState } from './world';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

function floorSession(spec: FloorSpec) {
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const taken: PortalTo[] = [];
  const events: SimEvent[] = [];
  const host = new HostSession(world, () => {}, true, (to) => taken.push(to));
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout });
  const pieces = level.dungeon!.pieces;
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) events.push(...host.tick());
  };
  const put = (id: string, at: { x: number; z: number }, room: PieceInfo) => {
    const p = host.sim.players.find((pl) => pl.id === id)!;
    p.x = at.x;
    p.z = at.z;
    p.y = room.y;
  };
  return { level, world, host, pieces, taken, events, tick, put };
}

const killAll = (host: HostSession) => host.onMessage('a', { k: 'cheat', cheat: 'killAll' });
const alive = (host: HostSession) => host.sim.enemies.filter((e) => e.ai !== 'dead');

describe('a generated floor’s run (T4)', () => {
  const spec: FloorSpec = { seed: 202, pieces: 18, floor: 1, floors: 3 };

  it('shuts a fight room behind the party, spawns its group inside, and opens it once cleared', () => {
    const f = floorSession(spec);
    const room = f.pieces.find((p) => p.fight)!;
    const mid = openMiddle(room);
    f.put('p1', mid, room);
    f.put('p2', { x: mid.x + 1, z: mid.z }, room);
    f.tick(1);
    expect(f.host.sim.run.phase).toBe('intro');
    expect(f.host.sim.run.gateClosed).toBe(true);
    expect(f.host.sim.floor!.room).toBe(room.id);
    f.tick(Math.ceil((tuning.run.introMs / 1000) * 60) + 2);
    expect(f.host.sim.run.phase).toBe('wave');
    expect(alive(f.host).length).toBeGreaterThan(0);
    for (const e of alive(f.host)) {
      expect(insidePiece(room, e.x, e.z)).toBe(true);
      expect(e.y).toBeCloseTo(room.y, 5);
    }
    expect(f.events.some((ev) => ev.kind === 'waveStart' && ev.title === room.title)).toBe(true);

    // The doors are shut: a hero running out through one stays in.
    const door = room.doors.find((d) => d.open)!;
    const dir = SIDE_DIR[door.side];
    const p = f.host.sim.players[0];
    p.x = door.x - dir.x * 1.5;
    p.z = door.z - dir.z * 1.5;
    const world = { ...f.world, colliders: f.world.roomColliders![room.id] };
    for (let i = 0; i < 90; i++) stepPlayer(p, { ...idleCommand(), moveX: dir.x, moveZ: dir.z }, 1 / 60, world, f.host.sim);
    expect(insidePiece(room, p.x, p.z)).toBe(true);

    // Down to the reinforcements, then clear.
    for (let k = 0; k < 3 && f.host.sim.run.phase === 'wave'; k++) {
      killAll(f.host);
      f.tick(2);
    }
    expect(f.host.sim.run.phase).toBe('ante');
    expect(f.host.sim.run.gateClosed).toBe(false);
    expect(f.host.sim.floor!.cleared).toEqual([room.id]);
    expect(f.events.some((ev) => ev.kind === 'waveCleared')).toBe(true);
    // A cleared room never shuts again.
    f.tick(30);
    expect(f.host.sim.run.phase).toBe('ante');
  });

  it('waits for the party at the door, then brings the straggler in', () => {
    const f = floorSession(spec);
    const room = f.pieces.find((p) => p.fight)!;
    const entrance = f.pieces[f.level.dungeon!.def.entrance];
    f.put('p1', openMiddle(room), room);
    f.put('p2', openMiddle(entrance), entrance);
    f.tick(60);
    expect(f.host.sim.run.phase).toBe('ante');
    expect(f.host.sim.run.gateWait).toBeGreaterThan(0.9);
    f.tick(Math.ceil((tuning.run.gateWaitMs / 1000) * 60));
    expect(f.host.sim.run.phase).toBe('intro');
    for (const p of f.host.sim.players) expect(insidePiece(room, p.x, p.z)).toBe(true);
  });

  it('banks the party’s drops in the rest room, whose rings lead deeper or home', () => {
    const f = floorSession(spec);
    const rest = f.pieces[f.level.dungeon!.def.exit];
    expect(rest.kind).toBe('rest');
    f.host.sim.drops.push({ id: 999, owner: 'p1', x: 0, y: 0, z: 0, age: 0, item: { id: 'x', slot: 'weapon', rarity: 'common', name: 'x', perks: [] } as never });
    f.put('p1', openMiddle(rest), rest);
    f.put('p2', openMiddle(rest), rest);
    f.tick(1);
    expect(f.events.some((ev) => ev.kind === 'rested')).toBe(true);
    expect(f.events.some((ev) => ev.kind === 'pickup')).toBe(true);
    const rings = portalsFor(f.world, f.host.sim);
    expect(rings.map((r) => r.to)).toEqual(['deeper', 'village']);
    for (const r of rings) expect(insidePiece(rest, r.x, r.z, r.radius)).toBe(true);
    f.put('p1', rings[0], rest);
    f.put('p2', { x: rings[0].x + 0.5, z: rings[0].z }, rest);
    f.tick(PORTAL_HOLD_S * 60 + 2);
    expect(f.taken).toEqual(['deeper']);
  });

  it('ends the last floor at the Warden, with a ring home where it fell', () => {
    const f = floorSession({ ...spec, floor: 3 });
    const boss = f.pieces[f.level.dungeon!.def.exit];
    expect(boss.kind).toBe('boss');
    f.put('p1', openMiddle(boss), boss);
    f.put('p2', { x: openMiddle(boss).x, z: openMiddle(boss).z + 2 }, boss);
    f.tick(Math.ceil((tuning.run.introMs / 1000) * 60) + 4);
    expect(alive(f.host).map((e) => e.kind)).toEqual(['warden']);
    for (let k = 0; k < 4 && f.host.sim.run.phase === 'wave'; k++) {
      killAll(f.host);
      f.tick(2);
    }
    expect(f.host.sim.run.phase).toBe('won');
    const rings = portalsFor(f.world, f.host.sim);
    expect(rings).toHaveLength(1);
    expect(rings[0].to).toBe('village');
    expect(insidePiece(boss, rings[0].x, rings[0].z)).toBe(true);
  });

  it('ends the run where the party wipes, with a ring home in that room', () => {
    const f = floorSession(spec);
    const room = f.pieces.find((p) => p.fight)!;
    f.put('p1', openMiddle(room), room);
    f.put('p2', openMiddle(room), room);
    f.tick(Math.ceil((tuning.run.introMs / 1000) * 60) + 4);
    for (const p of f.host.sim.players) p.mode = 'down';
    f.tick(1);
    expect(f.host.sim.run.phase).toBe('lost');
    const [ring] = portalsFor(f.world, f.host.sim);
    expect(ring.to).toBe('village');
    expect(insidePiece(room, ring.x, ring.z)).toBe(true);
  });

  it('leaves the arena’s state as the slice’s: no floor in it', () => {
    const world = buildWorld(arena);
    const state = createSimState(arena, ['p1'], world);
    expect('floor' in state).toBe(false);
  });
});
