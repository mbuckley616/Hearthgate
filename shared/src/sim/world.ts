import { groundHeight, type LevelDef, type World } from '../level/arena';
import { stepPendingHits, stepRevives } from './coop';
import { stepDrops } from './drops';
import { stepEnemies } from './enemies';
import { createPlayer, stepPlayer } from './player';
import { stepProjectiles } from './projectiles';
import { initialRun, stepRun } from './run';
import { idleCommand, type PlayerCommand, type SimState } from './types';

export function createSimState(level: LevelDef, playerIds: string[], world: World): SimState {
  const yaw = (level.spawn.yawDeg * Math.PI) / 180;
  const players = playerIds.map((id, i) => createPlayer(id, level.spawn.x + i * 1.5, level.spawn.z, yaw));
  for (const p of players) p.y = groundHeight(world, p.x, p.z);
  return {
    tick: 0,
    time: 0,
    players,
    enemies: [],
    projectiles: [],
    drops: [],
    pendingHits: [],
    events: [],
    nextId: 1,
    rng: 0x2f6e2b1,
    run: initialRun(),
  };
}

/** Advance the simulation by one fixed step. Commands are keyed by player id. */
export function stepSim(state: SimState, commands: Record<string, PlayerCommand>, dt: number, world: World): void {
  state.events = [];
  // The antechamber gate only blocks while it's down.
  const w: World = state.run.gateClosed ? world : { ...world, colliders: world.collidersOpen };
  for (const p of state.players) {
    stepPlayer(p, commands[p.id] ?? idleCommand(), dt, w, state);
  }
  stepRevives(state, commands, dt);
  stepPendingHits(state);
  stepEnemies(state, dt, w);
  stepProjectiles(state, dt, w.colliders);
  stepRun(state, dt, w);
  stepDrops(state, dt);
  state.tick++;
  state.time += dt;
}
