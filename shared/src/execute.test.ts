import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  COMBO,
  GOBLIN,
  TICK_MS,
  applyInput,
  createEnemy,
  createPlayer,
  neutralInput,
  resolvePlayerAttacks,
  type EnemySim,
  type InputFrame,
  type PlayerSim,
  type SimEvent
} from "./sim";
import { applyState, hasState } from "./states";

// Execute and the combo callout (Michael, A, 2026-10-05): Cleave from one player, Execute
// from another is the visible two-player combo.

const press = (seq: number, ability: number): InputFrame => ({ ...neutralInput(seq), ability });

/** Two swordsmen just north of the goblin, both facing it. */
function party() {
  const e = createEnemy();
  const a = createPlayer("a", e.x - 0.4, e.z + 1.5);
  const b = createPlayer("b", e.x + 0.4, e.z + 1.5);
  a.facing = b.facing = Math.PI;
  return { a, b, e };
}

/** Press a slot at `t` and resolve at the end of its windup. */
function use(p: PlayerSim, slot: number, enemies: EnemySim[], t: number, players: PlayerSim[] = [p]): SimEvent[] {
  applyInput(p, press(t, slot), t, TICK_MS);
  const def = slot === 1 ? ABILITIES.cleave : ABILITIES.execute;
  return resolvePlayerAttacks(players, enemies, t + def.windupMs);
}

const combos = (ev: SimEvent[]) => ev.filter((x): x is Extract<SimEvent, { kind: "combo" }> => x.kind === "combo");

describe("Execute", () => {
  it("is slot 2 on a sword: committed, then on cooldown", () => {
    const p = createPlayer("a");
    applyInput(p, press(1, 2), 100, TICK_MS);
    expect(p.abilityUntil).toBe(100 + ABILITIES.execute.durationMs);
    expect(p.abilityHitAt).toBe(100 + ABILITIES.execute.windupMs);
    expect(p.readyAt[1]).toBe(100 + ABILITIES.execute.cooldownMs);
    expect(p.readyAt[0]).toBe(0);
  });

  it("on a goblin that is not staggered is a plain heavy hit: no combo", () => {
    const { a, e } = party();
    const ev = use(a, 2, [e], 1000);
    expect(ev[0]).toMatchObject({ kind: "abilityHit", ability: "execute", damage: ABILITIES.execute.damage });
    expect(combos(ev)).toEqual([]);
    expect(e.hp).toBe(GOBLIN.hp - ABILITIES.execute.damage);
  });

  it("after your own Cleave is a solo crit: consumes Staggered, knocks down, x1", () => {
    const { a, e } = party();
    use(a, 1, [e], 1000);
    const t = 1000 + ABILITIES.cleave.durationMs;
    const ev = use(a, 2, [e], t);
    const hitAt = t + ABILITIES.execute.windupMs;
    expect(ev[0]).toMatchObject({ kind: "abilityHit", damage: ABILITIES.execute.damage * COMBO.staggerCritMult });
    expect(combos(ev)).toEqual([{ kind: "combo", attackerId: "a", enemyId: "e1", payoff: "crit", contributors: 1, mult: 1 }]);
    expect(hasState(e.states, "staggered", hitAt)).toBe(false);
    expect(e.phase).toBe("recover");
    expect(e.phaseUntil).toBeGreaterThanOrEqual(hitAt + COMBO.knockdownMs);
  });

  it("after a teammate's Cleave is the two-player combo: x1.5 and the callout event", () => {
    const { a, b, e } = party();
    use(a, 1, [e], 1000, [a, b]);
    const ev = use(b, 2, [e], 1300, [a, b]);
    const exec = ev.find((x) => x.kind === "abilityHit");
    const crit = ABILITIES.execute.damage * COMBO.staggerCritMult * 1.5;
    expect(exec).toMatchObject({ attackerId: "b", ability: "execute", damage: crit });
    expect(combos(ev)).toEqual([{ kind: "combo", attackerId: "b", enemyId: "e1", payoff: "crit", contributors: 2, mult: 1.5 }]);
    // Cleave 14 then a 54 combo: the goblin's 60 is gone.
    expect(e.hp).toBe(0);
    expect(ev.map((x) => x.kind)).toContain("enemyKilled");
  });

  it("lands inside Staggered's window after a teammate's Cleave", () => {
    // Cleave hits at its windup; Execute pressed when the cleave ends still lands in time.
    const latest = ABILITIES.cleave.windupMs + 2500 - ABILITIES.execute.windupMs;
    expect(ABILITIES.cleave.durationMs).toBeLessThan(latest);
  });

  it("prefers the staggered enemy over a nearer one that is not", () => {
    const near = createEnemy("near", "goblin", 0, 1);
    const far = createEnemy("far", "goblin", 0, 2);
    const p = createPlayer("a", 0, 0);
    p.facing = 0;
    applyState(far.states, "staggered", "b", 900);
    const ev = use(p, 2, [near, far], 1000);
    expect(ev[0]).toMatchObject({ kind: "abilityHit", enemyId: "far" });
    expect(combos(ev)[0]).toMatchObject({ enemyId: "far", contributors: 2, mult: 1.5 });
    expect(near.hp).toBe(GOBLIN.hp);
  });

  it("a wall stun is the level's stagger: it sets up a crit but counts no extra player", () => {
    const { a, e } = party();
    applyState(e.states, "staggered", "", 900);
    const ev = use(a, 2, [e], 1000);
    expect(combos(ev)).toEqual([{ kind: "combo", attackerId: "a", enemyId: "e1", payoff: "crit", contributors: 1, mult: 1 }]);
  });

  it("a plain swing consumes nothing: no combo event", () => {
    const { a, e } = party();
    use(a, 1, [e], 1000);
    a.attackHitAt = 2000;
    const ev = resolvePlayerAttacks([a], [e], 2000);
    expect(combos(ev)).toEqual([]);
    expect(hasState(e.states, "staggered", 2000)).toBe(true);
  });
});
