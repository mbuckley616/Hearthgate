import type { World } from '../level/arena';
import { openMiddle } from '../level/floor';
import type { PortalDef } from '../level/village';
import type { SimState } from '../sim/types';

/**
 * Portals between rooms on the server (T3, T4). The village's ring stands before the Portal Shrine
 * and leads into a dungeon; in the arena a ring opens in the antechamber once the run is won or
 * lost and takes the party home (Michael, 27 Oct: a portal in the arena, not the end screen's F).
 * On a generated floor the rest room holds two, one deeper and one home, and a ring home opens
 * where the Warden fell. A wipe opens none (D10): the party lies where it fell and each player goes
 * home from the end card's button (the 'home' message). Either way every standing
 * player must be inside one ring, together, for PORTAL_HOLD_S. The server decides this; browsers
 * only draw the rings and how full they are.
 */
export const PORTAL_HOLD_S = 2;

/** The ring that opens in the arena's antechamber when a run is over. */
export const ARENA_EXIT_PORTAL: PortalDef = { x: 0, z: 19.4, radius: 2.2 };
/** A generated floor's rings. */
const FLOOR_RING_RADIUS = 2.2;

/** Where a ring leads: into a dungeon (the village's), the next floor of the run, or home. */
export type PortalTo = 'dungeon' | 'deeper' | 'village';

/** A ring that is open, at its floor's height. */
export interface Ring extends PortalDef {
  y: number;
  to: PortalTo;
}

/** The rings open in this world now (none, one, or the rest room's two). */
export function portalsFor(world: World, state: SimState): Ring[] {
  const level = world.level;
  if (level.village) return [{ ...level.village.portal, y: 0, to: 'dungeon' }];
  const over = state.run.phase === 'won' || state.run.phase === 'lost';
  const layout = level.dungeon;
  if (!layout) return over ? [{ ...ARENA_EXIT_PORTAL, y: 0, to: 'village' }] : [];
  if (state.run.phase === 'lost') return [];
  if (over) {
    // Home from the Warden's hall.
    const room = layout.pieces[state.floor && state.floor.room >= 0 ? state.floor.room : layout.def.exit];
    return [{ ...openMiddle(room), y: room.y, radius: FLOOR_RING_RADIUS, to: 'village' }];
  }
  const rest = layout.pieces[layout.def.exit];
  if (rest.kind !== 'rest' || state.run.phase !== 'ante') return [];
  const [deeper, home] = rest.rings;
  const homeRing: Ring = { ...home, y: rest.y, radius: FLOOR_RING_RADIUS, to: 'village' };
  // A hand-built dungeon's last floor may end in a rest room: nothing lies deeper, only the way home.
  const spec = layout.def.spec;
  if (spec.floor >= spec.floors) return [homeRing];
  return [{ ...deeper, y: rest.y, radius: FLOOR_RING_RADIUS, to: 'deeper' }, homeRing];
}

/** The first open ring, or null: the village's and the arena's have one at most. */
export function portalFor(world: World, state: SimState): Ring | null {
  return portalsFor(world, state)[0] ?? null;
}

/** Every player still standing is inside the ring (and there is at least one). */
export function partyOnPortal(state: SimState, portal: PortalDef): boolean {
  const standing = state.players.filter((p) => p.mode !== 'down');
  return standing.length > 0 && standing.every((p) => Math.hypot(p.x - portal.x, p.z - portal.z) <= portal.radius);
}

/** What a snapshot says about each open ring, for the rings and their fill. */
export interface PortalState {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Seconds the party has held it so far, out of PORTAL_HOLD_S. */
  held: number;
  /** Where it leads, and the words shown over it (a hand-built dungeon's name, Deeper, Home). */
  to: PortalTo;
  label: string;
}
