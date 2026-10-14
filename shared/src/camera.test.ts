import { describe, expect, it } from "vitest";
import {
  cameraOffset,
  cameraRelativeMove,
  cameraRight,
  clearDistance,
  easeDistance,
  LOCK_TUNING,
  lockYaw,
  slewYaw,
  swingTarget,
  turnCamera,
  wallHides,
  wrapAngle
} from "./camera";
import { CAMERA } from "./sim";

const deg = (d: number) => (d * Math.PI) / 180;
const head = { x: 0, y: CAMERA.targetY, z: 0 };

describe("camera", () => {
  it("sits low and close over the shoulder (Michael, 2026-10-13)", () => {
    const o = cameraOffset(0);
    const elev = (Math.atan2(o.y, Math.hypot(o.x, o.z)) * 180) / Math.PI;
    expect(elev).toBeGreaterThanOrEqual(12);
    expect(elev).toBeLessThanOrEqual(15);
    expect(Math.hypot(o.x, o.y, o.z)).toBeGreaterThanOrEqual(5);
    expect(Math.hypot(o.x, o.y, o.z)).toBeLessThanOrEqual(6);
    expect(CAMERA.targetY).toBeCloseTo(1.6, 1);
    // Yaw 0: south of the player, looking north; the shoulder is to the east (screen right).
    expect(o.z).toBeGreaterThan(0);
    expect(Math.abs(o.x)).toBeLessThan(1e-9);
    const r = cameraRight(0, CAMERA.shoulderM);
    expect(r.x).toBeCloseTo(CAMERA.shoulderM, 9);
    expect(r.z === 0).toBe(true);
  });

  it("moves exactly as before at yaw 0", () => {
    expect(cameraRelativeMove(0, -1, 0)).toEqual({ dx: 0, dy: -1 });
    const d = cameraRelativeMove(1, 0, 0);
    expect(d.dx).toBe(1);
    expect(d.dy === 0).toBe(true);
  });

  it("walks W away from the eye and D toward the shoulder side at any yaw", () => {
    for (const yaw of [deg(30), deg(90), deg(-135), deg(180)]) {
      const eye = cameraOffset(yaw);
      const w = cameraRelativeMove(0, -1, yaw);
      expect(w.dx * eye.x + w.dy * eye.z).toBeLessThan(0);
      expect(Math.hypot(w.dx, w.dy)).toBeCloseTo(1, 9);
      const d = cameraRelativeMove(1, 0, yaw);
      const r = cameraRight(yaw);
      expect(d.dx).toBeCloseTo(r.x, 9);
      expect(d.dy).toBeCloseTo(r.z, 9);
    }
  });

  it("turns left on Left, raises the eye on Up, and keeps the tilt in its clamp", () => {
    // Left for a quarter second: the view turns left, so W walks more to the west (-x).
    const left = turnCamera(0, CAMERA.pitchDeg, -1, 0, 250);
    expect(left.yaw).toBeCloseTo(deg(CAMERA.yawRateDegPerS * 0.25), 9);
    expect(cameraRelativeMove(0, -1, left.yaw).dx).toBeLessThan(0);
    expect(left.pitchDeg).toBe(CAMERA.pitchDeg);
    const up = turnCamera(0, CAMERA.pitchDeg, 0, -1, 100);
    expect(up.pitchDeg).toBeCloseTo(CAMERA.pitchDeg + CAMERA.pitchRateDegPerS * 0.1, 9);
    expect(turnCamera(0, CAMERA.pitchDeg, 0, -1, 10_000).pitchDeg).toBe(CAMERA.maxPitchDeg);
    expect(turnCamera(0, CAMERA.pitchDeg, 0, 1, 10_000).pitchDeg).toBe(CAMERA.minPitchDeg);
    expect(CAMERA.minPitchDeg).toBeGreaterThanOrEqual(5);
    expect(CAMERA.maxPitchDeg).toBeLessThanOrEqual(45);
    // Wraps rather than winding up.
    expect(Math.abs(turnCamera(deg(179), CAMERA.pitchDeg, -1, 0, 100).yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it("swings in behind forward travel and holds for standing, strafing and backing up", () => {
    // Running north-east while the camera looks north: swing toward looking north-east.
    const ne = swingTarget(0, 3, -3)!;
    expect(ne).not.toBeNull();
    expect(cameraRelativeMove(0, -1, ne).dx).toBeCloseTo(Math.SQRT1_2, 6);
    // Too slow, sideways, backward: hold, so a strafe never wheels the player round.
    expect(swingTarget(0, 0.5, -0.5)).toBeNull();
    expect(swingTarget(0, 4, 0)).toBeNull();
    expect(swingTarget(0, 0, 4)).toBeNull();
  });

  it("swings slowly, never snaps, and rests at the deadband's edge", () => {
    let yaw = 0;
    const target = deg(70);
    const capPerFrame = deg(CAMERA.maxTurnDegPerS) * (16 / 1000);
    let steps = 0;
    for (let i = 0; i < 60 * 10; i++) {
      const next = slewYaw(yaw, target, 16);
      expect(Math.abs(wrapAngle(next - yaw))).toBeLessThanOrEqual(capPerFrame + 1e-12);
      if (next !== yaw) steps++;
      yaw = next;
    }
    expect(steps).toBeGreaterThan(30);
    expect(Math.abs(wrapAngle(target - yaw))).toBeLessThanOrEqual(deg(CAMERA.deadbandDeg) + deg(1));
    expect(slewYaw(0.1, 0.1 + deg(CAMERA.deadbandDeg) / 2, 16)).toBe(0.1);
    expect(slewYaw(0.3, null, 16)).toBe(0.3);
    // The short way round across the back.
    expect(wrapAngle(slewYaw(deg(170), deg(-150), 100) - deg(170))).toBeGreaterThan(0);
  });

  it("keeps the bow's lock framed", () => {
    // A locked goblin due east: the camera turns until it is within the framing angle of ahead.
    const me = { x: 0, z: 0 };
    const target = lockYaw(me, { x: 8, z: 0 })!;
    expect(cameraRelativeMove(0, -1, target).dx).toBeCloseTo(1, 9);
    let yaw = 0;
    for (let i = 0; i < 60 * 3; i++) yaw = slewYaw(yaw, target, 16, LOCK_TUNING);
    expect(Math.abs(wrapAngle(target - yaw))).toBeLessThanOrEqual(deg(CAMERA.lockFrameDeg) + deg(1));
    expect(lockYaw(me, { x: 0.1, z: 0 })).toBeNull();
  });

  it("pulls the eye in short of a wall behind the player and never into it", () => {
    const o = cameraOffset(0);
    const eye = { x: head.x + o.x, y: head.y + o.y, z: head.z + o.z };
    const full = Math.hypot(o.x, o.y, o.z);
    expect(clearDistance(head, eye, [])).toBeCloseTo(full, 9);
    // A 1.1 m wall 2 m behind: the eye ray clears it (it climbs over), no pull.
    const low = { rect: { x: 0, z: 2, hw: 3, hd: 0.15 }, h: 1.1 };
    expect(clearDistance(head, eye, [low])).toBeCloseTo(full, 9);
    // A 3 m building wall 2 m behind: in to the wall less the pad.
    const tall = { rect: { x: 0, z: 2, hw: 3, hd: 0.15 }, h: 3 };
    const d = clearDistance(head, eye, [tall]);
    expect(d).toBeLessThan(2);
    expect(d).toBeGreaterThanOrEqual(CAMERA.minDistanceM);
    // The pulled-in eye is outside the wall: its z stops short of the wall's near face.
    const zAt = (o.z * d) / full;
    expect(zAt).toBeLessThan(2 - 0.15);
    // Pressed against it: never closer than the minimum.
    expect(clearDistance(head, eye, [{ rect: { x: 0, z: 0.6, hw: 3, hd: 0.15 }, h: 3 }])).toBe(CAMERA.minDistanceM);
    // A roof overhead (inside a building) pulls it in too; a roof elsewhere does not.
    const roof = (z: number) => ({ rect: { x: 0, z, hw: 6, hd: 6 }, y0: 2.6, h: 2.9 });
    expect(clearDistance(head, eye, [roof(0)])).toBeLessThan(full);
    expect(clearDistance(head, eye, [roof(-14)])).toBeCloseTo(full, 9);
  });

  it("comes in at once and eases back out", () => {
    expect(easeDistance(5.5, 2, 16)).toBe(2);
    const out = easeDistance(2, 5.5, 16);
    expect(out).toBeGreaterThan(2);
    expect(out).toBeLessThan(2.5);
    let d = 2;
    for (let i = 0; i < 120; i++) d = easeDistance(d, 5.5, 16);
    expect(d).toBeCloseTo(5.5, 1);
  });

  it("finds the pillar between the eye and the player's body", () => {
    const aim = { x: 0, y: CAMERA.fadeAimY, z: 0 };
    const o = cameraOffset(0);
    const eye = { x: o.x, y: o.y + CAMERA.targetY, z: o.z };
    const pillar = (x: number, z: number) => ({ x, z, hw: 0.4, hd: 0.4 });
    expect(wallHides(eye, aim, pillar(0, 1), 1.8)).toBe(true);
    expect(wallHides(eye, aim, pillar(0, -1), 1.8)).toBe(false);
    expect(wallHides(eye, aim, pillar(2, 1), 1.8)).toBe(false);
    const o2 = cameraOffset(Math.PI / 2);
    const eye2 = { x: o2.x, y: o2.y + CAMERA.targetY, z: o2.z };
    expect(wallHides(eye2, aim, pillar(1, 0), 1.8)).toBe(true);
    expect(wallHides(eye2, aim, pillar(-1, 0), 1.8)).toBe(false);
  });
});
