import { describe, expect, it } from "vitest";
import { cameraOffset, cameraRelativeMove, cameraRight, wallHides } from "./camera";
import { CAMERA } from "./sim";

const deg = (d: number) => (d * Math.PI) / 180;

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
