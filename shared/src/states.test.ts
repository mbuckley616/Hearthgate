import { describe, expect, it } from "vitest";
import { COMBO, PLAYER, STATES, TICK_MS, createEnemy, createPlayer, resolvePlayerAttacks, stepEnemy } from "./sim";
import { applyState, comboMultiplier, contributors, expireStates, hasState, resolveHit, type StateSet } from "./states";

describe("states", () => {
  it("apply, refresh and expire: a refresh extends and adds the applier once", () => {
    const s: StateSet = {};
    applyState(s, "soaked", "a", 0);
    applyState(s, "soaked", "b", 1000);
    applyState(s, "soaked", "a", 2000);
    expect(s.soaked).toEqual({ until: 2000 + STATES.soaked.durationMs, by: ["a", "b"] });
    expireStates(s, 2000 + STATES.soaked.durationMs - 1);
    expect(hasState(s, "soaked", 2000 + STATES.soaked.durationMs - 1)).toBe(true);
    expireStates(s, 2000 + STATES.soaked.durationMs);
    expect(s.soaked).toBeUndefined();
  });

  it("the payoff scales with distinct contributors, not hits, and is capped", () => {
    expect(contributors({ until: 1, by: ["a"] }, "a")).toBe(1);
    expect(contributors({ until: 1, by: ["a", "b"] }, "c")).toBe(3);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1 + COMBO.perContributor);
    expect(comboMultiplier(8)).toBe(comboMultiplier(COMBO.maxContributors));
  });

  it("two players setting up and a third finishing beats one player alone", () => {
    const solo: StateSet = {};
    applyState(solo, "chilled", "vet", 0);
    const alone = resolveHit(solo, { damage: 30, tags: ["magic", "shatter"], byId: "vet" }, 100);
    const party: StateSet = {};
    applyState(party, "chilled", "a", 0);
    applyState(party, "chilled", "b", 50);
    const together = resolveHit(party, { damage: 30, tags: ["magic", "shatter"], byId: "c" }, 100);
    expect(alone.damage).toBe(30 + COMBO.shatterBonus);
    expect(together.damage).toBe(Math.round(30 + COMBO.shatterBonus * comboMultiplier(3)));
    expect(together.effects).toEqual([{ kind: "shatter", contributors: 3 }]);
    expect(party.chilled).toBeUndefined();
  });

  it("only the right tags consume a state", () => {
    const s: StateSet = {};
    applyState(s, "staggered", "a", 0);
    expect(resolveHit(s, { damage: 20, tags: ["melee"], byId: "b" }, 10).damage).toBe(20);
    expect(hasState(s, "staggered", 10)).toBe(true);
    const r = resolveHit(s, { damage: 20, tags: ["melee", "execute"], byId: "b" }, 20);
    expect(r.damage).toBe(Math.round(20 * COMBO.staggerCritMult * comboMultiplier(2)));
    expect(r.consumed).toEqual(["staggered"]);
    expect(r.effects).toEqual([{ kind: "crit", knockdownMs: COMBO.knockdownMs, contributors: 2 }]);
  });

  it("soaked plus lightning chains; soaked plus frost freezes (rooted and chilled)", () => {
    const wet: StateSet = {};
    applyState(wet, "soaked", "a", 0);
    const bolt = resolveHit(wet, { damage: 20, tags: ["magic", "lightning"], byId: "b" }, 10);
    expect(bolt.effects).toEqual([
      { kind: "chain", radius: COMBO.chainRadius, damage: Math.round(20 * COMBO.chainShare * comboMultiplier(2)), contributors: 2 }
    ]);
    const cold: StateSet = {};
    applyState(cold, "soaked", "a", 0);
    resolveHit(cold, { damage: 20, tags: ["magic", "frost"], byId: "a" }, 10);
    expect(hasState(cold, "rooted", 10 + COMBO.freezeMs - 1)).toBe(true);
    expect(hasState(cold, "chilled", 10 + COMBO.freezeMs - 1)).toBe(true);
    expect(hasState(cold, "soaked", 10)).toBe(false);
  });

  it("burning spreads on oil or wind; rooted makes an area hit land in full", () => {
    const s: StateSet = {};
    applyState(s, "burning", "a", 0);
    applyState(s, "rooted", "b", 0);
    const r = resolveHit(s, { damage: 10, tags: ["area", "wind"], byId: "c" }, 10);
    expect(r.consumed).toEqual(["burning", "rooted"]);
    expect(r.effects.map((e) => e.kind)).toEqual(["spread", "undodgeable"]);
  });

  it("marked is never consumed and adds to every hit from anyone", () => {
    const s: StateSet = {};
    applyState(s, "marked", "guide", 0);
    const a = resolveHit(s, { damage: 20, tags: ["melee"], byId: "a" }, 10);
    const b = resolveHit(s, { damage: 20, tags: ["ranged"], byId: "b" }, 20);
    expect(a.damage).toBe(Math.round(20 + 20 * COMBO.markedBonus * comboMultiplier(2)));
    expect(b.damage).toBe(a.damage);
    expect(hasState(s, "marked", 20)).toBe(true);
  });

  it("in the sim: the sword hits a Marked goblin harder, and a Rooted goblin cannot chase", () => {
    const p = createPlayer("a", 9, -7.5);
    p.facing = Math.PI;
    p.attackHitAt = 100;
    const e = createEnemy();
    applyState(e.states, "marked", "b", 0);
    const [hit] = resolvePlayerAttacks([p], e, 100);
    expect(hit).toMatchObject({ kind: "playerHit", damage: Math.round(PLAYER.attackDamage * (1 + COMBO.markedBonus * comboMultiplier(2))) });

    const far = createPlayer("c", 0, -9);
    const g = createEnemy();
    g.phase = "chase";
    applyState(g.states, "rooted", "b", 0);
    stepEnemy(g, new Map([["c", far]]), TICK_MS, TICK_MS);
    expect(g.x).toBe(createEnemy().x);
    stepEnemy(g, new Map([["c", far]]), STATES.rooted.durationMs + TICK_MS, TICK_MS);
    expect(g.x).toBeLessThan(createEnemy().x);
    expect(g.states.rooted).toBeUndefined();
  });

  it("is deterministic", () => {
    const once = () => {
      const s: StateSet = {};
      applyState(s, "soaked", "a", 0);
      applyState(s, "marked", "b", 5);
      return JSON.stringify([resolveHit(s, { damage: 17, tags: ["frost"], byId: "c" }, 10), s]);
    };
    expect(once()).toBe(once());
  });
});
