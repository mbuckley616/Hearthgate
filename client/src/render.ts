import * as THREE from "three";
import {
  ABILITIES,
  ARENA_HALF,
  CAMERA,
  DOWNS,
  ENEMY_KINDS,
  PLAYER,
  PORTAL,
  STAIRS,
  WEAPON_CLASSES,
  cameraOffset,
  materialOf,
  nudgeOffset,
  slewYaw,
  wallHides,
  weaponClassOf,
  type EnemyKind,
  type Level,
  type WeaponClass,
  type WallRect,
  type WeaponGear
} from "@hearthgate/shared";
import type { Pose } from "./net";
import { enemyFigure, newWalkState, playerFigure, poseFigure, stepFigureWalk, type Figure, type WalkState } from "./figures";

export interface PlayerVisual {
  hp: number;
  /** What they hold: picks the held mesh, its material colour and the swing's arc. */
  weapon: WeaponGear;
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
  /** Near a living Pack Leader. */
  rallied: boolean;
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
  packLeader: 0x3f7a3a,
  banner: 0xc0392b,
  shield: 0xb08a4a,
  wall: 0x9a978c,
  roof: 0x6b5244,
  sign: "#f3efe4",
  villager: 0xa88a62,
  villagerTag: "#f1d9a8",
  portal: 0x3b6fa6,
  portalLit: 0x7fb8ff,
  telegraph: 0xd9534f,
  swing: 0xfff1c2,
  guard: 0x9fb8d9,
  lock: 0xffd54a
};

const CLASSES: readonly WeaponClass[] = ["oneHand", "twoHand", "bow"];
const WHITE = new THREE.Color(0xffffff);
/** Arrow rains drawn at once (more archers than this reuse the oldest), and how long each shows. */
const RAIN_RINGS = 4;
const RAIN_SHOW_MS = 400;
/** A combo callout ("Combo x1.5") hangs over the enemy this long, rising CALLOUT_RISE_M. */
const CALLOUT_MS = 1000;
const CALLOUT_RISE_M = 0.7;
const CALLOUTS = 3;

class PlayerMesh {
  group = new THREE.Group();
  /** The placeholder figure (figures.ts); the commissioned model replaces it. */
  figure: Figure;
  private walk: WalkState = newWalkState();
  get walkAmount() {
    return this.walk.amount;
  }
  /** Per weapon class, built once: the swing's arc and the weapon in hand. Only the held class shows. */
  swings: Record<WeaponClass, THREE.Mesh>;
  held: Record<WeaponClass, THREE.Mesh>;
  /** Shared by the three held meshes; tinted with the material. */
  heldMat: THREE.MeshStandardMaterial;
  cleave: THREE.Mesh;
  guard: THREE.Mesh;
  tag: THREE.Sprite;
  /** Ground ring that grows while a teammate picks this player up. */
  pickupRing: THREE.Mesh;
  private baseColor: THREE.Color;

  constructor(name: string, color: string) {
    this.baseColor = new THREE.Color(color);
    this.figure = playerFigure(this.baseColor);
    this.group.add(this.figure.root);

    // Attack arcs: a flat wedge per class, shown for a few frames when the hit resolves.
    const arcMat = new THREE.MeshBasicMaterial({ color: PALETTE.swing, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const makeArc = (cls: WeaponClass) => {
      const w = WEAPON_CLASSES[cls];
      const arc = new THREE.Mesh(new THREE.RingGeometry(0.4, w.range, 18, 1, -w.arc / 2, w.arc), arcMat);
      arc.rotation.x = -Math.PI / 2;
      // RingGeometry's theta starts on +x; rotate so the wedge is centred on local +z.
      arc.rotation.z = -Math.PI / 2;
      arc.position.y = 0.05;
      arc.visible = false;
      this.group.add(arc);
      return arc;
    };
    this.swings = { oneHand: makeArc("oneHand"), twoHand: makeArc("twoHand"), bow: makeArc("bow") };

    // The weapon in the right hand, so a party reads as mixed at a glance and a swing lifts it.
    // Oversized on purpose (design doc, Art: wide weapons that read at the camera's distance).
    this.heldMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.5, metalness: 0.3 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.95), this.heldMat);
    blade.position.set(0, 0, 0.42);
    const great = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 1.5), this.heldMat);
    great.position.set(0, 0.1, 0.6);
    great.rotation.x = -0.35;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI), this.heldMat);
    bow.position.set(0.04, 0.05, 0.12);
    bow.rotation.y = Math.PI / 2;
    this.held = { oneHand: blade, twoHand: great, bow };
    for (const cls of CLASSES) {
      const m = this.held[cls];
      m.castShadow = true;
      m.visible = false;
      this.figure.hand.add(m);
    }

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

  private heldType = "";
  private heldTier = 0;
  private heldClass: WeaponClass = "oneHand";

  /** Show the held class's mesh in its material's colour; work only when the weapon changes. */
  private setWeapon(w: WeaponGear) {
    if (w.type === this.heldType && w.tier === this.heldTier) return;
    this.heldType = w.type;
    this.heldTier = w.tier;
    this.heldClass = weaponClassOf(w);
    for (const cls of CLASSES) this.held[cls].visible = cls === this.heldClass;
    const material = materialOf(w.tier);
    this.heldMat.color.setHex(material.color);
    this.heldMat.emissive.setHex(material.glow ?? 0x000000);
    this.heldMat.emissiveIntensity = material.glow === null ? 0 : 0.6;
  }

  apply(pose: Pose, v: PlayerVisual) {
    this.setWeapon(v.weapon);
    this.group.position.set(pose.x, 0, pose.z);
    this.group.rotation.y = pose.facing;
    const f = this.figure;
    const mat = f.skin;
    const lying = v.dead || v.downed;
    stepFigureWalk(this.walk, pose.x, pose.z, performance.now());
    poseFigure(f, this.walk, v.attacking && !lying ? 1 : 0);
    if (lying) {
      // Face down; the downed keep their colour (still in the fight), the dead go dark.
      f.root.rotation.x = Math.PI / 2;
      f.root.position.y = 0.2;
      mat.color.copy(this.baseColor).multiplyScalar(v.dead ? 0.45 : 0.8);
    } else {
      f.root.rotation.x = v.dodging ? 0.5 : v.staggered ? -0.35 : 0;
      if (v.dodging) f.root.position.y = 0;
      mat.color.copy(this.baseColor);
      if (v.attacking) mat.color.lerp(WHITE, 0.25);
    }
    for (const cls of CLASSES) this.swings[cls].visible = cls === this.heldClass && v.swingActive && !v.dead;
    this.held[this.heldClass].visible = !v.dead && !v.downed;
    this.guard.visible = v.guarding && !v.dead && !v.downed;
    this.cleave.visible = v.cleaveActive && !v.dead && !v.downed;
    this.tag.visible = !v.dead;
    // Grows from the player outward as the pickup channel fills.
    this.pickupRing.visible = v.downed && v.pickup > 0;
    if (this.pickupRing.visible) this.pickupRing.scale.setScalar(0.15 + 0.85 * v.pickup);
  }
}

/** One enemy: its kind's placeholder figure (figures.ts) plus the telegraphs and bars. */
class EnemyMesh {
  group = new THREE.Group();
  figure: Figure;
  private walk: WalkState = newWalkState();
  get walkAmount() {
    return this.walk.amount;
  }
  get kindName() {
    return this.kind;
  }
  telegraph: THREE.Mesh;
  hpBar: THREE.Sprite;
  /** Shield kinds only: the raised shield, lowered (hidden) while the guard is broken. */
  shield: THREE.Mesh | null = null;
  /** Charging kinds only: the lane on the ground while it aims. */
  lane: THREE.Mesh | null = null;
  private color: number;
  private windupColor: number;
  /** The war-paint red a rallied enemy takes on. */
  private ralliedColor: number;

  constructor(private readonly kind: EnemyKind) {
    const def = ENEMY_KINDS[kind];
    this.color =
      kind === "shieldbearer" ? PALETTE.shieldbearer : kind === "charger" ? PALETTE.charger : kind === "packLeader" ? PALETTE.packLeader : PALETTE.goblin;
    this.ralliedColor = new THREE.Color(this.color).lerp(new THREE.Color(PALETTE.banner), 0.35).getHex();
    this.windupColor = kind === "goblin" ? 0x6aa66a : new THREE.Color(this.color).lerp(new THREE.Color(0xffffff), 0.2).getHex();
    this.figure = enemyFigure(kind, this.color);
    if (def.rally) {
      // A banner on a pole above the chief: the one to reach first.
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a4632 }));
      pole.position.set(-0.35, 1.6, -0.2);
      this.group.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.4),
        new THREE.MeshStandardMaterial({ color: PALETTE.banner, side: THREE.DoubleSide })
      );
      flag.position.set(-0.05, 2.15, -0.2);
      this.group.add(flag);
    }
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
    this.group.add(this.figure.root);

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
    this.hpBar.position.y = Math.max(2.0, this.figure.height + 0.35);
    this.group.add(this.hpBar);
  }

  apply(pose: Pose, v: EnemyVisual) {
    this.group.position.set(pose.x, 0, pose.z);
    this.group.rotation.y = pose.facing;
    this.group.visible = v.phase !== "dead";
    const f = this.figure;
    const mat = f.skin;
    mat.color.setHex(v.hitFlash ? 0xffffff : v.phase === "windup" ? this.windupColor : v.rallied ? this.ralliedColor : this.color);
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
    }
    if (this.group.visible) {
      stepFigureWalk(this.walk, pose.x, pose.z, performance.now());
      // A windup rears back with the weapon arm raised: "about to hit" from across the room.
      // The Charger's "arms" are its forelegs, so it only rears.
      const windup = v.phase === "windup" ? v.windup : 0;
      poseFigure(f, this.walk, this.kind === "charger" ? 0 : windup);
      f.root.rotation.x = -0.3 * windup;
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
  /** Everything that is the level's (ground, walls, buildings, villagers, the dais), rebuilt when the room names a different level. */
  private walls = new THREE.Group();
  private wallsFor = "";
  /** The level's stairs (null without): a dark dais, lit while open. */
  private stairs: THREE.Mesh | null = null;
  /** The village's portal (null without): a blue dais, brighter as the party's hold fills. */
  private portal: THREE.Mesh | null = null;
  private sun: THREE.DirectionalLight;
  private readonly wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95, flatShading: true });
  /** A wall between the eye and the player swaps to this, so the player is never lost behind it. */
  private readonly wallFadedMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95, flatShading: true, transparent: true, opacity: 0.28, depthWrite: false });
  /** The walls the fade checks: their rectangle and height, beside the mesh. */
  private wallMeshes: { mesh: THREE.Mesh; rect: WallRect; h: number }[] = [];
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private readonly camOffset = { x: 0, y: 0, z: 0 };
  private readonly fadeEye = { x: 0, y: 0, z: 0 };
  private readonly fadeAim = { x: 0, y: 0, z: 0 };
  private camStarted = false;
  /** The camera's turn about the player (camera.ts): 0 is the old view from the south. Input reads it. */
  yaw = 0;
  // Hit-feedback nudge: added on top of the smoothed camera so it never disturbs the follow.
  private nudgeDir = new THREE.Vector3();
  private nudgeStart = -Infinity;
  private nudgeStrength = 0;
  private nudgeMs = 0;
  private nudgeVec = new THREE.Vector3();
  /** Nudges started so far; read by the e2e test through the debug handle. */
  nudges = 0;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  /** Where Arrow rain lands: a few rings built once, each shown for RAIN_SHOW_MS after a volley. */
  private rainRings: { mesh: THREE.Mesh; until: number }[] = [];
  /** Combo callouts: a few text sprites built once, redrawn only when one is shown. */
  private callouts: { sprite: THREE.Sprite; canvas: HTMLCanvasElement; start: number; y: number; text: string }[] = [];
  /** Callouts shown so far, and the last text; read by the e2e test through the debug handle. */
  calloutCount = 0;
  lastCallout = "";
  /** The bow's target: a ring on the ground under it, bright for a lock, faint for the auto pick. */
  private lockRing: THREE.Mesh;
  private readonly lockMat = new THREE.MeshBasicMaterial({ color: PALETTE.lock, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.lockRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 28), this.lockMat);
    this.lockRing.rotation.x = -Math.PI / 2;
    this.lockRing.position.y = 0.07;
    this.lockRing.visible = false;
    this.scene.add(this.lockRing);

    const rainMat = new THREE.MeshBasicMaterial({ color: PALETTE.lock, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const rainGeo = new THREE.CircleGeometry(1, 32);
    for (let i = 0; i < RAIN_RINGS; i++) {
      const mesh = new THREE.Mesh(rainGeo, rainMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      mesh.visible = false;
      this.scene.add(mesh);
      this.rainRings.push({ mesh, until: 0 });
    }

    for (let i = 0; i < CALLOUTS; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
      sprite.scale.set(2.6, 0.65, 1);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.scene.add(sprite);
      this.callouts.push({ sprite, canvas, start: -Infinity, y: 0, text: "" });
    }

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 30, 70);

    const hemi = new THREE.HemisphereLight(0xfff4dc, 0x6b8a52, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
    sun.position.set(12, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    this.sun = sun;

    this.buildMeadow();
    this.scene.add(this.walls);
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private buildMeadow() {
    // A wide meadow beyond any level so the edge is not the end of the world.
    const size = ARENA_HALF * 8;
    const meadow = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: PALETTE.groundDark, roughness: 1 })
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.y = -0.02;
    this.scene.add(meadow);
  }

  /** The level's ground, its grid and the low stone wall at its edge, sized to its bounds. */
  private buildGround(level: Level) {
    const w = level.halfW * 2;
    const d = level.halfD * 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.walls.add(ground);

    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d) / 2, PALETTE.edge, PALETTE.groundDark);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.position.y = 0.01;
    this.walls.add(grid);

    for (const [x, z, len, rot] of [
      [0, -level.halfD - 0.25, w + 1, 0],
      [0, level.halfD + 0.25, w + 1, 0],
      [-level.halfW - 0.25, 0, d + 1, Math.PI / 2],
      [level.halfW + 0.25, 0, d + 1, Math.PI / 2]
    ] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.5), this.wallMat);
      wall.position.set(x, 0.3, z);
      wall.rotation.y = rot;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.walls.add(wall);
    }
    const s = this.sun.shadow.camera;
    s.left = -level.halfW - 2;
    s.right = level.halfW + 2;
    s.top = level.halfD + 2;
    s.bottom = -level.halfD - 2;
    s.updateProjectionMatrix();
  }

  /**
   * Build the level once. The sim's walls are rectangles on the ground; here a long one is a
   * waist-high ruin and a squat one a pillar unless the level says how tall (a building's
   * walls), so a wall the sim stops you at is always a wall you can see. The village's
   * buildings get a roof and a sign over the door, its villagers a figure and a name, and the
   * portal a dais; the stairs are a dais too.
   */
  setLevel(level: Level) {
    if (this.wallsFor === level.id) return;
    this.wallsFor = level.id;
    this.walls.clear();
    this.wallMeshes = [];
    this.buildGround(level);
    for (const w of level.walls) {
      const pillar = w.hw < 1 && w.hd < 1;
      const h = w.h ?? (pillar ? 1.8 : 1.1);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.hw * 2, h, w.hd * 2), this.wallMat);
      mesh.position.set(w.x, h / 2, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.walls.add(mesh);
      this.wallMeshes.push({ mesh, rect: w, h });
    }
    const roofMat = new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 0.9, flatShading: true });
    for (const b of level.buildings ?? []) {
      // The roof sits on the tallest wall of the building's footprint, a little proud of it.
      let h = 0;
      for (const w of level.walls) if (w.h && Math.abs(w.x - b.x) <= b.hw + 0.5 && Math.abs(w.z - b.z) <= b.hd + 0.5) h = Math.max(h, w.h);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.hw * 2 + 0.6, 0.3, b.hd * 2 + 0.6), roofMat);
      roof.position.set(b.x, h + 0.15, b.z);
      roof.castShadow = true;
      roof.receiveShadow = true;
      this.walls.add(roof);
      const sign = makeTag(b.name, PALETTE.sign);
      sign.scale.set(3.2, 0.8, 1);
      sign.position.set(b.door.x + Math.sin(b.door.facing) * 0.4, h - 0.5, b.door.z + Math.cos(b.door.facing) * 0.4);
      this.walls.add(sign);
    }
    for (const n of level.npcs ?? []) {
      const figure = playerFigure(new THREE.Color(PALETTE.villager));
      figure.root.position.set(n.x, 0, n.z);
      figure.root.rotation.y = n.facing;
      this.walls.add(figure.root);
      const tag = makeTag(n.name, PALETTE.villagerTag);
      tag.position.set(n.x, 2.25, n.z);
      this.walls.add(tag);
    }
    this.stairs = null;
    if (level.stairs) {
      this.stairs = new THREE.Mesh(
        new THREE.CylinderGeometry(STAIRS.radius, STAIRS.radius, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0x3a3a44, emissive: 0x000000, roughness: 0.9 })
      );
      this.stairs.position.set(level.stairs.x, 0.06, level.stairs.z);
      this.stairs.receiveShadow = true;
      this.walls.add(this.stairs);
    }
    this.portal = null;
    if (level.portal) {
      this.portal = new THREE.Mesh(
        new THREE.CylinderGeometry(PORTAL.radius, PORTAL.radius, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: PALETTE.portal, emissive: PALETTE.portal, emissiveIntensity: 0.25, roughness: 0.6 })
      );
      this.portal.position.set(level.portal.x, 0.06, level.portal.z);
      this.portal.receiveShadow = true;
      this.walls.add(this.portal);
      // A ring of stones round it, so the dais reads as a place from across the square.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(PORTAL.radius + 0.3, 0.18, 6, 24), this.wallMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(level.portal.x, 0.1, level.portal.z);
      ring.castShadow = true;
      this.walls.add(ring);
    }
  }

  /** An Arrow rain landed: flash a disc of its radius at (x, z), reusing the oldest ring. */
  showRain(x: number, z: number, radius: number) {
    let slot = this.rainRings[0];
    for (const r of this.rainRings) if (r.until < slot.until) slot = r;
    slot.mesh.position.x = x;
    slot.mesh.position.z = z;
    slot.mesh.scale.setScalar(radius);
    slot.mesh.visible = true;
    slot.until = performance.now() + RAIN_SHOW_MS;
  }

  /** A combo landed: "Combo x1.5" over (x, z) at height y, rising and fading, reusing the oldest slot. */
  showCallout(text: string, x: number, z: number, y: number) {
    let slot = this.callouts[0];
    for (const c of this.callouts) if (c.start < slot.start) slot = c;
    if (slot.text !== text) {
      slot.text = text;
      const ctx = slot.canvas.getContext("2d")!;
      ctx.clearRect(0, 0, slot.canvas.width, slot.canvas.height);
      ctx.font = "800 38px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(30, 18, 6, 0.9)";
      ctx.strokeText(text, 128, 34);
      ctx.fillStyle = "#ffd25a";
      ctx.fillText(text, 128, 34);
      (slot.sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    }
    slot.sprite.position.set(x, y, z);
    slot.y = y;
    slot.start = performance.now();
    slot.sprite.visible = true;
    this.calloutCount++;
    this.lastCallout = text;
  }

  /** The bow's target marker: under (x, z), solid for a lock and faint for the auto pick; null hides it. */
  setTargetMarker(at: Pose | null, locked: boolean) {
    this.lockRing.visible = at !== null;
    if (!at) return;
    this.lockRing.position.x = at.x;
    this.lockRing.position.z = at.z;
    this.lockMat.opacity = locked ? 0.95 : 0.35;
  }

  /** Light the stairs while they are open, brighter as the party's hold fills. */
  setStairs(open: boolean, progress: number) {
    if (!this.stairs) return;
    (this.stairs.material as THREE.MeshStandardMaterial).emissive.setHex(open ? (progress > 0 ? 0xc9a646 : 0x7a6420) : 0x000000);
  }

  /** The portal glows a little always and brightens as the party's hold fills (0..1). */
  setPortal(progress: number) {
    if (!this.portal) return;
    const m = this.portal.material as THREE.MeshStandardMaterial;
    m.emissive.setHex(progress > 0 ? PALETTE.portalLit : PALETTE.portal);
    m.emissiveIntensity = 0.25 + 0.75 * progress;
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

  /**
   * Follow the given point with the raised third-person camera, turning slowly toward `fightYaw`
   * (camera.ts; null holds still). Reduced motion keeps the camera from turning at all.
   */
  follow(x: number, z: number, dtMs: number, fightYaw: number | null) {
    if (!this.reducedMotion.matches) this.yaw = slewYaw(this.yaw, fightYaw, dtMs);
    const k = this.camStarted ? 1 - Math.exp(-dtMs / CAMERA.followMs) : 1;
    this.camStarted = true;
    this.camTarget.x += (x - this.camTarget.x) * k;
    this.camTarget.y = CAMERA.targetY;
    this.camTarget.z += (z - this.camTarget.z) * k;
    // The eye hangs off the smoothed target at the current yaw, so a turn keeps its distance.
    const o = cameraOffset(this.yaw, this.camOffset);
    this.camPos.set(this.camTarget.x + o.x, this.camTarget.y + o.y, this.camTarget.z + o.z);
    const n = nudgeOffset(performance.now() - this.nudgeStart, this.nudgeStrength, this.nudgeMs);
    this.nudgeVec.copy(this.nudgeDir).multiplyScalar(n);
    this.camera.position.copy(this.camPos).add(this.nudgeVec);
    this.camera.lookAt(this.nudgeVec.add(this.camTarget));
    this.fadeWalls(x, z);
  }

  /** Fade the walls that stand between the eye and the player; restore the rest. */
  private fadeWalls(x: number, z: number) {
    this.fadeEye.x = this.camPos.x;
    this.fadeEye.y = this.camPos.y;
    this.fadeEye.z = this.camPos.z;
    this.fadeAim.x = x;
    this.fadeAim.y = CAMERA.fadeAimY;
    this.fadeAim.z = z;
    for (const w of this.wallMeshes) {
      const hides = wallHides(this.fadeEye, this.fadeAim, w.rect, w.h);
      w.mesh.material = hides ? this.wallFadedMat : this.wallMat;
      w.mesh.castShadow = !hides;
    }
  }

  /**
   * What each figure is made of, for the e2e checks through the debug handle: its part count,
   * its height and footprint (a bounding box of the figure alone), and how far into a stride it is.
   */
  figureStats() {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const stat = (f: Figure, walk: number) => {
      box.setFromObject(f.root);
      box.getSize(size);
      let parts = 0;
      f.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) parts++;
      });
      return { parts, height: size.y, width: Math.max(size.x, size.z), stride: walk };
    };
    return {
      players: Object.fromEntries([...this.players].map(([id, m]) => [id, stat(m.figure, m.walkAmount)])),
      enemies: Object.fromEntries([...this.enemies].map(([id, m]) => [id, { kind: m.kindName, ...stat(m.figure, m.walkAmount) }]))
    };
  }

  /** Walls faded this frame; read by the e2e checks through the debug handle. */
  fadedWalls(): number {
    let n = 0;
    for (const w of this.wallMeshes) if (w.mesh.material === this.wallFadedMat) n++;
    return n;
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
    const t = performance.now();
    for (const r of this.rainRings) if (r.mesh.visible && t >= r.until) r.mesh.visible = false;
    for (const c of this.callouts) {
      if (!c.sprite.visible) continue;
      const u = (t - c.start) / CALLOUT_MS;
      if (u >= 1) {
        c.sprite.visible = false;
        continue;
      }
      c.sprite.position.y = c.y + CALLOUT_RISE_M * u;
      // Full for the first half so it reads, then fades.
      (c.sprite.material as THREE.SpriteMaterial).opacity = u < 0.5 ? 1 : 2 * (1 - u);
    }
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
