import { describe, expect, it } from "vitest";
import { ENEMY_KINDS, TICK_MS, createEnemy, createPlayer, stepEnemy, type EnemyKind, type EnemySim, type PlayerSim } from "./sim";
import { WARRENS, YARD, pathClear, roomAt, steerToward } from "./level";

/** Chase `p` for up to `ms`; returns the ms it took to get within reach, or -1. */
function chase(e: EnemySim, p: PlayerSim, ms: number): number {
  const players = new Map([[p.id, p]]);
  e.phase = "chase";
  for (let t = 0; t < ms; t += TICK_MS) {
    stepEnemy(e, players, 1000 + t, TICK_MS, WARRENS);
    if ((e.phase as EnemySim["phase"]) === "windup") return t;
    // Stay in chase: this test is about getting there, not the swing.
    if (e.phase !== "chase") e.phase = "chase";
  }
  return -1;
}

function awake(kind: EnemyKind, x: number, z: number): EnemySim {
  const e = createEnemy("e", kind, x, z);
  e.phase = "chase";
  return e;
}

describe("enemies route through doorways", () => {
  it("every Warrens waypoint is clear of the walls and reaches its doorway twin", () => {
    const wps = WARRENS.waypoints!;
    for (let i = 0; i < wps.length; i += 2) expect(pathClear(wps[i], wps[i + 1], 0.6, WARRENS)).toBe(true);
  });

  it("the critic's case: a Shieldbearer pinned at the hall's north wall finds the guard-room door", () => {
    // Steps from critic.md 2026-10-05: woken in the guard room, target back out east at (2, 3).
    const e = awake("shieldbearer", -1, 8.95);
    const p = createPlayer("p", 2, 3);
    expect(steerToward(e, p, ENEMY_KINDS.shieldbearer.radius, WARRENS)).toEqual({ x: -10, z: 9.8 });
    const t = chase(e, p, 20_000);
    expect(t).toBeGreaterThan(0);
    expect(roomAt(WARRENS, e.x, e.z)).toBe(-1); // out in the hall
  });

  it("a goblin in the den reaches a player in the hall through the guard room", () => {
    const e = awake("goblin", 15, 11);
    const p = createPlayer("p", -6, 2);
    expect(steerToward(e, p, ENEMY_KINDS.goblin.radius, WARRENS)).toEqual({ x: 1.8, z: 14.5 });
    expect(chase(e, p, 20_000)).toBeGreaterThan(0);
  });

  it("a pens goblin comes up through its own door", () => {
    const e = awake("goblin", -10, -10);
    const p = createPlayer("p", -10, 2);
    expect(steerToward(e, p, ENEMY_KINDS.goblin.radius, WARRENS)).toEqual({ x: 10, z: -9.8 });
    expect(chase(e, p, 20_000)).toBeGreaterThan(0);
  });

  it("walks straight when the way is clear, and on levels with no waypoints", () => {
    const p = createPlayer("p", -10, 4);
    expect(steerToward({ x: -10, z: 14 }, p, 0.5, WARRENS)).toBe(p);
    const q = createPlayer("q", -12, 3);
    expect(steerToward({ x: -12, z: -3 }, q, 0.5, YARD)).toBe(q); // behind the yard's west wall: no route, slide as before
  });

  it("is deterministic: two runs from the same start end in the same place", () => {
    const run = () => {
      const e = awake("goblin", 15, 11);
      const p = createPlayer("p", -6, 2);
      chase(e, p, 5000);
      return { x: e.x, z: e.z };
    };
    expect(run()).toEqual(run());
  });
});
