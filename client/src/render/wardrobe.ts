import * as THREE from 'three';
import type { BodySlot, CatalogueEntry, Material } from '@hearthgate/shared/sim/catalogue';
import { BODY, arms, capeCard, legs, mesh, shoulderCaps, torso, type Outfit } from './outfits';
import { Palette, segmentGeo } from './props';
import type { Arm, Leg } from './rig';

/**
 * The hero as they are dressed (T5c, Michael 27 Oct: "an Iron Helm and a Black Platebody should
 * show exactly as that"): every shape in the catalogue has its own build on the shared skeleton,
 * drawn in its material's colours, base and trim. Nothing worn shows a plain tunic, trousers and
 * shoes. The slice's three figures stay for heroes with no look (the parity bots, villagers).
 */

export type Look = Partial<Record<BodySlot, CatalogueEntry>>;

/** Materials per catalogue material and finish, made once a palette and shared by every hero. */
class Swatches {
  private cache = new Map<string, THREE.MeshStandardMaterial>();
  private mail: THREE.Texture | null = null;

  constructor(readonly p: Palette) {}

  /** A material's base or trim colour, finished as its family is (metal shines, cloth hangs both sides). */
  of(m: Material, part: 'base' | 'trim', finish: 'solid' | 'mail' | 'open' | 'card' = 'solid'): THREE.MeshStandardMaterial {
    const key = `${m.id}:${part}:${finish}`;
    let mat = this.cache.get(key);
    if (mat) return mat;
    const color = m.colors[part];
    const shiny = m.family === 'metal' || m.family === 'trinket';
    const side = finish === 'open' || finish === 'card' || m.family === 'cloth' || m.family === 'dye' ? THREE.DoubleSide : THREE.FrontSide;
    if (finish === 'mail') {
      mat = this.p.make({ color, metalness: 0.7, roughness: 0.62, map: this.mailTexture() }, true);
    } else if (shiny) {
      mat = this.p.make({ color, metalness: m.family === 'trinket' ? 0.9 : 0.82, roughness: m.family === 'trinket' ? 0.3 : 0.4, side }, true, finish !== 'card');
    } else {
      mat = this.p.make({ color, roughness: m.family === 'wood' ? 0.7 : m.family === 'hide' ? 0.8 : 0.9, side }, false, finish !== 'card');
    }
    this.cache.set(key, mat);
    return mat;
  }

  /** The plain clothes under the gear. */
  plain(name: 'tunic' | 'trousers' | 'shoe' | 'hair'): THREE.MeshStandardMaterial {
    const key = `plain:${name}`;
    let mat = this.cache.get(key);
    if (!mat) {
      const color = { tunic: 0x7d6b50, trousers: 0x4e3e2e, shoe: 0x3a2818, hair: 0x4a3020 }[name];
      mat = this.p.make({ color, roughness: 0.9 });
      this.cache.set(key, mat);
    }
    return mat;
  }

  /** Rows of rings, so a chainbody reads as mail beside a platebody's polish. */
  private mailTexture(): THREE.Texture {
    if (this.mail) return this.mail;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = '#6a6a6a';
    g.lineWidth = 2;
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 5; col++) {
        g.beginPath();
        g.arc(col * 8 + (row % 2) * 4, row * 8 + 4, 3.2, 0, Math.PI * 2);
        g.stroke();
      }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mail = tex;
    return tex;
  }
}

const swatchesFor = new WeakMap<Palette, Swatches>();
function swatches(p: Palette): Swatches {
  let s = swatchesFor.get(p);
  if (!s) swatchesFor.set(p, (s = new Swatches(p)));
  return s;
}

/** A material for a weapon's part, by its catalogue material (the hero view tints the slice's weapons with it). */
export function weaponMaterial(p: Palette, m: Material, part: 'base' | 'trim'): THREE.MeshStandardMaterial {
  return swatches(p).of(m, part);
}

function face(head: THREE.Group, p: Palette, hair: THREE.Material | null): void {
  const f = mesh(new THREE.SphereGeometry(0.1, 14, 10), p.skin, 0, -0.01, 0.012);
  f.scale.set(0.92, 1.08, 0.95);
  head.add(f);
  for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), p.slit, side * 0.034, 0.012, 0.1));
  if (!hair) return;
  const cap = mesh(new THREE.SphereGeometry(0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.015, -0.01);
  cap.scale.set(1, 1.05, 1.08);
  const back = mesh(new THREE.SphereGeometry(0.1, 12, 8), hair, 0, -0.03, -0.04);
  back.scale.set(0.95, 1, 0.8);
  head.add(cap, back);
}

function dressHead(head: THREE.Group, e: CatalogueEntry | undefined, s: Swatches): void {
  const p = s.p;
  const hair = s.plain('hair');
  if (!e) return face(head, p, hair);
  const base = s.of(e.material, 'base');
  const trim = s.of(e.material, 'trim');
  switch (e.shape.id) {
    case 'medHelm': {
      // Open-faced: a dome, a rim and a nasal bar, the face beneath.
      face(head, p, null);
      head.add(
        mesh(new THREE.SphereGeometry(0.128, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), base, 0, 0.005, -0.005),
        mesh(new THREE.TorusGeometry(0.127, 0.012, 6, 24).rotateX(Math.PI / 2), trim, 0, 0.005, -0.005),
        mesh(new THREE.BoxGeometry(0.024, 0.11, 0.02), base, 0, -0.04, 0.125),
        mesh(new THREE.BoxGeometry(0.018, 0.03, 0.22), trim, 0, 0.125, -0.005),
      );
      break;
    }
    case 'fullHelm': {
      // The great helm: closed, a visor slit, a band and a crest.
      head.add(
        mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.25, 14), base),
        mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), base, 0, 0.125, 0),
        mesh(new THREE.BoxGeometry(0.19, 0.025, 0.03), p.slit, 0, 0.03, 0.112),
        mesh(new THREE.BoxGeometry(0.025, 0.11, 0.03), p.slit, 0, -0.03, 0.115),
        mesh(new THREE.CylinderGeometry(0.127, 0.127, 0.03, 14), trim, 0, -0.1, 0),
        mesh(new THREE.BoxGeometry(0.02, 0.2, 0.23), trim, 0, 0.13, 0),
      );
      break;
    }
    case 'coif': {
      // A hide hood tipped back off the face, with a cowl round the neck.
      face(head, p, null);
      const hood = mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), s.of(e.material, 'base', 'open'), 0, 0.01, -0.012);
      hood.rotation.x = -0.6;
      hood.scale.set(1, 1.05, 1.08);
      head.add(hood, mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 16).rotateX(Math.PI / 2), trim, 0, -0.12, -0.02));
      break;
    }
    case 'hat': {
      // A wizard's hat: a wide brim, a band and a cone bent back.
      face(head, p, hair);
      const cone = mesh(new THREE.ConeGeometry(0.11, 0.32, 14), base, 0, 0.24, -0.03);
      cone.rotation.x = -0.3;
      head.add(
        mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.015, 20), base, 0, 0.075, 0),
        mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.035, 16), trim, 0, 0.095, 0),
        cone,
      );
      break;
    }
    default:
      face(head, p, hair);
  }
}

/** Builds for one arm's segments; the body decides the sleeves, the hands slot can take the forearm and hand. */
type ArmParts = { upper: () => THREE.Mesh; elbow: () => THREE.Mesh; fore: () => THREE.Mesh; hand: () => THREE.Mesh };

function dressBody(chest: THREE.Group, e: CatalogueEntry | undefined, s: Swatches): ArmParts {
  const p = s.p;
  const tunic = s.plain('tunic');
  const neck = () => mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), p.skin, 0, 0.47, 0);
  const skinFore = () => mesh(segmentGeo(0.04, 0.046, BODY.forearm), p.skin);
  const skinHand = () => mesh(new THREE.BoxGeometry(0.07, 0.085, 0.07), p.skin);
  if (!e) {
    chest.add(torso(tunic, 0.19, 0.165), neck());
    return {
      upper: () => mesh(segmentGeo(0.05, 0.056, BODY.upperArm), tunic),
      elbow: () => mesh(new THREE.SphereGeometry(0.046, 10, 8), p.skin),
      fore: skinFore,
      hand: skinHand,
    };
  }
  const base = s.of(e.material, 'base');
  const trim = s.of(e.material, 'trim');
  switch (e.shape.id) {
    case 'chainbody': {
      const mail = s.of(e.material, 'base', 'mail');
      chest.add(
        torso(mail, 0.205, 0.175),
        mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 12), mail, 0, 0.47, 0),
        mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20).rotateX(Math.PI / 2), trim, 0, -0.01, 0),
      );
      return {
        upper: () => mesh(segmentGeo(0.052, 0.058, BODY.upperArm), mail),
        elbow: () => mesh(new THREE.SphereGeometry(0.055, 10, 8), mail),
        fore: () => mesh(segmentGeo(0.046, 0.052, BODY.forearm), mail),
        hand: skinHand,
      };
    }
    case 'platebody': {
      const ridge = mesh(new THREE.BoxGeometry(0.03, 0.36, 0.02), trim, 0, 0.2, 0.155);
      ridge.rotation.x = -0.08;
      chest.add(
        torso(base, 0.215, 0.175),
        ridge,
        mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.05, 14), trim, 0, 0.0, 0),
        mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.1, 12), trim, 0, 0.47, 0),
      );
      shoulderCaps(chest, base, 0.125, 0.85);
      return {
        upper: () => mesh(segmentGeo(0.05, 0.06, BODY.upperArm), base),
        elbow: () => mesh(new THREE.SphereGeometry(0.064, 10, 8), trim),
        fore: () => mesh(segmentGeo(0.046, 0.054, BODY.forearm), base),
        hand: skinHand,
      };
    }
    case 'jerkin': {
      const strap = mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), trim, 0, 0.2, 0.14);
      strap.rotation.z = 0.7;
      chest.add(
        torso(base, 0.2, 0.168),
        mesh(new THREE.BoxGeometry(0.18, 0.3, 0.02), trim, 0, 0.16, 0.128),
        strap,
        mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16).rotateX(Math.PI / 2), trim, 0, 0.44, 0),
        neck(),
      );
      for (let i = 0; i < 3; i++) chest.add(mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), base, 0, 0.08 + i * 0.08, 0.142));
      return {
        upper: () => mesh(segmentGeo(0.05, 0.057, BODY.upperArm), base),
        elbow: () => mesh(new THREE.SphereGeometry(0.048, 10, 8), p.skin),
        fore: skinFore,
        hand: skinHand,
      };
    }
    case 'robeTop': {
      const t = mesh(new THREE.BoxGeometry(0.06, 0.42, 0.015), trim, 0, 0.2, 0.14);
      t.rotation.x = -0.05;
      chest.add(torso(base, 0.2, 0.18), t, mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 18).rotateX(Math.PI / 2), trim, 0, 0.44, 0), neck());
      shoulderCaps(chest, trim, 0.12, 0.6);
      return {
        upper: () => mesh(segmentGeo(0.06, 0.06, BODY.upperArm), base),
        elbow: () => mesh(new THREE.SphereGeometry(0.062, 10, 8), base),
        // Wide sleeves that flare toward the wrist.
        fore: () => mesh(segmentGeo(0.1, 0.06, BODY.forearm, 12), base),
        hand: skinHand,
      };
    }
  }
  chest.add(torso(base));
  return { upper: () => mesh(segmentGeo(0.05, 0.056, BODY.upperArm), base), elbow: () => mesh(new THREE.SphereGeometry(0.05, 10, 8), base), fore: skinFore, hand: skinHand };
}

function dressHands(arm: ArmParts, e: CatalogueEntry | undefined, s: Swatches): ArmParts {
  if (!e) return arm;
  const base = s.of(e.material, 'base');
  const trim = s.of(e.material, 'trim');
  switch (e.shape.id) {
    case 'gauntlets':
      return {
        ...arm,
        // A cuff that flares at the wrist, and an armoured fist.
        fore: () => mesh(segmentGeo(0.068, 0.05, BODY.forearm), base),
        hand: () => mesh(new THREE.BoxGeometry(0.088, 0.095, 0.088), base),
      };
    case 'vambraces':
      return {
        ...arm,
        fore: () => {
          const f = mesh(segmentGeo(0.052, 0.055, BODY.forearm), base);
          for (const y of [0.08, 0.2]) f.add(mesh(new THREE.TorusGeometry(0.054, 0.008, 6, 14).rotateX(Math.PI / 2), trim, 0, y, 0));
          return f;
        },
      };
    case 'gloves':
      return { ...arm, hand: () => mesh(new THREE.SphereGeometry(0.048, 8, 6), base) };
  }
  return arm;
}

type LegParts = { thigh: () => THREE.Mesh; knee: () => THREE.Mesh; shin: () => THREE.Mesh };

function dressLegs(pelvis: THREE.Group, e: CatalogueEntry | undefined, s: Swatches): { legs: LegParts; skirt: THREE.Mesh | null } {
  const trousers = s.plain('trousers');
  const belt = (m: THREE.Material) => mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.055, 12), m, 0, 0.03, 0);
  const plain: LegParts = {
    thigh: () => mesh(segmentGeo(0.06, 0.075, BODY.thigh), trousers),
    knee: () => mesh(new THREE.SphereGeometry(0.06, 10, 8), trousers),
    shin: () => mesh(segmentGeo(0.05, 0.06, BODY.shin), trousers),
  };
  if (!e) {
    pelvis.add(mesh(new THREE.CylinderGeometry(0.165, 0.18, 0.2, 12), trousers, 0, -0.07, 0), belt(s.p.leather));
    return { legs: plain, skirt: null };
  }
  const base = s.of(e.material, 'base');
  const trim = s.of(e.material, 'trim');
  switch (e.shape.id) {
    case 'platelegs':
      pelvis.add(mesh(new THREE.CylinderGeometry(0.175, 0.22, 0.2, 14), base, 0, -0.08, 0), belt(trim));
      return {
        legs: {
          thigh: () => mesh(segmentGeo(0.062, 0.078, BODY.thigh), base),
          knee: () => mesh(new THREE.SphereGeometry(0.07, 10, 8), trim),
          shin: () => mesh(segmentGeo(0.052, 0.064, BODY.shin), base),
        },
        skirt: null,
      };
    case 'plateskirt': {
      // A flared skirt of plates to mid-thigh; plain legs beneath.
      const open = s.of(e.material, 'base', 'open');
      pelvis.add(
        mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.4, 14, 1, true), open, 0, -0.17, 0),
        mesh(new THREE.TorusGeometry(0.27, 0.013, 6, 24).rotateX(Math.PI / 2), trim, 0, -0.37, 0),
        belt(trim),
      );
      return { legs: plain, skirt: null };
    }
    case 'chaps':
      pelvis.add(mesh(new THREE.CylinderGeometry(0.168, 0.2, 0.22, 12), base, 0, -0.08, 0), belt(trim));
      return {
        legs: {
          thigh: () => mesh(segmentGeo(0.064, 0.078, BODY.thigh), base),
          knee: () => mesh(new THREE.SphereGeometry(0.062, 10, 8), trim),
          shin: () => mesh(segmentGeo(0.056, 0.065, BODY.shin), base),
        },
        skirt: null,
      };
    case 'robeSkirt': {
      // To the floor: the hero view stretches it there, as the slice's mage's.
      const skirt = mesh(new THREE.CylinderGeometry(0.19, 0.34, 1, 16, 1, true).translate(0, -0.5, 0), base, 0, 0.02, 0);
      skirt.add(mesh(new THREE.TorusGeometry(0.34, 0.018, 6, 24).rotateX(Math.PI / 2).translate(0, -1, 0), trim));
      pelvis.add(skirt, belt(trim));
      return {
        legs: {
          thigh: () => mesh(segmentGeo(0.05, 0.06, BODY.thigh), base),
          knee: () => mesh(new THREE.SphereGeometry(0.05, 8, 6), base),
          shin: () => mesh(segmentGeo(0.045, 0.05, BODY.shin), base),
        },
        skirt,
      };
    }
  }
  pelvis.add(belt(trim));
  return { legs: plain, skirt: null };
}

function foot(e: CatalogueEntry | undefined, s: Swatches): THREE.Mesh {
  if (!e) return mesh(new THREE.BoxGeometry(0.1, 0.07, 0.23).translate(0, -0.035, 0.05), s.plain('shoe'));
  const base = s.of(e.material, 'base');
  const boot = mesh(new THREE.BoxGeometry(0.11, 0.085, 0.25).translate(0, -0.03, 0.05), base);
  boot.add(mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.14, 10), base, 0, 0.07, 0));
  // Metal boots (sabatons) carry a toe cap in the trim colour.
  if (e.material.family === 'metal') boot.add(mesh(new THREE.BoxGeometry(0.115, 0.05, 0.07), s.of(e.material, 'trim'), 0, -0.02, 0.15));
  return boot;
}

function dressCape(chest: THREE.Group, e: CatalogueEntry, s: Swatches): THREE.Mesh {
  const cape = capeCard(s.of(e.material, 'base', 'card'), 0.4, 0.86, -0.165);
  const trim = s.of(e.material, 'trim', 'card');
  // A trim band at the hem; the Warden's carries his cross. The cape's outer face looks along -Z.
  cape.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.004), trim, 0, -0.82, -0.006));
  if (e.material.id === 'warden') {
    cape.add(mesh(new THREE.BoxGeometry(0.045, 0.4, 0.004), trim, 0, -0.34, -0.006), mesh(new THREE.BoxGeometry(0.22, 0.045, 0.004), trim, 0, -0.26, -0.006));
  }
  chest.add(cape);
  return cape;
}

function dressNeck(chest: THREE.Group, e: CatalogueEntry, s: Swatches): void {
  const chain = mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 20).rotateX(Math.PI / 2), s.of(e.material, 'trim'), 0, 0.42, 0.01);
  chain.rotation.x = -0.35;
  chest.add(chain, mesh(new THREE.OctahedronGeometry(0.032), s.of(e.material, 'base'), 0, 0.33, 0.165));
}

/** A worn shield, held at its centre with its face toward +Z. */
export function buildGearShield(p: Palette, e: CatalogueEntry): THREE.Group {
  const s = swatches(p);
  const base = s.of(e.material, 'base');
  const trim = s.of(e.material, 'trim');
  const g = new THREE.Group();
  if (e.shape.id === 'kiteshield') {
    const outline = new THREE.Shape();
    outline.moveTo(0, 0.27);
    outline.lineTo(0.2, 0.17);
    outline.lineTo(0.17, -0.06);
    outline.lineTo(0, -0.36);
    outline.lineTo(-0.17, -0.06);
    outline.lineTo(-0.2, 0.17);
    outline.closePath();
    g.add(
      mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.035, bevelEnabled: false }).translate(0, 0, -0.0175), base),
      mesh(new THREE.BoxGeometry(0.04, 0.5, 0.01), trim, 0, -0.04, 0.022),
      mesh(new THREE.BoxGeometry(0.3, 0.04, 0.01), trim, 0, 0.1, 0.022),
    );
  } else {
    // Square: a plate with a raised rim and a boss.
    g.add(mesh(new THREE.BoxGeometry(0.38, 0.42, 0.035), base), mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), trim, 0, 0, 0.017));
    for (const [w, h, x, y] of [
      [0.38, 0.03, 0, 0.2],
      [0.38, 0.03, 0, -0.2],
      [0.03, 0.42, 0.18, 0],
      [0.03, 0.42, -0.18, 0],
    ])
      g.add(mesh(new THREE.BoxGeometry(w, h, 0.012), trim, x, y, 0.022));
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/** The hero in what they wear: body, legs, hands, feet, head, cape and neck. The weapon and shield are the hero view's. */
export function dress(p: Palette, look: Look): Outfit {
  const s = swatches(p);
  const pelvis = new THREE.Group();
  const chest = new THREE.Group();
  const head = new THREE.Group();
  dressHead(head, look.head, s);
  const arm = dressHands(dressBody(chest, look.body, s), look.hands, s);
  const { legs: leg, skirt } = dressLegs(pelvis, look.legs, s);
  const cape = look.cape ? dressCape(chest, look.cape, s) : null;
  if (look.neck) dressNeck(chest, look.neck, s);
  const outfitArms = arms((): Arm => ({ upper: arm.upper(), fore: arm.fore(), elbow: arm.elbow(), hand: arm.hand() }));
  if (look.ring) outfitArms.R.hand.add(mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14), s.of(look.ring.material, 'base'), 0.03, 0, 0));
  const outfit: Outfit = {
    pelvis,
    chest,
    head,
    cape,
    skirt,
    // The swap flash takes the weapon's colour; the hero view sets it per style.
    accent: 0xffffff,
    arms: outfitArms,
    legs: legs((): Leg => ({ thigh: leg.thigh(), shin: leg.shin(), knee: leg.knee(), foot: foot(look.feet, s) })),
  };
  for (const root of outfitParts(outfit))
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  return outfit;
}

/** Every object an outfit hangs on the rig's joints. */
export function outfitParts(o: Outfit): THREE.Object3D[] {
  return [o.pelvis, o.chest, o.head, ...Object.values(o.arms).flatMap((a) => [a.upper, a.fore, a.elbow, a.hand]), ...Object.values(o.legs).flatMap((l) => [l.thigh, l.shin, l.knee, l.foot])];
}

/** Free a dressed outfit's geometry once the hero changes (materials are shared and stay). */
export function undress(o: Outfit): void {
  for (const root of outfitParts(o)) {
    root.removeFromParent();
    root.traverse((x) => {
      if (x instanceof THREE.Mesh) x.geometry.dispose();
    });
  }
}
