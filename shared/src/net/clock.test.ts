import { describe, expect, it } from 'vitest';
import { addArrivalSample, createClockSync, remoteTimeAt, stepClock, type ClockConfig } from './clock';

const cfg: ClockConfig = { windowMs: 20000, slewMsPerS: 10, snapMs: 250, intervalMs: 1000 / 30, baseMs: 80, maxMs: 200 };

/** Small seeded PRNG so the simulated network is the same on every run. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A server 5 s ahead sending a snapshot every interval over a link of `trip` ms, plus `late(i)`
 * for snapshot i; the client draws a frame every 16.7 ms. Returns the share of frames whose draw
 * time had passed the newest snapshot (the drawn world held still) after the first `warmMs`.
 */
function play(late: (i: number) => number, ms: number, warmMs = 0, conf: ClockConfig = cfg, trip = 40) {
  const c = createClockSync(conf);
  const arrivals: { at: number; t: number }[] = [];
  for (let i = 0; i * cfg.intervalMs < ms; i++) arrivals.push({ t: 5000 + i * cfg.intervalMs, at: i * cfg.intervalMs + trip + late(i) });
  arrivals.sort((a, b) => a.at - b.at);
  let next = 0;
  let newest = -Infinity;
  let frames = 0;
  let held = 0;
  for (let now = 1; now < ms; now += 1000 / 60) {
    while (next < arrivals.length && arrivals[next].at <= now) {
      // TCP keeps order: a snapshot can arrive late, never before an earlier one.
      newest = Math.max(newest, arrivals[next].t);
      addArrivalSample(c, conf, arrivals[next].at, arrivals[next].t);
      next++;
    }
    if (!c.hasOffset) continue;
    const draw = remoteTimeAt(c, conf, now);
    if (now < warmMs) continue;
    frames++;
    if (draw > newest) held++;
  }
  return { c, heldShare: held / Math.max(1, frames) };
}

describe('the server clock on the least-delayed path', () => {
  it('takes the offset from the snapshot with the shortest trip, not the latest', () => {
    const c = createClockSync(cfg);
    addArrivalSample(c, cfg, 100, 1000 + 60); // offset 960
    addArrivalSample(c, cfg, 200, 1100 + 120); // offset 1020: the shortest trip
    addArrivalSample(c, cfg, 300, 1200 + 40); // offset 940
    expect(c.target).toBe(1020);
  });

  it('forgets samples older than the window, so the target can fall', () => {
    const c = createClockSync(cfg);
    addArrivalSample(c, cfg, 0, 1000); // offset 1000, the best ever
    for (let t = 1000; t <= cfg.windowMs; t += 1000) addArrivalSample(c, cfg, t, t + 980);
    expect(c.target).toBe(1000);
    addArrivalSample(c, cfg, cfg.windowMs + 1000, cfg.windowMs + 1000 + 980);
    expect(c.target).toBe(980);
  });

  it('snaps the first sample and a gap past snapMs, and slews the rest', () => {
    const c = createClockSync(cfg);
    // Client times from 1 ms: the clock reads 0 as never stepped.
    addArrivalSample(c, cfg, 1, 1001);
    expect(stepClock(c, cfg, 10)).toBe(1000);
    addArrivalSample(c, cfg, 10, 1040); // 30 ms better: slewed
    expect(stepClock(c, cfg, 1010)).toBeCloseTo(1000 + cfg.slewMsPerS, 6);
    expect(stepClock(c, cfg, 4010)).toBe(1030);
    addArrivalSample(c, cfg, 4100, 4100 + 1030 + 400); // a tab that slept: taken at once
    expect(stepClock(c, cfg, 4100)).toBe(1430);
  });
});

describe('the delay drawn behind it', () => {
  it('stays at the slice’s 80 ms on a punctual link, and nothing holds', () => {
    const { c, heldShare } = play(() => 0, 30000, 1000);
    expect(c.delay).toBe(cfg.baseMs);
    expect(heldShare).toBe(0);
  });

  it('grows to cover a lossy link’s retransmits, within its cap, and holds far less than the fixed delay', () => {
    // 2% of snapshots held 200 ms by a retransmit; TCP holds everything behind them too.
    const rnd = mulberry32(3);
    const extra: number[] = [];
    for (let i = 0; i < 2000; i++) extra.push(rnd() < 0.02 ? 200 : rnd() * 20);
    const late = (i: number) => {
      let hold = extra[i];
      for (let j = Math.max(0, i - 7); j < i; j++) hold = Math.max(hold, extra[j] - (i - j) * cfg.intervalMs);
      return hold;
    };
    const adaptive = play(late, 60000, 15000);
    expect(adaptive.c.delay).toBeGreaterThan(cfg.baseMs);
    expect(adaptive.c.delay).toBeLessThanOrEqual(cfg.maxMs);
    // The slice's way, a fixed 80 ms, on the same link.
    const fixed = play(late, 60000, 15000, { ...cfg, maxMs: cfg.baseMs });
    expect(fixed.heldShare).toBeGreaterThan(0);
    expect(adaptive.heldShare).toBeLessThan(fixed.heldShare / 3);
  });

  it('never jumps: the delay moves at most slewMsPerS a second', () => {
    const c = createClockSync(cfg);
    addArrivalSample(c, cfg, 1, 5000);
    stepClock(c, cfg, 1);
    // One snapshot 300 ms late: the target leaps, the delay walks.
    stepClock(c, cfg, 400);
    expect(c.delayTarget).toBe(cfg.maxMs);
    stepClock(c, cfg, 1400);
    expect(c.delay).toBeLessThanOrEqual(cfg.baseMs + cfg.slewMsPerS * 1.4 + 1e-9);
  });
});
