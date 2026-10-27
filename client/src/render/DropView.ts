import * as THREE from 'three';
import type { DropState } from '@hearthgate/shared/sim/types';
import { glowMaterial } from './props';

const RARITY_COLOR = { common: 0x9fc8ff, rare: 0xffc35a };

interface Visual {
  group: THREE.Group;
  gem: THREE.Mesh;
  beam: THREE.Mesh;
  ring: THREE.Mesh;
}

/** Gear on the floor: a beam of light you can see across the arena, a spinning gem and a ground ring. */
export class DropView {
  readonly group = new THREE.Group();
  private visuals = new Map<number, Visual>();
  private beamGeo = new THREE.CylinderGeometry(0.1, 0.32, 7, 14, 1, true).translate(0, 3.5, 0);
  private gemGeo = new THREE.OctahedronGeometry(0.2);
  private ringGeo = new THREE.RingGeometry(0.55, 0.65, 32).rotateX(-Math.PI / 2);

  update(drops: DropState[], time: number): void {
    const live = new Set<number>();
    for (const d of drops) {
      live.add(d.id);
      let v = this.visuals.get(d.id);
      if (!v) {
        const color = RARITY_COLOR[d.item.rarity];
        const group = new THREE.Group();
        const beam = new THREE.Mesh(this.beamGeo, glowMaterial(color, d.item.rarity === 'rare' ? 0.35 : 0.2));
        const gem = new THREE.Mesh(this.gemGeo, glowMaterial(color, 1));
        const ring = new THREE.Mesh(this.ringGeo, glowMaterial(color, 0.7));
        ring.position.y = 0.04;
        group.add(beam, gem, ring);
        v = { group, gem, beam, ring };
        this.visuals.set(d.id, v);
        this.group.add(group);
      }
      v.group.position.set(d.x, d.y, d.z);
      // Pops up out of the floor, then bobs and spins.
      const appear = Math.min(1, d.age / 0.4);
      v.gem.position.y = 0.9 + Math.sin(time * 2.5 + d.id) * 0.12;
      v.gem.rotation.y = time * 2;
      v.gem.scale.setScalar(appear * (1 + Math.sin(time * 6) * 0.08));
      v.beam.scale.set(1, appear, 1);
      v.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
    }
    for (const [id, v] of this.visuals) {
      if (live.has(id)) continue;
      this.group.remove(v.group);
      this.visuals.delete(id);
    }
  }
}
