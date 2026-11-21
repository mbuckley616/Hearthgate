import { describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { addPlayer, type Loadout } from './coop';
import { breakChannel } from './combat';
import { brainFor, createEnemy, raisable, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { attackType, dressing, roleOf, roomKindIn } from './roles';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// E1i: the Goblin Shaman, the Warrens' caster: the Wraith's circle, a hex that bursts instead of Chilling.

const world = buildWorld(arena);
const DT = 1 / 60;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const EDGE = arena.floorSize / 2;

function scene(kind: EnemyKind): { s: SimState; p: PlayerState; e: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', loadout, false);
  Object.assign(p, { x: 0, z: EDGE - 3, invulnerable: false, invulnTime: 0, lagGrace: 0 });
  const e = createEnemy(s, world, kind, 0, EDGE - 11, 0);
  Object.assign(e, { x: 0, z: EDGE - 11, yaw: 0, ai: 'chase', aiTime: 0, cooldown: 0 });
  return { s, p, e };
}

/** Stand still until the circle lands: when the channel began, when it landed, and the hero after. */
function cast(kind: EnemyKind) {
  const { s, p, e } = scene(kind);
  let chantAt = -1;
  let landedAt = -1;
  let t = 0;
  for (let i = 0; i < 400 && landedAt < 0; i++) {
    Object.assign(p, { x: 0, z: EDGE - 3 });
    stepEnemies(s, DT, world);
    t += DT;
    if (e.ai === 'chant' && chantAt < 0) chantAt = t;
    if (s.events.some((ev) => ev.kind === 'circleLanded')) landedAt = t;
    s.events.length = 0;
  }
  return { s, p, e, chantAt, landedAt };
}

describe('the Goblin Shaman (E1i)', () => {
  it('is the Warrens’ caster, casts magic, and takes the Wraith’s place there', () => {
    expect(roleOf('shaman')).toBe('caster');
    expect(brainFor('shaman')).toBe(brainFor('wraith'));
    expect(attackType({ kind: 'shaman', attack: 'cast' })).toBe('magic');
    expect(dressing('shaman', 'goblinWarrens').name).toBe('Goblin Shaman');
    expect(roomKindIn('wraith', 'goblinWarrens')).toBe('shaman');
    expect(roomKindIn('wraith', 'hauntedCrypt')).toBe('wraith');
    const state = { enemies: [{ kind: 'priest', ai: 'chase' }], floor: null } as never;
    expect(raisable(state, { kind: 'shaman', ai: 'dead' } as never)).toBe(false);
  });

  it('its circle bursts for damage and leaves no Chill; the Wraith’s chills and deals none', () => {
    const sh = cast('shaman');
    expect(sh.landedAt).toBeGreaterThan(0);
    expect(sh.p.hp).toBe(sh.p.maxHp - tuning.shaman.circleDamage);
    expect(sh.p.chill ?? 0).toBe(0);
    const wr = cast('wraith');
    expect(wr.p.hp).toBe(wr.p.maxHp);
    expect(wr.p.chill ?? 0).toBeGreaterThan(0);
    // A shorter channel than the Wraith's: a quicker step out.
    expect(sh.landedAt - sh.chantAt).toBeLessThan(wr.landedAt - wr.chantAt);
  });

  it('a hero who steps out before it lands takes nothing, and a hit breaks the channel', () => {
    const { s, p, e } = scene('shaman');
    for (let i = 0; i < 200 && e.ai !== 'chant'; i++) stepEnemies(s, DT, world);
    expect(e.ai).toBe('chant');
    p.x = 5;
    for (let i = 0; i < 200 && e.ai === 'chant'; i++) stepEnemies(s, DT, world);
    expect(p.hp).toBe(p.maxHp);

    const b = scene('shaman');
    for (let i = 0; i < 200 && b.e.ai !== 'chant'; i++) stepEnemies(b.s, DT, world);
    breakChannel(b.e);
    expect(b.e.ai).toBe('recover');
    expect(b.e.tele.shape).toBe('none');
  });
});
