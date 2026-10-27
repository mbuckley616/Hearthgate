import * as THREE from 'three';
import { placeSegment } from './props';

/**
 * Shared procedural-rig toolkit for heroes and enemies: an upper-body pose
 * vocabulary, pose interpolation, two-bone IK and a stepping gait.
 */

export const DEG = Math.PI / 180;

/**
 * Upper-body pose, in chest space (chest faces +Z; the character's right side is -X).
 * Every state (idle, run, attacks, roll, air) is one of these, so they all blend
 * by plain interpolation. Angles in degrees; yaw 0 = forward, positive = toward the left.
 */
export interface UpperPose {
  /** Right hand: around the chest at this yaw, height and horizontal reach (m). */
  handYaw: number;
  handHeight: number;
  handReach: number;
  /** Weapon direction: blade / staff head, or the bow's upper limb. */
  bladeYaw: number;
  bladePitch: number;
  /** Left hand (shield, bow hand or free hand). */
  offYaw: number;
  offHeight: number;
  offReach: number;
  /** Upper-body yaw (split between hips and chest), forward lean, and hip drop (m). */
  twist: number;
  lean: number;
  crouch: number;
  /** Bow string draw, 0..1. */
  draw: number;
  /** Whole-body turns (deg) and rise (m) for spins, flips and leaps. */
  spin: number;
  flip: number;
  lift: number;
}

export const POSE_KEYS: (keyof UpperPose)[] = [
  'handYaw',
  'handHeight',
  'handReach',
  'bladeYaw',
  'bladePitch',
  'offYaw',
  'offHeight',
  'offReach',
  'twist',
  'lean',
  'crouch',
  'draw',
  'spin',
  'flip',
  'lift',
];

export const pose = (base: UpperPose, o: Partial<UpperPose>): UpperPose => ({ ...base, ...o });

export function lerpPose(a: UpperPose, b: UpperPose, t: number, out: UpperPose): UpperPose {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Wrap degrees to (-180, 180], so a finished 360 spin reads as 0 again. */
export const wrapDeg = (d: number) => d - 360 * Math.round(d / 360);

export const easeInOut = (u: number) => u * u * (3 - 2 * u);
export const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
export const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

/**
 * Pose through keys at the given times with cubic Hermite segments. Inner keys
 * get Catmull-Rom style tangents scaled by `flow` (0 = stop at every key,
 * 1 = sweep straight through); the first and last keys start and end at rest.
 */
export function hermitePose(keys: UpperPose[], times: number[], t: number, flow: number, out: UpperPose): UpperPose {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t >= times[i + 1]) i++;
  const h = Math.max(1e-4, times[i + 1] - times[i]);
  const s = clamp01((t - times[i]) / h);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const tangent = (k: number, field: keyof UpperPose) =>
    k <= 0 || k >= n - 1 ? 0 : (flow * (keys[k + 1][field] - keys[k - 1][field])) / Math.max(1e-4, times[k + 1] - times[k - 1]);
  for (const f of POSE_KEYS) {
    out[f] = h00 * keys[i][f] + h10 * h * tangent(i, f) + h01 * keys[i + 1][f] + h11 * h * tangent(i + 1, f);
  }
  return out;
}

/** Point around the chest at a yaw/height/reach. */
export function around(yawDeg: number, height: number, reach: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(Math.sin(yawDeg * DEG) * reach, height, Math.cos(yawDeg * DEG) * reach);
}

/** Unit direction from yaw/pitch in degrees. */
export function direction(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const p = pitchDeg * DEG;
  return new THREE.Vector3(Math.sin(yawDeg * DEG) * Math.cos(p), Math.sin(p), Math.cos(yawDeg * DEG) * Math.cos(p));
}

/**
 * Two-bone IK: from root toward target with segment lengths a, b, bending
 * toward pole. Writes the joint and (reach-clamped) end positions.
 */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  a: number,
  b: number,
  pole: THREE.Vector3,
  joint: THREE.Vector3,
  end: THREE.Vector3,
): void {
  const dir = target.clone().sub(root);
  const d = THREE.MathUtils.clamp(dir.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  dir.normalize();
  end.copy(root).addScaledVector(dir, d);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dir, -dir.z);
  perp.normalize();
  joint.copy(root).addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
}

export type Arm = { upper: THREE.Mesh; fore: THREE.Mesh; elbow: THREE.Mesh; hand: THREE.Mesh };
export type Leg = { thigh: THREE.Mesh; shin: THREE.Mesh; knee: THREE.Mesh; foot: THREE.Mesh };

/** Body proportions the IK needs. */
export interface Dims {
  hipHeight: number;
  chestOffset: number;
  headHeight: number;
  shoulder: { x: number; y: number };
  upperArm: number;
  forearm: number;
  hipJoint: { x: number; y: number };
  thigh: number;
  shin: number;
  ankleHeight: number;
  footSpacing: number;
}

/** Solve and place both arms for a pose; returns the right and left hand positions (chest space). */
export function poseArms(
  p: UpperPose,
  dims: Dims,
  arms: Record<'R' | 'L', Arm>,
): { hand: THREE.Vector3; offHand: THREE.Vector3 } {
  const shoulder = new THREE.Vector3();
  const target = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const offHand = new THREE.Vector3();

  shoulder.set(-dims.shoulder.x, dims.shoulder.y, 0);
  around(p.handYaw, p.handHeight, p.handReach, target);
  solveTwoBone(shoulder, target, dims.upperArm, dims.forearm, new THREE.Vector3(-0.8, -0.5, -0.4), elbow, hand);
  placeArm(arms.R, shoulder, elbow, hand);

  shoulder.set(dims.shoulder.x, dims.shoulder.y, 0);
  around(p.offYaw, p.offHeight, p.offReach, target);
  solveTwoBone(shoulder, target, dims.upperArm, dims.forearm, new THREE.Vector3(0.8, -0.5, -0.4), elbow, offHand);
  placeArm(arms.L, shoulder, elbow, offHand);
  return { hand, offHand };
}

function placeArm(arm: Arm, shoulder: THREE.Vector3, elbow: THREE.Vector3, hand: THREE.Vector3): void {
  placeSegment(arm.upper, shoulder, elbow);
  placeSegment(arm.fore, elbow, hand);
  arm.elbow.position.copy(elbow);
  arm.hand.position.copy(hand);
  arm.hand.quaternion.copy(arm.fore.quaternion);
}

export interface GaitParams {
  phase: number;
  /** Foot travel amplitude (m) along the direction of travel. */
  stepAmp: number;
  stepHeight: number;
  /** Direction of travel in body space (x side, z forward), unit. */
  dir: { x: number; z: number };
  /** 1 when standing still (planted stance), 0 at full speed. */
  still: number;
  /** 0..1 widening of the stance in a crouch. */
  widen: number;
  /** 0..1 feet pulled up toward the hips (rolls, jumps). */
  tuck: number;
}

/**
 * Place both legs with IK: feet step along the direction of travel (lifted on
 * the forward swing, planted and sliding back in stance), knees bend forward.
 * Legs live in the space the pelvis is parented to.
 */
export function poseLegs(pelvis: THREE.Object3D, legs: Record<'R' | 'L', Leg>, dims: Dims, g: GaitParams): void {
  pelvis.updateMatrix();
  for (const side of ['R', 'L'] as const) {
    const sx = side === 'R' ? -1 : 1;
    const phase = g.phase + (side === 'R' ? 0 : Math.PI);
    const hip = new THREE.Vector3(sx * dims.hipJoint.x, dims.hipJoint.y, 0).applyMatrix4(pelvis.matrix);

    const stepOffset = Math.sin(phase) * g.stepAmp;
    const lift = Math.max(0, Math.cos(phase)) * g.stepHeight * Math.min(1, g.stepAmp / 0.2);
    // Standing stance: left foot forward, right foot back, wider in a crouch.
    const stanceZ = (side === 'L' ? 0.13 : -0.11) * g.still;
    const footX = sx * (dims.footSpacing + 0.05 * g.widen * g.still);

    const ankle = new THREE.Vector3(footX + g.dir.x * stepOffset, dims.ankleHeight + lift, stanceZ + g.dir.z * stepOffset);
    ankle.y += g.tuck * 0.38;
    ankle.z += g.tuck * (side === 'L' ? 0.12 : -0.05);

    const knee = new THREE.Vector3();
    const end = new THREE.Vector3();
    solveTwoBone(hip, ankle, dims.thigh, dims.shin, new THREE.Vector3(sx * 0.15, 0, 1), knee, end);
    const l = legs[side];
    placeSegment(l.thigh, hip, knee);
    placeSegment(l.shin, knee, end);
    l.knee.position.copy(knee);
    l.foot.position.copy(end);
  }
}
