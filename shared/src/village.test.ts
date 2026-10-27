import { describe, expect, it } from "vitest";
import {
  BUILDING_WALL_H,
  CELLAR,
  LEVELS,
  VILLAGE,
  VILLAGE_LEVEL_ID,
  buildingWalls,
  collideWalls,
  levelById,
  lineClear,
  type Building
} from "./level";
import {
  NPC,
  PLAYER,
  PORTAL,
  SPAWN_POINTS,
  TICK_MS,
  applyInput,
  createEncounter,
  createPlayer,
  neutralInput,
  stepEncounter,
  stepPortal,
  talkToNpc,
  type SimEvent
} from "./sim";

const walk = (p: ReturnType<typeof createPlayer>, dx: number, dy: number, from: number, ticks: number) => {
  let t = from;
  for (let i = 0; i < ticks; i++) {
    t += TICK_MS;
    applyInput(p, { ...neutralInput(i + 1), dx, dy }, t, TICK_MS, VILLAGE);
  }
  return t;
};

describe("a greybox building", () => {
  const hut: Building = { name: "Hut", x: 10, z: 10, hw: 3, hd: 2, door: { x: 10, z: 8, facing: Math.PI } };

  it("is four faces with a doorway in the one the door is on, all at the given height", () => {
    const walls = buildingWalls(hut, 3);
    expect(walls).toHaveLength(5);
    for (const w of walls) expect(w.h).toBe(3);
    // Through the door: clear. Through the wall beside it, and the back wall: blocked.
    expect(lineClear({ x: 10, z: 6 }, { x: 10, z: 10 }, { ...VILLAGE, walls })).toBe(true);
    expect(lineClear({ x: 12, z: 6 }, { x: 12, z: 10 }, { ...VILLAGE, walls })).toBe(false);
    expect(lineClear({ x: 10, z: 10 }, { x: 10, z: 14 }, { ...VILLAGE, walls })).toBe(false);
    expect(lineClear({ x: 6, z: 10 }, { x: 10, z: 10 }, { ...VILLAGE, walls })).toBe(false);
    expect(lineClear({ x: 10, z: 10 }, { x: 14, z: 10 }, { ...VILLAGE, walls })).toBe(false);
  });

  it("puts the doorway on an east or west face when the door is there", () => {
    const walls = buildingWalls({ ...hut, door: { x: 13, z: 10, facing: Math.PI / 2 } }, 3);
    expect(walls).toHaveLength(5);
    expect(lineClear({ x: 15, z: 10 }, { x: 10, z: 10 }, { ...VILLAGE, walls })).toBe(true);
    expect(lineClear({ x: 10, z: 6 }, { x: 10, z: 10 }, { ...VILLAGE, walls })).toBe(false);
  });

  it("a player walks in through the door and is stopped by the wall beside it", () => {
    const level = { ...VILLAGE, walls: buildingWalls(hut, 3) };
    const inDoor = createPlayer("a", 10, 5);
    for (let i = 0; i < 90; i++) applyInput(inDoor, { ...neutralInput(i + 1), dy: 1 }, (i + 1) * TICK_MS, TICK_MS, level);
    expect(inDoor.z).toBeGreaterThan(9);
    const atWall = createPlayer("b", 12, 5);
    for (let i = 0; i < 90; i++) applyInput(atWall, { ...neutralInput(i + 1), dy: 1 }, (i + 1) * TICK_MS, TICK_MS, level);
    expect(atWall.z).toBeCloseTo(8 - 0.2 - PLAYER.radius, 6);
  });
});

describe("the village", () => {
  it("is the level the client joins first: four named buildings, a villager at each door, a portal to the Warrens, no enemies", () => {
    expect(levelById(VILLAGE_LEVEL_ID)).toBe(VILLAGE);
    expect(VILLAGE.enemies).toHaveLength(0);
    expect(VILLAGE.buildings!.map((b) => b.name)).toEqual(["Portal Shrine", "General Store", "Storehouse", "Tavern"]);
    expect(VILLAGE.npcs).toHaveLength(4);
    for (const b of VILLAGE.buildings!) {
      const npc = VILLAGE.npcs!.find((n) => Math.hypot(n.x - b.door.x, n.z - b.door.z) < 4);
      expect(npc, `a villager by the ${b.name}'s door`).toBeDefined();
    }
    expect(VILLAGE.portal).toEqual({ x: 0, z: -9.5, to: "warrens" });
    expect(LEVELS[VILLAGE.portal!.to].stairs).toBeDefined();
    for (const w of VILLAGE.walls) expect(w.h).toBe(BUILDING_WALL_H);
  });

  it("keeps the spawns, the villagers and the portal out of its walls, and the spawns off the portal", () => {
    const portal = VILLAGE.portal!;
    for (const s of SPAWN_POINTS) {
      const o = { x: s.x, z: s.z };
      collideWalls(o, PLAYER.radius, VILLAGE);
      expect(o).toEqual({ x: s.x, z: s.z });
      expect(Math.hypot(s.x - portal.x, s.z - portal.z)).toBeGreaterThan(PORTAL.radius);
    }
    for (const n of VILLAGE.npcs!) {
      const o = { x: n.x, z: n.z };
      collideWalls(o, PLAYER.radius, VILLAGE);
      expect(o).toEqual({ x: n.x, z: n.z });
    }
    const o = { x: portal.x, z: portal.z };
    collideWalls(o, PORTAL.radius, VILLAGE);
    expect(o).toEqual({ x: portal.x, z: portal.z });
  });

  it("every door can be reached from the square, and every building is closed on its other sides", () => {
    for (const b of VILLAGE.buildings!) {
      const out = { x: b.door.x + Math.sin(b.door.facing) * 2, z: b.door.z + Math.cos(b.door.facing) * 2 };
      expect(lineClear({ x: 0, z: 0 }, out, VILLAGE), `the way to the ${b.name}`).toBe(true);
      expect(lineClear(out, { x: b.x, z: b.z }, VILLAGE), `through the ${b.name}'s door`).toBe(true);
      const back = { x: b.x - Math.sin(b.door.facing) * (b.hw + b.hd), z: b.z - Math.cos(b.door.facing) * (b.hw + b.hd) };
      expect(lineClear(back, { x: b.x, z: b.z }, VILLAGE), `the ${b.name}'s back wall`).toBe(false);
    }
  });

  it("a player who presses use beside a villager talks to them; too far, or downed, and nothing", () => {
    const keeper = VILLAGE.npcs![0];
    const p = createPlayer("a", keeper.x - NPC.talkRange + 0.1, keeper.z);
    expect(talkToNpc(p, VILLAGE)?.id).toBe(keeper.id);
    p.x = keeper.x - NPC.talkRange - 0.1;
    expect(talkToNpc(p, VILLAGE)).toBeNull();
    p.x = keeper.x - 1;
    p.hp = 0;
    p.downedUntil = 1e12;
    expect(talkToNpc(p, VILLAGE)).toBeNull();
    expect(talkToNpc(createPlayer("b", 0, 0), CELLAR)).toBeNull();
  });

  it("walking from the square to the keeper's door takes the party past the portal, which only fires when everyone holds it", () => {
    const enc = createEncounter(VILLAGE);
    const a = createPlayer("a", SPAWN_POINTS[0].x, SPAWN_POINTS[0].z);
    const b = createPlayer("b", SPAWN_POINTS[1].x, SPAWN_POINTS[1].z);
    const players = new Map([["a", a], ["b", b]]);
    const portal = VILLAGE.portal!;
    // Straight at the portal from the first spawn at 6 m/s (0.1 m a tick), stopping about 0.6 m short of its centre.
    const d = Math.hypot(portal.x - a.x, portal.z - a.z);
    const perTick = (PLAYER.speed * TICK_MS) / 1000;
    let t = walk(a, (portal.x - a.x) / d, (portal.z - a.z) / d, 0, Math.floor((d - 0.6) / perTick));
    expect(Math.hypot(a.x - portal.x, a.z - portal.z)).toBeLessThan(1);
    let events: SimEvent[] = [];
    for (let i = 0; i < 60; i++) events.push(...stepEncounter(enc, players, (t += TICK_MS), TICK_MS));
    expect(events.some((e) => e.kind === "portalTaken")).toBe(false);
    expect(enc.portalMs).toBe(0);
    b.x = portal.x;
    b.z = portal.z;
    events = [];
    for (let i = 0; i * TICK_MS < PORTAL.holdMs; i++) events.push(...stepEncounter(enc, players, (t += TICK_MS), TICK_MS));
    expect(events.filter((e) => e.kind === "portalTaken")).toEqual([{ kind: "portalTaken", to: "warrens" }]);
    expect(enc.departed).toBe(true);
    // Once: the hand-off belongs to the server now.
    events = [];
    for (let i = 0; i < 80; i++) events.push(...stepEncounter(enc, players, (t += TICK_MS), TICK_MS));
    expect(events.some((e) => e.kind === "portalTaken")).toBe(false);
    enc.departed = false; // the server does this when a hand-off fails, and the portal works again
    enc.portalMs = 0;
    events = [];
    for (let i = 0; i * TICK_MS < PORTAL.holdMs; i++) events.push(...stepPortal(enc, players, TICK_MS));
    expect(events).toHaveLength(1);
  });

  it("stepping off resets the hold, and the dead do not hold the party back", () => {
    const enc = createEncounter(VILLAGE);
    const portal = VILLAGE.portal!;
    const a = createPlayer("a", portal.x, portal.z);
    const ghost = createPlayer("g", 0, 0);
    ghost.hp = 0;
    ghost.respawnAt = 1e12;
    const players = new Map([["a", a], ["g", ghost]]);
    for (let i = 0; i < 10; i++) stepPortal(enc, players, TICK_MS);
    expect(enc.portalMs).toBeCloseTo(10 * TICK_MS, 9);
    a.x = portal.x + PORTAL.radius + 0.1;
    stepPortal(enc, players, TICK_MS);
    expect(enc.portalMs).toBe(0);
    a.x = portal.x;
    const events: SimEvent[] = [];
    for (let i = 0; i * TICK_MS < PORTAL.holdMs; i++) events.push(...stepPortal(enc, players, TICK_MS));
    expect(events).toEqual([{ kind: "portalTaken", to: "warrens" }]);
  });

  it("the cellar is one goblin and the stairs, clear of the spawns", () => {
    expect(CELLAR.enemies).toHaveLength(1);
    expect(CELLAR.stairs).toEqual({ x: 0, z: 0 });
    for (const s of SPAWN_POINTS) expect(Math.hypot(s.x - CELLAR.enemies[0].x, s.z - CELLAR.enemies[0].z)).toBeGreaterThan(5);
  });
});
