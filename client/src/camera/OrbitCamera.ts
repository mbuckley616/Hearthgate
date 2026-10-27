import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import { segmentTouches, sphereCast, type Collider, type Vec3 } from '@hearthgate/shared/level/geometry';

const DEG = Math.PI / 180;

const blocksCamera = (c: Collider) => c.blocksCamera;

/**
 * Centered third-person orbit camera (brief: "Camera and controls").
 *
 * - Orbits a pivot above the hero; pitch is clamped for player input.
 * - Sphere-casts pivot -> camera against walls and floor and eases in toward
 *   obstructions (a wider look-ahead probe starts the ease before contact; a
 *   hard clamp guarantees it never ends up inside geometry).
 * - Won't come closer than minDistance: if walls would force that, it cranes
 *   upward over the hero instead (there is no ceiling to hit).
 * - Pillars don't push it; they report as occluders so the room can fade them.
 *
 * Yaw convention: camera sits at pivot + (sin yaw, ., cos yaw) * horizontal distance,
 * looking back along -(sin yaw, cos yaw).
 */
export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw: number;
  pitch = tuning.camera.startPitchDeg * DEG;
  /** Extra pitch added automatically when walls crowd the camera. */
  private crane = 0;
  private dist = tuning.camera.distance;
  private readonly pivot = new THREE.Vector3();
  private initialised = false;
  /** Current extra FOV from sprinting. */
  private fovBoost = 0;
  /** Extra FOV from hit punches; decays quickly. */
  private fovPunch = 0;
  private shakeAmp = 0;
  private shakeTime = 0;
  private shakeDur = 0;
  private shakeSeed = 0;
  /** Lock-on target's chest position, or null. */
  private lockPoint: THREE.Vector3 | null = null;
  private readonly lookPoint = new THREE.Vector3();
  private lastYaw = 0;
  private lastPitch = 0;
  private yawVel = 0;
  private pitchVel = 0;
  /** Ids of fadeable colliders currently between camera and hero. */
  readonly occluders = new Set<string>();

  constructor(
    aspect: number,
    private colliders: readonly Collider[],
    heroYaw: number,
  ) {
    const c = tuning.camera;
    this.camera = new THREE.PerspectiveCamera(c.fovDeg, aspect, c.nearPlane, c.farPlane);
    // Start behind the hero.
    this.yaw = heroYaw + Math.PI;
  }

  /** Ground-plane forward/right for camera-relative movement. */
  basis(): { fx: number; fz: number; rx: number; rz: number } {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  }

  /** Offset direction from pivot to camera. */
  private dirAt(yaw: number, pitch: number): Vec3 {
    const cp = Math.cos(pitch);
    return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
  }

  private hardCast(pivot: Vec3, yaw: number, pitch: number): number {
    const c = tuning.camera;
    return sphereCast(pivot, this.dirAt(yaw, pitch), c.distance, c.collisionRadius, this.colliders, blocksCamera);
  }

  /** Apply look input (radians: x yaw right, y pitch up). Call before building movement commands. */
  applyLook(look: { x: number; y: number }): void {
    const c = tuning.camera;
    // Locked on, the camera steers its own yaw; horizontal input flicks between targets instead.
    if (!this.lockPoint) this.yaw -= look.x;
    this.pitch -= (c.invertY ? -1 : 1) * look.y;
    this.pitch = Math.min(c.pitchMaxDeg * DEG, Math.max(c.pitchMinDeg * DEG, this.pitch));
  }

  /**
   * Place the camera for this frame.
   * @param dt real (unscaled) seconds, so slow motion doesn't make the camera sluggish
   * @param hero interpolated hero feet position
   * @param sprint 0..1, how far the hero is into a sprint (widens the FOV)
   */
  update(dt: number, hero: Vec3, sprint = 0): void {
    const c = tuning.camera;
    this.fovBoost += (sprint * c.sprintFovBoostDeg - this.fovBoost) * (1 - Math.exp(-c.fovBlendRate * dt));
    this.fovPunch *= Math.exp(-14 * dt);
    this.syncProjection();
    // Lock-on: swing to look from behind the hero toward the target.
    if (this.lockPoint) {
      const dx = this.lockPoint.x - hero.x;
      const dz = this.lockPoint.z - hero.z;
      if (Math.hypot(dx, dz) > 0.5) {
        const desired = Math.atan2(-dx, -dz);
        const diff = Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
        this.yaw += diff * (1 - Math.exp(-tuning.lockOn.cameraYawRate * dt));
      }
    }
    // Re-clamp in case the limits were changed from the debug panel.
    this.pitch = Math.min(c.pitchMaxDeg * DEG, Math.max(c.pitchMinDeg * DEG, this.pitch));

    const pivotTarget = new THREE.Vector3(hero.x, hero.y + c.pivotHeight, hero.z);
    if (!this.initialised) {
      this.pivot.copy(pivotTarget);
      this.lastYaw = this.yaw;
      this.lastPitch = this.pitch;
      this.initialised = true;
    } else {
      const kxz = 1 - Math.exp(-c.followRate * dt);
      const ky = 1 - Math.exp(-c.verticalFollowRate * dt);
      this.pivot.x += (pivotTarget.x - this.pivot.x) * kxz;
      this.pivot.y += (pivotTarget.y - this.pivot.y) * ky;
      this.pivot.z += (pivotTarget.z - this.pivot.z) * kxz;
    }
    const pivot: Vec3 = { x: this.pivot.x, y: this.pivot.y, z: this.pivot.z };

    // Orbit velocity, so collision can react to where the camera is about to swing.
    if (dt > 0) {
      const k = 1 - Math.exp(-c.orbitVelocitySmoothing * dt);
      const dyaw = Math.atan2(Math.sin(this.yaw - this.lastYaw), Math.cos(this.yaw - this.lastYaw));
      this.yawVel += (dyaw / dt - this.yawVel) * k;
      this.pitchVel += ((this.pitch - this.lastPitch) / dt - this.pitchVel) * k;
    }
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    const aheadYaw = this.yaw + this.yawVel * c.anticipationSec;
    const aheadPitch = this.pitchVel * c.anticipationSec;
    // Clearance at a pitch, now and where the orbit is heading.
    const clearance = (pitch: number) =>
      Math.min(this.hardCast(pivot, this.yaw, pitch), this.hardCast(pivot, aheadYaw, pitch + aheadPitch));

    // Crane up if walls would push us inside minDistance at the player's pitch.
    let craneTarget = 0;
    if (clearance(this.pitch) < c.minDistance) {
      const maxPitch = Math.max(this.pitch, c.craneMaxDeg * DEG);
      craneTarget = maxPitch - this.pitch;
      for (let p = this.pitch + 2 * DEG; p <= maxPitch; p += 2 * DEG) {
        if (clearance(p) >= c.minDistance) {
          craneTarget = p - this.pitch;
          break;
        }
      }
    }
    this.crane += (craneTarget - this.crane) * (1 - Math.exp(-c.craneRate * dt));
    const pitch = this.pitch + this.crane;
    const dir = this.dirAt(this.yaw, pitch);

    const hard = this.hardCast(pivot, this.yaw, pitch);
    const ahead = this.hardCast(pivot, aheadYaw, pitch + aheadPitch);
    // Wider probe: starts easing in before the camera sphere touches anything.
    const soft =
      sphereCast(pivot, dir, c.distance, c.collisionRadius + c.softMargin, this.colliders, blocksCamera, true) +
      c.softMargin;
    const target = Math.min(c.distance, hard, ahead, soft);

    const rate = target < this.dist ? c.pullInRate : c.pushOutRate;
    this.dist += (target - this.dist) * (1 - Math.exp(-rate * dt));
    // Hard guarantee: never inside geometry, even if smoothing lags.
    this.dist = Math.max(0.05, Math.min(this.dist, hard));

    const cam = this.camera.position;
    cam.set(pivot.x + dir.x * this.dist, pivot.y + dir.y * this.dist, pivot.z + dir.z * this.dist);
    // Frame hero and target together while locked on.
    this.lookPoint.copy(this.pivot);
    if (this.lockPoint) this.lookPoint.lerp(this.lockPoint, tuning.lockOn.framing);
    this.camera.lookAt(this.lookPoint);

    // Hit shake: a short decaying wobble applied after collision (brief caps it at 0.15 m).
    if (this.shakeTime < this.shakeDur) {
      this.shakeTime += dt;
      const k = this.shakeAmp * Math.max(0, 1 - this.shakeTime / this.shakeDur);
      const s = this.shakeSeed + this.shakeTime * 60;
      this.camera.position.x += Math.sin(s * 1.7) * k;
      this.camera.position.y += Math.sin(s * 2.3 + 1.1) * k;
      this.camera.position.z += Math.sin(s * 1.3 + 2.4) * k;
    }

    this.updateOccluders({ x: cam.x, y: cam.y, z: cam.z }, pivot, hero);
  }

  private updateOccluders(cam: Vec3, pivot: Vec3, hero: Vec3): void {
    const r = tuning.camera.occluderProbeRadius;
    const chest = { x: hero.x, y: hero.y + 0.9, z: hero.z };
    const feet = { x: hero.x, y: hero.y + 0.2, z: hero.z };
    this.occluders.clear();
    for (const col of this.colliders) {
      if (!col.fadeable) continue;
      if (segmentTouches(cam, pivot, r, col) || segmentTouches(cam, chest, r, col) || segmentTouches(cam, feet, r, col)) {
        this.occluders.add(col.id);
      }
    }
  }

  private syncProjection(): void {
    const c = tuning.camera;
    const cam = this.camera;
    const fov = c.fovDeg + this.fovBoost + this.fovPunch;
    if (cam.fov !== fov || cam.near !== c.nearPlane || cam.far !== c.farPlane) {
      cam.fov = fov;
      cam.near = c.nearPlane;
      cam.far = c.farPlane;
      cam.updateProjectionMatrix();
    }
  }

  /** Swap the collision set (the antechamber gate only counts while it's down). */
  setColliders(colliders: readonly Collider[]): void {
    this.colliders = colliders;
  }

  /** Lock the camera onto a point (the target's chest), or release it with null. */
  setLock(point: THREE.Vector3 | null): void {
    this.lockPoint = point ? (this.lockPoint ?? new THREE.Vector3()).copy(point) : null;
  }

  get locked(): boolean {
    return this.lockPoint !== null;
  }

  /** Shake the camera (metres, seconds); a stronger shake overrides a weaker one. */
  shake(amount: number, duration: number): void {
    amount *= tuning.hitFeel.screenShake;
    const remaining = this.shakeAmp * Math.max(0, 1 - this.shakeTime / Math.max(1e-3, this.shakeDur));
    if (amount < remaining) return;
    this.shakeAmp = amount;
    this.shakeDur = duration;
    this.shakeTime = 0;
    this.shakeSeed = Math.random() * 100;
  }

  /** Kick the field of view out by deg; it settles back on its own. */
  punchFov(deg: number): void {
    this.fovPunch = Math.max(this.fovPunch, deg * tuning.hitFeel.screenShake);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** For the debug readout. */
  get currentDistance(): number {
    return this.dist;
  }
}
