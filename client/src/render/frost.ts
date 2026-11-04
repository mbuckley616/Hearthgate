/**
 * How strongly a Chilled hero's frost shell shows (E1d, Michael's A), stepped once a frame from the
 * level shown last frame. It rises over about `fadeS` as a Chill lands and is held to the Chill's
 * own fall over its last `fadeS`, so the tint ends when the slow does and never shows on a hero who
 * is already warm; a second Chill restarts the slow without the tint blinking out. Pure, so it can
 * be checked without a renderer.
 */
export function frostStep(level: number, chillLeft: number | undefined, peak: number, fadeS: number, dt: number): number {
  const fade = Math.max(fadeS, 1e-3);
  const left = chillLeft === undefined ? 0 : Math.max(0, chillLeft);
  const target = Math.max(0, peak) * Math.min(1, left / fade);
  if (target <= level) return target;
  return Math.min(target, level + (Math.max(0, peak) * dt) / fade);
}
