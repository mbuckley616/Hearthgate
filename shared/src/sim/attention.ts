import { tuning } from '../config/tuning';
import { roleOf } from './roles';
import type { EnemyState, PlayerState, SimState } from './types';

/**
 * A boss's attention (B2, `docs/bosses.md` 1.2; Michael's A on the document, 16 Nov): it picks its
 * next target from those who hit it lately, never the same one more than `bosses.attentionRun`
 * attacks running while another stands, so a party's front hero is not the only one it fights and a
 * hero at range cannot plink unanswered. A taunt still holds it first (`tauntedBy`, before this).
 * The memory is `EnemyState.attn`, the server's alone, set only with `bosses.attention` on.
 */

function attends(e: EnemyState): boolean {
  return tuning.bosses.attention && roleOf(e.kind) === 'boss';
}

/** A hero's hit on a boss: remembered for the boss's next choice. */
export function noteBossHit(state: SimState, e: EnemyState, hero: PlayerState): void {
  if (!attends(e)) return;
  const a = (e.attn ??= { hitAt: {}, runs: 0, pick: true });
  a.hitAt[hero.id] = state.time;
}

/** A boss's attack has run its course: one more on its focus, and its next target is chosen afresh. */
export function bossAttackDone(e: EnemyState): void {
  if (!e.attn) return;
  e.attn.runs++;
  e.attn.pick = true;
}

/**
 * The boss's target among `open` (standing and seen, nearest first), or undefined when attention does
 * not apply. It keeps its focus through an attack and chooses only between attacks.
 */
export function bossTarget(state: SimState, e: EnemyState, open: PlayerState[]): PlayerState | null | undefined {
  if (!attends(e)) return undefined;
  if (!open.length) return null;
  const a = (e.attn ??= { hitAt: {}, runs: 0, pick: true });
  const focus = open.find((p) => p.id === a.focus);
  if (focus && !a.pick) return focus;
  a.pick = false;
  const b = tuning.bosses;
  const recent = open.filter((p) => (a.hitAt[p.id] ?? -Infinity) >= state.time - b.attentionWindowS);
  const pool = recent.length ? recent : open;
  const tired = !!focus && a.runs >= b.attentionRun && open.length > 1;
  if (focus && !tired && pool.includes(focus)) return focus;
  // Someone else: the nearest who hit it lately, or the nearest at all when only the focus did.
  const others = pool.filter((p) => p !== focus);
  const next = (others.length ? others : open.filter((p) => p !== focus))[0] ?? focus ?? open[0];
  if (next.id !== a.focus) a.runs = 0;
  a.focus = next.id;
  return next;
}
