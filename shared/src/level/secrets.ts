import type { FloorDef } from './generate';
import type { BoxCollider } from './geometry';
import type { PieceInfo, PropInfo, Rect } from './floor';
import { CELL, DOOR_H, DOOR_W, SIDE_DIR, WALL_H, WALL_T, type Side } from './kit';
import type { LavaStrip } from './lava';
import { rectDistance, sarcRect, type Dais, type Sarcophagus } from './setPieces';
import { CRUMBLE_SIZE, SPIKE_SIZE, type CrumbleTile, type SpikeTile } from './traps';

/**
 * Secret rooms behind cracked walls (G5's C, Michael's A, 5 Nov). Now and then one of a fight room's
 * walled-up doorways is a hairline-cracked wall instead, and behind it is a one-cell dead end with a
 * chest. A heavy hit, a shield bash or a slam breaks the wall (`sim/smash.ts`); the chest breaks to
 * any blow and sprays a find like a crate's, only more of it: carried until banked, lost with a wipe.
 *
 * Level data, placed from the floor's seed like the props, so every browser builds the same. The sim
 * keeps only which are broken, in `SimState.floor.broken`, with the props: the crack and the chest
 * are props with ids from `SECRET_ID_BASE`, so nothing new travels in a snapshot.
 */
export interface SecretRoom {
  /** Its place in the floor's list. */
  id: number;
  /** The fight room the crack is in, and the wall it is on. */
  piece: number;
  side: Side;
  /** The walled-up doorway: the middle of the gap on the wall's centre line, and its floor height. */
  x: number;
  z: number;
  y: number;
  /** The cell behind it, walls included, and its open floor. */
  cell: Rect;
  inner: Rect;
  /** The cracked wall that fills the gap until it is broken. */
  wall: BoxCollider;
  /** The crack as a prop (kind 'crack'), on the room's side of the wall, and the chest (kind 'chest'). */
  crack: PropInfo;
  chest: PropInfo;
}

/** A secret's crack and chest are props from this id on, two a secret, clear of the floor's own props. */
export const SECRET_ID_BASE = 10000;
/** The chance a fight room has a crack, and the most on a floor ("now and then"). */
const SECRET_CHANCE = 0.15;
const SECRETS_MAX = 2;
/** How far along the wall a blow may land and still meet the crack (m): most of the doorway's width. */
export const CRACK_REACH = DOOR_W / 2 - 0.4;

/** The secret a prop id belongs to, and whether it is the crack, or null for a floor's own prop. */
export function secretOf(id: number): { secret: number; crack: boolean } | null {
  if (id < SECRET_ID_BASE) return null;
  const k = id - SECRET_ID_BASE;
  return { secret: Math.floor(k / 2), crack: k % 2 === 0 };
}

function hash(seed: number, piece: number, k: number): number {
  let h = (seed ^ 0x2c1b3c6d ^ Math.imul(piece + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function overlaps(a: Rect, b: Rect): boolean {
  const e = 1e-6;
  return a.minX < b.maxX - e && b.minX < a.maxX - e && a.minZ < b.maxZ - e && b.minZ < a.maxZ - e;
}

/** Facing into the room from a wall on this side (yaw 0 faces +z), as floor.ts's props face. */
const YAW: Record<Side, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

/**
 * The floor's secret rooms: for a fight room (never the boss's hall) that rolls one, a walled-up
 * doorway on its own floor whose cell outside is clear of every piece and every other secret, with
 * nothing in front of it on the room's side (lava, spikes, a falling tile, a tomb, the dais) that
 * would make reaching the crack a trap of its own.
 */
export function secretsFor(
  def: FloorDef,
  pieces: readonly PieceInfo[],
  lava: readonly LavaStrip[],
  spikes: readonly SpikeTile[],
  crumble: readonly CrumbleTile[],
  tombs: readonly Sarcophagus[],
  daises: readonly Dais[],
): SecretRoom[] {
  const out: SecretRoom[] = [];
  const seed = def.spec.seed;
  // Inside the floor's bounding box, so its ground, the camera and the map already cover it.
  const box = {
    minX: Math.min(...pieces.map((p) => p.bounds.minX)),
    maxX: Math.max(...pieces.map((p) => p.bounds.maxX)),
    minZ: Math.min(...pieces.map((p) => p.bounds.minZ)),
    maxZ: Math.max(...pieces.map((p) => p.bounds.maxZ)),
  };
  for (const info of pieces) {
    if (out.length >= SECRETS_MAX) break;
    if (!info.fight || info.kind === 'boss' || info.y !== info.top) continue;
    if (hash(seed, info.id, 0) >= SECRET_CHANCE) continue;
    const walled = info.doors.filter((d) => !d.open && Math.abs(d.y - info.y) < 1e-6);
    if (!walled.length) continue;
    // Start from a door the seed picks and take the first that fits.
    const first = Math.floor(hash(seed, info.id, 1) * walled.length);
    for (let n = 0; n < walled.length; n++) {
      const d = walled[(first + n) % walled.length];
      const dir = SIDE_DIR[d.side];
      const cx = d.x + dir.x * (WALL_T / 2 + CELL / 2);
      const cz = d.z + dir.z * (WALL_T / 2 + CELL / 2);
      const cell = { minX: cx - CELL / 2, maxX: cx + CELL / 2, minZ: cz - CELL / 2, maxZ: cz + CELL / 2 };
      if (cell.minX < box.minX - 1e-6 || cell.maxX > box.maxX + 1e-6 || cell.minZ < box.minZ - 1e-6 || cell.maxZ > box.maxZ + 1e-6) continue;
      if (pieces.some((p) => overlaps(p.bounds, cell)) || out.some((s) => overlaps(s.cell, cell))) continue;
      // The crack's face on the room's side, and the floor in front of it.
      const fx = d.x - dir.x * (WALL_T / 2 + 0.05);
      const fz = d.z - dir.z * (WALL_T / 2 + 0.05);
      const ax = d.x - dir.x * 1.5;
      const az = d.z - dir.z * 1.5;
      if (lava.some((l) => l.piece === info.id && rectDistance(l, ax, az) < 2)) continue;
      if (spikes.some((t) => t.piece === info.id && Math.hypot(t.x - ax, t.z - az) < SPIKE_SIZE / 2 + 2)) continue;
      if (crumble.some((t) => t.piece === info.id && Math.hypot(t.x - ax, t.z - az) < CRUMBLE_SIZE / 2 + 2)) continue;
      if (tombs.some((t) => t.piece === info.id && rectDistance(sarcRect(t), ax, az) < 1.5)) continue;
      if (daises.some((dd) => dd.piece === info.id && Math.hypot(dd.x - ax, dd.z - az) < 6)) continue;
      if (info.blocks.some((r) => rectDistance(r, ax, az) < 1.5)) continue;
      const inner = {
        minX: d.side === 'e' ? cell.minX : cell.minX + WALL_T,
        maxX: d.side === 'w' ? cell.maxX : cell.maxX - WALL_T,
        minZ: d.side === 's' ? cell.minZ : cell.minZ + WALL_T,
        maxZ: d.side === 'n' ? cell.maxZ : cell.maxZ - WALL_T,
      };
      const ns = d.side === 'n' || d.side === 's';
      const across = ns ? { minZ: d.z - WALL_T / 2, maxZ: d.z + WALL_T / 2 } : { minX: d.x - WALL_T / 2, maxX: d.x + WALL_T / 2 };
      const along = ns ? { minX: d.x - DOOR_W / 2, maxX: d.x + DOOR_W / 2 } : { minZ: d.z - DOOR_W / 2, maxZ: d.z + DOOR_W / 2 };
      const r = { ...along, ...across } as Rect;
      const id = out.length;
      const wall: BoxCollider = {
        kind: 'box',
        id: `crack-${id}`,
        min: { x: r.minX, y: d.y, z: r.minZ },
        max: { x: r.maxX, y: d.y + Math.min(DOOR_H, WALL_H), z: r.maxZ },
        blocksMovement: true,
        blocksCamera: false,
        fadeable: true,
      };
      // The chest stands against the far wall, facing the way in, and sprays back toward it.
      const chestX = cx + dir.x * (CELL / 2 - WALL_T - 0.9);
      const chestZ = cz + dir.z * (CELL / 2 - WALL_T - 0.9);
      const crack: PropInfo = { id: SECRET_ID_BASE + id * 2, kind: 'crack', x: fx, y: d.y, z: fz, yaw: YAW[d.side], piece: info.id, inward: YAW[d.side], room: info.inner };
      const chest: PropInfo = { id: SECRET_ID_BASE + id * 2 + 1, kind: 'chest', x: chestX, y: d.y, z: chestZ, yaw: YAW[d.side], piece: info.id, inward: YAW[d.side], room: inner };
      out.push({ id, piece: info.id, side: d.side, x: d.x, z: d.z, y: d.y, cell, inner, wall, crack, chest });
      break;
    }
  }
  return out;
}

/** The cell's three outer walls, as the floor's other walls are built (ids `wall-secret-*`, so they are drawn and fade alike). */
export function secretWalls(s: SecretRoom): BoxCollider[] {
  const c = s.cell;
  const T = WALL_T;
  const H = s.y + WALL_H;
  const mk = (k: string, minX: number, maxX: number, minZ: number, maxZ: number): BoxCollider => ({
    kind: 'box',
    id: `wall-secret-${s.id}-${k}`,
    min: { x: minX, y: 0, z: minZ },
    max: { x: maxX, y: H, z: maxZ },
    blocksMovement: true,
    blocksCamera: false,
    fadeable: true,
  });
  const out: BoxCollider[] = [];
  // Every side but the one shared with the room (whose wall is the room's).
  if (s.side !== 's') out.push(mk('n', c.minX, c.maxX, c.minZ, c.minZ + T));
  if (s.side !== 'n') out.push(mk('s', c.minX, c.maxX, c.maxZ - T, c.maxZ));
  // East and west fit between north and south, as a piece's do; the room's side has no north or south to fit between.
  const z0 = s.side === 's' ? c.minZ : c.minZ + T;
  const z1 = s.side === 'n' ? c.maxZ : c.maxZ - T;
  if (s.side !== 'e') out.push(mk('w', c.minX, c.minX + T, z0, z1));
  if (s.side !== 'w') out.push(mk('e', c.maxX - T, c.maxX, z0, z1));
  return out;
}
