import * as THREE from 'three';
import { groundHeight, type World } from '@hearthgate/shared/level/arena';
import type { EnemyState } from '@hearthgate/shared/sim/types';
import { windupProgress } from './EnemyView';

const DANGER = 0xff3a22;

interface Marker {
  shape: string;
  group: THREE.Group;
  fill: THREE.Mesh;
  outline: THREE.Mesh;
}

function material(opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: DANGER,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Enemy telegraphs on the ground (brief: "1,000 ms ground circle", "900 ms
 * cone", "800 ms visible aim line"): an outline at full size plus a fill that
 * grows until the hit lands. Reads the shapes the sim uses for its hit checks.
 */
export class TelegraphView {
  readonly group = new THREE.Group();
  private markers = new Map<number, Marker>();
  private unitDisc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private unitRing = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
  /** Thin beam one unit long along +Z. */
  private unitBeam = new THREE.BoxGeometry(0.05, 0.05, 1).translate(0, 0, 0.5);
  private cones = new Map<number, { fill: THREE.BufferGeometry; outline: THREE.BufferGeometry }>();

  constructor(private world: World) {}

  update(enemies: EnemyState[], time: number): void {
    const live = new Set<number>();
    for (const e of enemies) {
      const t = e.tele;
      if (t.shape === 'none' || e.ai === 'dead' || e.ai === 'stagger' || e.frozen > 0) continue;
      live.add(e.id);
      let m = this.markers.get(e.id);
      if (!m || m.shape !== `${t.shape}:${t.arcDeg}`) {
        if (m) this.group.remove(m.group);
        m = this.create(t.shape, t.arcDeg);
        this.markers.set(e.id, m);
        this.group.add(m.group);
      }
      const progress = windupProgress(e);
      const pulse = 0.85 + 0.15 * Math.sin(time * 14);
      if (t.shape === 'line') {
        // Aim line from the archer's bow to where the shot will go; it brightens as it fires.
        const from = new THREE.Vector3(e.x, e.y + 1.3, e.z);
        const to = new THREE.Vector3(t.x, groundHeight(this.world, t.x, t.z) + 1.1, t.z);
        const len = from.distanceTo(to);
        m.group.position.copy(from);
        m.group.lookAt(to);
        m.fill.scale.set(1 + progress * 1.5, 1 + progress * 1.5, len);
        (m.fill.material as THREE.MeshBasicMaterial).opacity = (0.25 + progress * 0.65) * pulse;
        m.outline.visible = false;
        continue;
      }
      const y = groundHeight(this.world, t.x, t.z) + 0.05;
      m.group.position.set(t.x, y, t.z);
      m.group.rotation.y = t.shape === 'cone' ? t.yaw - Math.PI / 2 : 0;
      m.outline.scale.setScalar(t.radius);
      m.fill.scale.setScalar(t.radius * Math.max(0.02, progress));
      (m.outline.material as THREE.MeshBasicMaterial).opacity = 0.75 * pulse;
      (m.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + progress * 0.3;
    }
    for (const [id, m] of this.markers) {
      if (live.has(id)) continue;
      this.group.remove(m.group);
      this.markers.delete(id);
    }
  }

  private create(shape: string, arcDeg: number): Marker {
    const group = new THREE.Group();
    let fill: THREE.Mesh;
    let outline: THREE.Mesh;
    if (shape === 'line') {
      fill = new THREE.Mesh(this.unitBeam, material(0.4));
      outline = new THREE.Mesh(this.unitBeam, material(0));
    } else if (shape === 'cone') {
      const geo = this.coneGeometry(arcDeg);
      fill = new THREE.Mesh(geo.fill, material(0.25));
      outline = new THREE.Mesh(geo.outline, material(0.75));
    } else {
      fill = new THREE.Mesh(this.unitDisc, material(0.25));
      outline = new THREE.Mesh(this.unitRing, material(0.75));
    }
    fill.renderOrder = outline.renderOrder = 5;
    group.add(fill, outline);
    return { shape: `${shape}:${arcDeg}`, group, fill, outline };
  }

  /** Unit-radius sector (and its rim) centred on +X, flat on the ground. */
  private coneGeometry(arcDeg: number): { fill: THREE.BufferGeometry; outline: THREE.BufferGeometry } {
    let g = this.cones.get(arcDeg);
    if (!g) {
      const arc = (arcDeg * Math.PI) / 180;
      g = {
        fill: new THREE.CircleGeometry(1, 32, -arc / 2, arc).rotateX(-Math.PI / 2),
        outline: new THREE.RingGeometry(0.94, 1, 32, 1, -arc / 2, arc).rotateX(-Math.PI / 2),
      };
      this.cones.set(arcDeg, g);
    }
    return g;
  }
}
