import * as THREE from 'three';
import { ELEMENT_COLOUR } from '@hearthgate/shared/sim/specs';
import type { BrambleGround, ConsecratedGround } from '@hearthgate/shared/sim/types';

/** At most this many rings drawn at once: one a Paladin, four heroes. */
const POOL = 4;
/** The last second of a ring fades it out, so its end is seen coming. */
const FADE_S = 1;

/**
 * A Paladin's Consecrate (the builds pass): a holy ring on the ground and a faint wash inside it,
 * built once and moved to whatever rings the snapshot holds. A Ranger's Bramble Rain patches use the
 * same view, a second one, each patch tinted by its Ranger's element.
 */
export class ConsecrateView {
  readonly group = new THREE.Group();
  private rings: { root: THREE.Group; edge: THREE.MeshBasicMaterial; wash: THREE.MeshBasicMaterial }[] = [];

  constructor() {
    const colour = ELEMENT_COLOUR.holy;
    const edgeGeo = new THREE.RingGeometry(0.93, 1, 48);
    const washGeo = new THREE.CircleGeometry(0.93, 48);
    for (let i = 0; i < POOL; i++) {
      const edge = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const wash = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const root = new THREE.Group();
      const e = new THREE.Mesh(edgeGeo, edge);
      const w = new THREE.Mesh(washGeo, wash);
      e.rotation.x = -Math.PI / 2;
      w.rotation.x = -Math.PI / 2;
      root.add(e, w);
      root.visible = false;
      this.group.add(root);
      this.rings.push({ root, edge, wash });
    }
  }

  update(rings: readonly (ConsecratedGround | BrambleGround)[] | undefined, time: number): void {
    let n = 0;
    for (const g of rings ?? []) {
      if (n >= POOL || g.until <= time) continue;
      const r = this.rings[n++];
      const fade = Math.min(1, (g.until - time) / FADE_S);
      // A slow breath on the edge, so it reads as alive rather than a decal.
      const breath = 0.85 + 0.15 * Math.sin(time * 4);
      if ('element' in g) {
        r.edge.color.setHex(ELEMENT_COLOUR[g.element]);
        r.wash.color.setHex(ELEMENT_COLOUR[g.element]);
      }
      r.root.visible = true;
      r.root.position.set(g.x, g.y + 0.04, g.z);
      r.root.scale.set(g.radius, 1, g.radius);
      r.edge.opacity = 0.8 * fade * breath;
      r.wash.opacity = 0.12 * fade;
    }
    for (let i = n; i < POOL; i++) this.rings[i].root.visible = false;
  }
}
