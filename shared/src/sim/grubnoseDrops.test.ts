import { afterEach, describe, expect, it } from 'vitest';
import { tuning } from '../config/tuning';
import { arena, buildWorld } from '../level/arena';
import { readGearItem, readLoadout } from '../net/validate';
import { wornMods } from './catalogue';
import { damageEnemy, hurtHero } from './combat';
import { addPlayer, type Loadout } from './coop';
import { createEnemy } from './enemies';
import { emptyMods } from './gear';
import type { EnemyKind } from '../config/tuning';
import { SIGNATURES, offerFor, signatureItem } from './signatures';
import { emptyTalents } from './talents';
import { createSimState } from './world';

// G3b: Chief Grubnose's signature drops (docs/bosses.md 2.5): the Pot-lid Shield for the tank, the
// Slingshot Bracer, arrows 1.25x against goblins, for the archer, and his Horn in the neck slot (Michael's
// A, 21 Nov), three charges a floor without a stagger, for the one who fought him.

const world = buildWorld(arena);
const list = SIGNATURES.grubnose!;
const bracer = list.find((p) => p.name === 'Slingshot Bracer')!;
const loadout: Loadout = { name: 'p', xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
const kept = tuning.bosses.signatureDrops;
afterEach(() => {
  tuning.bosses.signatureDrops = kept;
});

/** Damage one hit of 10 does to `kind`, by arrow or blade, the hero wearing the bracer or not. */
function hitFor(kind: EnemyKind, worn: boolean, style: 'bow' | 'sword' = 'bow'): number {
  const s = createSimState(arena, [], world);
  addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...(worn ? { goblinArrows: true } : {}) } }, false);
  const e = createEnemy(s, world, kind, 6, 6, 0);
  Object.assign(e, { ai: 'chase', aiTime: 0, maxHp: 1e4, hp: 1e4 });
  damageEnemy(s, e, { attackerId: 'p1', damage: 10, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 1, x: e.x, y: 1, z: e.z, style, projectile: style === 'bow' });
  return 1e4 - e.hp;
}

describe("Chief Grubnose's drops (G3b)", () => {
  it('the tank is offered the Pot-lid Shield against blunt, the archer the Slingshot Bracer', () => {
    expect(offerFor(list, { tank: 50, warded: 10 })).toMatchObject({ name: 'Pot-lid Shield', signature: { resist: 'blunt' } });
    expect(offerFor(list, { tank: 5, warded: 80 })?.name).toBe('Slingshot Bracer');
  });

  it('the bracer is gloves the server takes back, worn only on the hands', () => {
    const item = signatureItem(bracer, 'a');
    expect(readGearItem(item)?.signature).toEqual({ goblinArrows: true });
    expect(wornMods({ hands: item }).goblinArrows).toBe(true);
    expect(readGearItem({ ...signatureItem(SIGNATURES.king![2], 'b'), signature: { goblinArrows: true } })).toBeNull();
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), goblinArrows: true } })?.mods.goblinArrows).toBe(true);
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), goblinArrows: 1 } })).toBeNull();
  });

  it("its wearer's arrows take 1.25x from goblins and the Chief, not a blade's cut, a skeleton, or with drops off", () => {
    const plain = hitFor('cutter', false);
    expect(hitFor('cutter', true)).toBeCloseTo(plain * tuning.grubnose.bracerArrowMult, 5);
    expect(hitFor('grubnose', true)).toBeCloseTo(hitFor('grubnose', false) * tuning.grubnose.bracerArrowMult, 5);
    expect(hitFor('cutter', true, 'sword')).toBeCloseTo(hitFor('cutter', false, 'sword'), 5);
    expect(hitFor('grunt', true)).toBeCloseTo(hitFor('grunt', false), 5);
    tuning.bosses.signatureDrops = false;
    expect(hitFor('cutter', true)).toBeCloseTo(plain, 5);
  });

  it("the Horn is an amulet the server takes back, worn only at the neck, and offered for fighting him", () => {
    const horn = list.find((p) => p.name === "Grubnose's Horn")!;
    expect(horn.job).toBe('boss');
    expect(offerFor(list, { boss: 90, tank: 10 })?.name).toBe("Grubnose's Horn");
    const item = signatureItem(horn, 'h');
    expect(readGearItem(item)?.signature).toEqual({ hornCharges: true });
    expect(wornMods({ neck: item }).hornCharges).toBe(true);
    expect(readGearItem({ ...signatureItem(bracer, 'c'), signature: { hornCharges: true } })).toBeNull();
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), hornCharges: true } })?.mods.hornCharges).toBe(true);
    expect(readLoadout({ ...loadout, mods: { ...emptyMods(), hornCharges: 'yes' } })).toBeNull();
  });

  it('its wearer takes the first three charges a floor without a stagger, then is staggered again', () => {
    const staggered = (worn: boolean, hit: { charge?: boolean }, times: number): boolean[] => {
      const s = createSimState(arena, [], world);
      const p = addPlayer(s, world, 'p1', { ...loadout, mods: { ...emptyMods(), ...(worn ? { hornCharges: true } : {}) } }, false);
      const out: boolean[] = [];
      for (let i = 0; i < times; i++) {
        Object.assign(p, { mode: 'idle', hp: 1e4, lagGrace: 0, invulnTime: 0 });
        hurtHero(s, p, { damage: 5, heavy: true, push: 4, fromX: p.x, fromZ: p.z - 2, enemyId: 1, late: true, ...hit });
        out.push(p.mode === 'hurt');
      }
      return out;
    };
    expect(staggered(true, { charge: true }, 4)).toEqual([false, false, false, true]);
    expect(staggered(false, { charge: true }, 2)).toEqual([true, true]);
    // A heavy that is not a charge (a slam) staggers as before.
    expect(staggered(true, {}, 1)).toEqual([true]);
    tuning.bosses.signatureDrops = false;
    expect(staggered(true, { charge: true }, 1)).toEqual([true]);
  });
});
