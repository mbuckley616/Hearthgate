import * as THREE from 'three';

/**
 * The village's textures (T3), drawn in code like the slice's stone (textures.ts): grass, packed
 * earth, plaster with timber framing, roof shingles, planks and fieldstone. Each is a colour map
 * and a bump map from one seeded generator, so the village looks the same on every load.
 */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasPair(size: number): { color: HTMLCanvasElement; bump: HTMLCanvasElement; cg: CanvasRenderingContext2D; bg: CanvasRenderingContext2D } {
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = size;
  return { color, bump, cg: color.getContext('2d')!, bg: bump.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface TexturePair {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

function pair(c: ReturnType<typeof canvasPair>): TexturePair {
  return { map: toTexture(c.color, true), bump: toTexture(c.bump, false) };
}

const cache = new Map<string, TexturePair>();
/** One texture pair per kind, cloned per surface so each can repeat at its own size. */
function cached(key: string, make: () => TexturePair, repeatX: number, repeatY: number): TexturePair {
  let p = cache.get(key);
  if (!p) cache.set(key, (p = make()));
  const map = p.map.clone();
  const bump = p.bump.clone();
  map.repeat.set(repeatX, repeatY);
  bump.repeat.set(repeatX, repeatY);
  map.needsUpdate = bump.needsUpdate = true;
  return { map, bump };
}

/** Speckle a canvas pair so flat colour does not look plastic. */
function speckle(c: ReturnType<typeof canvasPair>, rand: () => number, n: number, light: string, dark: string, size: number) {
  for (let i = 0; i < n; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * 0.14;
    c.cg.fillStyle = rand() > 0.5 ? `rgba(${light},${a})` : `rgba(${dark},${a * 1.4})`;
    c.cg.fillRect(x, y, 2, 2);
    c.bg.fillStyle = `rgba(0,0,0,${a})`;
    c.bg.fillRect(x, y, 2, 2);
  }
}

/** Short grass in late sun: mottled greens with yellowed tufts. Spans 4 m. */
export function grassTextures(w: number, d: number): TexturePair {
  return cached(
    'grass',
    () => {
      const size = 256;
      const c = canvasPair(size);
      const rand = rng(23);
      c.cg.fillStyle = '#5d7a32';
      c.cg.fillRect(0, 0, size, size);
      c.bg.fillStyle = '#808080';
      c.bg.fillRect(0, 0, size, size);
      for (let i = 0; i < 2600; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const g = 90 + Math.round(rand() * 60);
        const r = 60 + Math.round(rand() * (rand() > 0.85 ? 90 : 30));
        c.cg.fillStyle = `rgb(${r},${g},${30 + Math.round(rand() * 20)})`;
        c.cg.fillRect(x, y, 2, 3 + rand() * 3);
        c.bg.fillStyle = `rgb(${150 + rand() * 80},0,0)`;
        c.bg.fillRect(x, y, 2, 3);
      }
      return pair(c);
    },
    w / 4,
    d / 4,
  );
}

/** Packed earth for the paths and the square: tan, pebbled, with ruts. Spans 3 m. */
export function earthTextures(w: number, d: number): TexturePair {
  return cached(
    'earth',
    () => {
      const size = 256;
      const c = canvasPair(size);
      const rand = rng(31);
      c.cg.fillStyle = '#9a7a52';
      c.cg.fillRect(0, 0, size, size);
      c.bg.fillStyle = '#707070';
      c.bg.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 2 + rand() * 5;
        const v = 120 + Math.round(rand() * 70);
        c.cg.fillStyle = `rgb(${v},${Math.round(v * 0.86)},${Math.round(v * 0.66)})`;
        c.cg.beginPath();
        c.cg.ellipse(x, y, r, r * 0.8, rand() * 3, 0, Math.PI * 2);
        c.cg.fill();
        c.bg.fillStyle = `rgb(${180 + rand() * 60},0,0)`;
        c.bg.beginPath();
        c.bg.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
        c.bg.fill();
      }
      speckle(c, rand, 5000, '255,235,200', '40,25,10', size);
      return pair(c);
    },
    w / 3,
    d / 3,
  );
}

/** Lime plaster between dark oak beams: posts every metre, a rail at mid height, a brace per bay. Spans 2 m by 2 m. */
export function timberTextures(w: number, h: number): TexturePair {
  return cached(
    'timber',
    () => {
      const size = 256;
      const c = canvasPair(size);
      const rand = rng(41);
      c.cg.fillStyle = '#e4d3b0';
      c.cg.fillRect(0, 0, size, size);
      c.bg.fillStyle = '#909090';
      c.bg.fillRect(0, 0, size, size);
      speckle(c, rand, 6000, '255,250,235', '110,90,60', size);
      const beam = (x: number, y: number, bw: number, bh: number) => {
        c.cg.fillStyle = '#4a3020';
        c.cg.fillRect(x, y, bw, bh);
        c.bg.fillStyle = '#e0e0e0';
        c.bg.fillRect(x, y, bw, bh);
      };
      const b = 14;
      for (const x of [0, size / 2]) beam(x, 0, b, size);
      for (const y of [0, size / 2 - b / 2]) beam(0, y, size, b);
      // Diagonal braces in each lower bay.
      c.cg.strokeStyle = '#4a3020';
      c.bg.strokeStyle = '#e0e0e0';
      c.cg.lineWidth = c.bg.lineWidth = 11;
      for (const x0 of [0, size / 2]) {
        for (const g of [c.cg, c.bg]) {
          g.beginPath();
          g.moveTo(x0 + b, size);
          g.lineTo(x0 + size / 2, size / 2 + b / 2);
          g.stroke();
        }
      }
      return pair(c);
    },
    w / 2,
    h / 2,
  );
}

/** Shingle rows in a given colour, each tile its own shade. Spans 2 m. */
export function roofTextures(w: number, d: number, base: [number, number, number], seed: number): TexturePair {
  return cached(
    `roof-${seed}`,
    () => {
      const size = 256;
      const c = canvasPair(size);
      const rand = rng(seed);
      c.cg.fillStyle = '#2a1a14';
      c.cg.fillRect(0, 0, size, size);
      c.bg.fillStyle = '#000';
      c.bg.fillRect(0, 0, size, size);
      const rows = 12;
      const cols = 8;
      const th = size / rows;
      const tw = size / cols;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? tw / 2 : 0;
        for (let k = -1; k < cols; k++) {
          const v = 0.8 + rand() * 0.35;
          c.cg.fillStyle = `rgb(${Math.round(base[0] * v)},${Math.round(base[1] * v)},${Math.round(base[2] * v)})`;
          c.cg.fillRect(k * tw + off + 1, r * th + 1, tw - 2, th - 2);
          const grad = c.bg.createLinearGradient(0, r * th, 0, r * th + th);
          grad.addColorStop(0, '#606060');
          grad.addColorStop(1, '#f0f0f0');
          c.bg.fillStyle = grad;
          c.bg.fillRect(k * tw + off + 1, r * th + 1, tw - 2, th - 2);
        }
      }
      return pair(c);
    },
    w / 2,
    d / 2,
  );
}

/** Weathered planks running one way (doors, the palisade's rails, the well's roof). Spans 1 m. */
export function plankTextures(w: number, h: number): TexturePair {
  return cached(
    'planks',
    () => {
      const size = 128;
      const c = canvasPair(size);
      const rand = rng(53);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const v = 0.85 + rand() * 0.3;
        c.cg.fillStyle = `rgb(${Math.round(118 * v)},${Math.round(84 * v)},${Math.round(52 * v)})`;
        c.cg.fillRect((i * size) / n, 0, size / n, size);
        c.bg.fillStyle = '#b0b0b0';
        c.bg.fillRect((i * size) / n + 1, 0, size / n - 2, size);
      }
      speckle(c, rand, 1400, '230,200,150', '30,18,8', size);
      return pair(c);
    },
    w,
    h,
  );
}

/** Rounded fieldstones in mortar, warm grey (the buildings' plinths, the well, the shrine). Spans 2 m. */
export function fieldstoneTextures(w: number, h: number): TexturePair {
  return cached(
    'fieldstone',
    () => {
      const size = 256;
      const c = canvasPair(size);
      const rand = rng(61);
      c.cg.fillStyle = '#6e6358';
      c.cg.fillRect(0, 0, size, size);
      c.bg.fillStyle = '#202020';
      c.bg.fillRect(0, 0, size, size);
      for (let i = 0; i < 70; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const rx = 10 + rand() * 18;
        const ry = 8 + rand() * 12;
        const v = 140 + Math.round(rand() * 60);
        c.cg.fillStyle = `rgb(${v},${Math.round(v * 0.95)},${Math.round(v * 0.86)})`;
        c.bg.fillStyle = `rgb(${170 + rand() * 70},0,0)`;
        for (const [g] of [[c.cg], [c.bg]] as const) {
          g.beginPath();
          g.ellipse(x, y, rx, ry, rand() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      speckle(c, rand, 3000, '255,240,220', '0,0,0', size);
      return pair(c);
    },
    w / 2,
    h / 2,
  );
}
