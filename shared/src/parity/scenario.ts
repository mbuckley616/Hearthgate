import type { PlayerCommand, SimState } from '../sim/types';

/**
 * The parity scenarios: scripted parties played through a copy of the combat slice's
 * simulation, hashed tick by tick. tests/parity.ts runs them through the slice's own code (from
 * its repo) and through Hearthgate's copy and requires the same states to the bit;
 * parity.test.ts checks Hearthgate's copy against the hashes recorded from the slice, so CI
 * holds the line without the slice's repo.
 *
 * The scenario takes the simulation as arguments (SimApi) and imports nothing that steps it, so
 * the same script drives either copy. The bots read only the state and a seeded generator.
 */
export interface SimApi {
  arena: unknown;
  buildWorld(level: unknown): unknown;
  createSimState(level: unknown, ids: string[], world: unknown): SimState;
  stepSim(state: SimState, commands: Record<string, PlayerCommand>, dt: number, world: unknown): void;
  addPlayer(state: SimState, world: unknown, id: string, loadout: unknown, remote: boolean): unknown;
  removePlayer(state: SimState, id: string): void;
  skipToWave(state: SimState, world: unknown, n: number): void;
  restartRun(state: SimState, world: unknown): void;
  tickRate: number;
}

export interface Scenario {
  name: string;
  ticks: number;
  /** Players in the party at tick 0 (the slice's createSimState). */
  start: string[];
  /** Changes between ticks, as the host makes them: joins, leaves, debug skips, restarts. */
  at: Record<number, (api: SimApi, s: SimState, world: unknown) => void>;
  seed: number;
}

/** A loadout as the slice's Profile makes one: some levels, talents and gear, so those paths run. */
function loadout(name: string, level: number) {
  const xp = [0, 0, 120, 400, 900, 1600][level] ?? 0;
  return {
    name,
    xp: { sword: xp, bow: Math.floor(xp / 2), staff: xp },
    talents: { sword: { might: 1, q: 1 }, bow: { haste: 1 }, staff: { focus: 1, e: 1 } },
    mods: { damage: { sword: 0.1, bow: 0, staff: 0.05 }, poise: { sword: 0.1, bow: 0, staff: 0 }, maxHp: 20, cooldowns: 0.1, dodgeRecharge: 0.05, perks: ['bleed', 'chainBolt'] },
    maxHp: 120,
  };
}

const join = (id: string, level: number) => (api: SimApi, s: SimState, world: unknown) => {
  api.addPlayer(s, world, id, loadout(id, level), true);
};

export const SCENARIOS: Scenario[] = [
  {
    // Through the gate and into the waves; a fourth player joins mid-fight and another leaves.
    name: 'party run',
    ticks: 9000,
    start: [],
    at: {
      0: (api, s, w) => {
        join('p1', 1)(api, s, w);
        join('p2', 3)(api, s, w);
        join('p3', 5)(api, s, w);
      },
      3600: join('p4', 2),
      6000: (api, s) => api.removePlayer(s, 'p2'),
    },
    seed: 0x5eed1,
  },
  {
    // The Warden from the debug skip, then a restart when the run ends, and the gate again.
    name: 'warden and restart',
    ticks: 9000,
    start: [],
    at: {
      0: (api, s, w) => {
        join('p1', 4)(api, s, w);
        join('p2', 4)(api, s, w);
      },
      120: (api, s, w) => api.skipToWave(s, w, 4),
    },
    seed: 0xbadd1e,
  },
];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string: equal hashes mean equal JSON, and JSON keeps every float exactly. */
export function hashString(text: string, h = 0x811c9dc5): number {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STYLES = ['sword', 'bow', 'staff'] as const;

/** Per player: what they are doing for a few ticks, so swings chain and guards are held. */
interface BotMind {
  until: number;
  strafe: number;
  block: boolean;
  sprint: boolean;
}

/** One tick's command for a bot: walk through the gate, then fight the nearest enemy with everything the hero has. */
function botCommand(s: SimState, id: string, rnd: () => number, mind: BotMind, entryZ: number): PlayerCommand {
  const me = s.players.find((p) => p.id === id)!;
  const cmd: PlayerCommand = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    dodge: false,
    attack: false,
    aimX: 0,
    aimZ: -1,
    swapTo: null,
    ability1: false,
    ability2: false,
    lockTarget: -1,
    jump: false,
    block: false,
    interact: false,
  };
  const downed = s.players.find((p) => p.mode === 'down' && p.id !== id && Math.hypot(p.x - me.x, p.z - me.z) < 6);
  if (s.run.phase === 'won' || s.run.phase === 'lost') return cmd;
  if (s.run.phase === 'ante') {
    // Into the arena (north is -z), spreading a little so nobody walks in a line.
    cmd.moveZ = me.z > entryZ - 4 ? -1 : 0;
    cmd.moveX = Math.sin(s.tick / 40 + id.charCodeAt(1)) * 0.4;
    cmd.sprint = rnd() < 0.5;
    cmd.jump = rnd() < 0.01;
    return cmd;
  }
  if (downed && me.mode !== 'down') {
    const dx = downed.x - me.x;
    const dz = downed.z - me.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > 1.2) {
      cmd.moveX = dx / d;
      cmd.moveZ = dz / d;
    } else cmd.interact = true;
    return cmd;
  }
  let target = null as SimState['enemies'][number] | null;
  let best = Infinity;
  for (const e of s.enemies) {
    if (e.ai === 'dead') continue;
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  if (s.tick >= mind.until) {
    mind.until = s.tick + 20 + Math.floor(rnd() * 70);
    mind.strafe = rnd() < 0.5 ? -1 : 1;
    mind.block = rnd() < 0.15;
    mind.sprint = rnd() < 0.25;
  }
  if (!target) {
    // Between waves: wander toward the middle.
    const d = Math.hypot(me.x, me.z) || 1;
    if (d > 3) {
      cmd.moveX = -me.x / d;
      cmd.moveZ = -me.z / d;
    }
    cmd.aimX = cmd.moveX || 0;
    cmd.aimZ = cmd.moveZ || -1;
    return cmd;
  }
  const dx = target.x - me.x;
  const dz = target.z - me.z;
  const d = Math.hypot(dx, dz) || 1;
  cmd.aimX = dx / d;
  cmd.aimZ = dz / d;
  const reach = me.style === 'sword' ? 2.2 : 9;
  if (d > reach) {
    cmd.moveX = dx / d;
    cmd.moveZ = dz / d;
    cmd.sprint = mind.sprint;
  } else {
    // Circle the target.
    cmd.moveX = (-dz / d) * mind.strafe * 0.7;
    cmd.moveZ = (dx / d) * mind.strafe * 0.7;
    if (d < reach * 0.4 && me.style !== 'sword') {
      cmd.moveX -= (dx / d) * 0.6;
      cmd.moveZ -= (dz / d) * 0.6;
    }
  }
  cmd.block = mind.block;
  cmd.attack = !mind.block && rnd() < 0.3;
  cmd.dodge = rnd() < 0.015;
  cmd.jump = rnd() < 0.006;
  cmd.ability1 = rnd() < 0.008;
  cmd.ability2 = rnd() < 0.008;
  if (rnd() < 0.002) cmd.swapTo = STYLES[Math.floor(rnd() * 3)];
  if (rnd() < 0.5) cmd.lockTarget = target.id;
  return cmd;
}

export interface Trace {
  name: string;
  /** Hash of the whole state after every 60th tick, and after the last. */
  checkpoints: number[];
  /** Hash over every tick's state, folded. */
  all: number;
  /** Where the run got to, as a sanity line in the report. */
  summary: string;
}

/**
 * Play a scenario through one copy of the sim. `onTick` sees each tick's whole state as JSON, so
 * the cross-repo runner can stop at the first tick two copies disagree on.
 */
export function playScenario(api: SimApi, sc: Scenario, onTick?: (tick: number, json: string) => boolean | void): Trace {
  const world = api.buildWorld(api.arena);
  const level = api.arena as { arenaEntryZ: number };
  const s = api.createSimState(api.arena, sc.start, world);
  const rnd = mulberry32(sc.seed);
  const minds = new Map<string, BotMind>();
  const dt = 1 / api.tickRate;
  const checkpoints: number[] = [];
  let all = 0x811c9dc5;
  let phases = '';
  for (let t = 0; t < sc.ticks; t++) {
    sc.at[t]?.(api, s, world);
    // The slice's host restarted on a press of F once the run was over; the bots do it two seconds after.
    if ((s.run.phase === 'won' || s.run.phase === 'lost') && s.run.timer > 2) api.restartRun(s, world);
    const commands: Record<string, PlayerCommand> = {};
    for (const p of s.players) {
      let mind = minds.get(p.id);
      if (!mind) minds.set(p.id, (mind = { until: 0, strafe: 1, block: false, sprint: false }));
      commands[p.id] = botCommand(s, p.id, rnd, mind, level.arenaEntryZ);
    }
    api.stepSim(s, commands, dt, world);
    const json = JSON.stringify(s);
    all = hashString(json, all);
    if (t % 60 === 59 || t === sc.ticks - 1) checkpoints.push(hashString(json));
    if (!phases.endsWith(s.run.phase)) phases += (phases ? '>' : '') + s.run.phase;
    if (onTick?.(t, json) === false) break;
  }
  const alive = s.enemies.filter((e) => e.ai !== 'dead').length;
  return { name: sc.name, checkpoints, all, summary: `${phases}; wave ${s.run.wave}; ${s.players.length} players; ${alive} enemies up; ${s.nextId} ids` };
}
