import { tuning } from '../config/tuning';
import { groundHeight, type World } from '../level/arena';
import { nextRandom } from './combat';
import { collectAllDrops, spawnDrop } from './drops';
import { createEnemy } from './enemies';
import { createPlayer } from './player';
import type { RunState, SimState } from './types';

/** Wave titles, shown as banners. Composition comes from tuning.run. */
export const WAVE_TITLES = ['The guard', 'Archers on the ledge', 'The brute', 'The Warden'];
export const FINAL_WAVE = WAVE_TITLES.length;

export function initialRun(): RunState {
  return {
    phase: 'ante',
    wave: 0,
    timer: 0,
    elapsed: 0,
    gateClosed: false,
    gateWait: -1,
    bossId: -1,
    waveSize: 0,
    reinforced: false,
    dropX: 0,
    dropZ: 0,
    bossDown: false,
  };
}

const active = (r: RunState) => r.phase === 'intro' || r.phase === 'wave' || r.phase === 'rest';

/**
 * The run: wait in the antechamber; stepping into the arena closes the gate
 * and starts wave 1. Clearing a wave gives a short breather, the fourth wave
 * is the Warden, and a full wipe ends the run (brief: "A full wipe restarts the room").
 */
export function stepRun(state: SimState, dt: number, world: World): void {
  const r = state.run;
  r.timer += dt;
  if (active(r)) r.elapsed += dt;

  switch (r.phase) {
    case 'ante': {
      // The run starts when the whole party is through the gate, or when the wait runs out.
      const standing = state.players.filter((p) => p.mode !== 'down');
      const inside = standing.filter((p) => p.z < world.level.arenaEntryZ);
      if (!tuning.debug.enemiesEnabled || inside.length === 0) {
        r.gateWait = -1;
        break;
      }
      r.gateWait = r.gateWait < 0 ? 0 : r.gateWait + dt;
      if (inside.length < standing.length && r.gateWait * 1000 < tuning.run.gateWaitMs) break;
      bringStragglersIn(state, world);
      r.phase = 'intro';
      r.timer = 0;
      r.gateWait = -1;
      r.gateClosed = true;
      state.events.push({ kind: 'runStart' });
      break;
    }
    case 'intro':
      if (r.timer >= tuning.run.introMs / 1000) startWave(state, world, 1);
      break;
    case 'wave': {
      // Reinforcements arrive once the first group is mostly down.
      const alive = state.enemies.filter((e) => e.ai !== 'dead').length;
      if (!r.reinforced && r.wave < FINAL_WAVE && alive <= Math.floor(r.waveSize * tuning.run.reinforceAt)) {
        r.reinforced = true;
        if (spawnGroupFor(state, world, r.wave, 'Reinforce') > 0) state.events.push({ kind: 'reinforcements', wave: r.wave });
        break;
      }
      if (alive === 0) {
        state.events.push({ kind: 'waveCleared', wave: r.wave });
        // A breather: heroes still standing get some health back.
        for (const p of state.players) if (p.mode !== 'down') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * tuning.run.healOnWaveClear);
        // Three drops per run: waves 2 and 3, and a guaranteed rare from the Warden (brief).
        if (r.wave >= 2) spawnDrop(state, world, r.dropX, r.dropZ, r.wave >= FINAL_WAVE);
        if (r.wave >= FINAL_WAVE) {
          r.phase = 'won';
          r.timer = 0;
          r.gateClosed = false;
          collectAllDrops(state);
          state.events.push({ kind: 'runWon', time: r.elapsed });
        } else {
          r.phase = 'rest';
          r.timer = 0;
        }
      }
      break;
    }
    case 'rest':
      if (r.timer >= tuning.run.restMs / 1000) startWave(state, world, r.wave + 1);
      break;
  }

  if (active(r) && state.players.every((p) => p.mode === 'down')) {
    r.phase = 'lost';
    r.timer = 0;
    collectAllDrops(state);
    state.events.push({ kind: 'runLost', wave: r.wave });
  }
}

/** Anyone still in the antechamber when the gate closes is brought just inside it. */
function bringStragglersIn(state: SimState, world: World): void {
  const level = world.level;
  const outside = state.players.filter((p) => p.z >= level.arenaEntryZ);
  outside.forEach((p, i) => {
    const span = level.doorway.maxX - level.doorway.minX - 1;
    p.x = level.doorway.minX + 0.5 + (outside.length > 1 ? (i / (outside.length - 1)) * span : span / 2);
    p.z = level.arenaEntryZ - 1.5;
    p.y = groundHeight(world, p.x, p.z);
    p.vx = 0;
    p.vz = 0;
  });
}

/** Spawn wave n (1-based). Each extra player adds one grunt (brief). */
export function startWave(state: SimState, world: World, n: number): void {
  const r = state.run;
  r.phase = 'wave';
  r.wave = n;
  r.timer = 0;
  r.reinforced = false;
  if (n >= FINAL_WAVE) {
    const boss = createEnemy(state, world, 'warden', 0, -7.5, 0);
    r.bossId = boss.id;
    r.waveSize = 1;
  } else {
    r.waveSize = spawnGroupFor(state, world, n, '');
  }
  state.events.push({ kind: 'waveStart', wave: n, title: WAVE_TITLES[n - 1] ?? `Wave ${n}`, boss: n >= FINAL_WAVE });
}

/**
 * Spawn wave n's group ('' = the opening group, 'Reinforce' = the second one)
 * on the side of the arena away from the heroes. Returns how many spawned.
 */
function spawnGroupFor(state: SimState, world: World, n: number, part: '' | 'Reinforce'): number {
  const t = tuning.run as unknown as Record<string, number>;
  const level = world.level;
  const extra = Math.max(0, state.players.length - 1);
  const avgX = state.players.reduce((s, p) => s + p.x, 0) / state.players.length;
  const avgZ = state.players.reduce((s, p) => s + p.z, 0) / state.players.length;
  const points = [...level.spawnPoints].sort((a, b) => Math.hypot(b.x - avgX, b.z - avgZ) - Math.hypot(a.x - avgX, a.z - avgZ));
  const face = (x: number, z: number) => Math.atan2(-x, -z);
  const grunts = Math.round(t[`wave${n}${part}Grunts`] ?? 0) + extra;
  const archers = Math.round(t[`wave${n}${part}Archers`] ?? 0);
  const brutes = Math.round(t[`wave${n}${part}Brutes`] ?? 0);
  for (let i = 0; i < grunts; i++) {
    const pt = points[i % Math.min(3, points.length)];
    const a = nextRandom(state) * Math.PI * 2;
    const x = pt.x + Math.cos(a) * 1.2;
    const z = pt.z + Math.sin(a) * 1.2;
    createEnemy(state, world, 'grunt', x, z, face(x, z));
  }
  // Archers take free spots on the ledge.
  const taken = state.enemies.filter((e) => e.kind === 'archer' && e.ai !== 'dead');
  const free = level.archerSpots.filter((s) => !taken.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < 1.5));
  free.slice(0, archers).forEach((s) => createEnemy(state, world, 'archer', s.x, s.z, 0));
  for (let i = 0; i < brutes; i++) {
    const pt = points[i % points.length];
    createEnemy(state, world, 'brute', pt.x, pt.z, face(pt.x, pt.z));
  }
  return grunts + Math.min(archers, free.length) + brutes;
}

/** Back to the antechamber with fresh heroes and an empty arena. */
export function restartRun(state: SimState, world: World): void {
  const level = world.level;
  const yaw = (level.spawn.yawDeg * Math.PI) / 180;
  state.players = state.players.map((p, i) => {
    const fresh = createPlayer(p.id, level.spawn.x + i * 1.5, level.spawn.z, yaw);
    // Heroes keep who they are (levels, talents, gear); everything else resets.
    fresh.style = p.style;
    fresh.name = p.name;
    fresh.xp = p.xp;
    fresh.talents = p.talents;
    fresh.mods = p.mods;
    fresh.maxHp = p.maxHp;
    fresh.hp = p.maxHp;
    fresh.lagGrace = p.lagGrace;
    fresh.y = groundHeight(world, fresh.x, fresh.z);
    return fresh;
  });
  state.enemies = [];
  state.projectiles = [];
  state.drops = [];
  state.pendingHits = [];
  state.run = initialRun();
}

/** Jump straight to a wave (debug). */
export function skipToWave(state: SimState, world: World, n: number): void {
  state.enemies = [];
  state.projectiles = [];
  state.run.gateClosed = true;
  startWave(state, world, n);
}
