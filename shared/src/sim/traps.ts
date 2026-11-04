import { tuning } from '../config/tuning';
import type { World } from '../level/arena';
import { BLADE_HALF, bladeOffset, CRUMBLE_SIZE, crumbleAt, SPIKE_SIZE, spikeAt, spikeClock, type BladeTrap, type SpikeTile } from '../level/traps';
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
  if (!tuning.traps.enabled) return;
  stepBlades(state, world, dt);
  stepCrumble(state, world, dt);
  const spikes = world.level.dungeon?.spikes;
  if (!spikes?.length) return;
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

/** Where a body stands against a blade: across the hall from its middle, and along it from the blade's line. */
function bladeFrame(b: BladeTrap, x: number, z: number): { across: number; along: number } {
  return b.alongX ? { across: x - b.x, along: z - b.z } : { across: z - b.z, along: x - b.x };
}

/**
 * Swinging blades (G5): a body in the blade's way is hit as the blade passes through it, once a pass,
 * judged from the swing alone (where it was and where it is), so nothing is kept between ticks. A hero
 * takes `traps.bladeHeroFrac` of their health, or clears it in the air (it sweeps low); an enemy takes
 * `traps.bladeEnemyDamage` and is thrown the way it swings.
 */
function stepBlades(state: SimState, world: World, dt: number): void {
  const blades = world.level.dungeon?.blades;
  if (!blades?.length) return;
  const t = tuning.traps;
  for (const b of blades) {
    const was = bladeOffset(b, state.time, t.bladePeriodS);
    const now = bladeOffset(b, state.time + dt, t.bladePeriodS);
    if (was === now) continue;
    const passes = (x: number, y: number, z: number, radius: number) => {
      const f = bladeFrame(b, x, z);
      return Math.abs(f.along) < BLADE_HALF + radius && y - b.y > -0.3 && y - b.y < 1.5 && (was - f.across) * (now - f.across) <= 0;
    };
    const sweep = Math.sign(now - was);
    for (const p of state.players) {
      if (p.henchman || p.mode === 'down' || p.hp <= 0 || !passes(p.x, p.y, p.z, 0.35)) continue;
      if (clearsLow(p, b.y)) {
        state.events.push({ kind: 'cleared', playerId: p.id, x: p.x, y: p.y, z: p.z, ground: b.y });
        continue;
      }
      if (heroInvulnerable(p)) continue;
      const damage = p.maxHp * t.bladeHeroFrac;
      p.hp = Math.max(0, p.hp - damage);
      state.events.push({ kind: 'heroHurt', playerId: p.id, damage, x: p.x, z: p.z, heavy: true });
      if (p.hp <= 0) knockDown(state, p);
    }
    for (const e of state.enemies) {
      if (!isTargetable(e) || !passes(e.x, e.y, e.z, 0.4)) continue;
      damageEnemy(state, e, {
        attackerId: '',
        damage: t.bladeEnemyDamage,
        poise: 0,
        knockback: 0,
        heavy: false,
        dirX: 0,
        dirZ: 0,
        x: e.x,
        y: e.y + 0.4,
        z: e.z,
        dot: true,
      });
      // Thrown the way the blade swings (a dot hit carries no knockback of its own).
      // Damage's own slide: covers bladePush metres.
      const v = sweep * t.bladePush * tuning.combat.knockbackFriction;
      if (b.alongX) e.kbx = v;
      else e.kbz = v;
    }
  }
}

/** When a stepped-on tile falls: its shake, then the lag grace, so a step off that was on time on the player's screen counts. */
export function crumbleFallsAfter(): number {
  return tuning.traps.crumbleShakeS + tuning.coop.lagGraceMs / 1000;
}

/**
 * Collapsing tiles (G5; Michael's B, 4 Nov): a hero (not a henchman) on their feet on a whole tile
 * starts it shaking; `crumbleFallsAfter` later it falls for good. A hero on it then (not high enough
 * in the air, by the jump's rule) loses `traps.crumbleHeroFrac` of their health and is put back on
 * the nearest side of its edge; a henchman is only put back; an enemy on it is gone. From then on its
 * hole is a wall (`floorWorldNow`). In stepSim and never in prediction.
 */
function stepCrumble(state: SimState, world: World, dt: number): void {
  const tiles = world.level.dungeon?.crumble;
  const f = state.floor;
  if (!tiles?.length || !f) return;
  const t = tuning.traps;
  const fallen = (f.fallen ??= []);
  const crumbling = (f.crumbling ??= []);
  for (const p of state.players) {
    if (p.henchman || p.mode === 'down' || p.hp <= 0 || !p.grounded) continue;
    const i = crumbleAt(tiles, p.x, p.y, p.z);
    if (i < 0 || fallen.includes(i) || crumbling.some((c) => c.id === i)) continue;
    crumbling.push({ id: i, at: state.time });
    state.events.push({ kind: 'tileCracked', x: tiles[i].x, z: tiles[i].z });
  }
  const now = state.time + dt;
  for (let c = crumbling.length - 1; c >= 0; c--) {
    if (now - crumbling[c].at < crumbleFallsAfter()) continue;
    const i = crumbling[c].id;
    crumbling.splice(c, 1);
    fallen.push(i);
    const tile = tiles[i];
    const h = CRUMBLE_SIZE / 2;
    const on = (x: number, z: number) => Math.abs(x - tile.x) <= h && Math.abs(z - tile.z) <= h;
    let caught = 0;
    for (const p of state.players) {
      if (p.hp <= 0 || !on(p.x, p.z) || p.y - tile.y > 1.5 || p.y - tile.y < -0.3) continue;
      // Back at the edge it was nearest, a stride off the hole.
      const dx = p.x - tile.x;
      const dz = p.z - tile.z;
      if (Math.abs(dx) >= Math.abs(dz)) p.x = tile.x + Math.sign(dx || 1) * (h + 0.6);
      else p.z = tile.z + Math.sign(dz || 1) * (h + 0.6);
      p.vx = 0;
      p.vz = 0;
      if (p.henchman || p.mode === 'down' || clearsLow(p, tile.y) || heroInvulnerable(p)) continue;
      caught++;
      const damage = p.maxHp * t.crumbleHeroFrac;
      p.hp = Math.max(0, p.hp - damage);
      state.events.push({ kind: 'heroHurt', playerId: p.id, damage, x: p.x, z: p.z, heavy: true });
      if (p.hp <= 0) knockDown(state, p);
    }
    for (const e of state.enemies) {
      if (!isTargetable(e) || !on(e.x, e.z) || Math.abs(e.y - tile.y) > 0.3) continue;
      caught++;
      damageEnemy(state, e, { attackerId: '', damage: e.hp + 1, poise: 0, knockback: 0, heavy: false, dirX: 0, dirZ: 0, x: e.x, y: e.y, z: e.z, dot: true });
    }
    state.events.push({ kind: 'tileFell', x: tile.x, z: tile.z, caught });
  }
}
