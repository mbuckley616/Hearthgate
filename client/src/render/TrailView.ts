import * as THREE from 'three';
import { ELEMENT_COLOUR } from '@hearthgate/shared/sim/specs';
import type { TrailGround } from '@hearthgate/shared/sim/types';

/** At most this many trails drawn at once: one a Spellblade, four heroes. */
const POOL = 4;
/** The last second of a trail fades it out, as Consecrate's rings do. */
const FADE_S = 1;

/**
 * A Spellblade's Blazing Charge trail (the builds pass): a glowing strip on the ground along the dash,
 * in the Spellblade's element, built once and stretched to whatever trails the snapshot holds.
 */
export class TrailView {
  readonly group = new THREE.Group();
  private strips: { core: THREE.Mesh; glow: THREE.Mesh; coreMat: THREE.MeshBasicMaterial; glowMat: THREE.MeshBasicMaterial }[] = [];

  constructor() {
    // A unit square lying flat, its long side along +z; scaled to the strip's width and length.
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const coreMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const glowMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const core = new THREE.Mesh(geo, coreMat);
      const glow = new THREE.Mesh(geo, glowMat);
      core.visible = glow.visible = false;
      this.group.add(core, glow);
      this.strips.push({ core, glow, coreMat, glowMat });
    }
  }

  update(trails: readonly TrailGround[] | undefined, time: number): void {
    let n = 0;
    for (const g of trails ?? []) {
      if (n >= POOL || g.until <= time) continue;
      const s = this.strips[n++];
      const dx = g.x1 - g.x0;
      const dz = g.z1 - g.z0;
      const len = Math.max(0.2, Math.hypot(dx, dz));
      const yaw = Math.atan2(dx, dz);
      const fade = Math.min(1, (g.until - time) / FADE_S);
      // A quick flicker, so it reads as burning rather than paint.
      const flicker = 0.8 + 0.2 * Math.sin(time * 17 + n * 2.1);
      const colour = ELEMENT_COLOUR[g.element];
      s.coreMat.color.setHex(colour);
      s.glowMat.color.setHex(colour);
      s.coreMat.opacity = 0.5 * fade * flicker;
      s.glowMat.opacity = 0.15 * fade;
      for (const [m, w] of [[s.core, g.width * 0.6], [s.glow, g.width * 1.3]] as const) {
        m.visible = true;
        m.position.set((g.x0 + g.x1) / 2, g.y + 0.05, (g.z0 + g.z1) / 2);
        m.rotation.set(0, yaw, 0);
        m.scale.set(w, 1, len + w * 0.5);
      }
    }
    for (let i = n; i < POOL; i++) this.strips[i].core.visible = this.strips[i].glow.visible = false;
  }
}
