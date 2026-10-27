import * as THREE from "three";
import { GROUND_BOX, sphereCast, tuning, wrapAngle, type BoxCollider, type Vec3 } from "@hearthgate/shared";

const DEG = Math.PI / 180;

/**
 * The combat slice's orbit camera (step 1 of the combat port), centred behind the hero:
 *
 * - Orbits a pivot above the hero; the player turns it (arrows, right stick, mouse) and pitch is
 *   clamped to `tuning.camera`.
 * - Sphere-casts pivot to eye against the level's walls, roofs and the ground, and eases in toward
 *   them: a wider look-ahead probe starts the ease before contact, a cast where the orbit is heading
 *   catches a fast swing, and a hard clamp guarantees the eye never ends up inside anything.
 * - Won't come closer than `minDistance`: when walls would force that, it cranes up over the hero.
 * - The bow's lock swings it round to keep the target in front and pulls the look point toward it.
 *
 * Draw-only, and Hearthgate's conventions: yaw 0 is the eye south of the hero (+z) looking north,
 * the same as `cameraRelativeMove` and `shared/src/camera.ts`, so the move keys need no change.
 * Hearthgate's swing in behind the travel is gone: with strafe movement the hero faces the camera,
 * so there is no travel to swing behind.
 */
export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = tuning.camera.startPitchDeg * DEG;
  /** Extra pitch added automatically when walls crowd the camera. */
  private crane = 0;
  private dist = tuning.camera.distance;
  private readonly pivot = new THREE.Vector3();
  private initialised = false;
  /** Current extra FOV from sprinting. */
  private fovBoost = 0;
  private lockPoint: THREE.Vector3 | null = null;
  private readonly lookPoint = new THREE.Vector3();
  private lastYaw = 0;
  private lastPitch = 0;
  private yawVel = 0;
  private pitchVel = 0;
  private boxes: BoxCollider[] = [GROUND_BOX];
  // Scratch for the casts, so a frame allocates nothing.
  private readonly pv: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly dirNow: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly dirProbe: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(aspect: number) {
    const c = tuning.camera;
    this.camera = new THREE.PerspectiveCamera(c.fovDeg, aspect, c.nearPlane, c.farPlane);
  }

  /** The level's walls and roofs as boxes; the ground is always there. */
  setColliders(walls: readonly BoxCollider[]): void {
    this.boxes = [GROUND_BOX, ...walls];
  }

  /** Start over at the next frame's hero position (a join or a hand-off is a placement, not travel). */
  reset(): void {
    this.initialised = false;
  }

  /** Apply look input (radians: x yaw right positive, y pitch up positive). */
  applyLook(look: { x: number; y: number }): void {
    const c = tuning.camera;
    // Locked on, the camera steers its own yaw.
    if (!this.lockPoint) this.yaw = wrapAngle(this.yaw - look.x);
    this.pitch -= (c.invertY ? -1 : 1) * look.y;
    this.pitch = Math.min(c.pitchMaxDeg * DEG, Math.max(c.pitchMinDeg * DEG, this.pitch));
  }

  /** Lock the framing onto a point (the bow's target, at its chest), or release it with null. */
  setLock(point: Vec3 | null): void {
    if (!point) this.lockPoint = null;
    else (this.lockPoint ??= new THREE.Vector3()).set(point.x, point.y, point.z);
  }

  /**
   * Place the camera for this frame. `dt` in seconds; `hero` the drawn feet (y is the jump's lift);
   * `sprint` 0..1, how far into a sprint (widens the FOV); `calm` is reduced motion, which keeps
   * the camera from moving itself: no swing toward a lock, no FOV breathing.
   */
  update(dt: number, hero: Vec3, sprint: number, calm: boolean): void {
    const c = tuning.camera;
    this.fovBoost += ((calm ? 0 : sprint * c.sprintFovBoostDeg) - this.fovBoost) * (1 - Math.exp(-c.fovBlendRate * dt));
    this.syncProjection();
    if (this.lockPoint && !calm) {
      const dx = this.lockPoint.x - hero.x;
      const dz = this.lockPoint.z - hero.z;
      if (Math.hypot(dx, dz) > 0.5) {
        const diff = wrapAngle(Math.atan2(-dx, -dz) - this.yaw);
        this.yaw = wrapAngle(this.yaw + diff * (1 - Math.exp(-tuning.lockOn.cameraYawRate * dt)));
      }
    }
    // Re-clamp in case the limits were changed from the debug panel.
    this.pitch = Math.min(c.pitchMaxDeg * DEG, Math.max(c.pitchMinDeg * DEG, this.pitch));

    const ty = hero.y + c.pivotHeight;
    if (!this.initialised) {
      this.pivot.set(hero.x, ty, hero.z);
      this.lastYaw = this.yaw;
      this.lastPitch = this.pitch;
      this.yawVel = 0;
      this.pitchVel = 0;
      this.crane = 0;
      this.dist = c.distance;
      this.initialised = true;
    } else {
      const kxz = 1 - Math.exp(-c.followRate * dt);
      const ky = 1 - Math.exp(-c.verticalFollowRate * dt);
      this.pivot.x += (hero.x - this.pivot.x) * kxz;
      this.pivot.y += (ty - this.pivot.y) * ky;
      this.pivot.z += (hero.z - this.pivot.z) * kxz;
    }
    const pivot = this.pv;
    pivot.x = this.pivot.x;
    pivot.y = this.pivot.y;
    pivot.z = this.pivot.z;

    // Orbit velocity, so collision can react to where the camera is about to swing.
    if (dt > 0) {
      const k = 1 - Math.exp(-c.orbitVelocitySmoothing * dt);
      this.yawVel += (wrapAngle(this.yaw - this.lastYaw) / dt - this.yawVel) * k;
      this.pitchVel += ((this.pitch - this.lastPitch) / dt - this.pitchVel) * k;
    }
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    const aheadYaw = this.yaw + this.yawVel * c.anticipationSec;
    const aheadPitch = this.pitchVel * c.anticipationSec;

    // Crane up if walls would push us inside minDistance at the player's pitch.
    let craneTarget = 0;
    if (this.clearance(this.pitch, aheadYaw, aheadPitch) < c.minDistance) {
      const maxPitch = Math.max(this.pitch, c.craneMaxDeg * DEG);
      craneTarget = maxPitch - this.pitch;
      for (let p = this.pitch + 2 * DEG; p <= maxPitch; p += 2 * DEG) {
        if (this.clearance(p, aheadYaw, aheadPitch) >= c.minDistance) {
          craneTarget = p - this.pitch;
          break;
        }
      }
    }
    this.crane += (craneTarget - this.crane) * (1 - Math.exp(-c.craneRate * dt));
    const pitch = this.pitch + this.crane;
    const dir = dirAt(this.yaw, pitch, this.dirNow);

    const hard = sphereCast(pivot, dir, c.distance, c.collisionRadius, this.boxes);
    const ahead = sphereCast(pivot, dirAt(aheadYaw, pitch + aheadPitch, this.dirProbe), c.distance, c.collisionRadius, this.boxes);
    // Wider probe: starts easing in before the camera sphere touches anything.
    const soft = sphereCast(pivot, dir, c.distance, c.collisionRadius + c.softMargin, this.boxes, true) + c.softMargin;
    const target = Math.min(c.distance, hard, ahead, soft);

    const rate = target < this.dist ? c.pullInRate : c.pushOutRate;
    this.dist += (target - this.dist) * (1 - Math.exp(-rate * dt));
    // Hard guarantee: never inside geometry, even if smoothing lags.
    this.dist = Math.max(0.05, Math.min(this.dist, hard));

    this.camera.position.set(pivot.x + dir.x * this.dist, pivot.y + dir.y * this.dist, pivot.z + dir.z * this.dist);
    // Frame hero and target together while locked on.
    this.lookPoint.copy(this.pivot);
    if (this.lockPoint) this.lookPoint.lerp(this.lockPoint, tuning.lockOn.framing);
    this.camera.lookAt(this.lookPoint);
  }

  /** Clearance at a pitch, now and where the orbit is heading. */
  private clearance(pitch: number, aheadYaw: number, aheadPitch: number): number {
    const c = tuning.camera;
    const now = sphereCast(this.pv, dirAt(this.yaw, pitch, this.dirProbe), c.distance, c.collisionRadius, this.boxes);
    const ahead = sphereCast(this.pv, dirAt(aheadYaw, pitch + aheadPitch, this.dirProbe), c.distance, c.collisionRadius, this.boxes);
    return Math.min(now, ahead);
  }

  private syncProjection(): void {
    const c = tuning.camera;
    const cam = this.camera;
    const fov = c.fovDeg + this.fovBoost;
    if (cam.fov !== fov || cam.near !== c.nearPlane || cam.far !== c.farPlane) {
      cam.fov = fov;
      cam.near = c.nearPlane;
      cam.far = c.farPlane;
      cam.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Pivot to eye this frame, metres: `tuning.camera.distance` unless a wall pulled it in. */
  get currentDistance(): number {
    return this.dist;
  }
}

/** Direction from the pivot to the eye for a yaw and pitch. */
function dirAt(yaw: number, pitch: number, out: Vec3): Vec3 {
  const cp = Math.cos(pitch);
  out.x = Math.sin(yaw) * cp;
  out.y = Math.sin(pitch);
  out.z = Math.cos(yaw) * cp;
  return out;
}
