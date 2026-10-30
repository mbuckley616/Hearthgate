import * as THREE from 'three';
import { tuning, type Style } from '@hearthgate/shared/config/tuning';
import type { SimEvent, SimState } from '@hearthgate/shared/sim/types';
import { FROST } from './props';

const MAX_SPARKS = 500;
const NUMBER_LIFE = 0.85;

const SPARK_COLORS: Record<Style, number> = { sword: 0xffd49a, bow: 0xfff0c8, staff: FROST };

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  color: THREE.Color;
}

interface Decal {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  /** Scale from -> to over its life (rings expand). */
  grow: [number, number];
  opacity: number;
}

interface DamageNumber {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  age: number;
}

function additive(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
}

/**
 * One-shot hit feel visuals driven by sim events: contact sparks, ground
 * decals for the sweep, spin and slam, spawn and death puffs, and floating
 * damage numbers (brief: "Hit feel").
 */
export class FxView {
  readonly group = new THREE.Group();
  private sparks: Spark[] = [];
  private sparkPositions = new Float32Array(MAX_SPARKS * 3);
  private sparkColors = new Float32Array(MAX_SPARKS * 3);
  private sparkPoints: THREE.Points;
  private decals: Decal[] = [];
  private numbers: DamageNumber[] = [];
  private numberLayer = document.createElement('div');

  constructor(private camera: THREE.PerspectiveCamera) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.085,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.sparkPoints.frustumCulled = false;
    this.group.add(this.sparkPoints);
    this.numberLayer.className = 'damage-layer';
    document.body.appendChild(this.numberLayer);
  }

  /** React to this frame's sim events. */
  handle(events: SimEvent[], sim: SimState): void {
    for (const ev of events) {
      switch (ev.kind) {
        case 'hit': {
          const attacker = sim.players.find((p) => p.id === ev.attackerId);
          const color = new THREE.Color(ev.heavy ? 0xffc35a : SPARK_COLORS[attacker?.style ?? 'sword']);
          const count = Math.round(tuning.hitFeel.sparkCount * (ev.heavy ? 1.8 : 1));
          this.spawnSparks(new THREE.Vector3(ev.x, ev.y, ev.z), new THREE.Vector3(ev.dirX, 0.4, ev.dirZ), count, color);
          if (tuning.hitFeel.damageNumbers) this.spawnNumber(ev.x, ev.y + 0.6, ev.z, ev.damage, ev.bonus, ev.heavy, ev.crit);
          if (ev.killed) this.puff(ev.x, 0.6, ev.z, 0x2a2622, 0.9, 0.7);
          break;
        }
        case 'combo': {
          const color = ev.combo === 'shatter' ? 0xbfe8ff : ev.combo === 'skewer' ? 0xffd27a : 0xff7a3a;
          this.spawnSparks(new THREE.Vector3(ev.x, ev.y, ev.z), new THREE.Vector3(0, 1.4, 0), 60, new THREE.Color(color));
          this.ring(ev.x, ev.z, ev.combo === 'detonate' ? 5 : 3, color, 0.9, 0.6, ev.y - 1);
          break;
        }
        case 'revived': {
          const p = sim.players.find((pl) => pl.id === ev.playerId);
          if (p) {
            this.ring(p.x, p.z, 1.8, 0xfff0b0, 0.8, 0.7, p.y);
            this.spawnSparks(new THREE.Vector3(p.x, p.y + 0.6, p.z), new THREE.Vector3(0, 2, 0), 30, new THREE.Color(0xfff0b0));
          }
          break;
        }
        case 'parry':
          // A bright clash of sparks and a quick flash ring at the guard.
          this.spawnSparks(new THREE.Vector3(ev.x, ev.y, ev.z), new THREE.Vector3(0, 0.8, 0), 40, new THREE.Color(0xfff0b0));
          this.ring(ev.x, ev.z, 1.6, 0xfff0b0, 0.9, 0.35, ev.y - 1.1);
          break;
        case 'block':
          this.spawnSparks(new THREE.Vector3(ev.x, ev.y, ev.z), new THREE.Vector3(0, 0.5, 0), ev.broke ? 26 : 12, new THREE.Color(ev.broke ? 0xff9a6a : 0xd8d0c0));
          break;
        case 'stagger':
          this.spawnSparks(new THREE.Vector3(ev.x, 1.5, ev.z), new THREE.Vector3(0, 1, 0), 16, new THREE.Color(0xffe27a));
          break;
        case 'swing':
          // Ground decal for wide swings: the sweep's half circle and the spin's full ring.
          if (ev.arcDeg >= 180) this.arcDecal(ev.x, ev.z, ev.yaw, ev.range, ev.arcDeg, ev.heavy ? 0.32 : 0.16);
          break;
        case 'land':
          this.ring(ev.x, ev.z, ev.radius, 0xffc87a, 0.8, 0.5);
          this.puff(ev.x, 0.2, ev.z, 0x4a4038, 1.6, 0.6);
          break;
        case 'smashed': {
          // Splinters for wood, shards for clay, a puff of dust, and what it gave (D4).
          const urn = ev.propKind === 'urn';
          this.spawnSparks(new THREE.Vector3(ev.x, ev.y + 0.5, ev.z), new THREE.Vector3(0, 1.2, 0), 26, new THREE.Color(urn ? 0xc8714a : 0xb07a48));
          this.puff(ev.x, ev.y + 0.3, ev.z, 0x5a4a3a, 1.1, 0.5);
          // What it held lies on the floor now (Michael, 29 Oct): the word comes when it is picked up.
          if (ev.potion) this.spawnLabel(ev.x, ev.y + 1.7, ev.z, 'Potion!', 'potion');
          break;
        }
        case 'lootTaken':
          this.spawnLabel(ev.x, ev.y + 0.9, ev.z, `+${ev.amount} ${ev.loot}`, 'loot');
          break;
        case 'enemyRose': {
          // Haunted (P8): a fallen enemy gets up in a cold green breath.
          const y = sim.enemies.find((e) => e.id === ev.enemyId)?.y ?? 0;
          this.spawnSparks(new THREE.Vector3(ev.x, y + 0.4, ev.z), new THREE.Vector3(0, 1.6, 0), 30, new THREE.Color(0x8affb8));
          this.ring(ev.x, ev.z, 1.6, 0x6affa0, 0.7, 0.6, y);
          break;
        }
        case 'drank': {
          const p = sim.players.find((pl) => pl.id === ev.playerId);
          if (p) this.spawnSparks(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Vector3(0, 1.6, 0), 24, new THREE.Color(0xff5a6e));
          break;
        }
        case 'enemySlam': {
          const y = sim.enemies.find((e) => e.id === ev.enemyId)?.y ?? 0;
          this.ring(ev.x, ev.z, ev.radius * 1.2, 0xff8a5a, 0.9, 0.55, y);
          this.puff(ev.x, y + 0.2, ev.z, 0x4a4038, ev.radius * 1.1, 0.8);
          this.spawnSparks(new THREE.Vector3(ev.x, y + 0.1, ev.z), new THREE.Vector3(0, 1, 0), ev.boss ? 40 : 24, new THREE.Color(0xd8c0a0));
          break;
        }
        case 'roar': {
          const e = sim.enemies.find((o) => o.id === ev.enemyId);
          if (e) {
            this.ring(e.x, e.z, 7, 0xff9a5a, 0.7, 0.9, e.y);
            this.ring(e.x, e.z, 4.5, 0xffd0a0, 0.5, 0.7, e.y);
          }
          break;
        }
        case 'enemySpawn':
          this.puff(ev.x, 0.3, ev.z, 0x1a1614, 1.3, 0.9);
          break;
        case 'dropSpawned':
          this.ring(ev.x, ev.z, 2.2, ev.rarity === 'rare' ? 0xffc35a : 0x9fc8ff, 0.8, 0.7);
          this.spawnSparks(new THREE.Vector3(ev.x, 0.5, ev.z), new THREE.Vector3(0, 1.5, 0), 30, new THREE.Color(ev.rarity === 'rare' ? 0xffc35a : 0x9fc8ff));
          break;
        case 'pickup': {
          const p = sim.players.find((pl) => pl.id === ev.playerId);
          if (p) this.spawnSparks(new THREE.Vector3(p.x, p.y + 1, p.z), new THREE.Vector3(0, 1.2, 0), 24, new THREE.Color(ev.item.rarity === 'rare' ? 0xffc35a : 0x9fc8ff));
          break;
        }
        case 'levelUp': {
          const p = sim.players.find((pl) => pl.id === ev.playerId);
          if (p) {
            this.ring(p.x, p.z, 2.5, 0xffd27a, 0.9, 0.8, p.y);
            this.spawnSparks(new THREE.Vector3(p.x, p.y + 0.5, p.z), new THREE.Vector3(0, 2, 0), 40, new THREE.Color(0xffd27a));
          }
          break;
        }
        case 'perk':
          this.spawnSparks(new THREE.Vector3(ev.x, 1.2, ev.z), new THREE.Vector3(0, 0.8, 0), 10, new THREE.Color(ev.perk === 'bleed' ? 0xd0302a : 0xb9a6ff));
          break;
        case 'frostRing':
          this.ring(ev.x, ev.z, ev.radius, FROST, 0.9, 0.6);
          this.ring(ev.x, ev.z, ev.radius * 0.6, 0xe8fbff, 0.6, 0.45);
          this.spawnSparks(new THREE.Vector3(ev.x, 0.3, ev.z), new THREE.Vector3(0, 0.8, 0), 40, new THREE.Color(FROST));
          break;
        case 'blink':
          for (const [x, z] of [
            [ev.fromX, ev.fromZ],
            [ev.toX, ev.toZ],
          ]) {
            this.glowPuff(x, 0.9, z, 0xb59bff, 1.4, 0.35);
            this.spawnSparks(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, 0.3, 0), 18, new THREE.Color(0xc8b4ff));
          }
          break;
        case 'ability':
          if (ev.ability === 'charge') this.streak(ev.x, ev.z, ev.yaw, tuning.abilities.chargeDistance);
          if (ev.ability === 'whirlwind') this.arcDecal(ev.x, ev.z, ev.yaw, tuning.abilities.whirlwindRadius, 360, 0.25);
          break;
      }
    }
  }

  update(dt: number): void {
    // Sparks: fly, fall, fade.
    for (const s of this.sparks) {
      s.age += dt;
      s.vel.y -= 9 * dt;
      s.vel.multiplyScalar(Math.exp(-3 * dt));
      s.pos.addScaledVector(s.vel, dt);
      if (s.pos.y < 0.02) {
        s.pos.y = 0.02;
        s.vel.y *= -0.3;
      }
    }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (!s) {
        this.sparkColors.fill(0, i * 3, i * 3 + 3);
        continue;
      }
      const fade = 1 - s.age / s.life;
      this.sparkPositions.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
      this.sparkColors.set([s.color.r * fade * 2, s.color.g * fade * 2, s.color.b * fade * 2], i * 3);
    }
    const geo = this.sparkPoints.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, this.sparks.length);

    // Decals and puffs: grow and fade.
    for (const d of this.decals) {
      d.age += dt;
      const u = Math.min(1, d.age / d.life);
      const s = d.grow[0] + (d.grow[1] - d.grow[0]) * (1 - (1 - u) * (1 - u));
      d.mesh.scale.setScalar(s);
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = d.opacity * (1 - u);
    }
    for (const d of this.decals.filter((d) => d.age >= d.life)) {
      this.group.remove(d.mesh);
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    }
    this.decals = this.decals.filter((d) => d.age < d.life);

    // Damage numbers: rise, fade, stay pinned to the world.
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const n of this.numbers) {
      n.age += dt;
      const p = n.pos.clone();
      p.y += n.age * 0.9;
      p.project(this.camera);
      const visible = p.z < 1;
      n.el.style.display = visible ? 'block' : 'none';
      n.el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -50%)`;
      n.el.style.opacity = String(Math.min(1, 2 * (1 - n.age / NUMBER_LIFE)));
    }
    for (const n of this.numbers.filter((n) => n.age >= NUMBER_LIFE)) n.el.remove();
    this.numbers = this.numbers.filter((n) => n.age < NUMBER_LIFE);
  }

  private spawnSparks(at: THREE.Vector3, bias: THREE.Vector3, count: number, color: THREE.Color): void {
    const speed = tuning.hitFeel.sparkSpeed;
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().add(bias).normalize();
      this.sparks.push({
        pos: at.clone(),
        vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
        age: 0,
        life: 0.25 + Math.random() * 0.3,
        color,
      });
    }
  }

  private spawnNumber(x: number, y: number, z: number, damage: number, bonus: boolean, heavy: boolean, crit: boolean): void {
    const el = document.createElement('div');
    el.className = `damage-number${bonus ? ' bonus' : ''}${heavy ? ' heavy' : ''}${crit ? ' crit' : ''}`;
    el.textContent = crit ? `CRIT ${Math.round(damage)}` : String(Math.round(damage));
    this.numberLayer.appendChild(el);
    // A little horizontal scatter so stacked hits stay readable.
    this.numbers.push({ el, pos: new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4), age: 0 });
  }

  /** A word that floats up like a damage number: what a smashed prop gave. */
  private spawnLabel(x: number, y: number, z: number, text: string, kind: string): void {
    const el = document.createElement('div');
    el.className = `damage-number ${kind}`;
    el.textContent = text;
    this.numberLayer.appendChild(el);
    this.numbers.push({ el, pos: new THREE.Vector3(x, y, z), age: 0 });
  }

  private arcDecal(x: number, z: number, yaw: number, range: number, arcDeg: number, opacity: number): void {
    const arc = (Math.min(360, arcDeg) * Math.PI) / 180;
    // A thin band at the blade's reach reads as the swing's path without flooding the floor.
    const geo = new THREE.RingGeometry(range * 0.78, range, 48, 1, -arc / 2, arc).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, additive(0xffd49a, opacity));
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = yaw - Math.PI / 2;
    this.addDecal(mesh, 0.35, [0.9, 1.05], opacity);
  }

  private ring(x: number, z: number, radius: number, color: number, opacity: number, life: number, y = 0): void {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), additive(color, opacity));
    mesh.position.set(x, y + 0.04, z);
    this.addDecal(mesh, life, [radius * 0.2, radius * 1.1], opacity);
  }

  /** Soft smoke puff (normal blending, so it can darken). */
  private puff(x: number, y: number, z: number, color: number, size: number, life: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.scale.y = 0.6;
    this.addDecal(mesh, life, [size * 0.4, size], 0.5);
  }

  /** Glowing puff (additive) for magic. */
  private glowPuff(x: number, y: number, z: number, color: number, size: number, life: number): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), additive(color, 0.7));
    mesh.position.set(x, y, z);
    this.addDecal(mesh, life, [size * 0.3, size], 0.7);
  }

  /** Dust streak along the ground for the charge. */
  private streak(x: number, z: number, yaw: number, length: number): void {
    const geo = new THREE.PlaneGeometry(0.9, length).rotateX(-Math.PI / 2).translate(0, 0, length / 2);
    const mesh = new THREE.Mesh(geo, additive(0xffd49a, 0.22));
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = yaw;
    this.addDecal(mesh, 0.5, [1, 1], 0.22);
  }

  private addDecal(mesh: THREE.Mesh, life: number, grow: [number, number], opacity: number): void {
    this.group.add(mesh);
    this.decals.push({ mesh, age: 0, life, grow, opacity });
  }
}
