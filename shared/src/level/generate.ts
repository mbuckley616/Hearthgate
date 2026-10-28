import type { HandFloor } from './handmade';
import { CELL, KIT, OPPOSITE, SIDE_DIR, rotSide, rotSize, rotSocket, type PieceKind, type Side } from './kit';

/**
 * The dungeon generator (T4). A floor grows from its entrance by fitting kit pieces (kit.ts) to
 * open doorways, branching from anywhere on the floor rather than only from the newest piece, then
 * closes loops wherever two open doorways at the same height can be joined by a short hall, puts
 * the exit (a rest room, or the Warden's hall on the last floor) at the far end, and fills up to the
 * piece count with side rooms. Staircases change the floor's height on the way.
 *
 * Seeded and pure: the server and every browser build the same floor from the same spec, so a
 * snapshot never has to carry the layout.
 */

/** What a floor is generated from. Everything the shape depends on is here, never in tuning. */
export interface FloorSpec {
  seed: number;
  /** Pieces wanted, 10 to 50 (decisions.md, 27 Oct). */
  pieces: number;
  /** 1-based floor of the run, and how many the run has: the last ends in the Warden's hall, the others in a rest room. */
  floor: number;
  floors: number;
  /** A hand-built floor (T4b, handmade.ts): its pieces as laid out in the editor, instead of a seed's. */
  hand?: HandFloor;
}

export interface PlacedSocket {
  /** The cell the doorway opens from, and the side it faces. */
  cx: number;
  cz: number;
  side: Side;
  /** Height in staircase steps (STEP_H). */
  level: number;
  /** The piece and socket on the other side, or -1 (then the doorway is walled up). */
  link: number;
  linkSocket: number;
}

export interface Piece {
  id: number;
  kind: PieceKind;
  /** North-west cell, quarter turns, size in cells after turning. */
  gx: number;
  gz: number;
  rot: number;
  w: number;
  d: number;
  /** The floor's height in steps (a staircase's lower end). */
  level: number;
  sockets: PlacedSocket[];
  /** Enemies wait here, and the doors close behind the party. */
  fight: boolean;
}

export interface FloorDef {
  spec: FloorSpec;
  pieces: Piece[];
  entrance: number;
  /** The rest room or the Warden's hall. */
  exit: number;
}

export const MIN_PIECES = 10;
export const MAX_PIECES = 50;
/** Heights stay within this many steps of the entrance either way. */
const MAX_LEVEL = 3;

/** The seeded generator's own random numbers (mulberry32, as the sim's nextRandom). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A floor's seed from the run's seed and the floor number, so each floor of a run differs. */
export function floorSeed(runSeed: number, floor: number): number {
  return (Math.imul(runSeed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(floor, 0xc2b2ae35)) >>> 0;
}

/** Which pieces may grow from a doorway: halls and stairs off a room, rooms more often off a hall. */
const FROM_ROOM: [PieceKind, number][] = [
  ['hall', 3],
  ['hallLong', 3],
  ['corner', 2],
  ['tee', 2],
  ['cross', 0.8],
  ['stair', 3],
];
const FROM_HALL: [PieceKind, number][] = [
  ['hall', 1.2],
  ['hallLong', 1],
  ['corner', 1.8],
  ['tee', 1.4],
  ['cross', 0.6],
  ['stair', 1.6],
  // The rooms sized for a party of four (D2); the smaller kit rooms are the editor's.
  ['guard', 3],
  ['pillared', 2.4],
  ['greatHall', 1.4],
  ['cavern', 0.7],
];
/** At most this many of the big rooms on one floor. */
const CAP: Partial<Record<PieceKind, number>> = { cavern: 1, greatHall: 3 };
/** Connectors to try when the first pick does not fit. */
const FALLBACK: PieceKind[] = ['corner', 'hall', 'stair', 'tee'];

interface Open {
  p: number;
  s: number;
}

class Builder {
  readonly pieces: Piece[] = [];
  private readonly cells = new Map<string, number>();
  /** Doorways nothing fits against; they stay walled. */
  private readonly dead = new Set<string>();

  constructor(private readonly rnd: () => number) {}

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }

  occupant(x: number, z: number): number {
    return this.cells.get(this.key(x, z)) ?? -1;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  pick(weights: [PieceKind, number][]): PieceKind {
    const ok = weights.filter(([k]) => CAP[k] === undefined || this.count(k) < CAP[k]!);
    const total = ok.reduce((t, [, w]) => t + w, 0);
    let r = this.rnd() * total;
    for (const [k, w] of ok) if ((r -= w) <= 0) return k;
    return ok[ok.length - 1][0];
  }

  count(kind: PieceKind): number {
    return this.pieces.filter((p) => p.kind === kind).length;
  }

  place(kind: PieceKind, rot: number, gx: number, gz: number, level: number): Piece {
    const def = KIT[kind];
    const size = rotSize(def, rot);
    const piece: Piece = {
      id: this.pieces.length,
      kind,
      gx,
      gz,
      rot,
      w: size.w,
      d: size.d,
      level,
      sockets: def.sockets.map((sk) => {
        const rs = rotSocket(def, sk, rot);
        return { cx: gx + rs.x, cz: gz + rs.z, side: rs.side, level: level + sk.rise, link: -1, linkSocket: -1 };
      }),
      fight: false,
    };
    this.pieces.push(piece);
    for (let x = 0; x < size.w; x++) for (let z = 0; z < size.d; z++) this.cells.set(this.key(gx + x, gz + z), piece.id);
    return piece;
  }

  fits(kind: PieceKind, rot: number, gx: number, gz: number): boolean {
    const size = rotSize(KIT[kind], rot);
    for (let x = 0; x < size.w; x++) for (let z = 0; z < size.d; z++) if (this.cells.has(this.key(gx + x, gz + z))) return false;
    return true;
  }

  link(a: number, sa: number, b: number, sb: number): void {
    const A = this.pieces[a].sockets[sa];
    const B = this.pieces[b].sockets[sb];
    A.link = b;
    A.linkSocket = sb;
    B.link = a;
    B.linkSocket = sa;
  }

  /** The cell a doorway opens into. */
  outward(o: Open): { x: number; z: number } {
    const sk = this.pieces[o.p].sockets[o.s];
    const d = SIDE_DIR[sk.side];
    return { x: sk.cx + d.x, z: sk.cz + d.z };
  }

  openSockets(): Open[] {
    const out: Open[] = [];
    for (const p of this.pieces) p.sockets.forEach((sk, s) => sk.link < 0 && !this.dead.has(`${p.id}:${s}`) && out.push({ p: p.id, s }));
    return out;
  }

  kill(o: Open): void {
    this.dead.add(`${o.p}:${o.s}`);
  }

  /** Fit a piece of this kind to an open doorway, in any turn and through any of its own doorways. */
  attach(kind: PieceKind, o: Open): Piece | null {
    const t = this.pieces[o.p].sockets[o.s];
    const out = this.outward(o);
    if (this.occupant(out.x, out.z) >= 0) return null;
    const def = KIT[kind];
    const maxRise = Math.max(...def.sockets.map((sk) => sk.rise));
    for (const r of this.shuffle([0, 1, 2, 3])) {
      for (const si of this.shuffle(def.sockets.map((_, i) => i))) {
        const rs = rotSocket(def, def.sockets[si], r);
        if (rs.side !== OPPOSITE[t.side]) continue;
        const gx = out.x - rs.x;
        const gz = out.z - rs.z;
        const level = t.level - def.sockets[si].rise;
        if (level < -MAX_LEVEL || level + maxRise > MAX_LEVEL) continue;
        if (!this.fits(kind, r, gx, gz)) continue;
        const piece = this.place(kind, r, gx, gz, level);
        this.link(o.p, o.s, piece.id, si);
        return piece;
      }
    }
    return null;
  }

  /** Take a piece out (a dead-end hall), renumbering the rest. */
  remove(id: number): void {
    const gone = this.pieces[id];
    for (const sk of gone.sockets) {
      if (sk.link < 0) continue;
      const other = this.pieces[sk.link].sockets[sk.linkSocket];
      other.link = -1;
      other.linkSocket = -1;
    }
    this.pieces.splice(id, 1);
    for (const p of this.pieces) {
      if (p.id > id) p.id--;
      for (const sk of p.sockets) if (sk.link > id) sk.link--;
    }
    this.cells.clear();
    for (const p of this.pieces) for (let x = 0; x < p.w; x++) for (let z = 0; z < p.d; z++) this.cells.set(this.key(p.gx + x, p.gz + z), p.id);
    const dead = [...this.dead].map((k) => k.split(':').map(Number));
    this.dead.clear();
    for (const [p, s] of dead) if (p !== id) this.dead.add(`${p > id ? p - 1 : p}:${s}`);
  }

  /**
   * No hall leads nowhere: a connector with one way in and no way on gets a small room at its end
   * if one fits (and the floor has room for it), or goes. Repeats until every connector leads on.
   */
  tidy(maxPieces: number): void {
    for (;;) {
      const stub = this.pieces.find((p) => !KIT[p.kind].room && p.kind !== 'entrance' && p.kind !== 'rest' && p.sockets.filter((sk) => sk.link >= 0).length <= 1);
      if (!stub) return;
      const capped =
        this.pieces.length < maxPieces &&
        stub.sockets.some((sk, s) => sk.link < 0 && (this.attach('guard', { p: stub.id, s }) ?? this.attach('small', { p: stub.id, s })) !== null);
      if (!capped) this.remove(stub.id);
    }
  }

  /** Steps between pieces through linked doorways, from one piece. */
  distances(from: number): number[] {
    const dist = this.pieces.map(() => Infinity);
    dist[from] = 0;
    const queue = [from];
    while (queue.length) {
      const p = queue.shift()!;
      for (const sk of this.pieces[p].sockets) {
        if (sk.link >= 0 && dist[sk.link] === Infinity) {
          dist[sk.link] = dist[p] + 1;
          queue.push(sk.link);
        }
      }
    }
    return dist;
  }

  /** Grow one piece from a doorway picked across the whole floor; false when nothing fits anywhere. */
  grow(exclude: Set<number>, forceStair: boolean): boolean {
    const open = this.openSockets().filter((o) => !exclude.has(o.p));
    if (open.length === 0) return false;
    // Mostly the newest pieces' doorways (paths run on), often any doorway at all (branches).
    const newest = Math.max(...open.map((o) => o.p));
    const recent = open.filter((o) => o.p >= newest - 2);
    const o = this.rnd() < 0.55 ? recent[Math.floor(this.rnd() * recent.length)] : open[Math.floor(this.rnd() * open.length)];
    const fromRoom = KIT[this.pieces[o.p].kind].room || this.pieces[o.p].kind === 'entrance';
    const first: PieceKind = forceStair ? 'stair' : this.pick(fromRoom ? FROM_ROOM : FROM_HALL);
    for (const kind of [first, ...FALLBACK.filter((k) => k !== first)]) {
      if (this.attach(kind, o)) return true;
    }
    this.kill(o);
    return true;
  }

  /**
   * Join open doorways at the same height that are far apart on the floor's graph: directly when
   * they face each other, else by a path of up to five halls and corners through empty cells.
   * Returns how many loops it closed.
   */
  closeLoops(want: number, maxPieces: number): number {
    let loops = 0;
    for (const a of this.shuffle(this.openSockets())) {
      if (loops >= want) break;
      const A = this.pieces[a.p].sockets[a.s];
      if (A.link >= 0) continue;
      const start = this.outward(a);
      const dist = this.distances(a.p);
      const occ = this.occupant(start.x, start.z);
      if (occ >= 0) {
        const b = this.pieces[occ].sockets.findIndex(
          (sk) => sk.link < 0 && sk.cx === start.x && sk.cz === start.z && sk.side === OPPOSITE[A.side] && sk.level === A.level,
        );
        if (b >= 0 && occ !== a.p) {
          this.link(a.p, a.s, occ, b);
          loops++;
        }
        continue;
      }
      // Open doorways by the cell they open into.
      const targets = new Map<string, Open[]>();
      for (const o of this.openSockets()) {
        if (o.p === a.p) continue;
        const sk = this.pieces[o.p].sockets[o.s];
        if (sk.level !== A.level || dist[o.p] < 4) continue;
        const c = this.outward(o);
        const k = `${c.x},${c.z}`;
        targets.set(k, [...(targets.get(k) ?? []), o]);
      }
      if (targets.size === 0) continue;
      const path = this.findPath(start, targets, 6);
      if (!path || this.pieces.length + path.cells.length > maxPieces) continue;
      this.layPath(a, path.cells, path.to, A.level);
      loops++;
    }
    return loops;
  }

  private findPath(start: { x: number; z: number }, targets: Map<string, Open[]>, maxLen: number): { cells: { x: number; z: number }[]; to: Open } | null {
    const prev = new Map<string, string | null>([[`${start.x},${start.z}`, null]]);
    let frontier = [start];
    for (let len = 1; len <= maxLen && frontier.length; len++) {
      const next: { x: number; z: number }[] = [];
      for (const c of frontier) {
        const k = `${c.x},${c.z}`;
        const hit = targets.get(k);
        if (hit) {
          const cells: { x: number; z: number }[] = [];
          for (let at: string | null = k; at !== null; at = prev.get(at)!) {
            const [x, z] = at.split(',').map(Number);
            cells.unshift({ x, z });
          }
          return { cells, to: hit[0] };
        }
        for (const side of ['n', 'e', 's', 'w'] as Side[]) {
          const n = { x: c.x + SIDE_DIR[side].x, z: c.z + SIDE_DIR[side].z };
          const nk = `${n.x},${n.z}`;
          if (prev.has(nk) || this.occupant(n.x, n.z) >= 0) continue;
          prev.set(nk, k);
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  }

  /** Lay one-cell halls and corners along a path of cells from doorway `a` to doorway `to`. */
  private layPath(a: Open, cells: { x: number; z: number }[], to: Open, level: number): void {
    const sideTo = (from: { x: number; z: number }, toCell: { x: number; z: number }): Side =>
      (['n', 'e', 's', 'w'] as Side[]).find((sd) => from.x + SIDE_DIR[sd].x === toCell.x && from.z + SIDE_DIR[sd].z === toCell.z)!;
    let prevPiece = a.p;
    let prevSocket = a.s;
    cells.forEach((c, i) => {
      const enter = i === 0 ? OPPOSITE[this.pieces[a.p].sockets[a.s].side] : sideTo(c, cells[i - 1]);
      const exit = i === cells.length - 1 ? OPPOSITE[this.pieces[to.p].sockets[to.s].side] : sideTo(c, cells[i + 1]);
      const kind: PieceKind = OPPOSITE[enter] === exit ? 'hall' : 'corner';
      const def = KIT[kind];
      const rot = [0, 1, 2, 3].find((r) => {
        const sides = def.sockets.map((sk) => rotSide(sk.side, r));
        return sides.includes(enter) && sides.includes(exit);
      })!;
      const piece = this.place(kind, rot, c.x, c.z, level);
      const inIdx = piece.sockets.findIndex((sk) => sk.side === enter);
      const outIdx = piece.sockets.findIndex((sk) => sk.side === exit);
      this.link(prevPiece, prevSocket, piece.id, inIdx);
      prevPiece = piece.id;
      prevSocket = outIdx;
    });
    this.link(prevPiece, prevSocket, to.p, to.s);
  }
}

/** How many loops a floor of this many pieces should have: one for a small floor, up to four for a big one. */
function loopsWanted(pieces: number): number {
  return Math.min(4, 1 + Math.floor(pieces / 14));
}

/** Count of independent loops in the floor's graph (links minus pieces plus one). */
export function loopCount(def: FloorDef): number {
  let links = 0;
  for (const p of def.pieces) for (const sk of p.sockets) if (sk.link >= 0) links++;
  return links / 2 - def.pieces.length + 1;
}

/** One try at a floor; null if it came out short of what a floor must have. */
function attempt(spec: FloorSpec, seed: number): FloorDef | null {
  const target = Math.max(MIN_PIECES, Math.min(MAX_PIECES, Math.round(spec.pieces)));
  const rnd = seeded(seed);
  const b = new Builder(rnd);
  const entrance = b.place('entrance', 0, 0, 0, 0);
  const wantLoops = loopsWanted(target);
  // Leave room for the exit and the halls that close loops; fill the rest after.
  const growTo = target - 1 - Math.min(wantLoops * 2, Math.floor(target * 0.2));
  const none = new Set<number>();
  while (b.pieces.length < growTo) {
    const forceStair = b.count('stair') === 0 && b.pieces.length >= Math.floor(growTo / 2);
    if (!b.grow(none, forceStair)) break;
  }

  // The exit goes at the far end, as far from the way in as a doorway allows.
  const final = spec.floor >= spec.floors;
  const exitKind: PieceKind = final ? 'boss' : 'rest';
  const dist = b.distances(entrance.id);
  const candidates = b
    .openSockets()
    .filter((o) => dist[o.p] < Infinity)
    .sort((x, y) => dist[y.p] - dist[x.p]);
  let exit: Piece | null = null;
  for (const o of candidates.slice(0, 16)) if ((exit = b.attach(exitKind, o))) break;
  if (!exit) return null;

  b.closeLoops(wantLoops, target);
  const keep = new Set([exit.id, entrance.id]);
  while (b.pieces.length < target) if (!b.grow(keep, b.count('stair') === 0)) break;
  b.tidy(Math.min(MAX_PIECES, target + 2));
  const exitId = b.pieces.findIndex((p) => p.kind === exitKind);

  for (const p of b.pieces) {
    const def = KIT[p.kind];
    // Most rooms are fought in; now and then a guard room stands empty, a breather on the way.
    p.fight = def.room && ((p.kind !== 'small' && p.kind !== 'guard') || rnd() < 0.7);
  }
  // Heights start at the floor's lowest point, so every height is ground the sim already knows (0 and up).
  const low = Math.min(...b.pieces.map((p) => p.level));
  for (const p of b.pieces) {
    p.level -= low;
    for (const sk of p.sockets) sk.level -= low;
  }
  const def: FloorDef = { spec, pieces: b.pieces, entrance: 0, exit: exitId };
  const n = b.pieces.length;
  const enough = n >= Math.max(MIN_PIECES, target - 3) && n <= Math.min(MAX_PIECES, target + 2);
  // A staircase counts only if it joins two pieces: the floor really climbs or drops somewhere.
  const climbs = b.pieces.some((p) => p.kind === 'stair' && p.sockets.every((sk) => sk.link >= 0));
  const loops = loopCount(def) >= (target >= 14 ? 1 : 0);
  return enough && climbs && loops ? def : null;
}

/**
 * The floor for a spec. Tries the spec's seed and, if a try comes out short (no room for the exit,
 * no staircase, no loop on a floor big enough for one), the next seeds after it, so the same spec
 * always gives the same floor.
 */
export function generateFloor(spec: FloorSpec): FloorDef {
  for (let i = 0; i < 64; i++) {
    const def = attempt(spec, (spec.seed + Math.imul(i, 0x9e3779b1)) >>> 0);
    if (def) return def;
  }
  throw new Error(`no floor for seed ${spec.seed} with ${spec.pieces} pieces`);
}

/** A piece's footprint in metres. */
export function pieceBounds(p: Piece): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return { minX: p.gx * CELL, maxX: (p.gx + p.w) * CELL, minZ: p.gz * CELL, maxZ: (p.gz + p.d) * CELL };
}
