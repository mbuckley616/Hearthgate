import * as THREE from 'three';
import { PORTAL_HOLD_S, type PortalState } from '@hearthgate/shared/game/portal';

const SEGMENTS = 64;
const MOTES = 48;
/**
 * The words fade as the camera comes up to them (the critic, 30 Oct): the shrine's door stands just
 * behind the village ring, and a camera behind a hero there looks through letters a third of the screen.
 */
const LABEL_FADE_NEAR = 3;
const LABEL_FADE_FAR = 6;
const labelAt = new THREE.Vector3();

/**
 * A portal on the ground (T3): a glowing violet ring with a slow swirl inside and motes rising, and
 * a bright arc that fills as the party holds it (PORTAL_HOLD_S). Draws whatever the latest snapshot
 * says is open (ClientSession.portals): the village's ring always, the arena's once the run is over,
 * a rest room's two (T4). A ring that leads home burns gold, any other violet. Draw-only; the server
 * decides when it is taken.
 */
export class PortalView {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private swirl: THREE.Mesh;
  private fill: THREE.Mesh;
  private fillGeo: THREE.RingGeometry;
  private shownFill = -1;
  private shownRadius = 0;
  private motes: THREE.Points;
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = new Float32Array(MOTES);
  private time = 0;
  private shownTo = '';
  /** Where the ring leads, in words above it (T4b: a hand-built dungeon's name, Deeper, Home). */
  private label: THREE.Sprite;
  private shownLabel = '';
  private labelAspect = 1;

  constructor() {
    const glow = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, SEGMENTS), glow(0x9a6cff, 0.9));
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(0.9, SEGMENTS), new THREE.MeshBasicMaterial({ map: swirlTexture(), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    this.fillGeo = new THREE.RingGeometry(1.02, 1.14, SEGMENTS, 1, 0, 0.001);
    this.fill = new THREE.Mesh(this.fillGeo, glow(0xffe0a0, 1));
    for (const m of [this.ring, this.swirl, this.fill]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 2;
      // Above the paths, which are themselves pulled toward the camera so they never flicker against the grass.
      const mat = m.material as THREE.Material;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -8;
      mat.polygonOffsetUnits = -8;
      this.group.add(m);
    }
    this.ring.position.y = 0.07;
    this.swirl.position.y = 0.06;
    this.fill.position.y = 0.08;
    for (let i = 0; i < MOTES; i++) this.moteSeed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.08, color: new THREE.Color(0xc4a4ff).multiplyScalar(2.5), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    this.label.position.y = 2.7;
    this.label.renderOrder = 3;
    this.group.add(this.label);
    this.group.visible = false;
  }

  /** `eye`, the camera's position, fades the words when it is close to them. */
  update(portal: PortalState | null, dt: number, eye?: THREE.Vector3): void {
    this.group.visible = !!portal;
    if (!portal) return;
    this.time += dt;
    this.group.position.set(portal.x, portal.y, portal.z);
    if (portal.to !== this.shownTo) {
      this.shownTo = portal.to;
      const home = portal.to === 'village';
      (this.ring.material as THREE.MeshBasicMaterial).color.set(home ? 0xffc864 : 0x9a6cff).multiplyScalar(2.2);
      (this.motes.material as THREE.PointsMaterial).color.set(home ? 0xffe2a0 : 0xc4a4ff).multiplyScalar(2.5);
      (this.swirl.material as THREE.MeshBasicMaterial).color.set(home ? 0xffd890 : 0xffffff);
    }
    if (portal.label !== this.shownLabel) {
      this.shownLabel = portal.label;
      const mat = this.label.material;
      mat.map?.dispose();
      const { texture, aspect } = labelTexture(portal.label);
      mat.map = texture;
      mat.needsUpdate = true;
      this.labelAspect = aspect;
      this.shownRadius = 0;
    }
    if (portal.radius !== this.shownRadius) {
      this.shownRadius = portal.radius;
      this.group.scale.set(portal.radius, 1, portal.radius);
      this.motes.scale.set(1 / portal.radius, 1, 1 / portal.radius);
      // The group is scaled to the ring; the words keep their own size.
      this.label.scale.set((0.5 * this.labelAspect) / portal.radius, 0.5, 1);
    }
    this.label.getWorldPosition(labelAt);
    const near = eye ? labelAt.distanceTo(eye) : LABEL_FADE_FAR;
    const fade = Math.min(1, Math.max(0, (near - LABEL_FADE_NEAR) / (LABEL_FADE_FAR - LABEL_FADE_NEAR)));
    this.label.material.opacity = fade;
    this.label.visible = fade > 0;
    this.swirl.rotation.z = this.time * 0.6;
    const k = Math.min(1, portal.held / PORTAL_HOLD_S);
    // Rebuilt only when the fill moves, in coarse steps: it is a progress arc, not an animation.
    const step = Math.round(k * 40);
    if (step !== this.shownFill) {
      this.shownFill = step;
      this.fill.geometry.dispose();
      this.fill.geometry = new THREE.RingGeometry(1.02, 1.14, SEGMENTS, 1, Math.PI / 2, Math.max(0.001, (step / 40) * Math.PI * 2));
    }
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(this.time * 3) * 0.15 + k * 0.2;
    const r = portal.radius;
    for (let i = 0; i < MOTES; i++) {
      const s = this.moteSeed[i];
      const life = (this.time * (0.25 + s * 0.2) + s) % 1;
      const a = s * 40 + this.time * (0.4 + s);
      const rr = r * (0.2 + 0.75 * ((s * 7) % 1));
      this.motePos[i * 3] = Math.cos(a) * rr;
      this.motePos[i * 3 + 1] = life * 2.4;
      this.motePos[i * 3 + 2] = Math.sin(a) * rr;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
  }
}

/** The words over a ring, gold on a dark band, for a sprite. */
function labelTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = 'bold 44px Georgia, serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w;
  c.height = 64;
  g.font = font;
  g.fillStyle = 'rgba(12, 6, 20, 0.6)';
  g.fillRect(0, 0, w, 64);
  g.fillStyle = '#ffcf6a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 34);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: w / 64 };
}

/** A soft violet spiral, drawn once. */
function swirlTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(230,210,255,0.9)');
  grad.addColorStop(0.5, 'rgba(140,90,255,0.45)');
  grad.addColorStop(1, 'rgba(60,20,140,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,240,255,0.55)';
  g.lineWidth = 3;
  for (let arm = 0; arm < 3; arm++) {
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = arm * ((Math.PI * 2) / 3) + t * 5;
      const r = t * size * 0.46;
      const x = size / 2 + Math.cos(a) * r;
      const y = size / 2 + Math.sin(a) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
