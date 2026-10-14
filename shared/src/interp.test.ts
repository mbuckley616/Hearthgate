import { describe, expect, it } from "vitest";
import { INTERP, PLAYER, TICK_MS } from "./sim";
import { OPEN_FIELD, type Level } from "./level";
import { SNAPSHOT_KEEP, createPoseTrack, projectPose, pushPoseSnapshot, samplePoseTrack, type PoseSnapshot } from "./interp";

const R = PLAYER.radius;
/** A player walking +x at full speed, one snapshot per tick from t = 1000. */
function walk(n: number, speed: number = PLAYER.speed, from = 1000): PoseSnapshot[] {
  const snaps: PoseSnapshot[] = [];
  for (let i = 0; i < n; i++) snaps.push({ t: from + i * TICK_MS, x: (speed * i * TICK_MS) / 1000, z: 0, facing: Math.PI / 2 });
  return snaps;
}
const perTick = (PLAYER.speed * TICK_MS) / 1000; // 0.3 m

describe("projectPose", () => {
  it("interpolates between snapshots and holds before the first", () => {
    const snaps = walk(4);
    expect(projectPose([], 0, OPEN_FIELD, R)).toBeNull();
    expect(projectPose(snaps, 0, OPEN_FIELD, R)).toEqual({ pose: { x: 0, z: 0, facing: Math.PI / 2 }, aheadMs: 0 });
    const mid = projectPose(snaps, 1000 + TICK_MS * 1.5, OPEN_FIELD, R)!;
    expect(mid.aheadMs).toBe(0);
    expect(mid.pose.x).toBeCloseTo(perTick * 1.5, 9);
    const at = projectPose(snaps, 1000 + TICK_MS * 3, OPEN_FIELD, R)!;
    expect(at.pose.x).toBeCloseTo(perTick * 3, 9);
    expect(at.aheadMs).toBe(0);
  });

  it("projects past the newest snapshot along the last tick's motion, by at most one tick, holding facing", () => {
    const snaps = walk(4);
    const newest = snaps[3];
    const a = projectPose(snaps, newest.t + 30, OPEN_FIELD, R)!;
    expect(a.aheadMs).toBe(30);
    expect(a.pose.x).toBeCloseTo(newest.x + (PLAYER.speed * 30) / 1000, 9);
    expect(a.pose.z).toBe(0);
    expect(a.pose.facing).toBe(newest.facing);
    const cap = projectPose(snaps, newest.t + INTERP.extrapolateMaxMs, OPEN_FIELD, R)!;
    expect(cap.pose.x).toBeCloseTo(newest.x + perTick, 9);
    const far = projectPose(snaps, newest.t + 400, OPEN_FIELD, R)!;
    expect(far.aheadMs).toBe(400);
    expect(far.pose.x).toBeCloseTo(cap.pose.x, 12); // held at the cap, never further
  });

  it("holds a standing entity and a placement instead of projecting them", () => {
    const still: PoseSnapshot[] = [
      { t: 1000, x: 2, z: 3, facing: 0 },
      { t: 1050, x: 2, z: 3, facing: 0 }
    ];
    expect(projectPose(still, 1090, OPEN_FIELD, R)!.pose).toEqual({ x: 2, z: 3, facing: 0 });
    // A respawn: 15 m in one tick, 300 m/s. Projecting it would put the player 15 m further on.
    const respawn: PoseSnapshot[] = [
      { t: 1000, x: 0, z: 0, facing: 0 },
      { t: 1050, x: 15, z: 0, facing: 0 }
    ];
    expect(projectPose(respawn, 1100, OPEN_FIELD, R)!.pose.x).toBe(15);
    // The fastest real move, a 12 m/s dodge, is projected.
    const dodge = walk(3, 12);
    expect(projectPose(dodge, dodge[2].t + 25, OPEN_FIELD, R)!.pose.x).toBeCloseTo(dodge[2].x + 0.3, 9);
  });

  it("never projects through a wall or out of the bounds", () => {
    const wall: Level = { ...OPEN_FIELD, id: "test", walls: [{ x: 2, z: 0, hw: 0.2, hd: 3 }] };
    // Walking +x toward the wall face at x = 1.8, radius 0.5: the furthest a body goes is 1.3.
    const snaps: PoseSnapshot[] = [
      { t: 1000, x: 0.9, z: 0, facing: 0 },
      { t: 1050, x: 1.2, z: 0, facing: 0 }
    ];
    const r = projectPose(snaps, 1100, wall, R)!;
    expect(r.pose.x).toBeCloseTo(1.3, 9);
    expect(r.pose.z).toBe(0);
    const edge: PoseSnapshot[] = [
      { t: 1000, x: OPEN_FIELD.halfW - R - 0.4, z: 0, facing: 0 },
      { t: 1050, x: OPEN_FIELD.halfW - R - 0.1, z: 0, facing: 0 }
    ];
    expect(projectPose(edge, 1100, OPEN_FIELD, R)!.pose.x).toBeCloseTo(OPEN_FIELD.halfW - R, 9);
    // With no level the projection is unclamped (the test harness before the first patch).
    expect(projectPose(snaps, 1100, null, R)!.pose.x).toBeCloseTo(1.5, 9);
  });

  it("is deterministic: the same snapshots and time give the same pose", () => {
    const snaps = walk(5);
    const t = snaps[4].t + 37;
    const a = projectPose(snaps, t, OPEN_FIELD, R);
    const b = projectPose(walk(5), t, OPEN_FIELD, R);
    expect(a).toEqual(b);
    const tr1 = createPoseTrack(R);
    const tr2 = createPoseTrack(R);
    const out1: number[] = [];
    const out2: number[] = [];
    for (const [tr, out] of [[tr1, out1], [tr2, out2]] as const) {
      for (const s of walk(3)) pushPoseSnapshot(tr, s, OPEN_FIELD);
      for (let t = 1100; t < 1200; t += 16) out.push(samplePoseTrack(tr, t, OPEN_FIELD)!.x);
      pushPoseSnapshot(tr, { t: 1150, x: 0.6, z: 0, facing: 0 }, OPEN_FIELD); // stopped
      for (let t = 1200; t < 1400; t += 16) out.push(samplePoseTrack(tr, t, OPEN_FIELD)!.x);
    }
    expect(out1).toEqual(out2);
  });
});

describe("pose track", () => {
  it("keeps SNAPSHOT_KEEP snapshots in order, replacing one stamped like the newest", () => {
    const tr = createPoseTrack(R);
    for (const s of walk(SNAPSHOT_KEEP + 5)) pushPoseSnapshot(tr, s, OPEN_FIELD);
    expect(tr.snaps.length).toBe(SNAPSHOT_KEEP);
    expect(tr.snaps[0].t).toBe(1000 + 5 * TICK_MS);
    const last = tr.snaps[tr.snaps.length - 1];
    pushPoseSnapshot(tr, { ...last, x: 99 }, OPEN_FIELD);
    expect(tr.snaps.length).toBe(SNAPSHOT_KEEP);
    expect(tr.snaps[tr.snaps.length - 1].x).toBe(99);
  });

  it("hands out the interpolated pose with no offset while the snapshots are on time", () => {
    const tr = createPoseTrack(R);
    for (const s of walk(6)) pushPoseSnapshot(tr, s, OPEN_FIELD);
    const p = samplePoseTrack(tr, 1000 + TICK_MS * 2.5, OPEN_FIELD)!;
    expect(p.x).toBeCloseTo(perTick * 2.5, 9);
    expect(tr.errX).toBe(0);
    pushPoseSnapshot(tr, { t: 1000 + 6 * TICK_MS, x: perTick * 6, z: 0, facing: Math.PI / 2 }, OPEN_FIELD);
    expect(tr.errX).toBe(0); // we were not guessing, so nothing to ease
  });

  it("eases a projection the next snapshot disagrees with, so the drawn pose is continuous and converges", () => {
    const tr = createPoseTrack(R);
    const snaps = walk(4);
    for (const s of snaps) pushPoseSnapshot(tr, s, OPEN_FIELD);
    const newest = snaps[3];
    // Frames run 40 ms past the newest snapshot: the player is projected 0.24 m on.
    let t = newest.t + 8;
    let last = samplePoseTrack(tr, t, OPEN_FIELD)!;
    for (t = newest.t + 24; t <= newest.t + 40; t += 16) last = samplePoseTrack(tr, t, OPEN_FIELD)!;
    expect(last.x).toBeCloseTo(newest.x + (PLAYER.speed * 40) / 1000, 9);
    // The late snapshot: the player had stopped dead at the newest.
    pushPoseSnapshot(tr, { t: newest.t + TICK_MS, x: newest.x, z: 0, facing: newest.facing }, OPEN_FIELD);
    expect(tr.errX).toBeCloseTo(last.x - newest.x, 9);
    // Without the ease the next frame would jump back 0.24 m; with it, it moves a few centimetres.
    const next = samplePoseTrack(tr, t, OPEN_FIELD)!;
    const step = Math.abs(next.x - last.x);
    expect(step).toBeLessThan(0.05);
    expect(step).toBeGreaterThan(0);
    // Every frame keeps moving toward the truth (time constant 100 ms), and after a second it is there.
    let prev = next.x;
    for (t += 16; t < newest.t + 1000; t += 16) {
      pushPoseSnapshot(tr, { t: t - 100, x: newest.x, z: 0, facing: newest.facing }, OPEN_FIELD);
      const p = samplePoseTrack(tr, t, OPEN_FIELD)!;
      expect(p.x).toBeLessThanOrEqual(prev + 1e-9);
      prev = p.x;
    }
    expect(prev).toBeCloseTo(newest.x, 3);
    expect(tr.errX).toBe(0);
  });

  it("eases the end of a hold too: a snapshot arriving after a long stall catches up smoothly", () => {
    const tr = createPoseTrack(R);
    const snaps = walk(4);
    for (const s of snaps) pushPoseSnapshot(tr, s, OPEN_FIELD);
    const newest = snaps[3];
    // A 200 ms stall: projected one tick, then held.
    let t = newest.t;
    let last = { x: 0, z: 0, facing: 0 };
    for (t = newest.t + 16; t <= newest.t + 200; t += 16) last = samplePoseTrack(tr, t, OPEN_FIELD)!;
    expect(last.x).toBeCloseTo(newest.x + perTick, 9);
    // The four missing ticks arrive at once: the player kept walking, and is 1.2 m on.
    for (let i = 1; i <= 4; i++) pushPoseSnapshot(tr, { t: newest.t + i * TICK_MS, x: newest.x + i * perTick, z: 0, facing: newest.facing }, OPEN_FIELD);
    const next = samplePoseTrack(tr, t, OPEN_FIELD)!;
    // A hold ending used to pop the whole gap at once; now the first frame covers walking speed plus a little.
    expect(next.x - last.x).toBeLessThan(perTick);
    expect(next.x - last.x).toBeGreaterThan(0);
  });

  it("pops rather than eases a disagreement over easeSnapM, a placement", () => {
    const tr = createPoseTrack(R);
    const snaps = walk(4);
    for (const s of snaps) pushPoseSnapshot(tr, s, OPEN_FIELD);
    const newest = snaps[3];
    samplePoseTrack(tr, newest.t + 30, OPEN_FIELD);
    pushPoseSnapshot(tr, { t: newest.t + TICK_MS, x: newest.x + 10, z: 0, facing: 0 }, OPEN_FIELD); // a respawn
    expect(tr.errX).toBe(0);
    expect(tr.errZ).toBe(0);
    // And the hand-out is the interpolation toward the new place, offset-free.
    const p = samplePoseTrack(tr, newest.t + 30, OPEN_FIELD)!;
    expect(p.x).toBeCloseTo(newest.x + (10 * 30) / TICK_MS, 9);
  });

  it("ends every ease the own way the sim does: the projection never leaves a wall behind", () => {
    const wall: Level = { ...OPEN_FIELD, id: "test", walls: [{ x: 2, z: 0, hw: 0.2, hd: 3 }] };
    const tr = createPoseTrack(R);
    pushPoseSnapshot(tr, { t: 1000, x: 0.9, z: 0, facing: 0 }, wall);
    pushPoseSnapshot(tr, { t: 1050, x: 1.2, z: 0, facing: 0 }, wall);
    const held = samplePoseTrack(tr, 1100, wall)!;
    expect(held.x).toBeCloseTo(1.3, 9); // stopped at the wall face
    pushPoseSnapshot(tr, { t: 1100, x: 1.3, z: 0, facing: 0 }, wall); // the server stopped it there too
    expect(Math.abs(tr.errX)).toBeLessThan(1e-9);
  });
});
