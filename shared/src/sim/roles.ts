import type { EnemyKind } from '../config/tuning';
import { DEFAULT_DUNGEON_TYPE, type DungeonType } from '../level/dungeonTypes';

/**
 * Enemy roles (E1a; Michael, 29 Oct, decisions.md "E1, the enemy design pass"; the design doc's Enemy
 * roles): one behaviour a role, built once, and every enemy kind a dressing of one: its look (the
 * views, by kind), its numbers (`tuning[kind]`, with panel ranges) and, from E1b on, the state it
 * applies. So a dungeon type's roster is data: which kinds it has and what each is called there.
 * `boss` is not one of the eight: each boss keeps a brain of its own.
 */
export type EnemyRole = 'fodder' | 'shield' | 'charger' | 'archer' | 'caster' | 'leader' | 'heavy' | 'elite' | 'boss';

/**
 * The telegraph colour language, the same in every dungeon: red a strike, orange heavy or
 * unblockable, yellow a projectile or a charge, violet magic or a state.
 */
export type TelegraphColour = 'strike' | 'heavy' | 'projectile' | 'magic';

export const ROLES: Record<EnemyRole, { name: string; tell: TelegraphColour }> = {
  fodder: { name: 'Fodder', tell: 'strike' },
  shield: { name: 'Shield', tell: 'strike' },
  charger: { name: 'Charger', tell: 'projectile' },
  archer: { name: 'Archer', tell: 'projectile' },
  caster: { name: 'Caster', tell: 'magic' },
  leader: { name: 'Leader', tell: 'magic' },
  heavy: { name: 'Heavy', tell: 'heavy' },
  elite: { name: 'Elite', tell: 'heavy' },
  boss: { name: 'Boss', tell: 'strike' },
};

/** Each kind's role. The ids stay the slice's (the parity test and the arena use them); only the dressing is the Crypt's. */
export const KIND_ROLE: Record<EnemyKind, EnemyRole> = {
  grunt: 'fodder',
  archer: 'archer',
  brute: 'heavy',
  warden: 'boss',
  shieldbearer: 'shield',
  hound: 'charger',
  priest: 'leader',
  knight: 'elite',
  wraith: 'caster',
  king: 'boss',
};

export const roleOf = (kind: EnemyKind): EnemyRole => KIND_ROLE[kind];

/**
 * The colour an enemy's telegraph draws in, from what it is winding up: a boss's sweep is a strike,
 * its slams heavy; an enemy armoured after a stagger (G1) is heavy whatever it swings, since nothing
 * will stop the blow.
 */
export function telegraphColour(e: { kind: EnemyKind; attack: string; armour?: number }): TelegraphColour {
  if (e.armour) return 'heavy';
  const role = roleOf(e.kind);
  // The Hollow King (G4b): his sword string a strike, his thrown crown yellow.
  if (e.kind === 'king') return e.attack === 'crown' ? 'projectile' : 'strike';
  if (role === 'boss') return e.attack === 'sweep' ? 'strike' : 'heavy';
  return ROLES[role].tell;
}

/** What a kind is called in a dungeon type, one and many. */
export interface Dressing {
  name: string;
  plural: string;
}

/**
 * Rosters by dungeon type. The Crypt's is today's four, renamed (E1a: no change to the fight); a type
 * without its own roster borrows the Crypt's until it has one (the Warrens are E1i).
 */
export const ROSTERS: Partial<Record<DungeonType, Record<EnemyKind, Dressing>>> = {
  hauntedCrypt: {
    grunt: { name: 'Skeleton Warrior', plural: 'Skeleton Warriors' },
    archer: { name: 'Skeleton Archer', plural: 'Skeleton Archers' },
    brute: { name: 'Bone Brute', plural: 'Bone Brutes' },
    warden: { name: 'The Warden', plural: 'The Warden' },
    shieldbearer: { name: 'Skeleton Shieldbearer', plural: 'Skeleton Shieldbearers' },
    hound: { name: 'Crypt Hound', plural: 'Crypt Hounds' },
    priest: { name: 'Bone Priest', plural: 'Bone Priests' },
    knight: { name: 'Barrow Knight', plural: 'Barrow Knights' },
    wraith: { name: 'Wraith', plural: 'Wraiths' },
    king: { name: 'The Hollow King', plural: 'The Hollow King' },
  },
};

export function dressing(kind: EnemyKind, type: DungeonType = DEFAULT_DUNGEON_TYPE): Dressing {
  return (ROSTERS[type] ?? ROSTERS[DEFAULT_DUNGEON_TYPE]!)[kind];
}

/**
 * Mini-bosses' names (G4) by dungeon type: a named elite takes one from the floor's seeded stream. A
 * type without its own list borrows the Crypt's, as with rosters.
 */
export const MINIBOSS_NAMES: Partial<Record<DungeonType, readonly string[]>> = {
  hauntedCrypt: ['Sir Aldous the Hollow', 'Lady Merrow of the Barrows', 'The Ashen Steward', 'Old Grevil, Bone-Crowned', 'Captain Hesk', 'The Pale Reeve'],
};

export function minibossNames(type: DungeonType = DEFAULT_DUNGEON_TYPE): readonly string[] {
  return MINIBOSS_NAMES[type] ?? MINIBOSS_NAMES[DEFAULT_DUNGEON_TYPE]!;
}
