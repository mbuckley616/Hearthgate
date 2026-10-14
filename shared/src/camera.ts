import { CAMERA } from "./sim";
import type { WallRect } from "./level";

/**
 * The camera's pure parts: where the eye sits for a yaw and pitch, the player's own turning, the
 * swing in behind the travel, the bow's lock framing, how fast it turns, the move keys turned
 * into the world, how far a wall lets the eye sit, and which walls hide the player. Pure so the
 * feel is unit tested; the client's render.ts and input.ts call these and nothing here is sim.
 *
 * Yaw 0 is the eye south of the player (+z), looking north (-z), so W walks -z. Positive yaw
 * swings the eye counter-clockwise seen from above (toward +x), which turns the view left.
 */

export interface Point {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A wall as the camera sees it: its footprint and its top, standing from the ground or from `y0`
 * (a roof). */
export interface CameraWall {
  rect: WallRect;
  h: number;
  y0?: number;
}

const RAD = Math.PI / 180;

/** Eye offset from the look target for a yaw, pitch (degrees) and distance, in metres (x, y, z). */
export function cameraOffset(
  yaw: number,
  pitchDeg: number = CAMERA.pitchDeg,
  distanceM: number = CAMERA.distanceM,
  out: Vec3 = { x: 0, y: 0, z: 0 }
): Vec3 {
  const pitch = pitchDeg * RAD;
  const flat = distanceM * Math.cos(pitch);
  out.x = flat * Math.sin(yaw);
  out.y = distanceM * Math.sin(pitch);
  out.z = flat * Math.cos(yaw);
  return out;
}

/** The camera's right on the ground for a yaw, scaled by `m`: where the shoulder offset goes. */
export function cameraRight(yaw: number, m = 1): Point {
  return { x: Math.cos(yaw) * m, z: -Math.sin(yaw) * m };
}

/**
 * Turn a screen-space move (dx right, dy down the screen, as the keys and the stick give it) into
 * a world vector for a camera at `yaw`. At yaw 0 it is the identity.
 */
export function cameraRelativeMove(dx: number, dy: number, yaw: number): { dx: number; dy: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { dx: dx * c + dy * s, dy: -dx * s + dy * c };
}

/**
 * The player's own turning for one frame. `lookX` is -1 (Left arrow, stick left) to 1, `lookY`
 * -1 (Up arrow, stick up) to 1. Left turns the view left; Up raises the eye to look down more, as
 * RuneScape's arrows do. Pitch stays within CAMERA's clamp.
 */
export function turnCamera(yaw: number, pitchDeg: number, lookX: number, lookY: number, dtMs: number): { yaw: number; pitchDeg: number } {
  const s = dtMs / 1000;
  const nextYaw = wrapAngle(yaw - lookX * CAMERA.yawRateDegPerS * RAD * s);
  const nextPitch = Math.min(CAMERA.maxPitchDeg, Math.max(CAMERA.minPitchDeg, pitchDeg - lookY * CAMERA.pitchRateDegPerS * s));
  return { yaw: nextYaw, pitchDeg: nextPitch };
}

/** The yaw that looks along (dx, dz) on the ground: the eye goes behind, opposite the direction. */
export function yawLookingAlong(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

/**
 * Where the camera swings to behind the player's travel: null (hold) when the player is slower
 * than `CAMERA.swingMinSpeed`, or travelling outside `CAMERA.swingWindowDeg` of the view. The
 * window is what keeps a sideways or backward walk from wheeling round: the move keys are
 * camera-relative, so swinging behind a strafe would turn the strafe with it.
 */
export function swingTarget(yaw: number, vx: number, vz: number): number | null {
  if (Math.hypot(vx, vz) < CAMERA.swingMinSpeed) return null;
  const target = yawLookingAlong(vx, vz);
  if (Math.abs(wrapAngle(target - yaw)) > CAMERA.swingWindowDeg * RAD) return null;
  return target;
}

/** The yaw that looks from `me` at `target` (the bow's lock); null when it is on top of the player. */
export function lockYaw(me: Point, target: Point): number | null {
  const dx = target.x - me.x;
  const dz = target.z - me.z;
  if (Math.hypot(dx, dz) < 0.5) return null;
  return yawLookingAlong(dx, dz);
}

export interface TurnTuning {
  deadbandDeg: number;
  turnMs: number;
  maxTurnDegPerS: number;
}

/** The swing in behind the travel. */
export const SWING_TUNING: TurnTuning = { deadbandDeg: CAMERA.deadbandDeg, turnMs: CAMERA.turnMs, maxTurnDegPerS: CAMERA.maxTurnDegPerS };
/** Keeping the bow's lock framed. */
export const LOCK_TUNING: TurnTuning = { deadbandDeg: CAMERA.lockFrameDeg, turnMs: CAMERA.lockTurnMs, maxTurnDegPerS: CAMERA.lockMaxTurnDegPerS };

/**
 * One frame of turning from `yaw` toward `target` (null holds). The error inside the deadband is
 * ignored, the rest eases over `turnMs` and is capped at `maxTurnDegPerS`, so the camera never
 * snaps and comes to rest at the deadband's edge.
 */
export function slewYaw(yaw: number, target: number | null, dtMs: number, tune: TurnTuning = SWING_TUNING): number {
  if (target === null || dtMs <= 0) return yaw;
  const err = wrapAngle(target - yaw);
  const beyond = Math.abs(err) - tune.deadbandDeg * RAD;
  if (beyond <= 0) return yaw;
  const eased = beyond * (1 - Math.exp(-dtMs / tune.turnMs));
  const cap = tune.maxTurnDegPerS * RAD * (dtMs / 1000);
  return wrapAngle(yaw + Math.sign(err) * Math.min(eased, cap));
}

/**
 * How far from `head` toward `eye` the camera may sit: the first wall the segment enters (a box
 * from the ground to its height) less `CAMERA.wallPadM`, never under `CAMERA.minDistanceM`, never
 * past the eye. So the eye comes in along its own ray and never sits in or behind a wall.
 */
export function clearDistance(head: Vec3, eye: Vec3, walls: readonly CameraWall[]): number {
  const dx = eye.x - head.x;
  const dy = eye.y - head.y;
  const dz = eye.z - head.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return 0;
  let first = 1;
  for (const w of walls) {
    const t = segmentEntersBox(head, dx, dy, dz, w.rect.x - w.rect.hw, w.rect.x + w.rect.hw, w.y0 ?? 0, w.h, w.rect.z - w.rect.hd, w.rect.z + w.rect.hd);
    if (t !== null && t < first) first = t;
  }
  if (first >= 1) return len;
  return Math.min(len, Math.max(CAMERA.minDistanceM, first * len - CAMERA.wallPadM));
}

/** The camera distance for this frame: in at once to `allowed`, back out eased over `CAMERA.pullOutMs`. */
export function easeDistance(current: number, allowed: number, dtMs: number): number {
  if (allowed <= current) return allowed;
  return current + (allowed - current) * (1 - Math.exp(-Math.max(0, dtMs) / CAMERA.pullOutMs));
}

/** Where along p + t·d (t in 0..1) the segment first enters the box; null if it misses. Called per
 * wall per frame, so the slabs run on two module scalars rather than allocating. */
function segmentEntersBox(p: Vec3, dx: number, dy: number, dz: number, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): number | null {
  slabT0 = 0;
  slabT1 = 1;
  if (!slab(p.x, dx, x0, x1) || !slab(p.y, dy, y0, y1) || !slab(p.z, dz, z0, z1)) return null;
  return slabT0;
}

let slabT0 = 0;
let slabT1 = 1;
function slab(o: number, d: number, lo: number, hi: number): boolean {
  if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
  let a = (lo - o) / d;
  let b = (hi - o) / d;
  if (a > b) [a, b] = [b, a];
  if (a > slabT0) slabT0 = a;
  if (b < slabT1) slabT1 = b;
  return slabT0 <= slabT1;
}

/**
 * Does a wall of height `h` stand between the eye and the aim point? The sight line is clipped to
 * the wall's footprint (slab test on the ground plane). It falls from the eye toward the aim, so
 * it is lowest where it leaves the footprint: below the wall's top there, the wall is in the way.
 */
export function wallHides(
  eye: Vec3,
  aim: Vec3,
  w: WallRect,
  h: number
): boolean {
  let t0 = 0;
  let t1 = 1;
  const slab = (p: number, d: number, lo: number, hi: number): boolean => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / d;
    let b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(eye.x, aim.x - eye.x, w.x - w.hw, w.x + w.hw)) return false;
  if (!slab(eye.z, aim.z - eye.z, w.z - w.hd, w.z + w.hd)) return false;
  // Entering at the aim itself is the player standing against the wall's near face: nothing hidden.
  if (t0 >= 1) return false;
  return eye.y + (aim.y - eye.y) * t1 <= h;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
