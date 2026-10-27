import { describe, expect, it } from "vitest";
import { OPEN_FIELD, type Level } from "./level";
import {
  PLAYER,
  TICK_MS,
  applyInput,
  createPlayer,
  downPlayer,
  isAirborne,
  isAttacking,
  isDodging,
  isValidInput,
  jumpHeight,
  type InputFrame,
  type PlayerSim
} from "./sim";

const dt = TICK_MS / 1000;

function frame(seq: number, f: Partial<InputFrame> = {}): InputFrame {
  return { seq, dx: 0, dy: 0, attack: false, dodge: false, ...f };
}

/** Apply `n` frames one tick apart from `t0`, as the server's slots do; returns the time of the last. */
function run(p: PlayerSim, n: number, t0: number, f: (i: number) => Partial<InputFrame>, level: Level = OPEN_FIELD): number {
  let t = t0;
  for (let i = 0; i < n; i++) {
    t += TICK_MS;
    applyInput(p, frame(i + 1, f(i)), t, TICK_MS, level);
  }
  return t;
}

describe("sprint", () => {
  it("runs at sprintMult times walking speed while held and moving", () => {
    const p = createPlayer("a");
    run(p, 20, 0, () => ({ dx: 1, sprint: true }));
    expect(p.x).toBeCloseTo(PLAYER.speed * PLAYER.sprintMult * 20 * dt, 5);
    expect(PLAYER.speed * PLAYER.sprintMult).toBeCloseTo(9, 5);
  });

  it("does nothing standing still, and a swing stops it", () => {
    const p = createPlayer("a");
    run(p, 4, 0, () => ({ sprint: true }));
    expect(p.x).toBe(0);
    const t = run(p, 1, 200, () => ({ dx: 1, sprint: true, attack: true }));
    expect(isAttacking(p, t)).toBe(true);
    const x = p.x;
    run(p, 3, t, () => ({ dx: 1, sprint: true }));
    expect(p.x).toBe(x);
  });

  it("is a shuffle behind a guard, not a run", () => {
    const a = createPlayer("a");
    const b = createPlayer("b");
    run(a, 10, 0, () => ({ dx: 1, block: true }));
    run(b, 10, 0, () => ({ dx: 1, block: true, sprint: true }));
    expect(b.x).toBeCloseTo(a.x, 9);
  });

  it("dodges the same dodge from a sprint", () => {
    const a = createPlayer("a");
    const b = createPlayer("b");
    run(a, 1, 0, () => ({ dx: 1, dodge: true }));
    run(b, 1, 0, () => ({ dx: 1, dodge: true, sprint: true }));
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.x).toBeCloseTo(PLAYER.dodgeSpeed * dt, 5);
  });
});

describe("jump", () => {
  it("is a parabola: zero at takeoff and landing, jumpHeight at the top", () => {
    const p = { jumpUntil: 1000 + PLAYER.jumpMs };
    expect(jumpHeight(p, 1000)).toBe(0);
    expect(jumpHeight(p, 1000 + PLAYER.jumpMs / 2)).toBeCloseTo(PLAYER.jumpHeight, 9);
    expect(jumpHeight(p, 1000 + PLAYER.jumpMs)).toBe(0);
    expect(jumpHeight(p, 1000 + PLAYER.jumpMs / 4)).toBeCloseTo(jumpHeight(p, 1000 + (3 * PLAYER.jumpMs) / 4), 9);
    expect(jumpHeight({ jumpUntil: 0 }, 5000)).toBe(0);
  });

  it("takes off on a press and lands after jumpMs, on a tick", () => {
    const p = createPlayer("a");
    const air = Math.round(PLAYER.jumpMs / TICK_MS);
    expect(Math.abs(air * TICK_MS - PLAYER.jumpMs)).toBeLessThan(1e-9);
    applyInput(p, frame(1, { jump: true }), 3 * TICK_MS, TICK_MS);
    expect(p.jumpUntil).toBe((3 + air) * TICK_MS);
    expect(isAirborne(p, (2 + air) * TICK_MS)).toBe(true);
    expect(isAirborne(p, (3 + air) * TICK_MS)).toBe(false);
  });

  it("carries the takeoff speed: about 3 m walking and 4.5 m sprinting", () => {
    const walk = createPlayer("a");
    const sprint = createPlayer("b");
    // Takeoff tick plus nine more in the air: ten ticks of the carried speed.
    run(walk, PLAYER.jumpMs / TICK_MS, 0, (i) => ({ dx: 1, jump: i === 0, sprint: false }));
    run(sprint, PLAYER.jumpMs / TICK_MS, 0, (i) => ({ dx: 1, jump: i === 0, sprint: true }));
    const steer = PLAYER.speed * PLAYER.jumpSteer * (PLAYER.jumpMs / 1000);
    expect(walk.x).toBeCloseTo(PLAYER.speed * (PLAYER.jumpMs / 1000) + steer, 5);
    expect(sprint.x).toBeCloseTo(PLAYER.speed * PLAYER.sprintMult * (PLAYER.jumpMs / 1000) + steer, 5);
    expect(walk.x - steer).toBeCloseTo(3, 5);
    expect(sprint.x - steer).toBeCloseTo(4.5, 5);
  });

  it("keeps the takeoff speed when the stick lets go, and steers only a little", () => {
    const p = createPlayer("a");
    run(p, 1, 0, () => ({ dx: 1, jump: true }));
    const x1 = p.x;
    run(p, 3, TICK_MS, () => ({ dx: -1 }));
    // Reversing the stick in the air slows the hop by the steer, it does not turn it round.
    expect(p.x - x1).toBeCloseTo(3 * (PLAYER.speed - PLAYER.speed * PLAYER.jumpSteer) * dt, 5);
    expect(p.facing).toBeCloseTo(Math.PI / 2, 9);
  });

  it("a standing jump goes straight up", () => {
    const p = createPlayer("a");
    run(p, PLAYER.jumpMs / TICK_MS, 0, (i) => ({ jump: i === 0 }));
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
  });

  it("no swing, ability, dodge, guard or second jump in the air", () => {
    const p = createPlayer("a");
    const t0 = run(p, 1, 0, () => ({ jump: true }));
    const until = p.jumpUntil;
    const t = run(p, 1, t0, () => ({ attack: true, ability: 1, dodge: true, block: true, jump: true }));
    expect(isAttacking(p, t)).toBe(false);
    expect(isDodging(p, t)).toBe(false);
    expect(p.guarding).toBe(false);
    expect(p.jumpUntil).toBe(until);
    expect(p.readyAt[0]).toBe(0);
  });

  it("swings again once landed", () => {
    const p = createPlayer("a");
    const t0 = run(p, PLAYER.jumpMs / TICK_MS, 0, (i) => ({ jump: i === 0 }));
    expect(isAirborne(p, t0 + TICK_MS)).toBe(false);
    const t = run(p, 1, t0, () => ({ attack: true }));
    expect(isAttacking(p, t)).toBe(true);
  });

  it("cannot take off mid-swing or mid-dodge, and a dodge pressed with it wins", () => {
    const a = createPlayer("a");
    run(a, 1, 0, () => ({ attack: true }));
    run(a, 1, TICK_MS, () => ({ jump: true }));
    expect(a.jumpUntil).toBe(0);

    const b = createPlayer("b");
    run(b, 1, 0, () => ({ dx: 1, dodge: true, jump: true }));
    expect(b.dodgeUntil).toBeGreaterThan(0);
    expect(b.jumpUntil).toBe(0);
  });

  it("drops a raised guard", () => {
    const p = createPlayer("a");
    run(p, 2, 0, () => ({ block: true }));
    expect(p.guarding).toBe(true);
    run(p, 1, 2 * TICK_MS, () => ({ block: true, jump: true }));
    expect(p.guarding).toBe(false);
  });

  it("clears no wall: a hop into one stops at it as a walk does", () => {
    const wall: Level = { ...OPEN_FIELD, walls: [{ x: 2, z: 0, hw: 0.4, hd: 3, h: 0.6 }] };
    const p = createPlayer("a");
    run(p, PLAYER.jumpMs / TICK_MS, 0, (i) => ({ dx: 1, jump: i === 0, sprint: true }), wall);
    expect(p.x).toBeLessThanOrEqual(2 - 0.4 - PLAYER.radius + 1e-9);
  });

  it("a down cancels the jump", () => {
    const p = createPlayer("a");
    run(p, 1, 0, () => ({ jump: true }));
    downPlayer(p, 100);
    expect(isAirborne(p, 100)).toBe(false);
  });

  it("is identical from identical inputs (the prediction is the server)", () => {
    const script = (i: number): Partial<InputFrame> => ({
      dx: Math.sin(i * 0.3),
      dy: Math.cos(i * 0.2),
      sprint: i % 7 < 4,
      jump: i % 13 === 0,
      dodge: i % 17 === 5,
      attack: i % 11 === 3
    });
    const a = createPlayer("a");
    const b = createPlayer("b");
    run(a, 200, 0, script);
    run(b, 200, 0, script);
    expect({ ...b, id: "a" }).toEqual(a);
  });

  it("validates jump and sprint as booleans", () => {
    expect(isValidInput(frame(1, { jump: true, sprint: false }))).toBe(true);
    expect(isValidInput({ ...frame(1), jump: 1 })).toBe(false);
    expect(isValidInput({ ...frame(1), sprint: "yes" })).toBe(false);
  });
});
