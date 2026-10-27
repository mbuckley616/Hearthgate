import { MAX_PIECES, type FloorDef, type FloorSpec, type Piece } from './generate';
import { KIT, OPPOSITE, SIDE_DIR, rotSize, rotSocket, type PieceKind } from './kit';

/**
 * Hand-built dungeons (T4b, decisions.md 27 Oct): floors laid out piece by piece in the editor
 * instead of grown by the generator, one to five of them a dungeon, and a run through it is exactly
 * those floors (Michael's playtest, 27 Oct: a hand-built dungeon has floors of its own). Only the placements are stored (which piece, where, which way,
 * how high); doorways join wherever two face each other at one height, exactly as the generator
 * joins them, so a hand-built floor is the same FloorDef and plays through the same code.
 *
 * Saved in the browser and exported as a file; a file committed to `dungeons/` ships to everyone.
 * The server checks every one it is sent (checkHandDungeon) before a room is made from it.
 */
export interface HandPiece {
  kind: PieceKind;
  /** North-west cell, quarter turns, and height in staircase steps (a staircase's lower end). */
  gx: number;
  gz: number;
  rot: number;
  level: number;
}

/** One floor as a FloorSpec carries it: the dungeon's name and that floor's pieces. */
export interface HandFloor {
  name: string;
  pieces: HandPiece[];
}

/** A hand-built dungeon: its floors in order, the first where the party arrives. */
export interface HandDungeon {
  name: string;
  floors: { pieces: HandPiece[] }[];
}

/** A run is 3 to 5 floors (decisions.md, 27 Oct); a hand-built one may be shorter. */
export const HAND_MAX_FLOORS = 5;

/** The editor's grid runs this many cells each way from the origin. */
export const HAND_EXTENT = 30;
/** Staircase steps a hand-built floor may climb above its lowest piece. */
export const HAND_MAX_LEVEL = 8;
export const HAND_NAME_MAX = 32;

/** Kinds a hand-built floor can use: the whole kit. */
export const HAND_KINDS = Object.keys(KIT) as PieceKind[];

/** What is wrong with a layout, in words for the editor; empty when it can be played. */
export interface DungeonCheck {
  def: FloorDef | null;
  /** The pieces with their doorways joined, in the layout's own cells (the editor draws these, playable or not). */
  joined: Piece[];
  errors: string[];
  /** Not wrong, worth knowing: doorways walled up because nothing meets them. */
  notes: string[];
}

const where = (p: HandPiece) => `${KIT[p.kind].title.toLowerCase()} at ${p.gx}, ${p.gz}`;

function readPieces(list: unknown): HandPiece[] | null {
  if (!Array.isArray(list) || list.length > MAX_PIECES) return null;
  const pieces: HandPiece[] = [];
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (!HAND_KINDS.includes(p.kind as PieceKind)) return null;
    const ints = [p.gx, p.gz, p.rot, p.level];
    if (!ints.every((n) => typeof n === 'number' && Number.isInteger(n))) return null;
    const [gx, gz, rot, level] = ints as number[];
    if (Math.abs(gx) > HAND_EXTENT || Math.abs(gz) > HAND_EXTENT || rot < 0 || rot > 3 || level < 0 || level > HAND_MAX_LEVEL) return null;
    pieces.push({ kind: p.kind as PieceKind, gx, gz, rot, level });
  }
  return pieces;
}

/**
 * A clean copy of a dungeon from anywhere (a file, a message), or null if it is not one. Numbers are
 * whole, names short. A one-floor file from before floors (`{ name, pieces }`) reads as one floor.
 */
export function readDungeon(v: unknown): HandDungeon | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.name !== 'string') return null;
  const lists = Array.isArray(o.floors) ? o.floors.map((fl) => (typeof fl === 'object' && fl !== null ? (fl as Record<string, unknown>).pieces : null)) : [o.pieces];
  if (lists.length < 1 || lists.length > HAND_MAX_FLOORS) return null;
  const floors: { pieces: HandPiece[] }[] = [];
  for (const list of lists) {
    const pieces = readPieces(list);
    if (!pieces) return null;
    floors.push({ pieces });
  }
  const name = o.name.replace(/[^\w \-',.!?]/g, '').trim().slice(0, HAND_NAME_MAX);
  return { name: name || 'Unnamed', floors };
}

/** Floor `n` (1-based) of a dungeon, as a FloorSpec carries it. */
export function handFloor(d: HandDungeon, n: number): HandFloor {
  return { name: d.name, pieces: d.floors[n - 1].pieces };
}

/** Every floor checked, and what keeps the dungeon as a whole from play. */
export interface HandDungeonCheck {
  floors: DungeonCheck[];
  errors: string[];
  playable: boolean;
}

/**
 * Check a whole dungeon: each floor on its own (checkDungeon), and every floor but the last ending
 * in a rest room, whose violet ring leads to the next. The last ends in the Warden's hall, or in a
 * rest room with only the ring home.
 */
export function checkHandDungeon(d: HandDungeon): HandDungeonCheck {
  const n = d.floors.length;
  const floors = d.floors.map((_, i) => checkDungeon(handFloor(d, i + 1), i + 1, n));
  const errors: string[] = [];
  d.floors.forEach((fl, i) => {
    if (i < n - 1 && fl.pieces.some((p) => p.kind === 'boss')) errors.push(`Floor ${i + 1} ends at the Warden’s hall, so nothing comes after it: only the last floor can. A rest room leads on.`);
  });
  return { floors, errors, playable: errors.length === 0 && floors.every((c) => c.def !== null) };
}

/**
 * Join a layout's doorways and check it can be played: one entrance, one way out (a rest room, or
 * the Warden's hall to end the run), no two pieces in one cell, every piece reachable from the
 * entrance. Returns the floor, or the reasons it is not one yet.
 */
export function checkDungeon(hand: HandFloor, floor = 1, floors = 1): DungeonCheck {
  const errors: string[] = [];
  const notes: string[] = [];
  const cells = new Map<string, number>();
  const pieces: Piece[] = hand.pieces.map((h, id) => {
    const def = KIT[h.kind];
    const size = rotSize(def, h.rot);
    for (let x = 0; x < size.w; x++)
      for (let z = 0; z < size.d; z++) {
        const k = `${h.gx + x},${h.gz + z}`;
        const other = cells.get(k);
        if (other !== undefined) errors.push(`The ${where(h)} overlaps the ${where(hand.pieces[other])}.`);
        else cells.set(k, id);
      }
    return {
      id,
      kind: h.kind,
      gx: h.gx,
      gz: h.gz,
      rot: h.rot,
      w: size.w,
      d: size.d,
      level: h.level,
      sockets: def.sockets.map((sk) => {
        const rs = rotSocket(def, sk, h.rot);
        return { cx: h.gx + rs.x, cz: h.gz + rs.z, side: rs.side, level: h.level + sk.rise, link: -1, linkSocket: -1 };
      }),
      fight: def.room,
    };
  });
  if (hand.pieces.length > MAX_PIECES) errors.push(`At most ${MAX_PIECES} pieces (this has ${hand.pieces.length}).`);

  // Doorways meet where one opens into the other's cell, facing back, at the same height.
  let walled = 0;
  let mismatched = 0;
  for (const p of pieces) {
    p.sockets.forEach((sk, s) => {
      if (sk.link >= 0) return;
      const d = SIDE_DIR[sk.side];
      const q = cells.get(`${sk.cx + d.x},${sk.cz + d.z}`);
      if (q === undefined || q === p.id) return void walled++;
      const t = pieces[q].sockets.findIndex((o) => o.link < 0 && o.cx === sk.cx + d.x && o.cz === sk.cz + d.z && o.side === OPPOSITE[sk.side]);
      if (t < 0) return void walled++;
      if (pieces[q].sockets[t].level !== sk.level) return void mismatched++;
      sk.link = q;
      sk.linkSocket = t;
      pieces[q].sockets[t].link = p.id;
      pieces[q].sockets[t].linkSocket = s;
    });
  }
  if (mismatched) notes.push(`${mismatched / 2} doorway${mismatched === 2 ? '' : 's'} meet${mismatched === 2 ? 's' : ''} a neighbour at another height, so ${mismatched === 2 ? 'it is' : 'they are'} walled up.`);
  if (walled) notes.push(`${walled} doorway${walled === 1 ? '' : 's'} open${walled === 1 ? 's' : ''} onto nothing and ${walled === 1 ? 'is' : 'are'} walled up.`);

  const entrances = pieces.filter((p) => p.kind === 'entrance');
  const exits = pieces.filter((p) => p.kind === 'rest' || p.kind === 'boss');
  if (entrances.length !== 1) errors.push(entrances.length ? 'Only one entrance, please.' : 'Place an entrance: the party arrives there.');
  if (exits.length !== 1) errors.push(exits.length ? 'Only one way out: one rest room or one Warden’s hall.' : 'Place a rest room (rings deeper and home) or the Warden’s hall (ends the run).');

  if (entrances.length === 1) {
    const seen = new Set([entrances[0].id]);
    const queue = [entrances[0].id];
    while (queue.length) for (const sk of pieces[queue.shift()!].sockets) if (sk.link >= 0 && !seen.has(sk.link)) seen.add(sk.link), queue.push(sk.link);
    for (const p of pieces) if (!seen.has(p.id)) errors.push(`The ${where(hand.pieces[p.id])} can’t be reached from the entrance.`);
  }
  if (errors.length) return { def: null, joined: pieces, errors, notes };
  const joined = structuredClone(pieces);

  // Heights start at the lowest piece, as the generator's do.
  const low = Math.min(...pieces.map((p) => p.level));
  for (const p of pieces) {
    p.level -= low;
    for (const sk of p.sockets) sk.level -= low;
  }
  // The pieces as one moves them onto the grid's origin: the entrance's corner is (0, 0), as a generated floor's is.
  const e = entrances[0];
  const ox = e.gx;
  const oz = e.gz;
  for (const p of pieces) {
    p.gx -= ox;
    p.gz -= oz;
    for (const sk of p.sockets) {
      sk.cx -= ox;
      sk.cz -= oz;
    }
  }
  const spec: FloorSpec = { seed: 0, pieces: pieces.length, floor, floors, hand };
  return { def: { spec, pieces, entrance: e.id, exit: exits[0].id }, joined, errors, notes };
}
