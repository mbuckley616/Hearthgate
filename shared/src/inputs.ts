import { INPUT_TIMING, TICK_MS, applyInput, neutralInput, onTick, type InputFrame, type PlayerSim } from "./sim";
import { OPEN_FIELD, type Level } from "./level";

/**
 * When a player's inputs take effect. Both halves of the input path live here, pure, so the
 * unit tests can run them at any frame rate and any arrival pattern.
 *
 * The client makes one frame per tick of wall time (`InputClock`), however often its timer
 * gets to run. The server applies each frame at its slot: one tick after the frame before it
 * (`p.inputAt`), not at whatever tick it happened to arrive in. The client's replay counts the
 * same slots from the `inputAt` the patch carries, so two frames that arrive in one tick, or a
 * tick with none, no longer move a dodge's end or a cooldown against the prediction.
 */

/** The server's queue for one player: frames received and not yet applied. */
export interface InputQueue {
  frames: InputFrame[];
  /** Ticks that ended with a frame still waiting for its slot, less those that did not (never below 0). */
  waitingTicks: number;
}

export function createInputQueue(): InputQueue {
  return { frames: [], waitingTicks: 0 };
}

/**
 * The server's half, once a tick per player: apply the queued frames whose slots are due by
 * `now`, shifting them off the queue. Returns the frames it applied.
 *
 *  - A slot later than `now` waits: the client is ahead of the tick, and a frame never acts in
 *    the future. This is also what holds a client to one frame a tick of movement. When ticks
 *    that end with a frame waiting outnumber those that do not by `INPUT_TIMING.drainAfterTicks`,
 *    the slots move earlier by as many ticks as frames are waiting: a standing backlog is latency,
 *    and a late frame costs nothing.
 *  - A slot `INPUT_TIMING.maxLagMs` or more before `now` is a stall, not jitter: the frame is
 *    applied at `now` and the slots after it count from there (the client is corrected once).
 *  - A player who sends nothing for longer than that window still has their body moved (a knock,
 *    a dodge in flight) by a neutral frame at the window's edge, with the guard left as it was:
 *    a late frame must not lower a held guard, since raising it again would open a fresh parry
 *    window the player never timed. Inside the window, a quiet tick does nothing: the late frame
 *    is coming and will be applied at its own slot.
 */
export function applyDueInputs(p: PlayerSim, q: InputQueue, now: number, level: Level = OPEN_FIELD): InputFrame[] {
  const floor = onTick(now - INPUT_TIMING.maxLagMs);
  const applied: InputFrame[] = [];
  while (applied.length < INPUT_TIMING.maxPerTick && q.frames.length > 0) {
    let slot = onTick(p.inputAt + TICK_MS);
    if (slot > now) break;
    if (slot <= floor) slot = now;
    const f = q.frames.shift()!;
    applyInput(p, f, slot, TICK_MS, level);
    p.inputAt = slot;
    applied.push(f);
  }
  if (applied.length === 0 && onTick(p.inputAt + TICK_MS) <= floor) {
    applyInput(p, { ...neutralInput(p.lastSeq), block: p.guarding }, floor, TICK_MS, level);
    p.inputAt = floor;
  }
  // Counted up on a tick that ends with a frame waiting and down on one that does not, so a
  // backlog that jitter empties now and then still drains, and one that comes and goes does not.
  const waiting = q.frames.length > 0 && onTick(p.inputAt + TICK_MS) > now;
  q.waitingTicks = Math.max(0, q.waitingTicks + (waiting ? 1 : -1));
  if (q.waitingTicks >= INPUT_TIMING.drainAfterTicks) {
    // The whole standing backlog at once, one retiming the client corrects for once; never so far
    // that the oldest waiting frame would land outside the lag window and be placed at the tick.
    const ahead = Math.min(q.frames.length, Math.round(INPUT_TIMING.maxLagMs / TICK_MS) - 1);
    p.inputAt = onTick(p.inputAt - TICK_MS * Math.max(1, ahead));
    q.waitingTicks = 0;
  }
  return applied;
}

/** The client's input clock: ticks of wall time made into frames so far. */
export interface InputClock {
  /** performance.now() of tick zero. */
  epoch: number;
  /** Frames made so far. */
  sent: number;
}

export function createInputClock(now: number): InputClock {
  return { epoch: now, sent: 0 };
}

/**
 * How many frames are due at `now` (the caller makes that many, each sampled in turn), counted
 * by wall time rather than by timer callbacks: a main thread that runs the timer at 10 fps still
 * sends 60 frames a second, six at a time, so a held key covers the same ground at any frame
 * rate. More than `INPUT_TIMING.clientCatchupTicks` behind (a sleeping tab, a long stall) and the
 * rest of the time is dropped instead of sent as a burst of stale movement.
 */
export function dueInputTicks(c: InputClock, now: number): number {
  const due = Math.floor((now - c.epoch) / TICK_MS);
  let n = due - c.sent;
  if (n > INPUT_TIMING.clientCatchupTicks) {
    c.sent = due - INPUT_TIMING.clientCatchupTicks;
    n = INPUT_TIMING.clientCatchupTicks;
  }
  if (n <= 0) return 0;
  c.sent += n;
  return n;
}

/** performance.now() at which the next frame falls due, for scheduling the timer. */
export function nextInputAt(c: InputClock): number {
  return c.epoch + (c.sent + 1) * TICK_MS;
}
