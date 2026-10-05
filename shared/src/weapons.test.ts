import { describe, expect, it } from "vitest";
import {
  GOBLIN,
  PLAYER,
  TICK_MS,
  WEAPON_CLASSES,
  ABILITIES,
  LOCK_ON,
  abilityInSlot,
  applyInput,
  cycleLock,
  dropStaleLocks,
  isValidInput,
  lockCandidates,
  rainSpot,
  createEncounter,
  createEnemy,
  createPlayer,
  resolvePlayerAttacks,
  slotsFor,
  stepEncounter,
  type EnemySim,
  type PlayerSim
} from "./sim";
import { OPEN_FIELD, type Level } from "./level";
import { PICKABLE_WEAPONS, STARTER_WEAPON, WEAPON_TYPES, weaponClassOf, weaponFromPick, weaponStats, type WeaponGear } from "./gear";

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

describe("the weapon pick (Michael, A, 2026-10-05)", () => {
  it("takes any weapon type at any material tier", () => {
    expect(PICKABLE_WEAPONS).toContain("claymore");
    expect(PICKABLE_WEAPONS).toContain("bow");
    expect(PICKABLE_WEAPONS.length).toBe(Object.keys(WEAPON_TYPES).length);
    expect(weaponFromPick("claymore", 5)).toEqual({ kind: "weapon", type: "claymore", tier: 5 });
    expect(weaponFromPick("bow", "3")).toEqual({ kind: "weapon", type: "bow", tier: 3 });
  });

  it("turns anything else into something real: the sword for an unknown type, a clamped tier", () => {
    expect(weaponFromPick("laser", 2)).toEqual(STARTER_WEAPON);
    expect(weaponFromPick(undefined, undefined)).toEqual(STARTER_WEAPON);
    expect(weaponFromPick("toString", 1)).toEqual(STARTER_WEAPON);
    expect(weaponFromPick({ type: "claymore" }, 1)).toEqual(STARTER_WEAPON);
    expect(weaponFromPick("claymore", 99).tier).toBe(10);
    expect(weaponFromPick("claymore", -4).tier).toBe(1);
    expect(weaponFromPick("claymore", 2.7).tier).toBe(2);
    expect(weaponFromPick("claymore", "x").tier).toBe(1);
    expect(weaponFromPick("claymore", Infinity).tier).toBe(1);
    // A fresh object each time: the caller may change it without touching the starter.
    expect(weaponFromPick("laser", 1)).not.toBe(STARTER_WEAPON);
  });

  it("melee weapons carry Cleave in slot 1, the bow Arrow rain", () => {
    expect(slotsFor({ kind: "weapon", type: "sword", tier: 1 })).toEqual(["cleave", "", ""]);
    expect(slotsFor({ kind: "weapon", type: "warHammer", tier: 4 })).toEqual(["cleave", "", ""]);
    expect(slotsFor({ kind: "weapon", type: "bow", tier: 1 })).toEqual(["arrowRain", "", ""]);
    expect(abilityInSlot({ kind: "weapon", type: "bow", tier: 1 }, 1)).toBe("arrowRain");
    expect(abilityInSlot({ kind: "weapon", type: "bow", tier: 1 }, 2)).toBe("");
  });

  it("an archer pressing 2 starts nothing and spends no cooldown, the same on both sides", () => {
    const server = armed({ kind: "weapon", type: "bow", tier: 1 });
    const client = armed({ kind: "weapon", type: "bow", tier: 1 });
    const frame = { seq: 1, dx: 0, dy: 0, attack: false, dodge: false, ability: 2 };
    applyInput(server, frame, 100, TICK_MS);
    applyInput(client, frame, 100, TICK_MS);
    expect(server.abilityUntil).toBe(0);
    expect(server.readyAt).toEqual([0, 0, 0]);
    expect(client).toEqual(server);
  });
});

describe("the bow's lock-on cycle", () => {
  // The archer stands at the origin facing +z. A wall at z = -4 hides (0, -6); (0, 20) is out of range.
  const walled: Level = { ...OPEN_FIELD, walls: [{ x: 0, z: -4, hw: 1, hd: 0.3 }] };
  const pack = () => [goblinAt("ahead", 0, 3), goblinAt("back", -3, -3), goblinAt("side", 9, 0), goblinAt("walled", 0, -6), goblinAt("far", 0, 20)];
  const bow = () => armed({ kind: "weapon", type: "bow", tier: 1 });

  it("cycles nearest first through every enemy in range and sight, in any direction, then back to auto", () => {
    const p = bow();
    const enemies = pack();
    expect(lockCandidates(p, enemies, walled).map((e) => e.id)).toEqual(["ahead", "back", "side"]);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      cycleLock(p, enemies, walled);
      seen.push(p.lockId);
    }
    expect(seen).toEqual(["ahead", "back", "side", "", "ahead"]);
  });

  it("only a bow locks on", () => {
    const p = armed({ kind: "weapon", type: "claymore", tier: 1 });
    p.lockId = "ahead";
    cycleLock(p, pack(), walled);
    expect(p.lockId).toBe("");
  });

  it("a locked shot goes to the lock wherever the archer faces", () => {
    const p = bow();
    const enemies = pack();
    p.lockId = "back"; // behind and to the left; "ahead" is in the cone
    swingAt(p, 0);
    const events = resolvePlayerAttacks([p], enemies, WEAPON_CLASSES.bow.windupMs, walled);
    expect(events.filter((e) => e.kind === "playerHit").map((e) => (e.kind === "playerHit" ? e.enemyId : ""))).toEqual(["back"]);
    expect(enemies[0].hp).toBe(GOBLIN.hp);
  });

  it("a lock out of sight falls back to the cone without letting go", () => {
    const p = bow();
    const enemies = pack();
    p.lockId = "walled";
    swingAt(p, 0);
    const events = resolvePlayerAttacks([p], enemies, WEAPON_CLASSES.bow.windupMs, walled);
    expect(events.find((e) => e.kind === "playerHit")).toMatchObject({ enemyId: "ahead" });
    expect(p.lockId).toBe("walled");
  });

  it("the lock lets go when its enemy dies or gets well out of range", () => {
    const p = bow();
    const enemies = pack();
    const byId = new Map(enemies.map((e) => [e.id, e]));
    p.lockId = "side";
    dropStaleLocks([p], byId);
    expect(p.lockId).toBe("side");
    byId.get("side")!.x = WEAPON_CLASSES.bow.range * LOCK_ON.keepRangeMult + 1;
    dropStaleLocks([p], byId);
    expect(p.lockId).toBe("");
    p.lockId = "ahead";
    byId.get("ahead")!.hp = 0;
    byId.get("ahead")!.phase = "dead";
    dropStaleLocks([p], byId);
    expect(p.lockId).toBe("");
  });

  it("a cycle press is a valid input and prediction ignores it", () => {
    const frame = { seq: 1, dx: 0.5, dy: 0, attack: false, dodge: false, cycle: true };
    expect(isValidInput(frame)).toBe(true);
    expect(isValidInput({ ...frame, cycle: "yes" })).toBe(false);
    const a = bow();
    const b = bow();
    applyInput(a, frame, 100, TICK_MS);
    applyInput(b, { ...frame, cycle: false }, 100, TICK_MS);
    expect(a).toEqual(b);
  });
});

describe("Arrow rain", () => {
  const rain = ABILITIES.arrowRain;
  const cast = (p: PlayerSim, now: number) => applyInput(p, { seq: 1, dx: 0, dy: 0, attack: false, dodge: false, ability: 1 }, now, TICK_MS);
  const landAt = 100 + rain.windupMs;

  it("falls on the lock and hits everyone under it, once each, then cools down", () => {
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    // A pack of three behind the archer at about 8 m, one more 6 m off to the side.
    const enemies = [goblinAt("g1", 0, -8), goblinAt("g2", 1.5, -8.5), goblinAt("g3", -1, -9.5), goblinAt("g4", 6, -8)];
    p.lockId = "g1";
    cast(p, 100);
    expect(p.abilityHitAt).toBe(landAt);
    expect(p.readyAt[0]).toBe(100 + rain.cooldownMs);
    expect(resolvePlayerAttacks([p], enemies, landAt - TICK_MS, OPEN_FIELD)).toEqual([]);
    const events = resolvePlayerAttacks([p], enemies, landAt, OPEN_FIELD);
    expect(events[0]).toEqual({ kind: "arrowRain", playerId: "a", x: 0, z: -8, hits: 3 });
    const hits = events.filter((e) => e.kind === "abilityHit").map((e) => (e.kind === "abilityHit" ? e.enemyId : ""));
    expect(hits).toEqual(["g1", "g2", "g3"]);
    expect(enemies[0].hp).toBe(GOBLIN.hp - rain.damage);
    expect(enemies[3].hp).toBe(GOBLIN.hp);
    expect(resolvePlayerAttacks([p], enemies, landAt + TICK_MS, OPEN_FIELD)).toEqual([]);
  });

  it("without a lock it takes the bow's auto target, and with nothing in sight it falls ahead and hits nobody", () => {
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    const ahead = goblinAt("ahead", 0.5, 9);
    cast(p, 100);
    expect(resolvePlayerAttacks([p], [ahead], landAt, OPEN_FIELD)[0]).toMatchObject({ kind: "arrowRain", x: 0.5, z: 9, hits: 1 });
    const q = armed({ kind: "weapon", type: "bow", tier: 1 });
    const behind = goblinAt("behind", 0, -6);
    cast(q, 100);
    const events = resolvePlayerAttacks([q], [behind], landAt, OPEN_FIELD);
    expect(events).toEqual([{ kind: "arrowRain", playerId: "a", x: 0, z: rain.aheadM, hits: 0 }]);
    expect(behind.hp).toBe(GOBLIN.hp);
  });

  it("lands in full on a raised shield, since it comes from above", () => {
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    const sb = createEnemy("sb", "shieldbearer", 0, 8);
    sb.facing = Math.PI; // facing the archer, shield up
    expect(sb.guardUp).toBe(true);
    cast(p, 100);
    resolvePlayerAttacks([p], [sb], landAt, OPEN_FIELD);
    expect(sb.hp).toBe(sb.maxHp - rain.damage);
  });

  it("a lock behind a wall is not where it falls", () => {
    const walled: Level = { ...OPEN_FIELD, walls: [{ x: 0, z: -4, hw: 1, hd: 0.3 }] };
    const p = armed({ kind: "weapon", type: "bow", tier: 1 });
    p.lockId = "hid";
    const spot = rainSpot(p, [goblinAt("hid", 0, -6)], walled);
    expect(spot).toEqual({ x: 0, z: rain.aheadM });
  });
});
