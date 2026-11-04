import * as THREE from 'three';
import { tuning } from '@hearthgate/shared/config/tuning';
import { bladeOffset, SPIKE_SIZE, spikeClock, type BladeTrap, type SpikeTile } from '@hearthgate/shared/level/traps';
import { spikeStrikeAt } from '@hearthgate/shared/sim/traps';
import { glowMaterial } from './props';

/** The colour language's heavy (TelegraphView): orange, nothing will stop it. */
const WARN = 0xff8a1a;
const SPIKES_PER_SIDE = 3;
const SPIKE_H = 0.55;
/** A blade's arm, pivot to edge (m). */
const ARM = 3.4;

/**
 * Spike tiles (G5): an iron grate in the floor, a glow in the colour language's orange through the
 * warning, then the spikes up from the strike until `traps.spikeUpS` after. Built once per floor;
 * update() reads only the drawn sim time, the same clock the server strikes by.
 */
export class TrapView {
  readonly group = new THREE.Group();
  private readonly tiles: { tile: SpikeTile; glow: THREE.Mesh; spikes: THREE.Group }[] = [];
  private readonly blades: { blade: BladeTrap; arm: THREE.Group }[] = [];

  constructor(spikes: readonly SpikeTile[], blades: readonly BladeTrap[] = []) {
    const grate = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.55, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.35, metalness: 0.85 });
    const grateGeo = new THREE.PlaneGeometry(SPIKE_SIZE, SPIKE_SIZE).rotateX(-Math.PI / 2);
    const glowGeo = new THREE.PlaneGeometry(SPIKE_SIZE * 0.92, SPIKE_SIZE * 0.92).rotateX(-Math.PI / 2);
    const spikeGeo = new THREE.ConeGeometry(0.11, SPIKE_H, 6).translate(0, SPIKE_H / 2, 0);
    for (const tile of spikes) {
      const base = new THREE.Mesh(grateGeo, grate);
      base.position.set(tile.x, tile.y + 0.02, tile.z);
      base.receiveShadow = true;
      const glow = new THREE.Mesh(glowGeo, glowMaterial(WARN, 0));
      glow.position.set(tile.x, tile.y + 0.04, tile.z);
      const set = new THREE.Group();
      const step = SPIKE_SIZE / SPIKES_PER_SIDE;
      for (let i = 0; i < SPIKES_PER_SIDE; i++) {
        for (let j = 0; j < SPIKES_PER_SIDE; j++) {
          const s = new THREE.Mesh(spikeGeo, iron);
          s.position.set(-SPIKE_SIZE / 2 + step * (i + 0.5), 0, -SPIKE_SIZE / 2 + step * (j + 0.5));
          s.castShadow = true;
          set.add(s);
        }
      }
      set.position.set(tile.x, tile.y - SPIKE_H, tile.z);
      set.visible = false;
      this.group.add(base, glow, set);
      this.tiles.push({ tile, glow, spikes: set });
    }

    // Blades: an iron arm from a pivot under the ceiling, a broad crescent at its foot that sweeps low.
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, ARM, 6).translate(0, -ARM / 2, 0);
    const bladeGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.05, 20, 1, false, -0.9, 1.8).rotateX(Math.PI / 2).translate(0, -ARM + 0.55, 0);
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.95 });
    for (const blade of blades) {
      const pivot = new THREE.Group();
      pivot.position.set(blade.x, blade.y + ARM + 0.25, blade.z);
      // The swing's plane is across the hall: turn the arm's frame to it.
      if (!blade.alongX) pivot.rotation.y = -Math.PI / 2;
      const arm = new THREE.Group();
      const rod = new THREE.Mesh(armGeo, iron);
      const edge = new THREE.Mesh(bladeGeo, steel);
      rod.castShadow = edge.castShadow = true;
      arm.add(rod, edge);
      pivot.add(arm);
      this.group.add(pivot);
      this.blades.push({ blade, arm });
    }
  }

  update(simTime: number): void {
    const t = tuning.traps;
    for (const v of this.blades) {
      // The arm's angle that puts its foot at the sim's offset across the hall.
      const off = t.enabled ? bladeOffset(v.blade, simTime, t.bladePeriodS) : 0;
      v.arm.rotation.z = Math.asin(Math.max(-1, Math.min(1, off / ARM)));
    }
    const on = t.enabled;
    const warn = t.spikeWarnS;
    // Up from the moment the warning ends, through the lag grace the server waits, for spikeUpS.
    const down = spikeStrikeAt() + t.spikeUpS;
    for (const v of this.tiles) {
      const c = on ? spikeClock(v.tile, simTime, t.spikeCycleS) : -1;
      const warning = c >= 0 && c < warn;
      const mat = v.glow.material as THREE.MeshBasicMaterial;
      // Brighter and quicker as the strike nears.
      mat.opacity = warning ? (0.25 + 0.55 * (c / warn)) * (0.75 + 0.25 * Math.sin(c * (8 + 16 * (c / warn)))) : 0;
      v.glow.visible = warning;
      const up = c >= warn && c < down;
      v.spikes.visible = up;
      if (up) {
        // A snap up in the first tenth of a second, a slow sink at the end.
        const rise = Math.min(1, (c - warn) / 0.08);
        const sink = Math.min(1, (down - c) / 0.2);
        v.spikes.position.y = v.tile.y - SPIKE_H * (1 - Math.min(rise, sink));
      }
    }
  }
}
