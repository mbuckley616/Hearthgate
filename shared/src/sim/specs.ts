import { enemyStats, tuning, type Style } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { isTargetable } from './combat';
import { levelFor } from './gear';
import { roleOf, type EnemyRole } from './roles';
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
/** The element a hero chose for a style's specialization, where it offers more than one. */
export type SpecElements = Partial<Record<Style, Element>>;

export interface SpecInfo {
  id: SpecId;
  style: Style;
  name: string;
  element: Element;
  /** The elements it may be: the first is `element`, the one it has until another is chosen. */
  elements: readonly Element[];
  /** Its versions of the style's two abilities, and what each does differently. */
  q: [string, string];
  e: [string, string];
  /** Its signature mechanic. */
  sig: [string, string];
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
    elements: ['holy'],
    q: ['Shield Rush', 'Charge taunts the enemy it hits: it turns on you for 3 s.'],
    e: ['Consecrate', 'Whirlwind leaves a holy ring; allies inside take 15% less damage.'],
    sig: ['Bulwark', 'Your guard holds against heavy hits. A perfect parry heals allies within 4 m.'],
    built: true,
  },
  {
    id: 'spellblade',
    style: 'sword',
    name: 'Spellblade',
    element: 'fire',
    // The Fighter became the Spellblade, choosing as the Sorcerer does (decisions.md, the builds page).
    elements: ['fire', 'frost', 'earth', 'air'],
    q: ['Blazing Charge', 'Charge leaves a trail of your element.'],
    e: ['Blade Storm', 'Whirlwind pulls light enemies in.'],
    sig: ['Spectral blades', 'Your spins conjure extra blades.'],
    built: false,
  },
  {
    id: 'rogue',
    style: 'sword',
    name: 'Rogue',
    element: 'shadow',
    elements: ['shadow', 'nature'],
    q: ['Shadowstep', 'Charge becomes a step behind the target.'],
    e: ['Fan of Knives', 'Whirlwind throws knives in a circle.'],
    sig: ['From the shadows', 'Dodging through an enemy makes your next hit a crit from behind.'],
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

export const ELEMENT_NAMES: Record<Element, string> = {
  holy: 'Holy',
  fire: 'Fire',
  frost: 'Frost',
  earth: 'Earth',
  air: 'Air',
  shadow: 'Shadow',
  nature: 'Nature',
};

export const ELEMENT_IDS = Object.keys(ELEMENT_COLOUR) as Element[];

/** Why a choice of elements could not go with these specializations, or null: each a chosen specialization's, and one it offers. */
export function elementProblem(specs: Specs, elements: SpecElements): string | null {
  for (const [style, el] of Object.entries(elements) as [Style, Element][]) {
    const id = specs[style];
    if (!id) return `no ${style} specialization to be ${String(el)}`;
    if (!specInfo(id).elements.includes(el)) return `${specInfo(id).name} cannot be ${String(el)}`;
  }
  return null;
}

/** The element a style's specialization has for this hero: the one they chose, or its own first. */
export function elementFor(p: Pick<PlayerState, 'spec' | 'elements'>, style: Style): Element | undefined {
  const id = p.spec?.[style];
  if (!id) return undefined;
  const chosen = p.elements?.[style];
  const info = specInfo(id);
  return chosen && info.elements.includes(chosen) ? chosen : info.element;
}

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

/** Bulwark (the Paladin's signature): whether this hero's guard holds against a heavy hit instead of breaking. */
export function guardHoldsHeavy(p: PlayerState): boolean {
  return tuning.specs.bulwarkHolds && specOf(p) === 'paladin';
}

/**
 * Bulwark's pulse: a Paladin's perfect parry heals every standing hero within `specs.bulwarkRadius`,
 * the Paladin too, by `specs.bulwarkHeal` of their health. Parries are judged as a hit lands, which
 * is the server's alone, so this never runs in prediction.
 */
export function holyPulse(state: SimState, p: PlayerState): void {
  const s = tuning.specs;
  if (specOf(p) !== 'paladin' || s.bulwarkHeal <= 0) return;
  let healed = 0;
  for (const o of state.players) {
    if (o.mode === 'down' || o.hp <= 0 || Math.hypot(o.x - p.x, o.z - p.z) > s.bulwarkRadius) continue;
    const before = o.hp;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * s.bulwarkHeal);
    if (o.hp > before) healed++;
  }
  state.events.push({ kind: 'holyPulse', playerId: p.id, x: p.x, y: p.y, z: p.z, healed });
}

/** The roles Blade Storm can draw in: everything but the shielded, the heavy, the elite and bosses. */
const LIGHT_ROLES: ReadonlySet<EnemyRole> = new Set(['fodder', 'archer', 'caster', 'leader', 'charger']);

/**
 * Blade Storm (the Spellblade's Whirlwind): each tick of the spin, light enemies within
 * `specs.bladeStormRadius` are drawn toward the hero, as a knockback the enemy step slides along
 * walls, and let go `specs.bladeStormHold` from them so the spin's edge still finds them.
 */
export function bladeStorm(state: SimState, p: PlayerState): void {
  if (specOf(p) !== 'spellblade') return;
  const s = tuning.specs;
  const v = s.bladeStormPull;
  for (const e of state.enemies) {
    if (e.ai === 'dead' || e.ai === 'spawn' || !LIGHT_ROLES.has(roleOf(e.kind)) || Math.abs(e.y - p.y) > 1.2) continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > s.bladeStormRadius || d <= s.bladeStormHold) continue;
    // Set, not add: a pull is a steady draw, never a launch that grows tick on tick.
    e.kbx = (dx / d) * v;
    e.kbz = (dz / d) * v;
  }
}

/**
 * Shadowstep (the Rogue's Charge): as the dash starts, a Rogue whose Charge has a target within
 * `abilities.chargeDistance` plus `specs.shadowstepReach` steps to the far side of it, behind where it
 * faces, short of any wall, and turns to it; the Charge then lands on it there, a hit from behind. No
 * target in reach, and it is the plain dash. Returns the enemy stepped behind. Stepped in stepAbility,
 * so prediction steps it at once against the last snapshot's enemies; the server's place corrects it.
 */
export function shadowstep(state: SimState, p: PlayerState, colliders: readonly Collider[]): EnemyState | null {
  if (specOf(p) !== 'rogue' || p.attackTarget < 0) return null;
  const e = state.enemies.find((o) => o.id === p.attackTarget);
  if (!e || !isTargetable(e) || Math.abs(e.y - p.y) > 1.2) return null;
  const er = enemyStats(e.kind).radius;
  const reach = tuning.abilities.chargeDistance + tuning.specs.shadowstepReach + er;
  if (Math.hypot(e.x - p.x, e.z - p.z) > reach) return null;
  // Behind it is opposite its facing; a wall there leaves the Rogue as far round as it allows.
  const dir = { x: -Math.sin(e.yaw), y: 0, z: -Math.cos(e.yaw) };
  const want = er + tuning.movement.radius + 0.2;
  const free = sphereCast({ x: e.x, y: p.y + 1, z: e.z }, dir, want, tuning.movement.radius, colliders, (c) => c.blocksMovement);
  const d = Math.max(0, Math.min(want, free - 0.05));
  const from = { x: p.x, z: p.z };
  p.x = e.x + dir.x * d;
  p.z = e.z + dir.z * d;
  p.yaw = Math.atan2(e.x - p.x, e.z - p.z);
  state.events.push({ kind: 'shadowstep', playerId: p.id, fromX: from.x, fromZ: from.z, x: p.x, y: p.y, z: p.z });
  return e;
}
