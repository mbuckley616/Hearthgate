import { afterEach, describe, expect, it } from 'vitest';
import { tuning, type EnemyKind } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readLoadout } from '../net/validate';
import { startAbility, stepAbility } from './abilities';
import { damageEnemy, hurtHero } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods, type Mods } from './gear';
import { attackSpeed, emptyTalents } from './talents';
import { idleCommand, type DamageType, type PlayerState, type SimState } from './types';
import { createSimState } from './world';

// B6, signature drops (docs/bosses.md 1.4; Michael's A on the document, 16 Nov): a boss's piece
// resists a damage type, casts faster or is a bane to that boss. The pieces themselves and the drop
// lists by job come next; these are the properties on Mods and what the fight does with them.

const world = buildWorld(arena);
const kept = { on: tuning.bosses.signatureDrops };
afterEach(() => {
  tuning.bosses.signatureDrops = kept.on;
});

function hero(mods: Partial<Mods> = {}): { s: SimState; p: PlayerState } {
  const s = createSimState(arena, [], world);
  const loadout: Loadout = { name: 'p', xp: { sword: 1e6, bow: 0, staff: 0 }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 1000 };
  const p = addPlayer(s, world, 'p1', loadout, false);
  return { s, p };
}

/** What one 100 hit of `type` takes off a hero wearing `resist`. */
function hurt(type: DamageType, resist?: DamageType[]): number {
  const { s, p } = hero(resist ? { resist } : {});
  p.hp = p.maxHp = 1000;
  hurtHero(s, p, { damage: 100, fromX: p.x, fromZ: p.z + 2, type });
  return 1000 - p.hp;
}

/** What one 10 sword hit takes off a fresh `kind`, from a hero with a bane or none. */
function dealt(kind: EnemyKind, bane?: EnemyKind): number {
  const { s, p } = hero(bane ? { bane } : {});
  const e = createEnemy(s, world, kind, 0, -9, 0);
  Object.assign(e, { ai: 'chase', hp: 1e4, maxHp: 1e4, poise: 1e6 });
  damageEnemy(s, e, { attackerId: p.id, damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style: 'sword' });
  return 1e4 - e.hp;
}

/** Ticks from pressing the sword's first ability to its effect firing. */
function windupTicks(castSpeed: boolean): number {
  const { s, p } = hero(castSpeed ? { castSpeed } : {});
  startAbility(s, p, 0, idleCommand());
  for (let i = 1; i < 600; i++) {
    stepAbility(s, p, idleCommand(), 1 / 60, world.colliders);
    if (p.abilityFired) return i;
  }
  return -1;
}

describe('signature drops (B6)', () => {
  it('takes 20% off a blunt hit with a blunt resist, and nothing off an edge one', () => {
    const plain = hurt('blunt');
    expect(hurt('blunt', ['blunt'])).toBeCloseTo(plain * 0.8, 6);
    expect(hurt('edge', ['blunt'])).toBeCloseTo(hurt('edge'), 6);
    // A hit with no type (the slice's, or the switch off upstream) is never resisted.
    const { s, p } = hero({ resist: ['blunt'] });
    p.hp = p.maxHp = 1000;
    hurtHero(s, p, { damage: 100, fromX: p.x, fromZ: p.z + 2 });
    expect(1000 - p.hp).toBeCloseTo(plain, 6);
  });

  it('gives one resist a type: a loadout naming a type twice is refused', () => {
    const l = (mods: Record<string, unknown>) => ({ name: 'Ann', xp: { sword: 10, bow: 0, staff: 0 }, talents: emptyTalents(), mods: { ...emptyMods(), ...mods }, maxHp: 100 });
    expect(readLoadout(l({ resist: ['blunt'] }))?.mods.resist).toEqual(['blunt']);
    expect(readLoadout(l({ resist: ['blunt', 'blunt'] }))).toBeNull();
    expect(readLoadout(l({ resist: ['fire'] }))).toBeNull();
    expect(readLoadout(l({ castSpeed: true }))?.mods.castSpeed).toBe(true);
    expect(readLoadout(l({ castSpeed: 3 }))).toBeNull();
    expect(readLoadout(l({ bane: 'warden' }))?.mods.bane).toBe('warden');
    // A bane is a boss's: a skeleton warrior is no boss.
    expect(readLoadout(l({ bane: 'grunt' }))).toBeNull();
  });

  it('runs a quick-casting weapon’s chain and windups 15% faster', () => {
    expect(attackSpeed(hero({ castSpeed: true }).p) - attackSpeed(hero().p)).toBeCloseTo(0.15, 6);
    const plain = windupTicks(false);
    const quick = windupTicks(true);
    // The Charge's windup in ticks, then the same at 1.15 the pace.
    const ticks = (tuning.abilities.chargeWindupMs / 1000) * 60;
    expect(plain).toBe(Math.ceil(ticks - 1e-9));
    expect(quick).toBe(Math.ceil(ticks / 1.15 - 1e-9));
    expect(quick).toBeLessThan(plain);
  });

  it('lands a bane weapon 1.25 times as hard on its boss, and on nothing else', () => {
    expect(dealt('warden', 'warden')).toBeCloseTo(dealt('warden') * 1.25, 6);
    expect(dealt('king', 'warden')).toBeCloseTo(dealt('king'), 6);
  });

  it('changes nothing with the switch off', () => {
    tuning.bosses.signatureDrops = false;
    expect(hurt('blunt', ['blunt'])).toBeCloseTo(hurt('blunt'), 6);
    expect(dealt('warden', 'warden')).toBeCloseTo(dealt('warden'), 6);
    expect(windupTicks(true)).toBe(windupTicks(false));
  });
});
