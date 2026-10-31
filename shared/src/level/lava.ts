import type { FloorDef } from './generate';
import type { PieceInfo, Rect } from './floor';
import { KIT } from './kit';

/**
 * Rooms that need jumping (D6, Michael 30 Oct: A, lava only, on today's jump). From a run's second
 * floor, at most one fight room a floor has strips of lava across it: each narrower than a running
 * hop (about 3 m), with safe stone between, and each stopping short of one wall in turn, so the long
 * way round is a zigzag and the hop is the quick one. Level data placed from the seed, like the props:
 * every browser and the server lay the same strips, and only the server burns (sim/lava.ts).
 */

/** A strip of lava on a piece's floor. */
export interface LavaStrip extends Rect {
  y: number;
  piece: number;
}

/** Strip width across its run (m): a walking hop clears it, a sprint with room to spare. */
export const LAVA_WIDTH = 1.6;
/** Safe stone between two strips (m), enough to land and stand on. */
const LAVA_GAP = 3.4;
/** Clear floor kept inside the walls a party comes in by, and the walkway a strip leaves at one end (m). */
const LAVA_MARGIN = 3;
const LAVA_WALKWAY = 2;
/** How far a strip keeps from a doorway on a side wall (m), so nobody steps out of a door into it. */
const LAVA_DOOR_CLEAR = 2.5;
/** The share of eligible floors that get a lava room. */
const LAVA_SHARE = 0.6;
/** The run's first floor never has one. */
const LAVA_FROM_FLOOR = 2;

/** A number in [0, 1) from the floor's seed: its own stream, so the generator and the props are untouched. */
function lavaHash(seed: number, k: number): number {
  let h = (seed ^ 0x27d4eb2f ^ Math.imul(k + 1, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The floor's lava: none on the first floor, on a hand-built floor or by the share's luck; else one room's strips. */
export function lavaFor(def: FloorDef, pieces: PieceInfo[]): LavaStrip[] {
  const spec = def.spec;
  if (spec.hand || spec.floor < LAVA_FROM_FLOOR) return [];
  if (lavaHash(spec.seed, 0) >= LAVA_SHARE) return [];
  // Flat fight rooms of three cells or more a side; never the Warden's hall.
  const rooms = pieces.filter((p) => p.fight && p.kind !== 'boss' && p.y === p.top && KIT[p.kind].w >= 3 && KIT[p.kind].d >= 3);
  if (!rooms.length) return [];
  const room = rooms[Math.floor(lavaHash(spec.seed, 1) * rooms.length)];
  return stripsFor(room, lavaHash(spec.seed, 2) < 0.5);
}

/**
 * Strips across the room's longer run, so the party crosses as many as fit; the ends stay clear by
 * LAVA_MARGIN for the doorways there, and a strip that would lie across a side wall's doorway is left out.
 */
function stripsFor(room: PieceInfo, flip: boolean): LavaStrip[] {
  const i = room.inner;
  // Along z the strips run east to west and are stacked north to south, unless the room is wider than deep.
  const alongZ = i.maxZ - i.minZ >= i.maxX - i.minX;
  const lo = alongZ ? i.minZ : i.minX;
  const hi = alongZ ? i.maxZ : i.maxX;
  const a0 = alongZ ? i.minX : i.minZ;
  const a1 = alongZ ? i.maxX : i.maxZ;
  // The doorways on the walls the strips run toward: a strip near one is dropped.
  const sideDoors = room.doors.filter((d) => d.open && (alongZ ? d.side === 'e' || d.side === 'w' : d.side === 'n' || d.side === 's'));
  const out: LavaStrip[] = [];
  const span = hi - lo - 2 * LAVA_MARGIN;
  const n = Math.floor((span + LAVA_GAP) / (LAVA_WIDTH + LAVA_GAP));
  if (n < 1) return out;
  // Centred in the room's run.
  const start = lo + LAVA_MARGIN + (span - (n * LAVA_WIDTH + (n - 1) * LAVA_GAP)) / 2;
  let k = 0;
  for (let s = 0; s < n; s++) {
    const b0 = start + s * (LAVA_WIDTH + LAVA_GAP);
    const b1 = b0 + LAVA_WIDTH;
    const mid = (b0 + b1) / 2;
    if (sideDoors.some((d) => Math.abs((alongZ ? d.z : d.x) - mid) < LAVA_WIDTH / 2 + LAVA_DOOR_CLEAR)) continue;
    // Each kept strip leaves its walkway at the other end from the last one: the long way zigzags.
    const openHigh = (k++ % 2 === 0) !== flip;
    const c0 = openHigh ? a0 : a0 + LAVA_WALKWAY;
    const c1 = openHigh ? a1 - LAVA_WALKWAY : a1;
    out.push(alongZ ? { minX: c0, maxX: c1, minZ: b0, maxZ: b1, y: room.y, piece: room.id } : { minX: b0, maxX: b1, minZ: c0, maxZ: c1, y: room.y, piece: room.id });
  }
  return out;
}

/** The strip (x, z) at floor height y stands in, if any. */
export function lavaAt(lava: readonly LavaStrip[], x: number, y: number, z: number): LavaStrip | null {
  for (const s of lava) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && Math.abs(y - s.y) < 0.3) return s;
  return null;
}
