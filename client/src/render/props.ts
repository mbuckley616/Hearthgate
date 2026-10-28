import * as THREE from 'three';
import { activeLook } from './look';
import { tuning } from '@hearthgate/shared/config/tuning';

/**
 * Shared materials and primitive-built props (weapons, quiver, arrows).
 * Stand-ins until real assets land in assets/.
 */

export const UP = new THREE.Vector3(0, 1, 0);
export const FORWARD = new THREE.Vector3(0, 0, 1);

/** Orient a +Y-aligned segment mesh to run from a to b. */
export function placeSegment(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
}

/** Cylinder of length len starting at its origin and running along +Y. */
export function segmentGeo(rTop: number, rBottom: number, len: number, radial = 10): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, len, radial).translate(0, len / 2, 0);
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

/** Glowing, unlit, additive material for magic and trails. */
export function glowMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

export const FROST = 0x7fd8ff;

/** Character and prop materials with a shared rim light and reflection settings driven by tuning. */
export class Palette {
  private rim = { rimColor: { value: new THREE.Color() }, rimIntensity: { value: 0 } };
  private metals: THREE.MeshStandardMaterial[] = [];

  readonly steel: THREE.MeshStandardMaterial;
  readonly darkSteel: THREE.MeshStandardMaterial;
  readonly gold: THREE.MeshStandardMaterial;
  readonly blade: THREE.MeshStandardMaterial;
  readonly tabard: THREE.MeshStandardMaterial;
  readonly cape: THREE.MeshStandardMaterial;
  readonly leather: THREE.MeshStandardMaterial;
  readonly plume: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
  readonly darkWood: THREE.MeshStandardMaterial;
  readonly bowString: THREE.MeshStandardMaterial;
  readonly fletching: THREE.MeshStandardMaterial;
  readonly leatherLight: THREE.MeshStandardMaterial;
  readonly forest: THREE.MeshStandardMaterial;
  /** Flat or open cloth (cloaks, mantles): double-sided, no rim. */
  readonly cloak: THREE.MeshStandardMaterial;
  readonly trousers: THREE.MeshStandardMaterial;
  readonly robe: THREE.MeshStandardMaterial;
  readonly robeDark: THREE.MeshStandardMaterial;
  readonly skin: THREE.MeshStandardMaterial;
  readonly beard: THREE.MeshStandardMaterial;
  /** M6 concept colours: the knight's royal blue (cape, shield, helm), the elf's copper hair, the sorceress's skin and white hair. */
  readonly royal: THREE.MeshStandardMaterial;
  readonly helm: THREE.MeshStandardMaterial;
  readonly hairCopper: THREE.MeshStandardMaterial;
  readonly skinDeep: THREE.MeshStandardMaterial;
  readonly hairWhite: THREE.MeshStandardMaterial;
  readonly slit = new THREE.MeshBasicMaterial({ color: 0x07070a });

  constructor(private envMap: THREE.Texture) {
    this.steel = this.make({ color: 0xaab2bd, metalness: 0.85, roughness: 0.42 }, true);
    this.darkSteel = this.make({ color: 0x565c64, metalness: 0.75, roughness: 0.5 }, true);
    this.gold = this.make({ color: 0xd4a548, metalness: 0.9, roughness: 0.3 }, true);
    this.blade = this.make({ color: 0xcfd6de, metalness: 0.9, roughness: 0.32 }, true);
    this.tabard = this.make({ color: 0xd9cfb8, roughness: 0.9 });
    // No rim on the cape: it's a flat card and would glow edge-on.
    this.cape = this.make({ color: 0x1e3c9e, roughness: 0.9, side: THREE.DoubleSide }, false, false);
    this.royal = this.make({ color: 0x2547b8, roughness: 0.85 });
    this.helm = this.make({ color: 0x3157c4, metalness: 0.7, roughness: 0.35 }, true);
    this.hairCopper = this.make({ color: 0xb4482a, roughness: 0.9 });
    this.skinDeep = this.make({ color: 0x6e4630, roughness: 0.65 });
    this.hairWhite = this.make({ color: 0xeceaf4, roughness: 0.95 });
    this.leather = this.make({ color: 0x5a3a22, roughness: 0.8 });
    this.plume = this.make({ color: 0xb3262b, roughness: 0.8 });
    this.wood = this.make({ color: 0x8a5a32, roughness: 0.7 });
    this.darkWood = this.make({ color: 0x4a2f1c, roughness: 0.75 });
    this.bowString = this.make({ color: 0xe8dcc0, roughness: 0.9 }, false, false);
    this.fletching = this.make({ color: 0xc23a30, roughness: 0.9, side: THREE.DoubleSide }, false, false);
    this.leatherLight = this.make({ color: 0x9c6b42, roughness: 0.75 });
    this.forest = this.make({ color: 0x55803f, roughness: 0.9 });
    this.cloak = this.make({ color: 0x3f6b34, roughness: 0.95, side: THREE.DoubleSide }, false, false);
    this.trousers = this.make({ color: 0x5c4431, roughness: 0.9 });
    // The sorceress: white robe, golden-yellow shawl.
    this.robe = this.make({ color: 0xe6dcc6, roughness: 0.85, side: THREE.DoubleSide });
    this.robeDark = this.make({ color: 0xd9a032, roughness: 0.85, side: THREE.DoubleSide }, false, false);
    this.skin = this.make({ color: 0xe0b48f, roughness: 0.7 });
    this.beard = this.make({ color: 0xdedad2, roughness: 0.95 });
  }

  /** MeshStandardMaterial with optional reflections (metal) and the character rim light. */
  make(params: THREE.MeshStandardMaterialParameters, metal = false, rim = true): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial(params);
    if (metal) {
      m.envMap = this.envMap;
      this.metals.push(m);
    }
    if (!rim) return m;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.rim);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimIntensity;')
        .replace(
          '#include <opaque_fragment>',
          `float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
outgoingLight += rimColor * rimF * rimIntensity;
#include <opaque_fragment>`,
        );
    };
    return m;
  }

  /** Apply live tuning (rim light, metal reflections). Call once per frame. */
  update(): void {
    const look = activeLook();
    this.rim.rimColor.value.setHex(look.rimColor);
    this.rim.rimIntensity.value = look.rimIntensity;
    for (const m of this.metals) m.envMapIntensity = tuning.look.metalEnvIntensity;
  }
}

/** Arming sword. Grip at the origin, blade along +Y. */
export function buildSword(p: Palette): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), p.leather),
    mesh(new THREE.SphereGeometry(0.03, 8, 6), p.gold, 0, -0.1, 0),
    mesh(new THREE.BoxGeometry(0.24, 0.03, 0.045), p.gold, 0, 0.1, 0),
    mesh(new THREE.BoxGeometry(0.055, 0.78, 0.012), p.blade, 0, 0.5, 0),
  );
  const tip = mesh(new THREE.ConeGeometry(0.039, 0.09, 4), p.blade, 0, 0.935, 0);
  tip.rotation.y = Math.PI / 4;
  tip.scale.z = 0.22;
  g.add(tip);
  return g;
}

/** Heater shield, face toward +Z, held at its centre. */
export function buildShield(p: Palette): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 20), p.darkSteel);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 1.25);
  const face = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), p.royal, 0, 0, 0.022);
  face.rotation.x = Math.PI / 2;
  face.scale.set(1, 1, 1.25);
  g.add(
    body,
    face,
    mesh(new THREE.BoxGeometry(0.045, 0.36, 0.01), p.gold, 0, 0, 0.034),
    mesh(new THREE.BoxGeometry(0.26, 0.045, 0.01), p.gold, 0, 0.05, 0.034),
  );
  return g;
}

/** Arrow lying along +Z with its tip at the origin. */
export function buildArrow(p: Palette, headMaterial: THREE.Material = p.darkSteel): THREE.Group {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 6), p.wood, 0, 0, -0.42);
  shaft.rotation.x = Math.PI / 2;
  const head = mesh(new THREE.ConeGeometry(0.022, 0.09, 4), headMaterial, 0, 0, -0.045);
  head.rotation.x = Math.PI / 2;
  g.add(shaft, head);
  for (let i = 0; i < 3; i++) {
    const vane = mesh(new THREE.PlaneGeometry(0.03, 0.12), p.fletching, 0, 0, -0.71);
    vane.rotation.set(Math.PI / 2, 0, (i * Math.PI * 2) / 3);
    vane.translateX(0.018);
    g.add(vane);
  }
  return g;
}

export const ARROW_LENGTH = 0.78;

/** Leather quiver with a few fletchings showing. Origin at its base, opening along +Y. */
export function buildQuiver(p: Palette): THREE.Group {
  const g = new THREE.Group();
  g.add(
    mesh(segmentGeo(0.075, 0.06, 0.52, 12), p.leather),
    mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), p.gold, 0, 0.52, 0),
  );
  g.children[1].rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arrow = buildArrow(p);
    arrow.rotation.x = Math.PI / 2;
    // Rotated tip-down: the tip sits near the quiver's base and the fletching pokes out of the top.
    arrow.position.set(Math.cos(a) * 0.035, 0.02 + (i % 2) * 0.03, Math.sin(a) * 0.035);
    g.add(arrow);
  }
  return g;
}

/**
 * Recurve longbow. The grip is at the origin, limbs run along ±Y, the belly
 * faces +Z (toward the target) and the string sits behind it on -Z.
 */
export class Bow {
  readonly group = new THREE.Group();
  readonly topTip = new THREE.Vector3(0, 0.74, -0.13);
  readonly bottomTip = new THREE.Vector3(0, -0.74, -0.13);
  readonly limbs: THREE.Mesh;
  /** The tips' caps, drawn in the wood's trim colour when the bow is a catalogue piece (T5c). */
  readonly caps: THREE.Mesh[];
  private stringTop: THREE.Mesh;
  private stringBottom: THREE.Mesh;

  constructor(p: Palette) {
    const curve = new THREE.CatmullRomCurve3([
      this.bottomTip.clone(),
      new THREE.Vector3(0, -0.5, -0.02),
      new THREE.Vector3(0, -0.15, 0.03),
      new THREE.Vector3(0, 0, 0.02),
      new THREE.Vector3(0, 0.15, 0.03),
      new THREE.Vector3(0, 0.5, -0.02),
      this.topTip.clone(),
    ]);
    const limbs = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.017, 6), p.darkWood);
    this.limbs = limbs;
    const grip = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 8), p.leather, 0, 0, 0.02);
    const capTop = mesh(new THREE.SphereGeometry(0.02, 6, 4), p.gold, this.topTip.x, this.topTip.y, this.topTip.z);
    const capBottom = mesh(new THREE.SphereGeometry(0.02, 6, 4), p.gold, this.bottomTip.x, this.bottomTip.y, this.bottomTip.z);
    this.caps = [capTop, capBottom];
    this.stringTop = mesh(segmentGeo(0.004, 0.004, 1, 4), p.bowString);
    this.stringBottom = mesh(segmentGeo(0.004, 0.004, 1, 4), p.bowString);
    this.group.add(limbs, grip, capTop, capBottom, this.stringTop, this.stringBottom);
    this.setNock(this.restNock());
  }

  /** Where the string sits at rest, in bow space. */
  restNock(): THREE.Vector3 {
    return this.topTip.clone().add(this.bottomTip).multiplyScalar(0.5);
  }

  /** Pull the string to a point in bow space. */
  setNock(nock: THREE.Vector3): void {
    for (const [seg, tip] of [
      [this.stringTop, this.topTip],
      [this.stringBottom, this.bottomTip],
    ] as const) {
      placeSegment(seg, nock, tip);
      seg.scale.y = nock.distanceTo(tip);
    }
  }
}

/** Mage staff: grip at the origin, shaft along ±Y, frost crystal at the top. */
export class Staff {
  readonly group = new THREE.Group();
  readonly crystal: THREE.MeshStandardMaterial;
  readonly topY = 0.98;
  /** The shaft, and the gold fittings round the crystal: a catalogue staff's wood and trim (T5c). */
  readonly shaft: THREE.Mesh;
  readonly fittings: THREE.Mesh[] = [];

  constructor(p: Palette) {
    this.crystal = new THREE.MeshStandardMaterial({
      color: 0x1a3a50,
      emissive: FROST,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    });
    const shaft = mesh(segmentGeo(0.022, 0.03, 1.65, 8), p.darkWood, 0, -0.75, 0);
    this.shaft = shaft;
    const ferrule = mesh(new THREE.ConeGeometry(0.03, 0.08, 8), p.darkSteel, 0, -0.79, 0);
    ferrule.rotation.x = Math.PI;
    const wrap = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), p.leather);
    const collar = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06, 8), p.gold, 0, 0.9, 0);
    const gem = mesh(new THREE.OctahedronGeometry(0.075, 0), this.crystal, 0, this.topY, 0);
    gem.scale.y = 1.5;
    const halo = mesh(new THREE.SphereGeometry(0.13, 12, 8), glowMaterial(FROST, 0.18), 0, this.topY, 0);
    this.group.add(shaft, ferrule, wrap, collar, gem, halo);
    this.fittings.push(collar);
    // Gold claw prongs around the crystal.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const prong = mesh(new THREE.BoxGeometry(0.014, 0.16, 0.014), p.gold, Math.cos(a) * 0.05, 0.98, Math.sin(a) * 0.05);
      prong.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      this.group.add(prong);
      this.fittings.push(prong);
    }
  }
}
