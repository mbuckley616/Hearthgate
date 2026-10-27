import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import { hurtHero } from './combat';
import { addPlayer } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand, type SimEvent, type SimState } from './types';
import { createSimState, stepSim } from './world';

const loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const world = buildWorld(arena);

/** Two heroes in the arena mid-wave, with one enemy frozen far off so the wave never clears by itself. */
function fight(): { s: SimState; events: SimEvent[]; step: (n: number, cmds?: Record<string, PlayerCommand>) => void } {
  const s = createSimState(arena, [], world);
  addPlayer(s, world, 'p1', loadout, true);
  addPlayer(s, world, 'p2', loadout, true);
  for (const [i, p] of s.players.entries()) {
    p.x = -2 + i * 4;
    p.z = 4;
    p.invulnTime = 0;
  }
  s.run.phase = 'wave';
  s.run.wave = 1;
  s.run.gateClosed = true;
  const e = createEnemy(s, world, 'grunt', 12, -8, 0);
  e.frozen = 1e9;
  s.run.waveSize = 1;
  s.run.reinforced = true;
  const events: SimEvent[] = [];
  const step = (n: number, cmds: Record<string, PlayerCommand> = {}) => {
    for (let i = 0; i < n; i++) {
      stepSim(s, cmds, 1 / 60, world);
      events.push(...s.events);
    }
  };
  return { s, events, step };
}

/** A blow that takes the hero down at once. */
function downHero(s: SimState, id: string): void {
  const p = s.players.find((pl) => pl.id === id)!;
  // Past the remote player's lag grace already, so it lands now.
  hurtHero(s, p, { damage: 1e6, fromX: p.x + 1, fromZ: p.z, late: true });
}

const hold = (over: Partial<PlayerCommand>): PlayerCommand => ({ ...idleCommand(), ...over });

describe('Hearthgate’s downs (T5, decision 5A)', () => {
  afterEach(() => {
    tuning.coop.bleedOut = true;
  });

  it('gives each hero a Revive Draught for the floor', () => {
    const { s } = fight();
    for (const p of s.players) expect(p.draughts).toBe(tuning.coop.draughtsPerFloor);
  });

  it('downs a hero who then crawls, slowly, and cannot fight', () => {
    const { s, step } = fight();
    downHero(s, 'p1');
    const p = s.players[0];
    expect(p.mode).toBe('down');
    expect(p.bleed).toBeCloseTo(tuning.coop.bleedOutMs / 1000, 5);
    const x0 = p.x;
    step(60, { p1: hold({ moveX: 1, attack: true }) });
    expect(p.mode).toBe('down');
    expect(p.x - x0).toBeGreaterThan(tuning.coop.crawlSpeed * 0.8);
    expect(p.x - x0).toBeLessThan(tuning.coop.crawlSpeed * 1.2);
  });

  it('bleeds out after the bleed-out time: out of the fight, lying still', () => {
    const { s, events, step } = fight();
    downHero(s, 'p1');
    step(Math.ceil((tuning.coop.bleedOutMs / 1000) * 60) + 2);
    const p = s.players[0];
    expect(p.bleed).toBe(0);
    expect(events.some((e) => e.kind === 'bledOut' && e.playerId === 'p1')).toBe(true);
    const x0 = p.x;
    step(60, { p1: hold({ moveX: 1 }) });
    expect(p.x).toBe(x0);
  });

  it('a friend holding interact picks up the downed for free', () => {
    const { s, events, step } = fight();
    downHero(s, 'p1');
    const [down, friend] = s.players;
    friend.x = down.x + 1;
    friend.z = down.z;
    step(Math.ceil((tuning.coop.reviveMs / 1000) * 60) + 2, { p2: hold({ interact: true }) });
    expect(down.mode).toBe('move');
    expect(down.bleed).toBeUndefined();
    expect(friend.draughts).toBe(tuning.coop.draughtsPerFloor);
    expect(events.some((e) => e.kind === 'revived' && !e.draught)).toBe(true);
  });

  it('the out need the helper’s Revive Draught; without one nothing happens', () => {
    const { s, events, step } = fight();
    downHero(s, 'p1');
    const [down, friend] = s.players;
    down.bleed = 0;
    friend.x = down.x + 1;
    friend.z = down.z;
    friend.draughts = 0;
    step(4 * 60, { p2: hold({ interact: true }) });
    expect(down.mode).toBe('down');
    expect(down.reviveProgress).toBe(0);
    friend.draughts = 1;
    step(Math.ceil((tuning.coop.reviveMs / 1000) * 60) + 2, { p2: hold({ interact: true }) });
    expect(down.mode).toBe('move');
    expect(friend.draughts).toBe(0);
    expect(events.some((e) => e.kind === 'revived' && e.draught)).toBe(true);
  });

  it('brings everyone back once the room is cleared, the out included', () => {
    const level = floorLevel({ seed: 202, pieces: 18, floor: 1, floors: 3 });
    const fw = buildWorld(level);
    const s = createSimState(level, [], fw);
    addPlayer(s, fw, 'p1', loadout, true);
    addPlayer(s, fw, 'p2', loadout, true);
    const room = level.dungeon!.pieces.find((p) => p.fight)!;
    const mid = openMiddle(room);
    for (const p of s.players) Object.assign(p, { x: mid.x, z: mid.z, y: room.y, invulnTime: 0 });
    const step = (n: number) => {
      for (let i = 0; i < n; i++) stepSim(s, {}, 1 / 60, fw);
    };
    step(Math.ceil((tuning.run.introMs / 1000) * 60) + 4);
    expect(s.run.phase).toBe('wave');
    downHero(s, 'p1');
    s.players[0].bleed = 0;
    for (let k = 0; k < 4 && s.run.phase === 'wave'; k++) {
      for (const e of s.enemies) Object.assign(e, { hp: 0, ai: 'dead' });
      step(2);
    }
    expect(s.run.phase).toBe('ante');
    step(Math.ceil((tuning.combat.downMs / 1000) * 60) + 2);
    expect(s.players[0].mode).toBe('move');
    expect(s.players[0].bleed).toBeUndefined();
  });

  it('a party all down or out is wiped', () => {
    const { s, step } = fight();
    downHero(s, 'p1');
    downHero(s, 'p2');
    s.players[0].bleed = 0;
    step(1);
    expect(s.run.phase).toBe('lost');
  });

  it('with the slice’s downs (the switch off) no hero carries a bleed-out or draughts', () => {
    tuning.coop.bleedOut = false;
    const { s, step } = fight();
    downHero(s, 'p1');
    step(10);
    expect('bleed' in s.players[0]).toBe(false);
    expect('draughts' in s.players[0]).toBe(false);
  });
});
