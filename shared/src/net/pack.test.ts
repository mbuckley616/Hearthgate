import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { arena, buildWorld, type World } from '../level/arena';
import { floorLevel } from '../level/floor';
import { createEnemy } from '../sim/enemies';
import { emptyMods } from '../sim/gear';
import { stepPlayer } from '../sim/player';
import { emptyTalents } from '../sim/talents';
import { idleCommand, type PlayerCommand, type SimState } from '../sim/types';
import { worldNow } from '../sim/world';
import { fromWire, packState, toWire, unpackState } from './pack';
import { PROTOCOL_VERSION, type ToPeer } from './protocol';

// Snapshots travel as rows (pack.ts). The browser must rebuild exactly the SimState the server
// stepped, every field the views and prediction read and every other, or prediction would replay
// against a different world than the server's and correct for nothing.

type Snap = Extract<ToPeer, { k: 'snap' }>;
const loadout = (name: string) => ({ name, xp: { sword: 4000, bow: 900, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 });
const KINDS: EnemyKind[] = ['grunt', 'archer', 'brute', 'shieldbearer', 'hound', 'priest', 'knight', 'wraith'];

/** A small LCG for the test's own button mashing, apart from the sim's rng. */
function presses(seed: number): () => PlayerCommand {
  let r = seed;
  const next = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return () => {
    const a = next() * Math.PI * 2;
    const m = next();
    return { ...idleCommand(), moveX: Math.sin(a) * m, moveZ: Math.cos(a) * m, attack: next() < 0.2, attackHeld: next() < 0.3, dodge: next() < 0.03, jump: next() < 0.03, block: next() < 0.1, ability1: next() < 0.02, ability2: next() < 0.02, sprint: next() < 0.3, swapTo: next() < 0.01 ? 'bow' : null };
  };
}

/** A crowded fight: two players, two henchmen, a ring of every kind of enemy; every snapshot it sends. */
function crowd(world: World, enemies: number, ticks: number): { host: HostSession; snaps: Snap[] } {
  const snaps: Snap[] = [];
  const host = new HostSession(world, (m) => (m.k === 'snap' ? snaps.push(m) : undefined), true);
  host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('Alpha') });
  host.onMessage('b', { k: 'hello', version: PROTOCOL_VERSION, loadout: loadout('Bravo') });
  host.onMessage('a', { k: 'cheat', cheat: 'henchman' });
  host.onMessage('a', { k: 'cheat', cheat: 'henchman' });
  const me = host.sim.players[0];
  for (let i = 0; i < enemies; i++) {
    const a = (i / enemies) * Math.PI * 4;
    createEnemy(host.sim, world, KINDS[i % KINDS.length], me.x + Math.sin(a) * (4 + (i % 4) * 2), me.z + Math.cos(a) * (4 + (i % 4) * 2), a);
  }
  const pa = presses(7);
  const pb = presses(11);
  for (let t = 1; t <= ticks; t++) {
    host.onMessage('a', { k: 'input', cmds: [{ seq: t, cmd: pa() }] });
    host.onMessage('b', { k: 'input', cmds: [{ seq: t, cmd: pb() }] });
    host.tick();
  }
  return { host, snaps };
}

/** What a snapshot is once it has crossed as JSON would carry it (msgpack carries no less). */
const carried = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('snapshots as rows', () => {
  const arenaWorld = buildWorld(arena);

  it('rebuilds every snapshot of a crowded arena fight exactly', () => {
    const { snaps } = crowd(arenaWorld, 40, 900);
    expect(snaps.length).toBeGreaterThan(400);
    let hits = 0;
    for (const m of snaps) {
      const back = fromWire(carried(toWire(m))) as Snap;
      expect(back).toEqual(carried(m));
      hits += m.ev.filter((e) => e.kind === 'hit').length;
    }
    // The fight got somewhere: blows landed, shots flew, telegraphs were up.
    expect(hits).toBeGreaterThan(0);
    expect(snaps[snaps.length - 1].s.enemies.some((e) => e.hp < e.maxHp)).toBe(true);
    expect(snaps.some((m) => m.s.projectiles.length > 0)).toBe(true);
    expect(snaps.some((m) => m.s.enemies.some((e) => e.tele.shape !== 'none'))).toBe(true);
  });

  it('rebuilds a haunted, harder generated floor exactly, its optional fields included', () => {
    const world = buildWorld(floorLevel({ seed: 31, pieces: 14, floor: 1, floors: 3, difficulty: 3, modifier: 'haunted' }));
    const { host, snaps } = crowd(world, 24, 900);
    const e = host.sim.enemies.find((x) => x.ai !== 'dead');
    if (e) {
      e.named = 'The Test';
      e.crown = { d: 1.5, length: 9, back: false, struck: ['p1'] };
      e.armour = 0.4;
    }
    host.sim.players[0].queuedSwap = 'staff';
    host.sim.players[1].ward = { hits: 2, until: 30 };
    const s: SimState = { ...host.sim, events: [] };
    expect(unpackState(carried(packState(s)))).toEqual(carried(s));
    expect(s.floor).toBeDefined();
    expect(s.enemies.some((x) => x.hitMult !== undefined)).toBe(true);
    expect(s.players.some((p) => p.brain)).toBe(true);
    for (const m of snaps) expect(fromWire(carried(toWire(m)))).toEqual(carried(m));
  });

  it('keeps a null where the resting value is something else, and an absent optional field absent', () => {
    const { host } = crowd(arenaWorld, 4, 30);
    const s: SimState = { ...host.sim, events: [] };
    (s.enemies[0] as unknown as Record<string, unknown>).attack = null;
    const back = unpackState(carried(packState(s)));
    expect(back.enemies[0].attack).toBeNull();
    expect('risen' in back.enemies[1]).toBe(false);
    expect(back).toEqual(carried(s));
  });

  it('gives each row its own resting values, so changing one enemy leaves the next alone', () => {
    const { host } = crowd(arenaWorld, 6, 1);
    const back = unpackState(packState({ ...host.sim, events: [] }));
    back.enemies[0].tele.radius = 3;
    expect(back.enemies[1].tele.radius).toBe(0);
  });

  it('predicts the same hero from the rebuilt snapshot as from the server state', () => {
    const { host } = crowd(arenaWorld, 30, 240);
    const a = carried({ ...host.sim, events: [] });
    const b = unpackState(carried(packState({ ...host.sim, events: [] })));
    const cmds = presses(3);
    for (let i = 0; i < 120; i++) {
      const c = cmds();
      for (const s of [a, b]) {
        s.events = [];
        stepPlayer(s.players[0], c, 1 / tuning.sim.tickRate, worldNow(arenaWorld, s), s);
      }
      expect(b.players[0]).toEqual(a.players[0]);
    }
    expect(b.enemies).toEqual(a.enemies);
  });

  it('carries a crowd in well under half the bytes', () => {
    const { snaps } = crowd(arenaWorld, 55, 120);
    const last = snaps[snaps.length - 1];
    const keyed = JSON.stringify(last.s).length;
    const rows = JSON.stringify(packState(last.s)).length;
    expect(rows).toBeLessThan(keyed * 0.5);
  });
});
