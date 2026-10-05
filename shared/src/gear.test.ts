import { describe, expect, it } from "vitest";
import { GEAR, PLAYER } from "./sim";
import {
  ARMOR_TYPES,
  MATERIALS,
  STARTER_WEAPON,
  TIER_BASE_ATK,
  TIER_BASE_DEF,
  TIER_BLOCK,
  WEAPON_TYPES,
  armorStats,
  effectiveTier,
  gearName,
  tierCap,
  weaponStats,
  type Gear
} from "./gear";

type Weapon = Extract<Gear, { kind: "weapon" }>;
const sword = (tier: number, enchant?: Weapon["enchant"]): Weapon => ({ kind: "weapon", type: "sword", tier, enchant });

describe("gear", () => {
  it("keeps The Old Gates' tables: ten materials and the attack, defence and block curves", () => {
    expect(MATERIALS.map((m) => m.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(MATERIALS[4].name).toBe("Mithril");
    expect(TIER_BASE_ATK).toHaveLength(11);
    expect(TIER_BASE_DEF).toHaveLength(11);
    expect(TIER_BLOCK).toHaveLength(11);
    for (let t = 2; t <= 10; t++) {
      expect(TIER_BASE_ATK[t]).toBeGreaterThan(TIER_BASE_ATK[t - 1]);
      expect(TIER_BASE_DEF[t]).toBeGreaterThan(TIER_BASE_DEF[t - 1]);
      expect(TIER_BLOCK[t]).toBeGreaterThan(TIER_BLOCK[t - 1]);
    }
    expect(Object.keys(WEAPON_TYPES)).toHaveLength(11);
    expect(Object.keys(ARMOR_TYPES)).toHaveLength(8);
  });

  it("the starter sword hits for today's sword damage, so wiring it in changes nothing", () => {
    expect(weaponStats(STARTER_WEAPON, 1).damage).toBe(PLAYER.attackDamage);
  });

  it("a portal of tier T lets gear perform up to material tier 2T", () => {
    expect(GEAR.materialsPerPortalTier).toBe(2);
    expect([1, 2, 3, 4, 5].map(tierCap)).toEqual([2, 4, 6, 8, 10]);
    expect(effectiveTier(5, 1)).toEqual({ tier: 2, capped: true });
    expect(effectiveTier(2, 1)).toEqual({ tier: 2, capped: false });
    expect(effectiveTier(10, 5)).toEqual({ tier: 10, capped: false });
  });

  it("a capped weapon is a strong weapon of the cap tier: better than a native one, short of the next tier", () => {
    const vet = weaponStats(sword(5), 1);
    const native = weaponStats(sword(2), 1);
    const nextTier = weaponStats(sword(3), 2);
    expect(vet.capped).toBe(true);
    expect(vet.tier).toBe(2);
    expect(vet.damage).toBeGreaterThan(native.damage);
    expect(vet.damage).toBeLessThan(nextTier.damage);
    // Uncapped, the same sword is far stronger: the cap is what keeps the veteran from one-shotting.
    expect(weaponStats(sword(5), 3).damage).toBeGreaterThan(vet.damage * 1.5);
  });

  it("a capped weapon keeps its special effect", () => {
    const s = weaponStats(sword(8, "fire"), 1);
    expect(s.capped).toBe(true);
    expect(s.enchant).toEqual({ name: "of Flames", extraFrac: 0.25, healFrac: 0 });
  });

  it("damage grows with the material tier for every weapon type", () => {
    for (const type of Object.keys(WEAPON_TYPES) as Weapon["type"][]) {
      let last = 0;
      for (let t = 1; t <= 10; t++) {
        const d = weaponStats({ kind: "weapon", type, tier: t }, 5).damage;
        expect(d).toBeGreaterThan(last);
        last = d;
      }
    }
  });

  it("style and the two-hander fields come from the weapon type", () => {
    expect(weaponStats({ kind: "weapon", type: "bow", tier: 1 }, 1)).toMatchObject({ style: "ranged", twoHand: true, damageType: "pierce" });
    expect(weaponStats({ kind: "weapon", type: "claymore", tier: 1 }, 1)).toMatchObject({
      style: "melee",
      twoHand: true,
      cleaveTargets: 3,
      postureMult: 1.75,
      blockReduce: 0.5
    });
    expect(weaponStats(sword(1), 1)).toMatchObject({ twoHand: false, cleaveTargets: 1, postureMult: 1, blockReduce: 0.35 });
  });

  it("armour defence and shield block are capped the same way", () => {
    const cuirass = (tier: number): Gear & { kind: "armor" } => ({ kind: "armor", type: "cuirass", tier });
    expect(armorStats(cuirass(9), 1)).toEqual({ ...armorStats(cuirass(2), 1), capped: true });
    expect(armorStats(cuirass(1), 1).def).toBe(2);
    const buckler = armorStats({ kind: "armor", type: "buckler", tier: 7 }, 2);
    expect(buckler).toMatchObject({ tier: 4, capped: true, block: TIER_BLOCK[4], slot: "offhand" });
    expect(armorStats({ kind: "armor", type: "helmet", tier: 7 }, 2).block).toBe(0);
    // Small pieces never fall to zero defence.
    expect(armorStats({ kind: "armor", type: "ring", tier: 1 }, 1).def).toBe(1);
  });

  it("names read like The Old Gates'", () => {
    expect(gearName({ kind: "weapon", type: "claymore", tier: 5, enchant: "fire" })).toBe("Mithril Claymore of Flames");
    expect(gearName({ kind: "weapon", type: "warHammer", tier: 1 })).toBe("Wooden War Hammer");
    expect(gearName({ kind: "armor", type: "greaves", tier: 3 })).toBe("Iron Greaves");
  });

  it("out-of-range tiers clamp instead of reading past the tables", () => {
    expect(weaponStats(sword(0), 1)).toEqual(weaponStats(sword(1), 1));
    expect(weaponStats(sword(99), 9)).toEqual(weaponStats(sword(10), 5));
    expect(tierCap(0)).toBe(2);
  });

  it("is pure: the same gear in the same portal gives the same numbers", () => {
    const g = sword(6, "drain");
    expect(weaponStats(g, 2)).toEqual(weaponStats(g, 2));
    expect(g).toEqual(sword(6, "drain"));
  });
});
