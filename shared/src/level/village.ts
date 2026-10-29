import type { LevelDef, World } from './arena';
import type { Collider } from './geometry';

/**
 * The village (T3): the host's hub, a second kind of level beside the slice's arena. Plain data
 * like the arena, read by the sim (collision), the camera and the renderer. It reuses the arena's
 * LevelDef so the slice's sim runs in it unchanged: the run's start line (arenaEntryZ) lies off the
 * map, so no run and no enemy ever starts here, and the ledge, ramps and antechamber are empty.
 *
 * The design doc's four starting buildings stand round an open square: the Portal Shrine to the
 * north with the portal before it, the General Store and the Storehouse east and west, the Tavern
 * to the south-west. A villager stands at each door and answers F. Buildings are solid blocks for
 * now (Phase 2 opens them); a low palisade rings the square, with trees beyond it.
 */

export interface Building {
  id: 'shrine' | 'store' | 'storehouse' | 'tavern';
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Eaves height; the roof rises above it. */
  height: number;
  /** The door, on the face given by its yaw (0 = facing +z, the slice's convention). */
  door: { x: number; z: number; facingYawDeg: number };
}

export interface Villager {
  id: string;
  name: string;
  x: number;
  z: number;
  facingYawDeg: number;
  line: string;
  /** Which hero's figure they wear (the slice's three), until villagers have outfits of their own. */
  look: 'sword' | 'bow' | 'staff';
  /** The building they keep: its owner raises its tier by holding talk with them (P4). */
  building?: Building['id'];
}

/**
 * A building's inside (Michael, 28 Oct: enterable interiors). It lies in the village level itself,
 * far off the square, so going in is a step through a door, not a load: the room stays one room
 * and friends see each other go in. Its walls fade for the camera as a dungeon's do.
 */
export interface InteriorDef {
  building: Building['id'];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** The way out, on the south wall: a gap this wide centred on x. */
  doorX: number;
  doorWidth: number;
  /** Solid furniture (a table, shelves), floor to height. */
  furniture: { id: string; minX: number; maxX: number; minZ: number; maxZ: number; height: number }[];
}

/** Stepping into a door's circle puts the hero at the other side, facing in (stepPlayer, so prediction agrees). */
export interface DoorLink {
  x: number;
  z: number;
  radius: number;
  toX: number;
  toZ: number;
  toYawDeg: number;
}

/** A ring on the ground: the whole standing party inside it for PORTAL_HOLD_S takes it. */
export interface PortalDef {
  x: number;
  z: number;
  radius: number;
}

export interface VillageDef {
  buildings: Building[];
  villagers: Villager[];
  portal: PortalDef;
  well: { x: number; z: number; radius: number };
  /** Trees inside the palisade (solid trunks); the renderer adds more outside it. */
  trees: { x: number; z: number; radius: number }[];
  interiors: InteriorDef[];
  doors: DoorLink[];
}

/** How close a player must stand to a villager to talk (F): across a counter, from its end (interiors). */
export const TALK_RANGE = 3;

const villageDef: VillageDef = {
  buildings: [
    { id: 'shrine', name: 'Portal Shrine', minX: -5, maxX: 5, minZ: -22, maxZ: -15, height: 5.5, door: { x: 0, z: -15, facingYawDeg: 0 } },
    { id: 'store', name: 'General Store', minX: 11, maxX: 18, minZ: -9, maxZ: -1, height: 4.2, door: { x: 11, z: -5, facingYawDeg: -90 } },
    { id: 'storehouse', name: 'Storehouse', minX: -18, maxX: -11, minZ: -9, maxZ: -1, height: 4.6, door: { x: -11, z: -5, facingYawDeg: 90 } },
    { id: 'tavern', name: 'Tavern', minX: -19, maxX: -8, minZ: 8, maxZ: 16, height: 4.8, door: { x: -8, z: 12, facingYawDeg: 90 } },
  ],
  villagers: [
    {
      // Inside her shrine now (Michael, 28 Oct), behind her table with its orb.
      id: 'keeper',
      name: 'Keeper Wren',
      x: 0,
      z: -80.9,
      facingYawDeg: 0,
      look: 'staff',
      building: 'shrine',
      line: 'The shrine opens on the deep places below. Step into the ring together and hold still; down there, a ring in the place to rest brings you home.',
    },
    // Each keeper stands inside their building now (Michael, 28 Oct), behind their counter, facing the door.
    { id: 'storekeeper', name: 'Aldous', x: 80, z: -2.9, facingYawDeg: 0, look: 'sword', building: 'store', line: "Fresh stock each morning, and I'll take anything off your hands for fair coin." },
    { id: 'warden', name: 'Marta', x: -80, z: -0.9, facingYawDeg: 0, look: 'bow', building: 'storehouse', line: "What you leave with me is safe whatever happens down there. Your pack is not: only its pocket comes home from a wipe." },
    { id: 'innkeeper', name: 'Old Fenn', x: 0, z: 75.1, facingYawDeg: 0, look: 'sword', building: 'tavern', line: 'No ale, no beds, no hirelings yet. Warm yourself by the fire a while.' },
  ],
  portal: { x: 0, z: -10.5, radius: 2.4 },
  interiors: [
    {
      building: 'shrine',
      minX: -7,
      maxX: 7,
      minZ: -86,
      maxZ: -74,
      doorX: 0,
      doorWidth: 1.8,
      furniture: [
        { id: 'wren-table', minX: -1.3, maxX: 1.3, minZ: -80.45, maxZ: -79.55, height: 0.9 },
        { id: 'shelf-w', minX: -7, maxX: -6.2, minZ: -84.5, maxZ: -77.5, height: 2.6 },
        { id: 'shelf-e', minX: 6.2, maxX: 7, minZ: -84.5, maxZ: -77.5, height: 2.6 },
      ],
    },
    {
      // Aldous's shop, far east: a counter before shelves of goods, barrels and sacks, a rack of arms.
      building: 'store',
      minX: 74,
      maxX: 86,
      minZ: -6,
      maxZ: 4,
      doorX: 80,
      doorWidth: 1.8,
      furniture: [
        { id: 'counter', minX: 77, maxX: 83, minZ: -2.45, maxZ: -1.55, height: 1 },
        { id: 'shelf-n', minX: 75, maxX: 85, minZ: -6, maxZ: -5.3, height: 2.8 },
        { id: 'rack-e', minX: 85.3, maxX: 86, minZ: -3.5, maxZ: 1.5, height: 2.2 },
        { id: 'barrels-w', minX: 74, maxX: 75.6, minZ: -1.5, maxZ: 2, height: 1.1 },
      ],
    },
    {
      // Marta's storehouse, far west: racks along both walls, stacked crates, the strongroom's vault, her ledger desk.
      building: 'storehouse',
      minX: -88,
      maxX: -72,
      minZ: -6,
      maxZ: 6,
      doorX: -80,
      doorWidth: 2.2,
      furniture: [
        { id: 'desk', minX: -81.3, maxX: -78.7, minZ: -0.45, maxZ: 0.45, height: 0.9 },
        { id: 'rack-w', minX: -88, maxX: -87, minZ: -5, maxZ: 4, height: 3 },
        { id: 'rack-e', minX: -73, maxX: -72, minZ: -5, maxZ: 4, height: 3 },
        { id: 'vault', minX: -81.5, maxX: -78.5, minZ: -6, maxZ: -4.6, height: 2.4 },
        { id: 'crates-nw', minX: -86.5, maxX: -84, minZ: -5.8, maxZ: -3.6, height: 1.6 },
        { id: 'crates-ne', minX: -76, maxX: -73.5, minZ: -5.8, maxZ: -4, height: 1.2 },
      ],
    },
    {
      // Old Fenn's tavern, far south: the bar and its kegs, a hearth, tables and stools; the Rusted Stag (Michael's mockup).
      building: 'tavern',
      minX: -9,
      maxX: 9,
      minZ: 71,
      maxZ: 85,
      doorX: 0,
      doorWidth: 2,
      furniture: [
        { id: 'bar', minX: -4, maxX: 4, minZ: 75.55, maxZ: 76.45, height: 1.1 },
        { id: 'kegs', minX: -3.5, maxX: 3.5, minZ: 71, maxZ: 72.2, height: 1.6 },
        { id: 'hearth', minX: -9, maxX: -7.8, minZ: 77.5, maxZ: 81.5, height: 1.6 },
        { id: 'table-a', minX: 3.2, maxX: 4.8, minZ: 79.2, maxZ: 80.8, height: 0.8 },
        { id: 'table-b', minX: 5.2, maxX: 6.8, minZ: 82.4, maxZ: 84, height: 0.8 },
        { id: 'table-c', minX: -5.3, maxX: -3.7, minZ: 81.6, maxZ: 83.2, height: 0.8 },
      ],
    },
  ],
  doors: [
    // The shrine's front door and the way out of its inside.
    { x: 0, z: -14.5, radius: 0.8, toX: 0, toZ: -75.8, toYawDeg: 180 },
    { x: 0, z: -74.6, radius: 0.8, toX: 0, toZ: -13.3, toYawDeg: 0 },
    // The store's door faces the square to the west, the storehouse's and the tavern's to the east.
    { x: 10.5, z: -5, radius: 0.8, toX: 80, toZ: 2.2, toYawDeg: 180 },
    { x: 80, z: 3.4, radius: 0.8, toX: 9.3, toZ: -5, toYawDeg: -90 },
    { x: -10.5, z: -5, radius: 0.8, toX: -80, toZ: 4.2, toYawDeg: 180 },
    { x: -80, z: 5.4, radius: 0.8, toX: -9.3, toZ: -5, toYawDeg: 90 },
    { x: -7.5, z: 12, radius: 0.8, toX: 0, toZ: 83.2, toYawDeg: 180 },
    { x: 0, z: 84.4, radius: 0.8, toX: -6.3, toZ: 12, toYawDeg: 90 },
  ],
  well: { x: 0, z: 2, radius: 1.1 },
  trees: [
    { x: 17, z: 13, radius: 0.5 },
    { x: 19.5, z: 6, radius: 0.5 },
    { x: -20, z: -14, radius: 0.5 },
    { x: 15, z: -18, radius: 0.5 },
    { x: 6, z: 18, radius: 0.5 },
  ],
};

export const village: LevelDef = {
  floorSize: 46,
  wallHeight: 2.2,
  wallThickness: 0.5,
  pillars: [],
  // No ledge, ramps or antechamber: the arena's fields, empty.
  ledge: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, height: 0 },
  ramps: [],
  antechamber: { minX: 0, maxX: 0, minZ: 23, maxZ: 23 },
  doorway: { minX: 0, maxX: 0, height: 0 },
  // Off the map: the slice's run starts when a player crosses north of this, so it never does here.
  arenaEntryZ: -1e9,
  archerSpots: [],
  spawnPoints: [],
  torches: [],
  braziers: [],
  banners: [],
  spawn: { x: 0, z: 14, yawDeg: 180 },
  village: villageDef,
};

const INTERIOR_WALL_H = 4;
const INTERIOR_WALL_T = 0.4;

/**
 * An interior's walls (round the outside of its floor, the south one split at the door), its floor
 * for the camera, and its furniture. The walls fade and let the camera through, as a dungeon's do.
 */
function interiorColliders(
  r: InteriorDef,
  box: (id: string, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, blocksCamera?: boolean) => Collider,
): Collider[] {
  const t = INTERIOR_WALL_T;
  const H = INTERIOR_WALL_H;
  const wall = (id: string, minX: number, maxX: number, minZ: number, maxZ: number): Collider => ({ ...box(id, minX, maxX, 0, H, minZ, maxZ, false), fadeable: true });
  const id = (s: string) => `interior-${r.building}-${s}`;
  const half = r.doorWidth / 2;
  return [
    { ...box(id('floor'), r.minX - t, r.maxX + t, -10, 0, r.minZ - t, r.maxZ + t), blocksMovement: false },
    wall(id('wall-n'), r.minX - t, r.maxX + t, r.minZ - t, r.minZ),
    wall(id('wall-w'), r.minX - t, r.minX, r.minZ, r.maxZ),
    wall(id('wall-e'), r.maxX, r.maxX + t, r.minZ, r.maxZ),
    wall(id('wall-sw'), r.minX - t, r.doorX - half, r.maxZ, r.maxZ + t),
    wall(id('wall-se'), r.doorX + half, r.maxX + t, r.maxZ, r.maxZ + t),
    ...r.furniture.map((f) => box(id(f.id), f.minX, f.maxX, 0, f.height, f.minZ, f.maxZ, false)),
  ];
}

/** The village's colliders: the palisade, the buildings, the well, the trees and the villagers. */
export function buildVillageWorld(level: LevelDef): World {
  const v = level.village!;
  const h = level.floorSize / 2;
  const t = level.wallThickness;
  const H = level.wallHeight;
  const box = (id: string, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, blocksCamera = true): Collider => ({
    kind: 'box',
    id,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    blocksMovement: true,
    blocksCamera,
    fadeable: false,
  });
  const cylinder = (id: string, x: number, z: number, radius: number, yMax: number, fadeable: boolean): Collider => ({
    kind: 'cylinder',
    id,
    x,
    z,
    radius,
    yMin: 0,
    yMax,
    blocksMovement: true,
    blocksCamera: false,
    fadeable,
  });
  const colliders: Collider[] = [
    { ...box('floor', -h - t, h + t, -10, 0, -h - t, h + t), blocksMovement: false },
    // The palisade is low: the camera may look over it.
    box('wall-n', -h - t, h + t, 0, H, -h - t, -h, false),
    box('wall-s', -h - t, h + t, 0, H, h, h + t, false),
    box('wall-w', -h - t, -h, 0, H, -h, h, false),
    box('wall-e', h, h + t, 0, H, -h, h, false),
    ...v.buildings.map((b) => box(`building-${b.id}`, b.minX, b.maxX, 0, b.height + 2.5, b.minZ, b.maxZ)),
    // The well's roof stands 3 m up: fadeable like the trees, so it never hides the hero from the camera.
    cylinder('well', v.well.x, v.well.z, v.well.radius, 3, true),
    ...v.trees.map((tr, i) => cylinder(`tree-${i}`, tr.x, tr.z, tr.radius, 6, true)),
    ...v.villagers.map((n) => cylinder(`villager-${n.id}`, n.x, n.z, 0.45, 1.8, false)),
    ...v.interiors.flatMap((r) => interiorColliders(r, box)),
  ];
  return { level, colliders, collidersOpen: colliders, surfaces: [] };
}
