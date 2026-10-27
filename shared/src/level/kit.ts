/**
 * The dungeon kit (T4, decisions.md 27 Oct: "pre built components ... hallway, staircase, small
 * room, medium room"): every piece a generated floor is made of, authored in code. A piece covers
 * whole cells of a 6 m grid, so two pieces can never overlap, and its doorways (sockets) sit in the
 * middle of a cell edge, so any two facing sockets line up. A piece's own walls stand inside its
 * cells: neighbours' walls meet back to back and never cross.
 *
 * Plain data and math, like the arena: the generator, the sim (through floor.ts) and the renderer
 * read the same numbers.
 */

/** Grid cell size (m). The slice's arena is five cells across. */
export const CELL = 6;
/** Wall thickness inside a piece's edge (m); two neighbours make a 1 m wall. */
export const WALL_T = 0.5;
/**
 * Wall height above a piece's floor (m). Lower than the arena's 7: the generated halls are narrow
 * and the camera looks over them, the walls fading when they hide the hero.
 */
export const WALL_H = 4.5;
export const DOOR_W = 4;
export const DOOR_H = 3.2;
/** One staircase climbs or drops this much (m), a little more than the arena's ledge, so a change of height reads. */
export const STEP_H = 2.4;
/** Staircase landings at each end (m); the ramp runs between them. */
export const LANDING = 2;

/** n is -z (the slice's north wall), s is +z, e is +x, w is -x. */
export type Side = 'n' | 'e' | 's' | 'w';
export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];

export const SIDE_DIR: Record<Side, { x: number; z: number }> = {
  n: { x: 0, z: -1 },
  e: { x: 1, z: 0 },
  s: { x: 0, z: 1 },
  w: { x: -1, z: 0 },
};

export const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

export type PieceKind =
  | 'entrance'
  | 'hall'
  | 'hallLong'
  | 'corner'
  | 'tee'
  | 'cross'
  | 'stair'
  | 'small'
  | 'medium'
  | 'large'
  | 'arena'
  | 'rest'
  | 'boss';

/** A doorway on the unrotated piece: which side, which cell along it, and how far above the piece's floor (staircases). */
export interface SocketDef {
  side: Side;
  at: number;
  /** Staircase steps above the piece's base (0 for every flat piece). */
  rise: number;
}

/** Fittings in the unrotated piece's own metres, (0, 0) at its north-west corner. */
export interface PieceDef {
  kind: PieceKind;
  /** Cells along x and z, unrotated. */
  w: number;
  d: number;
  sockets: SocketDef[];
  /** Rooms are fought in; connectors (halls, corners, junctions, stairs) never are. */
  room: boolean;
  /** Name shown on the room's banner when its doors close. */
  title: string;
  pillars: { x: number; z: number; radius: number }[];
  braziers: { x: number; z: number }[];
}

const s = (side: Side, at: number, rise = 0): SocketDef => ({ side, at, rise });

/** The kit. Sizes in cells; pillars and braziers in metres from the piece's north-west corner. */
export const KIT: Record<PieceKind, PieceDef> = {
  entrance: { kind: 'entrance', w: 2, d: 2, sockets: [s('n', 0), s('e', 1), s('w', 1)], room: false, title: 'The way in', pillars: [], braziers: [] },
  hall: { kind: 'hall', w: 1, d: 1, sockets: [s('n', 0), s('s', 0)], room: false, title: 'Hallway', pillars: [], braziers: [] },
  hallLong: { kind: 'hallLong', w: 1, d: 2, sockets: [s('n', 0), s('s', 0)], room: false, title: 'Hallway', pillars: [], braziers: [] },
  corner: { kind: 'corner', w: 1, d: 1, sockets: [s('s', 0), s('e', 0)], room: false, title: 'Corner', pillars: [], braziers: [] },
  tee: { kind: 'tee', w: 1, d: 1, sockets: [s('s', 0), s('e', 0), s('w', 0)], room: false, title: 'Junction', pillars: [], braziers: [] },
  cross: { kind: 'cross', w: 1, d: 1, sockets: [s('n', 0), s('e', 0), s('s', 0), s('w', 0)], room: false, title: 'Crossing', pillars: [], braziers: [] },
  // Unrotated, the stair climbs northward: its south doorway is at its base, its north one a step up.
  stair: { kind: 'stair', w: 1, d: 2, sockets: [s('s', 0, 0), s('n', 0, 1)], room: false, title: 'Staircase', pillars: [], braziers: [] },
  small: { kind: 'small', w: 2, d: 2, sockets: [s('n', 0), s('e', 1), s('s', 1), s('w', 0)], room: true, title: 'A guard room', pillars: [], braziers: [] },
  medium: {
    kind: 'medium',
    w: 3,
    d: 3,
    sockets: [s('n', 1), s('e', 1), s('s', 1), s('w', 1)],
    room: true,
    title: 'The hall of pillars',
    pillars: [
      { x: 5, z: 5, radius: 0.6 },
      { x: 13, z: 5, radius: 0.6 },
      { x: 5, z: 13, radius: 0.6 },
      { x: 13, z: 13, radius: 0.6 },
    ],
    braziers: [],
  },
  large: {
    kind: 'large',
    w: 4,
    d: 4,
    sockets: [s('n', 1), s('n', 2), s('e', 1), s('s', 2), s('w', 2)],
    room: true,
    title: 'The great hall',
    pillars: [
      { x: 7, z: 7, radius: 0.7 },
      { x: 17, z: 7, radius: 0.7 },
      { x: 7, z: 17, radius: 0.7 },
      { x: 17, z: 17, radius: 0.7 },
    ],
    braziers: [
      { x: 12, z: 3.2 },
      { x: 12, z: 20.8 },
    ],
  },
  // The slice's arena (30 m, its pillars where its pillars stand), without the ledge.
  arena: {
    kind: 'arena',
    w: 5,
    d: 5,
    sockets: [s('n', 2), s('e', 2), s('s', 2), s('w', 2)],
    room: true,
    title: 'The pit',
    pillars: [
      { x: 9.5, z: 11, radius: 0.75 },
      { x: 20.5, z: 11, radius: 0.75 },
      { x: 8, z: 21, radius: 0.75 },
      { x: 22, z: 21, radius: 0.75 },
      { x: 15, z: 15.5, radius: 0.9 },
    ],
    braziers: [
      { x: 2.6, z: 2.6 },
      { x: 27.4, z: 2.6 },
      { x: 2.6, z: 27.4 },
      { x: 27.4, z: 27.4 },
    ],
  },
  // A dead end the party reaches at the far side of a floor: the rings to go deeper or go home.
  rest: { kind: 'rest', w: 3, d: 3, sockets: [s('s', 1)], room: false, title: 'A place to rest', pillars: [], braziers: [{ x: 9, z: 9 }] },
  // The last floor's end: the Warden's hall, as wide as the slice's arena.
  boss: {
    kind: 'boss',
    w: 5,
    d: 5,
    sockets: [s('s', 2)],
    room: true,
    title: 'The Warden',
    pillars: [
      { x: 8, z: 8, radius: 0.75 },
      { x: 22, z: 8, radius: 0.75 },
      { x: 8, z: 22, radius: 0.75 },
      { x: 22, z: 22, radius: 0.75 },
    ],
    braziers: [
      { x: 2.6, z: 2.6 },
      { x: 27.4, z: 2.6 },
      { x: 2.6, z: 27.4 },
      { x: 27.4, z: 27.4 },
    ],
  },
};

/** Rotate a side by r quarter turns clockwise seen from above (n -> e -> s -> w). */
export function rotSide(side: Side, r: number): Side {
  return SIDES[(SIDES.indexOf(side) + r) % 4];
}

/** A piece's size in cells after r quarter turns. */
export function rotSize(def: PieceDef, r: number): { w: number; d: number } {
  return r % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
}

/** The cell (within the unrotated piece) a socket's doorway opens from. */
function socketCell(def: PieceDef, sk: SocketDef): { x: number; z: number } {
  switch (sk.side) {
    case 'n':
      return { x: sk.at, z: 0 };
    case 's':
      return { x: sk.at, z: def.d - 1 };
    case 'w':
      return { x: 0, z: sk.at };
    case 'e':
      return { x: def.w - 1, z: sk.at };
  }
}

/** A socket after rotating the piece: its cell within the rotated footprint and the side it faces. */
export function rotSocket(def: PieceDef, sk: SocketDef, r: number): { x: number; z: number; side: Side } {
  let c = socketCell(def, sk);
  let w = def.w;
  let d = def.d;
  for (let i = 0; i < r; i++) {
    // A quarter turn: (x, z) in a w x d footprint goes to (d - 1 - z, x) in a d x w one.
    c = { x: d - 1 - c.z, z: c.x };
    [w, d] = [d, w];
  }
  return { ...c, side: rotSide(sk.side, r) };
}

/** A point in the unrotated piece's metres, after r quarter turns (still relative to the footprint's corner). */
export function rotPoint(def: PieceDef, x: number, z: number, r: number): { x: number; z: number } {
  let W = def.w * CELL;
  let D = def.d * CELL;
  let p = { x, z };
  for (let i = 0; i < r; i++) {
    p = { x: D - p.z, z: p.x };
    [W, D] = [D, W];
  }
  return p;
}
