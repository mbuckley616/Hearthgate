import type { World } from '../level/arena';
import { tuning } from '../config/tuning';
import { openMiddle, type PieceInfo } from '../level/floor';
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
    // Home from the Warden's hall (Michael, 31 Oct): a count after the fall, and away from it, so
    // nobody steps through on top of the drops before picking them up.
    const room = layout.pieces[state.floor && state.floor.room >= 0 ? state.floor.room : layout.def.exit];
    if (state.run.timer < tuning.loop.homeRingDelayS) return [];
    return [{ ...homeRingSpot(room, state.run.dropX, state.run.dropZ), y: room.y, radius: FLOOR_RING_RADIUS, to: 'village' }];
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

/** Seconds until the ring home opens where the Warden fell, or 0 once it is open (or there is none to wait for). */
export function homeRingIn(world: World, state: SimState): number {
  if (!world.level.dungeon || state.run.phase !== 'won') return 0;
  return Math.max(0, tuning.loop.homeRingDelayS - state.run.timer);
}

/**
 * Where the ring home opens in the Warden's hall: loop.homeRingOffset from where it fell, toward
 * the hall's middle (or its doorway, if it fell there), kept off the walls.
 */
function homeRingSpot(room: PieceInfo, x: number, z: number): { x: number; z: number } {
  const mid = openMiddle(room);
  let dx = mid.x - x;
  let dz = mid.z - z;
  if (Math.hypot(dx, dz) < 0.5) {
    const door = room.doors.find((d) => d.open);
    dx = door ? door.x - x : 1;
    dz = door ? door.z - z : 0;
  }
  const len = Math.hypot(dx, dz) || 1;
  const off = tuning.loop.homeRingOffset;
  const b = room.bounds;
  const inset = FLOOR_RING_RADIUS + 0.6;
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  return { x: clamp(x + (dx / len) * off, b.minX + inset, b.maxX - inset), z: clamp(z + (dz / len) * off, b.minZ + inset, b.maxZ - inset) };
}

/** The first open ring, or null: the village's and the arena's have one at most. */
export function portalFor(world: World, state: SimState): Ring | null {
  return portalsFor(world, state)[0] ?? null;
}

/** Every player still standing is inside the ring (and there is at least one). */
export function partyOnPortal(state: SimState, portal: PortalDef): boolean {
  // Henchmen follow their party through a ring (P10); the players decide when to take it.
  const standing = state.players.filter((p) => p.mode !== 'down' && !p.henchman);
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
