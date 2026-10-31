import { groundHeight, type LevelDef, type World } from '../level/arena';
import { stepPendingHits, stepRevives } from './coop';
import { stepDrops } from './drops';
import { stepEnemies } from './enemies';
import { floorWorldNow, initialFloorRun } from './floorRun';
import { unstickHenchmen } from './henchman';
import { createPlayer, stepDoors, stepPlayer } from './player';
import { stepLava } from './lava';
import { stepProjectiles } from './projectiles';
import { initialRun, stepRun } from './run';
import { idleCommand, type PlayerCommand, type SimState } from './types';

export function createSimState(level: LevelDef, playerIds: string[], world: World): SimState {
  const yaw = (level.spawn.yawDeg * Math.PI) / 180;
  const players = playerIds.map((id, i) => createPlayer(id, level.spawn.x + i * 1.5, level.spawn.z, yaw));
  for (const p of players) p.y = groundHeight(world, p.x, p.z);
  const state: SimState = {
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
  if (level.dungeon) {
    // A generated floor (T4): its own run, and its own rolls, so two floors' fights differ too.
    state.floor = initialFloorRun();
    if (level.dungeon.def.spec.modifier) state.floor.modifier = level.dungeon.def.spec.modifier;
    state.rng = (level.dungeon.def.spec.seed ^ 0x2f6e2b1) >>> 0;
  }
  return state;
}

/** The world as it blocks this tick: the arena's gate while it is down, or a floor's fight room shut. */
export function worldNow(world: World, state: SimState): World {
  if (world.level.dungeon) return floorWorldNow(world, state);
  // The antechamber gate only blocks while it's down.
  return state.run.gateClosed ? world : { ...world, colliders: world.collidersOpen };
}

/** Advance the simulation by one fixed step. Commands are keyed by player id. */
export function stepSim(state: SimState, commands: Record<string, PlayerCommand>, dt: number, world: World): void {
  state.events = [];
  const w = worldNow(world, state);
  for (const p of state.players) {
    stepPlayer(p, commands[p.id] ?? idleCommand(), dt, w, state);
  }
  stepDoors(state, w, commands);
  stepLava(state, world, dt);
  unstickHenchmen(state, commands);
  stepRevives(state, commands, dt);
  stepPendingHits(state);
  stepEnemies(state, dt, w);
  stepProjectiles(state, dt, w.colliders, world.level.dungeon?.props);
  stepRun(state, dt, w);
  stepDrops(state, dt);
  state.tick++;
  state.time += dt;
}
