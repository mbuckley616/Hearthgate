import * as THREE from "three";
import { ABILITIES, ARENA_HALF, DOWNS, ENEMY_KINDS, PLAYER, nudgeOffset, type EnemyKind, type Level } from "@hearthgate/shared";
import type { Pose } from "./net";

export interface PlayerVisual {
  hp: number;
  attacking: boolean; // committed to a swing
  swingActive: boolean; // the frames right after the hit resolves (flash the arc)
  cleaveActive: boolean; // the same for Cleave's wider arc
  dodging: boolean;
  /** Block held: a guard plate in front. */
  guarding: boolean;
  /** Posture broken: rocked back. */
  staggered: boolean;
  /** At zero health, crawling, waiting for a pickup. */
  downed: boolean;
  /** Pickup channel progress while downed, 0..1. */
  pickup: number;
  dead: boolean;
}

export interface EnemyVisual {
  hp: number;
  maxHp: number;
  phase: string;
  /** 0..1 while winding up, else 0. */
  windup: number;
  hitFlash: boolean;
  /** A shield kind's guard is raised. */
  guardUp: boolean;
  /** 0..1 while a charger aims, else 0. */
  aim: number;
}

const PALETTE = {
  sky: 0xdfe9d6,
  ground: 0x7fa86a,
  groundDark: 0x6f965b,
  edge: 0x5c6f4a,
  goblin: 0x4f8a4f,
  goblinDark: 0x2f5c2f,
  shieldbearer: 0x6f6a62,
  charger: 0x8a5a3c,
  shield: 0xb08a4a,
  wall: 0x9a978c,
  telegraph: 0xd9534f,
  swing: 0xfff1c2,
  guard: 0x9fb8d9
};

class PlayerMesh {
  group = new THREE.Group();
  body: THREE.Mesh;
  swing: THREE.Mesh;
  cleave: THREE.Mesh;
  guard: THREE.Mesh;
  tag: THREE.Sprite;
  /** Ground ring that grows while a teammate picks this player up. */
  pickupRing: THREE.Mesh;
  private baseColor: THREE.Color;

  constructor(name: string, color: string) {
    this.baseColor = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({ color: this.baseColor, roughness: 0.8 });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius * 0.8, 0.9, 4, 10), mat);
    this.body.position.y = 0.95;
    this.body.castShadow = true;
    this.group.add(this.body);

    // A small block in front so the facing direction reads at a glance.
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 })
    );
    nose.position.set(0, 1.25, PLAYER.radius * 0.95);
    this.group.add(nose);

    // Attack arc: a flat wedge shown for a few frames when the hit resolves.
    const arc = new THREE.RingGeometry(0.4, PLAYER.attackRange, 18, 1, -PLAYER.attackArc / 2, PLAYER.attackArc);
    this.swing = new THREE.Mesh(
      arc,
      new THREE.MeshBasicMaterial({ color: PALETTE.swing, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    this.swing.rotation.x = -Math.PI / 2;
    // RingGeometry's theta starts on +x; rotate so the wedge is centred on local +z.
    this.swing.rotation.z = -Math.PI / 2;
    this.swing.position.y = 0.05;
    this.swing.visible = false;
    this.group.add(this.swing);

    const c = ABILITIES.cleave;
    this.cleave = new THREE.Mesh(
      new THREE.RingGeometry(0.4, c.range, 28, 1, -c.arc / 2, c.arc),
      new THREE.MeshBasicMaterial({ color: PALETTE.swing, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    this.cleave.rotation.x = -Math.PI / 2;
    this.cleave.rotation.z = -Math.PI / 2;
    this.cleave.position.y = 0.06;
    this.cleave.visible = false;
    this.group.add(this.cleave);

    // The raised guard: a broad plate across the front, so a block reads from across the room.
    this.guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.85, 0.1),
      new THREE.MeshStandardMaterial({ color: PALETTE.guard, roughness: 0.6, transparent: true, opacity: 0.85 })
    );
    this.guard.position.set(0, 1.0, PLAYER.radius + 0.18);
    this.guard.visible = false;
    this.group.add(this.guard);

    this.pickupRing = new THREE.Mesh(
      new THREE.RingGeometry(DOWNS.pickupRange * 0.85, DOWNS.pickupRange, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.swing, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    this.pickupRing.rotation.x = -Math.PI / 2;
    this.pickupRing.position.y = 0.04;
    this.pickupRing.visible = false;
    this.group.add(this.pickupRing);

    this.tag = makeTag(name, color);
    this.tag.position.y = 2.25;
    this.group.add(this.tag);
  }

  apply(pose: Pose, v: PlayerVisual) {
    this.group.position.set(pose.x, 0, pose.z);
    this.group.rotation.y = pose.facing;
    const mat = this.body.material as THREE.MeshStandardMaterial;
    if (v.dead || v.downed) {
      // Lying down; the downed keep their colour (still in the fight), the dead go dark.
      this.body.rotation.x = Math.PI / 2;
      this.body.position.y = 0.4;
      mat.color.copy(this.baseColor).multiplyScalar(v.dead ? 0.45 : 0.8);
    } else {
      this.body.rotation.x = v.dodging ? 0.5 : v.staggered ? -0.35 : 0;
      this.body.position.y = v.dodging ? 0.8 : 0.95;
      mat.color.copy(this.baseColor);
      if (v.attacking) mat.color.lerp(new THREE.Color(0xffffff), 0.25);
    }
    this.swing.visible = v.swingActive && !v.dead;
    this.guard.visible = v.guarding && !v.dead && !v.downed;
    this.cleave.visible = v.cleaveActive && !v.dead && !v.downed;
    this.tag.visible = !v.dead;
    // Grows from the player outward as the pickup channel fills.
    this.pickupRing.visible = v.downed && v.pickup > 0;
    if (this.pickupRing.visible) this.pickupRing.scale.setScalar(0.15 + 0.85 * v.pickup);
  }
}

/** One enemy. Every kind is the goblin cone until the roster lands; the kind picks the def. */
class EnemyMesh {
  group = new THREE.Group();
  body: THREE.Mesh;
  telegraph: THREE.Mesh;
  hpBar: THREE.Sprite;
  /** Shield kinds only: the raised shield, lowered (hidden) while the guard is broken. */
  shield: THREE.Mesh | null = null;
  /** Charging kinds only: the lane on the ground while it aims. */
  lane: THREE.Mesh | null = null;
  private color: number;
  private windupColor: number;

  constructor(kind: EnemyKind) {
    const def = ENEMY_KINDS[kind];
    this.color = kind === "shieldbearer" ? PALETTE.shieldbearer : kind === "charger" ? PALETTE.charger : PALETTE.goblin;
    this.windupColor = kind === "goblin" ? 0x6aa66a : new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), 0.2).getHex();
    this.body = new THREE.Mesh(
      new THREE.ConeGeometry(def.radius * 1.1, kind === "shieldbearer" ? 1.8 : 1.5, 7),
      new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.85, flatShading: true })
    );
    this.body.position.y = 0.75;
    if (def.charge) {
      // The charge's lane, as long as its run and as wide as what it hits.
      const len = def.charge.maxRange;
      const lane = new THREE.PlaneGeometry((def.radius + PLAYER.radius) * 2, len);
      lane.translate(0, len / 2, 0);
      this.lane = new THREE.Mesh(
        lane,
        new THREE.MeshBasicMaterial({ color: PALETTE.telegraph, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
      );
      this.lane.rotation.x = Math.PI / 2; // lie flat, pointing along local +z
      this.lane.position.y = 0.03;
      this.lane.visible = false;
      this.group.add(this.lane);
    }
    if (def.frontGuard !== undefined) {
      // A tall plank shield across the front: the side you must not hit.
      this.shield = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.3, 0.12),
        new THREE.MeshStandardMaterial({ color: PALETTE.shield, roughness: 0.7, flatShading: true })
      );
      this.shield.position.set(0, 0.85, def.radius + 0.12);
      this.shield.castShadow = true;
      this.group.add(this.shield);
    }
    this.body.castShadow = true;
    this.group.add(this.body);

    const eyes = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffe08a })
    );
    eyes.position.set(0, 0.95, def.radius * 0.75);
    this.group.add(eyes);

    const wedge = new THREE.RingGeometry(0.3, def.attackRange * 1.15, 20, 1, -def.attackArc / 2, def.attackArc);
    this.telegraph = new THREE.Mesh(
      wedge,
      new THREE.MeshBasicMaterial({ color: PALETTE.telegraph, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.rotation.z = -Math.PI / 2;
    this.telegraph.position.y = 0.04;
    this.telegraph.visible = false;
    this.group.add(this.telegraph);

    this.hpBar = makeBar();
    this.hpBar.position.y = 2.0;
    this.group.add(this.hpBar);
  }

  apply(pose: Pose, v: EnemyVisual) {
    this.group.position.set(pose.x, 0, pose.z);
    this.group.rotation.y = pose.facing;
    this.group.visible = v.phase !== "dead";
    const mat = this.body.material as THREE.MeshStandardMaterial;
    mat.color.setHex(v.hitFlash ? 0xffffff : v.phase === "windup" ? this.windupColor : this.color);
    if (this.shield) this.shield.visible = v.guardUp;
    if (this.lane) {
      this.lane.visible = v.phase === "aim";
      if (this.lane.visible) (this.lane.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.5 * v.aim;
    }
    this.telegraph.visible = v.phase === "windup";
    if (v.phase === "windup") {
      const s = 0.35 + 0.65 * v.windup;
      this.telegraph.scale.set(s, s, 1);
      (this.telegraph.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.45 * v.windup;
      this.body.position.y = 0.75 + 0.25 * v.windup; // a rising crouch reads as "about to hit"
    } else {
      this.body.position.y = 0.75;
    }
    updateBar(this.hpBar, v.hp / v.maxHp);
  }
}

export class View {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private players = new Map<string, PlayerMesh>();
  private enemies = new Map<string, EnemyMesh>();
  /** The level's interior walls, rebuilt when the room names a different level. */
  private walls = new THREE.Group();
  private wallsFor = "";
  private readonly wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95, flatShading: true });
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 13, 9);
  private readonly camOffset = new THREE.Vector3(0, 13, 9);
  // Hit-feedback nudge: added on top of the smoothed camera so it never disturbs the follow.
  private nudgeDir = new THREE.Vector3();
  private nudgeStart = -Infinity;
  private nudgeStrength = 0;
  private nudgeMs = 0;
  private nudgeVec = new THREE.Vector3();
  /** Nudges started so far; read by the e2e test through the debug handle. */
  nudges = 0;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.copy(this.camPos);

    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 30, 70);

    const hemi = new THREE.HemisphereLight(0xfff4dc, 0x6b8a52, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
    sun.position.set(12, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -ARENA_HALF - 2;
    sun.shadow.camera.right = ARENA_HALF + 2;
    sun.shadow.camera.top = ARENA_HALF + 2;
    sun.shadow.camera.bottom = -ARENA_HALF - 2;
    this.scene.add(sun);

    this.buildArena();
    this.scene.add(this.walls);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private buildArena() {
    const size = ARENA_HALF * 2;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A wider meadow beyond the arena so the edge is not the end of the world.
    const meadow = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 4, size * 4),
      new THREE.MeshStandardMaterial({ color: PALETTE.groundDark, roughness: 1 })
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.y = -0.02;
    this.scene.add(meadow);

    const grid = new THREE.GridHelper(size, 20, PALETTE.edge, PALETTE.groundDark);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Low stone wall at the arena edge.
    const wallGeo = new THREE.BoxGeometry(size + 1, 0.6, 0.5);
    for (const [x, z, rot] of [
      [0, -ARENA_HALF - 0.25, 0],
      [0, ARENA_HALF + 0.25, 0],
      [-ARENA_HALF - 0.25, 0, Math.PI / 2],
      [ARENA_HALF + 0.25, 0, Math.PI / 2]
    ] as const) {
      const wall = new THREE.Mesh(wallGeo, this.wallMat);
      wall.position.set(x, 0.3, z);
      wall.rotation.y = rot;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }
  }

  /**
   * Build the level's walls once. The sim's walls are rectangles on the ground; here a long
   * one is a waist-high ruin and a squat one a pillar, so a wall the sim stops you at is
   * always a wall you can see.
   */
  setLevel(level: Level) {
    if (this.wallsFor === level.id) return;
    this.wallsFor = level.id;
    this.walls.clear();
    for (const w of level.walls) {
      const pillar = w.hw < 1 && w.hd < 1;
      const h = pillar ? 1.8 : 1.1;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.hw * 2, h, w.hd * 2), this.wallMat);
      mesh.position.set(w.x, h / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.walls.add(mesh);
    }
  }

  ensurePlayer(id: string, name: string, color: string) {
    const existing = this.players.get(id);
    if (existing) return;
    const m = new PlayerMesh(name, color);
    this.players.set(id, m);
    this.scene.add(m.group);
  }

  updatePlayer(id: string, pose: Pose, v: PlayerVisual) {
    this.players.get(id)?.apply(pose, v);
  }

  removePlayer(id: string) {
    const m = this.players.get(id);
    if (!m) return;
    this.scene.remove(m.group);
    this.players.delete(id);
  }

  playerIds(): string[] {
    return [...this.players.keys()];
  }

  ensureEnemy(id: string, kind: EnemyKind) {
    if (this.enemies.has(id)) return;
    const m = new EnemyMesh(kind);
    this.enemies.set(id, m);
    this.scene.add(m.group);
  }

  updateEnemy(id: string, pose: Pose, v: EnemyVisual) {
    this.enemies.get(id)?.apply(pose, v);
  }

  removeEnemy(id: string) {
    const m = this.enemies.get(id);
    if (!m) return;
    this.scene.remove(m.group);
    this.enemies.delete(id);
  }

  enemyIds(): string[] {
    return [...this.enemies.keys()];
  }

  /** Follow the given point with a raised third-person camera. */
  follow(x: number, z: number, dtMs: number) {
    const k = 1 - Math.exp(-dtMs / 120);
    this.camTarget.lerp(new THREE.Vector3(x, 0.8, z), k);
    this.camPos.lerp(new THREE.Vector3(x, 0, z).add(this.camOffset), k);
    const n = nudgeOffset(performance.now() - this.nudgeStart, this.nudgeStrength, this.nudgeMs);
    this.nudgeVec.copy(this.nudgeDir).multiplyScalar(n);
    this.camera.position.copy(this.camPos).add(this.nudgeVec);
    this.camera.lookAt(this.nudgeVec.add(this.camTarget));
  }

  /**
   * Kick the camera along (dx, dz) on the ground plane. Moving the eye and the look target
   * together slides the view without tilting it, which reads as impact, not as a lurch.
   */
  nudge(dx: number, dz: number, strengthM: number, durationMs: number) {
    if (this.reducedMotion.matches) return;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    this.nudgeDir.set(dx / len, 0, dz / len);
    this.nudgeStart = performance.now();
    this.nudgeStrength = strengthM;
    this.nudgeMs = durationMs;
    this.nudges++;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

function makeTag(name: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(20, 24, 18, 0.55)";
  const w = Math.min(240, ctx.measureText(name).width + 28);
  roundRect(ctx, 128 - w / 2, 10, w, 44, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function makeBar(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.6, 0.2, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.last = -1;
  return sprite;
}

function updateBar(sprite: THREE.Sprite, fraction: number) {
  const f = Math.max(0, Math.min(1, fraction));
  if (Math.abs(sprite.userData.last - f) < 0.005) return;
  sprite.userData.last = f;
  const canvas = sprite.userData.canvas as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(20, 24, 18, 0.6)";
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 6);
  ctx.fill();
  ctx.fillStyle = f > 0.35 ? "#8fc67a" : "#d96c6c";
  roundRect(ctx, 2, 2, (canvas.width - 4) * f, canvas.height - 4, 5);
  ctx.fill();
  (sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
