import type { Loadout } from '../sim/coop';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '../sim/types';

/** Two states and how far between them to draw. */
export interface Blend<T> {
  prev: T;
  curr: T;
  alpha: number;
}

/**
 * Where the fight runs. The host (and solo, a party of one) runs the real
 * sim; a joiner predicts its own hero and draws the host's snapshots. The
 * game loop, views and UI only ever talk to this.
 */
export interface Session {
  readonly role: 'host' | 'client';
  /** The local player's id ('' until a joiner is welcomed). */
  readonly localId: string;
  /** Run fixed ticks for dt seconds. cmd carries this frame's presses; they're used on the first tick only. */
  advance(cmd: PlayerCommand, dt: number): { ticks: number; events: SimEvent[] };
  /** The world to draw (a joiner's is a little in the past). */
  view(): Blend<SimState>;
  /** The local hero to draw (a joiner's is predicted, so it's never behind). */
  hero(): Blend<PlayerState> | null;
  /** Bring this player's saved levels, talents and gear into the fight. */
  setLoadout(loadout: Loadout, refill: boolean): void;
  /** Short status for the party panel. */
  status(): string;
}

const PRESSES = { dodge: false, attack: false, jump: false, swapTo: null, ability1: false, ability2: false } as const;

/** The command with its one-shot presses cleared (held buttons stay). */
export function withoutPresses(cmd: PlayerCommand): PlayerCommand {
  const out = { ...cmd, ...PRESSES };
  delete out.ability3;
  return out;
}

/** Fold two ticks' commands into one: the later held state, and any press from either. */
export function mergePresses(a: PlayerCommand, b: PlayerCommand): PlayerCommand {
  return {
    ...b,
    dodge: a.dodge || b.dodge,
    attack: a.attack || b.attack,
    jump: a.jump || b.jump,
    ability1: a.ability1 || b.ability1,
    ability2: a.ability2 || b.ability2,
    ...(a.ability3 || b.ability3 ? { ability3: true } : {}),
    swapTo: b.swapTo ?? a.swapTo,
  };
}

/** Events a joiner shows from its own prediction instead of waiting for the host (brief: "effects also play locally"). */
const PREDICTED_KINDS = new Set<SimEvent['kind']>(['swing', 'fire', 'ability', 'frostRing', 'blink', 'whirlTick', 'land']);

export function isPredictedFor(ev: SimEvent, id: string): boolean {
  if (ev.kind === 'hit') return ev.attackerId === id && ev.local;
  return PREDICTED_KINDS.has(ev.kind) && 'playerId' in ev && ev.playerId === id;
}
