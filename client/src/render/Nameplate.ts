import * as THREE from 'three';
import { levelFor } from '@hearthgate/shared/sim/gear';
import type { PlayerState } from '@hearthgate/shared/sim/types';

const W = 256;
const H = 64;

/** Name and health above another player's hero; turns red with a revive bar when they're down. */
export class Nameplate {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private drawn = '';

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, depthTest: false, transparent: true }));
    this.sprite.scale.set(1.6, 0.4, 1);
    this.sprite.renderOrder = 10;
  }

  update(p: PlayerState, reviveMs: number): void {
    const down = p.mode === 'down';
    const hp = Math.round((Math.max(0, p.hp) / p.maxHp) * 50);
    const revive = Math.round(((p.reviveProgress * 1000) / reviveMs) * 50);
    // A henchman's level rides on its name (P12; Michael, 29 Oct: "listed next to their names").
    const name = p.henchman ? `${p.name} · Lv ${levelFor(p.xp[p.style])}` : p.name || 'Player';
    const key = `${name}|${hp}|${down}|${revive}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.font = '600 26px system-ui, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(0,0,0,0.75)';
    c.fillStyle = down ? '#ff8a7a' : '#f4e6cf';
    const label = down ? `${name} (down)` : name;
    c.strokeText(label, W / 2, 28);
    c.fillText(label, W / 2, 28);
    // Health bar, or the revive bar while down.
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(48, 40, W - 96, 12);
    c.fillStyle = down ? '#ffd27a' : '#c8473c';
    c.fillRect(50, 42, ((W - 100) * (down ? revive : hp)) / 50, 8);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}
