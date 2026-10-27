import { CAMERA } from "./sim";
import type { WallRect } from "./level";

/**
 * The camera's pure parts: where the eye sits for a yaw and pitch, the move keys turned into the
 * world, and which walls hide the player. Pure so they are unit tested. The camera itself is the
 * combat slice's orbit camera (client/src/orbit.ts, with geometry.ts's sphere cast); these are what
 * it shares with input and the wall fade.
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
