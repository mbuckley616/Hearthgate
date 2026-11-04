/**
 * The design doc's eight dungeon types (Michael, 29 Oct, decisions.md "E1, the enemy design pass":
 * "the design doc's eight types are canonical"). A run carries one on its `RunPlan` and every floor's
 * `FloorSpec`; absent means the Haunted Crypt, so saves, hand-built dungeons and the arena from before
 * E1a read as the Crypt they always were. A type names the run and picks the roster that dresses the
 * roles (sim/roles.ts); it never changes the floor a seed builds.
 */
export type DungeonType =
  | 'goblinWarrens'
  | 'hauntedCrypt'
  | 'wizardTower'
  | 'banditFort'
  | 'druidRuins'
  | 'forgeDepths'
  | 'drownedTemple'
  | 'frozenBarrows';

export interface DungeonTypeInfo {
  name: string;
  /** The design doc's flavour line, shown under the name on Wren's tab. */
  flavour: string;
  /** Shared types are in every village; regional ones only in their region's (Phase 4). */
  region: 'any' | 'Verdant Vale' | 'Emberreach' | 'Tidewater' | 'Frostmere';
  /** Whether a run can be made of it yet: only types with a roster built. */
  open: boolean;
}

export const DUNGEON_TYPES: Record<DungeonType, DungeonTypeInfo> = {
  hauntedCrypt: { name: 'Haunted Crypt', flavour: 'stone halls, candlelight', region: 'any', open: true },
  goblinWarrens: { name: 'Goblin Warrens', flavour: 'mud tunnels, loot piles, traps', region: 'any', open: false },
  wizardTower: { name: 'Ruined Wizard Tower', flavour: 'vertical, puzzle rooms', region: 'any', open: false },
  banditFort: { name: 'Bandit Fort', flavour: 'palisades, courtyards', region: 'any', open: false },
  druidRuins: { name: 'Overgrown Druid Ruins', flavour: 'vines, standing stones', region: 'Verdant Vale', open: false },
  forgeDepths: { name: 'Forge-Depths', flavour: 'lava channels, dwarven machinery', region: 'Emberreach', open: false },
  drownedTemple: { name: 'Drowned Temple', flavour: 'flooded chambers, coral', region: 'Tidewater', open: false },
  frozenBarrows: { name: 'Frozen Barrows', flavour: 'ice tombs, wind', region: 'Frostmere', open: false },
};

/** Wren's Random tab's order: the open one first, then the shared four, then the regional four. */
export const DUNGEON_TYPE_IDS: readonly DungeonType[] = [
  'hauntedCrypt',
  'goblinWarrens',
  'wizardTower',
  'banditFort',
  'druidRuins',
  'forgeDepths',
  'drownedTemple',
  'frozenBarrows',
];

export const DEFAULT_DUNGEON_TYPE: DungeonType = 'hauntedCrypt';

export const isDungeonType = (v: unknown): v is DungeonType => typeof v === 'string' && (DUNGEON_TYPE_IDS as readonly string[]).includes(v);

/** The type a plan or spec stands for: its own, or the Crypt. */
export const dungeonTypeOf = (o: { type?: DungeonType } | null | undefined): DungeonType => o?.type ?? DEFAULT_DUNGEON_TYPE;
