/**
 * Shape of the hit-feedback camera nudge: a fast push out and an eased return.
 * Pure so the client's feel can be unit tested; constants live in sim.ts (HIT_FEEDBACK).
 *
 * Returns the offset in metres along the nudge direction, `elapsedMs` after the hit.
 */
export function nudgeOffset(elapsedMs: number, strengthM: number, durationMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= durationMs || durationMs <= 0) return 0;
  const u = elapsedMs / durationMs;
  // sin gives the out-and-back; the (1 - u) factor pulls the peak early, so the hit reads on contact.
  return strengthM * Math.sin(Math.PI * u) * (1 - u) * NUDGE_PEAK_NORM;
}

/** Normalises the curve so its peak is exactly the requested strength. */
const NUDGE_PEAK_NORM = 1 / peakOf((u) => Math.sin(Math.PI * u) * (1 - u));

function peakOf(f: (u: number) => number): number {
  let best = 0;
  for (let i = 1; i < 1000; i++) best = Math.max(best, f(i / 1000));
  return best;
}

/**
 * What the enemy bar says once no enemy lives. A level without stairs puts its enemies back
 * after `ROOM.resetMs`; one with stairs keeps them dead until the party leaves, so it must not
 * promise a return (critic, 2026-10-06).
 */
export function clearedBarText(level: { stairs?: { x: number; z: number } }): string {
  return level.stairs ? "floor clear" : "returning soon";
}

export type LogLine = { text: string; until: number };

/**
 * Adds a line to the event log at `now` and keeps only the newest `maxLines`, so a burst of
 * events never stacks past the space the HUD gives the log. Mutates `log` in place.
 */
export function pushLogLine(log: LogLine[], text: string, now: number, cfg: { maxLines: number; showMs: number }): void {
  log.push({ text, until: now + cfg.showMs });
  if (log.length > cfg.maxLines) log.splice(0, log.length - cfg.maxLines);
}

/** Drops the lines whose time has passed. Lines are pushed in time order, so expiry is from the front. */
export function expireLogLines(log: LogLine[], now: number): void {
  while (log.length && log[0].until < now) log.shift();
}
