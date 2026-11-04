import type { FloorDef } from './generate';
import type { BoxCollider } from './geometry';
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

/**
 * A swinging blade (G5): a pendulum hung over a hall's middle, swinging across it, so the walk
 * through is timed. The blade sweeps low; it is its own tell.
 */
export interface BladeTrap {
  /** The pivot over the floor, and the floor's height. */
  x: number;
  z: number;
  y: number;
  piece: number;
  /** It swings along x (the hall runs along z), or along z. */
  alongX: boolean;
  /** How far either side of the middle the blade reaches (m). */
  reach: number;
  /** Where in its swing it starts, a share of the period. */
  phase: number;
}

const BLADE_SHARE = 0.35;

/** The floor's blades: one in some flat straight halls without spikes. None on a hand-built floor. */
export function bladesFor(def: FloorDef, pieces: PieceInfo[], spikes: readonly SpikeTile[]): BladeTrap[] {
  const spec = def.spec;
  if (spec.hand) return [];
  const out: BladeTrap[] = [];
  for (const p of pieces) {
    if ((p.kind !== 'hall' && p.kind !== 'hallLong') || p.y !== p.top || spikes.some((t) => t.piece === p.id)) continue;
    if (trapHash(spec.seed, p.id * 8 + 5) >= BLADE_SHARE) continue;
    const door = p.doors.find((d) => d.open);
    if (!door) continue;
    // The hall runs between its doorways; the blade swings across it.
    const alongX = door.side === 'n' || door.side === 's';
    const i = p.inner;
    const width = alongX ? i.maxX - i.minX : i.maxZ - i.minZ;
    out.push({ x: (i.minX + i.maxX) / 2, z: (i.minZ + i.maxZ) / 2, y: p.y, piece: p.id, alongX, reach: width / 2 - 0.4, phase: trapHash(spec.seed, p.id * 8 + 6) });
  }
  return out;
}

/** The blade's offset from the middle across the hall at sim time `time` (m). */
export function bladeOffset(b: BladeTrap, time: number, periodS: number): number {
  return b.reach * Math.sin(2 * Math.PI * (time / periodS + b.phase));
}

/** Half the blade's thickness along the hall (m): a body this close to its line is in its way. */
export const BLADE_HALF = 0.45;

/**
 * A collapsing tile (G5; Michael's B, 4 Nov): a cracked slab that shakes once a hero steps on it and
 * then falls away. Whoever is on it as it falls takes a share of their health and is put back at its
 * edge; an enemy on it is gone. The hole stays for the rest of the floor and blocks the way like a
 * wall (`crumbleCollider`, added by `floorWorldNow` once `SimState.floor.fallen` lists it), so a room
 * changes shape as it is fought. Which tiles shake and fall is the sim's; where they are is the seed's.
 */
export interface CrumbleTile {
  x: number;
  z: number;
  y: number;
  piece: number;
}

/** A tile's side (m), as a spike tile's. */
export const CRUMBLE_SIZE = 2;
const CRUMBLE_ROOM_SHARE = 0.3;
const CRUMBLE_TILES = 2;
/** Tiles keep this far apart (m), so two holes never wall off a room's middle between them. */
const CRUMBLE_APART = 5;

/**
 * The floor's collapsing tiles: two in some flat fight rooms that have neither lava nor spikes (never
 * the boss's hall, never a hall, which a hole could close), on open floor away from the doorways. None
 * on a hand-built floor.
 */
export function crumbleFor(def: FloorDef, pieces: PieceInfo[], lava: readonly LavaStrip[], spikes: readonly SpikeTile[]): CrumbleTile[] {
  const spec = def.spec;
  if (spec.hand) return [];
  const out: CrumbleTile[] = [];
  const h = CRUMBLE_SIZE / 2;
  for (const p of pieces) {
    if (p.y !== p.top || !p.fight || p.kind === 'boss' || lava.some((l) => l.piece === p.id) || spikes.some((t) => t.piece === p.id)) continue;
    const k = p.id * 8 + 3;
    if (trapHash(spec.seed, k) >= CRUMBLE_ROOM_SHARE) continue;
    const tiles: CrumbleTile[] = [];
    for (let i = 0; i < p.spots.length && tiles.length < CRUMBLE_TILES; i++) {
      const sp = p.spots[Math.floor(trapHash(spec.seed, k + 16 + i) * p.spots.length)];
      if (p.doors.some((d) => d.open && Math.hypot(d.x - sp.x, d.z - sp.z) < DOOR_CLEAR + 2 + h)) continue;
      if (tiles.some((t) => Math.hypot(t.x - sp.x, t.z - sp.z) < CRUMBLE_APART)) continue;
      // A clear stride of floor all round it, so a hero put back at its edge stands in the room.
      if (sp.x - h - 1.2 < p.inner.minX || sp.x + h + 1.2 > p.inner.maxX || sp.z - h - 1.2 < p.inner.minZ || sp.z + h + 1.2 > p.inner.maxZ) continue;
      tiles.push({ x: sp.x, z: sp.z, y: p.y, piece: p.id });
    }
    out.push(...tiles);
  }
  return out;
}

/** The tile (x, z) stands on, if any, at floor height y. */
export function crumbleAt(tiles: readonly CrumbleTile[], x: number, y: number, z: number): number {
  const h = CRUMBLE_SIZE / 2;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (Math.abs(x - t.x) <= h && Math.abs(z - t.z) <= h && Math.abs(y - t.y) < 0.3) return i;
  }
  return -1;
}

/** A fallen tile's hole as a wall: nothing walks into it (a jump does not clear it either). */
export function crumbleCollider(t: CrumbleTile, i: number): BoxCollider {
  const h = CRUMBLE_SIZE / 2;
  return {
    kind: 'box',
    id: `crumble-${i}`,
    min: { x: t.x - h, y: t.y - 2, z: t.z - h },
    max: { x: t.x + h, y: t.y + 4, z: t.z + h },
    blocksMovement: true,
    blocksCamera: false,
    fadeable: false,
  };
}
