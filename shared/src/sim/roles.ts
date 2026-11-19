import type { EnemyKind, Style } from '../config/tuning';
import { DEFAULT_DUNGEON_TYPE, type DungeonType } from '../level/dungeonTypes';
import type { DamageType } from './types';

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
  gravehand: 'boss',
  ironRing: 'charger',
  silverRing: 'caster',
  boneRing: 'fodder',
  mason: 'boss',
  // Scenery with health (M1): never strikes or moves; heavy, so no Priest raises it and its brain is its own.
  wardstone: 'heavy',
  // The Mason's adds (M2): a plated Shieldbearer and a Wraith that rebuilds stones.
  mortarGuard: 'shield',
  chanter: 'caster',
  // The King's (K1): a Wraith that brings his crown back.
  crownbearer: 'caster',
  // The Warden's (W1): a Bone Priest for its hall, warded.
  cantor: 'leader',
  // And a Skeleton Archer that the blade staggers in one blow.
  skirmisher: 'archer',
  // The Goblin Warrens' (E1i): a Skeleton Warrior's brain, a goblin's numbers.
  cutter: 'fodder',
  slinger: 'archer',
  potlid: 'shield',
  warPig: 'charger',
  shaman: 'caster',
  ogre: 'heavy',
  packLeader: 'leader',
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
  if (e.kind === 'king') return e.attack === 'circles' ? 'magic' : e.attack === 'crown' || e.attack === 'crownSweep' ? 'projectile' : 'strike';
  // The Gravehand (H1): its sweep a strike (blockable), its palm slam heavy, its flick yellow.
  if (e.kind === 'gravehand') return e.attack === 'flick' ? 'projectile' : e.attack === 'slam' || e.attack === 'grab' || e.attack === 'knuckles' ? 'heavy' : 'strike';
  // The Ossuary Mason (M1): its maul string a strike (blockable), its hod's landing heavy.
  if (e.kind === 'mason') return e.attack === 'hod' ? 'heavy' : e.attack === 'grout' ? 'magic' : 'strike';
  if (role === 'boss') return e.attack === 'sweep' ? 'strike' : 'heavy';
  return ROLES[role].tell;
}

/**
 * The damage type of the blow an enemy is winding up (B3's types, read before the hit lands), the same
 * as the `HeroHit.type` it will carry: `damageTypes.test.ts` lands each one.
 */
export function attackType(e: { kind: EnemyKind; attack: string }): DamageType {
  switch (e.kind) {
    case 'grunt':
    case 'hound':
    case 'cutter':
      return 'edge';
    case 'archer':
    case 'skirmisher':
      return 'pierce';
    case 'brute':
    case 'ogre':
    case 'shieldbearer':
    case 'knight':
      return 'blunt';
    case 'warden':
      return e.attack === 'sweep' ? 'edge' : 'blunt';
    case 'king':
      return e.attack === 'circles' ? 'magic' : e.attack === 'crown' ? 'pierce' : 'edge';
    case 'gravehand':
      return e.attack === 'flick' ? 'pierce' : e.attack === 'grab' ? 'edge' : 'blunt';
    case 'ironRing':
      return 'blunt';
    case 'silverRing':
      return 'magic';
    case 'boneRing':
      return 'edge';
    case 'mason':
      return e.attack === 'grout' ? 'magic' : 'blunt';
    case 'wardstone':
    case 'mortarGuard':
    case 'slinger':
    case 'potlid':
    case 'warPig':
      return 'blunt';
    case 'chanter':
    case 'crownbearer':
      return 'magic';
    case 'priest':
    case 'packLeader':
    case 'cantor':
    case 'wraith':
    case 'shaman':
      return 'magic';
  }
}

/** What a telegraph shows: a hue, the type it was read from (when it was), and the unblockable rim. */
export interface Tell {
  colour: TelegraphColour;
  type?: DamageType;
  rim: boolean;
}

/**
 * B4 (Michael's A on the boss document, 16 Nov; `docs/bosses.md` 1.5): with damage types on, the hue
 * says the type (melee red, ranged yellow, magic violet) and orange leaves the fill for a rim that
 * says "do not block this: dodge or jump", on what was orange before (slams, heavies, an armoured
 * enemy's blow) and the King's crown sweep. With them off it is E1a's colour, no rim.
 */
export function telegraphTell(e: { kind: EnemyKind; attack: string; armour?: number }, byType: boolean): Tell {
  const before = telegraphColour(e);
  if (!byType) return { colour: before, rim: false };
  const type = attackType(e);
  const colour: TelegraphColour = type === 'pierce' ? 'projectile' : type === 'magic' ? 'magic' : 'strike';
  return { colour, type, rim: before === 'heavy' || (e.kind === 'king' && e.attack === 'crownSweep') };
}

/**
 * An add's weakness (B5; `docs/bosses.md` 1.3): armoured takes a share of melee and ranged and all of
 * magic, so the mage's; warded turns a spell aside and takes arrows harder, so the archer's. A rule of
 * the kind, as its dressing is. The Gravehand's Iron and Silver Rings (H2) are the first; the Ossuary
 * Mason's Mortar Guards and Bone Chanters (M2) come next. Mutable so a test can lend a kind a weakness.
 */
export type AddWeakness = 'armoured' | 'warded';

export const ADD_WEAKNESS: Partial<Record<EnemyKind, AddWeakness>> = { ironRing: 'armoured', silverRing: 'warded', mortarGuard: 'armoured', chanter: 'warded', crownbearer: 'warded', cantor: 'warded' };

const WEAK_STYLE: Record<AddWeakness, Style> = { armoured: 'staff', warded: 'bow' };

/** The style a kind's adds are weak to, if any. */
export function weakTo(kind: EnemyKind): Style | undefined {
  const w = ADD_WEAKNESS[kind];
  return w ? WEAK_STYLE[w] : undefined;
}

/** What a kind is called in a dungeon type, one and many. */
export interface Dressing {
  name: string;
  plural: string;
}

/** The Crypt's names, every kind: a type's roster starts from it and renames its own. */
const CRYPT_NAMES: Record<EnemyKind, Dressing> = {
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
  gravehand: { name: 'The Gravehand', plural: 'The Gravehand' },
  ironRing: { name: 'Iron Ring', plural: 'Iron Rings' },
  silverRing: { name: 'Silver Ring', plural: 'Silver Rings' },
  boneRing: { name: 'Bone Ring', plural: 'Bone Rings' },
  mason: { name: 'The Ossuary Mason', plural: 'The Ossuary Mason' },
  wardstone: { name: 'Wardstone', plural: 'Wardstones' },
  mortarGuard: { name: 'Mortar Guard', plural: 'Mortar Guards' },
  chanter: { name: 'Bone Chanter', plural: 'Bone Chanters' },
  crownbearer: { name: 'Crownbearer', plural: 'Crownbearers' },
  cantor: { name: 'Grave Cantor', plural: 'Grave Cantors' },
  skirmisher: { name: 'Barrow Skirmisher', plural: 'Barrow Skirmishers' },
  cutter: { name: 'Goblin Cutter', plural: 'Goblin Cutters' },
  slinger: { name: 'Goblin Slinger', plural: 'Goblin Slingers' },
  potlid: { name: 'Pot-lid Goblin', plural: 'Pot-lid Goblins' },
  warPig: { name: 'War Pig', plural: 'War Pigs' },
  shaman: { name: 'Goblin Shaman', plural: 'Goblin Shamans' },
  ogre: { name: 'Cave Ogre', plural: 'Cave Ogres' },
  packLeader: { name: 'Pack Leader', plural: 'Pack Leaders' },
};

/**
 * Rosters by dungeon type. The Crypt's is today's four, renamed (E1a: no change to the fight); a type
 * without its own roster borrows the Crypt's until it has one. The Warrens' kinds (E1i) are kinds of
 * their own, named here, and take a Crypt kind's place in a Warrens room (`ROOM_KINDS`).
 */
export const ROSTERS: Partial<Record<DungeonType, Record<EnemyKind, Dressing>>> = {
  hauntedCrypt: CRYPT_NAMES,
};

/**
 * The kind a generated room's group spawns in place of a Crypt kind, by dungeon type (E1i): the
 * composer (`roomMix.ts`) still spends its budget on the Crypt's kinds, with the same draws from the
 * seeded stream, and a type swaps in its own dressing of each role it has built. So a Crypt room is
 * the room it always was, and a Warrens room keeps its shape as goblins replace skeletons.
 */
export const ROOM_KINDS: Partial<Record<DungeonType, Partial<Record<EnemyKind, EnemyKind>>>> = {
  goblinWarrens: { grunt: 'cutter', archer: 'slinger', shieldbearer: 'potlid', hound: 'warPig', wraith: 'shaman', brute: 'ogre', priest: 'packLeader' },
};

/** The Warrens' goblins and their pig (E1i): not bones, so no Bone Priest raises one. */
export const GOBLINS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['cutter', 'slinger', 'potlid', 'warPig', 'shaman', 'ogre', 'packLeader']);

/** What a room of `type` spawns for the composer's `kind`. */
export function roomKindIn(kind: EnemyKind, type: DungeonType = DEFAULT_DUNGEON_TYPE): EnemyKind {
  return ROOM_KINDS[type]?.[kind] ?? kind;
}

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
