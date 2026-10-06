import { CAMERA } from "./sim";
import type { WallRect } from "./level";

/**
 * The camera's pure parts: where the eye sits for a yaw, which way the fight pulls it, how fast
 * it turns, the move keys turned into the world, and which walls hide the player. Pure so the
 * feel is unit tested; the client's render.ts and input.ts call these and nothing here is sim.
 *
 * Yaw 0 is the old fixed camera: the eye south of the player (+z), looking north (-z), so W
 * walked -z. Positive yaw swings the eye counter-clockwise seen from above (toward +x).
 */

export interface Point {
  x: number;
  z: number;
}

/** Eye offset from the look target for a yaw, in metres (x, y, z). */
export function cameraOffset(yaw: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
  const pitch = (CAMERA.pitchDeg * Math.PI) / 180;
  const flat = CAMERA.distanceM * Math.cos(pitch);
  out.x = flat * Math.sin(yaw);
  out.y = CAMERA.distanceM * Math.sin(pitch);
  out.z = flat * Math.cos(yaw);
  return out;
}

/**
 * Turn a screen-space move (dx right, dy down the screen, as the keys and the stick give it) into
 * a world vector for a camera at `yaw`. At yaw 0 it is the identity, so a fixed camera moves as before.
 */
export function cameraRelativeMove(dx: number, dy: number, yaw: number): { dx: number; dy: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { dx: dx * c + dy * s, dy: -dx * s + dy * c };
}

/**
 * The yaw that puts the fight in front of the player: the centre of the awake enemies and the
 * living teammates within `CAMERA.fightRadiusM`, the player included. Null out of combat (no awake
 * enemy near) or when the centre is too close to give a direction: the camera holds still.
 */
export function fightYaw(me: Point, awakeEnemies: readonly Point[], teammates: readonly Point[]): number | null {
  const r2 = CAMERA.fightRadiusM * CAMERA.fightRadiusM;
  let sx = me.x;
  let sz = me.z;
  let n = 1;
  let enemies = 0;
  for (const e of awakeEnemies) {
    if (dist2(me, e) > r2) continue;
    sx += e.x;
    sz += e.z;
    n++;
    enemies++;
  }
  if (enemies === 0) return null;
  for (const t of teammates) {
    if (dist2(me, t) > r2) continue;
    sx += t.x;
    sz += t.z;
    n++;
  }
  const vx = sx / n - me.x;
  const vz = sz / n - me.z;
  if (Math.hypot(vx, vz) < CAMERA.minLeadM) return null;
  // The eye goes opposite the fight, so the camera looks along (vx, vz).
  return Math.atan2(-vx, -vz);
}

/**
 * One frame of turning from `yaw` toward `target` (null holds). The error inside the deadband is
 * ignored, the rest eases over `CAMERA.turnMs` and is capped at `CAMERA.maxTurnDegPerS`, so the
 * camera never snaps and comes to rest within the deadband of the fight.
 */
export function slewYaw(yaw: number, target: number | null, dtMs: number): number {
  if (target === null || dtMs <= 0) return yaw;
  const err = wrapAngle(target - yaw);
  const dead = (CAMERA.deadbandDeg * Math.PI) / 180;
  const beyond = Math.abs(err) - dead;
  if (beyond <= 0) return yaw;
  const eased = beyond * (1 - Math.exp(-dtMs / CAMERA.turnMs));
  const cap = ((CAMERA.maxTurnDegPerS * Math.PI) / 180) * (dtMs / 1000);
  return wrapAngle(yaw + Math.sign(err) * Math.min(eased, cap));
}

/**
 * Does a wall of height `h` stand between the eye and the aim point? The sight line is clipped to
 * the wall's footprint (slab test on the ground plane). It falls from the eye toward the aim, so
 * it is lowest where it leaves the footprint: below the wall's top there, the wall is in the way.
 */
export function wallHides(
  eye: { x: number; y: number; z: number },
  aim: { x: number; y: number; z: number },
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

function dist2(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}
