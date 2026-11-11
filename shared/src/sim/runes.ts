import { tuning, type Style } from '../config/tuning';

/**
 * Runes in weapon sockets (the builds pass, Michael's A, 11 Nov; the design doc's Runes line): a
 * weapon has 0 to 2 sockets by rarity, and a rune set in one changes the light finisher or every
 * heavy. Runes are items, so until Phase 3's ledger they live in the browser's save, socketed in the
 * weapon they were set in; the fight sees only `Mods.runes`, the worn weapon's, checked on the
 * server as any loadout is.
 */
export type RuneKind = 'blades' | 'whip' | 'drain' | 'split';

export interface RuneDef {
  name: string;
  /** The style whose weapons it works in; in another it is carried but does nothing. */
  style: Style;
  /** What it changes: the light string's finisher, or every heavy. */
  changes: 'finisher' | 'heavy';
  /** The line the hero screen shows. */
  words: string;
}

export const RUNES: Record<RuneKind, RuneDef> = {
  blades: { name: 'Rune of Blades', style: 'sword', changes: 'finisher', words: 'A light finisher looses two spectral blades' },
  whip: { name: 'Rune of the Whip', style: 'sword', changes: 'heavy', words: 'Every heavy lashes a fire whip ahead' },
  drain: { name: 'Rune of Draining', style: 'staff', changes: 'heavy', words: 'Every heavy’s orb drains health back' },
  split: { name: 'Rune of Splitting', style: 'staff', changes: 'finisher', words: 'A light finisher’s orb splits in three' },
};

export const RUNE_KINDS = Object.keys(RUNES) as RuneKind[];

export function isRuneKind(v: unknown): v is RuneKind {
  return typeof v === 'string' && (RUNE_KINDS as string[]).includes(v);
}

/** The most sockets any weapon has; a loadout carrying more runes is refused. */
export const MAX_SOCKETS = 2;

/**
 * A weapon's sockets: a rare has `runes.rareSockets` (2), a common of tier `runes.commonSocketTier`
 * (3, steel and its kin) or better has one, below that none. Anything not a weapon has none.
 */
export function socketCount(slot: string, rarity: 'common' | 'rare', tier: number): number {
  if (slot !== 'weapon') return 0;
  const r = tuning.runes;
  const n = rarity === 'rare' ? r.rareSockets : tier >= r.commonSocketTier ? 1 : 0;
  return Math.max(0, Math.min(MAX_SOCKETS, Math.round(n)));
}

/**
 * The runes that act for a weapon of `style` with these socketed: known kinds only, each once, no
 * more than its sockets, and only those of its style. Empty when none act.
 */
export function activeRunes(socketed: readonly unknown[] | undefined, sockets: number, style: Style | undefined): RuneKind[] {
  if (!socketed || !style) return [];
  const out: RuneKind[] = [];
  for (const r of socketed.slice(0, sockets)) if (isRuneKind(r) && !out.includes(r) && RUNES[r].style === style) out.push(r);
  return out;
}

/** True when the hero's worn weapon has this rune acting (the fight's one question). */
export function hasRune(mods: { runes?: readonly RuneKind[] }, rune: RuneKind): boolean {
  return !!mods.runes?.includes(rune);
}
