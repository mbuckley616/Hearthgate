import type { FloorDef } from './generate';
import type { PieceInfo } from './floor';
import type { LavaStrip } from './lava';

/**
 * Traps (G5, Michael's D, 4 Nov: traps first). Spikes: square tiles in the floor that strike on a
 * cycle, after an orange warning (the colour language's heavy, unblockable), hurting heroes and
 * enemies alike, so a party can lure a pack across them. Level data placed from the seed, like the
 * lava and the props: every browser and the server lay the same tiles and run the same cycle from
 * the sim's clock, and only the server hurts (sim/traps.ts).
 */

export interface SpikeTile {
  /** Centre; a tile is SPIKE_SIZE square. */
  x: number;
  z: number;
  y: number;
  piece: number;
  /** Where in the cycle this tile starts, a share of it, so a room's tiles strike in turn (a share, so the panel's cycle length never moves the level). */
  phase: number;
}

/** A tile's side (m): about a hero's stride, so one step clears it. */
export const SPIKE_SIZE = 2;
/** The share of fight rooms and of long halls that get spikes. */
const ROOM_SHARE = 0.45;
const HALL_SHARE = 0.4;
/** Tiles a room gets at most, and how far apart they keep (m). */
const ROOM_TILES = 3;
const TILE_APART = 3.5;
/** Clear floor kept in front of a doorway (m), so nobody steps out of a door onto a tile. */
const DOOR_CLEAR = 3;

/** A number in [0, 1) from the floor's seed: its own stream, so the generator, props and lava are untouched. */
function trapHash(seed: number, k: number): number {
  let h = (seed ^ 0x5bd1e995 ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The floor's spikes: in some flat fight rooms (never the Warden's hall or the lava room), a few tiles
 * on open floor away from the doorways; in some long halls, a row across the middle, struck together,
 * so the walk through is timed. None on a hand-built floor: it plays exactly as laid out.
 */
export function spikesFor(def: FloorDef, pieces: PieceInfo[], lava: readonly LavaStrip[]): SpikeTile[] {
  const spec = def.spec;
  if (spec.hand) return [];
  const out: SpikeTile[] = [];
  const nearDoor = (p: PieceInfo, x: number, z: number) => p.doors.some((d) => d.open && Math.hypot(d.x - x, d.z - z) < DOOR_CLEAR + SPIKE_SIZE / 2);
  for (const p of pieces) {
    if (p.y !== p.top) continue;
    const k = p.id * 8;
    if (p.fight && p.kind !== 'boss' && !lava.some((l) => l.piece === p.id)) {
      if (trapHash(spec.seed, k) >= ROOM_SHARE) continue;
      const tiles: SpikeTile[] = [];
      for (let i = 0; i < p.spots.length && tiles.length < ROOM_TILES; i++) {
        const sp = p.spots[Math.floor(trapHash(spec.seed, k + 1 + i) * p.spots.length)];
        if (nearDoor(p, sp.x, sp.z) || tiles.some((t) => Math.hypot(t.x - sp.x, t.z - sp.z) < TILE_APART)) continue;
        if (sp.x - SPIKE_SIZE / 2 < p.inner.minX || sp.x + SPIKE_SIZE / 2 > p.inner.maxX || sp.z - SPIKE_SIZE / 2 < p.inner.minZ || sp.z + SPIKE_SIZE / 2 > p.inner.maxZ) continue;
        tiles.push({ x: sp.x, z: sp.z, y: p.y, piece: p.id, phase: tiles.length / ROOM_TILES });
      }
      out.push(...tiles);
    } else if (p.kind === 'hallLong') {
      if (trapHash(spec.seed, k) >= HALL_SHARE) continue;
      // Across the hall's middle, as many tiles as its width holds, one offset for the row.
      const i = p.inner;
      const alongZ = i.maxZ - i.minZ >= i.maxX - i.minX;
      const width = alongZ ? i.maxX - i.minX : i.maxZ - i.minZ;
      const n = Math.max(1, Math.floor(width / SPIKE_SIZE));
      const mid = alongZ ? (i.minZ + i.maxZ) / 2 : (i.minX + i.maxX) / 2;
      const start = (alongZ ? i.minX : i.minZ) + (width - n * SPIKE_SIZE) / 2 + SPIKE_SIZE / 2;
      const phase = trapHash(spec.seed, k + 1);
      for (let s = 0; s < n; s++) {
        const across = start + s * SPIKE_SIZE;
        out.push(alongZ ? { x: across, z: mid, y: p.y, piece: p.id, phase } : { x: mid, z: across, y: p.y, piece: p.id, phase });
      }
    }
  }
  return out;
}

/** The tile (x, z) at floor height y stands on, if any. */
export function spikeAt(tiles: readonly SpikeTile[], x: number, y: number, z: number): SpikeTile | null {
  const h = SPIKE_SIZE / 2;
  for (const t of tiles) if (Math.abs(x - t.x) <= h && Math.abs(z - t.z) <= h && Math.abs(y - t.y) < 0.3) return t;
  return null;
}

/** Seconds into a tile's cycle at sim time `time`. */
export function spikeClock(tile: SpikeTile, time: number, cycleS: number): number {
  const c = (time + tile.phase * cycleS) % cycleS;
  return c < 0 ? c + cycleS : c;
}
