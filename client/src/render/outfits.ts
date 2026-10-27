import * as THREE from 'three';
import { Palette, buildQuiver, glowMaterial, segmentGeo } from './props';

/**
 * The three heroes share one skeleton (proportions below) and one set of
 * procedural animations; each style dresses it differently. Built from
 * primitives until real models land in assets/.
 */
export const BODY: Dims = {
  hipHeight: 0.95,
  chestOffset: 0.12,
  headHeight: 0.58,
  shoulder: { x: 0.21, y: 0.4 },
  upperArm: 0.31,
  forearm: 0.29,
  hipJoint: { x: 0.11, y: -0.04 },
  thigh: 0.44,
  shin: 0.42,
  ankleHeight: 0.08,
  footSpacing: 0.13,
};

import type { Arm, Dims, Leg } from './rig';

/** One hero's look. Each group is parented to the matching rig joint; limbs are posed by IK. */
export interface Outfit {
  pelvis: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  arms: Record<'R' | 'L', Arm>;
  legs: Record<'R' | 'L', Leg>;
  /** Cloak or cape hanging from the shoulders (pivot at its top edge); swings with speed. */
  cape: THREE.Mesh | null;
  /** Long robe skirt (pivot at the waist); stretched to the floor and swayed by the hero view. */
  skirt: THREE.Mesh | null;
  /** Colour of the swap flash when this hero appears. */
  accent: number;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

function arms(make: () => Arm): Record<'R' | 'L', Arm> {
  return { R: make(), L: make() };
}

function legs(make: () => Leg): Record<'R' | 'L', Leg> {
  return { R: make(), L: make() };
}

/** Breastplate-style torso: tapered, flattened front to back. */
function torso(m: THREE.Material, top = 0.21, bottom = 0.17): THREE.Mesh {
  const t = mesh(new THREE.CylinderGeometry(top, bottom, 0.44, 14), m, 0, 0.2, 0);
  t.scale.z = 0.75;
  return t;
}

function shoulderCaps(group: THREE.Group, m: THREE.Material, radius = 0.11, scaleY = 0.8): void {
  for (const side of [-1, 1]) {
    const cap = mesh(
      new THREE.SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      m,
      side * (BODY.shoulder.x + 0.01),
      BODY.shoulder.y - 0.01,
      0,
    );
    cap.rotation.z = -side * 0.35;
    cap.scale.set(1, scaleY, 1.1);
    group.add(cap);
  }
}

function capeCard(m: THREE.Material, width: number, length: number, z: number): THREE.Mesh {
  return mesh(new THREE.PlaneGeometry(width, length, 1, 4).translate(0, -length / 2, 0), m, 0, 0.44, z);
}

/** Sword and shield: plate, cream tabard with a blue cross, blue cape with a gold cross, blue great helm (concept art). */
export function buildKnight(p: Palette): Outfit {
  const pelvis = new THREE.Group();
  pelvis.add(
    mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.34, 12), p.tabard, 0, -0.14, 0),
    mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 12), p.leather, 0, 0.03, 0),
    mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), p.gold, 0, 0.03, 0.17),
  );

  const chest = new THREE.Group();
  const tabardFront = mesh(new THREE.BoxGeometry(0.26, 0.36, 0.02), p.tabard, 0, 0.17, 0.135);
  const crossV = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.01), p.royal, 0, 0.19, 0.15);
  const crossH = mesh(new THREE.BoxGeometry(0.14, 0.04, 0.01), p.royal, 0, 0.23, 0.15);
  tabardFront.rotation.x = crossV.rotation.x = crossH.rotation.x = -0.08;
  chest.add(
    torso(p.steel),
    tabardFront,
    crossV,
    crossH,
    mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 12), p.darkSteel, 0, 0.47, 0),
  );
  shoulderCaps(chest, p.steel);
  const cape = capeCard(p.cape, 0.4, 0.82, -0.16);
  // Gold cross on the back of the cape (the cape's outer face looks along -Z).
  cape.add(
    mesh(new THREE.BoxGeometry(0.045, 0.4, 0.004), p.gold, 0, -0.32, -0.006),
    mesh(new THREE.BoxGeometry(0.22, 0.045, 0.004), p.gold, 0, -0.24, -0.006),
  );
  chest.add(cape);

  const head = new THREE.Group();
  head.add(
    mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.25, 14), p.helm),
    mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), p.helm, 0, 0.125, 0),
    mesh(new THREE.BoxGeometry(0.19, 0.025, 0.03), p.slit, 0, 0.03, 0.112),
    mesh(new THREE.BoxGeometry(0.025, 0.11, 0.03), p.slit, 0, -0.03, 0.115),
    mesh(new THREE.CylinderGeometry(0.127, 0.127, 0.03, 14), p.gold, 0, -0.1, 0),
    mesh(new THREE.BoxGeometry(0.02, 0.2, 0.23), p.gold, 0, 0.13, 0.0),
  );

  return {
    pelvis,
    chest,
    head,
    cape,
    skirt: null,
    accent: 0xffc35a,
    arms: arms(() => ({
      upper: mesh(segmentGeo(0.05, 0.058, BODY.upperArm), p.darkSteel),
      fore: mesh(segmentGeo(0.045, 0.052, BODY.forearm), p.steel),
      elbow: mesh(new THREE.SphereGeometry(0.058, 10, 8), p.steel),
      hand: mesh(new THREE.BoxGeometry(0.08, 0.09, 0.08), p.leather),
    })),
    legs: legs(() => ({
      thigh: mesh(segmentGeo(0.06, 0.075, BODY.thigh), p.darkSteel),
      shin: mesh(segmentGeo(0.05, 0.062, BODY.shin), p.steel),
      knee: mesh(new THREE.SphereGeometry(0.065, 10, 8), p.steel),
      foot: mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24).translate(0, -0.03, 0.05), p.leather),
    })),
  };
}

/** Bow: elf ranger with copper hair, leather and a forest-green cloak, quiver on the back (concept art). */
export function buildArcher(p: Palette): Outfit {
  const pelvis = new THREE.Group();
  const pouch = mesh(new THREE.BoxGeometry(0.09, 0.1, 0.05), p.leatherLight, 0.15, -0.04, 0.08);
  pouch.rotation.y = 0.6;
  pelvis.add(
    mesh(new THREE.CylinderGeometry(0.165, 0.215, 0.28, 12), p.forest, 0, -0.11, 0),
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), p.leather, 0, 0.03, 0),
    mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), p.darkSteel, 0, 0.03, 0.165),
    pouch,
  );

  const chest = new THREE.Group();
  // Strap across the chest for the quiver.
  const strap = mesh(new THREE.BoxGeometry(0.05, 0.56, 0.02), p.leather, 0, 0.2, 0);
  strap.rotation.z = 0.75;
  const strapFront = strap.clone();
  strapFront.position.z = 0.135;
  strap.position.z = -0.135;
  // Shoulder mantle of the cloak.
  const mantle = mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.16, 14, 1, true), p.cloak, 0, 0.4, 0);
  mantle.scale.z = 0.8;
  chest.add(
    torso(p.leatherLight, 0.2, 0.165),
    mesh(new THREE.BoxGeometry(0.2, 0.3, 0.02), p.leather, 0, 0.16, 0.128),
    strapFront,
    strap,
    mantle,
  );
  const quiver = buildQuiver(p);
  quiver.position.set(-0.05, 0.02, -0.19);
  quiver.rotation.set(-0.2, 0, 0.45);
  chest.add(quiver);
  const cape = capeCard(p.cloak, 0.42, 0.9, -0.17);
  chest.add(cape);

  const head = new THREE.Group();
  // Face, swept copper hair with a braid down the back, long pointed ears; the hood rests on the shoulders.
  const face = mesh(new THREE.SphereGeometry(0.105, 14, 10), p.skin, 0, -0.005, 0.012);
  face.scale.set(0.92, 1.08, 0.95);
  const hair = mesh(new THREE.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), p.hairCopper, 0, 0.012, -0.012);
  hair.scale.set(1, 1.1, 1.08);
  const back = mesh(new THREE.SphereGeometry(0.11, 12, 8), p.hairCopper, 0, -0.04, -0.045);
  back.scale.set(0.95, 1.1, 0.8);
  const braid = mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.32, 8), p.hairCopper, 0, -0.2, -0.1);
  braid.rotation.x = 0.25;
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    eyes.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), p.slit, side * 0.035, 0.015, 0.105));
    const ear = mesh(new THREE.ConeGeometry(0.022, 0.13, 6), p.skin, side * 0.11, 0.03, -0.005);
    ear.rotation.set(0, 0, -side * 1.1);
    eyes.add(ear);
  }
  const circlet = mesh(new THREE.TorusGeometry(0.112, 0.008, 6, 20).rotateX(Math.PI / 2), p.gold, 0, 0.06, 0);
  circlet.rotation.x = -0.15;
  const hoodDown = mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16).rotateX(Math.PI / 2), p.cloak, 0, -0.12, -0.03);
  head.add(face, hair, back, braid, eyes, circlet, hoodDown);

  return {
    pelvis,
    chest,
    head,
    cape,
    skirt: null,
    accent: 0x9be27a,
    arms: arms(() => ({
      upper: mesh(segmentGeo(0.047, 0.055, BODY.upperArm), p.forest),
      fore: mesh(segmentGeo(0.045, 0.05, BODY.forearm), p.leather),
      elbow: mesh(new THREE.SphereGeometry(0.05, 10, 8), p.forest),
      hand: mesh(new THREE.BoxGeometry(0.07, 0.085, 0.07), p.leatherLight),
    })),
    legs: legs(() => ({
      thigh: mesh(segmentGeo(0.062, 0.078, BODY.thigh), p.trousers),
      shin: mesh(segmentGeo(0.058, 0.066, BODY.shin), p.leather),
      knee: mesh(new THREE.SphereGeometry(0.058, 10, 8), p.trousers),
      foot: mesh(new THREE.BoxGeometry(0.1, 0.08, 0.23).translate(0, -0.03, 0.05), p.leather),
    })),
  };
}

/** Staff: the sorceress from the concept art: white and gold robes, a golden shawl, a cloud of white hair, gold jewellery. */
export function buildMage(p: Palette): Outfit {
  const pelvis = new THREE.Group();
  // Long robe skirt; the hero view stretches it to reach the floor.
  const skirt = mesh(new THREE.CylinderGeometry(0.19, 0.34, 1, 16, 1, true).translate(0, -0.5, 0), p.robe, 0, 0.02, 0);
  const hem = mesh(new THREE.TorusGeometry(0.34, 0.018, 6, 24).rotateX(Math.PI / 2).translate(0, -1, 0), p.gold);
  skirt.add(hem);
  const sashTail = mesh(new THREE.BoxGeometry(0.07, 0.34, 0.015), p.gold, 0.08, -0.15, 0.19);
  sashTail.rotation.set(-0.15, 0, 0.12);
  pelvis.add(skirt, mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 12), p.gold, 0, 0.03, 0), sashTail);

  const chest = new THREE.Group();
  const trim = mesh(new THREE.BoxGeometry(0.06, 0.42, 0.015), p.gold, 0, 0.2, 0.14);
  trim.rotation.x = -0.05;
  const collar = mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 18).rotateX(Math.PI / 2), p.gold, 0, 0.44, 0);
  const amulet = mesh(new THREE.OctahedronGeometry(0.03), glowMaterial(0x7fd8ff), 0, 0.33, 0.165);
  chest.add(torso(p.robe, 0.2, 0.18), trim, collar, amulet);
  shoulderCaps(chest, p.robeDark, 0.12, 0.6);
  const cape = capeCard(p.robeDark, 0.38, 1.0, -0.15);
  chest.add(cape);

  const head = new THREE.Group();
  const face = mesh(new THREE.SphereGeometry(0.1, 14, 10), p.skinDeep, 0, -0.01, 0.015);
  face.scale.set(0.92, 1.1, 0.95);
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    eyes.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), p.slit, side * 0.034, 0.008, 0.1));
    // Gold hoop earrings.
    eyes.add(mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), p.gold, side * 0.098, -0.06, 0.01));
  }
  // A big cloud of white curls, thickest at the back and sides.
  const hair = new THREE.Group();
  const curls: [number, number, number, number][] = [
    [0, 0.07, -0.03, 0.13],
    [0.09, 0.03, -0.04, 0.1],
    [-0.09, 0.03, -0.04, 0.1],
    [0.12, -0.06, -0.05, 0.09],
    [-0.12, -0.06, -0.05, 0.09],
    [0, -0.02, -0.11, 0.12],
    [0.07, -0.13, -0.09, 0.09],
    [-0.07, -0.13, -0.09, 0.09],
    [0, 0.12, 0.03, 0.085],
  ];
  for (const [x, y, z, r] of curls) hair.add(mesh(new THREE.IcosahedronGeometry(r, 1), p.hairWhite, x, y, z));
  const diadem = mesh(new THREE.OctahedronGeometry(0.022), glowMaterial(0x7fd8ff), 0, 0.07, 0.1);
  head.add(face, eyes, hair, diadem);

  return {
    pelvis,
    chest,
    head,
    cape,
    skirt,
    accent: 0xffd27a,
    arms: arms(() => ({
      // Wide sleeves that flare toward the wrist.
      upper: mesh(segmentGeo(0.06, 0.06, BODY.upperArm), p.robe),
      fore: mesh(segmentGeo(0.1, 0.06, BODY.forearm, 12), p.robe),
      elbow: mesh(new THREE.SphereGeometry(0.062, 10, 8), p.robe),
      hand: mesh(new THREE.SphereGeometry(0.045, 8, 6), p.skinDeep),
    })),
    // Legs stay under the robe (robe-coloured where a stride pokes through); only the shoes show.
    legs: legs(() => ({
      thigh: mesh(segmentGeo(0.05, 0.06, BODY.thigh), p.robe),
      shin: mesh(segmentGeo(0.045, 0.05, BODY.shin), p.robe),
      knee: mesh(new THREE.SphereGeometry(0.05, 8, 6), p.robe),
      foot: mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.035, 0.06), p.darkWood),
    })),
  };
}
