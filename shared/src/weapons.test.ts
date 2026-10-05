import { describe, expect, it } from "vitest";
import {
  GOBLIN,
  PLAYER,
  TICK_MS,
  WEAPON_CLASSES,
  applyInput,
  createEncounter,
  createEnemy,
  createPlayer,
  resolvePlayerAttacks,
  stepEncounter,
  type EnemySim,
  type PlayerSim
} from "./sim";
import { OPEN_FIELD, type Level } from "./level";
import { weaponClassOf, weaponStats, type WeaponGear } from "./gear";

const swingAt = (p: PlayerSim, now: number) => applyInput(p, { seq: 1, dx: 0, dy: 0, attack: true, dodge: false }, now, TICK_MS);

function goblinAt(id: string, x: number, z: number): EnemySim {
  const e = createEnemy(id, "goblin", x, z);
  e.phase = "chase";
  return e;
}

function armed(weapon: WeaponGear): PlayerSim {
  const p = createPlayer("a", 0, 0);
  p.facing = 0; // facing +z
  p.weapon = weapon;
  return p;
}

describe("weapon classes", () => {
  it("everyone starts with the one-handed sword, which swings exactly as Phase 0's did", () => {
    const p = createPlayer("a");
    expect(weaponClassOf(p.weapon)).toBe("oneHand");
    expect(WEAPON_CLASSES.oneHand).toEqual({
      range: PLAYER.attackRange,
      arc: PLAYER.attackArc,
      windupMs: PLAYER.attackWindupMs,
      durationMs: PLAYER.attackDurationMs
    });
    p.facing = 0;
    swingAt(p, 100);
    expect(p.attackHitAt).toBe(100 + PLAYER.attackWindupMs);
    expect(p.attackUntil).toBe(100 + PLAYER.attackDurationMs);
  });

  it("classes come from the weapon type", () => {
    expect(weaponClassOf({ kind: "weapon", type: "dagger", tier: 1 })).toBe("oneHand");
    expect(weaponClassOf({ kind: "weapon", type: "claymore", tier: 1 })).toBe("twoHand");
    expect(weaponClassOf({ kind: "weapon", type: "greatClub", tier: 1 })).toBe("twoHand");
    expect(weaponClassOf({ kind: "weapon", type: "bow", tier: 1 })).toBe("bow");
  });

  it("a two-hander winds up longer and hits up to its cleave cap, nearest first", () => {
    const p = armed({ kind: "weapon", type: "claymore", tier: 1 });
    const pack = [goblinAt("e1", 0, 2.6), goblinAt("e2", 0.6, 1.2), goblinAt("e3", -0.6, 1.6), goblinAt("e4", 0.3, 2.0)];
    swingAt(p, 100);
    expect(p.attackHitAt).toBe(100 + WEAPON_CLASSES.twoHand.windupMs);
    expect(resolvePlayerAttacks([p], pack, 100 + PLAYER.attackWindupMs)).toEqual([]);
    const events = resolvePlayerAttacks([p], pack, 100 + WEAPON_CLASSES.twoHand.windupMs);
    const dmg = weaponStats(p.weapon, 1).damage;
    expect(events.map((e) => (e.kind === "playerHit" ? e.enemyId : e.kind))).toEqual(["e2", "e3", "e4"]);
    expect(pack.map((e) => GOBLIN.hp - e.hp)).toEqual([0, dmg, dmg, dmg]);
  });

  it("a war hammer hits one, a great axe two", () => {
    for (const [type, n] of [["warHammer", 1], ["greatAxe", 2]] as const) {
      const p = armed({ kind: "weapon", type, tier: 1 });
      const pack = [goblinAt("e1", 0, 1.2), goblinAt("e2", 0.6, 1.6), goblinAt("e3", -0.6, 1.8)];
      swingAt(p, 0);
      const hits = resolvePlayerAttacks([p], pack, WEAPON_CLASSES.twoHand.windupMs).filter((e) => e.kind === "playerHit");
      expect(hits).toHaveLength(n);
    }
  });

  it("the bow locks on to the nearest enemy in its narrow cone, far beyond a sword's reach", () => {
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    const far = goblinAt("e1", 0.5, 10);
    const wide = goblinAt("e2", 4, 4); // 45 degrees off: outside the bow's cone
    swingAt(p, 0);
    const events = resolvePlayerAttacks([p], [far, wide], WEAPON_CLASSES.bow.windupMs);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "playerHit", enemyId: "e1", damage: weaponStats(p.weapon, 1).damage });
    expect(wide.hp).toBe(GOBLIN.hp);
    // The sword cannot reach the same goblin.
    const s = armed({ kind: "weapon", type: "sword", tier: 1 });
    swingAt(s, 0);
    expect(resolvePlayerAttacks([s], [far], PLAYER.attackWindupMs)).toEqual([]);
  });

  it("the bow needs a clear line: a wall hides the nearest goblin and it takes the next one it can see", () => {
    const walled: Level = { ...OPEN_FIELD, walls: [{ x: 0, z: 4, hw: 1, hd: 0.3 }] };
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    const hidden = goblinAt("e1", 0, 6);
    const seen = goblinAt("e2", 3, 9);
    swingAt(p, 0);
    const events = resolvePlayerAttacks([p], [hidden, seen], WEAPON_CLASSES.bow.windupMs, walled);
    expect(events.map((e) => (e.kind === "playerHit" ? e.enemyId : ""))).toEqual(["e2"]);
    expect(hidden.hp).toBe(GOBLIN.hp);
  });

  it("the room's portal tier caps the weapon, through stepEncounter", () => {
    const veteranSword: WeaponGear = { kind: "weapon", type: "sword", tier: 5 };
    for (const tier of [1, 3]) {
      const level: Level = { ...OPEN_FIELD, tier, enemies: [{ kind: "goblin", x: 0, z: 1.5, facing: Math.PI }] };
      const enc = createEncounter(level);
      const p = armed(veteranSword);
      swingAt(p, 1000);
      const events = stepEncounter(enc, new Map([["a", p]]), 1000 + PLAYER.attackWindupMs, TICK_MS);
      const hit = events.find((e) => e.kind === "playerHit");
      expect(hit).toMatchObject({ damage: weaponStats(veteranSword, tier).damage });
    }
    expect(weaponStats(veteranSword, 1).damage).toBe(27);
    expect(weaponStats(veteranSword, 3).damage).toBe(Math.round(22 * 0.825 * 3));
  });

  it("prediction and server agree on a two-hander's commitment", () => {
    const client = armed({ kind: "weapon", type: "greatAxe", tier: 2 });
    const server = armed({ kind: "weapon", type: "greatAxe", tier: 2 });
    for (let i = 0; i < 20; i++) {
      const input = { seq: i + 1, dx: i % 3 === 0 ? 1 : 0, dy: 0.5, attack: i % 7 === 0, dodge: false };
      applyInput(client, input, i * TICK_MS, TICK_MS);
      applyInput(server, input, i * TICK_MS, TICK_MS);
    }
    expect(client).toEqual(server);
  });
});
