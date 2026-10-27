/**
 * Remote pose interpolation for the client: where to draw another player or an enemy at a
 * draw time, from the snapshots the server has sent. Pure, so it is unit tested with made-up
 * snapshot streams and so both the browser and the test harness draw the same thing from the
 * same data. Constants live in sim.ts (INTERP). Nothing here reads a clock.
 *
 * Between two snapshots the pose is interpolated. Past the newest one, which happens when a
 * patch arrives later than the interpolation delay allows, the pose is projected along the
 * motion of the last tick (the last two snapshots) by at most INTERP.extrapolateMaxMs, one
 * tick, and holds there: a late patch usually costs about a tick, and a guess about where a
 * player is going is good for about that long. Facing is held, not projected: the sim turns a
 * player to a new heading within one tick, so projecting a turn would spin them past it. A
 * projection never crosses a wall (the level's own collision keeps it out), and motion faster
 * than INTERP.extrapolateMaxMps between two snapshots is a placement, not travel, and is held.
 *
 * When the snapshot that ends a projection says the entity went somewhere else (it stopped,
 * turned, or a hold ran past the cap), the difference is eased out over INTERP.easeMs rather
 * than popped: the track remembers the pose it last handed out, and a new snapshot folds the
 * disagreement at that draw time into a decaying offset, so the drawn pose is continuous. Over
 * INTERP.easeSnapM the difference is a placement and pops, as a big correction of the own
 * player does.
 */
import { collideWalls, type Level } from "./level";
import { INTERP } from "./sim";

export interface PoseSnapshot {
  /** Server time the snapshot describes. */
  t: number;
  x: number;
  z: number;
  facing: number;
}

export interface Pose {
  x: number;
  z: number;
  facing: number;
}

/** Snapshots kept per entity: more than a second at 20 a second, so a stall never empties it. */
export const SNAPSHOT_KEEP = 24;

/** One remote entity's snapshots and the state the easing needs. */
export interface PoseTrack<S extends PoseSnapshot = PoseSnapshot> {
  snaps: S[];
  /** Collision radius for projecting against walls, m. */
  radius: number;
  /** The last pose handed out, and the draw time it was for; the next snapshot measures its guess against this. */
  drawnT: number;
  drawnX: number;
  drawnZ: number;
  /** The visual offset easing out a disagreement, and the draw time it was last decayed to. */
  errX: number;
  errZ: number;
  errT: number;
}

export function createPoseTrack<S extends PoseSnapshot = PoseSnapshot>(radius: number): PoseTrack<S> {
  return { snaps: [], radius, drawnT: -Infinity, drawnX: 0, drawnZ: 0, errX: 0, errZ: 0, errT: 0 };
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * The pose at server time `t` from a snapshot buffer: interpolated between two snapshots, or
 * past the newest projected by at most INTERP.extrapolateMaxMs along the last tick's motion
 * and kept out of the level's walls. `aheadMs` is how far past the newest snapshot `t` is
 * (0 when interpolated); the pose is projected for the first INTERP.extrapolateMaxMs of it
 * and held beyond. Null with no snapshots.
 */
export function projectPose(snaps: readonly PoseSnapshot[], t: number, level: Level | null, radius: number): { pose: Pose; aheadMs: number } | null {
  if (snaps.length === 0) return null;
  const first = snaps[0];
  if (snaps.length === 1 || t <= first.t) return { pose: { x: first.x, z: first.z, facing: first.facing }, aheadMs: 0 };
  const b = snaps[snaps.length - 1];
  if (t <= b.t) {
    for (let i = 0; i < snaps.length - 1; i++) {
      const p = snaps[i];
      const q = snaps[i + 1];
      if (t >= p.t && t <= q.t) {
        const k = q.t === p.t ? 1 : (t - p.t) / (q.t - p.t);
        return { pose: { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k, facing: lerpAngle(p.facing, q.facing, k) }, aheadMs: 0 };
      }
    }
    // Unreachable with a time-ordered buffer; hold the newest rather than throw in a frame.
    return { pose: { x: b.x, z: b.z, facing: b.facing }, aheadMs: 0 };
  }
  const aheadMs = t - b.t;
  const a = snaps[snaps.length - 2];
  const dt = b.t - a.t;
  const pose: Pose = { x: b.x, z: b.z, facing: b.facing };
  if (dt > 0) {
    const vx = (b.x - a.x) / dt;
    const vz = (b.z - a.z) / dt;
    const speed = Math.hypot(vx, vz) * 1000;
    if (speed > 0 && speed <= INTERP.extrapolateMaxMps) {
      const ahead = Math.min(aheadMs, INTERP.extrapolateMaxMs);
      pose.x += vx * ahead;
      pose.z += vz * ahead;
      if (level) collideWalls(pose, radius, level);
    }
  }
  return { pose, aheadMs };
}

/**
 * Record a snapshot on a track. If the pose last handed out was past the newest snapshot so
 * far (projected or held), the difference between it and what this snapshot says for that same
 * draw time becomes the offset to ease out, so the next pose handed out continues from the
 * last one. The snapshots are kept in time order; one stamped like the newest replaces it.
 */
export function pushPoseSnapshot<S extends PoseSnapshot>(track: PoseTrack<S>, s: S, level: Level | null): void {
  const snaps = track.snaps;
  const last = snaps[snaps.length - 1];
  const wasGuessing = last !== undefined && track.drawnT > last.t;
  if (last && last.t === s.t) snaps[snaps.length - 1] = s;
  else if (last && s.t < last.t) return; // out of order: never happens on one connection, and would make the buffer unusable
  else {
    snaps.push(s);
    if (snaps.length > SNAPSHOT_KEEP) snaps.shift();
  }
  if (!wasGuessing) return;
  const now = projectPose(snaps, track.drawnT, level, track.radius);
  if (!now) return;
  const errX = track.drawnX - now.pose.x;
  const errZ = track.drawnZ - now.pose.z;
  if (Math.hypot(errX, errZ) > INTERP.easeSnapM) {
    track.errX = 0;
    track.errZ = 0;
  } else {
    track.errX = errX;
    track.errZ = errZ;
  }
  track.errT = track.drawnT;
}

/**
 * The pose to draw a tracked entity at server time `t`: projectPose, plus the offset easing
 * out the last disagreement, decayed to `t`. Remembers what it handed out for the next
 * snapshot to check. Null until the first snapshot.
 */
export function samplePoseTrack<S extends PoseSnapshot>(track: PoseTrack<S>, t: number, level: Level | null): Pose | null {
  const r = projectPose(track.snaps, t, level, track.radius);
  if (!r) return null;
  const pose = r.pose;
  if (track.errX !== 0 || track.errZ !== 0) {
    const decay = Math.exp(-Math.max(0, t - track.errT) / INTERP.easeMs);
    track.errX *= decay;
    track.errZ *= decay;
    track.errT = Math.max(track.errT, t);
    if (Math.abs(track.errX) < 1e-4 && Math.abs(track.errZ) < 1e-4) {
      track.errX = 0;
      track.errZ = 0;
    }
    pose.x += track.errX;
    pose.z += track.errZ;
  }
  track.drawnT = t;
  track.drawnX = pose.x;
  track.drawnZ = pose.z;
  return pose;
}
