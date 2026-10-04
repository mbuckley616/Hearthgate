/**
 * Clock sync estimator for the client, pure so it can be unit tested with simulated
 * networks. Constants live in sim.ts (CLOCK_SYNC). Nothing here reads a clock: every
 * function takes the time as an argument.
 *
 * The offset estimated here is "server simulation time minus client time as the server's
 * messages reach us on the least-delayed path": a snapshot stamped t arrives at or after
 * client time t - offset. Drawing remote players INTERP_DELAY_MS behind serverTimeAt()
 * therefore leaves INTERP_DELAY_MS of budget for a late packet, and that budget stays
 * put under jitter because a late packet cannot raise the estimate.
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
import { CLOCK_SYNC } from "./sim";

export interface ClockSample {
  /** Round trip for a ping reply; Infinity for a patch, which measures only the trip here. */
  rtt: number;
  /** serverTime - recvAt for this message. */
  offset: number;
  /** Client time it arrived, for ageing out. */
  at: number;
}

export interface ClockSync {
  samples: ClockSample[];
  /** The largest offset in the window: the message with the shortest trip from the server. */
  target: number;
  /** The offset in use, slewed toward `target`. */
  offset: number;
  hasOffset: boolean;
  lastStepAt: number;
}

export function createClockSync(): ClockSync {
  return { samples: [], target: 0, offset: 0, hasOffset: false, lastStepAt: 0 };
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
  addSample(c, { rtt: Math.max(0, recvAt - sentAt), offset: serverTime - recvAt, at: recvAt });
}

/** Record a patch: stamped `serverTime` (its tick), received at client time `recvAt`. */
export function addArrivalSample(c: ClockSync, recvAt: number, serverTime: number): void {
  addSample(c, { rtt: Infinity, offset: serverTime - recvAt, at: recvAt });
}

function addSample(c: ClockSync, s: ClockSample): void {
  const samples = c.samples;
  // Samples arrive in time order, so the stale ones are at the front.
  let stale = 0;
  while (stale < samples.length && samples[stale].at < s.at - CLOCK_SYNC.windowMs) stale++;
  if (stale > 0) samples.splice(0, stale);
  samples.push(s);
  let best = -Infinity;
  for (const x of samples) if (x.offset > best) best = x.offset;
  c.target = best;
  if (!c.hasOffset) {
    c.offset = c.target;
    c.hasOffset = true;
  }
}

/**
 * Move the applied offset toward the target: at most `slewMsPerS` per second of client
 * time, or at once if the gap is over `snapMs`. Returns the offset now in force.
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
  return c.offset;
}

/** Estimated server time at client time `now`, slewing the offset as a side effect. */
export function serverTimeAt(c: ClockSync, now: number): number {
  return now + stepClock(c, now);
}
