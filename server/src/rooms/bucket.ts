/**
 * The input rate limit: a token bucket counted in commands (one a tick), so garbage costs a
 * sender as much as real input. An honest client makes 60 a second, and a stalled tab that
 * wakes sends up to its frame's backlog at once (the slice caps a frame at eight ticks), so the
 * refill leaves a quarter of headroom and the burst two seconds of ticks.
 */
export const COMMAND_LIMIT = { perSecond: 75, burst: 120 };

export interface CommandBucket {
  tokens: number;
  at: number;
}

export function createCommandBucket(now: number): CommandBucket {
  return { tokens: COMMAND_LIMIT.burst, at: now };
}

/** Spend `n` tokens at wall time `now` (ms); false when the bucket cannot cover them. */
export function takeCommands(b: CommandBucket, n: number, now: number): boolean {
  b.tokens = Math.min(COMMAND_LIMIT.burst, b.tokens + ((now - b.at) / 1000) * COMMAND_LIMIT.perSecond);
  b.at = now;
  if (b.tokens < n) return false;
  b.tokens -= n;
  return true;
}
