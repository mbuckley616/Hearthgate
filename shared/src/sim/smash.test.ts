import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { HostSession } from '../game/HostSession';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle, type PropInfo } from '../level/floor';
import { PROTOCOL_VERSION } from '../net/protocol';
import { readCommand, readLoadout } from '../net/validate';
import { addPlayer, type Loadout } from './coop';
import { emptyMods } from './gear';
import { stepPlayer } from './player';
import { emptyTalents } from './talents';
import { idleCommand, type PlayerCommand, type SimEvent } from './types';
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

const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const spec = { seed: 202, pieces: 18, floor: 1, floors: 3 };
const level = floorLevel(spec);
const world = buildWorld(level);
const DT = 1 / 60;
const kept = { chance: tuning.loop.potionChance, enemies: tuning.debug.enemiesEnabled };

afterEach(() => {
  tuning.loop.potionChance = kept.chance;
  tuning.debug.enemiesEnabled = kept.enemies;
});

/** A hero on the floor standing `dist` m from a prop, facing it, in a fresh state. */
function beside(pr: PropInfo, dist: number, style: 'sword' | 'bow' = 'sword') {
  const s = createSimState(level, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  // Approach from the room's side: the prop stands against a wall.
  const piece = level.dungeon!.pieces[pr.piece];
  const mid = { x: (piece.inner.minX + piece.inner.maxX) / 2, z: (piece.inner.minZ + piece.inner.maxZ) / 2 };
  const len = Math.hypot(mid.x - pr.x, mid.z - pr.z);
  const ax = (pr.x - mid.x) / len;
  const az = (pr.z - mid.z) / len;
  p.x = pr.x - ax * dist;
  p.z = pr.z - az * dist;
  p.y = pr.y;
  p.yaw = Math.atan2(ax, az);
  p.style = style;
  p.invulnTime = 0;
  const cmd: PlayerCommand = { ...idleCommand(), aimX: ax, aimZ: az };
  return { s, p, cmd };
}

/** A prop with open floor in front of it: in a room, not a hall. */
const roomProp = () => level.dungeon!.props.find((pr) => level.dungeon!.pieces[pr.piece].fight)!;

describe('things to smash (D4)', () => {
  it('stand against the walls of the same floor in every build, never in the rest room, on a stair or in a doorway', () => {
    const props = level.dungeon!.props;
    expect(props.length).toBeGreaterThan(8);
    expect(floorLevel(spec).dungeon!.props).toEqual(props);
    for (const pr of props) {
      const piece = level.dungeon!.pieces[pr.piece];
      expect(piece.kind === 'rest' || piece.kind === 'stair').toBe(false);
      expect(piece.doors.some((d) => d.open && Math.hypot(d.x - pr.x, d.z - pr.z) < 3)).toBe(false);
      const i = piece.inner;
      expect(Math.min(pr.x - i.minX, i.maxX - pr.x, pr.z - i.minZ, i.maxZ - pr.z)).toBeLessThan(1);
    }
    expect(new Set(props.map((pr) => pr.kind)).size).toBe(3);
  });

  it('break under a swing in front, once, and give the floor their lumber or stone', () => {
    const pr = roomProp();
    const { s, p, cmd } = beside(pr, 1.2);
    stepPlayer(p, { ...cmd, attack: true }, DT, world, s);
    const events: SimEvent[] = [...s.events];
    for (let i = 0; i < 40; i++) {
      s.events = [];
      stepPlayer(p, cmd, DT, world, s);
      events.push(...s.events);
    }
    expect(s.floor!.broken).toEqual([pr.id]);
    const smashed = events.filter((e) => e.kind === 'smashed');
    expect(smashed).toHaveLength(1);
    // What it held lies on the floor now (Michael, 29 Oct); nothing is the party's until walked over.
    expect(s.floor!.found).toEqual({ lumber: 0, stone: 0, coin: 0 });
    const loot = s.floor!.loot ?? [];
    const l = tuning.loop;
    const count = (k: string) => loot.filter((d) => d.kind === k).reduce((n, d) => n + d.amount, 0);
    if (pr.kind === 'urn') {
      expect(count('stone')).toBeGreaterThanOrEqual(l.smashStoneMin);
      expect(count('lumber') + count('coin')).toBe(0);
    } else {
      expect(count('lumber')).toBeGreaterThanOrEqual(l.smashLumberMin);
      expect(count('lumber')).toBeLessThanOrEqual(l.smashLumberMax);
      expect(count('stone')).toBe(0);
    }
    const gave = smashed[0].kind === 'smashed' ? smashed[0] : null;
    expect(gave && [gave.lumber, gave.stone, gave.coin]).toEqual([count('lumber'), count('stone'), count('coin')]);
  });

  it('stand when the swing faces away', () => {
    const pr = roomProp();
    const { s, p, cmd } = beside(pr, 1.2);
    const away = { ...cmd, aimX: -cmd.aimX, aimZ: -cmd.aimZ };
    p.yaw += Math.PI;
    stepPlayer(p, { ...away, attack: true }, DT, world, s);
    for (let i = 0; i < 40; i++) stepPlayer(p, away, DT, world, s);
    expect(s.floor!.broken).toEqual([]);
  });

  it('stop an arrow that meets one, and break', () => {
    // No fight wakes as the archer walks in, or the shot would turn to an enemy.
    tuning.debug.enemiesEnabled = false;
    const pr = roomProp();
    const { s, p, cmd } = beside(pr, 6, 'bow');
    // Free aim (D12) down at it: a level shot at chest height flies over a crate.
    const aimed = { ...cmd, aimPitch: Math.atan2(pr.y + 0.5 - (p.y + 1.45), 6) };
    stepSim(s, { p1: { ...aimed, attack: true } }, DT, world);
    for (let i = 0; i < 90 && s.floor!.broken.length === 0; i++) stepSim(s, { p1: aimed }, DT, world);
    expect(s.floor!.broken).toContain(pr.id);
    expect(s.projectiles.filter((x) => !x.stuck)).toHaveLength(0);
  });

  it('bank with the rest room, the deeper bonus on top, and are lost with a wipe', () => {
    const run = (found: { lumber: number; stone: number; coin: number }, wipe: boolean) => {
      const host = new HostSession(buildWorld(floorLevel(spec)), () => {});
      host.onMessage('a', { k: 'hello', version: PROTOCOL_VERSION, loadout });
      const events: SimEvent[] = [];
      host.tick();
      host.sim.floor!.found = { ...found };
      const p = host.sim.players[0];
      if (wipe) {
        host.sim.run.phase = 'wave';
        host.sim.floor!.room = level.dungeon!.pieces.find((pc) => pc.fight)!.id;
        p.hp = 0;
        p.mode = 'down';
      } else {
        const rest = level.dungeon!.pieces[level.dungeon!.def.exit];
        const at = openMiddle(rest);
        p.x = at.x;
        p.z = at.z;
        p.y = rest.y;
      }
      for (let i = 0; i < 3; i++) events.push(...host.tick());
      return { events, floor: host.sim.floor! };
    };
    const plain = run({ lumber: 0, stone: 0, coin: 0 }, false).events.find((e) => e.kind === 'banked');
    const more = run({ lumber: 5, stone: 2, coin: 9 }, false).events.find((e) => e.kind === 'banked');
    expect(plain && more && plain.kind === 'banked' && more.kind === 'banked').toBe(true);
    if (plain?.kind !== 'banked' || more?.kind !== 'banked') return;
    expect(more.lumber - plain.lumber).toBe(5);
    expect(more.stone - plain.stone).toBe(2);
    expect(more.coin - plain.coin).toBe(9);
    const lost = run({ lumber: 5, stone: 2, coin: 9 }, true);
    expect(lost.events.some((e) => e.kind === 'banked')).toBe(false);
    expect(lost.floor.found).toEqual({ lumber: 0, stone: 0, coin: 0 });
  });
});

describe('the health potion (D4)', () => {
  it('rolls out of a smashed prop, and the hero who walks over it puts it on the belt', () => {
    tuning.loop.potionChance = 1;
    tuning.debug.enemiesEnabled = false;
    const pr = roomProp();
    const { s, p, cmd } = beside(pr, 1.2);
    // A full belt leaves it on the floor; with room, standing beside it takes it.
    p.potions = tuning.loop.potionMax;
    stepSim(s, { p1: { ...cmd, attack: true } }, DT, world);
    for (let i = 0; i < 40; i++) stepSim(s, { p1: cmd }, DT, world);
    expect(s.floor!.potions).toHaveLength(1);
    p.potions = 0;
    p.x = pr.x;
    p.z = pr.z;
    stepSim(s, { p1: idleCommand() }, DT, world);
    expect(s.floor!.potions).toHaveLength(0);
    expect(p.potions).toBe(1);
    expect(s.events).toContainEqual({ kind: 'potionTaken', playerId: 'p1', potions: 1 });
  });

  it('heals on a press, once a second, never past full, and not at full health', () => {
    const { s, p } = beside(roomProp(), 2);
    p.potions = 2;
    p.hp = 20;
    stepPlayer(p, { ...idleCommand(), drink: true }, DT, world, s);
    expect(p.hp).toBe(20 + p.maxHp * tuning.loop.potionHeal);
    expect(p.potions).toBe(1);
    stepPlayer(p, { ...idleCommand(), drink: true }, DT, world, s);
    expect(p.potions).toBe(1);
    for (let i = 0; i < 61; i++) stepPlayer(p, idleCommand(), DT, world, s);
    p.hp = p.maxHp;
    stepPlayer(p, { ...idleCommand(), drink: true }, DT, world, s);
    expect(p.potions).toBe(1);
    p.hp = p.maxHp - 1;
    stepPlayer(p, { ...idleCommand(), drink: true }, DT, world, s);
    expect(p.hp).toBe(p.maxHp);
    expect(p.potions).toBe(0);
  });

  it('comes into a room with the hero, a belt at most, and the press travels on the wire', () => {
    expect(readLoadout({ ...loadout, potions: 99 })?.potions).toBe(tuning.loop.potionMax);
    expect(readLoadout({ ...loadout, potions: -1 })).toBeNull();
    expect('potions' in readLoadout(loadout)!).toBe(false);
    const s = createSimState(level, [], world);
    expect(addPlayer(s, world, 'p1', { ...loadout, potions: 2 }, false).potions).toBe(2);
    expect(addPlayer(s, world, 'p2', loadout, false).potions).toBeUndefined();
    const base = { ...idleCommand() };
    expect(readCommand({ ...base, drink: true })?.drink).toBe(true);
    expect(readCommand({ ...base, drink: 'yes' })).toBeNull();
    expect('drink' in readCommand(base)!).toBe(false);
  });
});
