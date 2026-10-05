import { describe, expect, it } from "vitest";
import { cameraOffset, cameraRelativeMove, fightYaw, slewYaw, wallHides, wrapAngle } from "./camera";
import { CAMERA } from "./sim";

const deg = (d: number) => (d * Math.PI) / 180;

describe("camera", () => {
  it("sits at the design doc's 30 to 40 degrees, closer than the old 15.8 m", () => {
    const o = cameraOffset(0);
    const elev = (Math.atan2(o.y, Math.hypot(o.x, o.z)) * 180) / Math.PI;
    expect(elev).toBeGreaterThanOrEqual(30);
    expect(elev).toBeLessThanOrEqual(40);
    expect(Math.hypot(o.x, o.y, o.z)).toBeLessThan(15.8);
    // Yaw 0 is the old camera's side: south of the player, looking north.
    expect(o.z).toBeGreaterThan(0);
    expect(Math.abs(o.x)).toBeLessThan(1e-9);
  });

  it("moves exactly as before at yaw 0", () => {
    expect(cameraRelativeMove(0, -1, 0)).toEqual({ dx: 0, dy: -1 });
    const d = cameraRelativeMove(1, 0, 0);
    expect(d.dx).toBe(1);
    expect(d.dy === 0).toBe(true);
  });

  it("walks W away from the eye and D to the screen's right at any yaw", () => {
    for (const yaw of [deg(30), deg(90), deg(-135), deg(180)]) {
      const eye = cameraOffset(yaw);
      const w = cameraRelativeMove(0, -1, yaw);
      // Away from the eye: opposite the eye's ground offset.
      expect(w.dx * eye.x + w.dy * eye.z).toBeLessThan(0);
      expect(Math.hypot(w.dx, w.dy)).toBeCloseTo(1, 9);
      const d = cameraRelativeMove(1, 0, yaw);
      // Screen right is forward x up: (-fz, fx) on the ground.
      expect(d.dx).toBeCloseTo(-w.dy, 9);
      expect(d.dy).toBeCloseTo(w.dx, 9);
    }
  });

  it("turns the camera to put the fight in front, and holds out of combat", () => {
    const me = { x: 0, z: 0 };
    expect(fightYaw(me, [], [{ x: 5, z: 0 }])).toBeNull();
    // A goblin to the east: the camera looks east, so the eye goes west of the player.
    const east = fightYaw(me, [{ x: 6, z: 0 }], [])!;
    const eye = cameraOffset(east);
    expect(eye.x).toBeLessThan(0);
    expect(Math.abs(eye.z)).toBeLessThan(1e-9);
    // W then walks toward it.
    const w = cameraRelativeMove(0, -1, east);
    expect(w.dx).toBeCloseTo(1, 9);
    // Too far away is out of the fight.
    expect(fightYaw(me, [{ x: CAMERA.fightRadiusM + 1, z: 0 }], [])).toBeNull();
    // A fight centred on the player gives no direction.
    expect(fightYaw(me, [{ x: 1, z: 0 }, { x: -1, z: 0 }], [])).toBeNull();
    // A teammate pulls the centre toward them, but only while there is a fight.
    const withMate = fightYaw(me, [{ x: 6, z: 0 }], [{ x: 0, z: -6 }])!;
    expect(wrapAngle(withMate - east)).not.toBeCloseTo(0, 2);
  });

  it("turns slowly, never snaps, and rests inside the deadband", () => {
    let yaw = 0;
    const target = deg(180);
    const capPerFrame = deg(CAMERA.maxTurnDegPerS) * (16 / 1000);
    let steps = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const next = slewYaw(yaw, target, 16);
      expect(Math.abs(wrapAngle(next - yaw))).toBeLessThanOrEqual(capPerFrame + 1e-12);
      if (next !== yaw) steps++;
      yaw = next;
    }
    expect(steps).toBeGreaterThan(60);
    const rest = Math.abs(wrapAngle(target - yaw));
    expect(rest).toBeLessThanOrEqual(deg(CAMERA.deadbandDeg) + deg(1));
    // Inside the deadband nothing moves; null holds.
    expect(slewYaw(0.1, 0.1 + deg(CAMERA.deadbandDeg) / 2, 16)).toBe(0.1);
    expect(slewYaw(0.3, null, 16)).toBe(0.3);
  });

  it("takes the short way round across the back", () => {
    const next = slewYaw(deg(170), deg(-150), 100);
    expect(wrapAngle(next - deg(170))).toBeGreaterThan(0);
  });

  it("finds the wall between the eye and the player", () => {
    const aim = { x: 0, y: CAMERA.fadeAimY, z: 0 };
    const o = cameraOffset(0);
    const eye = { x: o.x, y: o.y + CAMERA.targetY, z: o.z };
    const pillar = (x: number, z: number) => ({ x, z, hw: 0.4, hd: 0.4 });
    // A 1.8 m pillar just south of the player hides them; the same pillar north does not.
    expect(wallHides(eye, aim, pillar(0, 1), 1.8)).toBe(true);
    expect(wallHides(eye, aim, pillar(0, -1), 1.8)).toBe(false);
    // Off to the side of the sight line.
    expect(wallHides(eye, aim, pillar(2, 1), 1.8)).toBe(false);
    // Far enough toward the eye, the line has climbed over it.
    expect(wallHides(eye, aim, pillar(0, 4), 1.8)).toBe(false);
    // A 1.1 m wall never hides the middle of a player pressed against it (0.4 m radius).
    expect(wallHides(eye, aim, { x: 0, z: 0.55, hw: 3, hd: 0.15 }, 1.1)).toBe(false);
    // Turned with the camera: east of the player is now in front of an eye in the west.
    const o2 = cameraOffset(Math.PI / 2);
    const eye2 = { x: o2.x, y: o2.y + CAMERA.targetY, z: o2.z };
    expect(wallHides(eye2, aim, pillar(1, 0), 1.8)).toBe(true);
    expect(wallHides(eye2, aim, pillar(-1, 0), 1.8)).toBe(false);
  });
});
