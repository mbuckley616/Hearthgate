import { tuning } from '../config/tuning';
import type { World } from '../level/arena';
import { SPIKE_SIZE, spikeAt, spikeClock, type SpikeTile } from '../level/traps';
import { clearsLow, damageEnemy, heroInvulnerable, isTargetable, knockDown } from './combat';
import type { SimState } from './types';

/** Seconds into a tile's cycle at which it strikes: the warning, then the lag grace (a hit's fairness rule). */
export function spikeStrikeAt(): number {
  return tuning.traps.spikeWarnS + tuning.coop.lagGraceMs / 1000;
}

/** Whether a tile struck between `time - dt` and `time`. */
export function spikeStruck(tile: SpikeTile, time: number, dt: number): boolean {
  const cycle = tuning.traps.spikeCycleS;
  const at = spikeStrikeAt();
  const prev = spikeClock(tile, time - dt, cycle);
  const now = spikeClock(tile, time, cycle);
  return prev <= now ? prev < at && now >= at : prev < at || now >= at;
}

/**
 * Spikes (G5): each tile strikes once a cycle, and everyone on their feet on it is hurt: a hero a
 * share of their health (a hero in the air clears it, with the jump's "Cleared"), an enemy a fixed
 * amount, so a pack lured across takes it too. From below, so no shield or guard stops it. In stepSim
 * and never in prediction, as lava is; henchmen are spared, since their brains do not see traps yet.
 */
export function stepTraps(state: SimState, world: World, dt: number): void {
  const spikes = world.level.dungeon?.spikes;
  if (!spikes?.length || !tuning.traps.enabled) return;
  const t = tuning.traps;
  // state.time is advanced at the end of the step, so this step runs from time to time + dt.
  const struck = spikes.filter((tile) => spikeStruck(tile, state.time + dt, dt));
  if (!struck.length) return;
  for (const p of state.players) {
    if (p.henchman || p.mode === 'down' || p.hp <= 0) continue;
    const tile = struck.find((tl) => Math.abs(p.x - tl.x) <= SPIKE_SIZE / 2 && Math.abs(p.z - tl.z) <= SPIKE_SIZE / 2 && p.y - tl.y > -0.3 && p.y - tl.y < 1.5);
    if (!tile) continue;
    // The jump's rule for a low attack (M1): high enough in the air, the spikes miss.
    if (clearsLow(p, tile.y)) {
      state.events.push({ kind: 'cleared', playerId: p.id, x: p.x, y: p.y, z: p.z, ground: tile.y });
      continue;
    }
    if (heroInvulnerable(p)) continue;
    const damage = p.maxHp * t.spikeHeroFrac;
    p.hp = Math.max(0, p.hp - damage);
    state.events.push({ kind: 'heroHurt', playerId: p.id, damage, x: p.x, z: p.z, heavy: true });
    if (p.hp <= 0) knockDown(state, p);
  }
  for (const e of state.enemies) {
    if (!isTargetable(e) || !spikeAt(struck, e.x, e.y, e.z)) continue;
    damageEnemy(state, e, { attackerId: '', damage: t.spikeEnemyDamage, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 0, x: e.x, y: e.y + 0.3, z: e.z, dot: true });
  }
}
