import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  GOBLIN,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  downPlayer,
  isAttacking,
  isValidInput,
  neutralInput,
  resolvePlayerAttacks,
  type InputFrame
} from "./sim";
import { hasState } from "./states";

const press = (seq: number, ability: number, extra: Partial<InputFrame> = {}): InputFrame => ({
  ...neutralInput(seq),
  ability,
  ...extra
});

/** A player standing just north of the goblin's spawn, facing it. */
function besideGoblin() {
  const e = createEnemy();
  const p = createPlayer("a", e.x, e.z + 1.5);
  p.facing = Math.PI;
  return { p, e };
}

describe("ability slots", () => {
  it("validates the slot: absent or 0..3, integers only", () => {
    expect(isValidInput({ seq: 1, dx: 0, dy: 0, attack: false, dodge: false })).toBe(true);
    expect(isValidInput(press(1, 3))).toBe(true);
    expect(isValidInput(press(1, 4))).toBe(false);
    expect(isValidInput(press(1, 1.5))).toBe(false);
    expect(isValidInput({ ...press(1, 0), ability: "1" })).toBe(false);
  });

  it("slot 1 on the sword is Cleave: committed, then on cooldown", () => {
    const p = createPlayer("a");
    applyInput(p, press(1, 1), 100, TICK_MS);
    expect(p.abilityUntil).toBe(100 + ABILITIES.cleave.durationMs);
    expect(p.abilityHitAt).toBe(100 + ABILITIES.cleave.windupMs);
    expect(p.readyAt[0]).toBe(100 + ABILITIES.cleave.cooldownMs);
    expect(isAttacking(p, 150)).toBe(true);
    // Committed: no walking and no sword swing until it finishes.
    applyInput(p, press(2, 0, { dx: 1, attack: true }), 150, TICK_MS);
    expect(p.x).toBe(0);
    expect(p.attackUntil).toBe(0);
    // Finished but cooling down: the press does nothing.
    const later = 100 + ABILITIES.cleave.durationMs + TICK_MS;
    applyInput(p, press(3, 1), later, TICK_MS);
    expect(p.abilityUntil).toBe(100 + ABILITIES.cleave.durationMs);
    applyInput(p, press(4, 1), 100 + ABILITIES.cleave.cooldownMs, TICK_MS);
    expect(p.abilityUntil).toBe(100 + ABILITIES.cleave.cooldownMs + ABILITIES.cleave.durationMs);
  });

  it("empty slots do nothing, and the downed cannot use abilities", () => {
    const p = createPlayer("a");
    applyInput(p, press(1, 2), 100, TICK_MS);
    applyInput(p, press(2, 3), 150, TICK_MS);
    expect(p.abilityUntil).toBe(0);
    downPlayer(p, 200);
    applyInput(p, press(3, 1), 250, TICK_MS);
    expect(p.abilityUntil).toBe(0);
    expect(p.readyAt[0]).toBe(0);
  });

  it("Cleave lands at the end of its windup, staggers, and breaks a goblin's windup", () => {
    const { p, e } = besideGoblin();
    e.phase = "windup";
    e.phaseUntil = 2000;
    applyInput(p, press(1, 1), 1000, TICK_MS);
    expect(resolvePlayerAttacks([p], e, 1000 + ABILITIES.cleave.windupMs - TICK_MS)).toEqual([]);
    const events = resolvePlayerAttacks([p], e, 1000 + ABILITIES.cleave.windupMs);
    expect(events).toEqual([
      { kind: "abilityHit", attackerId: "a", ability: "cleave", damage: ABILITIES.cleave.damage, enemyHp: GOBLIN.hp - ABILITIES.cleave.damage, interrupted: true }
    ]);
    expect(hasState(e.states, "staggered", 1000 + ABILITIES.cleave.windupMs)).toBe(true);
    expect(e.phase).toBe("recover");
  });

  it("Cleave's arc is wider than the sword's: it catches a goblin off to the side", () => {
    const { p, e } = besideGoblin();
    p.facing = Math.PI / 2; // facing +x, the goblin is 90 degrees to the right (-z)
    p.attackHitAt = 100; // sword: 108 degree cone misses
    expect(resolvePlayerAttacks([p], e, 100)).toEqual([]);
    applyInput(p, press(1, 1), 200, TICK_MS);
    expect(resolvePlayerAttacks([p], e, 200 + ABILITIES.cleave.windupMs).map((x) => x.kind)).toEqual(["abilityHit"]);
  });

  it("prediction and server agree: the same frames give the same player", () => {
    const run = () => {
      const p = createPlayer("a");
      const frames = [press(1, 0, { dx: 1 }), press(2, 1), press(3, 0, { dx: 1 }), press(4, 1), press(5, 0, { attack: true })];
      let t = 0;
      for (const f of frames) applyInput(p, f, (t += TICK_MS), TICK_MS);
      return JSON.stringify(p);
    };
    expect(run()).toBe(run());
  });
});
