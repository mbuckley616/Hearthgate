import * as THREE from 'three';
import type { PropInfo, PropKind } from '@hearthgate/shared/level/floor';
import type { FloorRunState } from '@hearthgate/shared/sim/floorRun';
import { glowMaterial } from './props';

/**
 * A generated floor's crates, barrels and urns (D4), and the potions that roll out of them. Built
 * once per floor from its layout, like FloorView; update() only hides what the snapshot says is
 * broken and keeps the potions on the floor in step. Made here from primitives, as decor.ts is.
 */
export class PropView {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Object3D>();
  private readonly potions = new Map<number, THREE.Group>();
  private shownBroken = 0;
  private readonly flaskGeo = new THREE.SphereGeometry(0.16, 12, 10);
  private readonly neckGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8);
  private readonly ringGeo = new THREE.RingGeometry(0.4, 0.48, 28).rotateX(-Math.PI / 2);
  private readonly flaskMat = new THREE.MeshStandardMaterial({ color: 0xd8213a, emissive: 0x8a0d1c, emissiveIntensity: 0.9, roughness: 0.25 });
  private readonly glassMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.2 });
  private readonly glowMat = glowMaterial(0xff4060, 0.6);

  constructor(props: readonly PropInfo[]) {
    const kit = makeKit();
    for (const pr of props) {
      const mesh = kit[pr.kind].clone();
      mesh.position.set(pr.x, pr.y, pr.z);
      mesh.rotation.y = pr.yaw;
      this.meshes.set(pr.id, mesh);
      this.group.add(mesh);
    }
  }

  update(floor: FloorRunState | undefined, time: number): void {
    const broken = floor?.broken ?? [];
    // Broken props only ever grow on a floor; a shorter list is a new floor's first snapshot.
    if (broken.length !== this.shownBroken) {
      for (const [id, m] of this.meshes) m.visible = !broken.includes(id);
      this.shownBroken = broken.length;
    }
    const live = new Set<number>();
    for (const pt of floor?.potions ?? []) {
      live.add(pt.id);
      let g = this.potions.get(pt.id);
      if (!g) {
        g = new THREE.Group();
        const flask = new THREE.Mesh(this.flaskGeo, this.flaskMat);
        const neck = new THREE.Mesh(this.neckGeo, this.glassMat);
        neck.position.y = 0.17;
        const body = new THREE.Group();
        body.add(flask, neck);
        body.name = 'body';
        const ring = new THREE.Mesh(this.ringGeo, this.glowMat);
        ring.position.y = 0.04;
        g.add(body, ring);
        g.position.set(pt.x, pt.y, pt.z);
        this.potions.set(pt.id, g);
        this.group.add(g);
      }
      const body = g.getObjectByName('body')!;
      body.position.y = 0.55 + Math.sin(time * 2.5 + pt.id) * 0.08;
      body.rotation.y = time * 1.5;
    }
    for (const [id, g] of this.potions) {
      if (live.has(id)) continue;
      this.group.remove(g);
      this.potions.delete(id);
    }
  }
}

/** A mesh moved to (x, y, z) in its prop. */
function at(m: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
  m.position.set(x, y, z);
  return m;
}

/** One of each prop, cloned per placement (clones share geometry and materials). */
function makeKit(): Record<PropKind, THREE.Object3D> {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.85 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xa65a3a, roughness: 0.8, side: THREE.DoubleSide });
  const shadow = (o: THREE.Object3D) => {
    o.traverse((c) => {
      c.castShadow = true;
      c.receiveShadow = true;
    });
    return o;
  };

  const crate = new THREE.Group();
  const s = 0.8;
  crate.add(at(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), wood), 0, s / 2, 0));
  // Dark slats round each face's edge read as a crate at the camera's distance.
  const slat = new THREE.BoxGeometry(s + 0.04, 0.09, 0.09);
  for (const y of [0.05, s - 0.05]) {
    for (const z of [-s / 2, s / 2]) crate.add(at(new THREE.Mesh(slat, darkWood), 0, y, z));
    for (const x of [-s / 2, s / 2]) {
      const m = new THREE.Mesh(slat, darkWood);
      m.position.set(x, y, 0);
      m.rotation.y = Math.PI / 2;
      crate.add(m);
    }
  }
  const brace = new THREE.BoxGeometry(0.09, s * 1.3, 0.06);
  for (const z of [-s / 2 - 0.02, s / 2 + 0.02]) {
    const m = new THREE.Mesh(brace, darkWood);
    m.position.set(0, s / 2, z);
    m.rotation.z = Math.PI / 4;
    crate.add(m);
  }

  const barrel = new THREE.Group();
  const stave = new THREE.LatheGeometry(
    [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97].map((y) => new THREE.Vector2(0.3 + Math.sin((y / 0.97) * Math.PI) * 0.07, y)),
    14,
  );
  barrel.add(new THREE.Mesh(stave, wood));
  const lid = new THREE.CircleGeometry(0.3, 14).rotateX(-Math.PI / 2);
  barrel.add(at(new THREE.Mesh(lid, darkWood), 0, 0.97, 0));
  for (const y of [0.16, 0.81]) {
    const hoop = new THREE.TorusGeometry(0.34, 0.025, 6, 18).rotateX(Math.PI / 2);
    barrel.add(at(new THREE.Mesh(hoop, iron), 0, y, 0));
  }

  const urn = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0.12, 0],
        [0.24, 0.08],
        [0.3, 0.3],
        [0.26, 0.52],
        [0.12, 0.66],
        [0.11, 0.74],
        [0.16, 0.78],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      14,
    ),
    clay,
  );

  return { crate: shadow(crate), barrel: shadow(barrel), urn: shadow(urn) };
}
