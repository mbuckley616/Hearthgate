import { describe, expect, it } from "vitest";
import {
  DOWNS,
  ENEMY_KINDS,
  PLAYER,
  SPAWN_POINTS,
  STAIRS,
  TICK_MS,
  applyInput,
  createEncounter,
  createPlayer,
  downPlayer,
  isEnemyAlive,
  stepEncounter,
  type Encounter,
  type PlayerSim,
  type SimEvent
} from "./sim";
import { WARRENS, YARD, collideWalls, lineClear, roomAt } from "./level";

let seq = 0;
let clock = 1000;

/** Kill these enemies one by one: the killer stands next to each, facing it, and swings. */
function kill(enc: Encounter, ids: string[], killer: PlayerSim, players: Map<string, PlayerSim>): SimEvent[] {
  const events: SimEvent[] = [];
  for (const id of ids) {
    const e = enc.enemies.get(id)!;
    e.hp = 1;
    e.phase = "recover";
    e.phaseUntil = 1e12; // holds still for the test
    const back = Math.atan2(killer.x - e.x, killer.z - e.z);
    killer.x = e.x + Math.sin(back) * 1.4;
    killer.z = e.z + Math.cos(back) * 1.4;
    killer.facing = back + Math.PI;
    clock += 1000;
    applyInput(killer, { seq: ++seq, dx: 0, dy: 0, attack: true, dodge: false }, clock, TICK_MS);
    clock += PLAYER.attackWindupMs;
    events.push(...stepEncounter(enc, players, clock, TICK_MS));
    expect(isEnemyAlive(e)).toBe(false);
  }
  return events;
}

const idsIn = (enc: Encounter, room: number) => [...enc.enemies.values()].filter((e) => e.room === room).map((e) => e.id);

describe("the Goblin Warrens", () => {
  it("is three rooms off a hall: every enemy in a room, the spawns and the stairs in the hall, nothing in a wall", () => {
    const enc = createEncounter(WARRENS);
    expect(WARRENS.rooms).toHaveLength(3);
    for (let r = 0; r < 3; r++) expect(idsIn(enc, r).length).toBeGreaterThan(0);
    for (const e of enc.enemies.values()) {
      expect(e.room).toBeGreaterThanOrEqual(0);
      const o = { x: e.x, z: e.z };
      collideWalls(o, ENEMY_KINDS[e.kind].radius, WARRENS);
      expect(o).toEqual({ x: e.x, z: e.z });
    }
    for (const s of SPAWN_POINTS) {
      expect(roomAt(WARRENS, s.x, s.z)).toBe(-1);
      const o = { x: s.x, z: s.z };
      collideWalls(o, PLAYER.radius, WARRENS);
      expect(o).toEqual({ x: s.x, z: s.z });
    }
    expect(roomAt(WARRENS, WARRENS.stairs!.x, WARRENS.stairs!.z)).toBe(-1);
  });

  it("doorways connect the hall to the guard room and the pens, and the guard room to the den", () => {
    expect(lineClear({ x: -10, z: 6 }, { x: -10, z: 10 }, WARRENS)).toBe(true);
    expect(lineClear({ x: -3, z: 6 }, { x: -3, z: 10 }, WARRENS)).toBe(false);
    expect(lineClear({ x: 10, z: -6 }, { x: 10, z: -10 }, WARRENS)).toBe(true);
    expect(lineClear({ x: 0, z: -6 }, { x: 0, z: -10 }, WARRENS)).toBe(false);
    expect(lineClear({ x: -2, z: 14.5 }, { x: 2, z: 14.5 }, WARRENS)).toBe(true);
    expect(lineClear({ x: 10, z: 6 }, { x: 10, z: 10 }, WARRENS)).toBe(false); // the den has no door to the hall
  });

  it("every room sleeps while the party waits in the hall", () => {
    const enc = createEncounter(WARRENS);
    const players = new Map(SPAWN_POINTS.slice(0, 4).map((s, i) => [`p${i}`, createPlayer(`p${i}`, s.x, s.z)]));
    for (let t = 0; t < 2000; t += TICK_MS) stepEncounter(enc, players, t, TICK_MS);
    expect([...enc.enemies.values()].every((e) => e.phase === "idle")).toBe(true);
  });

  it("each room clears on its own: the downed get up, the stairs stay shut until the last room", () => {
    const enc = createEncounter(WARRENS);
    const a = createPlayer("a", 0, 0);
    const b = createPlayer("b", 2, 0);
    const players = new Map([["a", a], ["b", b]]);
    downPlayer(b, clock);
    const first = kill(enc, idsIn(enc, 0), a, players);
    expect(first).toContainEqual({ kind: "roomCleared", byId: "a", room: "the guard room" });
    expect(b.hp).toBe(DOWNS.pickupHp);
    expect(enc.stairsOpen).toBe(false);
    expect(first.some((e) => e.kind === "floorCleared")).toBe(false);
    kill(enc, idsIn(enc, 1), a, players);
    expect(enc.stairsOpen).toBe(false);
    const last = kill(enc, idsIn(enc, 2), a, players);
    expect(last).toContainEqual({ kind: "roomCleared", byId: "a", room: "the pens" });
    expect(last).toContainEqual({ kind: "floorCleared" });
    expect(enc.stairsOpen).toBe(true);
    expect(enc.resetAt).toBe(0); // the stairs replace the timed reset
  });

  it("everyone standing on the open stairs for two seconds takes the party up, once: the floor is left as it is", () => {
    const enc = createEncounter(WARRENS);
    const a = createPlayer("a", 0, 0);
    const b = createPlayer("b", 0, 0);
    const players = new Map([["a", a], ["b", b]]);
    kill(enc, [...enc.enemies.keys()], a, players);
    const s = WARRENS.stairs!;
    a.x = s.x + 1;
    a.z = s.z;
    b.x = s.x + STAIRS.radius + 1; // one player still off the stairs: nobody goes
    b.z = s.z;
    let events: SimEvent[] = [];
    for (let i = 0; i < 60; i++) events.push(...stepEncounter(enc, players, (clock += TICK_MS), TICK_MS));
    expect(events.some((e) => e.kind === "stairsTaken")).toBe(false);
    expect(enc.descendMs).toBe(0);
    b.x = s.x - 1;
    events = [];
    for (let t = 0; t < STAIRS.holdMs; t += TICK_MS) events.push(...stepEncounter(enc, players, (clock += TICK_MS), TICK_MS));
    expect(events.filter((e) => e.kind === "stairsTaken")).toHaveLength(1);
    expect(enc.departed).toBe(true);
    // The hand-off is the server's: the floor stays as the party left it, and the stairs do not fire again.
    expect(enc.stairsOpen).toBe(true);
    expect([...enc.enemies.values()].every(isEnemyAlive)).toBe(false);
    events = [];
    for (let t = 0; t < STAIRS.holdMs * 2; t += TICK_MS) events.push(...stepEncounter(enc, players, (clock += TICK_MS), TICK_MS));
    expect(events.some((e) => e.kind === "stairsTaken")).toBe(false);
  });

  it("the dead do not hold the party off the stairs", () => {
    const enc = createEncounter(WARRENS);
    const a = createPlayer("a", 0, 0);
    const ghost = createPlayer("g", 15, 0);
    const players = new Map([["a", a], ["g", ghost]]);
    kill(enc, [...enc.enemies.keys()], a, players);
    ghost.hp = 0; // bled out, waiting on a respawn
    ghost.respawnAt = 1e12;
    a.x = 0;
    a.z = 0;
    const events: SimEvent[] = [];
    for (let t = 0; t < STAIRS.holdMs; t += TICK_MS) events.push(...stepEncounter(enc, players, (clock += TICK_MS), TICK_MS));
    expect(events.some((e) => e.kind === "stairsTaken")).toBe(true);
  });

  it("a level without stairs still resets on a timer", () => {
    const enc = createEncounter(YARD);
    const a = createPlayer("a", 0, 0);
    const players = new Map([["a", a]]);
    const events = kill(enc, [...enc.enemies.keys()], a, players);
    expect(events.filter((e) => e.kind === "roomCleared")).toHaveLength(1);
    expect(enc.stairsOpen).toBe(false);
    expect(enc.resetAt).toBeGreaterThan(0);
  });
});
