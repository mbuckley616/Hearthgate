import type { LevelDef, Surface, World } from './arena';
import type { Collider } from './geometry';
import { generateFloor, pieceBounds, type FloorDef, type FloorSpec, type Piece } from './generate';
import { checkDungeon } from './handmade';
import { lavaFor, type LavaStrip } from './lava';
import { bladesFor, crumbleCollider, crumbleFor, CRUMBLE_SIZE, spikesFor, SPIKE_SIZE, type BladeTrap, type CrumbleTile, type SpikeTile } from './traps';
import type { BoxCollider } from './geometry';
import { daisesFor, daisRect, daisSurfaces, rectDistance, sarcCollider, sarcophagiFor, sarcRect, type Dais, type Sarcophagus } from './setPieces';
import { secretsFor, secretWalls, treasureFor, type SecretRoom, type TreasureRoom } from './secrets';
import { CELL, DOOR_H, DOOR_W, KIT, LANDING, OPPOSITE, SIDE_DIR, STEP_H, WALL_H, WALL_T, rotPoint, rotSide, type Side } from './kit';

/**
 * A generated floor as a level (T4): the generator's pieces (generate.ts) turned into what the
 * slice's sim reads, the arena's LevelDef and World. Like the village it fills the arena's fields
 * so the sim runs unchanged where it can: no ledge (its height is out of reach, so no enemy ever
 * counts as on it), no ramps for the enemies' ledge paths, no antechamber, and a start line off
 * the map, so the slice's run never starts. The floor's own run (sim/floorRun.ts) reads `dungeon`.
 *
 * Every wall, pillar and gate stands from y = 0, under a raised room as well as in it, so a
 * collider's height range never matters and a raised room is a solid block with a walkable top.
 */

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A doorway as built: where its gap is, which way it faces, and its floor height. */
export interface Door {
  x: number;
  z: number;
  side: Side;
  y: number;
  /** Joined to a neighbour (an open gap), or walled up. */
  open: boolean;
}

/** What the sim and the views need about each piece, worked out once from the generator's numbers. */
export interface PieceInfo {
  id: number;
  kind: Piece['kind'];
  title: string;
  bounds: Rect;
  /** Inside the walls. */
  inner: Rect;
  /** Floor height (a staircase: its lower end), and its upper end (the same for a flat piece). */
  y: number;
  top: number;
  fight: boolean;
  doors: Door[];
  /** Where enemies may appear: open floor away from walls, pillars and doorways. */
  spots: { x: number; z: number }[];
  pillars: { x: number; z: number; radius: number }[];
  braziers: { x: number; z: number }[];
  /** A staircase's ramp: its rect and the side it climbs toward. */
  ramp: (Rect & { up: Side }) | null;
  /** The rest room's two rings: deeper, then home (game/portal.ts). */
  rings: { x: number; z: number }[];
  /** Solid masonry inside the walls (G5's B: the round chamber's corners), drawn and collided as wall. */
  blocks: Rect[];
  /** The L-room's point out from its inside corner (kit.ts `elbow`). */
  elbow?: { x: number; z: number };
}

/** Is (x, z) within `margin` of any of the piece's masonry? */
export function nearBlock(info: PieceInfo, x: number, z: number, margin: number): boolean {
  return info.blocks.some((r) => rectDistance(r, x, z) < margin);
}

export interface FloorLayout {
  def: FloorDef;
  pieces: PieceInfo[];
  /** Wall torches, (x, z) on the wall's inner face, facing into the piece. */
  torches: { x: number; y: number; z: number; facingYawDeg: number }[];
  bounds: Rect;
  /** Things to smash (D4), by id: placed from the floor's seed, so every browser has the same. */
  props: PropInfo[];
  /** Rooms that need jumping (D6): strips of lava in at most one fight room, from the floor's seed. */
  lava: LavaStrip[];
  /** Traps (G5): spike tiles in some fight rooms and long halls, from the floor's seed. */
  spikes: SpikeTile[];
  /** Swinging blades in some halls (G5). */
  blades: BladeTrap[];
  /** Collapsing tiles in some fight rooms (G5), and each one's hole as a wall once it has fallen. */
  crumble: CrumbleTile[];
  crumbleWalls: BoxCollider[];
  /** Set pieces (G5's B): rows of stone tombs in some big fight rooms, cover from bows and casters. */
  sarcophagi: Sarcophagus[];
  /** A dais raised in two steps in the middle of some big fight rooms (G5's B). */
  daises: Dais[];
  /** Secret rooms behind cracked walls (G5's C). */
  secrets: SecretRoom[];
  /** A treasure room off a hall on the main way, at most one (G5's C). */
  treasure: TreasureRoom[];
  /** Everything a blow can break: the props, then each secret's crack and chest, then the treasure rooms' chests. */
  smashable: PropInfo[];
}

/** The floor's own props, and a secret room's crack and chest (G5's C, `secrets.ts`). */
export type PropKind = 'crate' | 'barrel' | 'urn' | 'crack' | 'chest';

/** A crate, barrel or urn against a wall (D4). Which ones are broken is the sim's (`SimState.floor.broken`). */
export interface PropInfo {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  yaw: number;
  piece: number;
  /** Facing out from its wall into the piece (radians, yaw 0 faces +z): where a smash sprays what it held. */
  inward: number;
  /** The piece's open floor, which a spray never throws past. */
  room: Rect;
}

/** The floor generated from a spec, as a level the sim runs. */
export function floorLevel(spec: FloorSpec): LevelDef {
  if (!spec.hand) return levelFromFloor(generateFloor(spec));
  // A hand-built floor was checked before its room was made; one that fails here was never sent.
  const checked = checkDungeon(spec.hand, spec.floor, spec.floors);
  if (!checked.def) throw new Error(`not a playable dungeon: ${checked.errors.join(' ')}`);
  // The check knows only the floor; what Wren's menu chose rides on the spec it was given, and the
  // browser's story unlock and the room's budget read it from the level.
  const { difficulty, story, modifier } = spec;
  const chosen = { ...(difficulty !== undefined ? { difficulty } : {}), ...(story ? { story } : {}), ...(modifier ? { modifier } : {}) };
  return levelFromFloor({ ...checked.def, spec: { ...checked.def.spec, ...chosen } });
}

/** Whether (x, z) is in a strip's band across the whole room, `margin` either side: the strip and its walkway. */
function inLavaBand(l: LavaStrip, x: number, z: number, margin: number): boolean {
  return l.maxZ - l.minZ <= l.maxX - l.minX ? z > l.minZ - margin && z < l.maxZ + margin : x > l.minX - margin && x < l.maxX + margin;
}

/** A lava room's banner when its doors close. */
export const LAVA_TITLE = 'A hall of embers';
/** A room with tomb rows (G5's B). */
export const TOMBS_TITLE = 'A hall of tombs';
/** A room with a dais (G5's B). */
export const DAIS_TITLE = 'The raised dais';

/** Facing into the piece from a wall on this side (yaw 0 faces +z, the slice's convention). */
const INWARD_YAW: Record<Side, number> = { n: 0, s: 180, w: 90, e: -90 };

export function levelFromFloor(def: FloorDef): LevelDef {
  const pieces = def.pieces.map(pieceInfo);
  const torches: FloorLayout['torches'] = [];
  for (const info of pieces) torches.push(...torchesFor(info, def.pieces[info.id]));
  const lava = lavaFor(def, pieces);
  if (lava.length) {
    const room = pieces[lava[0].piece];
    room.title = LAVA_TITLE;
    // Nobody wakes standing in it.
    room.spots = room.spots.filter((sp) => !lava.some((l) => sp.x > l.minX - 1 && sp.x < l.maxX + 1 && sp.z > l.minZ - 1 && sp.z < l.maxZ + 1));
  }
  const spikes = spikesFor(def, pieces, lava);
  // Nobody wakes standing on spikes either.
  for (const t of spikes) {
    const room = pieces[t.piece];
    room.spots = room.spots.filter((sp) => Math.abs(sp.x - t.x) > SPIKE_SIZE / 2 + 0.6 || Math.abs(sp.z - t.z) > SPIKE_SIZE / 2 + 0.6);
  }
  const blades = bladesFor(def, pieces, spikes);
  const crumble = crumbleFor(def, pieces, lava, spikes);
  // Nobody wakes on a tile that will fall.
  for (const t of crumble) {
    const room = pieces[t.piece];
    room.spots = room.spots.filter((sp) => Math.abs(sp.x - t.x) > CRUMBLE_SIZE / 2 + 0.6 || Math.abs(sp.z - t.z) > CRUMBLE_SIZE / 2 + 0.6);
  }
  const crumbleWalls = crumble.map(crumbleCollider);
  const sarcophagi = sarcophagiFor(def, pieces, lava, spikes, crumble, openMiddle);
  // Nobody wakes inside a tomb, nor pressed against one.
  for (const t of sarcophagi) {
    const room = pieces[t.piece];
    room.title = TOMBS_TITLE;
    const r = sarcRect(t);
    room.spots = room.spots.filter((sp) => rectDistance(r, sp.x, sp.z) > 0.9);
  }
  // After the props' and tombs' places are settled, so adding it moved neither; it takes rooms without tombs.
  const daises = daisesFor(def, pieces, lava, spikes, crumble, sarcophagi);
  // Nobody wakes on its steps: a room's spots stay on its own floor, and the dais is the ground to take.
  for (const d of daises) {
    const room = pieces[d.piece];
    room.title = DAIS_TITLE;
    room.spots = room.spots.filter((sp) => rectDistance(daisRect(d), sp.x, sp.z) > 0.6);
  }
  const props: PropInfo[] = [];
  for (const info of pieces) propsFor(info, def.spec.seed, props, lava, spikes, sarcophagi);
  // After everything else is placed, so a seed builds the same floor with a crack in it as without.
  const secrets = secretsFor(def, pieces, lava, spikes, crumble, sarcophagi, daises);
  const treasure = treasureFor(def, pieces, secrets);
  const smashable = [...props, ...secrets.flatMap((sr) => [sr.crack, sr.chest]), ...treasure.map((t) => t.chest)];
  const bounds = {
    minX: Math.min(...pieces.map((p) => p.bounds.minX)),
    maxX: Math.max(...pieces.map((p) => p.bounds.maxX)),
    minZ: Math.min(...pieces.map((p) => p.bounds.minZ)),
    maxZ: Math.max(...pieces.map((p) => p.bounds.maxZ)),
  };
  const reach = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX), Math.abs(bounds.minZ), Math.abs(bounds.maxZ));
  const entrance = pieces[def.entrance];
  // The entrance's back wall (south, unturned) is behind the party; they face into the floor.
  const back = rotSide('s', def.pieces[def.entrance].rot);
  const ahead = SIDE_DIR[OPPOSITE[back]];
  const mid = { x: (entrance.inner.minX + entrance.inner.maxX) / 2, z: (entrance.inner.minZ + entrance.inner.maxZ) / 2 };
  return {
    floorSize: Math.ceil(reach * 2),
    wallHeight: WALL_H,
    wallThickness: WALL_T,
    pillars: [],
    // The ledge is out of reach: no enemy here is ever on it, so the archers' ledge rules never apply.
    ledge: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, height: 1e6 },
    ramps: [],
    antechamber: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    doorway: { minX: 0, maxX: 0, height: 0 },
    arenaEntryZ: -1e9,
    archerSpots: [],
    spawnPoints: pieces.flatMap((p) => p.spots),
    torches: [],
    braziers: [],
    banners: [],
    spawn: { x: mid.x - ahead.x * 3, z: mid.z - ahead.z * 3, yawDeg: (Math.atan2(ahead.x, ahead.z) * 180) / Math.PI },
    dungeon: { def, pieces, torches, bounds, props, lava, spikes, blades, crumble, crumbleWalls, sarcophagi, daises, secrets, treasure, smashable },
  };
}

function pieceInfo(p: Piece): PieceInfo {
  const def = KIT[p.kind];
  const b = pieceBounds(p);
  const inner = { minX: b.minX + WALL_T, maxX: b.maxX - WALL_T, minZ: b.minZ + WALL_T, maxZ: b.maxZ - WALL_T };
  const y = p.level * STEP_H;
  const top = Math.max(...p.sockets.map((sk) => sk.level)) * STEP_H;
  const at = (x: number, z: number) => {
    const r = rotPoint(def, x, z, p.rot);
    return { x: b.minX + r.x, z: b.minZ + r.z };
  };
  const doors: Door[] = p.sockets.map((sk) => {
    const cx = sk.cx * CELL + CELL / 2;
    const cz = sk.cz * CELL + CELL / 2;
    const half = CELL / 2 - WALL_T / 2;
    const off = { n: { x: 0, z: -half }, s: { x: 0, z: half }, e: { x: half, z: 0 }, w: { x: -half, z: 0 } }[sk.side];
    return { x: cx + off.x, z: cz + off.z, side: sk.side, y: sk.level * STEP_H, open: sk.link >= 0 };
  });
  const pillars = def.pillars.map((pl) => ({ ...at(pl.x, pl.z), radius: pl.radius }));
  const braziers = def.braziers.map((br) => at(br.x, br.z));
  let ramp: PieceInfo['ramp'] = null;
  if (p.kind === 'stair') {
    // Unrotated the stair climbs north: the ramp runs between a landing at each end.
    const a = at(WALL_T, LANDING);
    const c = at(CELL - WALL_T, def.d * CELL - LANDING);
    ramp = { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z), up: rotSide('n', p.rot) };
  }
  // Either side of the rest room's fire, facing its one door.
  const rings = p.kind === 'rest' ? [at(4.5, 7), at(13.5, 7)] : [];
  const blocks = (def.blocks ?? []).map((r) => {
    const a = at(r.minX, r.minZ);
    const c = at(r.maxX, r.maxZ);
    return { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z) };
  });
  const info: PieceInfo = { id: p.id, kind: p.kind, title: def.title, bounds: b, inner, y, top, fight: p.fight, doors, spots: [], pillars, braziers, ramp, rings, blocks };
  if (def.elbow) info.elbow = at(def.elbow.x, def.elbow.z);
  if (def.room || p.kind === 'rest' || p.kind === 'entrance') info.spots = spotsFor(info);
  return info;
}

/** Open floor on a 2.5 m grid: 2 m clear of the walls, clear of pillars and braziers, and away from every doorway. */
function spotsFor(info: PieceInfo): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const i = info.inner;
  for (let x = i.minX + 2; x <= i.maxX - 2 + 1e-6; x += 2.5) {
    for (let z = i.minZ + 2; z <= i.maxZ - 2 + 1e-6; z += 2.5) {
      if (info.pillars.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 1.4)) continue;
      if (info.braziers.some((b) => Math.hypot(b.x - x, b.z - z) < 1.8)) continue;
      if (nearBlock(info, x, z, 1.4)) continue;
      if (info.doors.some((d) => d.open && Math.hypot(d.x - x, d.z - z) < 3.8)) continue;
      out.push({ x, z });
    }
  }
  return out;
}

/** A prop's distance from the wall it stands against, and the gap along the wall between places for one (m). */
const PROP_INSET = 0.8;
const PROP_STEP = 2;
/** The share of places along a wall that get a prop: rooms more than halls. */
const PROP_ROOM_SHARE = 0.13;
const PROP_HALL_SHARE = 0.08;

/** A number in [0, 1) from the floor's seed, a piece and a place in it: the same in every browser and on the server. */
function propHash(seed: number, piece: number, k: number): number {
  let h = (seed ^ Math.imul(piece + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Crates, barrels and urns against a piece's inner walls (D4), clear of doorways, pillars and
 * braziers so they never block a way through. None on a staircase or in the rest room. They do not
 * block movement: standing against the walls, nobody needs to walk through them.
 */
function propsFor(info: PieceInfo, seed: number, out: PropInfo[], lava: readonly LavaStrip[], spikes: readonly SpikeTile[], tombs: readonly Sarcophagus[]): void {
  if (info.kind === 'stair' || info.kind === 'rest' || info.y !== info.top) return;
  const share = KIT[info.kind].room ? PROP_ROOM_SHARE : PROP_HALL_SHARE;
  const i = info.inner;
  let k = 0;
  for (const side of ['n', 'e', 's', 'w'] as Side[]) {
    const ns = side === 'n' || side === 's';
    const lo = (ns ? i.minX : i.minZ) + 0.9;
    const hi = (ns ? i.maxX : i.maxZ) - 0.9;
    for (let along = lo; along <= hi + 1e-6; along += PROP_STEP, k++) {
      const x = ns ? along : side === 'w' ? i.minX + PROP_INSET : i.maxX - PROP_INSET;
      const z = ns ? (side === 'n' ? i.minZ + PROP_INSET : i.maxZ - PROP_INSET) : along;
      if (propHash(seed, info.id, k) >= share) continue;
      if (info.doors.some((d) => d.open && Math.hypot(d.x - x, d.z - z) < 3)) continue;
      if (info.pillars.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 1)) continue;
      if (info.braziers.some((b) => Math.hypot(b.x - x, b.z - z) < 1.4)) continue;
      if (tombs.some((t) => t.piece === info.id && rectDistance(sarcRect(t), x, z) < 1)) continue;
      if (nearBlock(info, x, z, 0.6)) continue;
      // Neither in a lava strip nor across the walkway at its end (D6): the long way round stays open.
      if (lava.some((l) => l.piece === info.id && inLavaBand(l, x, z, 1.2))) continue;
      // Nor on spikes (G5).
      if (spikes.some((t) => t.piece === info.id && Math.abs(t.x - x) < SPIKE_SIZE / 2 + 0.8 && Math.abs(t.z - z) < SPIKE_SIZE / 2 + 0.8)) continue;
      const pick = propHash(seed ^ 0x5bd1e995, info.id, k);
      const kind: PropKind = pick < 0.45 ? 'crate' : pick < 0.8 ? 'barrel' : 'urn';
      out.push({ id: out.length, kind, x, y: info.y, z, yaw: propHash(seed ^ 0x1b873593, info.id, k) * Math.PI * 2, piece: info.id, inward: (INWARD_YAW[side] * Math.PI) / 180, room: i });
    }
  }
}

/** Torches on a piece's walls: every other wall cell in a room, one per cell in a hall, never over a doorway. */
function torchesFor(info: PieceInfo, p: Piece): FloorLayout['torches'] {
  const out: FloorLayout['torches'] = [];
  const room = KIT[p.kind].room || p.kind === 'rest' || p.kind === 'entrance';
  const b = info.bounds;
  const sides: Side[] = room ? ['n', 'e', 's', 'w'] : p.w >= p.d ? ['n'] : ['w'];
  for (const side of sides) {
    const cells = side === 'n' || side === 's' ? p.w : p.d;
    for (let k = 0; k < cells; k++) {
      if (room && k % 2 === 1 && cells > 1) continue;
      const along = (side === 'n' || side === 's' ? b.minX : b.minZ) + k * CELL + CELL / 2;
      const x = side === 'n' || side === 's' ? along : side === 'w' ? b.minX + WALL_T : b.maxX - WALL_T;
      const z = side === 'e' || side === 'w' ? along : side === 'n' ? b.minZ + WALL_T : b.maxZ - WALL_T;
      if (info.doors.some((d) => d.side === side && Math.hypot(d.x - x, d.z - z) < CELL / 2)) continue;
      // Not buried in the round chamber's masonry.
      if (nearBlock(info, x, z, 0.3)) continue;
      // On a staircase the torch hangs over the middle of the climb.
      const y = (info.y + info.top) / 2 + 3;
      out.push({ x, y, z, facingYawDeg: INWARD_YAW[side] });
    }
  }
  return out;
}

const box = (id: string, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Collider => ({
  kind: 'box',
  id,
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
  blocksMovement: true,
  // The camera looks over the walls of a generated floor, and they fade when they hide the hero.
  blocksCamera: false,
  fadeable: true,
});

/** One side's wall, split around its open doorways (each with a lintel), and a gate for each doorway. */
function sideWalls(info: PieceInfo, side: Side, out: Collider[], gates: Collider[], secrets: readonly (SecretRoom | TreasureRoom)[]): void {
  const b = info.bounds;
  const T = WALL_T;
  const H = info.top + WALL_H;
  const ns = side === 'n' || side === 's';
  // North and south walls run the full width; east and west fit between them, so corners never overlap.
  const lo = ns ? b.minX : b.minZ + T;
  const hi = ns ? b.maxX : b.maxZ - T;
  const across = side === 'n' ? [b.minZ, b.minZ + T] : side === 's' ? [b.maxZ - T, b.maxZ] : side === 'w' ? [b.minX, b.minX + T] : [b.maxX - T, b.maxX];
  const seg = (id: string, a: number, c: number, y0: number, y1: number): Collider =>
    ns ? box(id, a, c, y0, y1, across[0], across[1]) : box(id, across[0], across[1], y0, y1, a, c);
  // A secret's or treasure room's walled-up doorway is a gap like an open one, filled by its cracked wall
  // or its own portcullis (`floorWorldNow`), never a fight room's gate.
  const secretAt = (d: Door) => secrets.some((sr) => sr.piece === info.id && Math.abs(sr.x - d.x) < 1e-6 && Math.abs(sr.z - d.z) < 1e-6);
  const gaps = info.doors
    .filter((d) => d.side === side && (d.open || secretAt(d)))
    .map((d) => ({ at: ns ? d.x : d.z, y: d.y, gate: d.open }))
    .sort((p, q) => p.at - q.at);
  let from = lo;
  gaps.forEach((g, k) => {
    const g0 = g.at - DOOR_W / 2;
    const g1 = g.at + DOOR_W / 2;
    if (g0 > from + 1e-6) out.push(seg(`wall-${info.id}-${side}-${k}`, from, g0, 0, H));
    out.push(seg(`lintel-${info.id}-${side}-${k}`, g0, g1, g.y + DOOR_H, H));
    if (g.gate) gates.push({ ...seg(`gate-${info.id}-${side}-${k}`, g0, g1, 0, g.y + DOOR_H), fadeable: false });
    from = g1;
  });
  if (hi > from + 1e-6) out.push(seg(`wall-${info.id}-${side}-${gaps.length}`, from, hi, 0, H));
}

/** The floor's colliders and surfaces; each fight room's closed doors come as its own collider set. */
export function buildFloorWorld(level: LevelDef): World {
  const layout = level.dungeon!;
  const lb = layout.bounds;
  const colliders: Collider[] = [
    { ...box('floor', lb.minX - 2, lb.maxX + 2, -10, 0, lb.minZ - 2, lb.maxZ + 2), blocksMovement: false, blocksCamera: true, fadeable: false },
  ];
  // A secret's cell can stand out past the pieces' bounds: its own ground for the camera, and its walls.
  const sides: [string, SecretRoom | TreasureRoom][] = [...layout.secrets.map((sr) => ['secret', sr] as [string, SecretRoom]), ...layout.treasure.map((t) => ['treasure', t] as [string, TreasureRoom])];
  for (const [name, sr] of sides) {
    const c = sr.cell;
    colliders.push({ ...box(`floor-${name}-${sr.id}`, c.minX, c.maxX, -10, sr.y, c.minZ, c.maxZ), blocksMovement: false, blocksCamera: true, fadeable: false });
    colliders.push(...secretWalls(sr, name));
  }
  const gatesOf: Collider[][] = [];
  const surfaces: Surface[] = [];
  for (const info of layout.pieces) {
    const gates: Collider[] = [];
    for (const side of ['n', 'e', 's', 'w'] as Side[]) sideWalls(info, side, colliders, gates, [...layout.secrets, ...layout.treasure]);
    gatesOf.push(gates);
    const b = info.bounds;
    // The solid block under a raised piece: the camera stops at it; nothing walks into it past the walls.
    if (info.y > 0) colliders.push({ ...box(`slab-${info.id}`, b.minX, b.maxX, 0, info.y, b.minZ, b.maxZ), blocksMovement: false, blocksCamera: true, fadeable: false });
    info.pillars.forEach((p, i) =>
      colliders.push({ kind: 'cylinder', id: `pillar-${info.id}-${i}`, x: p.x, z: p.z, radius: p.radius, yMin: 0, yMax: info.y + 5.5, blocksMovement: true, blocksCamera: false, fadeable: true }),
    );
    // The round chamber's masonry (G5's B): wall blocks, so they are drawn and fade as walls do.
    info.blocks.forEach((r, k) => colliders.push(box(`wall-${info.id}-block-${k}`, r.minX, r.maxX, 0, info.top + WALL_H, r.minZ, r.maxZ)));
    info.braziers.forEach((br, i) =>
      colliders.push({ kind: 'cylinder', id: `brazier-${info.id}-${i}`, x: br.x, z: br.z, radius: 0.45, yMin: 0, yMax: info.y + 1.2, blocksMovement: true, blocksCamera: false, fadeable: false }),
    );
    if (info.ramp) {
      const r = info.ramp;
      // Landings at each end, the ramp between: groundHeight takes the highest surface under a point.
      const lowY = info.y;
      const highY = info.top;
      const axis: 'x' | 'z' = r.up === 'n' || r.up === 's' ? 'z' : 'x';
      const upAtMin = r.up === 'n' || r.up === 'w';
      surfaces.push({ kind: 'ramp', minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, axis, h0: upAtMin ? highY : lowY, h1: upAtMin ? lowY : highY });
      const high: Rect =
        r.up === 'n' ? { ...b, maxZ: r.minZ } : r.up === 's' ? { ...b, minZ: r.maxZ } : r.up === 'w' ? { ...b, maxX: r.minX } : { ...b, minX: r.maxX };
      const low: Rect =
        r.up === 'n' ? { ...b, minZ: r.maxZ } : r.up === 's' ? { ...b, maxZ: r.minZ } : r.up === 'w' ? { ...b, minX: r.maxX } : { ...b, maxX: r.minX };
      surfaces.push({ kind: 'flat', ...high, height: highY });
      if (lowY > 0) surfaces.push({ kind: 'flat', ...low, height: lowY });
    } else if (info.y > 0) {
      surfaces.push({ kind: 'flat', ...b, height: info.y });
    }
  }
  for (const [, sr] of sides) if (sr.y > 0) surfaces.push({ kind: 'flat', ...sr.cell, height: sr.y });
  // The tombs (G5's B) stand from y = 0 like a pillar: solid to walking, sight and arrows alike.
  layout.sarcophagi.forEach((t, i) => colliders.push(sarcCollider(t, i)));
  // The dais (G5's B) is ground, not wall: two steps anyone walks up, so the camera and arrows pass over it.
  for (const d of layout.daises) surfaces.push(...daisSurfaces(d));
  const roomColliders = gatesOf.map((g) => (g.length ? [...colliders, ...g] : colliders));
  const exitGates = (gatesOf[layout.def.exit] ?? []).map((g) => ({ ...g, id: g.id.replace('gate-', 'exitgate-') }));
  return { level, colliders, collidersOpen: colliders, surfaces, roomColliders, exitGates, collidersLocked: [...colliders, ...exitGates] };
}

/** The piece a point stands in, or -1 (inside a wall between two). */
export function pieceAt(layout: FloorLayout, x: number, z: number): number {
  for (const p of layout.pieces) {
    const b = p.bounds;
    if (x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) return p.id;
  }
  return -1;
}

/** A clear point in the middle of a piece: its centre, or the spot nearest it when a pillar or a fire stands there. */
export function openMiddle(p: PieceInfo): { x: number; z: number } {
  // The L-room's middle is its masonry's corner; the elbow sees down both arms.
  if (p.elbow) return p.elbow;
  const c = { x: (p.inner.minX + p.inner.maxX) / 2, z: (p.inner.minZ + p.inner.maxZ) / 2 };
  const blocked = p.pillars.some((pl) => Math.hypot(pl.x - c.x, pl.z - c.z) < pl.radius + 1.2) || p.braziers.some((b) => Math.hypot(b.x - c.x, b.z - c.z) < 1.6);
  if (!blocked || p.spots.length === 0) return c;
  return [...p.spots].sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
}

/** Is the point inside the piece's walls (by a margin)? */
export function insidePiece(info: PieceInfo, x: number, z: number, margin = 0): boolean {
  const i = info.inner;
  return x >= i.minX + margin && x <= i.maxX - margin && z >= i.minZ + margin && z <= i.maxZ - margin;
}

/**
 * Waypoints from one piece to another through the doorways on the way (fewest pieces): the middle
 * of each piece, and a point either side of each doorway. Straight lines between them stay clear of
 * walls and pillars, so a bot (or a later hireling) can walk them.
 */
export function walkRoute(layout: FloorLayout, from: number, to: number): { x: number; z: number }[] {
  const pieces = layout.def.pieces;
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length && !prev.has(to)) {
    const at = queue.shift()!;
    for (const sk of pieces[at].sockets) {
      if (sk.link < 0 || prev.has(sk.link)) continue;
      prev.set(sk.link, at);
      queue.push(sk.link);
    }
  }
  const chain: number[] = [];
  for (let at = to; at !== -1; at = prev.get(at)!) chain.unshift(at);
  const points: { x: number; z: number }[] = [];
  chain.forEach((id, i) => {
    if (i > 0) points.push(openMiddle(layout.pieces[id]));
    const next = chain[i + 1];
    if (next === undefined) return;
    const door = layout.pieces[id].doors[pieces[id].sockets.findIndex((sk) => sk.link === next)];
    const dir = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } }[door.side];
    points.push({ x: door.x - dir.x * 1.2, z: door.z - dir.z * 1.2 }, { x: door.x + dir.x * 1.8, z: door.z + dir.z * 1.8 });
  });
  return points;
}
