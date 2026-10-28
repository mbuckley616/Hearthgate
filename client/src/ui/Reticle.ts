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
 */
export class Reticle {
  private readonly el = document.createElement('div');
  private readonly point = new THREE.Vector3();
  private x = -1;
  private y = -1;
  private shownClass = '';

  constructor() {
    this.el.className = 'hud-reticle';
    this.el.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
    document.body.appendChild(this.el);
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
      this.x = -1;
      return;
    }
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
    const cls = `hud-reticle ${hero.style}${on ? ' on' : ''}`;
    if (cls !== this.shownClass) {
      this.shownClass = cls;
      this.el.className = cls;
    }
  }
}
