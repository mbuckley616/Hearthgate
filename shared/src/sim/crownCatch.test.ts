import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem, readLoadout } from '../net/validate';
import { CATALOGUE, wornMods } from './catalogue';
import { addPlayer, type Loadout } from './coop';
import { createEnemy, stepEnemies } from './enemies';
import { emptyMods } from './gear';
import { SIGNATURES, signatureItem } from './signatures';
import { emptyTalents } from './talents';
import type { EnemyState, PlayerState, SimState } from './types';
import { createSimState } from './world';

// K1, part three (docs/bosses.md 2.4): the tank's Crown-catcher Buckler, whose parry of the Hollow
// King's thrown crown sends it back at him.

const world = buildWorld(arena);
const DT = 1 / 60;
const piece = SIGNATURES.king!.find((p) => p.name === 'Crown-catcher Buckler')!;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = { on: tuning.bosses.signatureDrops };
afterEach(() => {
  tuning.bosses.signatureDrops = kept.on;
});

/** A hero 10 m from the King with a guard just raised toward him (the parry window open), wearing `catcher` or not. */
function scene(catcher: boolean): { s: SimState; p: PlayerState; k: EnemyState } {
  const s = createSimState(arena, [], world);
  const p = addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...(catcher ? { crownCatch: true } : {}) } }, false);
  Object.assign(p, { x: 0, z: 12, yaw: Math.PI, mode: 'guard', guardTime: 0, parryOpen: true, invulnTime: 0, invulnerable: false, lagGrace: 0, hp: 1e4, maxHp: 1e4 });
  const k = createEnemy(s, world, 'king', 0, 2, 0);
  Object.assign(k, { x: 0, z: 2, ai: 'chase', aiTime: 0, cooldown: 0, poise: 1e6 });
  return { s, p, k };
}

/** Step until the crown first meets the hero; true if it did. */
function throwAt(s: SimState, p: PlayerState): boolean {
  for (let i = 0; i < 900; i++) {
    stepEnemies(s, DT, world);
    if (p.parrySeq > 0 || p.hp < p.maxHp) return true;
  }
  return false;
}

describe('the Crown-catcher Buckler (K1)', () => {
  it("is the tank's piece, a shield-slot item the server takes back, worn only as an off-hand", () => {
    expect(piece.job).toBe('tank');
    const item = signatureItem(piece, 'a');
    expect(CATALOGUE.get(item.id)?.slot).toBe('shield');
    expect(readGearItem(item)?.signature).toEqual({ crownCatch: true });
    expect(wornMods({ shield: item }).crownCatch).toBe(true);
    // Only on an off-hand, and only as a flag.
    expect(readGearItem({ ...signatureItem(SIGNATURES.king![1], 'b'), signature: { crownCatch: true } })).toBeNull();
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), crownCatch: true } })?.mods.crownCatch).toBe(true);
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), crownCatch: 1 } })).toBeNull();
  });

  it('sends a parried crown back at the King, and turns it home from where it was met', () => {
    tuning.bosses.signatureDrops = true;
    const { s, p, k } = scene(true);
    expect(throwAt(s, p)).toBe(true);
    expect(p.parrySeq).toBe(1);
    expect(p.hp).toBe(p.maxHp);
    expect(k.crown?.back).toBe(true);
    expect(k.crown!.d).toBeLessThan(k.crown!.length);
    expect(s.events.some((e) => e.kind === 'crownCaught' && e.playerId === 'p1' && e.enemyId === k.id)).toBe(true);
    const lost = k.maxHp - k.hp;
    expect(lost).toBeGreaterThanOrEqual(tuning.king.crownDamage * tuning.king.crownCatchMult * 0.5);
  });

  it('is a plain parry without the buckler, or with signature drops off', () => {
    for (const [catcher, on] of [[false, true], [true, false]] as const) {
      tuning.bosses.signatureDrops = on;
      const { s, p, k } = scene(catcher);
      expect(throwAt(s, p)).toBe(true);
      expect(p.parrySeq).toBe(1);
      expect(k.hp).toBe(k.maxHp);
      expect(k.crown?.back).toBe(false);
      expect(s.events.some((e) => e.kind === 'crownCaught')).toBe(false);
    }
  });
});
