import { describe, expect, it } from "vitest";
import {
  DOWNS,
  PLAYER,
  TICK_MS,
  createEnemy,
  createPlayer,
  downPlayer,
  isAlive,
  isDead,
  isValidInput,
  neutralInput,
  stepDowns,
  useDraught,
  type PlayerSim
} from "./sim";

/** `a` bled out at the origin; `b` standing `gap` metres away on x. */
function deadAndFriend(gap: number) {
  const a = createPlayer("a", 0, 0);
  const b = createPlayer("b", gap, 0);
  downPlayer(a, 0);
  bleedOut([a]);
  return { a, b, players: [a, b] };
}

/** Bleed the downed out with nobody near them (a far teammate keeps it from being a wipe). */
function bleedOut(downed: PlayerSim[]) {
  const enemy = createEnemy();
  const players = [...downed, createPlayer("far", 15, 15)];
  for (let t = TICK_MS; t <= DOWNS.bleedOutMs; t += TICK_MS) stepDowns(players, [enemy], t, TICK_MS);
}

describe("revive draught (Phase 1 stand-in counter)", () => {
  it("every player starts with draughtsPerFloor", () => {
    expect(createPlayer("a").draughts).toBe(DOWNS.draughtsPerFloor);
    expect(DOWNS.draughtsPerFloor).toBe(1);
  });

  it("the input carries an optional use flag", () => {
    expect(isValidInput({ seq: 1, dx: 0, dy: 0, attack: false, dodge: false })).toBe(true);
    expect(isValidInput({ seq: 1, dx: 0, dy: 0, attack: false, dodge: false, use: true })).toBe(true);
    expect(isValidInput({ seq: 1, dx: 0, dy: 0, attack: false, dodge: false, use: 1 })).toBe(false);
    expect(neutralInput(3).use).toBe(false);
  });

  it("brings a dead teammate back where they lie, and spends one", () => {
    const { a, b, players } = deadAndFriend(2);
    expect(isDead(a)).toBe(true);
    const events = useDraught(b, players);
    expect(events).toEqual([{ kind: "playerRevived", playerId: "a", byId: "b", draughtsLeft: 0 }]);
    expect(isAlive(a)).toBe(true);
    expect(a.hp).toBe(DOWNS.draughtHp);
    expect([a.x, a.z]).toEqual([0, 0]);
    expect(b.draughts).toBe(0);
  });

  it("does nothing and spends nothing out of reach, on the downed, or on the respawning", () => {
    const far = deadAndFriend(DOWNS.draughtRange + 0.1);
    expect(useDraught(far.b, far.players)).toEqual([]);
    expect(far.b.draughts).toBe(1);

    // Downed is the free pickup's job, not the draught's.
    const a = createPlayer("a", 0, 0);
    const b = createPlayer("b", 1, 0);
    downPlayer(a, 0);
    expect(useDraught(b, [a, b])).toEqual([]);
    expect(b.draughts).toBe(1);

    // Already on a respawn timer (room cleared): coming back free.
    const timed = deadAndFriend(1);
    timed.a.respawnAt = 5000;
    expect(useDraught(timed.b, timed.players)).toEqual([]);
    expect(timed.b.draughts).toBe(1);
  });

  it("one draught a floor: the second press finds the bottle empty", () => {
    const { a, b, players } = deadAndFriend(1);
    const c = createPlayer("c", -1, 0);
    downPlayer(c, 0);
    bleedOut([c]);
    players.push(c);
    expect(useDraught(b, players)).toHaveLength(1);
    expect(useDraught(b, players)).toEqual([]);
    expect([isDead(a), isDead(c)].filter(Boolean)).toHaveLength(1);
  });

  it("picks the nearest body, and the downed or dead cannot use one", () => {
    const a = createPlayer("a", 2, 0);
    const c = createPlayer("c", 0.5, 0);
    const b = createPlayer("b", 0, 0);
    for (const p of [a, c]) downPlayer(p, 0);
    bleedOut([a, c]);
    expect(useDraught(b, [a, b, c])[0]).toMatchObject({ playerId: "c" });

    const d = createPlayer("d", 0, 0);
    const e = createPlayer("e", 1, 0);
    downPlayer(d, 0);
    downPlayer(e, 0);
    bleedOut([d, e]);
    expect(useDraught(d, [d, e])).toEqual([]);
    expect(d.draughts).toBe(1);
  });

  it("a wipe (the end of the run until floors exist) refills everyone", () => {
    const { a, b, players } = deadAndFriend(1);
    useDraught(b, players);
    expect(b.draughts).toBe(0);
    downPlayer(a, 0);
    downPlayer(b, 0);
    const events = stepDowns(players, [createEnemy()], 100, TICK_MS);
    expect(events).toContainEqual({ kind: "squadWiped" });
    expect(b.draughts).toBe(DOWNS.draughtsPerFloor);
    expect(a.respawnAt).toBe(100 + PLAYER.respawnMs);
  });
});
