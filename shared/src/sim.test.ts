import { describe, expect, it } from "vitest";
import {
  ARENA_HALF,
  GOBLIN,
  PLAYER,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  inCone,
  isValidInput,
  neutralInput,
  resolvePlayerAttacks,
  stepEnemy,
  stepRespawns
} from "./sim";

describe("applyInput", () => {
  it("moves at PLAYER.speed and faces the move direction", () => {
    const p = createPlayer("a");
    applyInput(p, { seq: 1, dx: 1, dy: 0, attack: false, dodge: false }, 50, TICK_MS);
    expect(p.x).toBeCloseTo(PLAYER.speed * (TICK_MS / 1000), 5);
    expect(p.z).toBeCloseTo(0, 5);
    expect(p.facing).toBeCloseTo(Math.PI / 2, 5);
    expect(p.lastSeq).toBe(1);
  });

  it("normalises diagonal input so it is not faster", () => {
    const p = createPlayer("a");
    applyInput(p, { seq: 1, dx: 1, dy: 1, attack: false, dodge: false }, 50, TICK_MS);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(PLAYER.speed * (TICK_MS / 1000), 5);
  });

  it("is deterministic: the same inputs give the same state", () => {
    const run = () => {
      const p = createPlayer("a", 1, -2);
      let t = 0;
      for (let i = 1; i <= 40; i++) {
        t += TICK_MS;
        applyInput(p, { seq: i, dx: i % 3 === 0 ? 1 : 0, dy: i % 5 === 0 ? -1 : 0.3, attack: i === 7, dodge: i === 20 }, t, TICK_MS);
      }
      return p;
    };
    expect(run()).toEqual(run());
  });

  it("stays inside the arena", () => {
    const p = createPlayer("a");
    let t = 0;
    for (let i = 1; i <= 400; i++) {
      t += TICK_MS;
      applyInput(p, { seq: i, dx: 1, dy: 0, attack: false, dodge: false }, t, TICK_MS);
    }
    expect(p.x).toBeLessThanOrEqual(ARENA_HALF - PLAYER.radius + 1e-9);
  });

  it("commits to a swing and cannot move while attacking", () => {
    const p = createPlayer("a");
    applyInput(p, { seq: 1, dx: 0, dy: 0, attack: true, dodge: false }, 100, TICK_MS);
    expect(p.attackUntil).toBe(100 + PLAYER.attackDurationMs);
    expect(p.attackHitAt).toBe(100 + PLAYER.attackWindupMs);
    applyInput(p, { seq: 2, dx: 1, dy: 0, attack: false, dodge: false }, 150, TICK_MS);
    expect(p.x).toBe(0);
  });

  it("dodges forward when standing still and respects the cooldown", () => {
    const p = createPlayer("a");
    applyInput(p, { seq: 1, dx: 0, dy: 0, attack: false, dodge: true }, 100, TICK_MS);
    expect(p.dodgeUntil).toBe(100 + PLAYER.dodgeMs);
    expect(p.z).toBeGreaterThan(0);
    const zAfterFirst = p.z;
    // Still dodging: a second press does nothing new, but we keep moving.
    applyInput(p, { seq: 2, dx: 0, dy: 0, attack: false, dodge: true }, 150, TICK_MS);
    expect(p.dodgeUntil).toBe(100 + PLAYER.dodgeMs);
    expect(p.z).toBeGreaterThan(zAfterFirst);
    // After the dodge but inside the cooldown: no new dodge.
    applyInput(p, { seq: 3, dx: 0, dy: 0, attack: false, dodge: true }, 500, TICK_MS);
    expect(p.dodgeUntil).toBe(100 + PLAYER.dodgeMs);
  });

  it("ignores movement while dead but still records the sequence", () => {
    const p = createPlayer("a");
    p.hp = 0;
    applyInput(p, { seq: 9, dx: 1, dy: 0, attack: true, dodge: false }, 100, TICK_MS);
    expect(p.x).toBe(0);
    expect(p.lastSeq).toBe(9);
  });
});

describe("inCone", () => {
  it("hits a target straight ahead and misses one behind", () => {
    const from = { x: 0, z: 0, facing: 0 }; // facing +z
    expect(inCone(from, { x: 0, z: 2 }, 2.4, Math.PI * 0.6, 0.5)).toBe(true);
    expect(inCone(from, { x: 0, z: -2 }, 2.4, Math.PI * 0.6, 0.5)).toBe(false);
    expect(inCone(from, { x: 0, z: 4 }, 2.4, Math.PI * 0.6, 0.5)).toBe(false);
  });
});

describe("combat", () => {
  it("a swing damages the goblin and a lethal one kills it", () => {
    const p = createPlayer("a", 0, 0);
    const e = createEnemy();
    e.x = 0;
    e.z = 1.5;
    e.phase = "chase";
    p.facing = 0;
    applyInput(p, { seq: 1, dx: 0, dy: 0, attack: true, dodge: false }, 100, TICK_MS);
    expect(resolvePlayerAttacks([p], e, 200)).toEqual([]); // windup not finished
    const events = resolvePlayerAttacks([p], e, 100 + PLAYER.attackWindupMs);
    expect(events[0]).toMatchObject({ kind: "playerHit", enemyHp: GOBLIN.hp - PLAYER.attackDamage });
    e.hp = PLAYER.attackDamage;
    applyInput(p, { seq: 2, dx: 0, dy: 0, attack: true, dodge: false }, 1000, TICK_MS);
    const killed = resolvePlayerAttacks([p], e, 1000 + PLAYER.attackWindupMs);
    expect(killed.map((x) => x.kind)).toEqual(["playerHit", "enemyKilled"]);
    expect(e.phase).toBe("dead");
  });

  it("the goblin chases, winds up, and a dodging player takes no damage", () => {
    const p = createPlayer("a", 0, 0);
    const players = new Map([[p.id, p]]);
    const e = createEnemy();
    e.x = 0;
    e.z = 5;
    let t = 0;
    const until = (cond: () => boolean, max = 400) => {
      for (let i = 0; i < max && !cond(); i++) {
        t += TICK_MS;
        stepEnemy(e, players, t, TICK_MS);
      }
    };
    until(() => e.phase === "windup");
    expect(e.phase).toBe("windup");
    // Player dodges just before the swing lands.
    p.dodgeUntil = e.phaseUntil + 100;
    until(() => e.phase === "recover");
    expect(p.hp).toBe(PLAYER.hp);
  });

  it("the goblin's swing hurts a standing player and can kill them", () => {
    const p = createPlayer("a", 0, 0);
    p.hp = GOBLIN.damage;
    const players = new Map([[p.id, p]]);
    const e = createEnemy();
    e.x = 0;
    e.z = 1.2;
    e.phase = "chase";
    let t = 0;
    const events = [];
    for (let i = 0; i < 100 && p.hp > 0; i++) {
      t += TICK_MS;
      events.push(...stepEnemy(e, players, t, TICK_MS));
    }
    expect(p.hp).toBe(0);
    expect(events.map((x) => x.kind)).toContain("playerDied");
    expect(stepRespawns([p], t + PLAYER.respawnMs).map((x) => x.kind)).toEqual(["playerRespawned"]);
    expect(p.hp).toBe(PLAYER.hp);
  });
});

describe("isValidInput", () => {
  it("accepts a well-formed frame and rejects junk", () => {
    expect(isValidInput(neutralInput(3))).toBe(true);
    expect(isValidInput({ seq: 1, dx: 5, dy: 0, attack: false, dodge: false })).toBe(false);
    expect(isValidInput("nope")).toBe(false);
    expect(isValidInput(null)).toBe(false);
  });
});
