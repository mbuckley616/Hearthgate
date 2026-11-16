import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { BoneRidge } from '@hearthgate/shared/sim/types';

/** The most ridges drawn at once: the panel's ceiling for `mason.maxRidges`. */
const POOL = 6;
/** A ridge heaves up out of the floor this fast, and sinks back over its last half second. */
const RISE_S = 0.25;
const SINK_S = 0.5;
const BONE = 0xd8cfb4;
const MORTAR = 0x6a5a4a;

/**
 * The Ossuary Mason's bone ridges (M3): a heaped wall of bone along its line, built once as a pool
 * of unit boxes and stretched to each ridge the snapshot holds. It reads the sim's own size from
 * tuning, so what is drawn is the wall the server and prediction collide with.
 */
export class RidgeView {
  readonly group = new THREE.Group();
  private ridges: { root: THREE.Group; ribs: THREE.Mesh[] }[] = [];

  constructor() {
    const core = new THREE.BoxGeometry(1, 1, 1);
    core.translate(0, 0.5, 0);
    const rib = new THREE.BoxGeometry(1, 1, 1);
    rib.translate(0, 0.5, 0);
    const coreMat = new THREE.MeshStandardMaterial({ color: MORTAR, roughness: 0.95 });
    const boneMat = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.8 });
    for (let i = 0; i < POOL; i++) {
      const root = new THREE.Group();
      root.add(new THREE.Mesh(core, coreMat));
      // Five bone ribs stand proud of the mortar, so the wall reads as bone from any side.
      const ribs: THREE.Mesh[] = [];
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(rib, boneMat);
        root.add(m);
        ribs.push(m);
      }
      root.visible = false;
      this.group.add(root);
      this.ridges.push({ root, ribs });
    }
  }

  update(ridges: readonly BoneRidge[] | undefined, time: number): void {
    const m = tuning.mason;
    const life = m.ridgeLifeMs / 1000;
    let n = 0;
    for (const r of ridges ?? []) {
      if (n >= POOL || r.until <= time) continue;
      const v = this.ridges[n++];
      const age = time - (r.until - life);
      const up = Math.min(1, Math.max(0, age / RISE_S), Math.max(0, (r.until - time) / SINK_S));
      const len = r.half * 2;
      const h = Math.max(0.01, m.ridgeHeightM * up);
      v.root.visible = true;
      v.root.position.set(r.x, r.y, r.z);
      // Built along x; a ridge along z is the same wall turned a quarter.
      v.root.rotation.y = r.alongX ? 0 : Math.PI / 2;
      v.root.children[0].scale.set(len, h, m.ridgeThickM);
      v.ribs.forEach((rib, k) => {
        rib.position.set((k / (v.ribs.length - 1) - 0.5) * (len - 0.4), 0, 0);
        rib.scale.set(0.3, h * (k % 2 ? 1.08 : 1.15), m.ridgeThickM + 0.2);
      });
    }
    for (let i = n; i < POOL; i++) this.ridges[i].root.visible = false;
  }
}
