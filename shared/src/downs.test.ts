import { describe, expect, it } from "vitest";
import {
  DOWNS,
  GOBLIN,
  PLAYER,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  downPlayer,
  isAlive,
  isDead,
  isDowned,
  resolvePlayerAttacks,
  stepDowns,
  stepEnemy,
  stepRespawns,
  type PlayerSim,
  type SimEvent
} from "./sim";

/** Two players: `a` downed at the origin at t=0, `b` standing `gap` metres away on x. */
function pair(gap: number) {
  const a = createPlayer("a", 0, 0);
  const b = createPlayer("b", gap, 0);
  downPlayer(a, 0);
  return { a, b, players: [a, b], enemy: createEnemy() };
}

/** Step downs for `ms` from `from`, returning every event and the end time. */
function run(players: PlayerSim[], enemy = createEnemy(), from: number, ms: number) {
  const events: SimEvent[] = [];
  let t = from;
  for (let i = 0; i < ms / TICK_MS; i++) {
    t += TICK_MS;
    events.push(...stepDowns(players, [enemy], t, TICK_MS));
  }
  return { events, t };
}

describe("downs", () => {
  it("zero health downs instead of killing: a crawl, no swing, no dodge", () => {
    const p = createPlayer("a");
    downPlayer(p, 1000);
    expect(isDowned(p)).toBe(true);
    expect(isAlive(p)).toBe(false);
    expect(p.downedUntil).toBe(1000 + DOWNS.bleedOutMs);
    applyInput(p, { seq: 1, dx: 1, dy: 0, attack: true, dodge: true }, 1050, TICK_MS);
    expect(p.x).toBeCloseTo(DOWNS.crawlSpeed * (TICK_MS / 1000), 5);
    expect(p.attackUntil).toBe(0);
    expect(p.dodgeUntil).toBe(0);
  });

  it("a teammate standing next to you picks you up after pickupMs, at no cost", () => {
    const { a, b, players, enemy } = pair(1.5);
    const { events } = run(players, enemy, 0, DOWNS.pickupMs - TICK_MS);
    expect(isDowned(a)).toBe(true);
    expect(a.pickupBy).toBe("b");
    const last = run(players, enemy, DOWNS.pickupMs - TICK_MS, TICK_MS);
    expect([...events, ...last.events]).toContainEqual({ kind: "playerPickedUp", playerId: "a", byId: "b" });
    expect(a.hp).toBe(DOWNS.pickupHp);
    expect(isAlive(a)).toBe(true);
    expect(b.hp).toBe(PLAYER.hp);
  });

  it("walking off, swinging or dodging breaks the channel and it starts over", () => {
    const { a, b, players, enemy } = pair(1.5);
    run(players, enemy, 0, 1000);
    expect(a.pickupMs).toBeGreaterThan(0);
    b.x = DOWNS.pickupRange + 1;
    run(players, enemy, 1000, TICK_MS);
    expect(a.pickupMs).toBe(0);
    b.x = 1.5;
    b.attackUntil = 1200 + PLAYER.attackDurationMs;
    run(players, enemy, 1050, TICK_MS * 2);
    expect(a.pickupMs).toBe(0);
    expect(isDowned(a)).toBe(true);
  });

  it("bleeding out is dead for the fight; a teammate still standing means no wipe", () => {
    const { a, b, players, enemy } = pair(10);
    const { events } = run(players, enemy, 0, DOWNS.bleedOutMs);
    expect(events).toEqual([{ kind: "playerDied", playerId: "a" }]);
    expect(isDead(a)).toBe(true);
    expect(a.respawnAt).toBe(0);
    expect(stepRespawns(players, DOWNS.bleedOutMs + 60000)).toEqual([]);
    expect(isAlive(b)).toBe(true);
  });

  it("clearing the room stands the downed up and brings the dead back", () => {
    const a = createPlayer("a", 0, 0);
    const c = createPlayer("c", 5, 5);
    const b = createPlayer("b", 9, -7.5);
    downPlayer(a, 0);
    c.hp = 0; // dead, waiting for the clear
    const enemy = createEnemy();
    enemy.hp = PLAYER.attackDamage;
    b.facing = Math.PI; // the goblin spawns at z = -9, behind b's default facing
    b.attackHitAt = 500;
    const events = resolvePlayerAttacks([a, b, c], [enemy], 500);
    expect(events.map((x) => x.kind)).toEqual(["playerHit", "enemyKilled", "roomCleared", "playerPickedUp"]);
    expect(a.hp).toBe(DOWNS.pickupHp);
    expect(c.respawnAt).toBe(500 + PLAYER.respawnMs);
    expect(stepRespawns([c], 500 + PLAYER.respawnMs)).toEqual([{ kind: "playerRespawned", playerId: "c" }]);
    expect(c.hp).toBe(PLAYER.hp);
  });

  it("nobody standing wipes the squad once: everyone respawns and the goblin resets", () => {
    const { a, b, players, enemy } = pair(1.5);
    downPlayer(b, 100);
    enemy.hp = 10;
    enemy.phase = "chase";
    enemy.x = 1;
    const first = run(players, enemy, 100, TICK_MS);
    expect(first.events).toEqual([{ kind: "squadWiped" }]);
    expect(enemy.hp).toBe(GOBLIN.hp);
    expect(enemy.phase).toBe("idle");
    expect(run(players, enemy, first.t, 1000).events).toEqual([]);
    const back = stepRespawns(players, first.t + PLAYER.respawnMs);
    expect(back.map((x) => x.kind)).toEqual(["playerRespawned", "playerRespawned"]);
    expect(isAlive(a) && isAlive(b)).toBe(true);
  });

  it("the goblin leaves the downed alone and goes for whoever is standing", () => {
    const a = createPlayer("a", 9, -8);
    const b = createPlayer("b", 9, -3);
    downPlayer(a, 0);
    const enemy = createEnemy();
    stepEnemy(enemy, new Map([["a", a], ["b", b]]), TICK_MS, TICK_MS);
    expect(enemy.targetId).toBe("b");
  });

  it("is deterministic: the same downs give the same state", () => {
    const once = () => {
      const { players, enemy } = pair(1.8);
      const { events } = run(players, enemy, 0, 3000);
      return JSON.stringify({ players, events });
    };
    expect(once()).toBe(once());
  });
});
