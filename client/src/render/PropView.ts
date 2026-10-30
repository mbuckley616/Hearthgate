import * as THREE from 'three';
import type { PropInfo, PropKind } from '@hearthgate/shared/level/floor';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { FloorLoot, FloorRunState } from '@hearthgate/shared/sim/floorRun';
import { glowMaterial } from './props';

/**
 * A generated floor's crates, barrels and urns (D4), and the potions, lumber, stone and coin that
 * come out of them. Built once per floor from its layout, like FloorView; update() only hides what
 * the snapshot says is broken and keeps what lies on the floor in step. Made here from primitives,
 * as decor.ts is.
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
  /** Sprayed lumber, stone and coin (Michael, 29 Oct), by id, with when this view first saw each. */
  private readonly loot = new Map<number, { g: THREE.Object3D; seen: number }>();
  private readonly lootKit = makeLootKit();

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

  /** time is this view's clock; simTime the drawn snapshot's, which says how long ago a piece was thrown. */
  update(floor: FloorRunState | undefined, time: number, simTime: number): void {
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
    this.updateLoot(floor, time, simTime);
  }

  private updateLoot(floor: FloorRunState | undefined, time: number, simTime: number): void {
    const settle = tuning.loop.smashSettleMs / 1000;
    const live = new Set<number>();
    for (const d of floor?.loot ?? []) {
      live.add(d.id);
      let shown = this.loot.get(d.id);
      if (!shown) {
        const g = this.lootMesh(d);
        this.group.add(g);
        // One that landed before this view saw it (a join, a late snapshot) is drawn where it lies.
        const age = simTime - d.at;
        shown = { g, seen: age > settle ? -Infinity : time - Math.max(0, age) };
        this.loot.set(d.id, shown);
      }
      // The spray's arc from the broken prop, then a slow turn on the floor.
      const k = settle > 0 ? Math.min(1, (time - shown.seen) / settle) : 1;
      const g = shown.g;
      g.position.set(d.fromX + (d.x - d.fromX) * k, d.y + 0.05 + Math.sin(k * Math.PI) * 0.9 + (1 - k) * 0.4, d.fromZ + (d.z - d.fromZ) * k);
      g.rotation.y = d.id * 1.7 + (k < 1 ? k * 9 : time * 0.6);
    }
    for (const [id, shown] of this.loot) {
      if (live.has(id)) continue;
      this.group.remove(shown.g);
      this.loot.delete(id);
    }
  }

  /** A piece of the spray, cloned from the kit: a plank, a stone, or a pile of one to three coins by its amount. */
  private lootMesh(d: FloorLoot): THREE.Object3D {
    if (d.kind !== 'coin') return this.lootKit[d.kind].clone();
    const pile = new THREE.Group();
    const coins = Math.min(3, Math.max(1, Math.ceil(d.amount / 2)));
    for (let i = 0; i < coins; i++) {
      const c = this.lootKit.coin.clone();
      c.position.set(i === 0 ? 0 : (i - 1.5) * 0.14, 0.03 + i * 0.045, i === 0 ? 0 : 0.08);
      pile.add(c);
    }
    return pile;
  }
}

/** The spray's pieces, built once per floor; clones share geometry and materials. */
function makeLootKit(): Record<FloorLoot['kind'], THREE.Object3D> {
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.11, 0.18), new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.85 }));
  plank.position.y = 0.05;
  const lumber = new THREE.Group().add(plank);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), new THREE.MeshStandardMaterial({ color: 0x8c8c90, roughness: 0.95, flatShading: true }));
  rock.position.y = 0.11;
  rock.scale.set(1.2, 0.8, 1);
  const stone = new THREE.Group().add(rock);
  // Coin glows a little, so a pile reads in a dim room at the camera's distance.
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14),
    new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0x8a5a00, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3 }),
  );
  for (const o of [plank, rock, coin]) o.castShadow = true;
  return { lumber, stone, coin };
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
