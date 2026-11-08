import { ABILITIES, ABILITY_NAMES, enemyStats, tuning, type Style } from '../config/tuning';
import { sphereCast, type Collider } from '../level/geometry';
import { damageEnemy, isTargetable, type HitSpec } from './combat';
import { spawnArrow } from './projectiles';
import { levelFor } from './gear';
import { roleOf, type EnemyRole } from './roles';
import { flowTier, gainFlow } from './flow';
import type { BrambleGround, EnemyState, PlayerState, ProjectileState, SimState, TrailGround } from './types';

/**
 * Specializations (the builds pass; Michael's A, 6 Nov 2026: specializations first, one style a
 * session, Melee's Paladin, Spellblade and Rogue first; trees and states wait). One a style, from
 * that style's level `specs.level`, chosen on the hero screen and kept with the loadout. Plain data
 * the sim reads; a hero with none (the slice, the parity test, anyone under level 10) is unchanged.
 */

export type SpecId = 'paladin' | 'spellblade' | 'rogue' | 'ranger' | 'scout' | 'assassin' | 'warlock' | 'druid' | 'sorcerer';
export type Element = 'holy' | 'fire' | 'frost' | 'earth' | 'air' | 'shadow' | 'nature';
/** A hero's specializations, one a style at most. */
export type Specs = Partial<Record<Style, SpecId>>;
/** The element a hero chose for a style's specialization, where it offers more than one. */
export type SpecElements = Partial<Record<Style, Element>>;
/** The tree nodes a hero picked for a style's specialization (Michael's A, 8 Nov): node ids, one a row at most. */
export type SpecTree = Partial<Record<Style, string[]>>;

/** One choice in a specialization's tree: it strengthens one of the specialization's three pieces. */
export interface TreeNode {
  id: string;
  name: string;
  text: string;
}

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
  /** Its tree (Michael's A, 8 Nov): two choices a row at `TREE_LEVELS`, one pick a row. Absent until built. */
  tree?: readonly (readonly [TreeNode, TreeNode])[];
  /** Its Crescendo at level 50: one capstone that fires as a Flow Crescendo lands. Absent until built. */
  crescendo?: [string, string];
}

/** The style levels a tree's rows open at, and the Crescendo's. */
export const TREE_LEVELS: readonly number[] = [20, 30, 40];
export const CRESCENDO_LEVEL = 50;

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
    tree: [
      [
        { id: 'long-grudge', name: 'Long Grudge', text: 'Shield Rush\'s taunt lasts 5 s.' },
        { id: 'hallowed-ground', name: 'Hallowed Ground', text: 'Consecrate\'s ring is half as wide again.' },
      ],
      [
        { id: 'sanctuary', name: 'Sanctuary', text: 'Consecrate\'s ring lasts 10 s.' },
        { id: 'rallying-light', name: 'Rallying Light', text: 'Bulwark\'s pulse reaches allies within 7 m.' },
      ],
      [
        { id: 'oath-of-mercy', name: 'Oath of Mercy', text: 'Bulwark\'s pulse heals twice as much.' },
        { id: 'wide-rush', name: 'Wide Rush', text: 'Shield Rush also taunts every enemy within 3 m of the one it hits.' },
      ],
    ],
    crescendo: ['Judgement', 'A Crescendo consecrates the ground where you stand and taunts every enemy inside the ring.'],
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
    sig: ['Spectral blades', 'Your spins conjure two blades that circle past your reach.'],
    built: true,
    tree: [
      [
        { id: 'lingering-flame', name: 'Lingering Flame', text: 'Blazing Charge\'s trail lasts 5 s.' },
        { id: 'third-blade', name: 'Third Blade', text: 'Your spins conjure three spectral blades.' },
      ],
      [
        { id: 'wide-wake', name: 'Wide Wake', text: 'Blazing Charge\'s trail is twice as wide.' },
        { id: 'eye-of-the-storm', name: 'Eye of the Storm', text: 'Blade Storm draws in light enemies from 9 m.' },
      ],
      [
        { id: 'searing-path', name: 'Searing Path', text: 'Blazing Charge\'s trail burns twice as hard.' },
        { id: 'keen-edges', name: 'Keen Edges', text: 'Each spectral blade hits for half of a Whirlwind\'s hit.' },
      ],
    ],
    crescendo: ['Blade Tempest', 'A Crescendo lays a trail of your element through where you stand, and your spectral blades strike everything around you at once.'],
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
    tree: [
      [
        { id: 'long-shadow', name: 'Long Shadow', text: 'Shadowstep reaches a target 4 m past the Charge.' },
        { id: 'knife-storm', name: 'Knife Storm', text: 'Fan of Knives throws twelve.' },
      ],
      [
        { id: 'patient-blade', name: 'Patient Blade', text: 'From the shadows waits 6 s for your next hit.' },
        { id: 'honed-knives', name: 'Honed Knives', text: 'Each knife of the fan hits twice as hard.' },
      ],
      [
        { id: 'deep-cut', name: 'Deep Cut', text: 'From the shadows crits for 3x.' },
        { id: 'vanishing-step', name: 'Vanishing Step', text: 'A Shadowstep primes From the shadows.' },
      ],
    ],
    crescendo: ['Thousand Cuts', 'A Crescendo throws a Fan of Knives and primes From the shadows.'],
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
    tree: [
      [
        { id: 'deep-roots', name: 'Deep Roots', text: 'Thornshot roots for 2.5 s.' },
        { id: 'thicket', name: 'Thicket', text: 'Bramble Rain\'s patch is half as wide again.' },
      ],
      [
        { id: 'overgrowth', name: 'Overgrowth', text: 'Bramble Rain\'s patch lasts 8 s.' },
        { id: 'iron-jaws', name: 'Iron Jaws', text: 'Snare Trap holds for 4 s.' },
      ],
      [
        { id: 'twin-snares', name: 'Twin Snares', text: 'Two of your Snare Traps can wait at once.' },
        { id: 'grasping-thorns', name: 'Grasping Thorns', text: 'Thornshot roots every enemy but a boss.' },
      ],
    ],
    crescendo: ['Wildwood', 'A Crescendo grows brambles twice as wide around where you stand.'],
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
    tree: [
      [
        { id: 'hunters-mark', name: 'Hunter\'s Mark', text: 'Your marks last 8 s.' },
        { id: 'forked-lightning', name: 'Forked Lightning', text: 'Storm Volley\'s lightning arcs on to two more enemies.' },
      ],
      [
        { id: 'exposed', name: 'Exposed', text: 'Party hits on your marks deal 20% more.' },
        { id: 'long-arc', name: 'Long Arc', text: 'Storm Volley\'s lightning leaps 9 m.' },
      ],
      [
        { id: 'tailwind', name: 'Tailwind', text: 'Gale Step\'s second press waits 2.5 s.' },
        { id: 'rising-tempo', name: 'Rising Tempo', text: 'Hits on your marks fill your Flow twice as fast.' },
      ],
    ],
    crescendo: ['Stormcaller', 'A Crescendo marks every enemy within 10 m of you.'],
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
    tree: [
      [
        { id: 'cold-eye', name: 'Cold Eye', text: 'Deadeye counts any shot into an enemy\'s back half.' },
        { id: 'virulence', name: 'Virulence', text: 'Venom stacks to eight.' },
      ],
      [
        { id: 'thick-smoke', name: 'Thick Smoke', text: 'Smoke Bomb hides you for 4 s.' },
        { id: 'lingering-venom', name: 'Lingering Venom', text: 'Venom lasts 8 s.' },
      ],
      [
        { id: 'killing-blow', name: 'Killing Blow', text: 'Deadeye crits for 3x.' },
        { id: 'toxic-bite', name: 'Toxic Bite', text: 'Each stack of venom bites twice as hard.' },
      ],
    ],
    crescendo: ['Vanish', 'A Crescendo drops a Smoke Bomb where you stand.'],
  },
  {
    id: 'warlock',
    style: 'staff',
    name: 'Warlock',
    element: 'shadow',
    elements: ['shadow'],
    q: ['Curse Ring', 'Frost ring hexes everything inside.'],
    e: ['Shadow Swap', 'Blink swaps places with the targeted enemy.'],
    sig: ['Hex', 'Your spells hex. Hexed enemies take 10% more from everyone, and your hits on them drain health.'],
    built: true,
  },
  {
    id: 'druid',
    style: 'staff',
    name: 'Druid',
    element: 'nature',
    elements: ['nature', 'earth'],
    q: ['Thorn Ring', 'Frost ring becomes thorns that root.'],
    e: ['Wild Growth', 'Blink leaves a healing grove for 4 s.'],
    sig: ['Bloom', 'Your bolts heal allies they pass through, and root enemies they hit at Flow II and up.'],
    built: true,
  },
  {
    id: 'sorcerer',
    style: 'staff',
    name: 'Sorcerer',
    element: 'fire',
    elements: ['fire', 'frost', 'earth', 'air'],
    q: ['Elemental Nova', 'Frost ring becomes a ring of your element.'],
    e: ['Elemental Step', 'Blink leaves a trail of your element that burns.'],
    sig: ['Attunement', 'Your bolts take your element: Fire bursts, Frost chills then freezes, Earth staggers, Air knocks back and arcs on.'],
    built: true,
  },
];

export const SPEC_IDS: readonly SpecId[] = SPECS.map((s) => s.id);

export function specInfo(id: SpecId): SpecInfo {
  return SPECS.find((s) => s.id === id)!;
}

/** A hero's title in a style with no specialization: the slice's names. */
export const STYLE_TITLES: Record<Style, string> = { sword: 'Knight', bow: 'Archer', staff: 'Mage' };

/** The hero's title in a style: its specialization's name once one is chosen ("Druid"), else the style's ("Mage"). */
export function heroTitle(p: Pick<PlayerState, 'spec'>, style: Style): string {
  const id = p.spec?.[style];
  return id ? specInfo(id).name : STYLE_TITLES[style];
}

/** The name of a style's ability on slot 1 or 2, as its specialization turns it ("Thorn Ring" for a Druid's Frost ring). */
export function abilityTitle(p: Pick<PlayerState, 'spec'>, style: Style, slot: 0 | 1): string {
  const id = p.spec?.[style];
  if (id) return specInfo(id)[slot === 0 ? 'q' : 'e'][0];
  return ABILITY_NAMES[ABILITIES[style][slot]];
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

/** Why these tree picks could not be this hero's, or null: each a node of that style's chosen specialization, one a row, its row opened by level. */
export function treeProblem(xp: Record<Style, number>, specs: Specs, tree: SpecTree): string | null {
  for (const [style, ids] of Object.entries(tree) as [Style, string[]][]) {
    const id = specs[style];
    if (!id) return `no ${style} specialization for a tree`;
    const rows = specInfo(id).tree;
    if (!rows) return `${specInfo(id).name} has no tree yet`;
    const level = levelFor(xp[style] ?? 0);
    const taken = new Set<number>();
    for (const node of ids) {
      const row = rows.findIndex((r) => r.some((n) => n.id === node));
      if (row < 0) return `${node} is not in the ${specInfo(id).name}'s tree`;
      if (taken.has(row)) return `two picks in row ${row + 1}`;
      if (level < TREE_LEVELS[row]) return `row ${row + 1} opens at ${style} level ${TREE_LEVELS[row]}`;
      taken.add(row);
    }
  }
  return null;
}

/** Whether this hero took a tree node of their current specialization (in the style they hold). */
export function hasNode(p: PlayerState, node: string): boolean {
  return !!specOf(p) && !!p.tree?.[p.style]?.includes(node);
}

/** Whether this hero took a tree node of their specialization in `style`, whatever they hold now (a trap laid with the bow still bites). */
export function hasStyleNode(p: PlayerState, style: Style, node: string): boolean {
  return !!p.spec?.[style] && !!p.tree?.[style]?.includes(node);
}

/** Whether this hero's current specialization's Crescendo is theirs: its style at level 50, and the specialization has one. */
export function hasCrescendo(p: PlayerState): boolean {
  const id = specOf(p);
  return !!id && !!specInfo(id).crescendo && levelFor(p.xp[p.style] ?? 0) >= CRESCENDO_LEVEL;
}

/** The capstone, fired as a Crescendo's charged heavy comes out (player.ts), on the server and in prediction alike. */
export function specCrescendo(state: SimState, p: PlayerState): void {
  if (!hasCrescendo(p)) return;
  if (specOf(p) === 'paladin') judgement(state, p);
  else if (specOf(p) === 'spellblade') bladeTempest(state, p);
  else if (specOf(p) === 'ranger') {
    // Wildwood: Bramble Rain's patch at the Ranger's feet, twice as wide.
    const s = tuning.specs;
    seedBrambles(state, p, p.x, p.z, s.brambleRadius * s.wildwoodRadiusMult * (hasStyleNode(p, 'bow', 'thicket') ? s.treeThicketMult : 1));
  } else if (specOf(p) === 'scout') {
    // Stormcaller: every standing enemy near is marked, as an arrow would.
    for (const e of state.enemies) {
      if (isTargetable(e) && Math.abs(e.y - p.y) < 1.2 && Math.hypot(e.x - p.x, e.z - p.z) <= tuning.specs.stormcallRadius) scoutMark(state, p, e);
    }
  } else if (specOf(p) === 'assassin') smokeBomb(state, p);
  else if (specOf(p) === 'rogue') {
    // Thousand Cuts: the fan, and the priming a roll through an enemy would give.
    fanOfKnives(state, p);
    primeShadow(state, p);
  }
}

/**
 * Blade Tempest (the Spellblade's Crescendo): a trail of their element `specs.tempestTrailLength`
 * long, centred on the hero along their facing, and every standing enemy within the Whirlwind's
 * reach plus the blades' band takes each blade's hit at once, as a spin's would. Prediction lays the
 * trail; the hits are judged against the enemies it has, and only the server's count.
 */
function bladeTempest(state: SimState, p: PlayerState): void {
  const s = tuning.specs;
  const a = tuning.abilities;
  const half = s.tempestTrailLength / 2;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const charge = a.chargeDamage * tuning.combat.baseDamage;
  const kept = (state.trails ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  state.trails = kept;
  layTrail(state, p, p.x - fx * half, p.z - fz * half, charge, 'sword');
  const mine = state.trails.find((g) => g.by === p.id)!;
  mine.x1 = p.x + fx * half;
  mine.z1 = p.z + fz * half;
  const blades = bladeCount(p);
  const whirl = a.whirlwindDamage * tuning.combat.baseDamage;
  const reach = a.whirlwindRadius + s.spectralBladeReach;
  if (blades <= 0) return;
  for (const e of state.enemies) {
    if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.max(Math.hypot(dx, dz), 1e-3);
    if (d > reach + enemyStats(e.kind).radius) continue;
    damageEnemy(state, e, {
      attackerId: p.id,
      damage: whirl * bladeDamage(p) * blades,
      poise: 0.4 * blades,
      knockback: 0,
      heavy: false,
      style: p.style,
      dirX: dx / d,
      dirZ: dz / d,
      x: e.x - (dx / d) * enemyStats(e.kind).radius,
      y: e.y + 1,
      z: e.z - (dz / d) * enemyStats(e.kind).radius,
    });
  }
}

/** How many spectral blades circle this Spellblade's spin: `specs.spectralBlades`, one more with Third Blade, four at most. */
export function bladeCount(p: PlayerState): number {
  return Math.min(4, Math.round(tuning.specs.spectralBlades) + (hasNode(p, 'third-blade') ? 1 : 0));
}

/** The share of a Whirlwind's hit each blade deals: `specs.spectralBladeDamage`, or Keen Edges'. */
function bladeDamage(p: PlayerState): number {
  return hasNode(p, 'keen-edges') ? tuning.specs.treeKeenBladeDamage : tuning.specs.spectralBladeDamage;
}

/**
 * Judgement (the Paladin's Crescendo): consecrate where they stand and taunt every standing enemy
 * the new ring reaches. Enemies act on a taunt only on the server, so prediction's copy is drawn and dropped.
 */
function judgement(state: SimState, p: PlayerState): void {
  consecrate(state, p);
  const ring = state.consecrated?.find((g) => g.by === p.id);
  if (!ring) return;
  for (const e of state.enemies) {
    if (isTargetable(e) && Math.hypot(e.x - ring.x, e.z - ring.z) <= ring.radius) taunt(state, p, e, true);
  }
}

/**
 * Shield Rush (the Paladin's Charge): the enemy it hits turns on the Paladin for `specs.tauntSeconds`,
 * whoever is nearer. Called where the Charge lands, on the server and in prediction alike; enemies are
 * only stepped on the server, so only the server's copy acts on it.
 */
export function taunt(state: SimState, p: PlayerState, e: EnemyState, alone = false): void {
  const s = tuning.specs;
  if (specOf(p) !== 'paladin' || s.tauntSeconds <= 0) return;
  const seconds = hasNode(p, 'long-grudge') ? s.treeTauntSeconds : s.tauntSeconds;
  e.taunt = { by: p.id, until: state.time + seconds };
  state.events.push({ kind: 'taunt', playerId: p.id, enemyId: e.id, x: e.x, z: e.z });
  // Wide Rush (the tree's third row): the enemies about the one hit turn too.
  if (alone || !hasNode(p, 'wide-rush')) return;
  for (const o of state.enemies) {
    if (o !== e && isTargetable(o) && Math.hypot(o.x - e.x, o.z - e.z) <= s.treeWideRushRadius) taunt(state, p, o, true);
  }
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
  const radius = s.consecrateRadius * (hasNode(p, 'hallowed-ground') ? s.treeHallowedRadiusMult : 1);
  const seconds = hasNode(p, 'sanctuary') ? s.treeSanctuarySeconds : s.consecrateSeconds;
  kept.push({ by: p.id, x: p.x, y: p.y, z: p.z, radius, until: state.time + seconds });
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
  const reach = hasNode(p, 'rallying-light') ? s.treeRallyingRadius : s.bulwarkRadius;
  const heal = s.bulwarkHeal * (hasNode(p, 'oath-of-mercy') ? s.treeMercyMult : 1);
  for (const o of state.players) {
    if (o.mode === 'down' || o.hp <= 0 || Math.hypot(o.x - p.x, o.z - p.z) > reach) continue;
    const before = o.hp;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * heal);
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
  const grasp = hasStyleNode(owner, 'bow', 'grasping-thorns') && roleOf(e.kind) !== 'boss';
  if (LIGHT_ROLES.has(roleOf(e.kind)) || grasp) {
    const hold = hasStyleNode(owner, 'bow', 'deep-roots') ? s.treeThornRootS : s.thornRootS;
    if (hold <= 0) return;
    const fresh = !isRooted(state, e);
    e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + hold);
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
  seedBrambles(state, p, p.x + dir.x * d, p.z + dir.z * d, s.brambleRadius * (hasStyleNode(p, 'bow', 'thicket') ? s.treeThicketMult : 1));
}

/** A Ranger's bramble patch at (x, z), replacing their last; Overgrowth's lasts longer. */
function seedBrambles(state: SimState, p: PlayerState, x: number, z: number, radius: number): void {
  const s = tuning.specs;
  const kept = (state.brambles ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  const element = elementFor(p, 'bow') ?? 'nature';
  const seconds = hasStyleNode(p, 'bow', 'overgrowth') ? s.treeBrambleSeconds : s.brambleSeconds;
  kept.push({ by: p.id, x, y: p.y, z, radius, until: state.time + seconds, element });
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
  const live = (state.snares ?? []).filter((g) => g.until > state.time);
  // One a Ranger, or two with Twin Snares: the newest of the old ones stays.
  const mine = live.filter((g) => g.by === p.id);
  const keep = hasStyleNode(p, 'bow', 'twin-snares') ? mine.slice(-1) : [];
  const kept = [...live.filter((g) => g.by !== p.id), ...keep];
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
    const owner = state.players.find((o) => o.id === g.by);
    const hold = owner && hasStyleNode(owner, 'bow', 'iron-jaws') ? tuning.specs.treeSnareRootS : tuning.specs.snareRootS;
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
  e.scoutMark = { by: owner.id, until: state.time + (hasStyleNode(owner, 'bow', 'hunters-mark') ? tuning.specs.treeMarkSeconds : tuning.specs.markSeconds) };
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
  const s = tuning.specs;
  const scout = state.players.find((p) => p.id === m.by);
  gainFlow(scout, s.markFlowGain * (scout && hasStyleNode(scout, 'bow', 'rising-tempo') ? s.treeTempoFlowMult : 1));
  return 1 + (scout && hasStyleNode(scout, 'bow', 'exposed') ? s.treeExposedBonus : s.markDamageBonus);
}

/**
 * What any hit on a hexed enemy is multiplied by: `1 + specs.hexDamageBonus` while the Warlock's hex
 * lasts, everyone's hits alike. A tick of damage over time takes nothing; a spent hex is dropped.
 */
export function hexedMult(state: SimState, e: EnemyState, hero: PlayerState | undefined, dot: boolean | undefined): number {
  const h = e.hex;
  if (!h) return 1;
  if (h.until <= state.time) {
    delete e.hex;
    return 1;
  }
  return hero && !dot ? 1 + tuning.specs.hexDamageBonus : 1;
}

/**
 * Hex (the Warlock's signature), after a hit's damage: a Warlock's staff hit on an enemy already
 * hexed drains `specs.hexDrain` of its damage back as the Warlock's health, and every staff hit of
 * theirs hexes (again) for `specs.hexSeconds`. Bolts and bursts are the server's, so the drain is too.
 */
export function warlockHex(state: SimState, e: EnemyState, hero: PlayerState | undefined, hit: HitSpec, damage: number, wasHexed: boolean): void {
  const s = tuning.specs;
  if (!hero || hero.spec?.staff !== 'warlock' || hit.style !== 'staff' || hit.dot || s.hexSeconds <= 0) return;
  if (wasHexed && hero.mode !== 'down' && s.hexDrain > 0) hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, damage) * s.hexDrain);
  const fresh = !e.hex || e.hex.until <= state.time;
  // An orb never cuts short a longer hex a Curse Ring left.
  e.hex = { by: hero.id, until: Math.max(fresh ? 0 : e.hex!.until, state.time + s.hexSeconds) };
  if (fresh) state.events.push({ kind: 'hexed', playerId: hero.id, enemyId: e.id, x: e.x, y: e.y, z: e.z });
}

/** Whether this hero's frost ring is a Warlock's Curse Ring: it hexes, and freezes nothing. */
export function isCurseRing(p: PlayerState): boolean {
  return p.spec?.staff === 'warlock' && p.style === 'staff' && tuning.specs.curseRingHexS > 0;
}

/**
 * Curse Ring (the Warlock's frost ring): every enemy the ring reaches is hexed for `specs.curseRingHexS`
 * (longer than an orb's), whether the ring's own hit got through a shield or not. The ring is shadow,
 * not frost, so it freezes nothing (and so sets up no Shatter). Stepped where the ring fires, both sides.
 */
export function curseRing(state: SimState, p: PlayerState, e: EnemyState): void {
  if (!isCurseRing(p) || !isTargetable(e)) return;
  const until = state.time + tuning.specs.curseRingHexS;
  if (!e.hex || e.hex.until < until) e.hex = { by: p.id, until };
}

/**
 * Shadow Swap (the Warlock's Blink): with an enemy targeted as the Blink starts, no further than the
 * Blink would go plus `specs.swapReach` and on the same level, the Warlock and it change places, the
 * enemy turned about; a boss is too heavy to move and the Blink goes as ever. Both sides step it, so
 * prediction swaps at once and the server's copy of the enemy settles where it lands.
 */
export function shadowSwap(state: SimState, p: PlayerState, blinkDistance: number): boolean {
  if (p.spec?.staff !== 'warlock' || p.style !== 'staff' || tuning.specs.swapReach < 0 || p.attackTarget < 0) return false;
  const e = state.enemies.find((o) => o.id === p.attackTarget);
  if (!e || !isTargetable(e) || roleOf(e.kind) === 'boss' || Math.abs(e.y - p.y) > 1.2) return false;
  if (Math.hypot(e.x - p.x, e.z - p.z) > blinkDistance + tuning.specs.swapReach) return false;
  const from = { x: p.x, z: p.z };
  p.x = e.x;
  p.z = e.z;
  e.x = from.x;
  e.z = from.z;
  e.yaw += Math.PI;
  p.yaw = Math.atan2(e.x - p.x, e.z - p.z);
  state.events.push({ kind: 'blink', playerId: p.id, fromX: from.x, fromZ: from.z, toX: p.x, toZ: p.z, swap: true });
  return true;
}

/** Whether this bolt is a Druid's, whose flight heals the allies it passes through (Bloom). */
export function isBloomBolt(state: SimState, pr: ProjectileState): boolean {
  if (pr.kind !== 'bolt' || pr.style !== 'staff' || pr.hostile || tuning.specs.bloomHeal <= 0) return false;
  return state.players.find((p) => p.id === pr.owner)?.spec?.staff === 'druid';
}

/**
 * Bloom (the Druid's signature), as a Druid's bolt passes through a standing ally (a friend or a
 * henchman, never the Druid): it heals them `specs.bloomHeal` of their own health, once a bolt, and
 * flies on. Projectiles are the server's, so the heal is too.
 */
export function bloomHeal(state: SimState, pr: ProjectileState, ally: PlayerState): void {
  if (ally.id === pr.owner || ally.mode === 'down' || pr.healedIds?.includes(ally.id)) return;
  (pr.healedIds ??= []).push(ally.id);
  const healed = Math.min(ally.maxHp - ally.hp, ally.maxHp * tuning.specs.bloomHeal);
  if (healed <= 0) return;
  ally.hp += healed;
  state.events.push({ kind: 'bloom', playerId: pr.owner, healedId: ally.id, x: ally.x, y: ally.y, z: ally.z, healed });
}

/**
 * Bloom's root: a Druid's bolt that lands while they are at Flow tier `specs.bloomRootTier` or above
 * roots a light enemy for `specs.bloomRootS`, as a Thornshot does (a heavier one is not slowed).
 */
export function bloomRoot(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, e: EnemyState): void {
  const s = tuning.specs;
  if (!owner || owner.spec?.staff !== 'druid' || pr.kind !== 'bolt' || s.bloomRootS <= 0 || e.ai === 'dead') return;
  if (flowTier(owner) < s.bloomRootTier || !LIGHT_ROLES.has(roleOf(e.kind))) return;
  const fresh = !isRooted(state, e);
  e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + s.bloomRootS);
  if (fresh) state.events.push({ kind: 'rooted', playerId: owner.id, enemyId: e.id, x: e.x, z: e.z });
}

/** Whether this hero's frost ring is a Druid's Thorn Ring: it roots, and freezes nothing. */
export function isThornRing(p: PlayerState): boolean {
  return p.spec?.staff === 'druid' && p.style === 'staff' && tuning.specs.thornRingRootS > 0;
}

/**
 * Thorn Ring (the Druid's frost ring): thorns burst up where the ring reaches, rooting every light
 * enemy there for `specs.thornRingRootS` and slowing a heavier one as long; nothing freezes (so no
 * Shatter is set up). Stepped where the ring fires, both sides.
 */
export function thornRing(state: SimState, p: PlayerState, e: EnemyState): void {
  if (!isThornRing(p) || !isTargetable(e)) return;
  const t = tuning.specs.thornRingRootS;
  if (LIGHT_ROLES.has(roleOf(e.kind))) {
    const fresh = !isRooted(state, e);
    e.rootUntil = Math.max(e.rootUntil ?? 0, state.time + t);
    if (fresh) state.events.push({ kind: 'rooted', playerId: p.id, enemyId: e.id, x: e.x, z: e.z });
  } else {
    e.slowTime = Math.max(e.slowTime, t);
  }
}

/**
 * Storm Volley (the Scout's Volley): each Volley arrow a Scout lands arcs lightning on to the nearest
 * other enemy within `specs.stormChainRange` it has not already hit, for `specs.stormChainDamage` of
 * the arrow's damage, at once. Called as the arrow lands, a projectile's hit, so the server's alone.
 */
export function stormChain(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, from: EnemyState): void {
  const s = tuning.specs;
  if (!owner || owner.spec?.bow !== 'scout' || !pr.marks || s.stormChainDamage <= 0) return;
  // Forked Lightning hops on from each enemy it reaches; never back to one the arrow or a hop has hit.
  const hops = 1 + (hasStyleNode(owner, 'bow', 'forked-lightning') ? Math.round(s.treeForkHops) : 0);
  const range = hasStyleNode(owner, 'bow', 'long-arc') ? s.treeArcRange : s.stormChainRange;
  const struck = [from];
  let at = from;
  for (let h = 0; h < hops; h++) {
    let best: EnemyState | null = null;
    let bestD = range;
    for (const e of state.enemies) {
      if (struck.includes(e) || !isTargetable(e) || pr.hitIds.includes(e.id) || Math.abs(e.y - at.y) > 1.2) continue;
      const d = Math.hypot(e.x - at.x, e.z - at.z);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return;
    const len = bestD || 1;
    const dirX = (best.x - at.x) / len;
    const dirZ = (best.z - at.z) / len;
    state.events.push({ kind: 'stormChain', playerId: owner.id, fromX: at.x, fromZ: at.z, toX: best.x, toZ: best.z, y: at.y + 1.1 });
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
    struck.push(best);
    at = best;
  }
}

/**
 * Gale Step (the Scout's Disengage): as a Scout's Disengage fires, a second press is open until the
 * backflip ends and `specs.galeWindowS` after; stepPlayer takes it as a free full roll. Both sides
 * step it, so prediction rolls at once.
 */
export function galeStep(state: SimState, p: PlayerState, activeS: number): void {
  if (p.spec?.bow !== 'scout' || p.style !== 'bow' || tuning.specs.galeWindowS <= 0) return;
  p.galeUntil = state.time + activeS + (hasNode(p, 'tailwind') ? tuning.specs.treeGaleWindowS : tuning.specs.galeWindowS);
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
  const arc = hasStyleNode(owner, 'bow', 'cold-eye') ? s.treeDeadeyeBackDeg : s.deadeyeBackDeg;
  const crit = hasStyleNode(owner, 'bow', 'killing-blow') ? s.treeDeadeyeCritMult : s.deadeyeCritMult;
  return along >= Math.cos((arc * Math.PI) / 180) ? crit : 1;
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
  const cap = hasStyleNode(owner, 'bow', 'virulence') ? s.treeVenomStacks : s.venomMaxStacks;
  const stacks = Math.min(Math.max(1, Math.round(cap)), (v?.stacks ?? 0) + 1);
  const seconds = hasStyleNode(owner, 'bow', 'lingering-venom') ? s.treeVenomSeconds : s.venomSeconds;
  e.venom = { by: owner.id, stacks, until: state.time + seconds, next: v ? v.next : state.time + s.venomTickMs / 1000 };
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
  const owner = state.players.find((o) => o.id === v.by);
  const bite = owner && hasStyleNode(owner, 'bow', 'toxic-bite') ? tuning.specs.treeVenomMult : 1;
  damageEnemy(state, e, {
    attackerId: v.by,
    damage: tuning.specs.venomDamage * v.stacks * bite,
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
  p.hiddenUntil = state.time + (hasNode(p, 'thick-smoke') ? tuning.specs.treeSmokeSeconds : tuning.specs.smokeSeconds);
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
    if (d > (hasNode(p, 'eye-of-the-storm') ? s.treeStormRadius : s.bladeStormRadius) || d <= s.bladeStormHold) continue;
    // Set, not add: a pull is a steady draw, never a launch that grows tick on tick.
    e.kbx = (dx / d) * v;
    e.kbz = (dz / d) * v;
  }
}

/**
 * Where the first of a Spellblade's spectral blades is, as a yaw about the hero, `u` of the way
 * through the Whirlwind's spin (0 to 1): once round from where the hero faces. The others are evenly
 * spaced behind it. Shared by the sim's hits and the view, so a blade lands where it is drawn.
 */
export function spectralBladeYaw(yaw: number, u: number, blade: number, blades: number): number {
  return yaw + u * Math.PI * 2 + (blade * Math.PI * 2) / Math.max(1, blades);
}

/** The angle from a to b, wrapped to (-π, π]. */
function wrapAngle(a: number): number {
  const t = Math.PI * 2;
  return a - Math.round(a / t) * t;
}

/**
 * Spectral blades (the Spellblade's signature; Michael, 6 Nov, A), each tick of the spin: each of
 * `specs.spectralBlades` swords sweeps from where it was at `u0` to `u1` of the spin, and every
 * standing enemy in the band from the Whirlwind's `reach` to `specs.spectralBladeReach` past it that
 * the sweep crosses takes `specs.spectralBladeDamage` of `whirl`, the Whirlwind's damage, once a
 * blade a spin (kept in `abilityHitIds` as id times eight plus the blade, so it never meets a
 * Charge's). Stepped in stepAbility, so prediction swings the blades as the spin does.
 */
export function spectralBlades(state: SimState, p: PlayerState, u0: number, u1: number, reach: number, whirl: number): void {
  const s = tuning.specs;
  const blades = bladeCount(p);
  const share = bladeDamage(p);
  if (specOf(p) !== 'spellblade' || blades <= 0 || share <= 0 || u1 <= u0) return;
  for (const e of state.enemies) {
    if (!isTargetable(e) || Math.abs(e.y - p.y) > 1.2) continue;
    const er = enemyStats(e.kind).radius;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < reach || d > reach + s.spectralBladeReach + er) continue;
    const at = Math.atan2(dx, dz);
    // The enemy's body covers this much of the circle, so a blade grazing it still counts.
    const tol = Math.asin(Math.min(1, er / Math.max(d, 1e-3)));
    for (let b = 0; b < blades; b++) {
      const key = e.id * 8 + b;
      if (p.abilityHitIds.includes(key)) continue;
      const from = spectralBladeYaw(p.yaw, u0, b, blades);
      const sweep = (u1 - u0) * Math.PI * 2;
      const off = wrapAngle(at - from);
      const ahead = off < -tol ? off + Math.PI * 2 : off;
      if (ahead > sweep + tol) continue;
      p.abilityHitIds.push(key);
      damageEnemy(state, e, {
        attackerId: p.id,
        damage: whirl * share,
        poise: 0.4,
        knockback: 0,
        heavy: false,
        style: p.style,
        dirX: dx / Math.max(d, 1e-3),
        dirZ: dz / Math.max(d, 1e-3),
        x: e.x - (dx / Math.max(d, 1e-3)) * er,
        y: e.y + 1,
        z: e.z - (dz / Math.max(d, 1e-3)) * er,
      });
    }
  }
}

/**
 * Blazing Charge (the Spellblade's Charge; Michael, 6 Nov, A): each tick of the dash lengthens a
 * strip `specs.blazingTrailWidth` wide from where it began to where the hero is now, lasting
 * `specs.blazingTrailSeconds` from the dash's last tick; one a Spellblade, a new Charge's replacing
 * their last. `charge` is the Charge's damage, of which the trail deals `specs.blazingTrailDamage` a
 * second. Laid in stepAbility, so prediction draws its own at once; only the server's burns.
 */
export function blazingTrail(state: SimState, p: PlayerState, fromX: number, fromZ: number, charge: number): void {
  if (specOf(p) !== 'spellblade' || tuning.specs.blazingTrailSeconds <= 0) return;
  const mine = state.trails?.find((g) => g.by === p.id && g.seq === p.abilitySeq);
  if (mine) {
    mine.x1 = p.x;
    mine.z1 = p.z;
    mine.until = state.time + trailSeconds(p, 'sword');
    return;
  }
  layTrail(state, p, fromX, fromZ, charge, 'sword');
}

/**
 * Elemental Step (the Sorcerer's Blink; Michael's A on the Spellblade's trail, 6 Nov, which settles
 * this one too): the Blink leaves Blazing Charge's strip, its numbers and all, from where the
 * Sorcerer stood to where they land, in their element. Its damage is the Charge's, so the two trails
 * burn alike. Fired with the Blink in stepAbility; only the server's burns.
 */
export function elementalStep(state: SimState, p: PlayerState, fromX: number, fromZ: number): boolean {
  if (p.spec?.staff !== 'sorcerer' || p.style !== 'staff' || tuning.specs.blazingTrailSeconds <= 0) return false;
  layTrail(state, p, fromX, fromZ, tuning.abilities.chargeDamage * tuning.combat.baseDamage, 'staff');
  return true;
}

/** How long a trail this hero lays lasts: `specs.blazingTrailSeconds`, or Lingering Flame's for a Spellblade. */
function trailSeconds(p: PlayerState, style: 'sword' | 'staff'): number {
  return style === 'sword' && hasNode(p, 'lingering-flame') ? tuning.specs.treeLingerSeconds : tuning.specs.blazingTrailSeconds;
}

/** A new trail from (fromX, fromZ) to the hero, replacing the hero's last. */
function layTrail(state: SimState, p: PlayerState, fromX: number, fromZ: number, damage: number, style: 'sword' | 'staff'): void {
  const s = tuning.specs;
  const kept = (state.trails ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  const tick = Math.max(0.05, s.blazingTrailTickMs / 1000);
  kept.push({
    by: p.id,
    seq: p.abilitySeq,
    style,
    x0: fromX,
    z0: fromZ,
    x1: p.x,
    z1: p.z,
    y: p.y,
    width: s.blazingTrailWidth * (style === 'sword' && hasNode(p, 'wide-wake') ? s.treeWakeWidthMult : 1),
    until: state.time + trailSeconds(p, style),
    tickDamage: damage * s.blazingTrailDamage * tick * (style === 'sword' && hasNode(p, 'searing-path') ? s.treeSearingMult : 1),
    next: state.time + tick,
    element: elementFor(p, style) ?? 'fire',
  });
  state.trails = kept;
}

/** Distance in the ground plane from (x, z) to a trail's strip. */
function trailDistance(g: TrailGround, x: number, z: number): number {
  const dx = g.x1 - g.x0;
  const dz = g.z1 - g.z0;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - g.x0) * dx + (z - g.z0) * dz) / len2)) : 0;
  return Math.hypot(x - (g.x0 + dx * t), z - (g.z0 + dz * t));
}

/**
 * Each trail's tick, from stepSim: every standing enemy in it takes its `tickDamage` as damage over
 * time (no flinch or poise, as a poison's), credited to the style that laid it. The server's alone;
 * spent trails leave the state.
 */
export function stepTrails(state: SimState): void {
  const live = state.trails!.filter((g) => g.until > state.time);
  if (live.length === 0) {
    delete state.trails;
    return;
  }
  state.trails = live;
  for (const g of live) {
    if (state.time < g.next) continue;
    g.next += Math.max(0.05, tuning.specs.blazingTrailTickMs / 1000);
    if (g.tickDamage <= 0) continue;
    for (const e of state.enemies) {
      if (!isTargetable(e) || Math.abs(e.y - g.y) > 1.2) continue;
      if (trailDistance(g, e.x, e.z) > g.width / 2 + enemyStats(e.kind).radius) continue;
      damageEnemy(state, e, {
        attackerId: g.by,
        damage: g.tickDamage,
        poise: 0,
        knockback: 0,
        heavy: false,
        dirX: 0,
        dirZ: 0,
        x: e.x,
        y: e.y + 1,
        z: e.z,
        style: g.style,
        dot: true,
      });
    }
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
  const reach = tuning.abilities.chargeDistance + (hasNode(p, 'long-shadow') ? tuning.specs.treeShadowstepReach : tuning.specs.shadowstepReach) + er;
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
  if (hasNode(p, 'vanishing-step')) primeShadow(state, p);
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
  const n = Math.round(hasNode(p, 'knife-storm') ? s.treeFanKnives : s.fanKnives);
  if (specOf(p) !== 'rogue' || n <= 0) return;
  const honed = hasNode(p, 'honed-knives') ? s.treeKnifeMult : 1;
  const payload = { damage: tuning.abilities.whirlwindDamage * s.fanKnifeDamage * honed * tuning.combat.baseDamage, poise: 0.5, knockback: 0, heavy: false };
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
  if (through) primeShadow(state, p);
}

/** Prime From the shadows for `specs.shadowWindowS` (Patient Blade's, with it), with its cue when it was not already primed. */
function primeShadow(state: SimState, p: PlayerState): void {
  const fresh = (p.shadowUntil ?? -1) <= state.time;
  p.shadowUntil = state.time + (hasNode(p, 'patient-blade') ? tuning.specs.treeShadowWindowS : tuning.specs.shadowWindowS);
  if (fresh) state.events.push({ kind: 'shadowPrimed', playerId: p.id, x: p.x, y: p.y, z: p.z });
}

/** The multiplier a primed Rogue's hit takes (and spends the priming on), or 1. A bleed's tick never spends it. */
export function shadowStrike(state: SimState, hero: PlayerState, hit: HitSpec): number {
  if (hero.shadowUntil === undefined || hit.dot) return 1;
  const live = hero.shadowUntil > state.time && specOf(hero) === 'rogue';
  delete hero.shadowUntil;
  return live ? (hasNode(hero, 'deep-cut') ? tuning.specs.treeShadowCritMult : tuning.specs.shadowCritMult) : 1;
}

/**
 * Wild Growth (the Druid's Blink): where the Druid stood as they blinked, a grove `specs.groveRadius`
 * across grows for `specs.groveSeconds`; one a Druid, a new one replacing their last. Fired with the
 * Blink, so prediction draws its own at once and the server's copy replaces it with the next snapshot.
 * Returns whether it grew, for the Blink's event.
 */
export function wildGrowth(state: SimState, p: PlayerState, x: number, z: number): boolean {
  const s = tuning.specs;
  if (p.spec?.staff !== 'druid' || p.style !== 'staff' || s.groveSeconds <= 0) return false;
  const kept = (state.groves ?? []).filter((g) => g.by !== p.id && g.until > state.time);
  const element = elementFor(p, 'staff') ?? 'nature';
  kept.push({ by: p.id, x, y: p.y, z, radius: s.groveRadius, until: state.time + s.groveSeconds, element });
  state.groves = kept;
  return true;
}

/**
 * Each tick every standing ally inside a live grove (a hero or a henchman, the Druid too) heals
 * `specs.groveHealPerS` of their health a second, never past full; groves overlapping heal once.
 * Health is the server's, so prediction never heals; spent groves leave the state.
 */
export function stepGroves(state: SimState, dt: number): void {
  const live: BrambleGround[] = state.groves!.filter((g) => g.until > state.time);
  if (live.length === 0) {
    delete state.groves;
    return;
  }
  state.groves = live;
  const rate = tuning.specs.groveHealPerS;
  if (rate <= 0) return;
  for (const o of state.players) {
    if (o.mode === 'down' || o.hp <= 0 || o.hp >= o.maxHp) continue;
    if (!live.some((g) => Math.abs(o.y - g.y) < 1.2 && Math.hypot(o.x - g.x, o.z - g.z) <= g.radius)) continue;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * rate * dt);
  }
}

/** The element a Sorcerer's staff bolt carries (Attunement), or undefined for anyone else's. */
export function attunedElement(owner: PlayerState | undefined, pr: ProjectileState): Element | undefined {
  if (!owner || owner.spec?.staff !== 'sorcerer' || pr.kind !== 'bolt' || pr.style !== 'staff' || pr.hostile) return undefined;
  return elementFor(owner, 'staff');
}

/**
 * Attunement (the Sorcerer's signature), before a Sorcerer's bolt lands: the element reshapes the
 * hit. Frost slows for `specs.attuneChillS` and counts; the `specs.attuneFreezeHits`th bolt on a
 * still-Chilled enemy freezes it `specs.attuneFreezeS` instead (a Shatter setup either way, as the
 * staff's slows are). Earth multiplies the bolt's poise by `specs.attuneEarthPoise`, so a few bolts
 * stagger; Air pushes at least `specs.attuneAirKnockback`. Fire's burst comes after (`attuneAfter`).
 */
export function attuneHit(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, e: EnemyState, hit: HitSpec): void {
  const el = attunedElement(owner, pr);
  const s = tuning.specs;
  if (el === 'frost' && s.attuneChillS > 0) {
    const hits = (e.attuneChill && e.attuneChill.until >= state.time ? e.attuneChill.hits : 0) + 1;
    if (s.attuneFreezeHits > 0 && hits >= s.attuneFreezeHits) {
      hit.freezeTime = Math.max(hit.freezeTime ?? 0, s.attuneFreezeS);
      delete e.attuneChill;
    } else {
      hit.slowTime = Math.max(hit.slowTime ?? 0, s.attuneChillS);
      e.attuneChill = { hits, until: state.time + s.attuneChillS };
    }
  } else if (el === 'earth') {
    hit.poise *= s.attuneEarthPoise;
  } else if (el === 'air') {
    hit.knockback = Math.max(hit.knockback, s.attuneAirKnockback);
  }
}

/**
 * Attunement, after a Sorcerer's bolt lands: Fire bursts, every other standing enemy within
 * `specs.attuneFireRadius` taking `specs.attuneFireDamage` of the bolt; Air arcs on to the nearest
 * other enemy within `specs.attuneAirRange` for `specs.attuneAirDamage`, pushing it on. Each element
 * says so in an `attune` event for the views. The server's alone, as every projectile hit is.
 */
export function attuneAfter(state: SimState, owner: PlayerState | undefined, pr: ProjectileState, from: EnemyState): void {
  const el = attunedElement(owner, pr);
  if (!owner || !el) return;
  const s = tuning.specs;
  const y = from.y + 1.1;
  if (el === 'fire' && s.attuneFireDamage > 0) {
    state.events.push({ kind: 'attune', playerId: owner.id, element: el, x: from.x, y, z: from.z, radius: s.attuneFireRadius });
    for (const e of state.enemies) {
      if (e === from || !isTargetable(e) || Math.abs(e.y - from.y) > 1.2) continue;
      const dx = e.x - from.x;
      const dz = e.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > s.attuneFireRadius + enemyStats(e.kind).radius) continue;
      damageEnemy(state, e, {
        attackerId: owner.id, damage: pr.damage * s.attuneFireDamage, poise: 0.3, knockback: 0.3, heavy: false,
        dirX: d > 0 ? dx / d : 0, dirZ: d > 0 ? dz / d : 1, x: e.x, y: e.y + 1, z: e.z, style: 'staff', projectile: true,
      });
    }
    return;
  }
  if (el === 'air' && s.attuneAirDamage > 0) {
    let best: EnemyState | null = null;
    let bestD = s.attuneAirRange;
    for (const e of state.enemies) {
      if (e === from || !isTargetable(e) || pr.hitIds.includes(e.id) || Math.abs(e.y - from.y) > 1.2) continue;
      const d = Math.hypot(e.x - from.x, e.z - from.z);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) {
      state.events.push({ kind: 'attune', playerId: owner.id, element: el, x: from.x, y, z: from.z, radius: 0 });
      return;
    }
    const len = bestD || 1;
    state.events.push({ kind: 'attune', playerId: owner.id, element: el, x: from.x, y, z: from.z, radius: 0, toX: best.x, toZ: best.z });
    damageEnemy(state, best, {
      attackerId: owner.id, damage: pr.damage * s.attuneAirDamage, poise: 0.3, knockback: s.attuneAirKnockback, heavy: false,
      dirX: (best.x - from.x) / len, dirZ: (best.z - from.z) / len, x: best.x, y: best.y + 1.1, z: best.z, style: 'staff', projectile: true,
    });
    return;
  }
  state.events.push({ kind: 'attune', playerId: owner.id, element: el, x: from.x, y, z: from.z, radius: 0 });
}

/**
 * The element of a Sorcerer's Elemental Nova (their frost ring), or undefined where the ring is the
 * frost ring: anyone else's, or a Frost Sorcerer's, which freezes as it always did.
 */
export function novaElement(p: PlayerState): Element | undefined {
  if (p.spec?.staff !== 'sorcerer' || p.style !== 'staff') return undefined;
  const el = elementFor(p, 'staff');
  return el === 'frost' ? undefined : el;
}

/**
 * Elemental Nova (the Sorcerer's frost ring): a ring of their element, doing to everything it
 * reaches what Attunement's bolt does, and freezing nothing. Fire hits `specs.novaFireDamage` times as
 * hard; Earth's poise is multiplied by `specs.attuneEarthPoise`, a stagger the sooner; Air throws
 * them `specs.attuneAirKnockback` outward. Stepped where the ring fires, both sides.
 */
export function elementalNova(p: PlayerState, hit: HitSpec): void {
  const el = novaElement(p);
  if (!el) return;
  const s = tuning.specs;
  hit.freezeTime = undefined;
  if (el === 'fire') hit.damage *= s.novaFireDamage;
  else if (el === 'earth') hit.poise *= s.attuneEarthPoise;
  else if (el === 'air') hit.knockback = Math.max(hit.knockback, s.attuneAirKnockback);
}
