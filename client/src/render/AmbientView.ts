import * as THREE from 'three';
import { activeLook } from './look';

const MAX_EMBERS = 600;
const MAX_DUST = 800;

/**
 * Atmosphere: embers rising from every fire, and dust hanging in the purple
 * air (M6 polish). Purely visual; counts come from tuning.look.
 */
export class AmbientView {
  readonly group = new THREE.Group();
  private embers: THREE.Points;
  private emberPos = new Float32Array(MAX_EMBERS * 3);
  private emberVel = new Float32Array(MAX_EMBERS * 3);
  private emberLife = new Float32Array(MAX_EMBERS);
  private dust: THREE.Points;
  private dustPos = new Float32Array(MAX_DUST * 3);
  private time = 0;

  /** sources: fire positions (torch flames and brazier bowls); half: room half-size. */
  constructor(
    private readonly sources: THREE.Vector3[],
    half: number,
  ) {
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.embers = new THREE.Points(
      eg,
      new THREE.PointsMaterial({
        size: 0.07,
        color: new THREE.Color(0xff8a3a).multiplyScalar(3),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.embers.frustumCulled = false;
    for (let i = 0; i < MAX_EMBERS; i++) this.respawnEmber(i, Math.random() * 3);

    for (let i = 0; i < MAX_DUST; i++) {
      this.dustPos[i * 3] = (Math.random() * 2 - 1) * half;
      this.dustPos[i * 3 + 1] = Math.random() * 6;
      this.dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * half;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ size: 0.035, color: 0xb9a6e8, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.dust.frustumCulled = false;
    this.group.add(this.embers, this.dust);
  }

  private respawnEmber(i: number, age = 0): void {
    const s = this.sources[Math.floor(Math.random() * this.sources.length)] ?? new THREE.Vector3();
    this.emberPos[i * 3] = s.x + (Math.random() - 0.5) * 0.3;
    this.emberPos[i * 3 + 1] = s.y + Math.random() * 0.2;
    this.emberPos[i * 3 + 2] = s.z + (Math.random() - 0.5) * 0.3;
    this.emberVel[i * 3] = (Math.random() - 0.5) * 0.3;
    this.emberVel[i * 3 + 1] = 0.6 + Math.random() * 0.9;
    this.emberVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    this.emberLife[i] = 1.2 + Math.random() * 2.2 - age;
  }

  update(dt: number): void {
    this.time += dt;
    const look = activeLook();
    const ne = Math.min(MAX_EMBERS, Math.max(0, Math.round(look.embers)));
    for (let i = 0; i < ne; i++) {
      this.emberLife[i] -= dt;
      if (this.emberLife[i] <= 0) this.respawnEmber(i);
      // Wobble sideways as they rise.
      const k = i * 3;
      this.emberPos[k] += (this.emberVel[k] + Math.sin(this.time * 3 + i) * 0.25) * dt;
      this.emberPos[k + 1] += this.emberVel[k + 1] * dt;
      this.emberPos[k + 2] += (this.emberVel[k + 2] + Math.cos(this.time * 2.6 + i) * 0.25) * dt;
    }
    this.embers.geometry.setDrawRange(0, ne);
    this.embers.geometry.attributes.position.needsUpdate = true;

    const nd = Math.min(MAX_DUST, Math.max(0, Math.round(look.dust)));
    for (let i = 0; i < nd; i++) {
      const k = i * 3;
      this.dustPos[k] += Math.sin(this.time * 0.2 + i * 1.7) * 0.05 * dt;
      this.dustPos[k + 1] += (Math.sin(this.time * 0.3 + i) * 0.04 - 0.01) * dt;
      this.dustPos[k + 2] += Math.cos(this.time * 0.17 + i * 2.3) * 0.05 * dt;
      if (this.dustPos[k + 1] < 0) this.dustPos[k + 1] = 6;
    }
    this.dust.geometry.setDrawRange(0, nd);
    this.dust.geometry.attributes.position.needsUpdate = true;
  }
}
