import * as THREE from 'three';
import { abilityTiming, tuning } from '@hearthgate/shared/config/tuning';
import { ELEMENT_COLOUR, bladeCount, elementFor, specOf, spectralBladeYaw } from '@hearthgate/shared/sim/specs';
import { abilityRank } from '@hearthgate/shared/sim/talents';
import type { PlayerState } from '@hearthgate/shared/sim/types';

/** Four heroes, up to four blades each (the panel's ceiling). */
const POOL = 16;

/**
 * A Spellblade's spectral blades (the builds pass): ghostly swords circling a spinning Spellblade in
 * their element, placed by `spectralBladeYaw`, the sim's own, so a blade is drawn where it hits.
 * Built once; each frame shows as many as the spinning Spellblades need.
 */
export class SpectralBladesView {
  readonly group = new THREE.Group();
  private blades: { root: THREE.Group; mat: THREE.MeshBasicMaterial }[] = [];

  constructor() {
    // A blade lying flat, pointing outward along +z from its root at the inner edge of the band.
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.04, 1);
    bladeGeo.translate(0, 0, 0.5);
    const guardGeo = new THREE.BoxGeometry(0.4, 0.06, 0.08);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
      const root = new THREE.Group();
      const blade = new THREE.Mesh(bladeGeo, mat);
      const guard = new THREE.Mesh(guardGeo, mat);
      root.add(blade, guard);
      root.visible = false;
      this.group.add(root);
      this.blades.push({ root, mat });
    }
  }

  update(players: readonly PlayerState[], time: number): void {
    let n = 0;
    const timing = abilityTiming('whirlwind');
    for (const p of players) {
      const count = bladeCount(p);
      if (count <= 0 || p.mode !== 'ability' || p.ability !== 'whirlwind' || specOf(p) !== 'spellblade') continue;
      const u = (p.abilityTime - timing.windup) / Math.max(1e-3, timing.active);
      if (u < 0 || u > 1) continue;
      const reach = tuning.abilities.whirlwindRadius + abilityRank(p, 'whirlwind') * tuning.talents.whirlwindRadiusPerRank;
      const len = Math.max(0.3, tuning.specs.spectralBladeReach);
      const colour = ELEMENT_COLOUR[elementFor(p, 'sword') ?? 'fire'];
      // In and out over the spin's first and last tenth, so they arrive and leave rather than pop.
      const fade = Math.min(1, u * 10, (1 - u) * 10);
      for (let b = 0; b < count && n < POOL; b++) {
        const r = this.blades[n++];
        const yaw = spectralBladeYaw(p.yaw, u, b, count);
        r.mat.color.setHex(colour);
        r.mat.opacity = 0.7 * fade * (0.85 + 0.15 * Math.sin(time * 12 + b));
        r.root.visible = true;
        r.root.position.set(p.x + Math.sin(yaw) * reach, p.y + 1, p.z + Math.cos(yaw) * reach);
        r.root.rotation.set(0, yaw, 0);
        r.root.scale.set(1, 1, len);
      }
    }
    for (let i = n; i < POOL; i++) this.blades[i].root.visible = false;
  }
}
