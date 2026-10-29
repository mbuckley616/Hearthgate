import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { World } from '@hearthgate/shared/level/arena';
import type { Building, InteriorDef, Villager } from '@hearthgate/shared/level/village';
import { createPlayer } from '@hearthgate/shared/sim/player';
import type { PlayerState } from '@hearthgate/shared/sim/types';
import { HeroView } from './HeroView';
import { Nameplate } from './Nameplate';
import { glowMaterial, type Palette } from './props';
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
  /** Candle and hearth light in the interiors, wobbling a little each frame. */
  private flickers: { light: THREE.PointLight; base: number; amount: number; seed: number }[] = [];
  private clock = 0;
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
    for (const r of v.interiors) this.buildInterior(r);

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
    this.clock += dt;
    for (const f of this.flickers) {
      const t = this.clock * 9 + f.seed;
      f.light.intensity = f.base * (1 + f.amount * (Math.sin(t) * 0.5 + Math.sin(t * 2.3 + 1.7) * 0.3 + Math.sin(t * 5.1) * 0.2));
    }
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

  /**
   * A building's inside (Michael, 28 Oct: each matching its use, each its own). Walls and floor in the
   * building's own materials and light, its furniture (the colliders) drawn as what it is, then its
   * dressing. Walls fade like a dungeon's (registered by their collider ids), and a dark shell hides
   * the sky and the woods. Firelight flickers (update).
   */
  private buildInterior(r: InteriorDef): void {
    const cx = (r.minX + r.maxX) / 2;
    const cz = (r.minZ + r.maxZ) / 2;
    const w = r.maxX - r.minX;
    const d = r.maxZ - r.minZ;
    const H = 4;
    const t = 0.4;
    const style = INTERIOR_STYLE[r.building];
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w + 30, 24, d + 30), new THREE.MeshBasicMaterial({ color: 0x06040a, side: THREE.BackSide, fog: false }));
    shell.position.set(cx, 8, cz);
    this.group.add(shell);

    const floorTex = style.floor === 'stone' ? fieldstoneTextures(w, d) : plankTextures(w, d);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * t, d + 2 * t).rotateX(-Math.PI / 2), standard(floorTex, 1.2));
    floor.material.color.setHex(style.floorTint);
    floor.position.set(cx, 0.01, cz);
    floor.receiveShadow = true;
    this.group.add(floor);

    const wallTex = style.walls === 'stone' ? fieldstoneTextures(6, H) : style.walls === 'timber' ? timberTextures(6, H) : plankTextures(6, H);
    const wallMat = standard(wallTex, 1.6);
    wallMat.color.setHex(style.wallTint);
    const half = r.doorWidth / 2;
    const walls: [string, number, number, number, number][] = [
      ['wall-n', r.minX - t, r.maxX + t, r.minZ - t, r.minZ],
      ['wall-w', r.minX - t, r.minX, r.minZ, r.maxZ],
      ['wall-e', r.maxX, r.maxX + t, r.minZ, r.maxZ],
      ['wall-sw', r.minX - t, r.doorX - half, r.maxZ, r.maxZ + t],
      ['wall-se', r.doorX + half, r.maxX + t, r.maxZ, r.maxZ + t],
    ];
    for (const [id, x0, x1, z0, z1] of walls) {
      const mat = wallMat.clone();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, H, z1 - z0), mat);
      mesh.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      this.trees.set(`interior-${r.building}-${id}`, { mats: [mat], opacity: 1 });
    }
    // The way out: a timber frame and the square's daylight beyond it.
    const timber = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
    for (const s of [-1, 1]) this.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.5), timber), r.doorX + s * (half + 0.12), 1.5, r.maxZ + t / 2);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(r.doorWidth + 0.5, 0.3, 0.5), timber), r.doorX, 3, r.maxZ + t / 2);
    const day = new THREE.Mesh(new THREE.PlaneGeometry(r.doorWidth, 2.85), new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false }));
    day.rotation.y = Math.PI;
    this.add(day, r.doorX, 1.43, r.maxZ + t + 0.02);

    for (const f of r.furniture) {
      if (CUSTOM_FURNITURE.has(f.id)) continue;
      const mat = f.id === 'vault' ? IRON() : f.id === 'hearth' ? standard(fieldstoneTextures(2, 2), 2) : standard(plankTextures(2, 1), 1);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(f.maxX - f.minX, f.height, f.maxZ - f.minZ), mat);
      mesh.castShadow = mesh.receiveShadow = true;
      this.add(mesh, (f.minX + f.maxX) / 2, f.height / 2, (f.minZ + f.maxZ) / 2);
    }
    const byId = (id: string) => r.furniture.find((f) => f.id === id)!;
    if (r.building === 'shrine') this.buildShrineInside(r, cx, byId);
    if (r.building === 'store') this.buildStoreInside(byId);
    if (r.building === 'storehouse') this.buildStorehouseInside(r, byId);
    if (r.building === 'tavern') this.buildTavernInside(r, byId);
  }

  /** Put a mesh at a place in the group. */
  private add<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
    o.position.set(x, y, z);
    this.group.add(o);
    return o;
  }

  /** A point light; flickering ones (candles, a hearth) wobble in update. */
  private light(colour: number, intensity: number, distance: number, x: number, y: number, z: number, flicker = 0): void {
    const l = new THREE.PointLight(colour, intensity, distance, 1.5);
    this.add(l, x, y, z);
    if (flicker > 0) this.flickers.push({ light: l, base: intensity, amount: flicker, seed: x * 3.1 + z * 1.7 });
  }

  private candle(x: number, y: number, z: number, h = 0.22): void {
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, h, 8), WAX()), x, y + h / 2, z);
    const f = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), FLAME()), x, y + h + 0.05, z);
    f.scale.y = 1.8;
  }

  /** A barrel standing up (or lying, for a keg on its rack), hooped in iron. */
  private barrel(x: number, y: number, z: number, lying = false, scale = 1): THREE.Group {
    const g = new THREE.Group();
    const staves = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * scale, 0.36 * scale, 0.95 * scale, 14), new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85 }));
    g.add(staves);
    for (const dy of [-0.32, 0.32]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.37 * scale, 0.025, 6, 18).rotateX(Math.PI / 2), IRON());
      hoop.position.y = dy * scale;
      g.add(hoop);
    }
    if (lying) g.rotation.z = Math.PI / 2;
    g.traverse((c) => (c.castShadow = true));
    return this.add(g, x, y, z);
  }

  /** Rows of coloured spines along a shelf's face toward the room. */
  private buildBooks(f: InteriorDef['furniture'][number]): void {
    const colours = [0x6a2a2a, 0x2a4a6a, 0x5a4a1a, 0x3a5a2a, 0x4a2a5a, 0x7a5a2a];
    const rand = rng(f.minX * 31 + f.minZ);
    const faceX = Math.abs(f.minX) < Math.abs(f.maxX) ? f.minX - 0.01 : f.maxX + 0.01;
    const inward = faceX === f.minX - 0.01 ? -1 : 1;
    for (const y of [0.55, 1.25, 1.95]) {
      for (let z = f.minZ + 0.2; z < f.maxZ - 0.2; ) {
        const width = 0.08 + rand() * 0.1;
        const tall = 0.35 + rand() * 0.2;
        this.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, tall, width), new THREE.MeshStandardMaterial({ color: colours[Math.floor(rand() * colours.length)], roughness: 0.8 })), faceX + inward * 0.03, y + tall / 2, z + width / 2);
        z += width + 0.01;
      }
    }
  }

  /** Wren's orb on her table, candles, a rune circle on the floor and crystals in the corners: the portal's light. */
  private buildShrineInside(r: InteriorDef, cx: number, byId: (id: string) => InteriorDef['furniture'][number]): void {
    this.buildBooks(byId('shelf-w'));
    this.buildBooks(byId('shelf-e'));
    const table = byId('wren-table');
    const tz = (table.minZ + table.maxZ) / 2;
    const top = table.height;
    this.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshStandardMaterial({ color: 0xb58aff, emissive: 0x8a5cff, emissiveIntensity: 1.3, roughness: 0.2 })), cx, top + 0.42, tz);
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.12, 10), BRASS()), cx, top + 0.06, tz);
    this.light(0xa070ff, 4, 9, cx, top + 0.8, tz + 0.4, 0.08);
    for (const [dx, h] of [[-1.05, 0.26], [-0.85, 0.18], [0.9, 0.3], [1.1, 0.2]] as const) this.candle(cx + dx, top, tz + 0.15, h);
    for (const s of [-1, 1]) {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 })), cx + s * 3.6, 0.7, tz + 1.6);
      for (const dx of [-0.1, 0.1]) this.candle(cx + s * 3.6 + dx, 1.4, tz + 1.6, 0.24);
      this.light(0xffa850, 7, 9, cx + s * 3.6, 2, tz + 1.6, 0.18);
    }
    // A rune circle where a visitor stands before her.
    this.add(new THREE.Mesh(new THREE.RingGeometry(1.25, 1.35, 48).rotateX(-Math.PI / 2), glowMaterial(0x9a6aff, 0.55)), cx, 0.03, tz + 2.4);
    this.add(new THREE.Mesh(new THREE.RingGeometry(0.85, 0.9, 6).rotateX(-Math.PI / 2), glowMaterial(0x9a6aff, 0.4)), cx, 0.03, tz + 2.4);
    const crystal = new THREE.MeshStandardMaterial({ color: 0xb58aff, emissive: 0x8a5cff, emissiveIntensity: 1.8, roughness: 0.3 });
    for (const x of [r.minX + 0.9, r.maxX - 0.9]) this.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.45), crystal), x, 0.8, r.minZ + 0.9).scale.y = 1.8;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2, r.maxZ - tz - 1.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a1f5a, roughness: 1 }));
    rug.receiveShadow = true;
    this.add(rug, cx, 0.02, (r.maxZ + tz + 1.2) / 2);
  }

  /**
   * Aldous's shop: a counter with scales and a till, shelves behind it of jars, bottles and boxed
   * goods, a rack of arms on the east wall, barrels and sacks by the west, lanterns hung low.
   */
  private buildStoreInside(byId: (id: string) => InteriorDef['furniture'][number]): void {
    const counter = byId('counter');
    const ccx = (counter.minX + counter.maxX) / 2;
    const ccz = (counter.minZ + counter.maxZ) / 2;
    const top = counter.height;
    // The counter's top, darker, and on it the scales and a stack of coin.
    this.add(new THREE.Mesh(new THREE.BoxGeometry(counter.maxX - counter.minX + 0.1, 0.06, counter.maxZ - counter.minZ + 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 })), ccx, top + 0.03, ccz);
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), BRASS()), ccx - 1.6, top + 0.3, ccz);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.03), BRASS()), ccx - 1.6, top + 0.55, ccz);
    for (const s of [-1, 1]) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.04, 10), BRASS()), ccx - 1.6 + s * 0.33, top + 0.38, ccz);
    for (let i = 0; i < 5; i++) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), GOLD()), ccx + 1.4 + (i % 2) * 0.03, top + 0.07 + i * 0.022, ccz + 0.1);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 })), ccx + 2.2, top + 0.15, ccz);

    // Goods on the shelves behind him: three boards of jars, bottles and boxes.
    const shelf = byId('shelf-n');
    const rand = rng(77);
    const jarColours = [0x7a9a6a, 0xa87a4a, 0x6a7aa8, 0xc8b88a, 0x8a4a3a];
    for (const y of [0.7, 1.5, 2.3]) {
      this.add(new THREE.Mesh(new THREE.BoxGeometry(shelf.maxX - shelf.minX, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 })), (shelf.minX + shelf.maxX) / 2, y, shelf.maxZ + 0.25);
      for (let x = shelf.minX + 0.3; x < shelf.maxX - 0.3; x += 0.32 + rand() * 0.2) {
        const kind = rand();
        const colour = jarColours[Math.floor(rand() * jarColours.length)];
        if (kind < 0.45) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 10), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.4 })), x, y + 0.16, shelf.maxZ + 0.25);
        else if (kind < 0.75) {
          this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.2, transparent: true, opacity: 0.85 })), x, y + 0.18, shelf.maxZ + 0.25);
          this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22 })), x, y + 0.38, shelf.maxZ + 0.25);
        } else this.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 })), x, y + 0.14, shelf.maxZ + 0.25);
      }
    }

    // The rack of arms: swords upright, bows hung, a shield.
    const rack = byId('rack-e');
    const rx = rack.minX - 0.05;
    for (let i = 0; i < 4; i++) {
      const z = rack.minZ + 0.6 + i * 0.5;
      this.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.09), STEEL()), rx, 1.35, z);
      this.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), BRASS()), rx, 0.8, z);
    }
    for (const z of [rack.minZ + 2.9, rack.minZ + 3.6]) {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.7 }));
      bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
      this.add(bow, rx, 1.4, z);
    }
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.7 }));
    this.add(shield, rx, 1.5, rack.maxZ - 0.45);

    // Barrels and sacks by the west wall, a rug before the counter.
    const barrels = byId('barrels-w');
    for (const [x, z] of [
      [barrels.minX + 0.45, barrels.minZ + 0.45],
      [barrels.minX + 0.45, barrels.minZ + 1.3],
      [barrels.minX + 1.15, barrels.minZ + 0.85],
    ])
      this.barrel(x, 0.48, z);
    const sack = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 });
    for (const [x, z] of [
      [barrels.minX + 0.4, barrels.maxZ - 0.6],
      [barrels.minX + 1.1, barrels.maxZ - 0.4],
    ])
      this.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), sack), x, 0.3, z).scale.set(1, 0.85, 0.8);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a3a22, roughness: 1 }));
    rug.receiveShadow = true;
    this.add(rug, ccx, 0.02, counter.maxZ + 1.6);
    // Two lanterns over the counter: warm, steady.
    for (const dx of [-2, 2]) {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), IRON()), ccx + dx, 3.4, ccz + 0.8);
      this.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: 0xffd090, emissive: 0xffa040, emissiveIntensity: 1.4 })), ccx + dx, 2.9, ccz + 0.8);
      this.light(0xffc070, 8, 10, ccx + dx, 2.7, ccz + 0.8, 0.04);
    }
  }

  /**
   * Marta's storehouse: racks of crates and chests down both walls, stacks in the corners, the
   * strongroom's iron vault behind her ledger desk; cool lantern light, the one candle on her desk.
   */
  private buildStorehouseInside(r: InteriorDef, byId: (id: string) => InteriorDef['furniture'][number]): void {
    const rand = rng(53);
    const crate = (x: number, y: number, z: number, s: number) => {
      const c = this.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), standard(plankTextures(1, 1), 1)), x, y + s / 2, z);
      c.rotation.y = (rand() - 0.5) * 0.3;
      c.castShadow = c.receiveShadow = true;
    };
    for (const id of ['rack-w', 'rack-e']) {
      const rack = byId(id);
      const rx = (rack.minX + rack.maxX) / 2;
      for (const y of [0, 1, 2]) {
        this.add(new THREE.Mesh(new THREE.BoxGeometry(rack.maxX - rack.minX + 0.1, 0.06, rack.maxZ - rack.minZ), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 })), rx, y + 0.03, (rack.minZ + rack.maxZ) / 2);
        for (let z = rack.minZ + 0.5; z < rack.maxZ - 0.4; z += 0.9 + rand() * 0.3) {
          if (rand() < 0.75) crate(rx, y + 0.06, z, 0.55 + rand() * 0.25);
          else this.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0x5a2e1a, roughness: 0.8 })), rx, y + 0.3, z);
        }
      }
    }
    for (const id of ['crates-nw', 'crates-ne']) {
      const c = byId(id);
      const w = c.maxX - c.minX;
      crate(c.minX + w * 0.3, 0, c.minZ + 0.6, 1);
      crate(c.minX + w * 0.72, 0, c.minZ + 0.8, 0.9);
      if (c.height > 1.4) crate(c.minX + w * 0.4, 1, c.minZ + 0.6, 0.6);
    }
    // The vault's door: a wheel and rivets in its iron face.
    const vault = byId('vault');
    const vx = (vault.minX + vault.maxX) / 2;
    const face = vault.maxZ + 0.02;
    this.add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 20), BRASS()), vx, 1.3, face);
    for (let i = 0; i < 4; i++) {
      const spoke = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.04), BRASS()), vx, 1.3, face);
      spoke.rotation.z = (i * Math.PI) / 4;
    }
    for (const [dx, y] of [
      [-1.2, 0.3],
      [1.2, 0.3],
      [-1.2, 2.1],
      [1.2, 2.1],
    ])
      this.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), IRON()), vx + dx, y, face);
    // Her desk: a ledger, a quill, a candle.
    const desk = byId('desk');
    const dx = (desk.minX + desk.maxX) / 2;
    const dz = (desk.minZ + desk.maxZ) / 2;
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.42), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 })), dx - 0.3, desk.height + 0.03, dz);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 })), dx + 0.15, desk.height + 0.06, dz).rotation.y = 0.5;
    this.candle(dx + 0.9, desk.height, dz, 0.2);
    this.light(0xffb060, 3, 5, dx + 0.9, desk.height + 0.5, dz, 0.2);
    // Lanterns on the walls: cool, a storehouse's light.
    for (const [x, z] of [
      [r.minX + 1.4, -1],
      [r.maxX - 1.4, -1],
      [(r.minX + r.maxX) / 2, r.minZ + 2.2],
    ]) {
      this.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), new THREE.MeshStandardMaterial({ color: 0xd8e8ff, emissive: 0x88a8d8, emissiveIntensity: 1.2 })), x, 2.8, z);
      this.light(0xb8d0ff, 6, 10, x, 2.6, z);
    }
  }

  /**
   * Old Fenn's tavern, the Rusted Stag (Michael's mockup): the bar with mugs and the kegs behind it,
   * a hearth burning on the west wall, tables and stools, a ring of candles overhead, the stag's
   * head over the kegs and the order's banners either side of it.
   */
  private buildTavernInside(r: InteriorDef, byId: (id: string) => InteriorDef['furniture'][number]): void {
    const cx = (r.minX + r.maxX) / 2;
    const bar = byId('bar');
    const bz = (bar.minZ + bar.maxZ) / 2;
    this.add(new THREE.Mesh(new THREE.BoxGeometry(bar.maxX - bar.minX + 0.2, 0.08, bar.maxZ - bar.minZ + 0.2), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.5 })), cx, bar.height + 0.04, bz);
    const mug = (x: number, y: number, z: number) => {
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 })), x, y + 0.08, z);
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0xf0e8d0 })), x, y + 0.165, z);
    };
    for (const x of [-3, -2.6, 1.8, 3.1]) mug(cx + x, bar.height + 0.08, bz + 0.1);
    // Kegs on their side behind the bar, a tap each.
    const kegs = byId('kegs');
    for (let i = 0; i < 4; i++) {
      const x = kegs.minX + 0.9 + i * 1.75;
      this.barrel(x, 0.5, kegs.minZ + 0.6, true, 1.1);
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6).rotateX(Math.PI / 2), BRASS()), x, 0.5, kegs.maxZ + 0.08);
    }
    // The stag's head over the kegs, on a shield-shaped plaque, and a banner either side.
    const wallZ = r.minZ + 0.02;
    this.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 })), cx, 3, wallZ + 0.05);
    const hide = new THREE.MeshStandardMaterial({ color: 0x8a5a38, roughness: 0.9 });
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.6), hide), cx, 2.95, wallZ + 0.4);
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.4), hide), cx, 2.8, wallZ + 0.8);
    const antler = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const a = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 6), antler), cx + s * 0.35, 3.55, wallZ + 0.35);
      a.rotation.z = -s * 0.6;
      for (const k of [0.25, 0.5]) {
        const tine = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 5), antler), cx + s * (0.3 + k * 0.5), 3.4 + k * 0.6, wallZ + 0.35);
        tine.rotation.z = s * 0.4;
      }
    }
    for (const s of [-1, 1]) {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2), new THREE.MeshStandardMaterial({ color: 0x2a3a7a, roughness: 0.9, side: THREE.DoubleSide }));
      this.add(banner, cx + s * 3, 2.6, wallZ + 0.04);
      this.add(new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 16), new THREE.MeshBasicMaterial({ color: 0xd8b25a, side: THREE.DoubleSide })), cx + s * 3, 2.8, wallZ + 0.06);
    }
    // The hearth: a fire in its mouth, its light flickering over the room.
    const hearth = byId('hearth');
    const hz = (hearth.minZ + hearth.maxZ) / 2;
    const mouth = hearth.maxX + 0.01;
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0c06 })), mouth, 0.55, hz);
    const fire = new THREE.MeshBasicMaterial({ color: 0xffa030 });
    for (const [dz, h] of [
      [-0.4, 0.5],
      [0, 0.7],
      [0.4, 0.45],
    ])
      this.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, h, 6), fire), mouth + 0.25, 0.12 + h / 2, hz + dz);
    for (let i = 0; i < 3; i++) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a2010 })), mouth + 0.3, 0.1, hz + (i - 1) * 0.15).rotation.y = i * 0.5;
    this.light(0xff8a30, 12, 12, mouth + 0.8, 1, hz, 0.3);
    this.fireSources.push(new THREE.Vector3(mouth + 0.3, 0.6, hz));
    // Tables with stools and a mug or two.
    const stool = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    for (const id of ['table-a', 'table-b', 'table-c']) {
      const tb = byId(id);
      const tx = (tb.minX + tb.maxX) / 2;
      const tz = (tb.minZ + tb.maxZ) / 2;
      for (const [sx, sz] of [
        [-1.15, 0],
        [1.15, 0],
        [0, 1.15],
      ])
        this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 8), stool), tx + sx, 0.25, tz + sz);
      mug(tx - 0.3, tb.height, tz + 0.2);
      if (id !== 'table-b') this.candle(tx + 0.3, tb.height, tz - 0.2, 0.14);
    }
    // A ring of candles hung over the room.
    const ringY = 3.3;
    const ringZ = (r.minZ + r.maxZ) / 2 + 1.5;
    this.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 6, 24).rotateX(Math.PI / 2), IRON()), cx, ringY, ringZ);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.candle(cx + Math.cos(a) * 1.2, ringY, ringZ + Math.sin(a) * 1.2, 0.18);
    }
    this.light(0xffb060, 9, 14, cx, ringY - 0.3, ringZ, 0.1);
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

/** Furniture an interior's dressing draws itself rather than as a plain box. */
const CUSTOM_FURNITURE = new Set(['barrels-w', 'kegs', 'crates-nw', 'crates-ne']);

/** Each inside in its building's own materials (Michael, 28 Oct: each matching its use, each its own). */
const INTERIOR_STYLE: Record<Building['id'], { floor: 'plank' | 'stone'; floorTint: number; walls: 'stone' | 'timber' | 'plank'; wallTint: number }> = {
  shrine: { floor: 'plank', floorTint: 0x8a7a7a, walls: 'stone', wallTint: 0x9a8aa8 },
  store: { floor: 'plank', floorTint: 0xb89a7a, walls: 'timber', wallTint: 0xe0d0b8 },
  storehouse: { floor: 'stone', floorTint: 0x8a8a90, walls: 'plank', wallTint: 0x8a7a68 },
  tavern: { floor: 'plank', floorTint: 0x9a7452, walls: 'timber', wallTint: 0xb89878 },
};

// Made once each the first time an interior asks: the materials its props share.
const once = <T,>(make: () => T) => {
  let made: T | null = null;
  return () => (made ??= make());
};
const IRON = once(() => new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 }));
const BRASS = once(() => new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.7 }));
const GOLD = once(() => new THREE.MeshStandardMaterial({ color: 0xe8c050, roughness: 0.3, metalness: 0.8 }));
const STEEL = once(() => new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.8 }));
const WAX = once(() => new THREE.MeshStandardMaterial({ color: 0xeee0c8, roughness: 0.7 }));
const FLAME = once(() => new THREE.MeshBasicMaterial({ color: 0xffc060 }));

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
