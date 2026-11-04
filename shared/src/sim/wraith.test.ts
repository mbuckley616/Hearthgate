import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { damageEnemy } from './combat';
import { brainFor, createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { composeRoom } from './roomMix';
import { roleOf, telegraphColour } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1d, the Wraith (caster): channels a violet circle at a hero's feet that Chills whoever stands in
// it when it lands; any hit breaks the channel. Gate: an arrow mid-channel breaks it; standing in it Chills.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };

const kept = tuning.debug.passiveEnemies;
afterEach(() => {
  tuning.debug.passiveEnemies = kept;
});

function scene(): { s: SimState; p: PlayerState; w: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: 10, mode: 'move', invulnTime: 0, invulnerable: false });
  const w = createEnemy(s, world, 'wraith', 0, 2, 0);
  Object.assign(w, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, w };
}

/** Step the enemies until the Wraith starts a channel, then return the circle. */
function untilChannel(s: SimState, w: EnemyState) {
  for (let i = 0; i < 120 && w.ai !== 'chant'; i++) stepEnemies(s, DT, world);
  expect(w.ai).toBe('chant');
  expect(w.tele.shape).toBe('circle');
  return { ...w.tele };
}

const landTicks = () => Math.ceil((tuning.wraith.channelMs + tuning.coop.lagGraceMs) / 1000 / DT) + 2;

describe('the Wraith (E1d)', () => {
  it('is the caster role, with a brain, telling in violet', () => {
    expect(roleOf('wraith')).toBe('caster');
    expect(brainFor('wraith')).toBeDefined();
    expect(telegraphColour({ kind: 'wraith', attack: '' })).toBe('magic');
  });

  it('Chills a hero who stands in the circle as it lands', () => {
    const { s, p, w } = scene();
    const c = untilChannel(s, w);
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(0.5);
    for (let i = 0; i < landTicks() && w.ai === 'chant'; i++) stepEnemies(s, DT, world);
    expect(w.ai).not.toBe('chant');
    expect(p.chill).toBeCloseTo(tuning.chill.durationS, 5);
  });

  it('misses a hero who stepped out of it in time', () => {
    const { s, p, w } = scene();
    const c = untilChannel(s, w);
    p.x = c.x + c.radius + 0.5;
    for (let i = 0; i < landTicks() && w.ai === 'chant'; i++) stepEnemies(s, DT, world);
    expect(p.chill).toBeUndefined();
  });

  it('an arrow mid-channel breaks it, and nobody is Chilled', () => {
    const { s, p, w } = scene();
    untilChannel(s, w);
    for (let i = 0; i < 30; i++) stepEnemies(s, DT, world);
    damageEnemy(s, w, { attackerId: p.id, damage: 1, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: -1, x: w.x, y: 1, z: w.z, style: 'bow', projectile: true });
    expect(w.ai).toBe('recover');
    expect(w.tele.shape).toBe('none');
    for (let i = 0; i < landTicks(); i++) stepEnemies(s, DT, world);
    expect(p.chill).toBeUndefined();
  });

  it('stands behind the line when a room draws it', () => {
    let seen = 0;
    for (let seed = 1; seed < 60; seed++) {
      let a = seed;
      const rand = () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
      for (const g of composeRoom(20, { big: true, floor: 2, difficulty: 3 }, rand)) {
        if (g.kind !== 'wraith') continue;
        seen++;
        expect(g.place).toBe('back');
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
