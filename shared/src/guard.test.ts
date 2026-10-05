import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  GOBLIN,
  GUARD,
  PLAYER,
  POSTURE,
  TICK_MS,
  WEAPON_CLASSES,
  applyInput,
  createEnemy,
  createPlayer,
  isEnemyStaggered,
  isPlayerStaggered,
  isValidInput,
  resolvePlayerAttacks,
  stepEnemy,
  stepPosture,
  type EnemySim,
  type InputFrame,
  type PlayerSim
} from "./sim";
import { hasState } from "./states";

let seq = 0;
const frame = (o: Partial<InputFrame> = {}): InputFrame => ({ seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false, ...o });

/** A player at the origin facing +z and a goblin in front of them, its swing landing at `now`. */
function duel(goblinZ = 1.5): { p: PlayerSim; e: EnemySim; players: Map<string, PlayerSim> } {
  const p = createPlayer("a", 0, 0);
  p.facing = 0;
  const e = createEnemy("e1", "goblin", 0, goblinZ, goblinZ > 0 ? Math.PI : 0);
  e.targetId = "a";
  return { p, e, players: new Map([["a", p]]) };
}

function landSwing(e: EnemySim, players: Map<string, PlayerSim>, now: number) {
  e.phase = "windup";
  e.phaseUntil = now;
  return stepEnemy(e, players, now, TICK_MS);
}

describe("block, parry and posture", () => {
  it("block is an optional boolean on the input", () => {
    expect(isValidInput(frame())).toBe(true);
    expect(isValidInput(frame({ block: true }))).toBe(true);
    expect(isValidInput({ ...frame(), block: 1 })).toBe(false);
  });

  it("holding block raises the guard once, shuffles at half speed without turning, and stops the swing", () => {
    const p = createPlayer("a", 0, 0);
    p.facing = 0;
    applyInput(p, frame({ block: true }), 1000, TICK_MS);
    expect(p.guarding).toBe(true);
    expect(p.blockSince).toBe(1000);
    applyInput(p, frame({ block: true, dx: 1, attack: true }), 1050, TICK_MS);
    expect(p.blockSince).toBe(1000); // held, not re-raised
    expect(p.x).toBeCloseTo(PLAYER.speed * GUARD.moveMult * (TICK_MS / 1000), 9);
    expect(p.facing).toBe(0);
    expect(p.attackUntil).toBe(0);
    applyInput(p, frame({ block: true, ability: 1 }), 1100, TICK_MS);
    expect(p.abilityUntil).toBe(0);
    applyInput(p, frame({ attack: true }), 1150, TICK_MS); // let go and swing
    expect(p.guarding).toBe(false);
    expect(p.attackUntil).toBe(1150 + WEAPON_CLASSES.oneHand.durationMs);
  });

  it("a dodge drops the guard, and raising it again starts a new window", () => {
    const p = createPlayer("a");
    applyInput(p, frame({ block: true }), 0, TICK_MS);
    applyInput(p, frame({ block: true, dodge: true }), 50, TICK_MS);
    expect(p.guarding).toBe(false);
    applyInput(p, frame({ block: true }), 50 + PLAYER.dodgeMs + 50, TICK_MS);
    expect(p.blockSince).toBe(50 + PLAYER.dodgeMs + 50);
  });

  it("a guard raised just before the blow parries it: no damage, the goblin staggered and slowed", () => {
    const { p, e, players } = duel();
    applyInput(p, frame({ block: true }), 2000 - GUARD.parryWindowMs, TICK_MS);
    const events = landSwing(e, players, 2000);
    expect(events).toEqual([{ kind: "playerParried", playerId: "a", enemyId: "e1", postureBroken: false }]);
    expect(p.hp).toBe(PLAYER.hp);
    expect(p.posture).toBe(POSTURE.player);
    expect(hasState(e.states, "staggered", 2000)).toBe(true);
    expect(e.phase).toBe("recover");
    expect(e.phaseUntil).toBe(2000 + GUARD.parryStunMs);
    expect(e.posture).toBe(e.maxPosture * (1 - POSTURE.parryFrac));
  });

  it("a guard held too long is a block: the weapon's share off the damage, posture drained by the blow", () => {
    const { p, e, players } = duel();
    applyInput(p, frame({ block: true }), 1000, TICK_MS);
    const events = landSwing(e, players, 1000 + GUARD.parryWindowMs + TICK_MS);
    const taken = Math.round(GOBLIN.damage * (1 - 0.35));
    expect(events).toEqual([{ kind: "enemyHit", targetId: "a", enemyId: "e1", damage: taken, targetHp: PLAYER.hp - taken, blocked: true }]);
    expect(p.posture).toBe(POSTURE.player - GOBLIN.damage * POSTURE.blockedMult);
  });

  it("a claymore blocks more than a sword", () => {
    const { p, e, players } = duel();
    p.weapon = { kind: "weapon", type: "claymore", tier: 1 };
    applyInput(p, frame({ block: true }), 0, TICK_MS);
    landSwing(e, players, 5000);
    expect(PLAYER.hp - p.hp).toBe(Math.round(GOBLIN.damage * 0.5));
  });

  it("the guard covers the front half only: a blow from behind lands in full", () => {
    const { p, e, players } = duel(-1.5);
    applyInput(p, frame({ block: true }), 1990, TICK_MS);
    const [hit] = landSwing(e, players, 2000);
    expect(hit).toMatchObject({ kind: "enemyHit", damage: GOBLIN.damage, blocked: false });
    expect(p.posture).toBe(POSTURE.player - GOBLIN.damage * POSTURE.unblockedMult);
  });

  it("enough unguarded blows break the player's posture: off balance, then a full bar", () => {
    const { p, e, players } = duel();
    let now = 1000;
    const kinds: string[] = [];
    while (!isPlayerStaggered(p, now)) {
      now += 1000;
      kinds.push(...landSwing(e, players, now).map((x) => x.kind));
    }
    expect(kinds.filter((k) => k === "enemyHit")).toHaveLength(Math.ceil(POSTURE.player / (GOBLIN.damage * POSTURE.unblockedMult)));
    expect(kinds.at(-1)).toBe("playerStaggered");
    expect(p.hp).toBeGreaterThan(0);
    // Off balance: no step, no guard, no swing.
    const x = p.x;
    applyInput(p, frame({ dx: 1, block: true, attack: true }), now + TICK_MS, TICK_MS);
    expect([p.x, p.guarding, p.attackUntil]).toEqual([x, false, 0]);
    stepPosture([p], [], now + POSTURE.playerStaggerMs, TICK_MS);
    expect(p.posture).toBe(POSTURE.player);
    applyInput(p, frame({ dx: 1 }), now + POSTURE.playerStaggerMs, TICK_MS);
    expect(p.x).toBeGreaterThan(x);
  });

  it("weapon hits break a goblin's posture: staggered and in recovery, the heavier weapon sooner", () => {
    for (const [type, hits] of [["sword", 4], ["warHammer", 2]] as const) {
      const p = createPlayer("a", 0, 0);
      p.facing = 0;
      p.weapon = { kind: "weapon", type, tier: 1 };
      const e = createEnemy("e1", "goblin", 0, 1.5);
      e.hp = 10_000; // posture, not health, is under test
      e.phase = "chase";
      const swing = WEAPON_CLASSES[type === "sword" ? "oneHand" : "twoHand"];
      let now = 0;
      let broke = 0;
      for (let i = 1; i <= hits; i++) {
        now += 1000;
        applyInput(p, frame({ attack: true }), now, TICK_MS);
        const events = resolvePlayerAttacks([p], [e], now + swing.windupMs);
        if (events.some((x) => x.kind === "postureBroken")) broke = i;
      }
      expect(broke).toBe(hits);
      expect(isEnemyStaggered(e, now + swing.windupMs)).toBe(true);
      expect(hasState(e.states, "staggered", now + swing.windupMs)).toBe(true);
      expect(e.phase).toBe("recover");
      expect(e.phaseUntil).toBe(now + swing.windupMs + POSTURE.enemyBreakMs);
    }
  });

  it("Cleave drains posture as a power attack", () => {
    const p = createPlayer("a", 0, 0);
    p.facing = 0;
    const e = createEnemy("e1", "goblin", 0, 1.5);
    e.phase = "chase";
    applyInput(p, frame({ ability: 1 }), 0, TICK_MS);
    resolvePlayerAttacks([p], [e], ABILITIES.cleave.windupMs);
    expect(e.posture).toBe(e.maxPosture - POSTURE.abilityDrain);
  });

  it("posture refills only after a quiet spell", () => {
    const { p, e, players } = duel();
    landSwing(e, players, 1000);
    const after = p.posture;
    stepPosture([p], [], 1000 + POSTURE.regenDelayMs - TICK_MS, TICK_MS);
    expect(p.posture).toBe(after);
    stepPosture([p], [], 1000 + POSTURE.regenDelayMs, 1000);
    expect(p.posture).toBe(after + POSTURE.regenPerSec);
  });

  it("prediction and server agree through a guard, a shuffle and a swing", () => {
    const a = createPlayer("a");
    const b = createPlayer("a");
    const frames = [frame({ block: true }), frame({ block: true, dx: 1 }), frame({ block: true, dy: -1 }), frame({ attack: true }), frame({ block: true })];
    frames.forEach((f, i) => {
      applyInput(a, f, i * TICK_MS, TICK_MS);
      applyInput(b, f, i * TICK_MS, TICK_MS);
    });
    expect(a).toEqual(b);
  });
});
