/**
 * The client's estimate of the server's clock and how far behind it to draw everyone else:
 * Hearthgate's Phase 0 clock (docs/reference/hearthgate-shelf/clock.ts) brought back in T2 for
 * the lab's lossy row, where the slice's fixed 80 ms delay held the other players still 30
 * times a minute. Pure, so it is unit tested with simulated networks: nothing here reads a
 * clock, every function takes the time (ms) as an argument.
 *
 * The slice tracked the offset as a 5% average of every snapshot's `time - arrival`, so a run of
 * late snapshots pulled the drawn clock later and a single late one still fell outside the fixed
 * delay. Here the offset is "server time minus client time as snapshots reach us on the
 * least-delayed path": the largest sample in a window, the snapshot with the shortest trip. A
 * late snapshot cannot raise it, so drawing `delay` behind it leaves the whole delay as budget
 * for lateness.
 *
 * The same window says how big that budget has to be. At every frame the newest snapshot is
 * some way behind the clock: the wait for the next one so far. On a punctual link it peaks at
 * one snapshot interval; a late snapshot makes it peak at that plus its lateness, and the drawn
 * world holds exactly when it exceeds the delay. So each snapshot remembers the longest wait
 * seen while it was the newest, and the delay follows the window's longest, floored at the
 * slice's `coop.interpDelayMs` and capped at `coop.interpDelayMaxMs`: a clean link draws as the
 * slice did, a lossy one gets what its worst recent snapshot needed. Offset and delay slew, so
 * the drawn world never skips. The wait is measured at the frames that ran, so a stall of this
 * client does not read as lateness.
 */

export interface ClockConfig {
  /** How long a sample counts, ms. */
  windowMs: number;
  /** Fastest the applied offset and delay move, ms per second of client time. */
  slewMsPerS: number;
  /** A target this far from the applied offset is taken at once (the first snapshot, a tab that slept), ms. */
  snapMs: number;
  /** The time between snapshots, ms. */
  intervalMs: number;
  /** The delay's floor (the whole delay on a clean link) and cap, ms. */
  baseMs: number;
  maxMs: number;
}

interface Sample {
  /** serverTime - recvAt for this snapshot. */
  offset: number;
  /** Client time it arrived, for ageing out. */
  at: number;
  /** The longest wait (server ms past its stamp) a frame saw while it was the newest. */
  stale: number;
}

export interface ClockSync {
  samples: Sample[];
  /** The largest offset in the window: the snapshot with the shortest trip from the server. */
  target: number;
  /** The offset in use, slewed toward `target`. */
  offset: number;
  hasOffset: boolean;
  lastStepAt: number;
  newest: Sample | null;
  /** The longest wait any frame in the window saw, less the snapshot interval it always costs, ms. */
  late: number;
  delayTarget: number;
  /** The interpolation delay in use, slewed toward `delayTarget`. */
  delay: number;
}

export function createClockSync(cfg: ClockConfig): ClockSync {
  return { samples: [], target: 0, offset: 0, hasOffset: false, lastStepAt: 0, newest: null, late: 0, delayTarget: cfg.baseMs, delay: cfg.baseMs };
}

/** Record a snapshot stamped `serverTime` that arrived at client time `recvAt`. */
export function addArrivalSample(c: ClockSync, cfg: ClockConfig, recvAt: number, serverTime: number): void {
  const s: Sample = { offset: serverTime - recvAt, at: recvAt, stale: 0 };
  const samples = c.samples;
  // Samples arrive in time order, so the old ones are at the front.
  let old = 0;
  while (old < samples.length && samples[old].at < recvAt - cfg.windowMs) old++;
  if (old > 0) samples.splice(0, old);
  samples.push(s);
  let best = -Infinity;
  let longestWait = 0;
  for (const x of samples) {
    if (x.offset > best) best = x.offset;
    if (x.stale > longestWait) longestWait = x.stale;
  }
  c.target = best;
  setLate(c, cfg, longestWait);
  c.newest = s;
  if (!c.hasOffset) {
    c.offset = c.target;
    c.hasOffset = true;
  }
}

function setLate(c: ClockSync, cfg: ClockConfig, longestWait: number): void {
  c.late = Math.max(0, longestWait - cfg.intervalMs);
  c.delayTarget = Math.min(cfg.maxMs, Math.max(cfg.baseMs, c.late + cfg.intervalMs));
}

/**
 * Move the applied offset toward the target (at most `slewMsPerS` per second, or at once past
 * `snapMs`), measure this frame's wait for the next snapshot, and slew the delay toward what
 * the window asks. Returns the offset in force.
 */
export function stepClock(c: ClockSync, cfg: ClockConfig, now: number): number {
  const dt = c.lastStepAt === 0 ? 0 : Math.max(0, now - c.lastStepAt);
  c.lastStepAt = now;
  const gap = c.target - c.offset;
  if (Math.abs(gap) > cfg.snapMs) {
    c.offset = c.target;
  } else {
    const step = (cfg.slewMsPerS * dt) / 1000;
    c.offset += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
  }
  // Against the target, not the applied offset: the offset sags while the best sample ages out,
  // and a budget that leaned on the sag would be short the moment a fresh best lifted it back.
  const newest = c.newest;
  if (newest) {
    const wait = now + Math.max(c.offset, c.target) - (newest.at + newest.offset);
    if (wait > newest.stale) {
      newest.stale = wait;
      if (wait - cfg.intervalMs > c.late) setLate(c, cfg, wait);
    }
  }
  const dgap = c.delayTarget - c.delay;
  const dstep = (cfg.slewMsPerS * dt) / 1000;
  c.delay += Math.abs(dgap) <= dstep ? dgap : Math.sign(dgap) * dstep;
  return c.offset;
}

/** The server time to draw everyone else at, for client time `now` (ms). */
export function remoteTimeAt(c: ClockSync, cfg: ClockConfig, now: number): number {
  return now + stepClock(c, cfg, now) - c.delay;
}
