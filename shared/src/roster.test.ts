import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  CHARGER,
  GOBLIN,
  GUARD,
  PACK_LEADER,
  KNOCKBACK,
  PLAYER,
  POSTURE,
  SHIELDBEARER,
  TICK_MS,
  applyInput,
  createEnemies,
  createEnemy,
  createPlayer,
  isEnemyStaggered,
  resetEnemy,
  resolvePlayerAttacks,
  shieldCovers,
  stepEnemies,
  stepEnemy,
  updateRallies,
  type EnemySim,
  type PlayerSim,
  type SimEvent
} from "./sim";
import { OPEN_FIELD, YARD, collideWalls, type Level } from "./level";
import { hasState } from "./states";

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

describe("the Charger", () => {
  const c = CHARGER.charge!;

  /** A Charger at the origin and a player `dist` m straight ahead (+z). */
  function lane(dist: number) {
    const e = createEnemy("e1", "charger", 0, 0, 0);
    e.phase = "chase";
    const p = createPlayer("a", 0, dist);
    return { e, p, players: new Map([["a", p]]) };
  }

  /** Step the Charger tick by tick from `from` until `until` returns true or `ms` pass; the time it stopped. */
  function run(e: EnemySim, players: Map<string, PlayerSim>, from: number, ms: number, level = OPEN_FIELD, until?: (ev: SimEvent[]) => boolean) {
    const events: SimEvent[] = [];
    let now = from;
    for (; now <= from + ms; now += TICK_MS) {
      const ev = stepEnemy(e, players, now, TICK_MS, level);
      events.push(...ev);
      if (until?.(ev)) break;
    }
    return { events, now };
  }

  it("plants and aims at a player in range with a clear line; the lane is fixed from then", () => {
    const { e, p, players } = lane(8);
    stepEnemy(e, players, 1000, TICK_MS);
    expect(e.phase).toBe("aim");
    expect(e.phaseUntil).toBe(1000 + c.aimMs);
    p.x = 3; // the player steps aside; the Charger does not follow
    stepEnemy(e, players, 1050, TICK_MS);
    expect(e.facing).toBe(0);
  });

  it("runs down the lane and throws the player it meets: double damage and a 3 m slide they cannot act through", () => {
    const { e, p, players } = lane(8);
    const { events, now } = run(e, players, 1000, 3000, OPEN_FIELD, (ev) => ev.some((x) => x.kind === "playerKnocked"));
    expect(events.map((x) => x.kind)).toEqual(["enemyHit", "playerKnocked"]);
    expect(events[0]).toMatchObject({ damage: c.damage, blocked: false });
    expect(e.phase).toBe("recover");
    expect(p.knockUntil).toBe(now + KNOCKBACK.ms);
    const z0 = p.z;
    let t = now + TICK_MS;
    for (; t < now + KNOCKBACK.ms; t += TICK_MS) applyInput(p, { seq: ++seq, dx: -1, dy: 0, attack: true, dodge: true }, t, TICK_MS);
    expect(p.z - z0).toBeCloseTo(3, 6);
    expect([p.x, p.attackUntil, p.dodgeUntil]).toEqual([0, 0, 0]);
    applyInput(p, { seq: ++seq, dx: -1, dy: 0, attack: false, dodge: false }, t, TICK_MS);
    expect(p.x).toBeLessThan(0); // free again
  });

  it("a dodge goes through the charge", () => {
    const { e, p, players } = lane(8);
    run(e, players, 1000, c.aimMs + 100); // aimed and just started
    p.dodgeUntil = 1e9; // dodging for the whole run
    const { events } = run(e, players, 1000 + c.aimMs + 150, 2000);
    expect(events.some((x) => x.kind === "enemyHit")).toBe(false);
    expect(p.hp).toBe(PLAYER.hp);
  });

  it("a parry stops it cold: no damage, no throw", () => {
    const { e, p, players } = lane(6);
    p.facing = Math.PI; // facing the Charger
    run(e, players, 1000, c.aimMs);
    const hitAt = (() => {
      // Find when the run reaches the player, then replay with the guard raised just before.
      const probe = structuredClone({ e, p });
      const r = run(probe.e, new Map([["a", probe.p]]), 1000 + c.aimMs + TICK_MS, 2000, OPEN_FIELD, (ev) => ev.length > 0);
      return r.now;
    })();
    applyInput(p, { seq: ++seq, dx: 0, dy: 0, attack: false, dodge: false, block: true }, hitAt - 100, TICK_MS);
    const { events } = run(e, players, 1000 + c.aimMs + TICK_MS, 2000, OPEN_FIELD, (ev) => ev.length > 0);
    expect(events.map((x) => x.kind)).toEqual(["playerParried"]);
    expect(p.hp).toBe(PLAYER.hp);
    expect(p.knockUntil).toBe(0);
  });

  it("a wall stops the run and stuns it", () => {
    const walled: Level = { ...OPEN_FIELD, walls: [{ x: 0, z: 4, hw: 2, hd: 0.3 }] };
    const e = createEnemy("e1", "charger", 0, 0, 0);
    e.phase = "aim";
    e.phaseUntil = 1000;
    const p = createPlayer("a", 0, 10);
    const { events, now } = run(e, new Map([["a", p]]), 1000, 2000, walled, (ev) => ev.length > 0);
    expect(events).toEqual([{ kind: "chargeWall", enemyId: "e1" }]);
    expect(e.phase).toBe("recover");
    expect(e.phaseUntil).toBe(now + c.wallStunMs);
    expect(hasState(e.states, "staggered", now)).toBe(true);
  });

  it("charges at most every 7 s, swings up close, and waits for a clear line", () => {
    const { e, players } = lane(8);
    stepEnemy(e, players, 1000, TICK_MS);
    expect(e.chargeReadyAt).toBe(1000 + c.everyMs);
    const near = lane(1.5);
    stepEnemy(near.e, near.players, 1000, TICK_MS);
    expect(near.e.phase).toBe("windup");
    const hidden = lane(8);
    stepEnemy(hidden.e, hidden.players, 1000, TICK_MS, { ...OPEN_FIELD, walls: [{ x: 0, z: 4, hw: 2, hd: 0.3 }] });
    expect(hidden.e.phase).toBe("chase");
    const cooling = lane(8);
    cooling.e.chargeReadyAt = 5000;
    stepEnemy(cooling.e, cooling.players, 1000, TICK_MS);
    expect(cooling.e.phase).toBe("chase");
  });

  it("Cleave breaks the aim", () => {
    const e = createEnemy("e1", "charger", 0, 1.5, Math.PI);
    e.phase = "aim";
    e.phaseUntil = 5000;
    const p = createPlayer("a", 0, 0);
    p.facing = 0;
    cleave(p, 0);
    const [hit] = resolvePlayerAttacks([p], [e], ABILITIES.cleave.windupMs);
    expect(hit).toMatchObject({ kind: "abilityHit", interrupted: true });
    expect(e.phase).toBe("recover");
  });

  it("a thrown player predicts the same slide as the server", () => {
    const a = createPlayer("a");
    a.knockUntil = 300;
    a.knockDx = KNOCKBACK.speed;
    const b = structuredClone(a);
    for (let t = 0; t < 400; t += TICK_MS) {
      const f = { seq: ++seq, dx: 0, dy: 1, attack: false, dodge: false };
      applyInput(a, f, t, TICK_MS);
      applyInput(b, f, t, TICK_MS);
    }
    expect(a).toEqual(b);
  });
});

describe("the Pack Leader", () => {
  const r = PACK_LEADER.rally!;

  it("rallies the other enemies within its reach, and only while it lives", () => {
    const leader = createEnemy("e1", "packLeader", 0, 0);
    const near = createEnemy("e2", "goblin", r.radius - 0.5, 0);
    const far = createEnemy("e3", "goblin", r.radius + 0.5, 0);
    const other = createEnemy("e4", "packLeader", -5, -5);
    updateRallies([leader, near, far, other]);
    expect([near.rallied, far.rallied, leader.rallied, other.rallied]).toEqual([true, false, false, false]);
    expect(leader.leading).toBe(true);
    leader.phase = "dead";
    other.phase = "dead";
    updateRallies([leader, near, far, other]);
    expect(near.rallied).toBe(false);
  });

  it("a rallied goblin is quicker and hits harder", () => {
    const run = (rallied: boolean) => {
      const enemies = [createEnemy("e1", "goblin", 0, 0)];
      if (rallied) enemies.push(createEnemy("e9", "packLeader", 0, -3));
      enemies[0].phase = "chase";
      const p = createPlayer("a", 0, 10);
      const players = new Map([["a", p]]);
      stepEnemies(enemies, players, 1000, TICK_MS, OPEN_FIELD);
      const moved = enemies[0].z;
      // Now in reach: let a swing land.
      p.z = enemies[0].z + 1.2;
      enemies[0].phase = "windup";
      enemies[0].phaseUntil = 2000;
      const events = stepEnemies(enemies, players, 2000, TICK_MS, OPEN_FIELD);
      return { moved, hit: events.find((e) => e.kind === "enemyHit") };
    };
    const plain = run(false);
    const rallied = run(true);
    expect(rallied.moved).toBeCloseTo(plain.moved * r.speedMult, 9);
    expect(plain.hit).toMatchObject({ damage: GOBLIN.damage });
    expect(rallied.hit).toMatchObject({ damage: Math.round(GOBLIN.damage * r.damageMult) });
  });

  it("hangs back behind a rallied pack, and closes in once it is alone", () => {
    const leader = createEnemy("e1", "packLeader", 0, 0, 0);
    leader.phase = "chase";
    const goblin = createEnemy("e2", "goblin", 0, 1);
    goblin.hp = 0;
    goblin.phase = "dead";
    const p = createPlayer("a", 0, 5.2);
    const players = new Map([["a", p]]);
    stepEnemies([leader, goblin], players, 1000, TICK_MS, OPEN_FIELD);
    expect(leader.z).toBeGreaterThan(0); // alone: comes on
    const l2 = createEnemy("e1", "packLeader", 0, 0, 0);
    l2.phase = "chase";
    const pack = createEnemy("e2", "goblin", 2, 0);
    pack.phase = "chase";
    p.z = r.holdBack - 0.1;
    stepEnemies([l2, pack], players, 1000, TICK_MS, OPEN_FIELD);
    expect(l2.z).toBe(0); // inside its hold-back distance: stays put
  });

  it("the yard's leader starts with a goblin in reach", () => {
    const enemies = createEnemies(YARD);
    updateRallies([...enemies.values()]);
    expect([...enemies.values()].filter((e) => e.rallied).map((e) => e.kind)).toEqual(["goblin"]);
  });
});
