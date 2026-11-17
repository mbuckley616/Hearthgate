import { afterEach, describe, expect, it } from 'vitest';
import { tuning, type Style } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { damageEnemy, type HitSpec } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import { ADD_WEAKNESS, weakTo } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, SimState } from './types';
import { createSimState } from './world';

// B5, add weaknesses (docs/bosses.md 1.3; Michael's A on the document, 16 Nov): an armoured add is the
// mage's, a warded one the archer's. No kind has one yet (M2's Mortar Guards and Bone Chanters will),
// so each test lends one: the skeleton warrior plate, the Wraith a ward.

const world = buildWorld(arena);
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { on: tuning.bosses.addWeakness };
afterEach(() => {
  tuning.bosses.addWeakness = kept.on;
  delete ADD_WEAKNESS.grunt;
  delete ADD_WEAKNESS.wraith;
});

function setup(kind: 'grunt' | 'wraith'): { s: SimState; e: EnemyState; id: string } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  const e = createEnemy(s, world, kind, 0, -9, 0);
  Object.assign(e, { ai: 'chase', aiTime: 0, hp: 1000, maxHp: 1000, poise: 1e6 });
  return { s, e, id: p.id };
}

function hit(id: string, e: EnemyState, style: Style, damage = 10): HitSpec {
  return { attackerId: id, damage, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style, projectile: style !== 'sword' };
}

/** What one hit of `style` takes off, from a fresh enemy each time. */
function taken(kind: 'grunt' | 'wraith', style: Style): number {
  const { s, e, id } = setup(kind);
  damageEnemy(s, e, hit(id, e, style));
  return 1000 - e.hp;
}

describe('add weaknesses (B5)', () => {
  it('lets an armoured add take 35% from a sword or bow, and all of a staff', () => {
    const plain = { sword: taken('grunt', 'sword'), bow: taken('grunt', 'bow'), staff: taken('grunt', 'staff') };
    ADD_WEAKNESS.grunt = 'armoured';
    expect(weakTo('grunt')).toBe('staff');
    expect(taken('grunt', 'sword')).toBeCloseTo(plain.sword * 0.35, 6);
    expect(taken('grunt', 'bow')).toBeCloseTo(plain.bow * 0.35, 6);
    expect(taken('grunt', 'staff')).toBeCloseTo(plain.staff, 6);
  });

  it('breaks a warded add’s channel with an arrow, 1.5 times as hard', () => {
    const plain = taken('wraith', 'bow');
    ADD_WEAKNESS.wraith = 'warded';
    expect(weakTo('wraith')).toBe('bow');
    const { s, e, id } = setup('wraith');
    Object.assign(e, { ai: 'chant', aiTime: 0 });
    damageEnemy(s, e, hit(id, e, 'bow'));
    expect(e.ai).toBe('recover');
    expect(1000 - e.hp).toBeCloseTo(plain * 1.5, 6);
  });

  it('turns a spell aside from a warded add: no damage, a spark, the channel goes on', () => {
    ADD_WEAKNESS.wraith = 'warded';
    const { s, e, id } = setup('wraith');
    Object.assign(e, { ai: 'chant', aiTime: 0 });
    s.events = [];
    expect(damageEnemy(s, e, hit(id, e, 'staff'))).toBe(true);
    expect(e.hp).toBe(1000);
    expect(e.ai).toBe('chant');
    expect(s.events.some((ev) => ev.kind === 'guarded' && ev.enemyId === e.id)).toBe(true);
    // A sword still reaches it, at its own weight, and breaks the channel as any hit does.
    damageEnemy(s, e, hit(id, e, 'sword'));
    expect(e.hp).toBeLessThan(1000);
    expect(e.ai).toBe('recover');
  });

  it('changes nothing with the switch off, as the slice had no weaknesses', () => {
    const plain = taken('grunt', 'sword');
    ADD_WEAKNESS.grunt = 'armoured';
    tuning.bosses.addWeakness = false;
    expect(taken('grunt', 'sword')).toBeCloseTo(plain, 6);
  });
});
