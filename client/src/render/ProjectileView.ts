import * as THREE from 'three';
import type { ProjectileState, SimState } from '@hearthgate/shared/sim/types';
import { FORWARD, FROST, Palette, buildArrow, glowMaterial } from './props';

const TRAIL_POINTS = 10;
const PUFF_LIFE = 0.3;

interface Visual {
  kind: ProjectileState['kind'];
  obj: THREE.Object3D;
  /** Recent positions, newest first (bolt trail). */
  history: THREE.Vector3[];
  trail?: THREE.Mesh[];
  streak?: THREE.Mesh;
  ring?: THREE.Mesh;
  dome?: THREE.Mesh;
  last: THREE.Vector3;
  stuck: boolean;
}

/** Renders arrows, magic bolts and bursts from sim state, plus view-only impact puffs. */
export class ProjectileView {
  readonly group = new THREE.Group();
  private visuals = new Map<number, Visual>();
  private puffs: { mesh: THREE.Mesh; age: number }[] = [];
  private boltCore = new THREE.SphereGeometry(0.09, 12, 8);
  private boltHalo = new THREE.SphereGeometry(0.22, 12, 8);
  private trailGeo = new THREE.SphereGeometry(0.07, 8, 6);
  private streakGeo = new THREE.CylinderGeometry(0.0, 0.012, 1, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.5);

  constructor(private palette: Palette) {}

  update(prev: SimState, curr: SimState, alpha: number, dt: number): void {
    const prevById = new Map(prev.projectiles.map((p) => [p.id, p]));
    const alive = new Set<number>();

    for (const pr of curr.projectiles) {
      alive.add(pr.id);
      let v = this.visuals.get(pr.id);
      if (!v) {
        v = this.create(pr);
        this.visuals.set(pr.id, v);
        this.group.add(v.obj);
      }
      const before = prevById.get(pr.id);
      const pos = before
        ? new THREE.Vector3(before.x + (pr.x - before.x) * alpha, before.y + (pr.y - before.y) * alpha, before.z + (pr.z - before.z) * alpha)
        : new THREE.Vector3(pr.x, pr.y, pr.z);
      v.obj.position.copy(pos);
      v.last.copy(pos);
      v.stuck = pr.stuck;

      if (pr.kind === 'arrow') {
        const vel = new THREE.Vector3(pr.vx, pr.vy, pr.vz);
        if (vel.lengthSq() > 1e-6) v.obj.quaternion.setFromUnitVectors(FORWARD, vel.normalize());
        if (v.streak) {
          v.streak.visible = !pr.stuck;
          v.streak.scale.set(1, 1, Math.min(1.6, pr.age * 12));
        }
      } else if (pr.kind === 'bolt') {
        v.history.unshift(pos.clone());
        if (v.history.length > TRAIL_POINTS) v.history.length = TRAIL_POINTS;
        v.trail!.forEach((m, i) => {
          const h = v!.history[Math.min(i + 1, v!.history.length - 1)];
          m.position.copy(h).sub(pos);
          const s = 1 - i / TRAIL_POINTS;
          m.scale.setScalar(s);
          (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * s;
        });
        const pulse = 1 + Math.sin(pr.age * 40) * 0.12;
        v.obj.children[1].scale.setScalar(pulse);
      } else {
        // Burst: a ring racing out across the floor and a dome that flashes and fades.
        const u = Math.min(1, pr.age / Math.max(1e-3, pr.age + pr.life));
        const grow = 1 - Math.pow(1 - Math.min(1, u * 2.2), 3);
        v.ring!.scale.setScalar(pr.radius * grow);
        (v.ring!.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u);
        v.dome!.scale.set(pr.radius * grow, pr.radius * grow * 0.6, pr.radius * grow);
        (v.dome!.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - u) * (1 - u);
      }
    }

    for (const [id, v] of this.visuals) {
      if (alive.has(id)) continue;
      // A bolt that vanished hit something: leave a puff where it was.
      if (v.kind === 'bolt') this.spawnPuff(v.last);
      this.group.remove(v.obj);
      this.visuals.delete(id);
    }

    for (const puff of this.puffs) {
      puff.age += dt;
      const u = Math.min(1, puff.age / PUFF_LIFE);
      puff.mesh.scale.setScalar(0.2 + u * 0.9);
      (puff.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u);
    }
    for (const puff of this.puffs.filter((p) => p.age >= PUFF_LIFE)) this.group.remove(puff.mesh);
    this.puffs = this.puffs.filter((p) => p.age < PUFF_LIFE);
  }

  private create(pr: ProjectileState): Visual {
    const base = { kind: pr.kind, history: [], last: new THREE.Vector3(pr.x, pr.y, pr.z), stuck: pr.stuck };
    if (pr.kind === 'arrow') {
      const obj = buildArrow(this.palette);
      // Enemy arrows streak red so they read as danger.
      const color = pr.hostile ? 0xff4a3a : pr.charged ? 0xffc35a : 0xfff2dc;
      const streak = new THREE.Mesh(this.streakGeo, glowMaterial(color, pr.hostile || pr.charged ? 0.9 : 0.45));
      streak.position.z = -0.7;
      obj.add(streak);
      return { ...base, obj, streak };
    }
    if (pr.kind === 'bolt') {
      const obj = new THREE.Group();
      obj.add(new THREE.Mesh(this.boltCore, glowMaterial(0xe8fbff)), new THREE.Mesh(this.boltHalo, glowMaterial(FROST, 0.45)));
      const trail = Array.from({ length: TRAIL_POINTS }, () => new THREE.Mesh(this.trailGeo, glowMaterial(FROST, 0.5)));
      obj.add(...trail);
      return { ...base, obj, trail };
    }
    const obj = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), glowMaterial(FROST, 0.9));
    ring.position.y = 0.03;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glowMaterial(FROST, 0.35));
    obj.add(ring, dome);
    return { ...base, obj, ring, dome };
  }

  private spawnPuff(at: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.boltHalo, glowMaterial(FROST, 0.8));
    mesh.position.copy(at);
    this.group.add(mesh);
    this.puffs.push({ mesh, age: 0 });
  }
}
