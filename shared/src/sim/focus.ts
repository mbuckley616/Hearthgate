import { tuning, type Style } from '../config/tuning';
import type { PlayerState } from './types';

/**
 * Focus (B7; `docs/bosses.md` 1.7; Michael's A on specializing, 16 Nov): staying in one style through
 * a run is worth a small, visible bonus. Each floor a hero leaves deeper in the style they hold adds
 * `bosses.focusPerFloor` damage in it, up to `focusMaxFloors` floors; a swap to another style loses it
 * all. A swap is allowed, never forbidden: it only costs the bonus.
 */
export function focusBonus(p: PlayerState, style: Style): number {
  const f = p.styleFocus;
  if (!tuning.bosses.focus || !f || f.style !== style || p.henchman) return 0;
  return Math.min(f.floors, Math.round(tuning.bosses.focusMaxFloors)) * tuning.bosses.focusPerFloor;
}

/** A floor gone through (its deeper ring taken): a floor more of focus in the style in hand. */
export function earnFocus(p: PlayerState): void {
  if (!tuning.bosses.focus || p.henchman) return;
  const f = p.styleFocus;
  const floors = f && f.style === p.style ? f.floors + 1 : 1;
  p.styleFocus = { style: p.style, floors: Math.min(floors, Math.round(tuning.bosses.focusMaxFloors)) };
}

/** A swap loses the focus: called each step, so any way the style changes is caught, prediction too. */
export function loseFocusOnSwap(p: PlayerState): void {
  if (p.styleFocus && p.styleFocus.style !== p.style) delete p.styleFocus;
}
