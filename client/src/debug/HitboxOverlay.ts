import * as THREE from 'three';
import { enemyStats, tuning } from '@hearthgate/shared/config/tuning';
import { heroHit } from '@hearthgate/shared/sim/talents';
import type { SimState } from '@hearthgate/shared/sim/types';

const MAX_SEGMENTS = 4000;
const DEG = Math.PI / 180;

const COLORS = {
  hurt: new THREE.Color(0x4ad0ff),
  windup: new THREE.Color(0xffd24a),
  active: new THREE.Color(0xff4040),
  enemyTelegraph: new THREE.Color(0xff9a3a),
  projectile: new THREE.Color(0x9cff7a),
};

/**
 * Debug overlay (brief: "a hitbox overlay, so each swing can be judged frame
 * by frame"): hurt cylinders, the hero's sword hit area (yellow in windup,
 * red while it can hit), grunt slash arcs and burst radii. Reads sim state only.
 */
export class HitboxOverlay {
  readonly lines: THREE.LineSegments;
  private positions = new Float32Array(MAX_SEGMENTS * 6);
  private colors = new Float32Array(MAX_SEGMENTS * 6);
  private count = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.renderOrder = 999;
    this.lines.frustumCulled = false;
  }

  update(sim: SimState): void {
    this.lines.visible = tuning.debug.showHitboxes;
    if (!this.lines.visible) return;
    this.count = 0;
    const g = tuning.grunt;

    for (const e of sim.enemies) {
      if (e.ai === 'dead') continue;
      const s = enemyStats(e.kind);
      this.circle(e.x, e.y + 0.05, e.z, s.radius, COLORS.hurt);
      this.circle(e.x, e.y + s.height, e.z, s.radius, COLORS.hurt);
      for (const a of [0, 90, 180, 270]) {
        const x = e.x + Math.sin(a * DEG) * s.radius;
        const z = e.z + Math.cos(a * DEG) * s.radius;
        this.seg(x, e.y + 0.05, z, x, e.y + s.height, z, COLORS.hurt);
      }
      const gruntSwing = e.ai === 'windup' || e.ai === 'slash1' || e.ai === 'between' || e.ai === 'slash2';
      if (e.kind === 'grunt' && gruntSwing) {
        const color = e.ai === 'slash1' || e.ai === 'slash2' ? COLORS.active : COLORS.enemyTelegraph;
        this.sector(e.x, e.z, e.yaw, g.reach + tuning.movement.radius, g.arcDeg, color, e.y);
      }
      // Slams, sweeps and aim lines, exactly as the sim checks them.
      const t = e.tele;
      const live = e.ai === 'slam' || e.ai === 'sweep';
      const color = live ? COLORS.active : COLORS.enemyTelegraph;
      if (t.shape === 'circle') this.sector(t.x, t.z, 0, t.radius + tuning.movement.radius, 360, color, e.y);
      if (t.shape === 'cone') this.sector(t.x, t.z, t.yaw, t.radius + tuning.movement.radius, t.arcDeg, color, e.y);
      if (t.shape === 'line') this.seg(e.x, e.y + 1.3, e.z, t.x, 1.1, t.z, color);
    }

    for (const p of sim.players) {
      this.circle(p.x, p.y + 0.05, p.z, tuning.movement.radius, COLORS.hurt);
      this.circle(p.x, p.y + tuning.movement.height, p.z, tuning.movement.radius, COLORS.hurt);
      if (p.mode !== 'attack' || p.style !== 'sword') continue;
      const hit = heroHit(p, p.attackHit);
      const isSlam = p.attackHit === 4;
      const from = hit.windup + (isSlam ? hit.active * tuning.combat.slamHitFrom : 0);
      const live = p.attackTime >= from && p.attackTime <= hit.windup + hit.active;
      const color = live ? COLORS.active : COLORS.windup;
      const cx = p.x + (isSlam ? Math.sin(p.yaw) : 0);
      const cz = p.z + (isSlam ? Math.cos(p.yaw) : 0);
      // Drawn at reach + enemy radius: an enemy centre inside this line gets hit.
      this.sector(cx, cz, p.yaw, hit.range + g.radius, hit.arcDeg, color, p.y);
    }

    for (const pr of sim.projectiles) {
      if (pr.kind === 'burst') {
        if (pr.age < 0.2) this.circle(pr.x, pr.y + 0.08, pr.z, pr.radius + g.radius, COLORS.active);
      } else if (!pr.stuck) {
        this.circle(pr.x, pr.y, pr.z, 0.12, pr.hostile ? COLORS.active : COLORS.projectile);
      }
    }

    const geo = this.lines.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, this.count * 2);
  }

  private seg(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: THREE.Color): void {
    if (this.count >= MAX_SEGMENTS) return;
    const k = this.count * 6;
    this.positions.set([x0, y0, z0, x1, y1, z1], k);
    this.colors.set([c.r, c.g, c.b, c.r, c.g, c.b], k);
    this.count++;
  }

  private circle(x: number, y: number, z: number, r: number, c: THREE.Color): void {
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.seg(x + Math.sin(a0) * r, y, z + Math.cos(a0) * r, x + Math.sin(a1) * r, y, z + Math.cos(a1) * r, c);
    }
  }

  /** Pie slice on the floor centred on yaw (a full circle for 360). */
  private sector(x: number, z: number, yaw: number, r: number, arcDeg: number, c: THREE.Color, ground = 0): void {
    const arc = Math.min(360, arcDeg) * DEG;
    const n = Math.max(6, Math.round(arcDeg / 10));
    const y = ground + 0.06;
    for (let i = 0; i < n; i++) {
      const a0 = yaw - arc / 2 + (arc * i) / n;
      const a1 = yaw - arc / 2 + (arc * (i + 1)) / n;
      this.seg(x + Math.sin(a0) * r, y, z + Math.cos(a0) * r, x + Math.sin(a1) * r, y, z + Math.cos(a1) * r, c);
    }
    if (arcDeg < 360) {
      this.seg(x, y, z, x + Math.sin(yaw - arc / 2) * r, y, z + Math.cos(yaw - arc / 2) * r, c);
      this.seg(x, y, z, x + Math.sin(yaw + arc / 2) * r, y, z + Math.cos(yaw + arc / 2) * r, c);
    }
  }
}
