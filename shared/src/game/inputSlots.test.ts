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
