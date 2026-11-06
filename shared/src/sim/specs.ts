import { enemyStats, tuning, type Style } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { damageEnemy, isTargetable, type HitSpec } from './combat';
import { spawnArrow } from './projectiles';
import { levelFor } from './gear';
import { roleOf, type EnemyRole } from './roles';
import { gainFlow } from './flow';
import type { BrambleGround, EnemyState, PlayerState, ProjectileState, SimState } from './types';

/**
 * Specializations (the builds pass; Michael's A, 6 Nov 2026: specializations first, one style a
 * session, Melee's Paladin, Spellblade and Rogue first; trees and states wait). One a style, from
 * that style's level `specs.level`, chosen on the hero screen and kept with the loadout. Plain data
 * the sim reads; a hero with none (the slice, the parity test, anyone under level 10) is unchanged.
 */

export type SpecId = 'paladin' | 'spellblade' | 'rogue' | 'ranger' | 'scout' | 'assassin';
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
    built: true,
  },
  {
    id: 'ranger',
    style: 'bow',
    name: 'Ranger',
    element: 'nature',
    elements: ['nature', 'earth'],
    q: ['Bramble Rain', 'Volley seeds brambles that root.'],
    e: ['Snare Trap', 'Disengage leaves a trap where you stood.'],
    sig: ['Thornshot', 'Charged shots root light enemies and slow heavier ones.'],
    built: true,
  },
  {
    id: 'scout',
    style: 'bow',
    name: 'Scout',
    element: 'air',
    elements: ['air'],
    q: ['Storm Volley', 'Volley arrows chain lightning to one more enemy.'],
    e: ['Gale Step', 'Disengage twice in a row; the second is a full dodge.'],
    sig: ['Marked', 'Your shots mark. Any party hit on a marked enemy deals 10% more and fills your Flow.'],
    built: true,
  },
  {
    id: 'assassin',
    style: 'bow',
    name: 'Assassin',
    element: 'shadow',
    elements: ['shadow', 'nature'],
    q: ['Venom Volley', 'Volley arrows poison; each one more stacks it.'],
    e: ['Smoke Bomb', 'Disengage drops smoke; you vanish for 2 s.'],
    sig: ['Deadeye', 'A charged shot into an enemy\'s back is a crit.'],
    built: true,
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

/** Whether this enemy is rooted to the spot this tick: it still turns and strikes, but does not walk. */
export function isRooted(state: SimState, e: EnemyState): boolean {
  if (e.rootUntil === undefined) return false;
  if (e.rootUntil > state.time) return true;
  delete e.rootUntil;
  return false;
}

/**
 * Thornshot (the Ranger's signature): a Ranger's charged shot roots a light enemy it hits for
 * `specs.thornRootS` and slows a heavier one (the shielded, heavies, elites, bosses) for
 * `specs.thornSlowS`. Called as the arrow lands; enemies are the server's, so only its copy holds.
 */
export function thornshot(state: SimState, owner: PlayerState | undefined, e: EnemyState): void {
  if (!owner || owner.spec?.bow !== 'ranger' || e.ai === 'dead') return;
  const s = tuning.specs;
  if (LIGHT_ROLES.has(roleOf(e.kind))) {
    if (s.thornRootS <= 0) return;
    const fresh = !isRooted(state, e);
    e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + s.thornRootS);
    if (fresh) state.events.push({ kind: 'rooted', playerId: owner.id, enemyId: e.id, x: e.x, z: e.z });
  } else if (s.thornSlowS > 0) {
    e.slowTime = Math.max(e.slowTime, s.thornSlowS);
  }
}

/**
 * Bramble Rain (the Ranger's Volley): with the arrows, a patch of brambles takes root
 * `specs.brambleRange` ahead (short of a wall), `specs.brambleRadius` across, for
 * `specs.brambleSeconds`; one a Ranger, a new one replacing their last. Fired with the ability, so
 * prediction draws its own at once and the server's copy replaces it with the next snapshot.
 */
export function brambleRain(state: SimState, p: PlayerState, colliders: readonly Collider[]): void {
  const s = tuning.specs;
  if (p.spec?.bow !== 'ranger' || p.style !== 'bow' || s.brambleSeconds <= 0) return;
  const dir = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  const free = sphereCast({ x: p.x, y: p.y + 1, z: p.z }, dir, s.brambleRange, 0.3, colliders, (c) => c.blocksMovement);
  const d = free >= s.brambleRange ? s.brambleRange : Math.max(0, free - 0.3);
  const kept = (state.brambles ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  const element = elementFor(p, 'bow') ?? 'nature';
  kept.push({ by: p.id, x: p.x + dir.x * d, y: p.y, z: p.z + dir.z * d, radius: s.brambleRadius, until: state.time + s.brambleSeconds, element });
  state.brambles = kept;
}

/** How long each tick in a bramble patch holds an enemy: a little past the tick, so stepping out lets go at once. */
const BRAMBLE_HOLD_S = 0.1;

/**
 * Each tick, a light enemy standing in a live bramble patch is rooted and a heavier one slowed, for as
 * long as it stays; spent patches leave the state. The server's enemies alone act on it.
 */
export function stepBrambles(state: SimState): void {
  const live: BrambleGround[] = state.brambles!.filter((g) => g.until > state.time);
  if (live.length === 0) {
    delete state.brambles;
    return;
  }
  state.brambles = live;
  for (const e of state.enemies) {
    if (!isTargetable(e)) continue;
    const er = enemyStats(e.kind).radius;
    if (!live.some((g) => Math.abs(e.y - g.y) < 1.2 && Math.hypot(e.x - g.x, e.z - g.z) <= g.radius + er)) continue;
    if (LIGHT_ROLES.has(roleOf(e.kind))) e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + BRAMBLE_HOLD_S);
    else e.slowTime = Math.max(e.slowTime, BRAMBLE_HOLD_S);
  }
}

/**
 * Snare Trap (the Ranger's Disengage): where the Ranger stood as they leapt away, a trap
 * `specs.snareRadius` across waits `specs.snareSeconds`; one a Ranger, a new one replacing their last.
 */
export function snareTrap(state: SimState, p: PlayerState): void {
  const s = tuning.specs;
  if (p.spec?.bow !== 'ranger' || p.style !== 'bow' || s.snareSeconds <= 0) return;
  const kept = (state.snares ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  const element = elementFor(p, 'bow') ?? 'nature';
  kept.push({ by: p.id, x: p.x, y: p.y, z: p.z, radius: s.snareRadius, until: state.time + s.snareSeconds, element });
  state.snares = kept;
}

/**
 * The first enemy to step into a live Snare Trap springs it: a light one is rooted for
 * `specs.snareRootS`, a heavier one slowed as long, and the trap is spent. The server's alone.
 */
export function stepSnares(state: SimState): void {
  const live: BrambleGround[] = [];
  for (const g of state.snares!) {
    if (g.until <= state.time) continue;
    const e = state.enemies.find(
      (o) => isTargetable(o) && Math.abs(o.y - g.y) < 1.2 && Math.hypot(o.x - g.x, o.z - g.z) <= g.radius + enemyStats(o.kind).radius,
    );
    if (!e) {
      live.push(g);
      continue;
    }
    const hold = tuning.specs.snareRootS;
    if (LIGHT_ROLES.has(roleOf(e.kind))) e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + hold);
    else e.slowTime = Math.max(e.slowTime, hold);
    state.events.push({ kind: 'rooted', playerId: g.by, enemyId: e.id, x: e.x, z: e.z });
  }
  if (live.length > 0) state.snares = live;
  else delete state.snares;
}

/**
 * Marked (the Scout's signature): every arrow a Scout lands marks its enemy for `specs.markSeconds`,
 * after the arrow's own damage. Called as the arrow lands, so prediction marks its own copy too.
 */
export function scoutMark(state: SimState, owner: PlayerState | undefined, e: EnemyState): void {
  if (!owner || owner.spec?.bow !== 'scout' || tuning.specs.markSeconds <= 0 || !isTargetable(e)) return;
  const fresh = !e.scoutMark || e.scoutMark.until <= state.time;
  e.scoutMark = { by: owner.id, until: state.time + tuning.specs.markSeconds };
  if (fresh) state.events.push({ kind: 'scoutMarked', playerId: owner.id, enemyId: e.id, x: e.x, z: e.z });
}

/**
 * What a party hit on a marked enemy is multiplied by: `1 + specs.markDamageBonus` while the mark
 * lasts, the Scout's own hits too, each also filling the Scout's Flow by `specs.markFlowGain`. A
 * bleed's tick neither gains nor pays; a spent mark is dropped.
 */
export function markedMult(state: SimState, e: EnemyState, hero: PlayerState | undefined, dot: boolean | undefined): number {
  const m = e.scoutMark;
  if (!m) return 1;
  if (m.until <= state.time) {
    delete e.scoutMark;
    return 1;
  }
  if (!hero || dot) return 1;
  gainFlow(state.players.find((p) => p.id === m.by), tuning.specs.markFlowGain);
  return 1 + tuning.specs.markDamageBonus;
}

/**
 * Storm Volley (the Scout's Volley): each Volley arrow a Scout lands arcs lightning on to the nearest
 * other enemy within `specs.stormChainRange` it has not already hit, for `specs.stormChainDamage` of
 * the arrow's damage, at once. Called as the arrow lands, a projectile's hit, so the server's alone.
 */
export function stormChain(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, from: EnemyState): void {
  const s = tuning.specs;
  if (!owner || owner.spec?.bow !== 'scout' || !pr.marks || s.stormChainDamage <= 0) return;
  let best: EnemyState | null = null;
  let bestD = s.stormChainRange;
  for (const e of state.enemies) {
    if (e === from || !isTargetable(e) || pr.hitIds.includes(e.id) || Math.abs(e.y - from.y) > 1.2) continue;
    const d = Math.hypot(e.x - from.x, e.z - from.z);
    if (d <= bestD) {
      best = e;
      bestD = d;
    }
  }
  if (!best) return;
  const len = bestD || 1;
  const dirX = (best.x - from.x) / len;
  const dirZ = (best.z - from.z) / len;
  state.events.push({ kind: 'stormChain', playerId: owner.id, fromX: from.x, fromZ: from.z, toX: best.x, toZ: best.z, y: from.y + 1.1 });
  damageEnemy(state, best, {
    attackerId: owner.id,
    damage: pr.damage * s.stormChainDamage,
    poise: 0.3,
    knockback: 0,
    heavy: false,
    dirX,
    dirZ,
    x: best.x,
    y: best.y + 1.1,
    z: best.z,
    style: 'bow',
    projectile: true,
  });
}

/**
 * Gale Step (the Scout's Disengage): as a Scout's Disengage fires, a second press is open until the
 * backflip ends and `specs.galeWindowS` after; stepPlayer takes it as a free full roll. Both sides
 * step it, so prediction rolls at once.
 */
export function galeStep(state: SimState, p: PlayerState, activeS: number): void {
  if (p.spec?.bow !== 'scout' || p.style !== 'bow' || tuning.specs.galeWindowS <= 0) return;
  p.galeUntil = state.time + activeS + tuning.specs.galeWindowS;
}

/** Whether this hero's second Gale Step press would roll now; a spent window is dropped. */
export function galeReady(state: SimState, p: PlayerState): boolean {
  if (p.galeUntil === undefined) return false;
  if (p.galeUntil > state.time && p.spec?.bow === 'scout' && p.style === 'bow') return true;
  delete p.galeUntil;
  return false;
}

/**
 * Deadeye (the Assassin's signature): an Assassin's charged shot (which already pierces) that strikes
 * an enemy in the back, flying the way it faces within `specs.deadeyeBackDeg` either side, deals
 * `specs.deadeyeCritMult` and shows as a crit. Returns the multiplier, 1 when it does not apply.
 */
export function deadeye(owner: PlayerState | undefined, pr: ProjectileState, e: EnemyState, dirX: number, dirZ: number): number {
  const s = tuning.specs;
  if (!owner || owner.spec?.bow !== 'assassin' || !pr.charged || pr.style !== 'bow') return 1;
  const len = Math.hypot(dirX, dirZ) || 1;
  const along = (dirX / len) * Math.sin(e.yaw) + (dirZ / len) * Math.cos(e.yaw);
  return along >= Math.cos((s.deadeyeBackDeg * Math.PI) / 180) ? s.deadeyeCritMult : 1;
}

/**
 * Venom Volley (the Assassin's Volley): each Volley arrow an Assassin lands adds a stack of poison to
 * its enemy, up to `specs.venomMaxStacks`, and keeps it going `specs.venomSeconds` from now. Called as
 * the arrow lands, a projectile's hit, so the server's alone; `stepVenom` ticks it. A poison already
 * running keeps its beat, so a fresh arrow never makes a tick come early.
 */
export function venomVolley(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, e: EnemyState): void {
  const s = tuning.specs;
  if (!owner || owner.spec?.bow !== 'assassin' || !pr.marks || s.venomSeconds <= 0 || s.venomDamage <= 0 || !isTargetable(e)) return;
  const v = e.venom && e.venom.until > state.time ? e.venom : undefined;
  const stacks = Math.min(Math.max(1, Math.round(s.venomMaxStacks)), (v?.stacks ?? 0) + 1);
  e.venom = { by: owner.id, stacks, until: state.time + s.venomSeconds, next: v ? v.next : state.time + s.venomTickMs / 1000 };
  state.events.push({ kind: 'venom', playerId: owner.id, enemyId: e.id, stacks, x: e.x, y: e.y, z: e.z });
}

/**
 * A poisoned enemy's tick, from the enemy step: `specs.venomDamage` a stack every `specs.venomTickMs`,
 * as damage over time (no hitstop, flinch or poise, as a bleed's), credited to the Assassin's bow.
 * The poison ends with its time, or with the enemy.
 */
export function stepVenom(state: SimState, e: EnemyState, height: number): void {
  const v = e.venom;
  if (!v) return;
  if (e.ai === 'dead' || v.next > v.until) {
    delete e.venom;
    return;
  }
  if (state.time < v.next) return;
  v.next += Math.max(0.05, tuning.specs.venomTickMs / 1000);
  damageEnemy(state, e, {
    attackerId: v.by,
    damage: tuning.specs.venomDamage * v.stacks,
    poise: 0,
    knockback: 0,
    heavy: false,
    dirX: 0,
    dirZ: 0,
    x: e.x,
    y: e.y + height * 0.6,
    z: e.z,
    style: 'bow',
    dot: true,
  });
  if ((e.ai as string) === 'dead') delete e.venom;
}

/**
 * Smoke Bomb (the Assassin's Disengage): as it fires, smoke bursts where the Assassin stood and they
 * vanish for `specs.smokeSeconds`: no enemy picks them as a target, so a fight turns to whoever else
 * stands (and stops, if no one does). Their hits and a strike already swinging still land.
 */
export function smokeBomb(state: SimState, p: PlayerState): void {
  if (p.spec?.bow !== 'assassin' || p.style !== 'bow' || tuning.specs.smokeSeconds <= 0) return;
  p.hiddenUntil = state.time + tuning.specs.smokeSeconds;
  state.events.push({ kind: 'smokeBomb', playerId: p.id, x: p.x, y: p.y, z: p.z });
}

/** Whether enemies have lost this hero in their smoke; a spent smoke is dropped. */
export function isHidden(state: SimState, p: PlayerState): boolean {
  if (p.hiddenUntil === undefined) return false;
  if (p.hiddenUntil > state.time) return true;
  delete p.hiddenUntil;
  return false;
}

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

/**
 * Fan of Knives (the Rogue's Whirlwind): as the spin starts it throws `specs.fanKnives` knives evenly
 * round the Rogue, each `specs.fanKnifeDamage` of a Whirlwind tick's hit, as arrows that pierce
 * nothing; the spin itself is unchanged. Fired with the ability, so prediction throws its own at once,
 * as a Volley's arrows are.
 */
export function fanOfKnives(state: SimState, p: PlayerState): void {
  const s = tuning.specs;
  const n = Math.round(s.fanKnives);
  if (specOf(p) !== 'rogue' || n <= 0) return;
  const payload = { damage: tuning.abilities.whirlwindDamage * s.fanKnifeDamage * tuning.combat.baseDamage, poise: 0.5, knockback: 0, heavy: false };
  state.events.push({ kind: 'fire', playerId: p.id, projectile: 'arrow', heavy: true });
  for (let i = 0; i < n; i++) spawnArrow(state, p, payload, (i / n) * Math.PI * 2, tuning.rangedCombo.arrowSpeed, false);
}

/**
 * From the shadows (the Rogue's signature): a Rogue whose roll passes through an enemy's body is
 * primed for `specs.shadowWindowS`; their next hit on anything crits for `specs.shadowCritMult` and
 * counts as from behind, so a shield does not take it. Checked each tick of the roll in stepPlayer, so
 * prediction primes it too, against the last snapshot's enemies.
 */
export function shadowPass(state: SimState, p: PlayerState): void {
  if (specOf(p) !== 'rogue' || tuning.specs.shadowWindowS <= 0) return;
  const through = state.enemies.some(
    (e) => isTargetable(e) && Math.abs(e.y - p.y) < 1.2 && Math.hypot(e.x - p.x, e.z - p.z) < tuning.movement.radius + enemyStats(e.kind).radius,
  );
  if (!through) return;
  const fresh = (p.shadowUntil ?? -1) <= state.time;
  p.shadowUntil = state.time + tuning.specs.shadowWindowS;
  if (fresh) state.events.push({ kind: 'shadowPrimed', playerId: p.id, x: p.x, y: p.y, z: p.z });
}

/** The multiplier a primed Rogue's hit takes (and spends the priming on), or 1. A bleed's tick never spends it. */
export function shadowStrike(state: SimState, hero: PlayerState, hit: HitSpec): number {
  if (hero.shadowUntil === undefined || hit.dot) return 1;
  const live = hero.shadowUntil > state.time && specOf(hero) === 'rogue';
  delete hero.shadowUntil;
  return live ? tuning.specs.shadowCritMult : 1;
}
