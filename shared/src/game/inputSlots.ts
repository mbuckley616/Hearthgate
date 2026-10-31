import { idleCommand, type PlayerCommand } from '../sim/types';
import type { SeqCommand } from '../net/protocol';
import { mergePresses, withoutPresses } from './Session';

/**
 * When a player's numbered inputs take effect on the server (T2). The slice's host took the next
 * queued input each tick, refilled a two-tick cushion when the queue ran dry while repeating the
 * held buttons, and folded anything past four waiting into one tick. Over a lossy link that was
 * the lab's worst row: a lost TCP segment holds every later input about 200 ms, the host repeats
 * the held buttons meanwhile, then folds the late burst, so a dodge, a jump or a change of keys
 * lands ticks away from where the player's browser predicted it.
 *
 * Here each input has a slot: one tick after the one before it, counted from the first, behind a
 * cushion of a few ticks. A tick whose input has not arrived runs on the held buttons and counts
 * as that input (it is acked), so when the input does arrive it is dropped, its presses carried
 * to the next tick: the player's tick count never drifts from the server's, and a held key costs
 * nothing at all. Each such late arrival widens the cushion by a tick, up to `maxCushion`, so a
 * lossy link soon gives its retransmits room; after `calmTicks` without one it narrows again a
 * tick at a time, back to the slice's `coop.inputBufferTicks`. A player silent past `maxGuess`
 * ticks has stalled (a hidden tab): their slots stop advancing until they send again, and pick up
 * from the first input that arrives.
 *
 * Inputs piling up past the cushion mean a server ticking slower than wall time (an overloaded
 * machine), and the excess is folded into one tick. What counts is the queue's low point between
 * one message and the next, not its length when a message lands: a page at 5 to 10 fps still makes
 * a command per tick but sends a frame's six to twelve in one message, on time, so its queue jumps
 * by a frame's worth and drains back to the cushion before the next frame (Session 64; folding on
 * the jump put its hero off the prediction). A slow server's low point creeps up instead.
 *
 * Pure and clock-free, so the unit tests can play any arrival pattern through it.
 */

export interface SlotConfig {
  /** The cushion on a clean link, ticks (the slice's coop.inputBufferTicks). */
  baseCushion: number;
  /** The widest the cushion grows, ticks. */
  maxCushion: number;
  /** Ticks in a row a missing input is stood in for before the player counts as stalled. */
  maxGuess: number;
  /** Ticks of standing in after which the held buttons let go (the slice's STALE_TICKS). */
  staleTicks: number;
  /** Ticks without a late arrival before the cushion narrows by one. */
  calmTicks: number;
  /** Inputs a player may have waiting; past this the oldest go (a flood, not a player). */
  maxQueued: number;
  /** Inputs waiting beyond the cushion before the excess is used up at once (the slice folded past four). */
  maxExtra: number;
}

export interface Slots {
  /** Inputs not yet used, in seq order, every one at or after `next`. */
  queue: SeqCommand[];
  /** The seq whose slot is the next tick; null before the first input. */
  next: number | null;
  /** The last seq used (applied or stood in for): sent back so the player stops replaying it. */
  ack: number;
  /** Held buttons of the last input used, repeated when a tick's input is missing. */
  last: PlayerCommand;
  /** Ticks the slots are held back to build the cushion (at the start, and as it widens). */
  hold: number;
  cushion: number;
  /** Seqs a tick stood in for, still expected: their presses are carried when they arrive. */
  guessed: Set<number>;
  /** Presses of late inputs, added to the next tick's command. */
  carry: PlayerCommand | null;
  /** Ticks in a row stood in for. */
  quiet: number;
  /** Ticks since a late arrival. */
  calm: number;
  /** The fewest inputs waiting at a tick since the last message (Infinity before a tick has seen one). */
  low: number;
  /** Inputs to fold at the next tick: the standing excess the last message's gap showed. */
  excess: number;
  /** Counters for tests and the lab. */
  stats: { applied: number; guessed: number; late: number; widened: number; narrowed: number; resynced: number; folded: number };
}

export function createSlots(cfg: SlotConfig): Slots {
  return {
    queue: [],
    next: null,
    ack: 0,
    last: idleCommand(),
    hold: 0,
    cushion: cfg.baseCushion,
    guessed: new Set(),
    carry: null,
    quiet: 0,
    calm: 0,
    low: Infinity,
    excess: 0,
    stats: { applied: 0, guessed: 0, late: 0, widened: 0, narrowed: 0, resynced: 0, folded: 0 },
  };
}

/** Take a message's inputs: queue the ones still to come, carry the presses of those whose tick already ran. */
export function receiveInputs(s: Slots, cfg: SlotConfig, cmds: SeqCommand[]): void {
  let late = 0;
  for (const c of cmds) {
    if (s.next === null) {
      // The first input: its slot comes once the cushion has built.
      s.next = c.seq;
      s.hold = s.cushion;
    }
    if (c.seq < s.next) {
      if (s.guessed.delete(c.seq)) {
        s.carry = s.carry ? mergePresses(s.carry, c.cmd) : c.cmd;
        late++;
      }
      continue;
    }
    if (s.queue.some((q) => q.seq === c.seq)) continue;
    let i = s.queue.length;
    while (i > 0 && s.queue[i - 1].seq > c.seq) i--;
    s.queue.splice(i, 0, c);
  }
  while (s.queue.length > cfg.maxQueued) s.queue.shift();
  if (s.low !== Infinity) {
    // Since the last message the queue never fell below `low`: those inputs were standing, waiting
    // on the server, and anything past the cushion and a few is the server running slow.
    s.excess = Math.max(0, s.low - (s.cushion + cfg.maxExtra));
    s.low = Infinity;
  }
  if (late > 0) {
    s.stats.late += late;
    s.calm = 0;
    // Room for as much lateness as just arrived: the ticks those inputs missed by.
    const widen = Math.min(late, cfg.maxCushion - s.cushion);
    if (widen > 0) {
      s.cushion += widen;
      s.hold += widen;
      s.stats.widened += widen;
    }
  }
}

/** This tick's command for the player, consuming the input whose slot it is. */
export function nextSlotCommand(s: Slots, cfg: SlotConfig): PlayerCommand {
  if (s.next === null) return withCarry(s, s.last);
  if (s.hold > 0) {
    // Building the cushion: a tick of the held buttons that stands for no input.
    s.hold--;
    return withCarry(s, s.last);
  }
  s.calm++;
  s.low = Math.min(s.low, s.queue.length);
  // More standing than the cushion and a few more: a server running slower than wall time while the
  // player sends by the wall clock. Use the excess this tick, as the slice's host folded anything past
  // four, keeping every press; left alone it grows without bound and every input lands later and
  // later (CI found it: 0.6 s late, a bot running past its mark).
  while (s.excess > 0 && s.queue.length > s.cushion && s.queue[0].seq === s.next) {
    s.excess--;
    s.low--;
    const a = s.queue.shift()!;
    s.ack = a.seq;
    s.next = a.seq + 1;
    s.carry = s.carry ? mergePresses(s.carry, a.cmd) : a.cmd;
    s.stats.folded++;
  }
  s.excess = 0;
  if (s.calm >= cfg.calmTicks && s.cushion > cfg.baseCushion && s.queue.length > cfg.baseCushion && s.queue[0].seq === s.next) {
    // A calm spell: narrow by one, using two inputs this tick (their presses kept).
    const a = s.queue.shift()!;
    s.ack = a.seq;
    s.next = a.seq + 1;
    s.carry = s.carry ? mergePresses(s.carry, a.cmd) : a.cmd;
    s.cushion--;
    s.calm = 0;
    s.stats.narrowed++;
  }
  const head = s.queue[0];
  if (head && head.seq === s.next) {
    s.queue.shift();
    s.ack = head.seq;
    s.next = head.seq + 1;
    s.quiet = 0;
    s.last = withoutPresses(head.cmd);
    s.stats.applied++;
    return withCarry(s, head.cmd);
  }
  if (head && s.quiet >= cfg.maxGuess) {
    // Stalled, yet newer inputs are here: the ones before them are not coming (skipped, or dropped
    // because they landed after their tick). Waiting for them would hold the player still for good
    // (CI found it), so start again from the first that did arrive.
    s.queue.shift();
    s.ack = head.seq;
    s.next = head.seq + 1;
    s.quiet = 0;
    s.last = withoutPresses(head.cmd);
    s.stats.applied++;
    s.stats.resynced++;
    return withCarry(s, head.cmd);
  }
  // Its input has not arrived. Stand in for it with the held buttons, or, quiet too long, let go.
  s.quiet++;
  if (s.quiet > cfg.staleTicks) s.last = { ...idleCommand(), aimX: s.last.aimX, aimZ: s.last.aimZ };
  if (s.quiet <= cfg.maxGuess) {
    s.guessed.add(s.next);
    s.ack = s.next;
    s.next++;
    s.stats.guessed++;
    // Only the recent guesses can still arrive in time to matter.
    for (const g of s.guessed) if (g < s.next - cfg.maxGuess * 2) s.guessed.delete(g);
  }
  return withCarry(s, s.last);
}

function withCarry(s: Slots, cmd: PlayerCommand): PlayerCommand {
  if (!s.carry) return cmd;
  const out = mergePresses(s.carry, cmd);
  s.carry = null;
  return out;
}
