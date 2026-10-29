import { describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { planChoice, floorSpecFor } from '../game/runPlan';
import { readPortalChoice, STORY } from '../game/portalChoice';
import { buildWorld } from '../level/arena';
import { floorLevel, openMiddle } from '../level/floor';
import { damageEnemy } from './combat';
import { addPlayer, stepRevives, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { emptyTalents } from './talents';
import { idleCommand } from './types';
import { createSimState, stepSim } from './world';

const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const DT = 1 / 60;

/** A floor of a random run with this modifier, its world and a fresh state with two heroes. */
function floor(modifier: 'cursed' | 'haunted' | null) {
  const spec = floorSpecFor(planChoice([], 11, { kind: 'random', floors: 2, size: 'large', difficulty: 1, modifier }), 1);
  const level = floorLevel(spec);
  const world = buildWorld(level);
  const s = createSimState(level, [], world);
  const a = addPlayer(s, world, 'a', loadout, false);
  const b = addPlayer(s, world, 'b', loadout, false);
  return { spec, level, world, s, a, b };
}

describe('the run modifiers (P8)', () => {
  it('ride from the portal choice onto every floor, and a story dungeon can carry one', () => {
    expect(readPortalChoice({ kind: 'random', floors: 2, size: 'small', difficulty: 1, modifier: 'cursed' })).toMatchObject({ modifier: 'cursed' });
    expect(readPortalChoice({ kind: 'random', floors: 2, size: 'small', difficulty: 1, modifier: 'doomed' })).toBeNull();
    const { spec, s } = floor('haunted');
    expect(spec.modifier).toBe('haunted');
    expect(s.floor!.modifier).toBe('haunted');
    const haunted = STORY.find((d) => d.run.modifier === 'haunted')!;
    expect(floorSpecFor(planChoice([], 1, { kind: 'story', id: haunted.id }), 2).modifier).toBe('haunted');
    expect(floor(null).s.floor!.modifier).toBeUndefined();
  });

  it('Cursed: a friend holding talk over a downed hero cannot bring them back', () => {
    for (const modifier of ['cursed', null] as const) {
      const { s, a, b } = floor(modifier);
      b.mode = 'down';
      b.hp = 0;
      b.bleed = 20;
      a.x = b.x + 0.5;
      a.z = b.z;
      for (let i = 0; i < 400 && b.mode === 'down'; i++) stepRevives(s, { a: { ...idleCommand(), interact: true } }, DT);
      expect(b.mode).toBe(modifier === 'cursed' ? 'down' : 'move');
    }
  });

  it('Cursed: a big room drops twice the loot', () => {
    const count = (modifier: 'cursed' | null) => {
      const { s, world, level } = floor(modifier);
      const big = level.dungeon!.pieces.find((p) => p.fight && (p.kind === 'greatHall' || p.kind === 'cavern' || p.kind === 'large' || p.kind === 'arena'))!;
      const at = openMiddle(big);
      for (const p of s.players) {
        p.x = at.x;
        p.z = at.z;
        p.y = big.y;
      }
      s.floor!.room = big.id;
      s.run.phase = 'wave';
      s.run.reinforced = true;
      s.run.dropX = at.x;
      s.run.dropZ = at.z;
      s.enemies = [];
      stepSim(s, {}, DT, world);
      return s.drops.length;
    };
    expect(count('cursed')).toBe(2 * count(null));
  });

  it('Haunted: a fallen enemy gets up once at half health, holding the room until it falls again', () => {
    const { s, world, level, a } = floor('haunted');
    const room = level.dungeon!.pieces.find((p) => p.fight)!;
    const at = openMiddle(room);
    s.floor!.room = room.id;
    s.run.phase = 'wave';
    s.run.reinforced = true;
    a.x = at.x + 6;
    a.z = at.z;
    const e = createEnemy(s, world, 'grunt', at.x, at.z, 0);
    e.ai = 'chase';
    s.enemies = [e];
    const hit = () => damageEnemy(s, e, { attackerId: 'a', damage: 1e6, poise: 0, knockback: 0, heavy: false, dirX: 1, dirZ: 0, style: 'sword', x: e.x, y: 1, z: e.z });
    hit();
    expect(e.ai).toBe('dead');
    let rose = false;
    for (let i = 0; i < Math.ceil(tuning.dungeon.hauntedRiseMs / 1000 / DT) + 5; i++) {
      stepSim(s, {}, DT, world);
      expect(s.run.phase).toBe('wave');
      if (s.events.some((ev) => ev.kind === 'enemyRose')) rose = true;
    }
    expect(rose).toBe(true);
    expect(e.risen).toBe(true);
    expect(e.hp).toBeCloseTo(e.maxHp * tuning.dungeon.hauntedHp, 6);
    expect(s.enemies).toContain(e);
    // Once it is on its feet, the second fall is for good: the room clears, and the body goes.
    for (let i = 0; i < 120 && (e.ai as string) === 'spawn'; i++) stepSim(s, {}, DT, world);
    hit();
    expect(e.ai).toBe('dead');
    for (let i = 0; i < 10; i++) stepSim(s, {}, DT, world);
    expect(s.run.phase).toBe('ante');
    for (let i = 0; i < 200 && s.enemies.includes(e); i++) stepSim(s, {}, DT, world);
    expect(s.enemies).not.toContain(e);
  });
});
