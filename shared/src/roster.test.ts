import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  GUARD,
  PLAYER,
  POSTURE,
  SHIELDBEARER,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  isEnemyStaggered,
  resetEnemy,
  resolvePlayerAttacks,
  shieldCovers,
  stepEnemy,
  type EnemySim,
  type PlayerSim
} from "./sim";
import { YARD, collideWalls } from "./level";

let seq = 0;
const swing = (p: PlayerSim, now: number) => applyInput(p, { seq: ++seq, dx: 0, dy: 0, attack: true, dodge: false }, now, TICK_MS);
const cleave = (p: PlayerSim, now: number) => applyInput(p, { seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false, ability: 1 }, now, TICK_MS);

/** A Shieldbearer at the origin facing +z, and a player 1.5 m away at `angle` from its front. */
function setup(angle: number): { e: EnemySim; p: PlayerSim } {
  const e = createEnemy("e1", "shieldbearer", 0, 0, 0);
  e.phase = "chase";
  const p = createPlayer("a", Math.sin(angle) * 1.5, Math.cos(angle) * 1.5);
  p.facing = angle + Math.PI; // facing the Shieldbearer
  return { e, p };
}

describe("the Shieldbearer", () => {
  it("spawns with its shield up; a goblin has none", () => {
    expect(createEnemy("e1", "shieldbearer").guardUp).toBe(true);
    expect(createEnemy("e1", "goblin").guardUp).toBe(false);
  });

  it("a sword on the shield does 35%", () => {
    const { e, p } = setup(0);
    swing(p, 0);
    const [hit] = resolvePlayerAttacks([p], [e], PLAYER.attackWindupMs);
    expect(hit).toMatchObject({ kind: "playerHit", shielded: true, damage: Math.round(PLAYER.attackDamage * SHIELDBEARER.frontGuard!) });
    expect(e.guardUp).toBe(true);
  });

  it("a flank goes round the shield: full damage from the side and behind", () => {
    for (const angle of [Math.PI * 0.6, Math.PI]) {
      const { e, p } = setup(angle);
      swing(p, 0);
      const [hit] = resolvePlayerAttacks([p], [e], PLAYER.attackWindupMs);
      expect(hit).toMatchObject({ shielded: false, damage: PLAYER.attackDamage });
    }
  });

  it("Cleave on the shield breaks the guard: staggered, the shield down, follow-ups land in full", () => {
    const { e, p } = setup(0);
    cleave(p, 0);
    const events = resolvePlayerAttacks([p], [e], ABILITIES.cleave.windupMs);
    expect(events.map((x) => x.kind)).toEqual(["abilityHit", "postureBroken"]);
    expect(events[0]).toMatchObject({ damage: Math.round(ABILITIES.cleave.damage * SHIELDBEARER.frontGuard!) });
    expect(e.guardUp).toBe(false);
    expect(isEnemyStaggered(e, ABILITIES.cleave.windupMs)).toBe(true);
    const t = ABILITIES.cleave.durationMs + 50;
    swing(p, t);
    const [hit] = resolvePlayerAttacks([p], [e], t + PLAYER.attackWindupMs);
    expect(hit).toMatchObject({ shielded: false, damage: PLAYER.attackDamage });
  });

  it("the shield comes back up when the stagger ends, and on a reset", () => {
    const { e, p } = setup(0);
    cleave(p, 0);
    const at = ABILITIES.cleave.windupMs;
    resolvePlayerAttacks([p], [e], at);
    const players = new Map([["a", p]]);
    stepEnemy(e, players, at + POSTURE.enemyBreakMs - TICK_MS, TICK_MS);
    expect(e.guardUp).toBe(false);
    stepEnemy(e, players, at + POSTURE.enemyBreakMs, TICK_MS);
    expect(e.guardUp).toBe(true);
    e.guardUp = false;
    resetEnemy(e);
    expect(e.guardUp).toBe(true);
  });

  it("enough posture damage through the shield also drops it", () => {
    const { e, p } = setup(0);
    let now = 0;
    let broke = false;
    for (let i = 0; i < 20 && !broke; i++) {
      now += 1000;
      swing(p, now);
      broke = resolvePlayerAttacks([p], [e], now + PLAYER.attackWindupMs).some((x) => x.kind === "postureBroken");
    }
    expect(broke).toBe(true);
    expect(e.guardUp).toBe(false);
  });

  it("the shield covers its front half, so it turns with the Shieldbearer", () => {
    const e = createEnemy("e1", "shieldbearer", 0, 0, 0);
    expect(shieldCovers(e, { x: 0, z: 3 })).toBe(true);
    expect(shieldCovers(e, { x: 0, z: -3 })).toBe(false);
    e.facing = Math.PI;
    expect(shieldCovers(e, { x: 0, z: -3 })).toBe(true);
    expect(GUARD.arc).toBe(Math.PI);
  });

  it("the yard places one, clear of every wall", () => {
    const s = YARD.enemies.find((x) => x.kind === "shieldbearer")!;
    expect(s).toBeDefined();
    const o = { x: s.x, z: s.z };
    collideWalls(o, SHIELDBEARER.radius, YARD);
    expect(o).toEqual({ x: s.x, z: s.z });
  });
});
