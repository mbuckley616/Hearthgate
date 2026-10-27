import { describe, expect, it } from "vitest";
import { INPUT_TIMING, PLAYER, TICK_MS, applyInput, createPlayer, neutralInput, onTick, type InputFrame, type PlayerSim } from "./sim";
import { applyDueInputs, createInputClock, createInputQueue, dueInputTicks, type InputQueue } from "./inputs";

const queueOf = (...frames: InputFrame[]): InputQueue => ({ ...createInputQueue(), frames });

const walk = (seq: number, extra: Partial<InputFrame> = {}): InputFrame => ({ seq, dx: 1, dy: 0, attack: false, dodge: false, ...extra });

/** The server time of tick `n`, as the server computes it. */
const at = (n: number) => n * TICK_MS;
/** The tick the tests start from: one second in. */
const T0 = 60;

/** Frames a client makes holding a key for `holdMs` when its timer runs every `frameMs`. */
function framesAt(frameMs: number, holdMs: number): number {
  const clock = createInputClock(0);
  let frames = 0;
  for (let t = frameMs; t <= holdMs; t += frameMs) frames += dueInputTicks(clock, t);
  return frames;
}

describe("the client's input clock", () => {
  it("makes one frame per tick of wall time at 60, 21 and 10 fps, so a 1.5 s hold covers the same ground", () => {
    const holdMs = 1500;
    const distances = [1000 / 60, 1000 / 21, 1000 / 10].map((frameMs) => {
      const p = createPlayer("a");
      const n = framesAt(frameMs, holdMs);
      for (let i = 1; i <= n; i++) applyInput(p, walk(i), at(i), TICK_MS);
      return p.x;
    });
    // 9 m for 1.5 s at 6 m/s; the slowest timer may end up to one of its frames short of the hold.
    const full = PLAYER.speed * (holdMs / 1000);
    for (const d of distances) expect(d).toBeGreaterThanOrEqual(full - PLAYER.speed * 0.1 - 1e-9);
    for (const d of distances) expect(d).toBeLessThanOrEqual(full + 1e-9);
    // Before: one frame per callback, so 10 fps sent 15 frames for the 30 ticks and walked 4.5 m.
  });

  it("drops time past the catch-up cap instead of sending a burst of stale movement", () => {
    const clock = createInputClock(0);
    // Between ticks, so the count does not hang on how 2 s divides by a tick.
    expect(dueInputTicks(clock, 2005)).toBe(INPUT_TIMING.clientCatchupTicks);
    expect(dueInputTicks(clock, 2005)).toBe(0);
    expect(dueInputTicks(clock, 2005 + TICK_MS)).toBe(1);
  });
});

describe("applyDueInputs", () => {
  it("applies a frame at its slot, one tick after the last, even when it arrives late", () => {
    const p = createPlayer("a");
    p.inputAt = at(T0);
    const q = queueOf();
    // Nothing arrives for the next tick: inside the window, so nothing happens to the player.
    expect(applyDueInputs(p, q, at(T0 + 1))).toHaveLength(0);
    expect(p.inputAt).toBe(at(T0));
    expect(p.x).toBe(0);
    // Both frames arrive for the tick after: they land a tick apart, not both on the second.
    q.frames.push(walk(1, { dodge: true }), walk(2));
    expect(applyDueInputs(p, q, at(T0 + 2))).toHaveLength(2);
    expect(p.inputAt).toBe(at(T0 + 2));
    expect(p.dodgeUntil).toBe(at(T0 + 1) + PLAYER.dodgeMs);
  });

  it("never applies a frame ahead of the tick, so a client cannot walk faster by sending faster", () => {
    const p = createPlayer("a");
    p.inputAt = at(T0);
    const q = queueOf(walk(1), walk(2), walk(3));
    expect(applyDueInputs(p, q, at(T0 + 1))).toHaveLength(1);
    expect(q.frames.length).toBe(2);
    expect(applyDueInputs(p, q, at(T0 + 2))).toHaveLength(1);
  });

  it("catches up at most maxPerTick frames a tick", () => {
    const p = createPlayer("a");
    p.inputAt = at(T0);
    const q = queueOf(walk(1), walk(2), walk(3), walk(4));
    expect(applyDueInputs(p, q, at(T0 + 3))).toHaveLength(INPUT_TIMING.maxPerTick);
    expect(p.inputAt).toBe(at(T0 + 2));
  });

  it("places a frame later than the window at the tick, and the next ones count from there", () => {
    const p = createPlayer("a");
    p.inputAt = at(T0);
    const now = onTick(at(T0) + INPUT_TIMING.maxLagMs + TICK_MS);
    const q = queueOf(walk(1), walk(2));
    expect(applyDueInputs(p, q, now)).toHaveLength(1);
    expect(p.inputAt).toBe(now);
    expect(q.frames.length).toBe(1);
  });

  it("moves a silent player's body past the window with the guard held, and nothing inside it", () => {
    const p = createPlayer("a");
    applyInput(p, walk(1, { dx: 0, block: true }), at(T0), TICK_MS);
    p.inputAt = at(T0);
    p.knockUntil = at(T0) + 1000;
    p.knockDx = 4;
    const lagTicks = Math.round(INPUT_TIMING.maxLagMs / TICK_MS);
    for (let n = T0 + 1; n <= T0 + lagTicks; n++) applyDueInputs(p, queueOf(), at(n));
    expect(p.x).toBe(0);
    applyDueInputs(p, queueOf(), at(T0 + lagTicks + 1));
    expect(p.x).toBeCloseTo(4 * (TICK_MS / 1000), 6);
    expect(p.inputAt).toBe(at(T0 + 1));
    expect(p.lastSeq).toBe(1);
  });

  it("moves the slots a tick earlier when a frame has waited a whole second, not on a passing bunch", () => {
    const p = createPlayer("a");
    p.inputAt = at(T0);
    // A client a tick ahead: every tick one frame arrives and one is already waiting.
    const q = queueOf(walk(1));
    let seq = 1;
    let n = T0;
    for (let i = 0; i < INPUT_TIMING.drainAfterTicks - 1; i++) {
      q.frames.push(walk(++seq));
      n++;
      applyDueInputs(p, q, at(n));
      expect(p.inputAt).toBe(at(n));
    }
    q.frames.push(walk(++seq));
    n++;
    applyDueInputs(p, q, at(n));
    expect(p.inputAt).toBe(at(n - 1));
    // The next tick takes both: the backlog is gone.
    q.frames.push(walk(++seq));
    n++;
    expect(applyDueInputs(p, q, at(n))).toHaveLength(2);
    expect(q.frames.length).toBe(0);
  });

  it("drains a backlog that jitter empties one tick in five, and leaves one that comes and goes", () => {
    const run = (pattern: number[]) => {
      const p = createPlayer("a");
      p.inputAt = at(T0);
      const q = queueOf();
      let seq = 0;
      let drained = false;
      for (let i = 0; i < 600; i++) {
        for (let k = 0; k < pattern[i % pattern.length]; k++) q.frames.push(walk(++seq));
        const before = q.waitingTicks;
        applyDueInputs(p, q, at(T0 + 1 + i));
        if (before === INPUT_TIMING.drainAfterTicks - 1 && q.waitingTicks === 0) drained = true;
      }
      return drained;
    };
    // One frame ahead most of the time: two arrive, then one a tick, a late one every fifth tick.
    expect(run([2, 1, 1, 1, 0, 2, 1, 1, 1, 0])).toBe(true);
    // A bunch that empties every other tick: no standing backlog, nothing to drain.
    expect(run([2, 0])).toBe(false);
  });

  it("is deterministic: the same queue and ticks give the same player", () => {
    const run = () => {
      const p = createPlayer("a");
      const all = Array.from({ length: 30 }, (_, i) => walk(i + 1, { dodge: i % 9 === 0, attack: i % 7 === 3 }));
      const q = queueOf();
      for (let n = 1; all.length || q.frames.length; n++) {
        // Arrivals bunch: none every third tick, two on the next.
        q.frames.push(...all.splice(0, [1, 0, 2][n % 3]));
        applyDueInputs(p, q, at(n));
      }
      return p;
    };
    expect(run()).toEqual(run());
  });
});

/**
 * A client and the server over a link that bunches frames: some ticks get none, some two or
 * three. The client predicts each frame at its slot and, on every patch, rewinds to the server's
 * copy and replays what is pending from the patch's `inputAt`, as net.ts does. Returns the
 * corrections (prediction moved more than 2 cm by a patch) over the run, for the new slots and
 * for the old way (every queued frame at the tick's now, a neutral frame on a quiet tick).
 */
function bunchedLink(useSlots: boolean): number {
  const frames = 600;
  const oneWay = 60;
  // Time runs in tenths of a tick: the server ticks on the whole ones, the client half a tick later.
  const sub = 10;
  // A deterministic jitter: every frame late by 0 to 70 ms in a fixed pattern, order kept (TCP).
  const late = (seq: number) => [0, 10, 70, 0, 30, 0, 55, 5, 0, 20, 65, 0][seq % 12];
  const server = createPlayer("a");
  server.inputAt = onTick(-INPUT_TIMING.maxLagMs);
  const client = createPlayer("a");
  let predictedTime = 0;
  let pending: InputFrame[] = [];
  const inFlight: { at: number; frame: InputFrame }[] = [];
  const patches: { at: number; state: PlayerSim; tick: number }[] = [];
  const queue = queueOf();
  let corrections = 0;
  let placed = false;
  let lastArrival = 0;

  for (let u = 0; u <= (frames + 60) * sub; u++) {
    const t = (u / sub) * TICK_MS;
    // Client tick: predict at the next slot and send.
    if (u % sub === sub / 2 && u < frames * sub) {
      const seq = u === sub / 2 ? 1 : pending.length ? pending[pending.length - 1].seq + 1 : client.lastSeq + 1;
      const f = walk(seq, { dx: Math.cos(seq / 20), dy: Math.sin(seq / 20), dodge: seq % 39 === 0, attack: seq % 51 === 5, block: seq % 87 > 75 });
      predictedTime = onTick(predictedTime + TICK_MS);
      applyInput(client, f, predictedTime, TICK_MS);
      pending.push(f);
      lastArrival = Math.max(lastArrival, t + oneWay + late(seq));
      inFlight.push({ at: lastArrival, frame: f });
    }
    // Server tick.
    if (u % sub === 0 && u > 0) {
      const now = at(u / sub);
      while (inFlight.length && inFlight[0].at <= now) queue.frames.push(inFlight.shift()!.frame);
      if (useSlots) applyDueInputs(server, queue, now);
      else {
        const due = queue.frames.splice(0, 2);
        if (due.length === 0) applyInput(server, { ...neutralInput(server.lastSeq), block: server.guarding }, now, TICK_MS);
        for (const f of due) applyInput(server, f, now, TICK_MS);
        server.inputAt = now;
      }
      patches.push({ at: now + oneWay, state: structuredClone(server), tick: now });
    }
    // Patch arrives: rewind and replay.
    while (patches.length && patches[0].at <= t) {
      const { state, tick } = patches.shift()!;
      const bx = client.x;
      const bz = client.z;
      Object.assign(client, structuredClone(state));
      pending = pending.filter((f) => f.seq > state.lastSeq);
      let rt = useSlots ? state.inputAt : tick;
      for (const f of pending) applyInput(client, f, (rt = onTick(rt + TICK_MS)), TICK_MS);
      predictedTime = rt;
      if (placed && Math.hypot(bx - client.x, bz - client.z) > 0.02) corrections++;
      placed = placed || state.lastSeq > 0;
    }
  }
  return corrections;
}

describe("prediction against the server on a bunching link", () => {
  it("agrees on every frame with slots, where the old timing corrected many times", () => {
    expect(bunchedLink(false)).toBeGreaterThan(5);
    expect(bunchedLink(true)).toBe(0);
  });
});
