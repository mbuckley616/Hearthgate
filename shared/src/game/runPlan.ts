import { tuning } from '../config/tuning';
import { floorSeed, MAX_PIECES, MIN_PIECES, type FloorSpec } from '../level/generate';
import { levelFor } from '../sim/gear';
import type { PlayerState } from '../sim/types';

/**
 * A dungeon run (T4, decisions.md 27 Oct): 3 to 5 floors, each 10 to 50 pieces, growing with the
 * dungeon's tier, the floor and the party's level. The server plans it when the village's ring is
 * taken and carries the plan from floor to floor; each floor's spec comes from it.
 */
export interface RunPlan {
  /** The run's seed; each floor's seed comes from it (floorSeed). */
  seed: number;
  tier: number;
  floors: number;
  /** The party's level: each hero's best style, averaged. */
  level: number;
  /** A fixed size for every floor (10 to 50), or 0 to grow with the run (debug and the gate's floors). */
  pieces: number;
}

/** The party's level for sizing floors: each hero's best style level, averaged over the party. */
export function partyLevel(players: readonly PlayerState[]): number {
  if (players.length === 0) return 1;
  const best = players.map((p) => Math.max(levelFor(p.xp.sword), levelFor(p.xp.bow), levelFor(p.xp.staff)));
  return best.reduce((a, b) => a + b, 0) / best.length;
}

/** A run for this party. `seed` is the server's own pick unless tuning pins one (dungeon.seed). */
export function planRun(players: readonly PlayerState[], seed: number): RunPlan {
  const d = tuning.dungeon;
  const tier = Math.max(1, Math.min(3, Math.round(d.tier)));
  return {
    seed: d.seed > 0 ? Math.round(d.seed) : seed >>> 0,
    tier,
    floors: Math.max(3, Math.min(5, 2 + tier)),
    level: partyLevel(players),
    pieces: d.pieces > 0 ? clampPieces(d.pieces) : 0,
  };
}

/** Floor `floor` (1-based) of a run. */
export function floorSpecFor(plan: RunPlan, floor: number): FloorSpec {
  const d = tuning.dungeon;
  const grown = d.basePieces + (floor - 1) * d.piecesPerFloor + (plan.tier - 1) * d.piecesPerTier + Math.max(0, plan.level - 1) * d.piecesPerLevel;
  return { seed: floorSeed(plan.seed, floor), pieces: plan.pieces > 0 ? plan.pieces : clampPieces(grown), floor, floors: plan.floors };
}

function clampPieces(n: number): number {
  return Math.max(MIN_PIECES, Math.min(MAX_PIECES, Math.round(n)));
}

/** A plan from a room's create options (the server's own, or a dev URL's), each number checked. */
export function readRunPlan(options: Record<string, unknown>): RunPlan {
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback;
  const tier = num(options.tier, 1, 3, Math.round(tuning.dungeon.tier));
  return {
    seed: num(options.seed, 0, 0xffffffff, 1),
    tier,
    floors: num(options.floors, 3, 5, 2 + tier),
    level: typeof options.level === 'number' && Number.isFinite(options.level) ? Math.max(1, Math.min(50, options.level)) : 1,
    pieces: options.pieces === undefined || options.pieces === 0 ? 0 : num(options.pieces, MIN_PIECES, MAX_PIECES, 0),
  };
}
