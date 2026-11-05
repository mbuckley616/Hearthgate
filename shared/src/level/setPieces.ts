import type { FloorDef } from './generate';
import type { BoxCollider } from './geometry';
import type { PieceInfo, Rect } from './floor';
import type { LavaStrip } from './lava';
import { CRUMBLE_SIZE, SPIKE_SIZE, type CrumbleTile, type SpikeTile } from './traps';

/**
 * Set pieces (G5's B, Michael's C, 4 Nov: one shape or set piece a session, the sarcophagus rows
 * first). A row of stone tombs standing across part of a fight room: chest high, so a hero who
 * ducks behind one is out of an archer's line and a Wraith's sight, and an arrow flying at it stops
 * in the stone. They are solid to everyone, so a fight moves round them. Level data placed from the
 * seed like the lava and the traps: the server and every browser lay the same rows.
 */

export interface Sarcophagus {
  /** Centre of the tomb's footprint, and the floor's height. */
  x: number;
  z: number;
  y: number;
  piece: number;
  /** Its long side runs along x (else along z). */
  alongX: boolean;
}

/** A tomb's footprint (m) and its height: the height is over the line an archer draws to a hero's chest. */
export const SARC_LONG = 2.2;
export const SARC_WIDE = 1.0;
export const SARC_HEIGHT = 1.3;
/** Tombs in a row, and the gap between two (m): a hero walks through a gap, a row still screens. */
const ROW_TOMBS = 3;
const ROW_GAP = 1.1;
/** The share of fight rooms that get rows, and at most how many a room gets. */
const ROW_ROOM_SHARE = 0.45;
const ROWS_A_ROOM = 2;
/** A room narrower than this (m inside the walls) has no room for a row and a fight round it. */
const MIN_ROOM = 15;
/** Clear floor kept round a row (m): from the walls, a doorway, the room's middle and the way through. */
const WALL_CLEAR = 1.4;
const DOOR_CLEAR = 4;
const WAY_CLEAR = 1.6;

/** A number in [0, 1) from the floor's seed: its own stream, so the generator, props, lava and traps are untouched. */
function setHash(seed: number, k: number): number {
  let h = (seed ^ 0x27d4eb2f ^ Math.imul(k + 1, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A tomb's footprint. */
export function sarcRect(s: Sarcophagus): Rect {
  const hx = (s.alongX ? SARC_LONG : SARC_WIDE) / 2;
  const hz = (s.alongX ? SARC_WIDE : SARC_LONG) / 2;
  return { minX: s.x - hx, maxX: s.x + hx, minZ: s.z - hz, maxZ: s.z + hz };
}

/** Distance from a point to a rect (0 inside). */
export function rectDistance(r: Rect, x: number, z: number): number {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/** Distance from a segment to a rect, sampled finely enough for clearances of a metre or more. */
function segmentRectDistance(r: Rect, ax: number, az: number, bx: number, bz: number): number {
  const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
  let best = Infinity;
  for (let i = 0; i <= n; i++) best = Math.min(best, rectDistance(r, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n));
  return best;
}

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.minX - margin < b.maxX && a.maxX + margin > b.minX && a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ;
}


/** A row of tombs side by side, centred on (x, z), the row running along x or z. */
function row(p: PieceInfo, x: number, z: number, runsAlongX: boolean): Sarcophagus[] {
  const out: Sarcophagus[] = [];
  const step = SARC_WIDE + ROW_GAP;
  for (let i = 0; i < ROW_TOMBS; i++) {
    const off = (i - (ROW_TOMBS - 1) / 2) * step;
    // Side by side across the row: each tomb's long side lies across the way the row runs.
    out.push(runsAlongX ? { x: x + off, z, y: p.y, piece: p.id, alongX: false } : { x, z: z + off, y: p.y, piece: p.id, alongX: true });
  }
  return out;
}

/**
 * The floor's tomb rows: one or two in some big flat fight rooms (never the boss's hall or the lava
 * room), on open floor clear of the walls, the doorways, the traps, the pillars and fires, the room's
 * middle and the straight ways from each doorway to it, so a bot's route through stays open. None on
 * a hand-built floor: it plays exactly as laid out.
 */
export function sarcophagiFor(
  def: FloorDef,
  pieces: PieceInfo[],
  lava: readonly LavaStrip[],
  spikes: readonly SpikeTile[],
  crumble: readonly CrumbleTile[],
  /** The point a bot's route crosses each piece through (floor.ts's `openMiddle`), passed in to keep the import one way. */
  middleOf: (p: PieceInfo) => { x: number; z: number },
): Sarcophagus[] {
  const spec = def.spec;
  if (spec.hand) return [];
  const out: Sarcophagus[] = [];
  for (const p of pieces) {
    if (!p.fight || p.kind === 'boss' || p.y !== p.top || lava.some((l) => l.piece === p.id)) continue;
    const i = p.inner;
    if (i.maxX - i.minX < MIN_ROOM || i.maxZ - i.minZ < MIN_ROOM) continue;
    const k = p.id * 16;
    if (setHash(spec.seed, k) >= ROW_ROOM_SHARE) continue;
    const mid = middleOf(p);
    const doors = p.doors.filter((d) => d.open);
    const traps: Rect[] = [
      ...spikes.filter((t) => t.piece === p.id).map((t) => ({ minX: t.x - SPIKE_SIZE / 2, maxX: t.x + SPIKE_SIZE / 2, minZ: t.z - SPIKE_SIZE / 2, maxZ: t.z + SPIKE_SIZE / 2 })),
      ...crumble.filter((t) => t.piece === p.id).map((t) => ({ minX: t.x - CRUMBLE_SIZE / 2, maxX: t.x + CRUMBLE_SIZE / 2, minZ: t.z - CRUMBLE_SIZE / 2, maxZ: t.z + CRUMBLE_SIZE / 2 })),
    ];
    const rows: Rect[] = [];
    for (let tries = 0; tries < 12 && rows.length < ROWS_A_ROOM && p.spots.length; tries++) {
      const sp = p.spots[Math.floor(setHash(spec.seed, k + 1 + tries * 2) * p.spots.length)];
      const tombs = row(p, sp.x, sp.z, setHash(spec.seed, k + 2 + tries * 2) < 0.5);
      const rects = tombs.map(sarcRect);
      const all: Rect = {
        minX: Math.min(...rects.map((r) => r.minX)),
        maxX: Math.max(...rects.map((r) => r.maxX)),
        minZ: Math.min(...rects.map((r) => r.minZ)),
        maxZ: Math.max(...rects.map((r) => r.maxZ)),
      };
      if (all.minX - WALL_CLEAR < i.minX || all.maxX + WALL_CLEAR > i.maxX || all.minZ - WALL_CLEAR < i.minZ || all.maxZ + WALL_CLEAR > i.maxZ) continue;
      if (doors.some((d) => rectDistance(all, d.x, d.z) < DOOR_CLEAR)) continue;
      if (rectDistance(all, mid.x, mid.z) < WAY_CLEAR + 0.6) continue;
      if (doors.some((d) => rects.some((r) => segmentRectDistance(r, d.x, d.z, mid.x, mid.z) < WAY_CLEAR))) continue;
      if (p.pillars.some((pl) => rectDistance(all, pl.x, pl.z) < pl.radius + 1.4)) continue;
      if (p.braziers.some((b) => rectDistance(all, b.x, b.z) < 1.8)) continue;
      if (p.blocks.some((b) => overlaps(all, b, WALL_CLEAR))) continue;
      if (traps.some((t) => overlaps(all, t, 1.2))) continue;
      if (rows.some((r) => overlaps(all, r, 2.5))) continue;
      rows.push(all);
      out.push(...tombs);
    }
  }
  return out;
}

/** A tomb as a wall: chest high, so nothing walks or shoots through it and a jump does not clear it. */
export function sarcCollider(s: Sarcophagus, i: number): BoxCollider {
  const r = sarcRect(s);
  return {
    kind: 'box',
    id: `sarc-${s.piece}-${i}`,
    min: { x: r.minX, y: 0, z: r.minZ },
    max: { x: r.maxX, y: s.y + SARC_HEIGHT, z: r.maxZ },
    blocksMovement: true,
    blocksCamera: false,
    fadeable: false,
  };
}

/**
 * The dais (G5's B, Michael's C: the third set piece). A square of stone in the middle of a big fight
 * room, raised in two steps. Each step is lower than anyone's stride (`combat.stepHeight`), so heroes,
 * henchmen and enemies all walk up it from any side with no path of their own, and the top is well
 * inside the height every attack reaches (enemies' 0.9 m level gap), so it changes how a fight moves
 * without changing who can hit whom. A floor never goes below a room's floor (`groundHeight` takes the
 * highest surface), so the "sunken ring" round it is the room's own floor, a step below the dais.
 */
export interface Dais {
  /** Its centre, and the room's floor height. */
  x: number;
  z: number;
  y: number;
  piece: number;
  /** The lower step's side (m); the top is `DAIS_LEDGE` in from it all round. */
  size: number;
}

/**
 * The lower step's side (m), largest first: a room ringed by pillars (the halls of pillars, the great
 * hall) takes a smaller one inside its ring, the ring of pillars round a raised dais. The top is set in a stride from the step's edge, and each step's rise
 * (m) is under the 0.35 m stride.
 */
export const DAIS_SIZES = [8, 6.5, 5];
export const DAIS_LEDGE = 1.5;
export const DAIS_STEP = 0.3;
/** The share of the rooms that could take one that do. */
const DAIS_ROOM_SHARE = 0.4;

/** The dais's lower step (`inner` false) or its top (`inner` true). */
export function daisRect(d: Dais, inner = false): Rect {
  const h = (inner ? d.size - DAIS_LEDGE * 2 : d.size) / 2;
  return { minX: d.x - h, maxX: d.x + h, minZ: d.z - h, maxZ: d.z + h };
}

/** Ground height of the dais at a point, or the room's floor off it. */
export function daisHeight(d: Dais, x: number, z: number): number {
  if (rectDistance(daisRect(d, true), x, z) === 0) return d.y + DAIS_STEP * 2;
  if (rectDistance(daisRect(d), x, z) === 0) return d.y + DAIS_STEP;
  return d.y;
}

/**
 * The floor's daises: at most one a room, in the middle of some big flat fight rooms that hold no
 * other set piece (never the boss's hall, the lava room or a room with tombs), clear of the pillars,
 * fires, masonry, traps and doorways. None on a hand-built floor.
 */
export function daisesFor(
  def: FloorDef,
  pieces: PieceInfo[],
  lava: readonly LavaStrip[],
  spikes: readonly SpikeTile[],
  crumble: readonly CrumbleTile[],
  tombs: readonly Sarcophagus[],
): Dais[] {
  const spec = def.spec;
  if (spec.hand) return [];
  const out: Dais[] = [];
  for (const p of pieces) {
    if (!p.fight || p.kind === 'boss' || p.y !== p.top || lava.some((l) => l.piece === p.id) || tombs.some((t) => t.piece === p.id)) continue;
    const i = p.inner;
    if (i.maxX - i.minX < MIN_ROOM || i.maxZ - i.minZ < MIN_ROOM) continue;
    // Its own key in the set-piece stream, clear of the tombs' (piece * 16 + up to 25).
    if (setHash(spec.seed, 0x4000 + p.id) >= DAIS_ROOM_SHARE) continue;
    const traps: Rect[] = [
      ...spikes.filter((t) => t.piece === p.id).map((t) => ({ minX: t.x - SPIKE_SIZE / 2, maxX: t.x + SPIKE_SIZE / 2, minZ: t.z - SPIKE_SIZE / 2, maxZ: t.z + SPIKE_SIZE / 2 })),
      ...crumble.filter((t) => t.piece === p.id).map((t) => ({ minX: t.x - CRUMBLE_SIZE / 2, maxX: t.x + CRUMBLE_SIZE / 2, minZ: t.z - CRUMBLE_SIZE / 2, maxZ: t.z + CRUMBLE_SIZE / 2 })),
    ];
    const fits = (d: Dais): boolean => {
      const r = daisRect(d);
      if (r.minX - WALL_CLEAR < i.minX || r.maxX + WALL_CLEAR > i.maxX || r.minZ - WALL_CLEAR < i.minZ || r.maxZ + WALL_CLEAR > i.maxZ) return false;
      if (p.doors.some((dr) => dr.open && rectDistance(r, dr.x, dr.z) < 3)) return false;
      // A stride between a step and a pillar or a fire, so nobody is wedged between them.
      if (p.pillars.some((pl) => rectDistance(r, pl.x, pl.z) < pl.radius + 1.2)) return false;
      if (p.braziers.some((b) => rectDistance(r, b.x, b.z) < 1.2)) return false;
      if (p.blocks.some((b) => overlaps(r, b, 1.2))) return false;
      return !traps.some((t) => overlaps(r, t, 1));
    };
    const at = { x: (i.minX + i.maxX) / 2, z: (i.minZ + i.maxZ) / 2, y: p.y, piece: p.id };
    const d = DAIS_SIZES.map((size) => ({ ...at, size })).find(fits);
    if (d) out.push(d);
  }
  return out;
}

/** The dais as two flat surfaces for `groundHeight`, the top over the lower step. */
export function daisSurfaces(d: Dais): { kind: 'flat'; minX: number; maxX: number; minZ: number; maxZ: number; height: number }[] {
  return [
    { kind: 'flat', ...daisRect(d), height: d.y + DAIS_STEP },
    { kind: 'flat', ...daisRect(d, true), height: d.y + DAIS_STEP * 2 },
  ];
}
