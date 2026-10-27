import * as THREE from 'three';
import { abilityTiming, tuning, type AbilityKind, type Style } from '@hearthgate/shared/config/tuning';
import type { PlayerState } from '@hearthgate/shared/sim/types';
import { BODY, buildArcher, buildKnight, buildMage, type Outfit } from './outfits';
import { ARROW_LENGTH, Bow, FORWARD, FROST, Palette, Staff, UP, buildArrow, buildShield, buildSword, glowMaterial } from './props';
import {
  DEG,
  clamp01,
  direction,
  easeOut,
  hermitePose,
  lerpAngle,
  lerpPose,
  pose,
  poseArms,
  poseLegs,
  wrapDeg,
  type UpperPose,
} from './rig';
import { WeaponTrail } from './WeaponTrail';
import { levelFor } from '@hearthgate/shared/sim/gear';
import { heroHit } from '@hearthgate/shared/sim/talents';

type PoseSet = {
  guard: UpperPose;
  windup: UpperPose[];
  strike: UpperPose[];
  /** Extra airborne arc (m) during each attack's active phase: leaps. */
  hop: number[];
};

const SWORD_GUARD: UpperPose = {
  handYaw: -30,
  handHeight: 0.02,
  handReach: 0.36,
  bladeYaw: -8,
  bladePitch: 58,
  offYaw: 50,
  offHeight: 0.06,
  offReach: 0.3,
  twist: 0,
  lean: 4,
  crouch: 0.03,
  draw: 0,
  spin: 0,
  flip: 0,
  lift: 0,
};

const BOW_GUARD = pose(SWORD_GUARD, {
  handYaw: -28,
  handHeight: 0.06,
  handReach: 0.28,
  bladeYaw: 75,
  bladePitch: 66,
  offYaw: 62,
  offHeight: -0.02,
  offReach: 0.34,
});
// Archer's stance: left shoulder to the target, bow arm straight, string hand anchored at the cheek.
const BOW_AIM = pose(BOW_GUARD, {
  handYaw: -26,
  handHeight: 0.5,
  handReach: 0.11,
  bladeYaw: 38,
  bladePitch: 84,
  offYaw: 35,
  offHeight: 0.42,
  offReach: 0.62,
  twist: -40,
  lean: 2,
  crouch: 0.05,
  draw: 1,
});
const BOW_LOOSE = pose(BOW_AIM, { handYaw: -70, handHeight: 0.52, handReach: 0.16, draw: 0 });

const STAFF_GUARD = pose(SWORD_GUARD, {
  handYaw: -35,
  handHeight: 0.05,
  handReach: 0.3,
  bladeYaw: -10,
  bladePitch: 80,
  offYaw: 40,
  offHeight: 0.02,
  offReach: 0.28,
});

/**
 * Chain keyframes per hero: the pose at the end of each windup and at the end
 * of each active phase (knight) or release (archer, mage). Timings come from
 * tuning. spin/flip are whole-body turns in degrees (negative spin = clockwise
 * from above, negative flip = backflip); lift raises the whole body.
 */
const POSES: Record<Style, PoseSet> = {
  // 1 forehand high-right to low-left, 2 rising backhand, 3 low sweep, 4 full spinning slash, 5 leaping overhead slam.
  sword: {
    guard: SWORD_GUARD,
    windup: [
      pose(SWORD_GUARD, { handYaw: -75, handHeight: 0.62, handReach: 0.24, bladeYaw: -115, bladePitch: 40, offYaw: 40, offHeight: 0.12, offReach: 0.3, twist: -35, lean: 0, crouch: 0.05 }),
      pose(SWORD_GUARD, { handYaw: 40, handHeight: 0.25, handReach: 0.3, bladeYaw: 80, bladePitch: 12, offYaw: 60, offHeight: 0.1, offReach: 0.22, twist: 40, lean: 6, crouch: 0.06 }),
      pose(SWORD_GUARD, { handYaw: 65, handHeight: -0.05, handReach: 0.32, bladeYaw: 40, bladePitch: -6, offYaw: 70, offHeight: 0.15, offReach: 0.2, twist: 60, lean: 16, crouch: 0.16 }),
      pose(SWORD_GUARD, { handYaw: -95, handHeight: 0.1, handReach: 0.3, bladeYaw: -160, bladePitch: 5, offYaw: 75, offHeight: 0.15, offReach: 0.2, twist: 45, lean: 10, crouch: 0.14 }),
      pose(SWORD_GUARD, { handYaw: -15, handHeight: 0.72, handReach: 0.12, bladeYaw: 0, bladePitch: 125, offYaw: 20, offHeight: 0.62, offReach: 0.15, twist: 0, lean: -10, crouch: 0.24 }),
    ],
    strike: [
      pose(SWORD_GUARD, { handYaw: 25, handHeight: 0.0, handReach: 0.42, bladeYaw: 55, bladePitch: -30, offYaw: 55, offHeight: 0.05, offReach: 0.22, twist: 35, lean: 14, crouch: 0.1 }),
      pose(SWORD_GUARD, { handYaw: -80, handHeight: 0.35, handReach: 0.48, bladeYaw: -50, bladePitch: 12, offYaw: 30, offHeight: 0.1, offReach: 0.3, twist: -40, lean: 10, crouch: 0.08 }),
      pose(SWORD_GUARD, { handYaw: -50, handHeight: 0.0, handReach: 0.5, bladeYaw: -35, bladePitch: -6, offYaw: 20, offHeight: 0.15, offReach: 0.35, twist: -65, lean: 16, crouch: 0.14 }),
      pose(SWORD_GUARD, { handYaw: -90, handHeight: 0.12, handReach: 0.52, bladeYaw: -95, bladePitch: 0, offYaw: 80, offHeight: 0.2, offReach: 0.3, twist: -30, lean: 12, crouch: 0.12, spin: -360 }),
      pose(SWORD_GUARD, { handYaw: -5, handHeight: -0.15, handReach: 0.55, bladeYaw: 0, bladePitch: -40, offYaw: 20, offHeight: -0.05, offReach: 0.45, twist: 0, lean: 30, crouch: 0.28 }),
    ],
    hop: [0, 0, 0, 0, 0.9],
  },
  // 1-2 quick shots, 3 deep power draw, 4 spin into a fan of arrows, 5 piercing shot then backflip away.
  bow: {
    guard: BOW_GUARD,
    windup: [
      BOW_AIM,
      BOW_AIM,
      pose(BOW_AIM, { twist: -50, lean: 6, crouch: 0.1, handYaw: -32, handReach: 0.06 }),
      pose(BOW_AIM, { spin: -360, crouch: 0.12, offHeight: 0.36 }),
      pose(BOW_AIM, { twist: -55, lean: 8, crouch: 0.14, handYaw: -34, handReach: 0.05 }),
    ],
    strike: [
      BOW_LOOSE,
      BOW_LOOSE,
      pose(BOW_LOOSE, { twist: -45, lean: 8, crouch: 0.08, handYaw: -85, handReach: 0.2 }),
      pose(BOW_LOOSE, { spin: -360, crouch: 0.1, handYaw: -80 }),
      pose(BOW_LOOSE, { flip: -360, handYaw: -60, offHeight: 0.3, crouch: 0.1 }),
    ],
    hop: [0, 0, 0, 0, 0.75],
  },
  // 1 thrust bolt, 2 cross-body bolt, 3 overhead slam burst, 4 twirl into a nova of bolts, 5 levitate and slam a great burst.
  staff: {
    guard: STAFF_GUARD,
    windup: [
      pose(STAFF_GUARD, { handYaw: -60, handHeight: 0.25, handReach: 0.22, bladeYaw: -160, bladePitch: 55, offYaw: 15, offHeight: 0.35, offReach: 0.42, twist: -20, lean: 0 }),
      pose(STAFF_GUARD, { handYaw: 25, handHeight: 0.32, handReach: 0.3, bladeYaw: 80, bladePitch: 45, offYaw: 50, offHeight: 0.1, offReach: 0.25, twist: 30, lean: 4 }),
      pose(STAFF_GUARD, { handYaw: -15, handHeight: 0.78, handReach: 0.12, bladeYaw: 0, bladePitch: 88, offYaw: 15, offHeight: 0.72, offReach: 0.12, twist: 0, lean: -8, crouch: 0 }),
      pose(STAFF_GUARD, { handYaw: -10, handHeight: 0.6, handReach: 0.28, bladeYaw: -90, bladePitch: 0, offYaw: 20, offHeight: 0.58, offReach: 0.28, lean: -4, crouch: 0, spin: -360, lift: 0.25 }),
      pose(STAFF_GUARD, { handYaw: -10, handHeight: 0.8, handReach: 0.1, bladeYaw: 0, bladePitch: 90, offYaw: 10, offHeight: 0.75, offReach: 0.1, lean: -10, crouch: 0, lift: 0.7 }),
    ],
    strike: [
      pose(STAFF_GUARD, { handYaw: -12, handHeight: 0.32, handReach: 0.5, bladeYaw: 0, bladePitch: 25, offYaw: 55, offHeight: 0.08, offReach: 0.25, twist: 15, lean: 10 }),
      pose(STAFF_GUARD, { handYaw: -40, handHeight: 0.38, handReach: 0.5, bladeYaw: -15, bladePitch: 25, offYaw: 30, offHeight: 0.3, offReach: 0.45, twist: -15, lean: 10 }),
      pose(STAFF_GUARD, { handYaw: -5, handHeight: 0.05, handReach: 0.55, bladeYaw: 0, bladePitch: -15, offYaw: 25, offHeight: 0.05, offReach: 0.45, twist: 0, lean: 24, crouch: 0.2 }),
      pose(STAFF_GUARD, { handYaw: -20, handHeight: 0.05, handReach: 0.3, bladeYaw: 0, bladePitch: 90, offYaw: 30, offHeight: 0.3, offReach: 0.42, lean: 10, crouch: 0.15, spin: -360 }),
      pose(STAFF_GUARD, { handYaw: -5, handHeight: 0.0, handReach: 0.55, bladeYaw: 0, bladePitch: -25, offYaw: 25, offHeight: 0.0, offReach: 0.45, lean: 28, crouch: 0.25 }),
    ],
    hop: [0, 0, 0, 0, 0],
  },
};

/** Arms and weapon pulled in for the dodge roll. */
const TUCK: Partial<UpperPose> = {
  handYaw: -20,
  handHeight: 0.0,
  handReach: 0.22,
  offYaw: 20,
  offHeight: 0.1,
  offReach: 0.22,
  twist: 0,
  lean: 30,
  crouch: 0.3,
  draw: 0,
};

/** Knocked down: on one knee, slumped, weapon lowered. */
const DOWN: Partial<UpperPose> = {
  handYaw: -25,
  handHeight: -0.25,
  handReach: 0.25,
  bladePitch: -40,
  offYaw: 25,
  offHeight: -0.25,
  offReach: 0.25,
  twist: 0,
  lean: 40,
  crouch: 0.42,
  draw: 0,
};

const ROLL_X = new THREE.Vector3(1, 0, 0);

/** Ability keyframes: windup end and active end (the effect fires between them). hop = airborne arc during active. */
const ABILITY_POSES: Record<AbilityKind, { windup: UpperPose; strike: UpperPose; hop: number }> = {
  // Shield first, sword trailing, low and leaning into the dash.
  charge: {
    windup: pose(SWORD_GUARD, { crouch: 0.2, lean: 12, offYaw: 20, offHeight: 0.2, offReach: 0.4, handYaw: -50, bladeYaw: -150, bladePitch: 20 }),
    strike: pose(SWORD_GUARD, { crouch: 0.14, lean: 32, offYaw: 8, offHeight: 0.26, offReach: 0.46, handYaw: -60, handHeight: 0, handReach: 0.3, bladeYaw: -170, bladePitch: 10 }),
    hop: 0,
  },
  // Coil, then spin with the blade held straight out.
  whirlwind: {
    windup: pose(SWORD_GUARD, { handYaw: -95, handHeight: 0.1, handReach: 0.3, bladeYaw: -160, bladePitch: 5, offYaw: 75, twist: 45, lean: 10, crouch: 0.14 }),
    strike: pose(SWORD_GUARD, { handYaw: -90, handHeight: 0.12, handReach: 0.52, bladeYaw: -95, bladePitch: 0, offYaw: 80, offHeight: 0.2, offReach: 0.3, twist: -20, lean: 10, crouch: 0.12 }),
    hop: 0,
  },
  // Deep draw with the bow canted for a spread, then loose.
  volley: {
    windup: pose(POSES.bow.windup[0], { bladePitch: 62, twist: -45, crouch: 0.1, lean: 4 }),
    strike: pose(POSES.bow.strike[0], { bladePitch: 62, twist: -45, crouch: 0.08 }),
    hop: 0,
  },
  // Snap shot, then backflip away.
  disengage: {
    windup: POSES.bow.windup[0],
    strike: pose(POSES.bow.strike[0], { flip: -360, handYaw: -60, offHeight: 0.3, crouch: 0.1 }),
    hop: 0.6,
  },
  // Staff overhead, then planted hard with a palm to the floor.
  frostRing: {
    windup: POSES.staff.windup[2],
    strike: pose(STAFF_GUARD, { handYaw: -20, handHeight: 0.0, handReach: 0.3, bladeYaw: 0, bladePitch: 90, offYaw: 30, offHeight: -0.2, offReach: 0.42, lean: 26, crouch: 0.28 }),
    hop: 0,
  },
  // A quick crouch; the body vanishes and reappears (see vanish below).
  blink: {
    windup: pose(STAFF_GUARD, { crouch: 0.12, lean: 10 }),
    strike: STAFF_GUARD,
    hop: 0,
  },
};

/**
 * Guard stances: knight behind the raised shield, archer with the bow held
 * across the chest, mage with the staff barred in front.
 */
const GUARD_POSES: Record<Style, UpperPose> = {
  sword: pose(SWORD_GUARD, { offYaw: 4, offHeight: 0.3, offReach: 0.44, handYaw: -55, handHeight: 0.18, handReach: 0.24, bladeYaw: -20, bladePitch: 78, crouch: 0.13, lean: 8, twist: 6 }),
  bow: pose(BOW_GUARD, { offYaw: 6, offHeight: 0.32, offReach: 0.44, bladeYaw: 90, bladePitch: 8, handYaw: -14, handHeight: 0.3, handReach: 0.4, crouch: 0.13, lean: 8, draw: 0 }),
  staff: pose(STAFF_GUARD, { handYaw: -32, handHeight: 0.32, handReach: 0.42, bladeYaw: 88, bladePitch: 12, offYaw: 20, offHeight: 0.34, offReach: 0.44, crouch: 0.13, lean: 8 }),
};

/** Guard ward colour per hero. */
const WARD_COLORS: Record<Style, number> = { sword: 0xffe0a0, bow: 0xb8f08a, staff: 0x8fdcff };

/** Height of the roll pivot above the feet. */
const ROLL_PIVOT = 0.85;

const SWAP_FX_LIFE = 0.4;

/**
 * The player's hero: one procedurally animated, IK-driven skeleton dressed as
 * a knight (sword), archer (bow) or mage (staff). Swapping style swaps the
 * character with a flash. Stand-in until rigged models and clips are in
 * assets/; the sim doesn't care either way.
 */
export class HeroView {
  readonly root = new THREE.Group();
  /** Whole-body spin and lift for attacks; the dodge roll and flips pivot inside it. */
  private spinGroup = new THREE.Group();
  private rollPivot = new THREE.Group();
  private rig = new THREE.Group();
  private pelvis = new THREE.Group();
  private chest = new THREE.Group();
  private head = new THREE.Group();
  private outfits: Record<Style, Outfit>;
  private outfit: Outfit;

  private sword: THREE.Group;
  private shield: THREE.Group;
  private bow: Bow;
  private nockedArrow: THREE.Group;
  private arrowHead: THREE.MeshStandardMaterial;
  private staff: Staff;
  private swapFx: THREE.Mesh;
  /** World-space effects owned by the hero (weapon trails); add to the scene, not to root. */
  readonly effects = new THREE.Group();
  private swordTrail = new WeaponTrail(0xfff1d6);
  private staffTrail = new WeaponTrail(FROST);
  private trailStrength = 0;
  /** Level 5 weapon glow overlays (brief: "cosmetic weapon glow"). */
  private glows: Record<Style, THREE.Mesh>;
  private swapFxAge = SWAP_FX_LIFE;
  /** Faint curved ward in front while guarding; flares on a parry or block. */
  private ward: THREE.Mesh;
  private wardFlash = 0;
  private parryFlick = 0;
  private lastParrySeq = 0;
  private lastBlockSeq = 0;

  private shownStyle: Style | null = null;
  private pose: UpperPose = { ...SWORD_GUARD };
  private attackFrom: UpperPose = { ...SWORD_GUARD };
  private lastAttackSeq = -1;
  private lastAbilitySeq = -1;
  /** 0..1 body scale for Blink's vanish. */
  private vanish = 1;
  private gaitPhase = 0;
  private landCrouch = 0;
  private wasGrounded = true;
  private airWeight = 0;
  private castFlash = 0;
  private attackHop = 0;
  /** Glow on a power shot's nocked arrowhead, 0..1. */
  private arrowGlow = 0;
  private time = 0;

  constructor(palette: Palette) {
    const p = palette;

    // Hierarchy: root (world) > rollPivot (dodge roll) > rig > pelvis > chest > head.
    this.root.add(this.spinGroup);
    this.spinGroup.add(this.rollPivot);
    this.rollPivot.position.y = ROLL_PIVOT;
    this.rollPivot.add(this.rig);
    this.rig.position.y = -ROLL_PIVOT;
    this.rig.add(this.pelvis);
    this.pelvis.add(this.chest);
    this.chest.position.y = BODY.chestOffset;
    this.chest.add(this.head);
    this.head.position.y = BODY.headHeight;

    // Every outfit hangs on the same joints; only the active one is visible.
    this.outfits = { sword: buildKnight(p), bow: buildArcher(p), staff: buildMage(p) };
    for (const o of Object.values(this.outfits)) {
      this.pelvis.add(o.pelvis);
      this.chest.add(o.chest);
      this.head.add(o.head);
      for (const a of Object.values(o.arms)) this.chest.add(a.upper, a.fore, a.elbow, a.hand);
      for (const l of Object.values(o.legs)) this.rig.add(l.thigh, l.shin, l.knee, l.foot);
    }
    this.outfit = this.outfits.sword;

    // Each hero's weapon; only the active one is shown.
    this.sword = buildSword(p);
    this.shield = buildShield(p);
    this.staff = new Staff(p);
    this.bow = new Bow(p);
    this.arrowHead = p.make({ color: 0x40444a, emissive: 0xffb347, emissiveIntensity: 0, metalness: 0.6, roughness: 0.4 });
    this.nockedArrow = buildArrow(p, this.arrowHead);
    this.bow.group.add(this.nockedArrow);
    this.chest.add(this.sword, this.shield, this.staff.group, this.bow.group);

    // Additive copies of each weapon's main mesh, shown at level 5.
    const blade = this.sword.children[3] as THREE.Mesh;
    const swordGlow = new THREE.Mesh(blade.geometry, glowMaterial(0xffc35a, 0.55));
    swordGlow.position.copy(blade.position);
    swordGlow.scale.set(1.5, 1.04, 2.5);
    this.sword.add(swordGlow);
    const bowGlow = new THREE.Mesh(this.bow.limbs.geometry, glowMaterial(0x9be27a, 0.6));
    bowGlow.scale.set(1.6, 1.01, 1.6);
    this.bow.group.add(bowGlow);
    const staffGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), glowMaterial(0x7fd8ff, 0.25));
    staffGlow.position.y = this.staff.topY;
    this.staff.group.add(staffGlow);
    this.glows = { sword: swordGlow, bow: bowGlow, staff: staffGlow };
    for (const g of Object.values(this.glows)) g.visible = false;

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    // Swap flash: a burst of the new hero's colour around the body (no shadow).
    this.swapFx = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMaterial(0xffffff, 0));
    this.swapFx.position.y = 0.9;
    this.swapFx.visible = false;
    this.root.add(this.swapFx);
    this.effects.add(this.swordTrail.mesh, this.staffTrail.mesh);

    // A slice of a sphere in front of the hero, facing outward.
    const wardGeo = new THREE.SphereGeometry(0.85, 28, 14, Math.PI / 2 - 0.95, 1.9, 0.75, 1.55);
    this.ward = new THREE.Mesh(wardGeo, glowMaterial(0xffffff, 0));
    (this.ward.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    this.ward.position.y = 1.0;
    this.ward.castShadow = false;
    this.ward.visible = false;
    this.root.add(this.ward);
  }

  /** Show one hero's outfit and weapons, hide the others. */
  private showStyle(style: Style): void {
    for (const [s, o] of Object.entries(this.outfits) as [Style, Outfit][]) {
      const on = s === style;
      o.pelvis.visible = o.chest.visible = o.head.visible = on;
      for (const a of Object.values(o.arms)) a.upper.visible = a.fore.visible = a.elbow.visible = a.hand.visible = on;
      for (const l of Object.values(o.legs)) l.thigh.visible = l.shin.visible = l.knee.visible = l.foot.visible = on;
    }
    this.outfit = this.outfits[style];
    this.sword.visible = this.shield.visible = style === 'sword';
    this.bow.group.visible = style === 'bow';
    this.staff.group.visible = style === 'staff';
    if (this.shownStyle !== null) {
      this.swapFxAge = 0;
      (this.swapFx.material as THREE.MeshBasicMaterial).color.setHex(this.outfit.accent);
    }
    this.shownStyle = style;
  }

  update(prev: PlayerState, curr: PlayerState, alpha: number, dt: number): void {
    const anim = tuning.heroAnim;
    this.time += dt;
    if (curr.style !== this.shownStyle) this.showStyle(curr.style);
    for (const [s, g] of Object.entries(this.glows) as [Style, THREE.Mesh][]) {
      g.visible = levelFor(curr.xp[s]) >= 5;
      (g.material as THREE.MeshBasicMaterial).opacity = (s === 'staff' ? 0.25 : 0.5) * (0.75 + 0.25 * Math.sin(this.time * 4));
    }

    // Root transform, interpolated between sim ticks.
    this.root.position.set(
      prev.x + (curr.x - prev.x) * alpha,
      prev.y + (curr.y - prev.y) * alpha,
      prev.z + (curr.z - prev.z) * alpha,
    );
    const yaw = lerpAngle(prev.yaw, curr.yaw, alpha);
    this.root.rotation.y = yaw;

    // Velocity in body space, so walking while shooting strafes instead of moonwalking.
    const vx = curr.mode === 'dodge' ? 0 : curr.vx;
    const vz = curr.mode === 'dodge' ? 0 : curr.vz;
    const speed = Math.hypot(vx, vz);
    const localFwd = vx * Math.sin(yaw) + vz * Math.cos(yaw);
    const localSide = vx * Math.cos(yaw) - vz * Math.sin(yaw);
    const gaitDir = speed > 0.05 ? { x: localSide / speed, z: localFwd / speed } : { x: 0, z: 1 };
    const mv = tuning.movement;
    const speedFrac = Math.min(1, speed / mv.runSpeed);
    const sprintFrac = Math.min(1, Math.max(0, (speed - mv.runSpeed) / Math.max(0.1, mv.sprintSpeed - mv.runSpeed)));
    const blend = 1 - Math.exp(-anim.blendRate * dt);

    // Gait phase: one cycle per stride; stride shortens when walking.
    const stride = anim.strideLength * (0.55 + 0.45 * speedFrac) * (1 + (anim.sprintStrideScale - 1) * sprintFrac);
    if (curr.grounded) this.gaitPhase += ((2 * Math.PI * speed) / stride) * dt;
    const stepAmp = Math.min(0.42, stride / (2 * Math.PI)) * Math.min(1, speed / 0.5);

    // Landing crouch and air blend.
    if (curr.grounded && !this.wasGrounded) this.landCrouch = anim.landCrouch;
    this.wasGrounded = curr.grounded;
    this.landCrouch *= Math.exp(-10 * dt);
    this.airWeight += ((curr.grounded ? 0 : 1) - this.airWeight) * blend;

    // --- Upper body ---
    const poses = POSES[curr.style];
    const loco = this.locomotionPose(poses.guard, speedFrac * Math.max(0, gaitDir.z), sprintFrac);
    let dodgeU = 0;
    if (curr.mode === 'attack') {
      const same = prev.mode === 'attack' && prev.attackSeq === curr.attackSeq;
      const t = same ? prev.attackTime + (curr.attackTime - prev.attackTime) * alpha : curr.attackTime;
      if (curr.attackSeq !== this.lastAttackSeq) {
        // New attack: blend from wherever the body is right now (guard, or the last strike when chaining).
        this.attackFrom = { ...this.pose, spin: wrapDeg(this.pose.spin), flip: wrapDeg(this.pose.flip) };
        this.lastAttackSeq = curr.attackSeq;
      }
      this.attackPose(curr, t, loco, this.pose);
      if (curr.attackFired && !prev.attackFired) this.castFlash = 1;
    } else if (curr.mode === 'ability') {
      const same = prev.mode === 'ability' && prev.abilitySeq === curr.abilitySeq;
      const t = same ? prev.abilityTime + (curr.abilityTime - prev.abilityTime) * alpha : curr.abilityTime;
      if (curr.abilitySeq !== this.lastAbilitySeq) {
        this.attackFrom = { ...this.pose, spin: wrapDeg(this.pose.spin), flip: wrapDeg(this.pose.flip) };
        this.lastAbilitySeq = curr.abilitySeq;
      }
      this.abilityPose(curr, t, loco, this.pose);
      if (curr.abilityFired && !prev.abilityFired) this.castFlash = 1;
    } else {
      this.vanish = 1;
      this.attackHop = 0;
      this.arrowGlow = 0;
      this.trailStrength = 0;
      this.pose.spin = wrapDeg(this.pose.spin);
      this.pose.flip = wrapDeg(this.pose.flip);
      let target = loco;
      if (curr.mode === 'down') target = pose(loco, DOWN);
      // Knocked back by a heavy hit: recoil, arms up.
      if (curr.mode === 'hurt') target = pose(loco, { lean: -20, crouch: 0.14, handHeight: loco.handHeight + 0.12, offHeight: loco.offHeight + 0.12, twist: 12 });
      if (curr.mode === 'dodge') {
        const t = prev.mode === 'dodge' ? prev.dodgeTime + (curr.dodgeTime - prev.dodgeTime) * alpha : curr.dodgeTime;
        dodgeU = clamp01(t / (tuning.dodge.durationMs / 1000));
        // A backstep is a crouched hop back, guard kept up; a roll tucks in.
        const shape = curr.dodgeBackstep ? pose(loco, { lean: -10, crouch: 0.16 }) : pose(loco, TUCK);
        target = lerpPose(loco, shape, Math.sin(dodgeU * Math.PI), { ...loco });
      }
      if (curr.mode === 'guard') {
        // Snap up quickly, with a shove forward on a parry.
        const g = GUARD_POSES[curr.style];
        target = pose(g, { offReach: g.offReach + this.parryFlick * 0.12, handReach: g.handReach + this.parryFlick * 0.08, lean: g.lean + this.parryFlick * 8 });
      }
      if (this.airWeight > 0.01) {
        const air = pose(target, { handHeight: target.handHeight + 0.12, offHeight: target.offHeight + 0.12, lean: target.lean - 4 });
        target = lerpPose(target, air, this.airWeight, { ...target });
      }
      lerpPose(this.pose, target, curr.mode === 'guard' ? 1 - Math.exp(-28 * dt) : blend, this.pose);
    }
    this.updateWard(curr, dt);
    const p = this.pose;
    this.castFlash *= Math.exp(-6 * dt);

    // Dodge roll and attack flips around the pivot; attack spins and leaps move the whole body.
    // The roll tumbles toward the dodge direction in body space (forward, back or sideways).
    const flip = new THREE.Quaternion().setFromAxisAngle(ROLL_X, p.flip * DEG);
    if (curr.mode === 'dodge' && curr.dodgeBackstep) {
      this.rollPivot.quaternion.copy(flip);
    } else if (curr.mode === 'dodge') {
      const lx = curr.dodgeDirX * Math.cos(yaw) - curr.dodgeDirZ * Math.sin(yaw);
      const lz = curr.dodgeDirX * Math.sin(yaw) + curr.dodgeDirZ * Math.cos(yaw);
      const axis = new THREE.Vector3(lz, 0, -lx).normalize();
      this.rollPivot.quaternion.setFromAxisAngle(axis, easeOut(dodgeU) * Math.PI * 2).multiply(flip);
    } else {
      this.rollPivot.quaternion.copy(flip);
    }
    this.spinGroup.rotation.y = p.spin * DEG;
    const backHop = curr.mode === 'dodge' && curr.dodgeBackstep ? Math.sin(dodgeU * Math.PI) * 0.16 : 0;
    this.spinGroup.position.y = p.lift + this.attackHop + backHop;

    // Hips and chest.
    const bob = anim.bobHeight * speedFrac * (Math.abs(Math.cos(this.gaitPhase)) - 0.5);
    this.pelvis.position.y = BODY.hipHeight - p.crouch - this.landCrouch + bob;
    this.pelvis.rotation.set(p.lean * 0.4 * DEG, p.twist * 0.3 * DEG, 0);
    this.chest.rotation.set(p.lean * 0.6 * DEG, p.twist * 0.7 * DEG, 0);
    this.head.rotation.set(-p.lean * 0.5 * DEG, -p.twist * 0.45 * DEG, 0);
    // Positive X swings the hem backward, away from the body.
    const cape = this.outfit.cape;
    if (cape) cape.rotation.x = 0.08 + speedFrac * 0.55 + this.airWeight * 0.4 + Math.sin(this.time * 2.1) * 0.03;
    // Robe skirt reaches the floor whatever the crouch, and trails the stride a little.
    const skirt = this.outfit.skirt;
    if (skirt) {
      skirt.scale.y = Math.max(0.3, this.pelvis.position.y - 0.04);
      skirt.rotation.set(
        -0.18 * speedFrac * gaitDir.z,
        0,
        0.18 * speedFrac * gaitDir.x + Math.sin(this.gaitPhase) * 0.04 * speedFrac,
      );
    }

    // Swap flash.
    if (this.swapFxAge < SWAP_FX_LIFE) {
      this.swapFxAge += dt;
      const u = Math.min(1, this.swapFxAge / SWAP_FX_LIFE);
      this.swapFx.visible = true;
      this.swapFx.scale.set(0.5 + u * 0.7, 0.9 + u * 0.9, 0.5 + u * 0.7);
      (this.swapFx.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - u) * (1 - u);
      this.rig.scale.setScalar((1 - 0.1 * Math.sin(u * Math.PI)) * this.vanish);
    } else {
      this.swapFx.visible = false;
      this.rig.scale.setScalar(this.vanish);
    }

    this.poseArms(p, curr);
    poseLegs(this.pelvis, this.outfit.legs, BODY, {
      phase: this.gaitPhase,
      stepAmp,
      stepHeight: anim.stepHeight,
      dir: gaitDir,
      still: 1 - speedFrac,
      widen: Math.min(1, p.crouch / 0.15),
      tuck: Math.max(curr.mode === 'dodge' ? Math.sin(dodgeU * Math.PI) : 0, this.airWeight * 0.6),
    });

    // Weapon trails sample the weapon edge in world space.
    this.root.updateMatrixWorld(true);
    const swordOn = curr.style === 'sword' ? this.trailStrength : 0;
    this.swordTrail.push(this.sword.localToWorld(new THREE.Vector3(0, 0.3, 0)), this.sword.localToWorld(new THREE.Vector3(0, 0.98, 0)), this.time, swordOn);
    const staffOn = curr.style === 'staff' ? this.trailStrength : 0;
    this.staffTrail.push(
      this.staff.group.localToWorld(new THREE.Vector3(0, this.staff.topY - 0.12, 0)),
      this.staff.group.localToWorld(new THREE.Vector3(0, this.staff.topY + 0.1, 0)),
      this.time,
      staffOn,
    );
  }

  /** The style's guard, with arm swing and counter-twist while moving, and a little breathing. */
  private locomotionPose(guard: UpperPose, runFrac: number, sprintFrac: number): UpperPose {
    const anim = tuning.heroAnim;
    const s = Math.sin(this.gaitPhase);
    const swing = anim.armSwing * runFrac;
    const breathe = Math.sin(this.time * 2.2) * 0.012 * (1 - runFrac);
    return {
      ...guard,
      handYaw: guard.handYaw - 8 * runFrac + s * 18 * swing,
      handHeight: guard.handHeight + breathe - 0.04 * runFrac,
      handReach: guard.handReach + s * 0.08 * swing,
      bladePitch: guard.bladePitch + 15 * runFrac,
      offYaw: guard.offYaw - s * 14 * swing,
      offHeight: guard.offHeight + breathe,
      twist: -s * 10 * runFrac,
      lean: guard.lean + anim.runLeanDeg * runFrac + anim.sprintLeanDeg * sprintFrac,
    };
  }

  /**
   * Windup -> strike/release -> recover, timed by the attack's phases and
   * flowing through the key poses (tuning.heroAnim.attackFlow).
   */
  private attackPose(p: PlayerState, t: number, recoverTo: UpperPose, out: UpperPose): void {
    const hit = heroHit(p, p.attackHit);
    const set = POSES[p.style];
    const strike = set.strike[p.attackHit];
    // Recover to the guard without unwinding a spin or flip: 360 is the same as 0.
    const recover = { ...recoverTo, spin: 360 * Math.round(strike.spin / 360), flip: 360 * Math.round(strike.flip / 360) };
    const t1 = hit.windup;
    const t2 = t1 + hit.active;
    const t3 = t2 + hit.recovery;
    hermitePose([this.attackFrom, set.windup[p.attackHit], strike, recover], [0, t1, t2, t3], t, tuning.heroAnim.attackFlow, out);

    // Leaps arc up and land as the active phase ends.
    const u = clamp01((t - t1) / hit.active);
    this.attackHop = set.hop[p.attackHit] * Math.sin(Math.PI * u) * (t < t2 ? 1 : 0);
    // Weapon trails emit from late windup to just after the active phase.
    this.trailStrength = t > t1 * 0.7 && t < t2 + 0.05 ? (hit.heavy ? 1 : 0.75) : 0;
    // Power and piercing shots glow as they draw.
    this.arrowGlow = p.style === 'bow' && (p.attackHit === 2 || p.attackHit === 4) && !p.attackFired ? clamp01(t / t1) : 0;
  }

  /** The guard ward: faint while guarding (brighter in the parry window), flaring on parries and blocks. */
  private updateWard(p: PlayerState, dt: number): void {
    if (p.parrySeq !== this.lastParrySeq) {
      this.lastParrySeq = p.parrySeq;
      this.wardFlash = 1;
      this.parryFlick = 1;
    }
    if (p.blockSeq !== this.lastBlockSeq) {
      this.lastBlockSeq = p.blockSeq;
      this.wardFlash = Math.max(this.wardFlash, 0.5);
    }
    this.wardFlash *= Math.exp(-7 * dt);
    this.parryFlick *= Math.exp(-9 * dt);
    const guarding = p.mode === 'guard';
    const parryWindow = guarding && p.parryOpen && p.guardTime * 1000 <= tuning.guard.parryWindowMs;
    const opacity = (guarding ? (parryWindow ? 0.22 : 0.08) : 0) + this.wardFlash * 0.55;
    const mat = this.ward.material as THREE.MeshBasicMaterial;
    mat.color.setHex(this.wardFlash > 0.6 ? 0xfff4c8 : WARD_COLORS[p.style]);
    mat.opacity = opacity;
    this.ward.visible = opacity > 0.01;
    this.ward.scale.setScalar(1 + this.wardFlash * 0.15);
  }

  /** Ability: windup -> effect/active -> recover, with the special motions (spin, flip, vanish). */
  private abilityPose(p: PlayerState, t: number, recoverTo: UpperPose, out: UpperPose): void {
    const kind = p.ability;
    const tm = abilityTiming(kind);
    const keys = ABILITY_POSES[kind];
    const strike = { ...keys.strike };
    const active = Math.max(0.08, tm.active);
    if (kind === 'whirlwind') {
      // Whole turns over the active phase, so it ends facing the way it started.
      strike.spin = -360 * Math.max(1, Math.round(tuning.abilities.whirlwindSpinsPerSec * tm.active));
    }
    const recover = { ...recoverTo, spin: strike.spin, flip: strike.flip };
    const t1 = tm.windup;
    const t2 = t1 + active;
    const t3 = t2 + tm.recovery;
    if (kind === 'whirlwind' && t > t1 && t < t2) {
      // Constant-speed spin while active, not eased.
      Object.assign(out, strike);
      out.spin = strike.spin * ((t - t1) / active);
    } else {
      hermitePose([this.attackFrom, keys.windup, strike, recover], [0, t1, t2, t3], t, 0.4, out);
    }
    const u = clamp01((t - t1) / active);
    this.attackHop = keys.hop * Math.sin(Math.PI * u) * (t < t2 ? 1 : 0);
    // Blink: shrink to nothing at the jump and pop back out.
    this.vanish = kind === 'blink' ? clamp01(Math.abs(t - t1) / 0.07) : 1;
    // Trails on the moves that sweep the weapon.
    const sweeping = kind === 'charge' || kind === 'whirlwind' || kind === 'frostRing';
    this.trailStrength = sweeping && t > t1 * 0.6 && t < t2 + 0.05 ? 1 : 0;
    this.arrowGlow = kind === 'volley' && !p.abilityFired ? clamp01(t / t1) : 0;
  }

  private poseArms(p: UpperPose, state: PlayerState): void {
    const style = state.style;
    const { hand, offHand } = poseArms(p, BODY, this.outfit.arms);

    const weaponDir = direction(p.bladeYaw, p.bladePitch);

    // Knight: sword in the right hand, shield on the left arm.
    if (style === 'sword') {
      this.sword.position.copy(hand);
      this.sword.quaternion.setFromUnitVectors(UP, weaponDir);
      this.shield.position.copy(offHand).addScaledVector(direction(p.offYaw, 0), 0.06);
      this.shield.rotation.set(0, p.offYaw * DEG * 0.8, 0);
    }

    // Mage: staff in the right hand.
    if (style === 'staff') {
      this.staff.group.position.copy(hand);
      this.staff.group.quaternion.setFromUnitVectors(UP, weaponDir);
      const charging = (state.mode === 'attack' && !state.attackFired) || (state.mode === 'ability' && !state.abilityFired);
      const target = 2.2 + (charging ? 2.5 : 0) + this.castFlash * 6;
      this.staff.crystal.emissiveIntensity += (target - this.staff.crystal.emissiveIntensity) * 0.3;
    }

    // Archer: bow in the left hand, limbs along the weapon direction, belly toward the off-hand yaw.
    if (style === 'bow') {
      const y = weaponDir;
      const z = direction(p.offYaw, 0);
      z.addScaledVector(y, -z.dot(y)).normalize();
      const x = new THREE.Vector3().crossVectors(y, z);
      this.bow.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      this.bow.group.position.copy(offHand);

      // String follows the right hand by the draw amount; arrow nocked while drawing.
      const handInBow = hand.clone().sub(offHand).applyQuaternion(this.bow.group.quaternion.clone().invert());
      const rest = this.bow.restNock();
      const nock = rest.clone().lerp(handInBow, clamp01(p.draw));
      this.bow.setNock(nock);
      const drawing = (state.mode === 'attack' && !state.attackFired) || (state.mode === 'ability' && !state.abilityFired);
      const nocked = drawing && p.draw > 0.15;
      this.nockedArrow.visible = nocked;
      if (nocked) {
        const aim = new THREE.Vector3(0, 0, 0.04).sub(nock).normalize();
        this.nockedArrow.position.copy(nock).addScaledVector(aim, ARROW_LENGTH);
        this.nockedArrow.quaternion.setFromUnitVectors(FORWARD, aim);
        this.arrowHead.emissiveIntensity = this.arrowGlow * 4;
      }
    }
  }
}

