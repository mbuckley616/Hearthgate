import * as THREE from 'three';

/**
 * Dungeon dressing, all made here (no borrowed assets): banners with the
 * order's sigil, standing braziers, candle clusters and the odd skull.
 */

/** The sigil from the concept art: a ring crossed by a long-tailed cross. */
function drawSigil(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - r * 1.35);
  g.lineTo(cx, cy + r * 2.1);
  g.moveTo(cx - r * 1.3, cy);
  g.lineTo(cx + r * 1.3, cy);
  g.stroke();
}

let bannerTex: THREE.CanvasTexture | null = null;

/** Deep red cloth, gold border and sigil, a ragged hem (alpha). Shared by every banner. */
function bannerTexture(): THREE.CanvasTexture {
  if (bannerTex) return bannerTex;
  const w = 64;
  const h = 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const cloth = g.createLinearGradient(0, 0, w, 0);
  cloth.addColorStop(0, '#4a0f16');
  cloth.addColorStop(0.5, '#7a1822');
  cloth.addColorStop(1, '#4a0f16');
  g.fillStyle = cloth;
  // Ragged swallowtail hem.
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, h - 8);
  for (let x = w; x >= 0; x -= 4) g.lineTo(x, h - 22 + Math.abs(x - w / 2) * 0.45 + ((x * 7) % 9));
  g.closePath();
  g.fill();
  // Woven stripes and a gold border.
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
  g.strokeStyle = '#c99a3a';
  g.lineWidth = 3;
  g.strokeRect(5, 5, w - 10, h - 40);
  drawSigil(g, w / 2, 52, 12, '#e0b04a');
  bannerTex = new THREE.CanvasTexture(c);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  bannerTex.magFilter = THREE.NearestFilter;
  return bannerTex;
}

/** A banner hanging from a short iron rod; origin at the rod, cloth hangs down and slightly out. */
export function buildBanner(): THREE.Group {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 2.9, 1, 6).translate(0, -1.45, 0),
    new THREE.MeshStandardMaterial({ map: bannerTexture(), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide }),
  );
  cloth.position.z = 0.08;
  cloth.rotation.x = 0.03;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x2b2522, metalness: 0.6, roughness: 0.5 }));
  rod.rotation.z = Math.PI / 2;
  rod.position.z = 0.1;
  g.add(cloth, rod);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.receiveShadow = true;
  });
  return g;
}

/** Iron fire bowl on three legs; returns the flame so the room can flicker it. */
export function buildBrazier(fireColor: number): { group: THREE.Group; flame: THREE.Mesh } {
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2421, metalness: 0.65, roughness: 0.55 });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 6), iron);
    leg.position.set(Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.26, 12, 1, true), iron);
  bowl.position.y = 1.0;
  (bowl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const coals = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a1a).multiplyScalar(2.2), toneMapped: false }),
  );
  coals.position.y = 1.08;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.75, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(fireColor).multiplyScalar(4), toneMapped: false, transparent: true, opacity: 0.9 }),
  );
  flame.position.y = 1.45;
  g.add(bowl, coals, flame);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o !== flame && o !== coals) o.castShadow = true;
  });
  return { group: g, flame };
}

/** A few melted candles of different heights. */
export function buildCandles(seed: number): THREE.Group {
  const g = new THREE.Group();
  const wax = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(4), toneMapped: false });
  for (let i = 0; i < 5; i++) {
    const r = Math.sin(seed * 12.9 + i * 78.2) * 0.5 + 0.5;
    const hgt = 0.12 + r * 0.28;
    const x = Math.cos(i * 2.4 + seed) * (0.08 + r * 0.14);
    const z = Math.sin(i * 2.4 + seed) * (0.08 + r * 0.1);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, hgt, 8), wax);
    candle.position.set(x, hgt / 2, z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), flameMat);
    flame.position.set(x, hgt + 0.04, z);
    g.add(candle, flame);
  }
  return g;
}

/** A skull lying on the floor. */
export function buildSkull(): THREE.Group {
  const bone = new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.8 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0608 });
  const g = new THREE.Group();
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), bone);
  cranium.scale.set(1, 0.9, 1.15);
  cranium.position.y = 0.12;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.12), bone);
  jaw.position.set(0, 0.03, 0.06);
  g.add(cranium, jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
    eye.position.set(side * 0.05, 0.13, 0.12);
    g.add(eye);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
