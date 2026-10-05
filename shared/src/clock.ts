/**
 * Clock sync estimator for the client, pure so it can be unit tested with simulated
 * networks. Constants live in sim.ts (CLOCK_SYNC). Nothing here reads a clock: every
 * function takes the time as an argument.
 *
 * The offset estimated here is "server simulation time minus client time as the server's
 * messages reach us on the least-delayed path": a snapshot stamped t arrives at or after
 * client time t - offset. Drawing remote players `delay` behind serverTimeAt() therefore
 * leaves `delay` of budget for a late packet, and that budget stays put under jitter
 * because a late packet cannot raise the estimate.
 *
 * The same window says how big that budget has to be. At every frame the newest patch is
 * some way behind the clock: `now + offset - (its stamp)`, the wait for the next one so far.
 * On a punctual link that peaks at one tick; a late patch makes it peak at a tick plus its
 * lateness, and a remote player holds exactly when it exceeds the delay. So each patch
 * sample remembers the longest wait seen while it was the newest, the window's largest is
 * `late` (less the tick), and the delay target is `late` plus a tick, floored at
 * INTERP.baseMs and capped at INTERP.maxMs: a clean link draws at the base, a jittery one
 * gets what its worst recent packet needed, and the delay slews like the offset so the drawn
 * remote never skips. The wait is measured at the frames that ran, not at arrival, so a
 * stall of this client (a page still loading, a background tab) does not read as lateness:
 * nothing was drawn while it waited, and the patches it missed arrive before its next frame.
 *
 * Every stamped message from the server gives one sample, serverTime - recvAt = (true
 * offset) - (trip from server to client): ping replies, which also measure the round trip
 * for the HUD, and the patches themselves, which arrive twenty times a second stamped with
 * their tick. The largest sample in the window is the message with the shortest trip, the
 * one least delayed by queueing, so that is the target. (The lowest round trip is close,
 * but a quick outbound leg can pick a slow return, and the return is what snapshots ride.)
 * When that sample ages out the target can only fall, which adds a little delay; a new
 * sample can only raise it toward the floor. Neither ever jumps the drawn clock: the
 * applied offset slews at CLOCK_SYNC.slewMsPerS.
 */
import { CLOCK_SYNC, INTERP, TICK_MS } from "./sim";

export interface ClockSample {
  /** Round trip for a ping reply; Infinity for a patch, which measures only the trip here. */
  rtt: number;
  /** serverTime - recvAt for this message. */
  offset: number;
  /** Client time it arrived, for ageing out. */
  at: number;
  /** For a patch: the longest wait (server ms past its stamp) a frame saw while it was the newest. */
  stale: number;
}

export interface ClockSync {
  samples: ClockSample[];
  /** The largest offset in the window: the message with the shortest trip from the server. */
  target: number;
  /** The offset in use, slewed toward `target`. */
  offset: number;
  hasOffset: boolean;
  lastStepAt: number;
  /** The newest patch, whose wait the frames are measuring. */
  newest: ClockSample | null;
  /** The longest wait for a patch any frame in the window saw, less the tick it always costs, ms. */
  late: number;
  /** The interpolation delay the window asks for: `late` plus a tick, within INTERP's bounds. */
  delayTarget: number;
  /** The interpolation delay in use, slewed toward `delayTarget`. */
  delay: number;
}

export function createClockSync(): ClockSync {
  return {
    samples: [],
    target: 0,
    offset: 0,
    hasOffset: false,
    lastStepAt: 0,
    newest: null,
    late: 0,
    delayTarget: INTERP.baseMs,
    delay: INTERP.baseMs
  };
}

/** Lowest round trip in the window, or Infinity before the first ping reply. */
export function minRtt(c: ClockSync): number {
  let best = Infinity;
  for (const s of c.samples) if (s.rtt < best) best = s.rtt;
  return best;
}

/**
 * Record one ping reply. `serverTime` is the server's simulation time when it echoed,
 * `sentAt` and `recvAt` are client times. The largest offset in the window sets the target.
 */
export function addClockSample(c: ClockSync, sentAt: number, recvAt: number, serverTime: number): void {
  addSample(c, { rtt: Math.max(0, recvAt - sentAt), offset: serverTime - recvAt, at: recvAt, stale: 0 });
}

/** Record a patch: stamped `serverTime` (its tick), received at client time `recvAt`. */
export function addArrivalSample(c: ClockSync, recvAt: number, serverTime: number): void {
  const s: ClockSample = { rtt: Infinity, offset: serverTime - recvAt, at: recvAt, stale: 0 };
  addSample(c, s);
  c.newest = s;
}

function addSample(c: ClockSync, s: ClockSample): void {
  const samples = c.samples;
  // Samples arrive in time order, so the stale ones are at the front.
  let stale = 0;
  while (stale < samples.length && samples[stale].at < s.at - CLOCK_SYNC.windowMs) stale++;
  if (stale > 0) samples.splice(0, stale);
  samples.push(s);
  let best = -Infinity;
  let longestWait = 0;
  for (const x of samples) {
    if (x.offset > best) best = x.offset;
    if (x.stale > longestWait) longestWait = x.stale;
  }
  c.target = best;
  setLate(c, longestWait);
  if (!c.hasOffset) {
    c.offset = c.target;
    c.hasOffset = true;
  }
}

function setLate(c: ClockSync, longestWait: number): void {
  c.late = Math.max(0, longestWait - TICK_MS);
  c.delayTarget = Math.min(INTERP.maxMs, Math.max(INTERP.baseMs, c.late + TICK_MS));
}

/**
 * Move the applied offset toward the target: at most `slewMsPerS` per second of client
 * time, or at once if the gap is over `snapMs`. The interpolation delay follows its own
 * target the same way, but never jumps: it is bounded, so the slew reaches any target
 * within ten seconds, and a jump would show as a skip or a stall. Returns the offset now
 * in force.
 */
export function stepClock(c: ClockSync, now: number): number {
  const dt = c.lastStepAt === 0 ? 0 : Math.max(0, now - c.lastStepAt);
  c.lastStepAt = now;
  const gap = c.target - c.offset;
  if (Math.abs(gap) > CLOCK_SYNC.snapMs) {
    c.offset = c.target;
  } else {
    const step = (CLOCK_SYNC.slewMsPerS * dt) / 1000;
    c.offset += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
  }
  // This frame's wait for the next patch. Against the target, not the applied offset: the
  // offset sags below the floor while the best sample ages out (up to 40 ms on a 150 ms
  // link), and a budget that leaned on the sag would be short the moment a fresh best
  // arrival lifted the clock back. The applied offset wins only while it is the later one.
  const newest = c.newest;
  if (newest) {
    const wait = now + Math.max(c.offset, c.target) - (newest.at + newest.offset);
    if (wait > newest.stale) {
      newest.stale = wait;
      if (wait - TICK_MS > c.late) setLate(c, wait);
    }
  }
  const dgap = c.delayTarget - c.delay;
  const dstep = (INTERP.slewMsPerS * dt) / 1000;
  c.delay += Math.abs(dgap) <= dstep ? dgap : Math.sign(dgap) * dstep;
  return c.offset;
}

/**
 * The interpolation delay in force at client time `now`, ms. Remote snapshots are drawn at
 * serverTimeAt(now) - interpDelayAt(now); see remoteTimeAt.
 */
export function interpDelayAt(c: ClockSync, now: number): number {
  stepClock(c, now);
  return c.delay;
}

/** The server time to draw remote players and the goblin at, for client time `now`. */
export function remoteTimeAt(c: ClockSync, now: number): number {
  return now + stepClock(c, now) - c.delay;
}

/** Estimated server time at client time `now`, slewing the offset as a side effect. */
export function serverTimeAt(c: ClockSync, now: number): number {
  return now + stepClock(c, now);
}
