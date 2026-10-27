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
}

/** How close a player must stand to a villager to talk (F). */
export const TALK_RANGE = 2.4;

const villageDef: VillageDef = {
  buildings: [
    { id: 'shrine', name: 'Portal Shrine', minX: -5, maxX: 5, minZ: -22, maxZ: -15, height: 5.5, door: { x: 0, z: -15, facingYawDeg: 0 } },
    { id: 'store', name: 'General Store', minX: 11, maxX: 18, minZ: -9, maxZ: -1, height: 4.2, door: { x: 11, z: -5, facingYawDeg: -90 } },
    { id: 'storehouse', name: 'Storehouse', minX: -18, maxX: -11, minZ: -9, maxZ: -1, height: 4.6, door: { x: -11, z: -5, facingYawDeg: 90 } },
    { id: 'tavern', name: 'Tavern', minX: -19, maxX: -8, minZ: 8, maxZ: 16, height: 4.8, door: { x: -8, z: 12, facingYawDeg: 90 } },
  ],
  villagers: [
    {
      id: 'keeper',
      name: 'Keeper Wren',
      x: 3.6,
      z: -13.4,
      facingYawDeg: 0,
      look: 'staff',
      line: 'The shrine opens on the deep places below. Step into the ring together and hold still; down there, a ring in the place to rest brings you home.',
    },
    { id: 'storekeeper', name: 'Aldous', x: 9.6, z: -3.4, facingYawDeg: -90, look: 'sword', line: "Shelves are bare today. When the carts come through, I'll have stock worth your coin." },
    { id: 'warden', name: 'Marta', x: -9.6, z: -6.6, facingYawDeg: 90, look: 'bow', line: "Nothing to keep yet; your pack is all you carry. There'll be room for the lot of you in time." },
    { id: 'innkeeper', name: 'Old Fenn', x: -6.6, z: 13.6, facingYawDeg: 90, look: 'sword', line: 'No ale, no beds, no hirelings yet. Warm yourself by the fire a while.' },
  ],
  portal: { x: 0, z: -10.5, radius: 2.4 },
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
  ];
  return { level, colliders, collidersOpen: colliders, surfaces: [] };
}
