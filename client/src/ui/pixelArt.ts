/**
 * Our own pixel art, drawn in code: a logo rendered small and scaled up with
 * hard edges, and 16x16 icons from character grids (no borrowed assets).
 */

/** The title logo: fiery gradient letters with a dark purple outline and a four-point star, drawn at low resolution. */
export function pixelTitle(text: string, heightPx = 34): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `900 ${heightPx}px Georgia, 'Times New Roman', serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 16;
  c.width = w;
  c.height = Math.ceil(heightPx * 1.5);
  // Resizing the canvas resets its state.
  g.font = font;
  g.textBaseline = 'middle';
  g.imageSmoothingEnabled = false;
  const y = c.height / 2 + 1;
  // Thick outline first, then the gradient fill, then a bright inner edge.
  g.lineJoin = 'round';
  g.strokeStyle = '#1a0a24';
  g.lineWidth = 5;
  g.strokeText(text, 8, y);
  g.strokeStyle = '#5a1a4a';
  g.lineWidth = 2.5;
  g.strokeText(text, 8, y);
  const grad = g.createLinearGradient(0, y - heightPx / 2, 0, y + heightPx / 2);
  grad.addColorStop(0, '#ffe7a0');
  grad.addColorStop(0.35, '#ffb347');
  grad.addColorStop(0.7, '#e2582a');
  grad.addColorStop(1, '#8a1f2a');
  g.fillStyle = grad;
  g.fillText(text, 8, y);
  // Four-point star over the first letter (the concept art's spark).
  const sx = 8 + g.measureText(text[0]).width / 2;
  const sy = y - heightPx * 0.05;
  g.fillStyle = '#fff3c4';
  g.beginPath();
  const r = heightPx * 0.42;
  const k = heightPx * 0.06;
  g.moveTo(sx, sy - r);
  g.lineTo(sx + k, sy - k);
  g.lineTo(sx + r * 0.75, sy);
  g.lineTo(sx + k, sy + k);
  g.lineTo(sx, sy + r);
  g.lineTo(sx - k, sy + k);
  g.lineTo(sx - r * 0.75, sy);
  g.lineTo(sx - k, sy - k);
  g.closePath();
  g.fill();
  c.className = 'pixel-art';
  return c;
}

/** Palette for icon grids: each character is one colour ('.' = clear). */
const ICON_COLORS: Record<string, string> = {
  k: '#160c1c', // outline
  w: '#f2ecd8', // white
  s: '#b9c2cc', // steel
  d: '#5e6670', // dark steel
  g: '#e0b04a', // gold
  b: '#3157c4', // royal blue
  r: '#c8372a', // red
  o: '#ff8a3a', // orange
  y: '#ffd27a', // yellow
  n: '#6a4026', // brown
  l: '#9c6b42', // light brown
  e: '#4f8a3a', // green
  c: '#7fd8ff', // cyan
  p: '#8a5ad8', // purple
};

/** A 16x16 icon from 16 strings of 16 characters, as a data URL. */
export function iconUrl(rows: string[]): string {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = ICON_COLORS[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c.toDataURL();
}

/** Icons for heroes and abilities, hand-placed pixel by pixel. */
export const ICONS: Record<string, string[]> = {
  sword: [
    '..............kk',
    '.............kwk',
    '............kwsk',
    '...........kwsk.',
    '..........kwsk..',
    '.........kwsk...',
    '........kwsk....',
    '...k...kwsk.....',
    '...kk.kwsk......',
    '....kgkwk.......',
    '.....kgk........',
    '....kgkgk.......',
    '...knk.kgk......',
    '..knk...kk......',
    '.kgk............',
    '.kk.............',
  ],
  bow: [
    '.....kkk........',
    '....knnlk.......',
    '...knk..wk......',
    '...kk...w.k.....',
    '..kn....w..k....',
    '..kn....w...k...',
    '.kn.....w....k..',
    '.kn.....w.....kk',
    '.kn.....w....kyk',
    '.kn.....w.....kk',
    '..kn....w...k...',
    '..kn....w..k....',
    '...kk...w.k.....',
    '...knk..wk......',
    '....knnlk.......',
    '.....kkk........',
  ],
  staff: [
    '...........kkk..',
    '..........kcwck.',
    '..........kccck.',
    '...........kkk..',
    '..........kgk...',
    '.........knk....',
    '........knk.....',
    '.......knk......',
    '......knk.......',
    '.....knk........',
    '....knk.........',
    '...knk..........',
    '..knk...........',
    '.knk............',
    'knk.............',
    'kk..............',
  ],
  charge: [
    '................',
    '....kkkk........',
    '...kbbbbk.......',
    '..kbggbbbk..kk..',
    '..kbggbbbk.kwwk.',
    '..kbbbbbbkkwwk..',
    '..kbggbbbkwwk...',
    '..kbggbbbkwk....',
    '..kbbbbbbkkwk...',
    '...kbbbbk..kwk..',
    '....kkkk....kwk.',
    '.............kk.',
    '................',
    '..wwww..wwww....',
    '................',
    '................',
  ],
  whirlwind: [
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwkkkkkkwwk..',
    '.kwk........kwk.',
    '.kwk..kkkk...kk.',
    'kwk..kwwwwk.....',
    'kwk.kwk..kwk....',
    'kwk.kwk..kwk.kk.',
    'kwk..kkkkwk..kwk',
    '.kwk....kwk..kwk',
    '.kwk.......kkwk.',
    '..kwwkkkkkkwwk..',
    '...kkwwwwwwkk...',
    '.....kkkkkk.....',
    '................',
  ],
  volley: [
    '................',
    'kk.....kk.....kk',
    'kwk...kwk....kwk',
    '.kwk..kwk...kwk.',
    '..kwk.kwk..kwk..',
    '...kwkkwkkkwk...',
    '....kwkwkwwk....',
    '.....kwwwwk.....',
    '......kwwk......',
    '......knnk......',
    '......knnk......',
    '.....krkkrk.....',
    '....krk..krk....',
    '................',
    '................',
    '................',
  ],
  disengage: [
    '................',
    '........kkk.....',
    '......kkeeek....',
    '.....keek.kek...',
    '....kek....kek..',
    '....kek.....kk..',
    '...kek..........',
    '...kek.....k....',
    '...kek....kek...',
    '....kek..keeek..',
    '....kekkkeeeeek.',
    '.....keeeek.kek.',
    '......kkkk...k..',
    '................',
    'kkkkkkkkkkkkkkk.',
    '................',
  ],
  frostRing: [
    '......kkkk......',
    '....kkcccckk....',
    '...kcck..kcck...',
    '..kck......kck..',
    '.kck...kk...kck.',
    '.kck..kwwk..kck.',
    'kck..kwccwk..kck',
    'kck..kwccwk..kck',
    'kck...kwwk...kck',
    '.kck...kk...kck.',
    '.kck........kck.',
    '..kck......kck..',
    '...kcck..kcck...',
    '....kkcccckk....',
    '......kkkk......',
    '................',
  ],
  blink: [
    '................',
    '..k.....k.....k.',
    '.kpk...kck...kpk',
    '..k...kcwck...k.',
    '.....kcwwwck....',
    '....kcwwwwwck...',
    '...kcwwwwwwwck..',
    '..kcwwwwwwwwwck.',
    '...kcwwwwwwwck..',
    '....kcwwwwwck...',
    '.....kcwwwck....',
    '..k...kcwck...k.',
    '.kpk...kck...kpk',
    '..k.....k.....k.',
    '................',
    '................',
  ],
};
