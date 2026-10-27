import type { World } from '../level/arena';
import type { PortalDef } from '../level/village';
import type { SimState } from '../sim/types';

/**
 * Portals between the village and a dungeon room (T3). The village's ring stands before the
 * Portal Shrine; in the arena a ring opens in the antechamber once the run is won or lost and
 * takes the party home (Michael, 27 Oct: a portal in the arena, not the end screen's F). Either
 * way every standing player must be inside it, together, for PORTAL_HOLD_S. The server decides
 * this; browsers only draw the ring and how full it is.
 */
export const PORTAL_HOLD_S = 2;

/** The ring that opens in the arena's antechamber when a run is over. */
export const ARENA_EXIT_PORTAL: PortalDef = { x: 0, z: 19.4, radius: 2.2 };

/** The portal open in this world now, or null. */
export function portalFor(world: World, state: SimState): PortalDef | null {
  if (world.level.village) return world.level.village.portal;
  return state.run.phase === 'won' || state.run.phase === 'lost' ? ARENA_EXIT_PORTAL : null;
}

/** Every player still standing is inside the ring (and there is at least one). */
export function partyOnPortal(state: SimState, portal: PortalDef): boolean {
  const standing = state.players.filter((p) => p.mode !== 'down');
  return standing.length > 0 && standing.every((p) => Math.hypot(p.x - portal.x, p.z - portal.z) <= portal.radius);
}

/** What a snapshot says about the open portal, for the ring and its fill. */
export interface PortalState {
  x: number;
  z: number;
  radius: number;
  /** Seconds the party has held it so far, out of PORTAL_HOLD_S. */
  held: number;
  /** Where it leads. */
  to: 'village' | 'arena';
}
