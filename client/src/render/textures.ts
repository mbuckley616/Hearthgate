import * as THREE from 'three';

/**
 * Procedural stone textures so the M0 room reads as a dungeon without any
 * downloaded assets. The modular dungeon kit replaces these later.
 */

/** Small deterministic PRNG so the room looks the same every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface StoneOptions {
  seed: number;
  cols: number;
  rows: number;
  /** Offset alternate rows by half a block (bricks). */
  staggered: boolean;
  base: [number, number, number];
  variance: number;
  grout: string;
  groutWidth: number;
}

/** Returns a colour map and a matching bump map (grout lines recessed). */
function stonePair(o: StoneOptions, repeatX: number, repeatY: number): { map: THREE.Texture; bump: THREE.Texture } {
  const size = 512;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = size;
  const cg = color.getContext('2d')!;
  const bg = bump.getContext('2d')!;
  const rand = rng(o.seed);

  cg.fillStyle = o.grout;
  cg.fillRect(0, 0, size, size);
  bg.fillStyle = '#000';
  bg.fillRect(0, 0, size, size);

  const bw = size / o.cols;
  const bh = size / o.rows;
  for (let r = 0; r < o.rows; r++) {
    const offset = o.staggered && r % 2 === 1 ? bw / 2 : 0;
    for (let c = -1; c < o.cols; c++) {
      const x = c * bw + offset;
      const y = r * bh;
      const v = 1 + (rand() - 0.5) * o.variance;
      const [br, bgc, bb] = o.base.map((ch) => Math.min(255, Math.round(ch * v)));
      cg.fillStyle = `rgb(${br},${bgc},${bb})`;
      const g = o.groutWidth;
      cg.fillRect(x + g, y + g, bw - g * 2, bh - g * 2);
      const height = 150 + Math.round(rand() * 80);
      bg.fillStyle = `rgb(${height},${height},${height})`;
      bg.fillRect(x + g, y + g, bw - g * 2, bh - g * 2);
    }
  }

  // Speckle and grime so flat blocks don't look plastic.
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * 0.12;
    cg.fillStyle = rand() > 0.5 ? `rgba(255,240,220,${a})` : `rgba(0,0,0,${a * 1.5})`;
    cg.fillRect(x, y, 2, 2);
    bg.fillStyle = `rgba(0,0,0,${a})`;
    bg.fillRect(x, y, 2, 2);
  }

  return { map: toTexture(color, repeatX, repeatY, true), bump: toTexture(bump, repeatX, repeatY, false) };
}

export function floorTextures(floorSize: number) {
  // Texture spans 4 m (4 x 4 slabs of 1 m).
  const rep = floorSize / 4;
  return stonePair(
    { seed: 7, cols: 4, rows: 4, staggered: true, base: [92, 84, 78], variance: 0.28, grout: '#1c1816', groutWidth: 3 },
    rep,
    rep,
  );
}

export function wallTextures(length: number, height: number) {
  // Texture spans 3 m x 3 m of bricks.
  return stonePair(
    { seed: 11, cols: 6, rows: 10, staggered: true, base: [86, 80, 82], variance: 0.3, grout: '#191517', groutWidth: 3 },
    length / 3,
    height / 3,
  );
}

export function pillarTextures(circumference: number, height: number) {
  return stonePair(
    { seed: 23, cols: 4, rows: 6, staggered: true, base: [104, 96, 90], variance: 0.22, grout: '#211c19', groutWidth: 3 },
    Math.max(1, Math.round(circumference / 2)),
    height / 3,
  );
}
