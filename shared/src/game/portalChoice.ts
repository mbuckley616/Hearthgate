import type { EnemyKind } from '../config/tuning';
import type { BodySlot } from '../sim/catalogue';
import { DUNGEONS } from '../level/dungeons';
import type { HandDungeon } from '../level/handmade';

/**
 * Where Keeper Wren's ring leads (P7; Michael, 28 Oct, decisions.md "Wren's portal menu"): a story
 * dungeon from the curated list, cleared in order, or a random dungeon the party shapes itself (its
 * floors, its size, its difficulty, the difficulty capped by the Portal Shrine's tier).
 */

/** How hard a run is: more enemies in every room, and that much more of everything it pays. */
export const DIFFICULTIES = [
  { name: 'Easy', mult: 0.75 },
  { name: 'Normal', mult: 1 },
  { name: 'Hard', mult: 1.5 },
  { name: 'Nightmare', mult: 2 },
  { name: 'Legendary', mult: 2.5 },
] as const;

/** The hardest difficulty a shrine of this tier opens: Normal at tier 1, one more each tier after. */
export function maxDifficulty(shrineTier: number): number {
  return Math.max(1, Math.min(DIFFICULTIES.length - 1, shrineTier));
}

export const difficultyMult = (d: number | undefined) => DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, d ?? 1))].mult;

export type SizeId = 'small' | 'medium' | 'large';
/** Pieces on a run's first floor, and how many more each floor down. */
export const SIZES: Record<SizeId, { name: string; pieces: number; perFloor: number; rooms: string }> = {
  small: { name: 'Small', pieces: 12, perFloor: 2, rooms: 'a few rooms a floor' },
  medium: { name: 'Medium', pieces: 22, perFloor: 3, rooms: 'a handful of rooms a floor' },
  large: { name: 'Large', pieces: 34, perFloor: 4, rooms: 'many rooms a floor' },
};
export const SIZE_IDS: readonly SizeId[] = ['small', 'medium', 'large'];

export const MAX_FLOORS = 8;

/** A run's twist (P8; Michael, 28 Oct: Cursed and Haunted first). */
export type ModifierId = 'cursed' | 'haunted';
export const MODIFIERS: Record<ModifierId, { name: string; words: string }> = {
  cursed: { name: 'Cursed', words: 'no revives, double loot' },
  haunted: { name: 'Haunted', words: 'every enemy gets up once, at half health' },
};
export const MODIFIER_IDS: readonly ModifierId[] = ['cursed', 'haunted'];

/** A story dungeon: its place in the order, what it is, and how its run is made. */
export interface StoryDungeon {
  id: string;
  name: string;
  /** The levels it suits: a guide, never a lock. */
  levels: [number, number];
  blurb: string;
  enemies: EnemyKind[];
  /** What it tends to give: shown as the bag shows those slots. */
  rewards: BodySlot[];
  /** A generated run from a fixed seed, or a hand-built dungeon (T4b) exactly as laid out. */
  run: { seed: number; floors: number; size: SizeId; difficulty: number; modifier?: ModifierId } | { hand: HandDungeon; difficulty: number; modifier?: ModifierId };
}

const cellar = DUNGEONS.find((d) => d.name === 'The Old Cellar');

/**
 * The curated list, in order (a handful to start, about 50 in time). Each opens when the one before
 * it is cleared. The generated ones use a fixed seed, so a story dungeon is the same place every
 * time; a hand-built layout from the editor can take any one's place.
 */
export const STORY: readonly StoryDungeon[] = [
  ...(cellar
    ? [
        {
          id: 'old-cellar',
          name: 'The Old Cellar',
          levels: [1, 3] as [number, number],
          blurb: 'Beneath the old inn, the cellar runs further than any cellar should. Goblins have found it first.',
          enemies: ['grunt', 'archer'] as EnemyKind[],
          rewards: ['weapon', 'body', 'feet'] as BodySlot[],
          run: { hand: cellar, difficulty: 1 },
        },
      ]
    : []),
  {
    id: 'mossgate',
    name: 'Mossgate Barrow',
    levels: [2, 5],
    blurb: 'An old barrow under the hill, its doors split by roots. The dead were buried with their arms, and something wants them back.',
    enemies: ['grunt', 'archer'],
    rewards: ['weapon', 'head', 'shield'],
    run: { seed: 5101, floors: 2, size: 'small', difficulty: 1 },
  },
  {
    id: 'saltmarsh',
    name: 'The Saltmarsh Warrens',
    levels: [4, 8],
    blurb: 'Tunnels dug under the marsh by a goblin chief who thinks himself a king. His court is large, and loud.',
    enemies: ['grunt', 'archer', 'brute'],
    rewards: ['weapon', 'legs', 'hands'],
    run: { seed: 5202, floors: 3, size: 'medium', difficulty: 1 },
  },
  {
    id: 'emberhall',
    name: 'Emberhall',
    levels: [7, 12],
    blurb: 'A dwarven hall left to burn out. The fires never quite did, and what moved in likes the warmth.',
    enemies: ['grunt', 'brute'],
    rewards: ['body', 'shield', 'ring'],
    run: { seed: 5303, floors: 3, size: 'medium', difficulty: 2, modifier: 'haunted' },
  },
  {
    id: 'hollow-crown',
    name: 'The Hollow Crown',
    levels: [10, 16],
    blurb: 'A sunken keep where a warden still keeps watch over a throne no one sits on. Five floors down, and every one guarded.',
    enemies: ['grunt', 'archer', 'brute', 'warden'],
    rewards: ['weapon', 'neck', 'cape'],
    run: { seed: 5404, floors: 5, size: 'large', difficulty: 2 },
  },
];

export type PortalChoice = { kind: 'story'; id: string } | { kind: 'random'; floors: number; size: SizeId; difficulty: number; modifier: ModifierId | null };

/** A choice from a browser, or null: a story id there is, or numbers within the menu's bounds. */
export function readPortalChoice(v: unknown): PortalChoice | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.kind === 'story') return typeof o.id === 'string' && STORY.some((s) => s.id === o.id) ? { kind: 'story', id: o.id } : null;
  if (o.kind !== 'random') return null;
  const int = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi ? x : null);
  const floors = int(o.floors, 1, MAX_FLOORS);
  const difficulty = int(o.difficulty, 0, DIFFICULTIES.length - 1);
  if (floors === null || difficulty === null || !SIZE_IDS.includes(o.size as SizeId)) return null;
  const modifier = o.modifier === undefined || o.modifier === null ? null : MODIFIER_IDS.includes(o.modifier as ModifierId) ? (o.modifier as ModifierId) : undefined;
  if (modifier === undefined) return null;
  return { kind: 'random', floors, size: o.size as SizeId, difficulty, modifier };
}

/** The difficulty a choice runs at. */
export function choiceDifficulty(c: PortalChoice): number {
  return c.kind === 'random' ? c.difficulty : (STORY.find((s) => s.id === c.id)?.run.difficulty ?? 1);
}

/** The words over the village's ring for a choice. */
export function choiceLabel(c: PortalChoice): string {
  if (c.kind === 'story') return STORY.find((s) => s.id === c.id)?.name ?? 'A story dungeon';
  return `A ${SIZES[c.size].name.toLowerCase()} dungeon, ${c.floors} floor${c.floors === 1 ? '' : 's'}, ${DIFFICULTIES[c.difficulty].name}${c.modifier ? `, ${MODIFIERS[c.modifier].name}` : ''}`;
}
