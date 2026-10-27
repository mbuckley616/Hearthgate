import type { Collider } from './geometry';
import { buildFloorWorld, type FloorLayout } from './floor';
import { buildVillageWorld, type VillageDef } from './village';

/** A walkable surface above the floor: a flat top or a ramp rising along one axis. */
export type Surface =
  | { kind: 'flat'; minX: number; maxX: number; minZ: number; maxZ: number; height: number }
  | { kind: 'ramp'; minX: number; maxX: number; minZ: number; maxZ: number; axis: 'x' | 'z'; h0: number; h1: number };

/** Layout of the arena: plain data shared by sim (collision, ground), camera and renderer. */
export interface LevelDef {
  /** The arena floor is a square of this side length centred on the origin. */
  floorSize: number;
  wallHeight: number;
  wallThickness: number;
  pillars: { x: number; z: number; radius: number; height: number }[];
  /** Raised ledge along the north wall where archers stand (brief). */
  ledge: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
  /** Ramps running straight down off the front of the ledge: high end (minZ) touching it, low end at maxZ. */
  ramps: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  /** Small entry room south of the arena (brief: "entered from a small antechamber"). */
  antechamber: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Opening in the arena's south wall into the antechamber; a gate closes it during a run. */
  doorway: { minX: number; maxX: number; height: number };
  /** Crossing north of this z (into the arena) starts the run. */
  arenaEntryZ: number;
  /** Where archers take position on the ledge. */
  archerSpots: { x: number; z: number }[];
  /** Floor spawn points for grunts and brutes. */
  spawnPoints: { x: number; z: number }[];
  /** Torches sit on walls; (x, z) is on the wall's inner face, facing into the room. */
  torches: { x: number; y: number; z: number; facingYawDeg: number }[];
  /** Standing fire bowls on the floor (solid; they light the middle of the room). */
  braziers: { x: number; z: number }[];
  /** Hanging cloth banners on wall faces, facing into the room. */
  banners: { x: number; y: number; z: number; facingYawDeg: number }[];
  spawn: { x: number; z: number; yawDeg: number };
  /** Set on the village (T3, village.ts): its buildings, villagers and portal; the arena's own fields stay empty there. */
  village?: VillageDef;
  /** Set on a generated dungeon floor (T4, floor.ts): its pieces; the arena's own fields stay empty there. */
  dungeon?: FloorLayout;
}

export const arena: LevelDef = {
  floorSize: 30,
  wallHeight: 7,
  wallThickness: 1,
  pillars: [
    { x: -5.5, z: -4, radius: 0.75, height: 6 },
    { x: 5.5, z: -4, radius: 0.75, height: 6 },
    { x: -7, z: 6, radius: 0.75, height: 6 },
    { x: 7, z: 6, radius: 0.75, height: 6 },
    { x: 0, z: 0.5, radius: 0.9, height: 6 },
    { x: -11.5, z: 1, radius: 0.6, height: 6 },
    { x: 11.5, z: 1, radius: 0.6, height: 6 },
  ],
  ledge: { minX: -10, maxX: 10, minZ: -15, maxZ: -11.5, height: 1.8 },
  ramps: [
    { minX: -10, maxX: -7.6, minZ: -11.5, maxZ: -7.4 },
    { minX: 7.6, maxX: 10, minZ: -11.5, maxZ: -7.4 },
  ],
  antechamber: { minX: -4.5, maxX: 4.5, minZ: 16, maxZ: 23 },
  doorway: { minX: -2, maxX: 2, height: 4 },
  arenaEntryZ: 14.2,
  archerSpots: [
    { x: -6, z: -13.2 },
    { x: 0, z: -13.2 },
    { x: 6, z: -13.2 },
  ],
  spawnPoints: [
    { x: -12.5, z: -8 },
    { x: 12.5, z: -8 },
    { x: 0, z: -9 },
    { x: -12, z: 9 },
    { x: 12, z: 9 },
  ],
  torches: [
    { x: -12.5, y: 4.2, z: -15, facingYawDeg: 0 },
    { x: 12.5, y: 4.2, z: -15, facingYawDeg: 0 },
    { x: -8, y: 3.2, z: 15, facingYawDeg: 180 },
    { x: 8, y: 3.2, z: 15, facingYawDeg: 180 },
    { x: -15, y: 3.2, z: -3, facingYawDeg: 90 },
    { x: 15, y: 3.2, z: 4, facingYawDeg: -90 },
    { x: 0, y: 3.0, z: 23, facingYawDeg: 180 },
  ],
  braziers: [
    { x: -4.6, z: 13.2 },
    { x: 4.6, z: 13.2 },
    { x: -13.4, z: -13.4 },
    { x: 13.4, z: -13.4 },
    { x: -13.4, z: 13.4 },
    { x: 13.4, z: 13.4 },
  ],
  banners: [
    { x: -5, y: 4.6, z: -15, facingYawDeg: 0 },
    { x: 5, y: 4.6, z: -15, facingYawDeg: 0 },
    { x: -15, y: 4.2, z: -9, facingYawDeg: 90 },
    { x: -15, y: 4.2, z: 7, facingYawDeg: 90 },
    { x: 15, y: 4.2, z: -6, facingYawDeg: -90 },
    { x: 15, y: 4.2, z: 10, facingYawDeg: -90 },
    { x: -11.5, y: 4.2, z: 15, facingYawDeg: 180 },
    { x: 11.5, y: 4.2, z: 15, facingYawDeg: 180 },
  ],
  spawn: { x: 0, z: 20.5, yawDeg: 180 },
};

/** Everything the sim needs to know about the static level. */
export interface World {
  level: LevelDef;
  colliders: Collider[];
  /** Colliders with the gate open (antechamber reachable). */
  collidersOpen: Collider[];
  surfaces: Surface[];
  /** A generated floor's colliders with one fight room's doors shut, by piece (floor.ts). */
  roomColliders?: Collider[][];
}

export function buildWorld(level: LevelDef): World {
  if (level.village) return buildVillageWorld(level);
  if (level.dungeon) return buildFloorWorld(level);
  const h = level.floorSize / 2;
  const t = level.wallThickness;
  const H = level.wallHeight;
  const a = level.antechamber;
  const d = level.doorway;
  const box = (
    id: string,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    blocksCamera = true,
  ): Collider => ({
    kind: 'box',
    id,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    blocksMovement: true,
    blocksCamera,
    fadeable: false,
  });

  const colliders: Collider[] = [
    {
      kind: 'box',
      id: 'floor',
      min: { x: -h - t, y: -10, z: -h - t },
      max: { x: h + t, y: 0, z: a.maxZ + t },
      blocksMovement: false,
      blocksCamera: true,
      fadeable: false,
    },
    box('wall-n', -h - t, h + t, 0, H, -h - t, -h),
    // South wall, split by the doorway, with a lintel over it.
    box('wall-s-w', -h - t, d.minX, 0, H, h, h + t),
    box('wall-s-e', d.maxX, h + t, 0, H, h, h + t),
    box('lintel', d.minX, d.maxX, d.height, H, h, h + t),
    box('wall-w', -h - t, -h, 0, H, -h, h),
    box('wall-e', h, h + t, 0, H, -h, h),
    // Antechamber walls.
    box('ante-w', a.minX - t, a.minX, 0, H, h + t, a.maxZ + t),
    box('ante-e', a.maxX, a.maxX + t, 0, H, h + t, a.maxZ + t),
    box('ante-s', a.minX - t, a.maxX + t, 0, H, a.maxZ, a.maxZ + t),
    // The ledge block: its sides stop you, its top is walkable.
    box('ledge', level.ledge.minX, level.ledge.maxX, 0, level.ledge.height, level.ledge.minZ, level.ledge.maxZ),
  ];

  level.pillars.forEach((p, i) =>
    colliders.push({
      kind: 'cylinder',
      id: `pillar-${i}`,
      x: p.x,
      z: p.z,
      radius: p.radius,
      yMin: 0,
      yMax: p.height,
      blocksMovement: true,
      // Brief: pillars fade out rather than shoving the camera forward.
      blocksCamera: false,
      fadeable: true,
    }),
  );

  level.braziers.forEach((b, i) =>
    colliders.push({
      kind: 'cylinder',
      id: `brazier-${i}`,
      x: b.x,
      z: b.z,
      radius: 0.45,
      yMin: 0,
      yMax: 1.2,
      blocksMovement: true,
      blocksCamera: false,
      fadeable: false,
    }),
  );

  const gate = box('gate', d.minX, d.maxX, 0, d.height, h, h + t);

  const surfaces: Surface[] = [
    { kind: 'flat', ...level.ledge },
    ...level.ramps.map(
      (r): Surface => ({ kind: 'ramp', minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, axis: 'z', h0: level.ledge.height, h1: 0 }),
    ),
  ];

  return { level, colliders: [...colliders, gate], collidersOpen: colliders, surfaces };
}

/** Height of the walkable ground at (x, z): the floor, the ledge top or a ramp. */
export function groundHeight(world: World, x: number, z: number): number {
  let g = 0;
  for (const s of world.surfaces) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    if (s.kind === 'flat') g = Math.max(g, s.height);
    else {
      const u = s.axis === 'x' ? (x - s.minX) / (s.maxX - s.minX) : (z - s.minZ) / (s.maxZ - s.minZ);
      g = Math.max(g, s.h0 + (s.h1 - s.h0) * u);
    }
  }
  return g;
}

/** Bottom and top points of each ramp, for simple enemy navigation onto and off the ledge. */
export function rampPaths(level: LevelDef): { bottom: { x: number; z: number }; top: { x: number; z: number } }[] {
  return level.ramps.map((r) => {
    const x = (r.minX + r.maxX) / 2;
    return { bottom: { x, z: r.maxZ + 0.8 }, top: { x, z: r.minZ - 1.2 } };
  });
}
