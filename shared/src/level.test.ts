import { describe, expect, it } from "vitest";
import { OPEN_FIELD, YARD, collideWalls, levelById, lineClear, type Level } from "./level";
import {
  ENEMY_KINDS,
  GOBLIN,
  PLAYER,
  ROOM,
  SPAWN_POINTS,
  TICK_MS,
  TICK_RATE,
  applyInput,
  createEncounter,
  createPlayer,
  isEnemyAlive,
  neutralInput,
  separateEnemies,
  stepEncounter,
  stepEnemies,
  type EnemySim,
  type PlayerSim
} from "./sim";

const PEN: Level = {
  id: "pen",
  name: "A pen",
  halfW: 10,
  halfD: 10,
  walls: [{ x: 0, z: 3, hw: 4, hd: 0.4 }],
  enemies: [
    { kind: "goblin", x: 0, z: 6, facing: Math.PI },
    { kind: "goblin", x: 0.2, z: 6, facing: Math.PI },
    { kind: "goblin", x: 8, z: 8, facing: Math.PI }
  ]
};

const walk = (p: PlayerSim, dx: number, dy: number, from: number, ticks: number, level: Level) => {
  let t = from;
  for (let i = 0; i < ticks; i++) {
    t += TICK_MS;
    applyInput(p, { ...neutralInput(i + 1), dx, dy }, t, TICK_MS, level);
  }
  return t;
};

describe("walls", () => {
  it("a player walking into a wall stops at its face and slides along it", () => {
    const p = createPlayer("a", 0, 0);
    walk(p, 0, 1, 0, 2 * TICK_RATE, PEN); // 2 s north at 6 m/s would be 12 m; the wall's face is at z = 2.6
    expect(p.z).toBeCloseTo(3 - 0.4 - PLAYER.radius, 6);
    expect(p.x).toBeCloseTo(0, 6);
    walk(p, 1, 1, 2000, TICK_RATE / 2, PEN); // diagonal into the wall: the x component still moves
    expect(p.z).toBeCloseTo(3 - 0.4 - PLAYER.radius, 6);
    expect(p.x).toBeGreaterThan(1.5);
  });

  it("a dodge cannot pass through a wall", () => {
    const p = createPlayer("a", 0, 1.9);
    applyInput(p, { ...neutralInput(1), dy: 1, dodge: true }, 50, TICK_MS, PEN);
    for (let i = 2; i <= 8; i++) applyInput(p, { ...neutralInput(i), dy: 1 }, 50 * i, TICK_MS, PEN);
    expect(p.z).toBeLessThanOrEqual(3 - 0.4 - PLAYER.radius + 1e-9);
  });

  it("walking round the end of the wall gets past it", () => {
    const p = createPlayer("a", 5, 0);
    walk(p, 0, 1, 0, 2 * TICK_RATE, PEN);
    expect(p.z).toBeGreaterThan(5);
  });

  it("the bounds still hold and the open field matches the old arena", () => {
    const p = createPlayer("a", 0, 0);
    walk(p, 1, 0, 0, 200, OPEN_FIELD);
    expect(p.x).toBeCloseTo(OPEN_FIELD.halfW - PLAYER.radius, 6);
    const o = { x: 25, z: -25 };
    collideWalls(o, 0.5, OPEN_FIELD);
    expect(o).toEqual({ x: 19.5, z: -19.5 });
  });

  it("a circle that lands inside a wall leaves by the nearest face", () => {
    const o = { x: 1, z: 3.3 }; // inside the pen's wall, nearer its north face
    collideWalls(o, 0.5, PEN);
    expect(o.z).toBeCloseTo(3 + 0.4 + 0.5, 6);
    expect(o.x).toBe(1);
  });

  it("prediction and truth agree through a wall: identical frames give identical positions", () => {
    const run = () => {
      const p = createPlayer("a", -2, 0);
      let t = 0;
      for (let i = 1; i <= 60; i++) {
        t += TICK_MS;
        applyInput(p, { ...neutralInput(i), dx: i % 7 === 0 ? -1 : 0.6, dy: 1, dodge: i === 10 }, t, TICK_MS, PEN);
      }
      return JSON.stringify(p);
    };
    expect(run()).toBe(run());
  });

  it("line of sight: clear across the open field, blocked by a wall", () => {
    expect(lineClear({ x: 0, z: 0 }, { x: 0, z: 6 }, OPEN_FIELD)).toBe(true);
    expect(lineClear({ x: 0, z: 0 }, { x: 0, z: 6 }, PEN)).toBe(false);
    expect(lineClear({ x: 6, z: 0 }, { x: 6, z: 6 }, PEN)).toBe(true);
    expect(lineClear({ x: -6, z: 2 }, { x: 6, z: 4 }, PEN)).toBe(false);
  });

  it("the yard keeps every player spawn clear of its walls and inside its bounds", () => {
    for (const s of SPAWN_POINTS) {
      const o = { x: s.x, z: s.z };
      collideWalls(o, PLAYER.radius + 1, YARD);
      expect(o).toEqual({ x: s.x, z: s.z });
    }
    for (const e of YARD.enemies) {
      const o = { x: e.x, z: e.z };
      collideWalls(o, GOBLIN.radius, YARD);
      expect(o).toEqual({ x: e.x, z: e.z });
    }
    expect(levelById("nope")).toBe(OPEN_FIELD);
    expect(levelById("yard")).toBe(YARD);
  });
});

describe("many enemies", () => {
  const players = (...ps: PlayerSim[]) => new Map(ps.map((p) => [p.id, p]));

  it("every goblin in range and in sight chases; the far one, and any behind a wall, stay idle", () => {
    const enc = createEncounter(PEN);
    const p = createPlayer("a", -6, 4.5); // north of the wall's end, in plain sight of the pair
    const ps = players(p);
    let t = 0;
    for (let i = 0; i < 10; i++) stepEnemies(enc.enemies.values(), ps, (t += TICK_MS), TICK_MS, PEN);
    const [e1, e2, e3] = [...enc.enemies.values()];
    expect(e1.phase).toBe("chase");
    expect(e2.phase).toBe("chase");
    expect(e3.phase).toBe("idle"); // (8, 8) to (-6, 4.5) is 14.4 m, beyond the goblin's 14 m aggro
    // The same pair with the wall between them and the player: they never wake.
    const hidden = createEncounter(PEN);
    const q = createPlayer("a", 0, -7);
    for (let i = 0; i < 10; i++) stepEnemies(hidden.enemies.values(), players(q), (t += TICK_MS), TICK_MS, PEN);
    expect([...hidden.enemies.values()].map((e) => e.phase)).toEqual(["idle", "idle", "idle"]);
  });

  it("goblins do not stand inside each other, and do not get pushed into a wall", () => {
    const enc = createEncounter(PEN);
    const [e1, e2] = [...enc.enemies.values()];
    separateEnemies(enc.enemies.values(), PEN);
    const gap = Math.hypot(e1.x - e2.x, e1.z - e2.z);
    expect(gap).toBeGreaterThanOrEqual(2 * ENEMY_KINDS.goblin.radius - 1e-9);
    // A goblin in a crowd is parted deterministically.
    const again = createEncounter(PEN);
    separateEnemies(again.enemies.values(), PEN);
    expect([...again.enemies.values()].map((e) => [e.x, e.z])).toEqual([...enc.enemies.values()].map((e) => [e.x, e.z]));
    // Two goblins against the wall's face, side by side on a line: neither ends inside it.
    e1.x = 0;
    e1.z = 3 + 0.4 + 0.5;
    e2.x = 0;
    e2.z = e1.z;
    separateEnemies(enc.enemies.values(), PEN);
    for (const e of [e1, e2]) expect(e.z).toBeGreaterThanOrEqual(3 + 0.4 + 0.5 - 1e-9);
  });

  it("a goblin chasing round a wall slides along it rather than sticking", () => {
    const enc = createEncounter(PEN);
    const p = createPlayer("a", 3, 0); // south of the wall, off to the right of the goblins
    const ps = players(p);
    let t = 0;
    const e1 = enc.enemies.get("e1")!;
    for (const e of enc.enemies.values()) e.phase = "chase"; // already awake: the wall hides the player
    for (let i = 0; i < 80; i++) stepEnemies(enc.enemies.values(), ps, (t += TICK_MS), TICK_MS, PEN);
    expect(e1.z).toBeGreaterThanOrEqual(3 + 0.4 + 0.5 - 1e-9); // never inside the wall
    expect(e1.x).toBeGreaterThan(1); // it moved toward the player's side instead of pinning on the wall
  });

  it("the room clears when the last enemy falls, and resets after ROOM.resetMs", () => {
    const enc = createEncounter(PEN);
    const p = createPlayer("a", 0, 0);
    const ps = players(p);
    let t = 0;
    const events = [];
    for (const e of enc.enemies.values()) {
      e.hp = 1;
      e.phase = "idle";
    }
    // Kill them one at a time by standing next to each in turn.
    for (const e of enc.enemies.values()) {
      p.x = e.x;
      p.z = e.z + 1.5;
      p.facing = Math.PI;
      p.attackHitAt = t + TICK_MS;
      events.push(...stepEncounter(enc, ps, (t += TICK_MS), TICK_MS));
    }
    const kinds = events.map((x) => x.kind);
    expect(kinds.filter((k) => k === "enemyKilled")).toHaveLength(3);
    expect(kinds).toContain("roomCleared");
    expect([...enc.enemies.values()].every((e) => !isEnemyAlive(e))).toBe(true);
    expect(enc.resetAt).toBe(t + ROOM.resetMs);
    // Dead enemies stay dead until the reset.
    const before = stepEncounter(enc, ps, t + ROOM.resetMs - TICK_MS, TICK_MS);
    expect(before).toEqual([]);
    expect([...enc.enemies.values()].every((e) => !isEnemyAlive(e))).toBe(true);
    const reset = stepEncounter(enc, ps, t + ROOM.resetMs, TICK_MS);
    expect(reset.map((x) => x.kind)).toContain("roomReset");
    expect([...enc.enemies.values()].every((e) => isEnemyAlive(e) && e.hp === e.maxHp)).toBe(true);
    expect(enc.resetAt).toBe(0);
  });

  it("the sword hits the nearest goblin in reach; Cleave hits all of them", () => {
    const enc = createEncounter(PEN);
    const e3 = enc.enemies.get("e3")!;
    e3.x = 0.5;
    e3.z = 7.2; // behind the first two, still inside Cleave's 2.8 m but not the sword's 2.4 m
    const p = createPlayer("a", 0, 4.5);
    p.facing = 0;
    const ps = players(p);
    p.attackHitAt = 50;
    const sword = stepEncounter(enc, ps, 50, TICK_MS).filter((x) => x.kind === "playerHit");
    expect(sword).toHaveLength(1);
    p.abilitySlot = 1;
    p.abilityUntil = 1000;
    p.abilityHitAt = 100;
    const cleave = stepEncounter(enc, ps, 100, TICK_MS).filter((x) => x.kind === "abilityHit");
    expect(cleave.map((x) => (x as { enemyId: string }).enemyId).sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("a wipe resets every enemy and cancels a pending room reset", () => {
    const enc = createEncounter(PEN);
    const p = createPlayer("a", 0, 0);
    const ps = players(p);
    for (const e of enc.enemies.values()) {
      e.hp = 20;
      e.x += 3;
    }
    enc.resetAt = 5000;
    p.hp = 0;
    p.downedUntil = 0;
    p.respawnAt = 0;
    const events = stepEncounter(enc, ps, 100, TICK_MS);
    expect(events.map((x) => x.kind)).toEqual(["squadWiped"]);
    expect(enc.resetAt).toBe(0);
    for (const e of enc.enemies.values() as Iterable<EnemySim>) {
      expect(e.hp).toBe(e.maxHp);
      expect(e.x).toBe(e.spawnX);
    }
  });

  it("is deterministic: the same fight twice gives the same enemies", () => {
    const run = () => {
      const enc = createEncounter(YARD);
      const a = createPlayer("a", 3, -3);
      const b = createPlayer("b", -3, 3);
      const ps = players(a, b);
      let t = 0;
      for (let i = 1; i <= 200; i++) {
        t += TICK_MS;
        applyInput(a, { ...neutralInput(i), dx: 1, dy: -1, attack: i % 9 === 0 }, t, TICK_MS, YARD);
        applyInput(b, { ...neutralInput(i), dx: -1, dy: 1, attack: i % 11 === 0 }, t, TICK_MS, YARD);
        stepEncounter(enc, ps, t, TICK_MS);
      }
      return JSON.stringify([...enc.enemies.values()]);
    };
    expect(run()).toBe(run());
  });
});
