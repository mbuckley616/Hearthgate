import * as THREE from 'three';
import { enemyStats, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { pickSoftTarget, targetingRange } from '@hearthgate/shared/sim/abilities';
import { idleCommand, type PlayerState, type SimState } from '@hearthgate/shared/sim/types';
import type { FreeAim } from '../game/aim';

/** Shot heights over the hero's feet, as projectiles.ts launches them; a swing lands about chest high. */
const AIM_HEIGHT: Record<Style, number> = { sword: 1.1, bow: 1.45, staff: 1.5 };
/**
 * With nothing to aim at, how far ahead the mark sits (m). Far enough that it clears the hero's
 * head from the camera behind; a sword's reach is shorter, but the mark says which way, not how far.
 */
const AHEAD_M: Record<Style, number> = { sword: 10, bow: 14, staff: 14 };

/**
 * The aim mark (D11, Michael 28 Oct): where the next swing or shot goes. Today's aim is the sim's
 * soft target (abilities.ts), so the mark sits on the enemy a press would pick, tinted, or ahead
 * along the camera's heading when none would be. Its shape follows the weapon in hand: a dot for
 * melee, a crosshair for the bow and crossbow, a ring for the staff and wand. With free aim (D12) it
 * is pinned to the screen's centre, where the shots go, and reddens when an enemy is under it.
 *
 * Melee's dot stays at the centre too (Michael, 29 Oct: following the soft target or a point ahead,
 * it slid onto the nearest wall and danced with the camera). It reddens while a swing would find
 * someone, and a small mark over that enemy says who.
 */
export class Reticle {
  private readonly el = document.createElement('div');
  /** Over the enemy a melee swing would pick, while the dot holds the centre. */
  private readonly mark = document.createElement('div');
  private readonly point = new THREE.Vector3();
  private x = -1;
  private y = -1;
  private markX = -1;
  private markY = -1;
  private shownClass = '';

  constructor() {
    this.el.className = 'hud-reticle';
    this.el.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
    this.mark.className = 'hud-target-mark';
    document.body.append(this.el, this.mark);
  }

  /**
   * Per frame, after the camera has moved. `world` is the snapshot being drawn, `hero` the local
   * hero's state with `heroPos` where it is drawn, `aim` the camera's flat forward.
   */
  update(
    camera: THREE.Camera,
    world: SimState,
    hero: PlayerState | null,
    heroPos: THREE.Vector3,
    aim: { x: number; z: number },
    lockId: number,
    show: boolean,
    dt: number,
    free: FreeAim | null = null,
  ): void {
    if (!show || !hero || hero.mode === 'down') {
      this.el.style.display = 'none';
      this.hideMark();
      this.x = -1;
      return;
    }
    if (!free && hero.style === 'sword') {
      this.melee(camera, world, hero, aim, lockId, dt);
      return;
    }
    this.hideMark();
    let px = window.innerWidth / 2;
    let py = window.innerHeight / 2;
    let on = !!free?.onEnemy;
    if (!free) {
      const range = targetingRange(hero);
      const target = pickSoftTarget(world, hero, { ...idleCommand(), aimX: aim.x, aimZ: aim.z, lockTarget: lockId }, range);
      on = !!target;
      if (target) this.point.set(target.x, target.y + enemyStats(target.kind).height * 0.6, target.z);
      else {
        const ahead = AHEAD_M[hero.style];
        this.point.set(heroPos.x + aim.x * ahead, heroPos.y + AIM_HEIGHT[hero.style], heroPos.z + aim.z * ahead);
      }
      this.point.project(camera);
      if (this.point.z > 1) {
        this.el.style.display = 'none';
        return;
      }
      px = ((this.point.x + 1) / 2) * window.innerWidth;
      py = ((1 - this.point.y) / 2) * window.innerHeight;
    }
    // A quick glide from one target to the next, so the eye can follow the jump.
    const k = this.x < 0 ? 1 : 1 - Math.exp(-tuning.lockOn.reticleRate * dt);
    this.x += (px - this.x) * k;
    this.y += (py - this.y) * k;
    this.el.style.display = 'block';
    this.el.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px)`;
    this.setClass(`hud-reticle ${hero.style}${on ? ' on' : ''}`);
  }

  private melee(camera: THREE.Camera, world: SimState, hero: PlayerState, aim: { x: number; z: number }, lockId: number, dt: number): void {
    const target = pickSoftTarget(world, hero, { ...idleCommand(), aimX: aim.x, aimZ: aim.z, lockTarget: lockId }, targetingRange(hero));
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.el.style.display = 'block';
    this.el.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px)`;
    this.setClass(`hud-reticle sword${target ? ' on' : ''}`);
    // A locked enemy has the lock's own marker; the mark is for the one a press would pick unlocked.
    if (!target || target.id === lockId) return this.hideMark();
    this.point.set(target.x, target.y + enemyStats(target.kind).height + 0.35, target.z).project(camera);
    if (this.point.z > 1) return this.hideMark();
    const px = ((this.point.x + 1) / 2) * window.innerWidth;
    const py = ((1 - this.point.y) / 2) * window.innerHeight;
    const k = this.markX < 0 ? 1 : 1 - Math.exp(-tuning.lockOn.reticleRate * dt);
    this.markX += (px - this.markX) * k;
    this.markY += (py - this.markY) * k;
    this.mark.style.display = 'block';
    this.mark.style.transform = `translate(${this.markX.toFixed(1)}px, ${this.markY.toFixed(1)}px)`;
  }

  private hideMark(): void {
    this.mark.style.display = 'none';
    this.markX = -1;
  }

  private setClass(cls: string): void {
    if (cls === this.shownClass) return;
    this.shownClass = cls;
    this.el.className = cls;
  }
}
