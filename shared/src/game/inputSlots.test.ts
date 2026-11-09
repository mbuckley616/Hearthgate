import { describe, expect, it } from 'vitest';
import type { SeqCommand } from '../net/protocol';
import { idleCommand, type PlayerCommand } from '../sim/types';
import { slotConfig } from './HostSession';
import { createSlots, nextSlotCommand, receiveInputs, type SlotConfig, type Slots } from './inputSlots';

// Each command carries its own seq in moveX, so the tick that used it can be read off the command.
const numbered = (seq: number): SeqCommand => ({ seq, cmd: { ...idleCommand(), moveX: seq } as PlayerCommand });

/**
 * Plays a player's sending against the server's ticks. `frames` is the page's frame lengths in ticks,
 * cycled: each frame makes that many commands and sends them in one message at its end (the slow page
 * of Session 54). `serverEvery` ticks of wall time make `serverTicks` server ticks (1 and 1 is a server
 * on time). Returns the seq each server tick used, in order.
 */
function play(cfg: SlotConfig, opts: { frames: number[]; wallTicks: number; serverEvery?: number; serverTicks?: number; s?: Slots; from?: number }) {
  const s = opts.s ?? createSlots(cfg);
  const used: number[] = [];
  let seq = opts.from ?? 1;
  let frameLeft = opts.frames[0];
  let frame = 0;
  let pending: SeqCommand[] = [];
  const every = opts.serverEvery ?? 1;
  const per = opts.serverTicks ?? 1;
  for (let t = 0; t < opts.wallTicks; t++) {
    pending.push(numbered(seq++));
    if (--frameLeft === 0) {
      receiveInputs(s, cfg, pending);
      pending = [];
      frame++;
      frameLeft = opts.frames[frame % opts.frames.length];
    }
    // The server misses (every - per) of every `every` wall ticks when it runs slow.
    if (t % every < per) used.push(nextSlotCommand(s, cfg).moveX);
  }
  return { s, used, seq };
}

describe('input slots and a slow page (the burst fold, Session 64)', () => {
  const cfg = slotConfig();

  it('a page at 5 fps sending twelve commands a message on time is never folded, and its tick count holds', () => {
    const { s, used } = play(cfg, { frames: [12], wallTicks: 1200 });
    expect(s.stats.folded).toBe(0);
    // After the first frames, every tick uses the next seq: no gaps (a fold), no repeats (a stand-in).
    const settled = used.slice(120);
    for (let i = 1; i < settled.length; i++) expect(settled[i]).toBe(settled[i - 1] + 1);
    // The ack trails what the page has sent by a frame and the cushion at most, and never drifts.
    expect(1200 - s.ack).toBeLessThanOrEqual(12 + s.cushion);
    expect(s.ack).toBe(used[used.length - 1]);
  });

  it('an uneven page at about 10 fps (frames of 2 to 9 ticks, test:net 9c) is not folded either', () => {
    const { s, used } = play(cfg, { frames: [4, 9, 2, 8, 5, 8], wallTicks: 1800 });
    expect(s.stats.folded).toBe(0);
    // Never a seq used twice or out of order.
    for (let i = 1; i < used.length; i++) expect(used[i]).toBeGreaterThanOrEqual(used[i - 1]);
  });

  it('a server ticking slower than wall time still folds a steady sender, so the queue stays short', () => {
    const { s, used } = play(cfg, { frames: [1], wallTicks: 3000, serverEvery: 10, serverTicks: 9 });
    expect(s.stats.folded).toBeGreaterThan(200);
    expect(s.queue.length).toBeLessThanOrEqual(s.cushion + cfg.maxExtra + 1);
    // Nothing is lost: the last tick used an input the player sent not long before.
    expect(3000 - used[used.length - 1]).toBeLessThanOrEqual(s.cushion + cfg.maxExtra + 2);
  });

  it('a slow page on a server ticking slow folds too: the low point between its frames creeps up', () => {
    const { s, used } = play(cfg, { frames: [12], wallTicks: 3000, serverEvery: 10, serverTicks: 9 });
    expect(s.stats.folded).toBeGreaterThan(200);
    // Its inputs never wait more than a frame, the cushion and the few the fold allows.
    expect(3000 - used[used.length - 1]).toBeLessThanOrEqual(12 + s.cushion + cfg.maxExtra + 2);
  });

  it('a slow page that speeds up is folded like any other once a slow server makes its inputs stand', () => {
    const first = play(cfg, { frames: [12], wallTicks: 600 });
    expect(first.s.stats.folded).toBe(0);
    const slow = play(cfg, { frames: [1], wallTicks: 1200, serverEvery: 10, serverTicks: 9, s: first.s, from: first.seq });
    expect(slow.s.stats.folded).toBeGreaterThan(80);
    expect(slow.s.queue.length).toBeLessThanOrEqual(slow.s.cushion + cfg.maxExtra + 1);
  });

  it('keeps every press of a folded input', () => {
    const s = createSlots(cfg);
    const cmds = Array.from({ length: 22 }, (_, i) => numbered(i + 1));
    cmds[2].cmd.dodge = true;
    receiveInputs(s, cfg, [cmds[0]]);
    nextSlotCommand(s, cfg);
    nextSlotCommand(s, cfg);
    // Twenty land at once and a tick finds them standing; the next message shows the low point.
    receiveInputs(s, cfg, cmds.slice(1, 21));
    nextSlotCommand(s, cfg);
    receiveInputs(s, cfg, [cmds[21]]);
    const out = nextSlotCommand(s, cfg);
    expect(s.stats.folded).toBeGreaterThan(0);
    expect(out.dodge).toBe(true);
  });
});

/**
 * The bow's backflip snap (critic, 9 Nov): a held attack's length (C1) is counted by the browser one
 * per command and by the server one per tick, so a tick that stood in for a missing input, or a
 * cushion tick that stood for none, or two inputs used in one tick, left the server's count a tick or
 * more off the browser's. With heavyHoldMs at 250 ms, a tap at 7 fps (one or two 140 ms frames) sits
 * right on the line, and a tick off turned the string HH into HL on one side only.
 */
describe('input slots count a held attack as the browser does', () => {
  const cfg = slotConfig();

  // The critic's recipe: a press every 15 ticks (250 ms) held 9 ticks (about a 7 fps frame and a bit);
  // every fifth held 39 ticks (650 ms), then the next five begin.
  const CYCLE = 105;
  const pressAt = (seq: number): boolean => {
    const t = (seq - 1) % CYCLE;
    return t % 15 === 0 && t <= 60;
  };
  const heldAt = (seq: number): boolean => {
    const t = (seq - 1) % CYCLE;
    return t >= 60 ? t < 99 : t % 15 < 9;
  };
  const holdCmd = (seq: number): SeqCommand => ({
    seq,
    cmd: { ...idleCommand(), attack: pressAt(seq), ...(heldAt(seq) ? { attackHeld: true } : {}) },
  });

  /** The browser's count after each seq: held ticks in a row, as stepPlayer adds them. */
  const browserHold = (upTo: number): number => {
    let h = 0;
    for (let seq = 1; seq <= upTo; seq++) h = holdCmd(seq).cmd.attackHeld ? h + 1 : 0;
    return h;
  };

  function run(frames: number[], wallTicks: number) {
    const s = createSlots(cfg);
    let seq = 1;
    let frame = 0;
    let frameLeft = frames[0];
    let pending: SeqCommand[] = [];
    let hold = 0;
    let checked = 0;
    let off = 0;
    for (let t = 0; t < wallTicks; t++) {
      pending.push(holdCmd(seq++));
      if (--frameLeft === 0) {
        receiveInputs(s, cfg, pending);
        pending = [];
        frame++;
        frameLeft = frames[frame % frames.length];
      }
      const c = nextSlotCommand(s, cfg);
      // The server's count, as stepPlayer keeps it.
      hold = c.attackHeld ? Math.max(0, hold + (c.holdTicks ?? 1)) : 0;
      // Once every input up to the ack has arrived, the server's count is the browser's.
      if (s.guessed.size === 0 && s.ack > 0) {
        checked++;
        if (hold !== browserHold(s.ack)) off++;
      }
    }
    return { s, checked, off };
  }

  it('a page at about 7 fps with uneven frames: once its inputs are in, every count agrees', () => {
    const { s, checked, off } = run([8, 9, 7, 12, 6, 8, 10, 5], 2400);
    // The pattern really is late and lumpy: ticks stood in for inputs and the cushion widened.
    expect(s.stats.guessed).toBeGreaterThan(0);
    expect(s.stats.widened).toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(1000);
    expect(off).toBe(0);
  });

  it('a page at 60 fps and an uneven one at about 10 fps agree too', () => {
    expect(run([1], 1200).off).toBe(0);
    expect(run([4, 9, 2, 8, 5, 8], 1800).off).toBe(0);
  });
});
