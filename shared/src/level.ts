/**
 * Levels: the walls a room is made of and where its enemies start. Pure data plus the
 * one collision routine both sides run, so a client predicting its own movement slides
 * along a wall exactly where the server will put it.
 *
 * A wall is an axis-aligned box on the ground plane: a centre and half extents. Height is
 * presentation. Rooms, doors and stairs (the Goblin Warrens floor) are assembled from these
 * by the floor item; this module only knows rectangles.
 */
import type { EnemyKind } from "./sim";

export interface WallRect {
  x: number;
  z: number;
  /** Half width (along x) and half depth (along z), metres. */
  hw: number;
  hd: number;
}

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  z: number;
  facing: number;
}

export interface Level {
  id: string;
  name: string;
  /** Half extents of the playable ground, centred on the origin. */
  halfW: number;
  halfD: number;
  walls: readonly WallRect[];
  enemies: readonly EnemySpawn[];
  /** Portal tier, 1 to 5: caps the gear used here (gear.ts). 1 when absent, as every level so far is. */
  tier?: number;
  /**
   * A floor's rooms. An enemy belongs to the room its spawn is in; when a room's last enemy
   * falls the room is clear (the downed get up, the dead come back). Absent: the whole level
   * is one room, as in the field and the yard.
   */
  rooms?: readonly RoomRect[];
  /**
   * Where the stairs are. With stairs, clearing every enemy opens them and the party descends
   * by standing on them; without, a cleared level resets after ROOM.resetMs.
   */
  stairs?: { x: number; z: number };
  /**
   * Points a chasing enemy can route through when it cannot walk straight at its target:
   * one each side of every doorway, far enough out that the way to them clears the jambs.
   * Absent: enemies only walk straight (the field and the yard have no closed rooms).
   */
  waypoints?: readonly { x: number; z: number }[];
}

export interface RoomRect {
  name: string;
  x: number;
  z: number;
  hw: number;
  hd: number;
}

/** The index of the room containing a point, or -1. */
export function roomAt(level: Level, x: number, z: number): number {
  const rooms = level.rooms ?? [];
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    if (Math.abs(x - r.x) <= r.hw && Math.abs(z - r.z) <= r.hd) return i;
  }
  return -1;
}

/**
 * Keep a circle inside the level's bounds and out of its walls. Mutates `o`. Two passes
 * over the walls so a circle pushed out of one wall into a neighbour settles in the corner
 * instead of ending a tick inside either.
 */
export function collideWalls(o: { x: number; z: number }, radius: number, level: Level): void {
  const lx = level.halfW - radius;
  const lz = level.halfD - radius;
  if (o.x < -lx) o.x = -lx;
  if (o.x > lx) o.x = lx;
  if (o.z < -lz) o.z = -lz;
  if (o.z > lz) o.z = lz;
  for (let pass = 0; pass < 2; pass++) {
    for (const w of level.walls) pushOut(o, radius, w);
  }
}

function pushOut(o: { x: number; z: number }, r: number, w: WallRect): void {
  const nx = Math.max(w.x - w.hw, Math.min(w.x + w.hw, o.x));
  const nz = Math.max(w.z - w.hd, Math.min(w.z + w.hd, o.z));
  const dx = o.x - nx;
  const dz = o.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-12) {
    // Outside the box but overlapping it: back off along the line to the nearest point.
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    o.x += dx * k;
    o.z += dz * k;
    return;
  }
  // The centre is inside the box (a fast move landed in it): leave by the nearest face.
  // Walls are at least 0.4 m deep so one tick of dodging never crosses the middle.
  const left = o.x - (w.x - w.hw);
  const right = w.x + w.hw - o.x;
  const back = o.z - (w.z - w.hd);
  const front = w.z + w.hd - o.z;
  const m = Math.min(left, right, back, front);
  if (m === left) o.x = w.x - w.hw - r;
  else if (m === right) o.x = w.x + w.hw + r;
  else if (m === back) o.z = w.z - w.hd - r;
  else o.z = w.z + w.hd + r;
}

/** True when the segment from a to b crosses no wall (the bounds are not checked). */
export function lineClear(a: { x: number; z: number }, b: { x: number; z: number }, level: Level): boolean {
  for (const w of level.walls) {
    if (segmentHitsRect(a, b, w)) return false;
  }
  return true;
}

/**
 * True when a circle of `radius` can slide from a to b without touching a wall: the centre
 * line and the two lines `radius` to either side are all clear. A slightly thinner body is
 * tested so a circle resting against a wall's face, as collideWalls leaves it, is not blocked.
 */
export function pathClear(a: { x: number; z: number }, b: { x: number; z: number }, radius: number, level: Level): boolean {
  if (!lineClear(a, b, level)) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-9 || radius <= 0) return true;
  const r = radius * 0.9;
  const ox = (-dz / d) * r;
  const oz = (dx / d) * r;
  return (
    lineClear({ x: a.x + ox, z: a.z + oz }, { x: b.x + ox, z: b.z + oz }, level) &&
    lineClear({ x: a.x - ox, z: a.z - oz }, { x: b.x - ox, z: b.z - oz }, level)
  );
}

/**
 * Where a body of `radius` at `from` should head next to reach `to`: `to` itself when the
 * way is clear, else the first waypoint on the shortest route through the level's waypoints
 * (Dijkstra over a handful of points, ties to the lower index, so server runs agree). With
 * no route, `to`, and the body slides along whatever is in the way as before.
 */
export function steerToward(
  from: { x: number; z: number },
  to: { x: number; z: number },
  radius: number,
  level: Level
): { x: number; z: number } {
  const wps = level.waypoints;
  if (!wps || wps.length === 0 || pathClear(from, to, radius, level)) return to;
  // Waypoints already reached are skipped, so arriving at a doorway hands on to the next leg.
  const nodes = wps.filter((w) => Math.hypot(w.x - from.x, w.z - from.z) > 0.25);
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const first = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (pathClear(from, nodes[i], radius, level)) {
      dist[i] = Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z);
      first[i] = i;
    }
  }
  let best = Infinity;
  let bestFirst = -1;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= best) break;
    done[u] = true;
    if (pathClear(nodes[u], to, radius, level)) {
      const total = dist[u] + Math.hypot(to.x - nodes[u].x, to.z - nodes[u].z);
      if (total < best) {
        best = total;
        bestFirst = first[u];
      }
    }
    for (let v = 0; v < n; v++) {
      if (done[v]) continue;
      const alt = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z);
      if (alt < dist[v] && pathClear(nodes[u], nodes[v], radius, level)) {
        dist[v] = alt;
        first[v] = first[u];
      }
    }
  }
  return bestFirst >= 0 ? nodes[bestFirst] : to;
}

function segmentHitsRect(a: { x: number; z: number }, b: { x: number; z: number }, w: WallRect): boolean {
  // Slab test: clip the segment's parameter range against each axis of the box.
  let t0 = 0;
  let t1 = 1;
  const axes: [number, number, number, number][] = [
    [a.x, b.x - a.x, w.x - w.hw, w.x + w.hw],
    [a.z, b.z - a.z, w.z - w.hd, w.z + w.hd]
  ];
  for (const [p, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) {
      const t = ta;
      ta = tb;
      tb = t;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export const ARENA_HALF = 20; // the yard is 40 x 40 m

/** The Phase 0 arena: four edges, no walls, one goblin. The unit tests assume it. */
export const OPEN_FIELD: Level = {
  id: "field",
  name: "Open field",
  halfW: ARENA_HALF,
  halfD: ARENA_HALF,
  walls: [],
  enemies: [{ kind: "goblin", x: 9, z: -9, facing: Math.PI }]
};

/**
 * The goblin yard: the arena with a few ruined walls and four goblins spread so a lone
 * player meets one or two at a time and a party can split them. The stand-in for a
 * Warrens floor until rooms exist. Player spawns (sim.ts SPAWN_POINTS) sit inside
 * x, z in -6..6; every wall keeps 1.5 m clear of them.
 */
export const YARD: Level = {
  id: "yard",
  name: "The goblin yard",
  halfW: ARENA_HALF,
  halfD: ARENA_HALF,
  walls: [
    { x: -12, z: 0, hw: 4, hd: 0.4 }, // a long low wall to the west
    { x: 6, z: 6, hw: 0.4, hd: 4 }, // a wall running north on the east side
    { x: 12, z: -3, hw: 3, hd: 0.4 }, // a stub between the first goblin and the middle
    { x: 0, z: -10, hw: 0.6, hd: 0.6 }, // pillars
    { x: -8, z: 9, hw: 0.6, hd: 0.6 }
  ],
  enemies: [
    { kind: "goblin", x: 9, z: -9, facing: Math.PI },
    { kind: "goblin", x: 12, z: 8, facing: Math.PI },
    { kind: "goblin", x: -12, z: -10, facing: 0 },
    { kind: "goblin", x: -10, z: 12, facing: 0 },
    // North of the start, out of aggro until someone walks up: the fight that needs two.
    { kind: "shieldbearer", x: 0, z: 15, facing: Math.PI },
    // The far south-east corner, open ground in front: room to see its lane and step out of it.
    { kind: "charger", x: 14, z: -15, facing: -Math.PI / 4 },
    // Behind the south-west goblin, close enough to rally it.
    { kind: "packLeader", x: -15, z: -13, facing: Math.PI / 4 }
  ]
};

/**
 * The Goblin Warrens, floor one (backlog: one hand-built floor from rooms; Michael's A: clear
 * every room, then the stairs open). An entry hall where the party starts, with the stairs at
 * its centre, so descending needs no move: the party is already standing there. North-west the
 * guard room (goblins and a Shieldbearer), through it the den (a Charger watching the door and
 * a goblin), and south the pens (the Pack Leader and its pack). Doorways are 3 m wide; enemies
 * need a line of sight to wake, so each room waits until someone walks in.
 */
export const WARRENS: Level = {
  id: "warrens",
  name: "The Goblin Warrens",
  halfW: ARENA_HALF,
  halfD: ARENA_HALF,
  walls: [
    // The hall's north wall, a door at x -11.5..-8.5 into the guard room.
    { x: -15.75, z: 8, hw: 4.25, hd: 0.4 },
    { x: 5.75, z: 8, hw: 14.25, hd: 0.4 },
    // The hall's south wall, a door at x 8.5..11.5 into the pens.
    { x: -5.75, z: -8, hw: 14.25, hd: 0.4 },
    { x: 15.75, z: -8, hw: 4.25, hd: 0.4 },
    // Between the guard room and the den, a door at z 13..16.
    { x: 0, z: 10.5, hw: 0.4, hd: 2.5 },
    { x: 0, z: 18, hw: 0.4, hd: 2 },
    // Cover: a pillar in the den, two in the pens.
    { x: 10, z: 14, hw: 0.7, hd: 0.7 },
    { x: -8, z: -14, hw: 0.7, hd: 0.7 },
    { x: 8, z: -15, hw: 0.7, hd: 0.7 }
  ],
  rooms: [
    { name: "the guard room", x: -10, z: 14, hw: 10, hd: 6 },
    { name: "the den", x: 10, z: 14, hw: 10, hd: 6 },
    { name: "the pens", x: 0, z: -14, hw: 20, hd: 6 }
  ],
  stairs: { x: 0, z: 0 },
  // Each doorway's two sides, 1.8 m out from the wall's middle.
  waypoints: [
    { x: -10, z: 9.8 }, // the guard room's door to the hall
    { x: -10, z: 6.2 },
    { x: 10, z: -6.2 }, // the pens' door to the hall
    { x: 10, z: -9.8 },
    { x: -1.8, z: 14.5 }, // the door between the guard room and the den
    { x: 1.8, z: 14.5 }
  ],
  enemies: [
    { kind: "goblin", x: -14, z: 13, facing: Math.PI },
    { kind: "goblin", x: -5, z: 17, facing: Math.PI },
    { kind: "shieldbearer", x: -10, z: 16, facing: Math.PI },
    { kind: "charger", x: 16, z: 15, facing: -Math.PI / 2 },
    { kind: "goblin", x: 6, z: 11, facing: -Math.PI / 2 },
    { kind: "packLeader", x: 0, z: -18, facing: 0 },
    { kind: "goblin", x: -3, z: -14, facing: 0 },
    { kind: "goblin", x: 3, z: -14, facing: 0 },
    { kind: "goblin", x: 4, z: -11, facing: 0 }
  ]
};

export const LEVELS: Record<string, Level> = { field: OPEN_FIELD, yard: YARD, warrens: WARRENS };

/** The level a dungeon room runs: the Warrens floor the Phase 1 gate asks a party to clear. `?level=yard` keeps the old yard. */
export const DEFAULT_LEVEL_ID = "warrens";

export function levelById(id: string): Level {
  return LEVELS[id] ?? OPEN_FIELD;
}
