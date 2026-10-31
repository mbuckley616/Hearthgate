import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { World } from '@hearthgate/shared/level/arena';
import type { PieceInfo } from '@hearthgate/shared/level/floor';
import type { Collider } from '@hearthgate/shared/level/geometry';
import { DOOR_H } from '@hearthgate/shared/level/kit';
import { buildBrazier } from './decor';
import { floorTextures, pillarTextures, wallTextures } from './textures';

const DEG = Math.PI / 180;
/** Point lights are costly per material; a few follow the hero to the nearest fires instead of one per torch. */
const LIGHTS = 10;
/** Floor and wall textures span this many metres; geometry UVs are in metres over it, so every block shares one texture. */
const FLOOR_TILE = 4;
const WALL_TILE = 3;

interface Fader {
  materials: THREE.MeshStandardMaterial[];
  opacity: number;
}

interface Fire {
  pos: THREE.Vector3;
  flame: THREE.Mesh;
  phase: number;
  /** Braziers burn a little weaker and shorter than torches. */
  scale: number;
}

interface Gate {
  group: THREE.Group;
  /** Raised (0) to down (1). */
  drop: number;
}

/**
 * A generated dungeon floor (T4): every piece's floor block at its height, the staircases' ramps,
 * the walls and lintels from the floor's colliders, pillars, braziers, wall torches, and a
 * portcullis in each doorway of a fight room that drops while the room is shut. No ceiling, like
 * the arena: the camera looks over the walls, which fade when they hide the hero. Built once per
 * floor; update() only moves the gates, the lights and the fades.
 */
export class FloorView {
  readonly group = new THREE.Group();
  /** Where fires burn (torch flames and brazier bowls), for embers. */
  readonly fireSources: THREE.Vector3[] = [];
  private faders = new Map<string, Fader>();
  private fires: Fire[] = [];
  private lights: { light: THREE.PointLight; fire: Fire | null }[] = [];
  private gates = new Map<number, Gate[]>();
  private shut = -1;
  private focus = new THREE.Vector3();
  private relightIn = 0;
  private colliderDebug: THREE.Group;
  /** The lava's one material (D6): its crust drifts and its glow breathes. */
  private lava: THREE.MeshBasicMaterial | null = null;

  constructor(world: World) {
    const layout = world.level.dungeon!;
    const floorTex = floorTextures(FLOOR_TILE);
    const wallTex = wallTextures(WALL_TILE, WALL_TILE);
    const floorMat = (tint: number) => new THREE.MeshStandardMaterial({ map: floorTex.map, bumpMap: floorTex.bump, bumpScale: 1.5, roughness: 0.92, metalness: 0, color: tint });
    const wallMat = () => new THREE.MeshStandardMaterial({ map: wallTex.map, bumpMap: wallTex.bump, bumpScale: 2, roughness: 0.95 });
    // The rest room reads warm and the Warden's hall dark red; everything else is the arena's stone.
    const floors = { stone: floorMat(0xffffff), rest: floorMat(0xffd9a8), boss: floorMat(0xc98a80) };
    const sideMat = wallMat();

    for (const p of layout.pieces) this.buildPieceFloor(p, p.kind === 'rest' ? floors.rest : p.kind === 'boss' ? floors.boss : floors.stone, sideMat);

    // Walls and lintels: each a block with its own material, so it can fade on its own.
    for (const c of world.colliders) {
      if (c.kind !== 'box' || !/^(wall|lintel)-/.test(c.id)) continue;
      const mat = wallMat();
      const mesh = new THREE.Mesh(boxGeometry(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z, WALL_TILE), mat);
      mesh.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.faders.set(c.id, { materials: [mat], opacity: 1 });
    }

    // Portcullises in the fight rooms' doorways.
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a28, metalness: 0.7, roughness: 0.5 });
    world.roomColliders?.forEach((cs, room) => {
      const gates = cs.filter((c) => c.id.startsWith('gate-'));
      if (gates.length) this.gates.set(room, gates.map((g) => this.buildGate(g, layout.pieces[room].y, iron)));
    });

    // Pillars: shaft plus a plinth and capital, sharing one material so they fade together.
    for (const p of layout.pieces) {
      p.pillars.forEach((pl, i) => {
        const h = 5.5;
        const pt = pillarTextures(2 * Math.PI * pl.radius, h);
        const mat = new THREE.MeshStandardMaterial({ map: pt.map, bumpMap: pt.bump, bumpScale: 2, roughness: 0.9 });
        const pillar = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(pl.radius, pl.radius, h, 16), mat);
        shaft.position.y = h / 2;
        const ring = (y: number, hgt: number, scale: number) => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(pl.radius * scale, pl.radius * scale, hgt, 16), mat);
          m.position.y = y;
          return m;
        };
        pillar.add(shaft, ring(0.2, 0.4, 1.3), ring(h - 0.2, 0.4, 1.3));
        pillar.position.set(pl.x, p.y, pl.z);
        pillar.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
        });
        this.group.add(pillar);
        this.faders.set(`pillar-${p.id}-${i}`, { materials: [mat], opacity: 1 });
      });
      for (const b of p.braziers) {
        const { group, flame } = buildBrazier(tuning.look.torchColor);
        group.position.set(b.x, p.y, b.z);
        this.group.add(group);
        this.addFire(new THREE.Vector3(b.x, p.y + 1.6, b.z), flame, 0.8);
        this.fireSources.push(new THREE.Vector3(b.x, p.y + 1.3, b.z));
      }
    }

    // Torches: iron bracket and an emissive flame; the light comes from the pool.
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.6, metalness: 0.6 });
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.45);
    const cupGeo = new THREE.CylinderGeometry(0.12, 0.07, 0.18, 8);
    const flameGeo = new THREE.ConeGeometry(0.1, 0.32, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tuning.look.torchColor).multiplyScalar(4), toneMapped: false });
    for (const tc of layout.torches) {
      const yaw = tc.facingYawDeg * DEG;
      const out = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const root = new THREE.Group();
      root.position.set(tc.x, tc.y, tc.z);
      root.rotation.y = yaw;
      const arm = new THREE.Mesh(armGeo, bracketMat);
      arm.position.set(0, 0, 0.22);
      const cup = new THREE.Mesh(cupGeo, bracketMat);
      cup.position.set(0, 0.08, 0.45);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 0.32, 0.45);
      root.add(arm, cup, flame);
      this.group.add(root);
      this.addFire(new THREE.Vector3(tc.x, tc.y + 0.4, tc.z).addScaledVector(out, 0.7), flame, 1);
      this.fireSources.push(new THREE.Vector3(tc.x, tc.y + 0.4, tc.z).addScaledVector(out, 0.45));
    }
    for (let i = 0; i < LIGHTS; i++) {
      const light = new THREE.PointLight(tuning.look.torchColor, 0, tuning.look.torchRange, 2);
      this.group.add(light);
      this.lights.push({ light, fire: null });
    }

    // Lava (D6): a molten strip just above the floor, glowing past the tone map, and a light from each.
    if (layout.lava.length) {
      const tex = lavaTexture();
      this.lava = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.25, 1.1), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const spark = new THREE.Mesh();
      for (const l of layout.lava) {
        const w = l.maxX - l.minX;
        const d = l.maxZ - l.minZ;
        const geo = new THREE.PlaneGeometry(w, d);
        // A metre of texture to every two metres of strip, whatever its size.
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * d) / 2);
        const mesh = new THREE.Mesh(geo, this.lava);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((l.minX + l.maxX) / 2, l.y + 0.03, (l.minZ + l.maxZ) / 2);
        this.group.add(mesh);
        this.addFire(new THREE.Vector3(mesh.position.x, l.y + 0.6, mesh.position.z), spark, 1.3);
      }
    }

    this.colliderDebug = buildColliderDebug([...world.colliders, ...[...(world.roomColliders ?? [])].flat().filter((c) => c.id.startsWith('gate-'))]);
    this.colliderDebug.visible = false;
    this.group.add(this.colliderDebug);
  }

  /** Which fight room is shut (-1 for none), and where the hero is, for the nearest fires' lights. */
  sync(shutRoom: number, focus: THREE.Vector3): void {
    this.shut = shutRoom;
    this.focus.copy(focus);
  }

  update(dt: number, time: number, occluders: ReadonlySet<string>, _gateClosed = false): void {
    // Gates drop fast and rise slowly, and vanish once up: the walls are lower than a raised portcullis.
    for (const [room, gates] of this.gates) {
      const down = room === this.shut;
      for (const g of gates) {
        g.drop += ((down ? 1 : 0) - g.drop) * (1 - Math.exp(-(down ? 9 : 1.5) * dt));
        g.group.visible = g.drop > 0.02;
        g.group.position.y = (1 - g.drop) * DOOR_H;
      }
    }

    const cam = tuning.camera;
    const k = 1 - Math.exp(-cam.occluderFadeRate * dt);
    for (const [id, f] of this.faders) {
      const target = occluders.has(id) ? cam.occluderOpacity : 1;
      if (f.opacity === target) continue;
      f.opacity += (target - f.opacity) * k;
      if (Math.abs(f.opacity - target) < 0.002) f.opacity = target;
      const transparent = f.opacity < 0.999;
      for (const m of f.materials) {
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.depthWrite = !transparent;
          m.needsUpdate = true;
        }
        m.opacity = f.opacity;
      }
    }

    // The light pool follows the hero a few times a second.
    this.relightIn -= dt;
    if (this.relightIn <= 0) {
      this.relightIn = 0.25;
      const near = [...this.fires].sort((a, b) => a.pos.distanceToSquared(this.focus) - b.pos.distanceToSquared(this.focus)).slice(0, LIGHTS);
      this.lights.forEach((l, i) => {
        l.fire = near[i] ?? null;
        if (l.fire) l.light.position.copy(l.fire.pos);
      });
    }
    const look = tuning.look;
    for (const f of this.fires) {
      const s = time + f.phase;
      const n = Math.sin(s * 7.3) * 0.5 + Math.sin(s * 13.1 + 1.7) * 0.3 + Math.sin(s * 23.7 + 4.1) * 0.2;
      f.flame.scale.set(1, 1 + n * look.torchFlicker * 1.5, 1);
    }
    for (const l of this.lights) {
      if (!l.fire) {
        l.light.intensity = 0;
        continue;
      }
      const s = time + l.fire.phase;
      const n = Math.sin(s * 7.3) * 0.5 + Math.sin(s * 13.1 + 1.7) * 0.3 + Math.sin(s * 23.7 + 4.1) * 0.2;
      l.light.intensity = look.torchIntensity * (1 + n * look.torchFlicker) * l.fire.scale;
      l.light.distance = look.torchRange * l.fire.scale;
      l.light.color.setHex(look.torchColor);
    }

    if (this.lava) {
      this.lava.map!.offset.set(time * 0.03, time * 0.05);
      const glow = 1.35 + Math.sin(time * 1.7) * 0.2;
      this.lava.color.setRGB(glow, glow * 0.78, glow * 0.7);
    }

    this.colliderDebug.visible = tuning.debug.showColliders;
  }

  private addFire(pos: THREE.Vector3, flame: THREE.Mesh, scale: number): void {
    this.fires.push({ pos, flame, phase: Math.random() * 100, scale });
  }

  /** A piece's floor: a block up to its height, or for a staircase its two landings and the ramp between. */
  private buildPieceFloor(p: PieceInfo, top: THREE.MeshStandardMaterial, side: THREE.MeshStandardMaterial): void {
    const block = (minX: number, maxX: number, minZ: number, maxZ: number, y: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const h = y + 0.5;
      const mesh = new THREE.Mesh(boxGeometry(w, h, d, FLOOR_TILE), [side, side, top, top, side, side]);
      mesh.position.set((minX + maxX) / 2, y - h / 2, (minZ + maxZ) / 2);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    const b = p.bounds;
    if (!p.ramp) {
      block(b.minX, b.maxX, b.minZ, b.maxZ, p.y);
      return;
    }
    const r = p.ramp;
    const ns = r.up === 'n' || r.up === 's';
    // The landings either side of the ramp, and the block the ramp sits on.
    if (r.up === 'n') {
      block(b.minX, b.maxX, b.minZ, r.minZ, p.top);
      block(b.minX, b.maxX, r.maxZ, b.maxZ, p.y);
    } else if (r.up === 's') {
      block(b.minX, b.maxX, r.maxZ, b.maxZ, p.top);
      block(b.minX, b.maxX, b.minZ, r.minZ, p.y);
    } else if (r.up === 'w') {
      block(b.minX, r.minX, b.minZ, b.maxZ, p.top);
      block(r.maxX, b.maxX, b.minZ, b.maxZ, p.y);
    } else {
      block(r.maxX, b.maxX, b.minZ, b.maxZ, p.top);
      block(b.minX, r.minX, b.minZ, b.maxZ, p.y);
    }
    // The climb is drawn as steps so it reads as a staircase from behind the hero; the sim walks the
    // slice's smooth ramp under them, each step's top at the ramp's height mid-tread (feet stay within 10 cm).
    const rise = p.top - p.y;
    const steps = Math.max(2, Math.round(rise / 0.2));
    const len = ns ? r.maxZ - r.minZ : r.maxX - r.minX;
    const tread = len / steps;
    for (let i = 0; i < steps; i++) {
      const y = p.y + (rise * (i + 0.5)) / steps;
      // Step i counts from the low end toward the high side.
      const lo = r.up === 'n' ? r.maxZ - (i + 1) * tread : r.up === 's' ? r.minZ + i * tread : r.up === 'w' ? r.maxX - (i + 1) * tread : r.minX + i * tread;
      if (ns) block(r.minX, r.maxX, lo, lo + tread, y);
      else block(lo, lo + tread, r.minZ, r.maxZ, y);
    }
  }

  /** A portcullis filling a gate collider, raised until its room is shut. */
  private buildGate(c: Collider, floorY: number, iron: THREE.MeshStandardMaterial): Gate {
    const group = new THREE.Group();
    if (c.kind !== 'box') return { group, drop: 0 };
    const alongX = c.max.x - c.min.x > c.max.z - c.min.z;
    const len = alongX ? c.max.x - c.min.x : c.max.z - c.min.z;
    const h = DOOR_H;
    const bars = Math.round(len / 0.35);
    const barGeo = new THREE.CylinderGeometry(0.04, 0.04, h, 6);
    for (let i = 0; i <= bars; i++) {
      const bar = new THREE.Mesh(barGeo, iron);
      const t = -len / 2 + (len * i) / bars;
      bar.position.set(alongX ? t : 0, h / 2, alongX ? 0 : t);
      bar.castShadow = true;
      group.add(bar);
    }
    for (let k = 1; k <= 3; k++) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.07, 0.07, alongX ? 0.07 : len), iron);
      cross.position.y = (h * k) / 4;
      group.add(cross);
    }
    const holder = new THREE.Group();
    holder.position.set((c.min.x + c.max.x) / 2, floorY, (c.min.z + c.max.z) / 2);
    holder.add(group);
    group.visible = false;
    group.position.y = h;
    this.group.add(holder);
    return { group, drop: 0 };
  }
}

/** A box whose UVs are in metres over `tile`, so one repeating texture covers any size without stretching. */
function boxGeometry(w: number, h: number, d: number, tile: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Faces in order +x, -x, +y, -y, +z, -z, four vertices each: (u, v) spans (d, h), (w, d) or (w, h).
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * spans[f][0]) / tile, (uv.getY(i) * spans[f][1]) / tile);
    }
  }
  return geo;
}

function buildColliderDebug(colliders: readonly Collider[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x33ff88, depthTest: false, transparent: true, opacity: 0.6 });
  for (const c of colliders) {
    if (c.id === 'floor' || c.id.startsWith('slab-')) continue;
    const mesh = new THREE.LineSegments(undefined, mat);
    if (c.kind === 'box') {
      mesh.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z));
      mesh.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
    } else {
      mesh.geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(c.radius, c.radius, c.yMax - c.yMin, 12));
      mesh.position.set(c.x, (c.yMin + c.yMax) / 2, c.z);
    }
    mesh.renderOrder = 999;
    g.add(mesh);
  }
  return g;
}

/** Molten rock: orange and yellow under a broken dark crust, tiling. */
function lavaTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ff6a1a';
  g.fillRect(0, 0, size, size);
  // Hot veins, then crust plates over them; drawn wrapped so the texture tiles.
  const blob = (x: number, y: number, r: number, colour: string) => {
    g.fillStyle = colour;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) blob(rnd() * size, rnd() * size, 4 + rnd() * 10, rnd() < 0.5 ? '#ffb030' : '#ffd860');
  for (let i = 0; i < 26; i++) blob(rnd() * size, rnd() * size, 6 + rnd() * 12, rnd() < 0.5 ? 'rgba(70, 18, 8, 0.85)' : 'rgba(110, 30, 10, 0.7)');
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
