import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { World } from '@hearthgate/shared/level/arena';
import type { Collider } from '@hearthgate/shared/level/geometry';
import { buildBanner, buildBrazier, buildCandles, buildSkull } from './decor';
import { floorTextures, pillarTextures, wallTextures } from './textures';

const DEG = Math.PI / 180;

interface Fader {
  materials: THREE.MeshStandardMaterial[];
  opacity: number;
}

interface Torch {
  light: THREE.PointLight;
  flame: THREE.Mesh;
  phase: number;
  /** Brazier fires are a little weaker and shorter-reaching than wall torches. */
  scale: number;
}

/** Renders the arena: floor, walls, ledge and ramps, pillars, torches and the antechamber gate. No ceiling, by design. */
export class RoomView {
  readonly group = new THREE.Group();
  private faders = new Map<string, Fader>();
  private torches: Torch[] = [];
  private colliderDebug: THREE.Group;
  private gate = new THREE.Group();
  private gateY = 0;
  /** Where fires burn (torch flames and brazier bowls), for embers. */
  readonly fireSources: THREE.Vector3[] = [];

  constructor(world: World) {
    const level = world.level;
    const colliders = world.colliders;
    const h = level.floorSize / 2;
    const t = level.wallThickness;
    const a = level.antechamber;

    // Floors: the arena, and the antechamber through the doorway.
    const floorMat = (w: number, d: number) => {
      const ft = floorTextures(Math.max(w, d));
      ft.map.repeat.set(w / 4, d / 4);
      ft.bump.repeat.set(w / 4, d / 4);
      return new THREE.MeshStandardMaterial({ map: ft.map, bumpMap: ft.bump, bumpScale: 1.5, roughness: 0.92, metalness: 0 });
    };
    const addFloor = (minX: number, maxX: number, minZ: number, maxZ: number) => {
      const w = maxX - minX;
      const d = maxZ - minZ;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat(w, d));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    addFloor(-h - t, h + t, -h - t, h + t);
    addFloor(a.minX, a.maxX, h, a.maxZ);

    // Walls, the lintel and the antechamber: every wall-like box collider becomes a textured block.
    for (const c of colliders) {
      if (c.kind !== 'box' || !/^(wall|ante|lintel)/.test(c.id)) continue;
      const sx = c.max.x - c.min.x;
      const sy = c.max.y - c.min.y;
      const sz = c.max.z - c.min.z;
      const wt = wallTextures(Math.max(sx, sz), sy);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshStandardMaterial({ map: wt.map, bumpMap: wt.bump, bumpScale: 2, roughness: 0.95 }),
      );
      mesh.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
    }

    // The ledge: a stone block with a paved top and a lip along its edge.
    const l = level.ledge;
    const lw = l.maxX - l.minX;
    const ld = l.maxZ - l.minZ;
    const lt = wallTextures(lw, l.height);
    const ledge = new THREE.Mesh(
      new THREE.BoxGeometry(lw, l.height, ld),
      [
        new THREE.MeshStandardMaterial({ map: lt.map, bumpMap: lt.bump, bumpScale: 2, roughness: 0.95 }),
        new THREE.MeshStandardMaterial({ map: lt.map, bumpMap: lt.bump, bumpScale: 2, roughness: 0.95 }),
        floorMat(lw, ld),
        floorMat(lw, ld),
        new THREE.MeshStandardMaterial({ map: lt.map, bumpMap: lt.bump, bumpScale: 2, roughness: 0.95 }),
        new THREE.MeshStandardMaterial({ map: lt.map, bumpMap: lt.bump, bumpScale: 2, roughness: 0.95 }),
      ],
    );
    ledge.position.set((l.minX + l.maxX) / 2, l.height / 2, (l.minZ + l.maxZ) / 2);
    ledge.receiveShadow = true;
    ledge.castShadow = true;
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(lw + 0.2, 0.14, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x6e6660, roughness: 0.85 }),
    );
    lip.position.set((l.minX + l.maxX) / 2, l.height + 0.02, l.maxZ - 0.1);
    lip.receiveShadow = true;
    this.group.add(ledge, lip);

    // Ramps: solid wedges from the floor up to the ledge front.
    for (const r of level.ramps) {
      const geo = wedgeGeometry(r.maxX - r.minX, l.height, r.maxZ - r.minZ);
      const mesh = new THREE.Mesh(geo, floorMat(r.maxX - r.minX, r.maxZ - r.minZ));
      mesh.position.set((r.minX + r.maxX) / 2, 0, r.minZ);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
    }

    // Portcullis over the doorway; slides down when the run starts.
    const d = level.doorway;
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a28, metalness: 0.7, roughness: 0.5 });
    const bars = Math.round((d.maxX - d.minX) / 0.35);
    for (let i = 0; i <= bars; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, d.height, 6), iron);
      bar.position.set(d.minX + ((d.maxX - d.minX) * i) / bars, d.height / 2, 0);
      this.gate.add(bar);
    }
    for (let k = 1; k <= 3; k++) {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(d.maxX - d.minX, 0.07, 0.07), iron);
      cross.position.set((d.minX + d.maxX) / 2, (d.height * k) / 4, 0);
      this.gate.add(cross);
    }
    this.gate.position.set(0, d.height - 0.2, h + t / 2);
    this.gateY = this.gate.position.y;
    this.gate.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.group.add(this.gate);

    // Pillars: shaft plus a plinth and capital, all sharing one material so they fade together.
    level.pillars.forEach((p, i) => {
      const pt = pillarTextures(2 * Math.PI * p.radius, p.height);
      const mat = new THREE.MeshStandardMaterial({ map: pt.map, bumpMap: pt.bump, bumpScale: 2, roughness: 0.9 });
      const pillar = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius, p.height, 20), mat);
      shaft.position.y = p.height / 2;
      const ring = (y: number, hgt: number, scale: number) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(p.radius * scale, p.radius * scale, hgt, 20), mat);
        m.position.y = y;
        return m;
      };
      pillar.add(shaft, ring(0.2, 0.4, 1.3), ring(0.45, 0.1, 1.15), ring(p.height - 0.2, 0.4, 1.3), ring(p.height - 0.45, 0.1, 1.15));
      pillar.position.set(p.x, 0, p.z);
      pillar.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.group.add(pillar);
      this.faders.set(`pillar-${i}`, { materials: [mat], opacity: 1 });
    });

    // Torches: iron bracket, an emissive flame (blooms) and a flickering point light.
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.6, metalness: 0.6 });
    for (const tc of level.torches) {
      const yaw = tc.facingYawDeg * DEG;
      const out = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const root = new THREE.Group();
      root.position.set(tc.x, tc.y, tc.z);
      root.rotation.y = yaw;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.45), bracketMat);
      arm.position.set(0, 0, 0.22);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.18, 10), bracketMat);
      cup.position.set(0, 0.08, 0.45);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.32, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(tuning.look.torchColor).multiplyScalar(4), toneMapped: false }),
      );
      flame.position.set(0, 0.32, 0.45);
      root.add(arm, cup, flame);
      this.group.add(root);

      const light = new THREE.PointLight(tuning.look.torchColor, tuning.look.torchIntensity, tuning.look.torchRange, 2);
      light.position.set(tc.x, tc.y + 0.4, tc.z).addScaledVector(out, 0.7);
      this.group.add(light);
      this.torches.push({ light, flame, phase: Math.random() * 100, scale: 1 });
      this.fireSources.push(new THREE.Vector3(tc.x, tc.y + 0.4, tc.z).addScaledVector(out, 0.45));
    }

    // Braziers: standing fires that light the middle of the room.
    for (const b of level.braziers) {
      const { group, flame } = buildBrazier(tuning.look.torchColor);
      group.position.set(b.x, 0, b.z);
      this.group.add(group);
      const light = new THREE.PointLight(tuning.look.torchColor, tuning.look.torchIntensity, tuning.look.torchRange, 2);
      light.position.set(b.x, 1.9, b.z);
      this.group.add(light);
      this.torches.push({ light, flame, phase: Math.random() * 100, scale: 0.8 });
      this.fireSources.push(new THREE.Vector3(b.x, 1.3, b.z));
    }

    // Banners with the order's sigil, candles and old bones at the foot of the walls.
    level.banners.forEach((bn, i) => {
      const yaw = bn.facingYawDeg * DEG;
      const out = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const banner = buildBanner();
      banner.position.set(bn.x, bn.y, bn.z);
      banner.rotation.y = yaw;
      this.group.add(banner);
      const candles = buildCandles(i + 1);
      candles.position.set(bn.x, groundAt(world, bn.x, bn.z, out), bn.z).addScaledVector(out, 0.45);
      this.group.add(candles);
      if (i % 2 === 0) {
        const skull = buildSkull();
        skull.position.set(bn.x + Math.cos(yaw) * 0.8, groundAt(world, bn.x, bn.z, out), bn.z - Math.sin(yaw) * 0.8).addScaledVector(out, 0.4);
        skull.rotation.y = yaw + 0.6;
        this.group.add(skull);
      }
    });

    this.colliderDebug = buildColliderDebug(colliders);
    this.colliderDebug.visible = false;
    this.group.add(this.colliderDebug);
  }

  /**
   * @param occluders fadeable collider ids currently hiding the hero
   * @param gateClosed the antechamber gate is down
   */
  update(dt: number, time: number, occluders: ReadonlySet<string>, gateClosed = false): void {
    // The gate drops fast and rises slowly.
    const gateTarget = gateClosed ? 0 : this.gateY;
    const rate = gateClosed ? 9 : 1.5;
    this.gate.position.y += (gateTarget - this.gate.position.y) * (1 - Math.exp(-rate * dt));

    const cam = tuning.camera;
    const k = 1 - Math.exp(-cam.occluderFadeRate * dt);
    for (const [id, f] of this.faders) {
      const target = occluders.has(id) ? cam.occluderOpacity : 1;
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

    const look = tuning.look;
    for (const t of this.torches) {
      const s = time * 1.0 + t.phase;
      const n = Math.sin(s * 7.3) * 0.5 + Math.sin(s * 13.1 + 1.7) * 0.3 + Math.sin(s * 23.7 + 4.1) * 0.2;
      const flick = 1 + n * look.torchFlicker;
      t.light.intensity = look.torchIntensity * flick * t.scale;
      t.light.distance = look.torchRange * t.scale;
      t.light.color.setHex(look.torchColor);
      t.flame.scale.set(1, 1 + n * look.torchFlicker * 1.5, 1);
    }

    this.colliderDebug.visible = tuning.debug.showColliders;
  }
}

/** Floor height just out from a wall point (the ledge top for the north wall's banners). */
function groundAt(world: World, x: number, z: number, out: THREE.Vector3): number {
  const l = world.level.ledge;
  const px = x + out.x * 0.5;
  const pz = z + out.z * 0.5;
  return px >= l.minX && px <= l.maxX && pz >= l.minZ && pz <= l.maxZ ? l.height : 0;
}

function buildColliderDebug(colliders: readonly Collider[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x33ff88, depthTest: false, transparent: true, opacity: 0.6 });
  for (const c of colliders) {
    if (c.id === 'floor') continue;
    let geo: THREE.BufferGeometry;
    const mesh = new THREE.LineSegments(undefined, mat);
    if (c.kind === 'box') {
      geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z));
      mesh.position.set((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
    } else {
      geo = new THREE.EdgesGeometry(new THREE.CylinderGeometry(c.radius, c.radius, c.yMax - c.yMin, 16));
      mesh.position.set(c.x, (c.yMin + c.yMax) / 2, c.z);
    }
    mesh.geometry = geo;
    mesh.renderOrder = 999;
    g.add(mesh);
  }
  return g;
}

/**
 * Triangular prism for a ramp: width along X, rising from z = depth (floor)
 * to z = 0 (height), with the origin at the high edge's floor centre.
 */
function wedgeGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const w = width / 2;
  const v = (x: number, y: number, z: number) => [x, y, z];
  // Corners: A/B on the floor at the high edge, C/D on top of the high edge, E/F on the floor at the low end.
  const A = v(-w, 0, 0);
  const B = v(w, 0, 0);
  const C = v(-w, height, 0);
  const D = v(w, height, 0);
  const E = v(-w, 0, depth);
  const F = v(w, 0, depth);
  const tris = [
    // Slope.
    [C, E, F],
    [C, F, D],
    // Back (against the ledge).
    [A, C, D],
    [A, D, B],
    // Sides.
    [A, E, C],
    [B, D, F],
    // Bottom.
    [A, B, F],
    [A, F, E],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  for (const tri of tris) {
    for (const p of tri) {
      pos.push(...p);
      uv.push(p[0] / 2, (p[2] + p[1]) / 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
