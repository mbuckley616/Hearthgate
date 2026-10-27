import * as THREE from 'three';
import { enemyStats, tuning } from '@hearthgate/shared/config/tuning';
import { isTargetable } from '@hearthgate/shared/sim/combat';
import type { EnemyState, PlayerState, SimState } from '@hearthgate/shared/sim/types';

const DEG = Math.PI / 180;

/**
 * Lock-on (brief: "the camera frames hero and target, movement becomes
 * strafing, and a flick of mouse or stick switches targets"). Client-side:
 * it steers the camera and tells the sim which enemy is locked so soft
 * targeting prefers it.
 */
export class LockOn {
  targetId = -1;
  readonly marker = new THREE.Group();
  /** Recent horizontal look input, leaking away over flickWindowMs, so a flick is "a lot of yaw, quickly". */
  private flickAccum = 0;
  private spin = 0;

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), mat);
    diamond.scale.y = 1.6;
    diamond.position.y = 2.05;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.7, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }),
    );
    ring.position.y = 0.04;
    this.marker.add(diamond, ring);
    this.marker.renderOrder = 20;
    this.marker.visible = false;
  }

  get locked(): boolean {
    return this.targetId >= 0;
  }

  toggle(sim: SimState, hero: PlayerState, camForward: { x: number; z: number }): void {
    this.targetId = this.locked ? -1 : (this.acquire(sim, hero, camForward)?.id ?? -1);
  }

  /**
   * Per frame: drop the lock if the target died or got too far, and switch on
   * a quick horizontal flick of the mouse or right stick.
   */
  update(sim: SimState, hero: PlayerState, lookX: number, realDt: number): void {
    const target = this.target(sim);
    if (this.locked && (!target || Math.hypot(target.x - hero.x, target.z - hero.z) > tuning.lockOn.breakDistance)) {
      this.targetId = -1;
    }
    if (!this.locked) {
      this.flickAccum = 0;
      return;
    }
    this.flickAccum = this.flickAccum * Math.exp(-realDt / Math.max(1e-3, tuning.lockOn.flickWindowMs / 1000)) + lookX;
    if (Math.abs(this.flickAccum) >= tuning.lockOn.flickDeg * DEG) {
      this.switchTarget(sim, hero, Math.sign(this.flickAccum));
      this.flickAccum = 0;
    }
  }

  /** Chest point of the target for the camera, or null. */
  lookPoint(sim: SimState): THREE.Vector3 | null {
    const t = this.target(sim);
    return t ? new THREE.Vector3(t.x, t.y + enemyStats(t.kind).height * 0.6, t.z) : null;
  }

  /** Move the marker onto the target (interpolated position from the view). */
  updateMarker(sim: SimState, dt: number): void {
    const t = this.target(sim);
    this.marker.visible = !!t;
    if (!t) return;
    this.spin += dt * 2.5;
    const s = enemyStats(t.kind);
    this.marker.position.set(t.x, t.y, t.z);
    this.marker.children[1].scale.setScalar(s.radius / 0.45);
    this.marker.children[0].rotation.y = this.spin;
    this.marker.children[0].position.y = s.height + 0.5 + Math.sin(this.spin * 2) * 0.05;
  }

  private target(sim: SimState): EnemyState | undefined {
    return sim.enemies.find((e) => e.id === this.targetId && isTargetable(e));
  }

  /** Best enemy near the camera's view: centred first, then close. */
  private acquire(sim: SimState, hero: PlayerState, fwd: { x: number; z: number }): EnemyState | null {
    const lo = tuning.lockOn;
    const viewYaw = Math.atan2(fwd.x, fwd.z);
    let best: EnemyState | null = null;
    let bestScore = Infinity;
    for (const e of sim.enemies) {
      if (!isTargetable(e)) continue;
      const d = Math.hypot(e.x - hero.x, e.z - hero.z);
      if (d > lo.range) continue;
      const off = Math.abs(wrap(Math.atan2(e.x - hero.x, e.z - hero.z) - viewYaw));
      if (off > (lo.acquireConeDeg * DEG) / 2) continue;
      const score = off * 3 + d * 0.08;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  /** Next target to the right (dir > 0) or left of the current one, as seen from the hero. */
  private switchTarget(sim: SimState, hero: PlayerState, dir: number): void {
    const current = this.target(sim);
    if (!current) return;
    const curYaw = Math.atan2(current.x - hero.x, current.z - hero.z);
    let best: EnemyState | null = null;
    let bestOff = Infinity;
    for (const e of sim.enemies) {
      if (e.id === current.id || !isTargetable(e)) continue;
      if (Math.hypot(e.x - hero.x, e.z - hero.z) > tuning.lockOn.range) continue;
      // Yaw grows toward the hero's left; a rightward flick wants smaller yaw.
      const off = -wrap(Math.atan2(e.x - hero.x, e.z - hero.z) - curYaw) * dir;
      if (off > 0 && off < bestOff) {
        bestOff = off;
        best = e;
      }
    }
    if (best) this.targetId = best.id;
  }
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
