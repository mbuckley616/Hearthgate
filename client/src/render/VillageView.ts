import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { World } from '@hearthgate/shared/level/arena';
import type { Building, Villager } from '@hearthgate/shared/level/village';
import { createPlayer } from '@hearthgate/shared/sim/player';
import type { PlayerState } from '@hearthgate/shared/sim/types';
import { HeroView } from './HeroView';
import { Nameplate } from './Nameplate';
import type { Palette } from './props';
import { earthTextures, fieldstoneTextures, grassTextures, plankTextures, roofTextures, timberTextures, type TexturePair } from './villageTextures';

const DEG = Math.PI / 180;

/** Small deterministic PRNG so the trees stand in the same places every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function standard(t: TexturePair, bumpScale: number, roughness = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale, roughness, metalness: 0 });
}

/** A villager on screen: the slice's hero figure standing idle, with their name above. */
interface VillagerFigure {
  def: Villager;
  view: HeroView;
  state: PlayerState;
}

/**
 * The village (T3), built in code like the slice's arena (RoomView): a grassy square inside a
 * palisade, packed-earth paths to each door, the four starting buildings in plaster and timber over
 * fieldstone (the Portal Shrine all stone), a well, trees inside and a wood beyond the fence, and a
 * villager at each door. Lit by the golden-afternoon mood (look.ts); nothing here moves on its own
 * but the villagers' breathing and the trees fading when they hide the hero.
 *
 * Same surface as RoomView so the game swaps one for the other: a group, fire sources for embers
 * (none here), and update().
 */
export class VillageView {
  readonly group = new THREE.Group();
  /** No torches or braziers burn in the afternoon. */
  readonly fireSources: THREE.Vector3[] = [];
  private villagers: VillagerFigure[] = [];
  /**
   * Each building's tier, shown (P4): a pennant on its roof for every tier, and the numeral on its
   * sign. Built once at the top tier the save allows; setTiers shows as many as the village has.
   */
  private tierMarks = new Map<Building['id'], { flags: THREE.Object3D[]; sign: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; name: string; tier: number }>();
  /** Trees inside the fence and the well's roof, by collider id: they fade when they stand between camera and hero. */
  private trees = new Map<string, { mats: THREE.MeshStandardMaterial[]; opacity: number }>();

  constructor(world: World, palette: Palette) {
    const level = world.level;
    const v = level.village!;
    const h = level.floorSize / 2;

    this.buildGround(h, v.buildings, v.well);
    this.buildPalisade(h, level.wallHeight);
    for (const b of v.buildings) this.buildBuilding(b);
    this.buildWell(v.well.x, v.well.z, v.well.radius);
    this.buildWood(h);
    v.trees.forEach((t, i) => this.buildTree(t.x, t.z, 1, i, `tree-${i}`));
    this.buildProps();

    for (const def of v.villagers) {
      const state = createPlayer(def.id, def.x, def.z, def.facingYawDeg * DEG);
      state.style = def.look;
      state.name = def.name;
      const view = new HeroView(palette);
      const plate = new Nameplate();
      view.root.add(plate.sprite);
      plate.sprite.position.y = 2.25;
      plate.update(state, tuning.coop.reviveMs);
      this.group.add(view.root, view.effects);
      this.villagers.push({ def, view, state });
    }
  }

  /** The villagers, for talking (the game finds the nearest in reach). */
  get villagerDefs(): readonly Villager[] {
    return this.villagers.map((v) => v.def);
  }

  /**
   * @param occluders fadeable collider ids currently hiding the hero (trees)
   */
  update(dt: number, _time: number, occluders: ReadonlySet<string>, _gateClosed = false): void {
    for (const v of this.villagers) v.view.update(v.state, v.state, 1, dt);
    const cam = tuning.camera;
    for (const [id, t] of this.trees) {
      const target = occluders.has(id) ? cam.occluderOpacity : 1;
      t.opacity += (target - t.opacity) * (1 - Math.exp(-cam.occluderFadeRate * dt));
      for (const m of t.mats) {
        m.opacity = t.opacity;
        m.transparent = t.opacity < 0.99;
        m.depthWrite = t.opacity >= 0.99;
      }
    }
  }

  private buildGround(h: number, buildings: Building[], well: { x: number; z: number }): void {
    const size = 140;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(size, size), standard(grassTextures(size, size), 1.2, 0.95));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.group.add(grass);

    const earth = (w: number, d: number, y: number) => {
      const m = standard(earthTextures(w, d), 1.4, 0.95);
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1 - y * 100;
      return m;
    };
    // The square round the well.
    const square = new THREE.Mesh(new THREE.CircleGeometry(8.5, 40), earth(17, 17, 0.01));
    square.rotation.x = -Math.PI / 2;
    square.position.set(well.x, 0.01, well.z);
    square.receiveShadow = true;
    this.group.add(square);
    // A path from the square to each door, and one south to where the party arrives.
    const path = (x0: number, z0: number, x1: number, z1: number, width: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len), earth(width, len, 0.012));
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(x1 - x0, z1 - z0);
      mesh.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    for (const b of buildings) {
      const out = { x: Math.sin(b.door.facingYawDeg * DEG), z: Math.cos(b.door.facingYawDeg * DEG) };
      path(well.x, well.z, b.door.x + out.x * 1.5, b.door.z + out.z * 1.5, b.id === 'shrine' ? 5 : 2.6);
    }
    path(well.x, well.z, 0, h - 1, 3.2);
  }

  /** A fence of sharpened stakes round the square, with a rail along it. */
  private buildPalisade(h: number, height: number): void {
    const spacing = 0.36;
    const perSide = Math.ceil((h * 2) / spacing);
    const count = perSide * 4;
    const rand = rng(77);
    const wood = standard(plankTextures(1, 3), 1.2);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.19, 1, 7), wood, count);
    const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 0.4, 7), wood, count);
    const m = new THREE.Matrix4();
    let i = 0;
    const r = h + 0.2;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < perSide; k++) {
        const u = -h + (k + 0.5) * spacing;
        const [x, z] = side === 0 ? [u, -r] : side === 1 ? [u, r] : side === 2 ? [-r, u] : [r, u];
        const ph = height + (rand() - 0.5) * 0.35;
        m.compose(new THREE.Vector3(x, ph / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(1, ph, 1));
        posts.setMatrixAt(i, m);
        m.makeTranslation(x, ph + 0.2, z);
        tips.setMatrixAt(i, m);
        i++;
      }
    }
    for (const mesh of [posts, tips]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const rail = standard(plankTextures(8, 1), 1);
    for (const [x, z, w, d] of [
      [0, -h, h * 2, 0.12],
      [0, h, h * 2, 0.12],
      [-h, 0, 0.12, h * 2],
      [h, 0, 0.12, h * 2],
    ]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), rail);
      mesh.position.set(x, height * 0.55, z);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }

  private buildBuilding(b: Building): void {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const shrine = b.id === 'shrine';
    const plinth = shrine ? b.height : 0.7;

    const stone = new THREE.Mesh(new THREE.BoxGeometry(w, plinth, d), standard(fieldstoneTextures(Math.max(w, d), plinth), 2));
    stone.position.set(cx, plinth / 2, cz);
    stone.castShadow = stone.receiveShadow = true;
    this.group.add(stone);
    if (!shrine) {
      const upper = b.height - plinth;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, upper, d - 0.1), standard(timberTextures(Math.max(w, d), upper), 1.5, 0.85));
      walls.position.set(cx, plinth + upper / 2, cz);
      walls.castShadow = walls.receiveShadow = true;
      this.group.add(walls);
    }

    // A pitched roof, its ridge along the longer side, overhanging the walls.
    const alongX = w >= d;
    const span = (alongX ? d : w) + 0.9;
    const length = (alongX ? w : d) + 0.9;
    const rise = span * (shrine ? 0.32 : 0.42);
    const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    roofGeo.translate(0, 0, -length / 2);
    const colour: Record<Building['id'], [number, number, number]> = {
      shrine: [92, 96, 118],
      store: [150, 70, 48],
      storehouse: [120, 92, 64],
      tavern: [140, 60, 42],
    };
    const roof = new THREE.Mesh(roofGeo, standard(roofTextures(length, span, colour[b.id], b.id.length * 13 + 7), 1.6, 0.8));
    roof.position.set(cx, b.height, cz);
    if (alongX) roof.rotation.y = Math.PI / 2;
    roof.castShadow = roof.receiveShadow = true;
    this.group.add(roof);

    // The door: planks in a dark frame, standing a little proud of the face it is on.
    const face = b.door.facingYawDeg * DEG;
    const out = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
    const doorW = shrine ? 2.2 : 1.3;
    const doorH = shrine ? 3.2 : 2.3;
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.12), standard(plankTextures(doorW, doorH), 1.2));
    door.position.set(b.door.x, doorH / 2, b.door.z).addScaledVector(out, 0.05);
    door.rotation.y = face;
    door.castShadow = true;
    this.group.add(door);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, 0.22, 0.2), frameMat);
    frame.position.set(b.door.x, doorH + 0.1, b.door.z).addScaledVector(out, 0.06);
    frame.rotation.y = face;
    this.group.add(frame);

    // A painted sign over the door with the building's name.
    const side = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTexture(b.name), roughness: 0.8 }));
    sign.position.set(b.door.x, doorH + 0.75, b.door.z).addScaledVector(out, 0.08);
    sign.rotation.y = face;
    this.group.add(sign);
    this.tierMarks.set(b.id, { flags: this.buildPennants(b, cx, cz, alongX, length, rise, colour[b.id]), sign, name: b.name, tier: 1 });

    if (shrine) this.buildShrineFront(b, out, side);
  }

  /** A row of pennants along the roof's ridge, one a tier; the top tier's is gold. */
  private buildPennants(b: Building, cx: number, cz: number, alongX: boolean, length: number, rise: number, rgb: [number, number, number]): THREE.Object3D[] {
    // Big enough to count from across the square: a 2 m pole and a metre of cloth.
    const pole = new THREE.CylinderGeometry(0.07, 0.07, 2, 6).translate(0, 1, 0);
    const cloth = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.95, 0), new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(1.1, 1.62, 0)]);
    cloth.computeVertexNormals();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
    const tint = new THREE.Color(`rgb(${Math.min(255, rgb[0] + 70)}, ${Math.min(255, rgb[1] + 60)}, ${Math.min(255, rgb[2] + 50)})`);
    const max = tuning.village.maxTier;
    const flags: THREE.Object3D[] = [];
    for (let i = 0; i < max; i++) {
      const top = i === max - 1;
      const mat = new THREE.MeshStandardMaterial({ color: top ? 0xf3c54a : tint, emissive: top ? 0x6a4a10 : 0x000000, roughness: 0.7, side: THREE.DoubleSide });
      const flag = new THREE.Group();
      flag.add(new THREE.Mesh(pole, poleMat), new THREE.Mesh(cloth, mat));
      // Spread along the ridge, the first at the middle and the rest out to either end.
      const along = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * Math.min(1.8, (length - 1.5) / Math.max(1, max));
      flag.position.set(cx + (alongX ? along : 0), b.height + rise - 0.05, cz + (alongX ? 0 : along));
      flag.rotation.y = alongX ? 0 : Math.PI / 2;
      flag.visible = i === 0;
      this.group.add(flag);
      flags.push(flag);
    }
    return flags;
  }

  /** Show each building's tier (P4): its pennants and the numeral on its sign. */
  setTiers(tiers: Record<Building['id'], number>): void {
    for (const [id, m] of this.tierMarks) {
      const tier = tiers[id] ?? 1;
      if (tier === m.tier) continue;
      m.tier = tier;
      m.flags.forEach((f, i) => (f.visible = i < tier));
      m.sign.material.map?.dispose();
      m.sign.material.map = signTexture(tier > 1 ? `${m.name} ${ROMAN[tier] ?? tier}` : m.name);
      m.sign.material.needsUpdate = true;
    }
  }

  /** Two standing stones with violet crystals either side of the shrine's door: the portal's light. */
  private buildShrineFront(b: Building, out: THREE.Vector3, side: THREE.Vector3): void {
    const stoneMat = standard(fieldstoneTextures(1, 4), 2);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xb58aff, emissive: 0x8a5cff, emissiveIntensity: 2.2, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const at = new THREE.Vector3(b.door.x, 0, b.door.z).addScaledVector(out, 1.2).addScaledVector(side, s * 3.2);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.6, 0.8), stoneMat);
      pillar.position.set(at.x, 1.8, at.z);
      pillar.castShadow = true;
      this.group.add(pillar);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), crystalMat);
      crystal.position.set(at.x, 3.95, at.z);
      crystal.scale.y = 1.6;
      this.group.add(crystal);
    }
  }

  private buildWell(x: number, z: number, radius: number): void {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, 0.9, 20, 1, true), standard(fieldstoneTextures(radius * 6, 0.9), 2));
    ring.position.set(x, 0.45, z);
    ring.castShadow = ring.receiveShadow = true;
    (ring.material as THREE.Material).side = THREE.DoubleSide;
    this.group.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 20), new THREE.MeshStandardMaterial({ color: 0x23404a, roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.55, z);
    this.group.add(water);
    const wood = standard(plankTextures(1, 2), 1);
    const roofMat = standard(roofTextures(2, 2, [120, 92, 64], 99), 1.4);
    // The roof and its posts fade when they stand between the camera and the hero (collider "well").
    this.trees.set('well', { mats: [wood, roofMat], opacity: 1 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), wood);
      post.position.set(x + s * radius * 0.95, 1.1, z);
      post.castShadow = true;
      this.group.add(post);
    }
    const shape = new THREE.Shape([new THREE.Vector2(-radius * 1.3, 0), new THREE.Vector2(radius * 1.3, 0), new THREE.Vector2(0, 0.8)]);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: radius * 1.6, bevelEnabled: false });
    roofGeo.translate(0, 0, -radius * 0.8);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 2.2, z);
    roof.castShadow = true;
    this.group.add(roof);
  }

  /** A wood beyond the fence, so the square sits in a clearing rather than on a plate. */
  private buildWood(h: number): void {
    const rand = rng(91);
    const spots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = h + 4 + rand() * 22;
      spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.9 + rand() * 0.8 });
    }
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1, 6), trunkMat, spots.length);
    const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), leafMat, spots.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const greens = [0x4f7a2e, 0x5f8a34, 0x7a8f30, 0xa08a2c, 0x3f6a2a];
    spots.forEach((t, i) => {
      const th = 2.6 * t.s;
      m.compose(new THREE.Vector3(t.x, th / 2, t.z), q, new THREE.Vector3(t.s, th, t.s));
      trunks.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        const r = (1.5 - k * 0.4) * t.s;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6);
        m.compose(new THREE.Vector3(t.x + (rand() - 0.5) * 0.6, th + r * (0.6 + k * 0.9), t.z + (rand() - 0.5) * 0.6), q, new THREE.Vector3(r, r * 0.9, r));
        leaves.setMatrixAt(i * 2 + k, m);
        leaves.setColorAt(i * 2 + k, new THREE.Color(greens[Math.floor(rand() * greens.length)]));
      }
    });
    for (const mesh of [trunks, leaves]) {
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }

  /** One tree inside the fence: its own materials, so it can fade when it hides the hero. */
  private buildTree(x: number, z: number, s: number, seed: number, id: string): void {
    const rand = rng(200 + seed);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: [0x5f8a34, 0x7a8f30, 0x4f7a2e][seed % 3], roughness: 0.9, flatShading: true });
    const th = 2.8 * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, th, 6), trunkMat);
    trunk.position.set(x, th / 2, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    for (let k = 0; k < 3; k++) {
      const r = (1.6 - k * 0.35) * s;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
      leaf.position.set(x + (rand() - 0.5) * 0.9, th + r * (0.5 + k * 0.7), z + (rand() - 0.5) * 0.9);
      leaf.castShadow = true;
      this.group.add(leaf);
    }
    this.trees.set(id, { mats: [trunkMat, leafMat], opacity: 1 });
  }

  /** Barrels and crates by the store and the storehouse, a bench by the tavern. */
  private buildProps(): void {
    const wood = standard(plankTextures(1, 1), 1);
    const barrel = (x: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 10), wood);
      mesh.position.set(x, 0.475, z);
      mesh.castShadow = true;
      this.group.add(mesh);
    };
    const crate = (x: number, z: number, s: number, yaw: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), wood);
      mesh.position.set(x, s / 2, z);
      mesh.rotation.y = yaw;
      mesh.castShadow = true;
      this.group.add(mesh);
    };
    barrel(10.4, -0.4);
    barrel(10.6, 0.5);
    crate(10.5, -8.2, 0.8, 0.3);
    crate(-10.4, -0.6, 0.9, -0.2);
    crate(-10.5, 0.4, 0.6, 0.5);
    barrel(-10.4, -8.4);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 2.2), wood);
    bench.position.set(-7.4, 0.225, 9);
    bench.castShadow = true;
    this.group.add(bench);
  }
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** A sign board: the name in warm paint on dark wood, drawn small for the pixel look. */
function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2416';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#1e120a';
  g.lineWidth = 4;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.font = "700 22px Georgia, 'Times New Roman', serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f3d79a';
  // A long name with its tier ("General Store III") is squeezed to the board rather than cut off.
  g.fillText(text, c.width / 2, c.height / 2 + 1, c.width - 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
