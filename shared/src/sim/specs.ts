import { tuning, type Style } from '../config/tuning';
import { levelFor } from './gear';
import type { EnemyState, PlayerState, SimState } from './types';

/**
 * Specializations (the builds pass; Michael's A, 6 Nov 2026: specializations first, one style a
 * session, Melee's Paladin, Spellblade and Rogue first; trees and states wait). One a style, from
 * that style's level `specs.level`, chosen on the hero screen and kept with the loadout. Plain data
 * the sim reads; a hero with none (the slice, the parity test, anyone under level 10) is unchanged.
 */

export type SpecId = 'paladin' | 'spellblade' | 'rogue';
export type Element = 'holy' | 'fire' | 'frost' | 'earth' | 'air' | 'shadow' | 'nature';
/** A hero's specializations, one a style at most. */
export type Specs = Partial<Record<Style, SpecId>>;

export interface SpecInfo {
  id: SpecId;
  style: Style;
  name: string;
  element: Element;
  /** Its versions of the style's two abilities, and what each does differently. */
  q: [string, string];
  e: [string, string];
  /** Built and choosable; the rest are shown as coming. */
  built: boolean;
}

/** The combat builds page's specializations (Michael's Keep, 28 Oct), in the order they are built. */
export const SPECS: readonly SpecInfo[] = [
  {
    id: 'paladin',
    style: 'sword',
    name: 'Paladin',
    element: 'holy',
    q: ['Shield Rush', 'Charge taunts the enemy it hits: it turns on you for 3 s.'],
    e: ['Consecrate', 'Whirlwind leaves a holy ring; allies inside take less damage.'],
    built: true,
  },
  {
    id: 'spellblade',
    style: 'sword',
    name: 'Spellblade',
    element: 'fire',
    q: ['Blazing Charge', 'Charge leaves a trail of your element.'],
    e: ['Blade Storm', 'Whirlwind pulls light enemies in.'],
    built: false,
  },
  {
    id: 'rogue',
    style: 'sword',
    name: 'Rogue',
    element: 'shadow',
    q: ['Shadowstep', 'Charge becomes a step behind the target.'],
    e: ['Fan of Knives', 'Whirlwind throws knives in a circle.'],
    built: false,
  },
];

export const SPEC_IDS: readonly SpecId[] = SPECS.map((s) => s.id);

export function specInfo(id: SpecId): SpecInfo {
  return SPECS.find((s) => s.id === id)!;
}

/** The specializations a style offers. */
export function specsFor(style: Style): readonly SpecInfo[] {
  return SPECS.filter((s) => s.style === style);
}

/** The colour each element tints a hero's attacks (the combat builds page's swatches). */
export const ELEMENT_COLOUR: Record<Element, number> = {
  holy: 0xffd35a,
  fire: 0xff6b3d,
  frost: 0x6cc8ff,
  earth: 0xb08a4e,
  air: 0xf4f8fb,
  shadow: 0xa274ff,
  nature: 0x7fd36b,
};

/** Why a set of specializations could not be this hero's, or null: its style's, built, and earned by level. */
export function specProblem(xp: Record<Style, number>, specs: Specs): string | null {
  for (const [style, id] of Object.entries(specs) as [Style, SpecId][]) {
    const info = SPECS.find((s) => s.id === id);
    if (!info) return `unknown specialization ${String(id)}`;
    if (info.style !== style) return `${info.name} is not a ${style} specialization`;
    if (!info.built) return `${info.name} is not built yet`;
    if (levelFor(xp[style] ?? 0) < tuning.specs.level) return `${style} is under level ${tuning.specs.level}`;
  }
  return null;
}

/** The hero's specialization in the style they hold now, if any. */
export function specOf(p: PlayerState): SpecId | undefined {
  return p.spec?.[p.style];
}

/**
 * Shield Rush (the Paladin's Charge): the enemy it hits turns on the Paladin for `specs.tauntSeconds`,
 * whoever is nearer. Called where the Charge lands, on the server and in prediction alike; enemies are
 * only stepped on the server, so only the server's copy acts on it.
 */
export function taunt(state: SimState, p: PlayerState, e: EnemyState): void {
  if (specOf(p) !== 'paladin' || tuning.specs.tauntSeconds <= 0) return;
  e.taunt = { by: p.id, until: state.time + tuning.specs.tauntSeconds };
  state.events.push({ kind: 'taunt', playerId: p.id, enemyId: e.id, x: e.x, z: e.z });
}

/** The hero a taunt holds this enemy to, while it lasts and they stand; null otherwise (and a spent taunt is dropped). */
export function tauntedBy(state: SimState, e: EnemyState): PlayerState | null {
  const t = e.taunt;
  if (!t) return null;
  const p = t.until > state.time ? state.players.find((o) => o.id === t.by) : undefined;
  if (!p || p.mode === 'down') {
    delete e.taunt;
    return null;
  }
  return p;
}

/**
 * Consecrate (the Paladin's Whirlwind): where the spin ends it leaves a holy ring, one a Paladin (a
 * new one replaces their last), for `specs.consecrateSeconds`. Stepped in stepAbility, so prediction
 * draws its own at once and the server's copy replaces it with the next snapshot.
 */
export function consecrate(state: SimState, p: PlayerState): void {
  if (specOf(p) !== 'paladin' || tuning.specs.consecrateSeconds <= 0) return;
  const s = tuning.specs;
  const kept = (state.consecrated ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  kept.push({ by: p.id, x: p.x, y: p.y, z: p.z, radius: s.consecrateRadius, until: state.time + s.consecrateSeconds });
  state.consecrated = kept;
}

/** What share of a hit a hero standing on consecrated ground takes: `specs.consecrateDamageTaken` inside a live ring, else 1. */
export function consecratedMult(state: SimState, p: PlayerState): number {
  const rings = state.consecrated;
  if (!rings) return 1;
  for (const g of rings) {
    if (g.until > state.time && Math.hypot(p.x - g.x, p.z - g.z) <= g.radius) return tuning.specs.consecrateDamageTaken;
  }
  return 1;
}

/** Spent rings leave the state, so a snapshot carries only live ones (and none once all have faded). */
export function fadeConsecrated(state: SimState): void {
  const live = state.consecrated!.filter((g) => g.until > state.time);
  if (live.length > 0) state.consecrated = live;
  else delete state.consecrated;
}
