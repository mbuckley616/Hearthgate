import * as THREE from 'three';
import { enemyStats, tuning, type EnemyKind } from '@hearthgate/shared/config/tuning';
import type { EnemyState } from '@hearthgate/shared/sim/types';
import { Bow, Palette, UP, buildQuiver, glowMaterial, segmentGeo } from './props';
import {
  DEG,
  clamp01,
  direction,
  easeInOut,
  easeOut,
  lerpAngle,
  lerpPose,
  pose,
  poseArms,
  poseLegs,
  type Arm,
  type Dims,
  type Leg,
  type UpperPose,
} from './rig';

/** Grunt-sized proportions (skeletons; once goblins); bigger kinds scale the whole model. */
const DIMS: Dims = {
  hipHeight: 0.78,
  chestOffset: 0.1,
  headHeight: 0.46,
  shoulder: { x: 0.2, y: 0.32 },
  upperArm: 0.27,
  forearm: 0.27,
  hipJoint: { x: 0.1, y: -0.04 },
  thigh: 0.36,
  shin: 0.34,
  ankleHeight: 0.07,
  footSpacing: 0.15,
};

/** Model scale per kind: the rig is goblin-sized, so heights match the sim's body heights. */
const SCALE: Record<EnemyKind, number> = { grunt: 1, archer: 1, brute: 1.45, warden: 1.95 };

const BASE: UpperPose = {
  handYaw: -35,
  handHeight: 0.0,
  handReach: 0.32,
  bladeYaw: 10,
  bladePitch: 30,
  offYaw: 40,
  offHeight: 0.0,
  offReach: 0.3,
  twist: 0,
  lean: 18,
  crouch: 0.06,
  draw: 0,
  spin: 0,
  flip: 0,
  lift: 0,
};

/** Key poses per kind, by name. */
const POSES: Record<EnemyKind, Record<string, UpperPose>> = {
  grunt: {
    guard: BASE,
    windup: pose(BASE, { handYaw: -60, handHeight: 0.55, handReach: 0.16, bladeYaw: -150, bladePitch: 70, offYaw: 25, offHeight: 0.25, offReach: 0.38, twist: -30, lean: 2, crouch: 0.1 }),
    slash1: pose(BASE, { handYaw: 20, handHeight: -0.05, handReach: 0.42, bladeYaw: 40, bladePitch: -40, offYaw: 55, offReach: 0.2, twist: 30, lean: 26, crouch: 0.12 }),
    between: pose(BASE, { handYaw: 35, handHeight: 0.25, handReach: 0.3, bladeYaw: 110, bladePitch: 20, offYaw: 55, offHeight: 0.05, offReach: 0.22, twist: 35, lean: 14, crouch: 0.08 }),
    slash2: pose(BASE, { handYaw: -70, handHeight: 0.2, handReach: 0.45, bladeYaw: -80, bladePitch: 0, offYaw: 35, offHeight: 0.1, twist: -35, lean: 22, crouch: 0.1 }),
  },
  // Bow in the left hand, string hand at the cheek when aiming.
  archer: {
    guard: pose(BASE, { handYaw: -30, handHeight: 0.05, handReach: 0.26, bladeYaw: 70, bladePitch: 65, offYaw: 55, offHeight: -0.02, offReach: 0.3, lean: 12 }),
    aim: pose(BASE, { handYaw: -24, handHeight: 0.42, handReach: 0.1, bladeYaw: 38, bladePitch: 84, offYaw: 35, offHeight: 0.36, offReach: 0.52, twist: -40, lean: 4, draw: 1 }),
    loose: pose(BASE, { handYaw: -70, handHeight: 0.44, handReach: 0.14, bladeYaw: 38, bladePitch: 84, offYaw: 35, offHeight: 0.36, offReach: 0.52, twist: -40, lean: 4, draw: 0 }),
  },
  // Club over the shoulder; overhead with both hands; smashed into the floor.
  brute: {
    guard: pose(BASE, { handYaw: -45, handHeight: 0.3, handReach: 0.2, bladeYaw: -160, bladePitch: 60, offYaw: 45, offHeight: 0.05, offReach: 0.3, lean: 16 }),
    raise: pose(BASE, { handYaw: -10, handHeight: 0.68, handReach: 0.12, bladeYaw: 180, bladePitch: 70, offYaw: 10, offHeight: 0.66, offReach: 0.14, lean: -10, crouch: 0.04 }),
    smash: pose(BASE, { handYaw: -5, handHeight: -0.1, handReach: 0.45, bladeYaw: 0, bladePitch: -55, offYaw: 15, offHeight: -0.08, offReach: 0.42, lean: 38, crouch: 0.26 }),
  },
  // Greataxe held two-handed.
  warden: {
    guard: pose(BASE, { handYaw: -30, handHeight: 0.05, handReach: 0.34, bladeYaw: 20, bladePitch: 55, offYaw: -5, offHeight: 0.18, offReach: 0.3, lean: 8 }),
    sweepBack: pose(BASE, { handYaw: -100, handHeight: 0.3, handReach: 0.35, bladeYaw: -170, bladePitch: 10, offYaw: -60, offHeight: 0.3, offReach: 0.26, twist: -55, lean: 6, crouch: 0.12 }),
    sweepAcross: pose(BASE, { handYaw: 70, handHeight: 0.2, handReach: 0.45, bladeYaw: 100, bladePitch: 0, offYaw: 50, offHeight: 0.2, offReach: 0.36, twist: 60, lean: 16, crouch: 0.1 }),
    raise: pose(BASE, { handYaw: -10, handHeight: 0.72, handReach: 0.12, bladeYaw: 0, bladePitch: 120, offYaw: 10, offHeight: 0.68, offReach: 0.14, lean: -12, crouch: 0.02 }),
    smash: pose(BASE, { handYaw: -5, handHeight: -0.1, handReach: 0.48, bladeYaw: 0, bladePitch: -45, offYaw: 12, offHeight: -0.06, offReach: 0.42, lean: 36, crouch: 0.28 }),
    roar: pose(BASE, { handYaw: -100, handHeight: 0.4, handReach: 0.5, bladeYaw: -100, bladePitch: 40, offYaw: 100, offHeight: 0.4, offReach: 0.5, lean: -22, crouch: 0.1 }),
  },
};

const STAGGER = pose(BASE, { handYaw: -25, handHeight: -0.22, handReach: 0.22, bladeYaw: 0, bladePitch: -70, offYaw: 30, offHeight: -0.22, offReach: 0.2, lean: 38, crouch: 0.18 });
const HEALTH_BAR_WIDTH = 0.7;

type Mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x?: number, y?: number, z?: number) => THREE.Mesh;

/** One enemy: shared rig and animation, per-kind look and poses. */
export class EnemyView {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private rig = new THREE.Group();
  private pelvis = new THREE.Group();
  private chest = new THREE.Group();
  private head = new THREE.Group();
  private arms!: Record<'R' | 'L', Arm>;
  private legs!: Record<'R' | 'L', Leg>;
  /** Right-hand weapon (cleaver, club, axe); the archer's bow sits in the left hand instead. */
  private weapon = new THREE.Group();
  private bow: Bow | null = null;
  /** Skeleton grunts' round shield, worn on the off arm. */
  private shield: THREE.Group | null = null;
  private glint: THREE.Mesh;
  private eyes: THREE.MeshBasicMaterial;
  private materials: THREE.MeshStandardMaterial[] = [];
  private stars = new THREE.Group();
  private ice: THREE.Mesh;
  private mark: THREE.Mesh;
  private hpBack: THREE.Sprite;
  private hpFill: THREE.Sprite;

  private pose: UpperPose = { ...BASE };
  private from: UpperPose = { ...BASE };
  private lastAi = '';
  private gaitPhase = Math.random() * 10;
  private lastHitAt = -1;
  private flinch = 0;
  private flinchSide = 1;
  private time = 0;

  constructor(
    readonly kind: EnemyKind,
    palette: Palette,
  ) {
    const mat = (color: number, params: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...params });
      this.materials.push(m);
      return m;
    };
    this.eyes = new THREE.MeshBasicMaterial({ color: kind === 'warden' ? 0xff8a2a : 0xff3a2a, toneMapped: false });
    const mesh: Mesh = (geo, m, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      return o;
    };

    this.root.add(this.body);
    this.body.add(this.rig);
    this.rig.add(this.pelvis);
    this.pelvis.add(this.chest);
    this.chest.position.y = DIMS.chestOffset;
    this.chest.add(this.head);
    this.head.position.y = DIMS.headHeight;
    this.body.scale.setScalar(SCALE[kind]);

    if (kind === 'warden') this.buildWarden(mat, mesh);
    else if (kind === 'brute') this.buildBrute(mat, mesh);
    else this.buildSkeleton(mat, mesh, kind === 'archer', palette);

    for (const a of Object.values(this.arms)) this.chest.add(a.upper, a.fore, a.elbow, a.hand);
    for (const l of Object.values(this.legs)) this.rig.add(l.thigh, l.shin, l.knee, l.foot);
    this.chest.add(this.weapon);

    // Telegraph glint on the weapon.
    this.glint = mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMaterial(kind === 'warden' ? 0xff9a3a : 0xff5a3a, 0), 0.08, 0.55, 0);
    this.weapon.add(this.glint);

    // Dizzy stars while staggered.
    for (let i = 0; i < 3; i++) {
      const star = mesh(new THREE.OctahedronGeometry(0.035), glowMaterial(0xffe27a, 0.9));
      star.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.17, 0.22, Math.sin((i / 3) * Math.PI * 2) * 0.17);
      this.stars.add(star);
    }
    this.stars.visible = false;
    this.head.add(this.stars);

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.glint.castShadow = false;

    // Frost ring: a translucent ice block around the body.
    this.ice = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 1.55, 7).translate(0, 0.78, 0),
      new THREE.MeshStandardMaterial({
        color: 0xbfe8ff,
        emissive: 0x2a6a9a,
        emissiveIntensity: 0.6,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.ice.visible = false;
    this.body.add(this.ice);

    // Combo mark: a ring at the feet while a cross-style setup is open on it.
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 32).rotateX(-Math.PI / 2), glowMaterial(0xffffff, 0.8));
    this.mark.position.y = 0.05;
    this.mark.visible = false;
    this.root.add(this.mark);

    // Health bar (the Warden's lives in the boss bar instead).
    this.hpBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x120c0c, depthTest: false, transparent: true, opacity: 0.8 }));
    this.hpFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd4483a, depthTest: false }));
    this.hpBack.scale.set(HEALTH_BAR_WIDTH + 0.04, 0.07, 1);
    this.hpFill.center.set(0, 0.5);
    this.hpBack.renderOrder = this.hpFill.renderOrder = 10;
    this.root.add(this.hpBack, this.hpFill);
  }

  // --- Builders ---

  private limbs(mat: (c: number) => THREE.MeshStandardMaterial, mesh: Mesh, skin: number, dark: number, foot: number, thick = 1): void {
    const s = mat(skin);
    const d = mat(dark);
    const f = mat(foot);
    const arm = (): Arm => ({
      upper: mesh(segmentGeo(0.045 * thick, 0.055 * thick, DIMS.upperArm), s),
      fore: mesh(segmentGeo(0.05 * thick, 0.045 * thick, DIMS.forearm), s),
      elbow: mesh(new THREE.SphereGeometry(0.048 * thick, 8, 6), s),
      hand: mesh(new THREE.SphereGeometry(0.05 * thick, 8, 6), d),
    });
    const leg = (): Leg => ({
      thigh: mesh(segmentGeo(0.055 * thick, 0.07 * thick, DIMS.thigh), s),
      shin: mesh(segmentGeo(0.045 * thick, 0.055 * thick, DIMS.shin), s),
      knee: mesh(new THREE.SphereGeometry(0.055 * thick, 8, 6), d),
      foot: mesh(new THREE.BoxGeometry(0.11 * thick, 0.07, 0.2 * thick).translate(0, -0.03, 0.05), f),
    });
    this.arms = { R: arm(), L: arm() };
    this.legs = { R: leg(), L: leg() };
  }

  /**
   * Grunt or archer: a skeleton warrior (M6 concept art). Grunts carry a
   * rusted sword and a round wooden shield; archers a ragged hood, quiver and
   * short bow. Red eyes burn in the sockets.
   */
  private buildSkeleton(mat: (c: number, p?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial, mesh: Mesh, archer: boolean, palette: Palette): void {
    const bone = mat(0xd6c9a8, { roughness: 0.75 });
    const boneDark = mat(0x8f8266, { roughness: 0.8 });
    const socket = new THREE.MeshBasicMaterial({ color: 0x0a0608 });
    const rag = mat(archer ? 0x3a2448 : 0x5a2620, { roughness: 1, side: THREE.DoubleSide });
    const leather = mat(0x4a3020);

    // Hips: a pelvis bone, a belt and a torn cloth.
    const hip = mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12).rotateX(Math.PI / 2), bone, 0, -0.02, 0);
    hip.scale.set(1.2, 1, 0.8);
    const loin = mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.26, 8, 1, true), rag, 0, -0.12, 0);
    this.pelvis.add(hip, loin, mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), leather, 0, 0.02, 0));

    // Spine, ribs, collarbones.
    this.chest.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), boneDark, 0, 0.18, -0.06));
    for (let i = 0; i < 4; i++) {
      const r = 0.15 - i * 0.012;
      const rib = mesh(new THREE.TorusGeometry(r, 0.016, 5, 14, Math.PI * 1.5).rotateX(Math.PI / 2), bone, 0, 0.3 - i * 0.075, -0.02);
      rib.rotation.y = Math.PI * 0.25;
      rib.scale.z = 0.8;
      this.chest.add(rib);
    }
    this.chest.add(mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), bone, 0, 0.24, 0.1));
    const collar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 6), bone, 0, 0.34, 0.02);
    collar.rotation.z = Math.PI / 2;
    this.chest.add(collar);
    if (!archer) {
      // One rusted pauldron.
      const pauldron = mesh(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a5a4e, { metalness: 0.6, roughness: 0.6 }), 0.2, 0.32, 0);
      pauldron.rotation.z = -0.4;
      this.chest.add(pauldron);
    }

    // Skull with dark sockets and burning eyes, a jaw and teeth.
    const cranium = mesh(new THREE.SphereGeometry(0.12, 14, 10), bone, 0, 0.02, 0);
    cranium.scale.set(0.95, 1, 1.1);
    const face = mesh(new THREE.BoxGeometry(0.15, 0.1, 0.1), bone, 0, -0.04, 0.06);
    const jaw = mesh(new THREE.BoxGeometry(0.12, 0.04, 0.1), boneDark, 0, -0.1, 0.05);
    const teeth = mesh(new THREE.BoxGeometry(0.1, 0.025, 0.02), bone, 0, -0.075, 0.105);
    const nose = mesh(new THREE.ConeGeometry(0.015, 0.035, 3), socket, 0, -0.03, 0.112);
    nose.rotation.x = Math.PI;
    this.head.add(cranium, face, jaw, teeth, nose);
    for (const side of [-1, 1]) {
      this.head.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), socket, side * 0.045, 0.0, 0.095));
      this.head.add(mesh(new THREE.SphereGeometry(0.015, 6, 4), this.eyes, side * 0.045, 0.0, 0.112));
    }

    // Thin bones with knobbly joints.
    const arm = (): Arm => ({
      upper: mesh(segmentGeo(0.022, 0.026, DIMS.upperArm), bone),
      fore: mesh(segmentGeo(0.02, 0.024, DIMS.forearm), bone),
      elbow: mesh(new THREE.SphereGeometry(0.035, 8, 6), boneDark),
      hand: mesh(new THREE.BoxGeometry(0.06, 0.07, 0.04), bone),
    });
    const leg = (): Leg => ({
      thigh: mesh(segmentGeo(0.026, 0.03, DIMS.thigh), bone),
      shin: mesh(segmentGeo(0.022, 0.026, DIMS.shin), bone),
      knee: mesh(new THREE.SphereGeometry(0.04, 8, 6), boneDark),
      foot: mesh(new THREE.BoxGeometry(0.07, 0.04, 0.17).translate(0, -0.03, 0.05), bone),
    });
    this.arms = { R: arm(), L: arm() };
    this.legs = { R: leg(), L: leg() };

    if (archer) {
      const hood = mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), rag, 0, 0.02, -0.02);
      hood.scale.set(1, 1.05, 1.1);
      this.head.add(hood);
      const quiver = buildQuiver(palette);
      quiver.scale.setScalar(0.8);
      quiver.position.set(-0.04, 0.02, -0.15);
      quiver.rotation.set(-0.2, 0, 0.45);
      this.chest.add(quiver);
      this.bow = new Bow(palette);
      this.bow.group.scale.setScalar(0.75);
      this.chest.add(this.bow.group);
    } else {
      // Rusted sword.
      const rust = mat(0x8a7a6a, { metalness: 0.6, roughness: 0.55 });
      const grip = mat(0x3a2418);
      this.weapon.add(
        mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6), grip, 0, 0.02, 0),
        mesh(new THREE.BoxGeometry(0.16, 0.025, 0.035), rust, 0, 0.1, 0),
        mesh(new THREE.BoxGeometry(0.05, 0.5, 0.012), rust, 0, 0.36, 0),
      );
      // Round wooden shield with an iron rim and boss, on the off arm.
      const wood = mat(0x5a3820, { roughness: 0.9 });
      const iron = mat(0x3a3430, { metalness: 0.6, roughness: 0.5 });
      const shield = new THREE.Group();
      const board = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), wood);
      board.rotation.x = Math.PI / 2;
      const rim = mesh(new THREE.TorusGeometry(0.2, 0.015, 5, 16), iron);
      const boss = mesh(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0, 0.015);
      boss.rotation.x = Math.PI / 2;
      shield.add(board, rim, boss);
      this.shield = shield;
      this.chest.add(shield);
    }
  }

  /** Grey ogre with a studded club. */
  private buildBrute(mat: (c: number, p?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial, mesh: Mesh): void {
    const skin = mat(0xa09584);
    const dark = mat(0x7d7366);
    const fur = mat(0x4a3626, { roughness: 1 });
    const iron = mat(0x4a4a4e, { metalness: 0.7, roughness: 0.45 });
    const wood = mat(0x5a3a22);
    const tusk = mat(0xe8dfc8);

    this.pelvis.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.26, 10), fur, 0, -0.1, 0), mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), iron, 0, 0.02, 0));
    const torso = mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.4, 12), skin, 0, 0.18, 0);
    torso.scale.z = 0.85;
    const belly = mesh(new THREE.SphereGeometry(0.22, 12, 10), skin, 0, 0.06, 0.06);
    const strap = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.02), fur, 0, 0.2, 0.2);
    strap.rotation.z = 0.7;
    this.chest.add(torso, belly, strap);
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.SphereGeometry(0.11, 10, 8), skin, side * 0.22, 0.32, 0);
      this.chest.add(shoulder);
    }
    // Small head sunk between the shoulders.
    this.head.position.y = DIMS.headHeight - 0.08;
    const skull = mesh(new THREE.SphereGeometry(0.12, 12, 10), skin, 0, 0, 0.04);
    const jaw = mesh(new THREE.BoxGeometry(0.18, 0.09, 0.13), dark, 0, -0.07, 0.08);
    const brow = mesh(new THREE.BoxGeometry(0.18, 0.04, 0.06), dark, 0, 0.04, 0.12);
    this.head.add(skull, jaw, brow);
    for (const side of [-1, 1]) {
      const t = mesh(new THREE.ConeGeometry(0.022, 0.08, 5), tusk, side * 0.06, -0.03, 0.14);
      const eye = mesh(new THREE.SphereGeometry(0.016, 6, 4), this.eyes, side * 0.045, 0.02, 0.14);
      this.head.add(t, eye);
    }
    this.limbs(mat, mesh, 0xa09584, 0x7d7366, 0x4a3626, 1.35);
    // Club: a thick tapered log with iron studs.
    const club = mesh(segmentGeo(0.12, 0.05, 0.95, 10).translate(0, -0.15, 0), wood);
    this.weapon.add(club);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stud = mesh(new THREE.ConeGeometry(0.03, 0.07, 5), iron, Math.cos(a) * 0.11, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.11);
      stud.rotation.set(Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57);
      this.weapon.add(stud);
    }
  }

  /** The Warden: an armoured giant with a horned helm and a greataxe. */
  private buildWarden(mat: (c: number, p?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial, mesh: Mesh): void {
    const plate = mat(0x5a5f6a, { metalness: 0.6, roughness: 0.45 });
    const plateLight = mat(0x7c818c, { metalness: 0.6, roughness: 0.4 });
    const cloth = mat(0x5a1a1a, { roughness: 0.9 });
    const bone = mat(0xd8cfb8, { roughness: 0.7 });
    const wood = mat(0x3a2616);
    const gold = mat(0xa8823a, { metalness: 0.85, roughness: 0.35 });

    this.pelvis.add(mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.3, 10), cloth, 0, -0.12, 0), mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 10), gold, 0, 0.02, 0));
    const torso = mesh(new THREE.CylinderGeometry(0.25, 0.19, 0.42, 12), plate, 0, 0.19, 0);
    torso.scale.z = 0.8;
    const tabard = mesh(new THREE.BoxGeometry(0.2, 0.36, 0.02), cloth, 0, 0.12, 0.17);
    this.chest.add(torso, tabard);
    for (const side of [-1, 1]) {
      const pauldron = mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plateLight, side * 0.22, 0.31, 0);
      pauldron.rotation.z = -side * 0.4;
      const spike = mesh(new THREE.ConeGeometry(0.025, 0.12, 6), bone, side * 0.27, 0.4, 0);
      spike.rotation.z = -side * 0.5;
      this.chest.add(pauldron, spike);
    }
    // Horned great helm with a burning visor.
    const helm = mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 12), plate);
    const dome = mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate, 0, 0.12, 0);
    const visor = mesh(new THREE.BoxGeometry(0.17, 0.025, 0.03), this.eyes, 0, 0.02, 0.118);
    this.head.add(helm, dome, visor);
    for (const side of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.035, 0.26, 8), bone, side * 0.15, 0.13, 0);
      horn.rotation.set(0, 0, -side * 0.9);
      this.head.add(horn);
    }
    this.limbs(mat, mesh, 0x5a5f6a, 0x3c3f46, 0x3c3f46, 1.3);
    // Greataxe: long haft, crescent blade at the top.
    this.weapon.add(mesh(segmentGeo(0.025, 0.03, 1.3, 8).translate(0, -0.35, 0), wood));
    const blade = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16, 1, false, -Math.PI / 2.4, Math.PI / 1.2), plateLight, 0.05, 0.82, 0);
    blade.rotation.z = Math.PI / 2;
    this.weapon.add(blade, mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), gold, 0, 0.82, 0));
  }

  // --- Per-frame ---

  update(prev: EnemyState, curr: EnemyState, alpha: number, dt: number, simTime: number): void {
    const stats = enemyStats(curr.kind);
    this.time += dt;

    this.root.position.set(prev.x + (curr.x - prev.x) * alpha, prev.y + (curr.y - prev.y) * alpha, prev.z + (curr.z - prev.z) * alpha);
    const yaw = lerpAngle(prev.yaw, curr.yaw, alpha);
    this.root.rotation.y = yaw;
    // Hitstop jitter on the target sells the impact.
    if (curr.hitstop > 0) this.body.position.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06);
    else this.body.position.set(0, 0, 0);

    // Hit reaction: white flash, and a flinch on light enemies (a small rock on big ones).
    if (curr.lastHitAt !== this.lastHitAt) {
      this.lastHitAt = curr.lastHitAt;
      this.flinch = curr.kind === 'grunt' || curr.kind === 'archer' ? 1 : 0.25;
      this.flinchSide = Math.random() < 0.5 ? -1 : 1;
    }
    this.flinch *= Math.exp(-9 * dt);
    const flash = curr.lastHitAt >= 0 && simTime - curr.lastHitAt < tuning.hitFeel.flashMs / 1000;
    const frozen = curr.frozen > 0;
    for (const m of this.materials) {
      if (flash) m.emissive.setScalar(tuning.hitFeel.flashStrength);
      else if (frozen) m.emissive.setRGB(0.12, 0.3, 0.55);
      else m.emissive.setScalar(0);
    }
    this.ice.visible = frozen;
    // Open combo setups (newest wins): shatter ice-blue, skewer gold, detonate orange.
    const marks: [number, number][] = [
      [curr.shatterUntil, 0x9fdcff],
      [curr.skewerUntil, 0xffd27a],
      [curr.detonateUntil, 0xff7a3a],
    ];
    const live = marks.filter(([t]) => t >= simTime && curr.ai !== 'dead').sort((a, b) => b[0] - a[0]);
    this.mark.visible = live.length > 0;
    if (live.length) {
      const m = this.mark.material as THREE.MeshBasicMaterial;
      m.color.setHex(live[0][1]);
      // Blinks faster as the window runs out.
      const left = live[0][0] - simTime;
      m.opacity = 0.55 + 0.35 * Math.abs(Math.sin(this.time * (left < 0.6 ? 16 : 5)));
      this.mark.scale.setScalar(stats.radius / 0.42);
    }

    // Upper body by AI state.
    if (curr.ai !== this.lastAi) {
      this.from = { ...this.pose };
      this.lastAi = curr.ai;
    }
    const speed = Math.hypot(curr.vx, curr.vz);
    const run = Math.min(1, speed / stats.moveSpeed);
    const target = this.targetPose(curr, run);
    const snappy = !['chase', 'spawn', 'recover', 'stagger', 'dead'].includes(curr.ai);
    if (frozen) {
      // Hold whatever pose it was in.
    } else if (snappy) Object.assign(this.pose, target);
    else lerpPose(this.pose, target, 1 - Math.exp(-12 * dt), this.pose);
    const p = this.pose;
    const lean = p.lean - this.flinch * 22;
    const twist = p.twist + this.flinch * 18 * this.flinchSide;

    // Telegraphs: eyes flare and the weapon glints through every windup.
    const windup = windupProgress(curr);
    this.eyes.color.setRGB(1 + windup * 3, (curr.kind === 'warden' ? 0.55 : 0.23) + windup * 0.4, 0.16);
    const glintMat = this.glint.material as THREE.MeshBasicMaterial;
    glintMat.opacity = windup > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(this.time * 18)) : 0;
    this.glint.scale.setScalar(1 + windup * 1.5);

    // Spawn: climb out of the floor. Death: topple and sink.
    let rise = 0;
    let topple = 0;
    if (curr.ai === 'spawn') rise = -1.4 * (1 - easeOut(clamp01(curr.aiTime / (stats.spawnMs / 1000))));
    if (curr.ai === 'dead') {
      const u = curr.aiTime / (stats.deathMs / 1000);
      topple = easeOut(clamp01(u * 2.5));
      rise = -0.6 * clamp01((u - 0.6) / 0.4);
    }
    this.rig.position.y = rise;
    this.body.rotation.x = (curr.kind === 'warden' ? 1 : -1) * topple * Math.PI * 0.48;

    this.pelvis.position.y = DIMS.hipHeight - p.crouch;
    this.pelvis.rotation.set(lean * 0.4 * DEG, twist * 0.3 * DEG, 0);
    this.chest.rotation.set(lean * 0.6 * DEG, twist * 0.7 * DEG, 0);
    const roarTilt = curr.ai === 'roar' ? -0.5 : 0;
    this.head.rotation.set(-lean * 0.45 * DEG + roarTilt, -twist * 0.4 * DEG, curr.ai === 'stagger' ? Math.sin(this.time * 6) * 0.25 : 0);

    this.stars.visible = curr.ai === 'stagger';
    this.stars.rotation.y = this.time * 5;

    const { hand, offHand } = poseArms(p, DIMS, this.arms);
    const dir = direction(p.bladeYaw, p.bladePitch);
    if (this.bow) {
      // Archer: bow in the left hand, string drawn by the right.
      const y = dir;
      const z = direction(p.offYaw, 0);
      z.addScaledVector(y, -z.dot(y)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      this.bow.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      this.bow.group.position.copy(offHand);
      const handInBow = hand
        .clone()
        .sub(offHand)
        .applyQuaternion(this.bow.group.quaternion.clone().invert())
        .divideScalar(this.bow.group.scale.x);
      this.bow.setNock(this.bow.restNock().lerp(handInBow, clamp01(p.draw)));
      this.weapon.position.copy(offHand);
    } else {
      this.weapon.position.copy(hand);
      this.weapon.quaternion.setFromUnitVectors(UP, dir);
    }
    if (this.shield) {
      this.shield.position.copy(offHand).addScaledVector(direction(p.offYaw, 0), 0.05);
      this.shield.rotation.set(0, p.offYaw * DEG * 0.8, 0);
    }

    // Legs.
    const stride = 1.5;
    this.gaitPhase += ((2 * Math.PI * speed) / stride / SCALE[curr.kind]) * dt;
    const localFwd = curr.vx * Math.sin(yaw) + curr.vz * Math.cos(yaw);
    const localSide = curr.vx * Math.cos(yaw) - curr.vz * Math.sin(yaw);
    poseLegs(this.pelvis, this.legs, DIMS, {
      phase: this.gaitPhase,
      stepAmp: Math.min(0.32, stride / (2 * Math.PI)) * Math.min(1, speed / 0.5),
      stepHeight: 0.12,
      dir: speed > 0.05 ? { x: localSide / speed, z: localFwd / speed } : { x: 0, z: 1 },
      still: 1 - run,
      widen: Math.min(1, p.crouch / 0.15),
      tuck: 0,
    });

    // Health bar (not for the boss).
    const hurt = curr.kind !== 'warden' && curr.hp < curr.maxHp && curr.ai !== 'dead' && curr.ai !== 'spawn';
    this.hpBack.visible = this.hpFill.visible = hurt;
    if (hurt) {
      const top = stats.height + 0.3;
      const frac = clamp01(curr.hp / curr.maxHp);
      this.hpBack.position.set(0, top, 0);
      this.hpFill.position.set(-HEALTH_BAR_WIDTH / 2, top, 0);
      this.hpFill.scale.set(HEALTH_BAR_WIDTH * frac, 0.045, 1);
      (this.hpFill.material as THREE.SpriteMaterial).color.setHex(curr.ai === 'stagger' ? 0xffc35a : 0xd4483a);
    }
  }

  /** Pose for the current AI state and time in it. */
  private targetPose(e: EnemyState, run: number): UpperPose {
    const P = POSES[e.kind];
    const t = e.aiTime;
    const guard = P.guard;
    const swing = Math.sin(this.gaitPhase) * run;
    const locomotion = pose(guard, {
      handYaw: guard.handYaw + swing * 12,
      offYaw: guard.offYaw - swing * 12,
      handHeight: guard.handHeight + Math.sin(this.time * 2.4) * 0.01,
      lean: guard.lean + run * 8,
    });
    const out = { ...guard };
    const g = tuning.grunt;
    const into = (a: UpperPose, b: UpperPose, u: number, ease = easeInOut) => lerpPose(a, b, ease(clamp01(u)), out);
    switch (e.ai) {
      case 'stagger':
        return pose(STAGGER, { twist: Math.sin(this.time * 5) * 14 });
      case 'dead':
        return pose(STAGGER, { lean: -10 });
      case 'recover':
        return into(this.from, locomotion, t / Math.max(0.1, e.recoverTime));
    }
    switch (e.kind) {
      case 'grunt':
        switch (e.ai) {
          case 'windup': {
            // Rise into the raised pose over the first 60%, then hold with a tremble.
            into(this.from, P.windup, t / ((g.telegraphMs / 1000) * 0.6));
            out.handHeight += Math.sin(this.time * 40) * 0.008;
            return out;
          }
          case 'slash1':
            return into(P.windup, P.slash1, t / (g.slashActiveMs / 1000), easeOut);
          case 'between':
            return into(P.slash1, P.between, t / (g.betweenSlashesMs / 1000));
          case 'slash2':
            return into(P.between, P.slash2, t / (g.slashActiveMs / 1000), easeOut);
        }
        break;
      case 'archer':
        switch (e.ai) {
          case 'aim':
            return into(this.from, P.aim, t / 0.3);
          case 'shoot':
            return into(P.aim, P.loose, t / 0.08, easeOut);
        }
        break;
      case 'brute':
        switch (e.ai) {
          case 'slamWindup': {
            into(this.from, P.raise, t / ((tuning.brute.telegraphMs / 1000) * 0.6));
            out.handHeight += Math.sin(this.time * 35) * 0.01;
            return out;
          }
          case 'slam':
            return into(P.raise, P.smash, t / (tuning.brute.slamActiveMs / 1000), easeOut);
        }
        break;
      case 'warden': {
        const w = tuning.warden;
        const scale = e.phase >= 2 ? w.phase2TelegraphScale : 1;
        switch (e.ai) {
          case 'sweepWindup':
            return into(this.from, P.sweepBack, t / ((w.sweepTelegraphMs / 1000) * scale * 0.7));
          case 'sweep':
            return into(P.sweepBack, P.sweepAcross, t / (w.sweepActiveMs / 1000), easeOut);
          case 'slamWindup': {
            into(this.from, P.raise, t / ((w.slamTelegraphMs / 1000) * scale * 0.6));
            out.handHeight += Math.sin(this.time * 30) * 0.01;
            return out;
          }
          case 'slam':
            return into(P.raise, P.smash, t / (w.slamActiveMs / 1000), easeOut);
          case 'roar':
            return into(this.from, P.roar, t / 0.35);
        }
        break;
      }
    }
    return locomotion;
  }

  dispose(): void {
    // Sprites share three's global quad geometry, so only meshes give theirs back.
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      } else if (o instanceof THREE.Sprite) {
        o.material.dispose();
      }
    });
  }
}

/** 0..1 through any telegraphed windup (drives eye flare, glint and the ground telegraphs). */
function wardenScale(e: EnemyState): number {
  return e.phase >= 2 ? tuning.warden.phase2TelegraphScale : 1;
}

export function windupProgress(e: EnemyState): number {
  const t = e.aiTime;
  switch (e.ai) {
    case 'windup':
      return clamp01(t / (tuning.grunt.telegraphMs / 1000));
    case 'aim':
      return clamp01(t / (tuning.archer.aimMs / 1000));
    case 'slamWindup':
      return e.kind === 'brute' ? clamp01(t / (tuning.brute.telegraphMs / 1000)) : clamp01(t / ((tuning.warden.slamTelegraphMs / 1000) * wardenScale(e)));
    case 'sweepWindup':
      return clamp01(t / ((tuning.warden.sweepTelegraphMs / 1000) * wardenScale(e)));
    case 'roar':
      return 1;
    default:
      return 0;
  }
}

/** Keeps one EnemyView per enemy in the sim. */
export class EnemiesView {
  readonly group = new THREE.Group();
  private views = new Map<number, EnemyView>();

  constructor(private palette: Palette) {}

  update(prev: EnemyState[], curr: EnemyState[], alpha: number, dt: number, simTime: number): void {
    const prevById = new Map(prev.map((e) => [e.id, e]));
    const alive = new Set<number>();
    for (const e of curr) {
      alive.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = new EnemyView(e.kind, this.palette);
        this.views.set(e.id, v);
        this.group.add(v.root);
      }
      v.update(prevById.get(e.id) ?? e, e, alpha, dt, simTime);
    }
    for (const [id, v] of this.views) {
      if (alive.has(id)) continue;
      this.group.remove(v.root);
      v.dispose();
      this.views.delete(id);
    }
  }
}
