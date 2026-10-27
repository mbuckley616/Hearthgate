import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';

const MAX_SAMPLES = 28;

interface Sample {
  a: THREE.Vector3;
  b: THREE.Vector3;
  time: number;
  strength: number;
}

/**
 * Ribbon swept by a weapon edge (brief: "a weapon trail on every swing").
 * Each frame the owner pushes the edge's two ends in world space; the ribbon
 * fades over tuning.hitFeel.trailLifeMs. Additive, unlit, no shadows.
 */
export class WeaponTrail {
  readonly mesh: THREE.Mesh;
  private samples: Sample[] = [];
  private positions = new Float32Array(MAX_SAMPLES * 2 * 3);
  private colors = new Float32Array(MAX_SAMPLES * 2 * 3);
  private color: THREE.Color;

  constructor(color: number) {
    this.color = new THREE.Color(color);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  /** Record this frame's edge; strength 0 means not emitting (the existing ribbon just fades). */
  push(a: THREE.Vector3, b: THREE.Vector3, time: number, strength: number): void {
    const last = this.samples[this.samples.length - 1];
    // Nothing new to record when time is frozen, or when idle and already faded.
    if ((last && time <= last.time) || (strength <= 0 && (!last || last.strength <= 0))) {
      this.update(time);
      return;
    }
    this.samples.push({ a: a.clone(), b: b.clone(), time, strength });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    this.update(time);
  }

  private update(time: number): void {
    const life = Math.max(1e-3, tuning.hitFeel.trailLifeMs / 1000);
    this.samples = this.samples.filter((s) => time - s.time < life);
    const n = this.samples.length;
    const geo = this.mesh.geometry;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      const k = i * 6;
      if (!s) {
        this.positions.fill(0, k, k + 6);
        this.colors.fill(0, k, k + 6);
        continue;
      }
      const fade = i < n ? s.strength * (1 - (time - s.time) / life) : 0;
      // Brighter toward the tip edge.
      const tip = this.color.clone().multiplyScalar(fade * 1.4);
      const base = this.color.clone().multiplyScalar(fade * 0.25);
      this.positions.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], k);
      this.colors.set([base.r, base.g, base.b, tip.r, tip.g, tip.b], k);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    // Only draw quads between live samples.
    geo.setDrawRange(0, Math.max(0, n - 1) * 6);
  }
}
