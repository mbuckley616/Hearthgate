import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { damageEnemy, killEnemy } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies, WARDEN_ADDS } from './enemies';
import { emptyMods } from './gear';
import { ADD_WEAKNESS, dressing, roleOf, weakTo } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, SimState } from './types';
import { createSimState } from './world';

// W1's phase 2 adds (Michael, 17 Nov, A; docs/bosses.md 2.3): the Warden's 60% roar raises adds weak
// to a style, one fewer than the heroes and at least one, the Guard first, then the Grave Cantor, a
// warded Bone Priest whose raise an arrow breaks.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { rules: tuning.warden.underRules, weak: tuning.bosses.addWeakness };
afterEach(() => {
  tuning.warden.underRules = kept.rules;
  tuning.bosses.addWeakness = kept.weak;
});

function scene(heroes: number): { s: SimState; w: EnemyState } {
  const s = createSimState(arena, [], world);
  for (let i = 0; i < heroes; i++) {
    const p = addPlayer(s, world, `p${i}`, loadout, false);
    Object.assign(p, { x: -10, z: 3 + i, hp: 1e6, maxHp: 1e6 });
  }
  const w = createEnemy(s, world, 'warden', -6, 3, -Math.PI / 2);
  Object.assign(w, { ai: 'chase', aiTime: 0, cooldown: 99 });
  return { s, w };
}

/** The kinds the Warden's 60% roar raised. */
function roarRaises(s: SimState, w: EnemyState): string[] {
  w.hp = w.maxHp * 0.59;
  for (let i = 0; i < 240 && w.ai !== 'roar'; i++) stepEnemies(s, DT, world);
  expect(w.ai).toBe('roar');
  for (let i = 0; i < 240 && w.ai === 'roar'; i++) stepEnemies(s, DT, world);
  return s.enemies.filter((e) => e !== w).map((e) => e.kind);
}

describe("the Warden's phase 2 adds (W1)", () => {
  it('the Grave Cantor is a warded Bone Priest: the archer’s job', () => {
    expect(roleOf('cantor')).toBe('leader');
    expect(ADD_WEAKNESS.cantor).toBe('warded');
    expect(weakTo('cantor')).toBe('bow');
    expect(dressing('cantor').name).toBe('Grave Cantor');
    expect(WARDEN_ADDS.slice(0, 2)).toEqual(['mortarGuard', 'cantor']);
  });

  it('raises one fewer than the heroes, at least one, Guard first; the raised dead with the rules off', () => {
    tuning.warden.underRules = true;
    const solo = scene(1);
    expect(roarRaises(solo.s, solo.w)).toEqual(['mortarGuard']);
    const duo = scene(2);
    expect(roarRaises(duo.s, duo.w)).toEqual(['mortarGuard']);
    const trio = scene(3);
    expect(roarRaises(trio.s, trio.w).sort()).toEqual(['cantor', 'mortarGuard']);
    tuning.warden.underRules = false;
    const off = scene(3);
    expect(new Set(roarRaises(off.s, off.w))).toEqual(new Set(['grunt']));
  });

  it("chants over a fallen Guard to raise it; a blade doesn't break the chant, an arrow does", () => {
    tuning.bosses.addWeakness = true;
    const { s } = scene(1);
    const g = createEnemy(s, world, 'mortarGuard', 6, 6, 0);
    killEnemy(s, g, 0);
    for (let i = 0; i < 60; i++) stepEnemies(s, DT, world);
    const c = createEnemy(s, world, 'cantor', 8, 8, 0);
    Object.assign(c, { ai: 'chase', aiTime: 0, cooldown: 0 });
    for (let i = 0; i < 120 && c.ai !== 'chant'; i++) stepEnemies(s, DT, world);
    expect(c.ai).toBe('chant');
    expect(c.raiseId).toBe(g.id);
    // A sword's light blow, too small to stagger it, leaves the chant going.
    damageEnemy(s, c, { attackerId: 'p0', damage: 1, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: c.x, y: 1, z: c.z, style: 'sword' });
    expect(c.ai).toBe('chant');
    damageEnemy(s, c, { attackerId: 'p0', damage: 1, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: c.x, y: 1, z: c.z, style: 'bow', projectile: true });
    expect(c.ai).toBe('recover');
    expect(c.tele.shape).toBe('none');
    // Left alone, a chant runs its time and the Guard stands again.
    c.cooldown = 0;
    for (let i = 0; i < 600 && g.ai === 'dead'; i++) stepEnemies(s, DT, world);
    expect(g.ai).not.toBe('dead');
  });
});
