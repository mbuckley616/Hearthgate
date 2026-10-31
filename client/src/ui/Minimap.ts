import type { PortalState } from '@hearthgate/shared/game/portal';
import type { FloorLayout, PieceInfo } from '@hearthgate/shared/level/floor';
import { STEP_H } from '@hearthgate/shared/level/kit';
import type { PlayerState, SimState } from '@hearthgate/shared/sim/types';

/** Pixels per metre on the drawn floor plan (it is scaled again when shown). */
const PX = 4;
/** The corner map shows this many metres across around the hero; the large one the whole floor. */
const NEAR_M = 70;
const SMALL = 200;
const LARGE = 420;

/**
 * The minimap (T4; decisions.md 27 Oct: every room visible, a minimap instead of fog). A HUD
 * corner (bottom right, rule 5), drawn on a canvas: every piece of the floor, lighter the higher
 * it stands, staircases with an arrow up, the rest room and the Warden's hall marked, cleared rooms
 * dimmed, the shut room in red; the rings, the party as dots and you as an arrow. M (or the
 * gamepad's Start) switches between the corner, which follows you, and the whole floor; nothing
 * needs a hover or the mouse.
 */
export class Minimap {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly hint: HTMLDivElement;
  private plan: HTMLCanvasElement | null = null;
  private layout: FloorLayout | null = null;
  private planCleared = -1;
  private large = false;
  private time = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'minimap';
    this.canvas = document.createElement('canvas');
    this.hint = document.createElement('div');
    this.hint.className = 'minimap-hint';
    this.root.append(this.canvas, this.hint);
    document.body.appendChild(this.root);
    this.setLarge(false);
    this.root.style.display = 'none';
  }

  /** The floor to map, or null off a floor (the village, the arena): then it hides. */
  setFloor(layout: FloorLayout | null): void {
    this.layout = layout;
    this.plan = null;
    this.planCleared = -1;
    this.root.style.display = layout ? 'block' : 'none';
  }

  toggle(): void {
    if (this.layout) this.setLarge(!this.large);
  }

  get visible(): boolean {
    return this.layout !== null;
  }

  private setLarge(large: boolean): void {
    this.large = large;
    // The whole floor never takes more than about half a short screen.
    const size = large ? Math.round(Math.max(SMALL, Math.min(LARGE, window.innerHeight * 0.55))) : SMALL;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.root.classList.toggle('large', large);
    this.hint.textContent = large ? 'M  smaller map' : 'M  whole floor';
  }

  update(sim: SimState, me: PlayerState | null, localId: string, portals: readonly PortalState[], dt: number): void {
    const layout = this.layout;
    if (!layout) return;
    this.time += dt;
    const cleared = sim.floor?.cleared ?? [];
    if (!this.plan || this.planCleared !== cleared.length) {
      this.plan = drawPlan(layout, cleared);
      this.planCleared = cleared.length;
    }
    const g = this.canvas.getContext('2d')!;
    const W = this.canvas.width;
    const b = layout.bounds;
    // Map metres to canvas pixels: the whole floor (large), or a window round the hero (corner).
    let scale: number;
    let cx: number;
    let cz: number;
    if (this.large || !me) {
      scale = (W * 0.92) / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      cx = (b.minX + b.maxX) / 2;
      cz = (b.minZ + b.maxZ) / 2;
    } else {
      scale = W / NEAR_M;
      cx = me.x;
      cz = me.z;
    }
    const toX = (x: number) => W / 2 + (x - cx) * scale;
    const toY = (z: number) => W / 2 + (z - cz) * scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(10, 8, 14, 0.78)';
    g.fillRect(0, 0, W, W);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.plan, toX(b.minX - 1), toY(b.minZ - 1), (b.maxX - b.minX + 2) * scale, (b.maxZ - b.minZ + 2) * scale);

    // The room being fought, pulsing.
    const shut = sim.floor && sim.run.gateClosed ? sim.floor.room : -1;
    if (shut >= 0) {
      const p = layout.pieces[shut];
      g.strokeStyle = `rgba(255, 70, 60, ${0.6 + Math.sin(this.time * 6) * 0.35})`;
      g.lineWidth = Math.max(2, scale * 0.8);
      g.strokeRect(toX(p.inner.minX), toY(p.inner.minZ), (p.inner.maxX - p.inner.minX) * scale, (p.inner.maxZ - p.inner.minZ) * scale);
      g.fillStyle = '#ff5a4a';
      for (const e of sim.enemies) if (e.ai !== 'dead') dot(g, toX(e.x), toY(e.z), Math.max(2, scale * 0.45));
    }
    for (const ring of portals) {
      g.strokeStyle = ring.to === 'village' ? '#ffd27a' : '#b48cff';
      g.lineWidth = Math.max(2, scale * 0.5);
      g.beginPath();
      g.arc(toX(ring.x), toY(ring.z), Math.max(4, ring.radius * scale), 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of sim.players) {
      if (p.id === localId) continue;
      g.fillStyle = p.mode === 'down' ? '#7a7a7a' : '#7fd3ff';
      dot(g, toX(p.x), toY(p.z), Math.max(3, scale * 0.7));
    }
    if (me) arrow(g, toX(me.x), toY(me.z), me.yaw, Math.max(7, scale * 1.6));
  }
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** You: a bright arrow pointing the way the hero faces (yaw 0 faces +z, which is down the map). */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, size: number): void {
  const fx = Math.sin(yaw);
  const fy = Math.cos(yaw);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#1a1420';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + fx * size, y + fy * size);
  g.lineTo(x - fx * size * 0.6 + fy * size * 0.6, y - fy * size * 0.6 - fx * size * 0.6);
  g.lineTo(x - fx * size * 0.25, y - fy * size * 0.25);
  g.lineTo(x - fx * size * 0.6 - fy * size * 0.6, y - fy * size * 0.6 + fx * size * 0.6);
  g.closePath();
  g.stroke();
  g.fill();
}

/** The floor plan, drawn once (and again when a room is cleared) at PX pixels a metre. */
function drawPlan(layout: FloorLayout, cleared: readonly number[]): HTMLCanvasElement {
  const b = layout.bounds;
  const c = document.createElement('canvas');
  c.width = Math.ceil((b.maxX - b.minX + 2) * PX);
  c.height = Math.ceil((b.maxZ - b.minZ + 2) * PX);
  const g = c.getContext('2d')!;
  const X = (x: number) => (x - b.minX + 1) * PX;
  const Y = (z: number) => (z - b.minZ + 1) * PX;
  const top = Math.max(1, ...layout.pieces.map((p) => p.top / STEP_H));
  const shade = (y: number, dim: boolean) => {
    // Low floors slate blue, high ones pale sand: a climb reads at a glance.
    const t = y / STEP_H / top;
    const r = Math.round(70 + t * 150);
    const gg = Math.round(78 + t * 125);
    const bl = Math.round(110 + t * 50);
    return dim ? `rgb(${Math.round(r * 0.55)}, ${Math.round(gg * 0.55)}, ${Math.round(bl * 0.6)})` : `rgb(${r}, ${gg}, ${bl})`;
  };
  for (const p of layout.pieces) {
    const i = p.inner;
    const dim = cleared.includes(p.id);
    if (p.ramp) {
      // A staircase: a gradient from its low end to its high end, and an arrow up.
      const r = p.ramp;
      const [x0, y0, x1, y1] =
        r.up === 'n' ? [0, Y(i.maxZ), 0, Y(i.minZ)] : r.up === 's' ? [0, Y(i.minZ), 0, Y(i.maxZ)] : r.up === 'w' ? [X(i.maxX), 0, X(i.minX), 0] : [X(i.minX), 0, X(i.maxX), 0];
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, shade(p.y, false));
      grad.addColorStop(1, shade(p.top, false));
      g.fillStyle = grad;
      g.fillRect(X(i.minX), Y(i.minZ), (i.maxX - i.minX) * PX, (i.maxZ - i.minZ) * PX);
      stairArrow(g, X((r.minX + r.maxX) / 2), Y((r.minZ + r.maxZ) / 2), r.up, PX * 2.2);
    } else {
      g.fillStyle = p.kind === 'rest' ? '#d9b46a' : p.kind === 'boss' ? '#b0453c' : shade(p.y, dim);
      g.fillRect(X(i.minX), Y(i.minZ), (i.maxX - i.minX) * PX, (i.maxZ - i.minZ) * PX);
    }
    // Doorways: the gap through the walls to the neighbour.
    g.fillStyle = shade(p.y, dim);
    for (const d of p.doors) {
      if (!d.open) continue;
      const ns = d.side === 'n' || d.side === 's';
      g.fillStyle = shade(d.y, dim);
      g.fillRect(X(d.x - (ns ? 1.6 : 0.6)), Y(d.z - (ns ? 0.6 : 1.6)), (ns ? 3.2 : 1.2) * PX, (ns ? 1.2 : 3.2) * PX);
    }
    if (p.fight && !dim) {
      g.fillStyle = 'rgba(255, 90, 70, 0.9)';
      dot(g, X((i.minX + i.maxX) / 2), Y((i.minZ + i.maxZ) / 2), PX * 0.9);
    }
    // Lava (D6), so the way round reads on the map.
    for (const l of layout.lava) {
      if (l.piece !== p.id) continue;
      g.fillStyle = dim ? 'rgba(170, 70, 20, 0.8)' : 'rgb(255, 120, 40)';
      g.fillRect(X(l.minX), Y(l.minZ), (l.maxX - l.minX) * PX, (l.maxZ - l.minZ) * PX);
    }
    for (const pl of p.pillars) {
      g.fillStyle = 'rgba(20, 16, 24, 0.7)';
      dot(g, X(pl.x), Y(pl.z), Math.max(1.5, pl.radius * PX));
    }
    label(g, p, X, Y);
  }
  return c;
}

/** The entrance, the rest room and the Warden's hall get a word on the map. */
function label(g: CanvasRenderingContext2D, p: PieceInfo, X: (x: number) => number, Y: (z: number) => number): void {
  const text = p.kind === 'entrance' ? 'IN' : p.kind === 'rest' ? 'REST' : p.kind === 'boss' ? 'WARDEN' : '';
  if (!text) return;
  g.font = `bold ${PX * 2.6}px monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1a1420';
  g.fillText(text, X((p.inner.minX + p.inner.maxX) / 2), Y((p.inner.minZ + p.inner.maxZ) / 2) + PX * 3);
}

function stairArrow(g: CanvasRenderingContext2D, x: number, y: number, up: 'n' | 'e' | 's' | 'w', size: number): void {
  const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[up];
  g.strokeStyle = '#1a1420';
  g.lineWidth = Math.max(2, size * 0.25);
  g.beginPath();
  g.moveTo(x - d[0] * size, y - d[1] * size);
  g.lineTo(x + d[0] * size, y + d[1] * size);
  g.moveTo(x + d[0] * size - d[1] * size * 0.6 - d[0] * size * 0.6, y + d[1] * size + d[0] * size * 0.6 - d[1] * size * 0.6);
  g.lineTo(x + d[0] * size, y + d[1] * size);
  g.lineTo(x + d[0] * size + d[1] * size * 0.6 - d[0] * size * 0.6, y + d[1] * size - d[0] * size * 0.6 - d[1] * size * 0.6);
  g.stroke();
}
