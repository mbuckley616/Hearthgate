import { describe, expect, it } from "vitest";
import { CLOCK_SYNC } from "./sim";
import { addArrivalSample, addClockSample, createClockSync, minRtt, serverTimeAt, stepClock } from "./clock";

/** Small seeded PRNG so the simulated network is the same on every run. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("clock sync", () => {
  it("takes the offset from the reply with the shortest return trip, not the latest or the lowest RTT", () => {
    const c = createClockSync();
    // Server clock is 1000 ms ahead; each reply has its own outbound and return delays.
    addClockSample(c, 0, 80, 1000 + 40); // out 40, back 40: offset 960
    addClockSample(c, 1000, 1040, 2000 + 30); // out 30, back 10: offset 990, the shortest return
    addClockSample(c, 2000, 2030, 3000 + 5); // out 5, back 25: offset 975, the lowest RTT
    addClockSample(c, 3000, 3120, 4000 + 60); // out 60, back 60: offset 940
    expect(minRtt(c)).toBe(30);
    expect(c.target).toBe(990);
  });

  it("forgets samples older than the window, so the target can fall but never below the window's best", () => {
    const c = createClockSync();
    addClockSample(c, 0, 10, 1000); // the best sample ever: offset 990, arrived at 10
    const n = CLOCK_SYNC.windowMs / 1000;
    for (let i = 1; i <= n; i++) addClockSample(c, i * 1000, i * 1000 + 10, i * 1000 + 10 + 975);
    expect(c.samples.length).toBe(n + 1); // the first sample is exactly windowMs old: still counts
    expect(c.target).toBe(990);
    addClockSample(c, (n + 1) * 1000, (n + 1) * 1000 + 10, (n + 1) * 1000 + 10 + 975);
    expect(c.samples.length).toBe(n + 1);
    expect(minRtt(c)).toBe(10);
    expect(c.target).toBe(975);
  });

  it("counts a patch arrival as a sample without a round trip", () => {
    const c = createClockSync();
    addClockSample(c, 0, 60, 1000 + 30); // offset 970, rtt 60
    addArrivalSample(c, 1100, 2000 + 100 + 10); // the patch for tick time 2110 arrived at 1100: offset 1010
    expect(c.target).toBe(1010);
    expect(minRtt(c)).toBe(60);
  });

  it("snaps the first sample, then slews later ones at the limit", () => {
    const c = createClockSync();
    addClockSample(c, 0, 50, 1000);
    expect(stepClock(c, 50)).toBe(950);
    stepClock(c, 1040);
    addClockSample(c, 1000, 1040, 2000 + 20); // offset 980, 30 ms above: the new target
    expect(stepClock(c, 2040)).toBeCloseTo(950 + CLOCK_SYNC.slewMsPerS, 6);
    expect(stepClock(c, 3040)).toBeCloseTo(950 + 2 * CLOCK_SYNC.slewMsPerS, 6);
    expect(stepClock(c, 4040)).toBe(980); // reached the target, no overshoot
    expect(stepClock(c, 5040)).toBe(980);
  });

  it("snaps a gap larger than snapMs, as after a tab slept", () => {
    const c = createClockSync();
    addClockSample(c, 0, 50, 1000);
    stepClock(c, 50);
    addClockSample(c, 1000, 1040, 2000 + 20 + CLOCK_SYNC.snapMs + 1);
    expect(stepClock(c, 1040)).toBe(c.target);
  });

  it("never runs server time backwards while correcting downward", () => {
    const c = createClockSync();
    addClockSample(c, 0, 50, 1000);
    stepClock(c, 50);
    // The good sample ages out of the window and every later reply arrives 200 ms later: the target drops.
    const w = CLOCK_SYNC.windowMs;
    for (let i = 1; i <= 3; i++) addClockSample(c, w + i * 1000, w + i * 1000 + 50, w + i * 1000 + 1000 - 200);
    expect(c.target).toBe(750);
    let last = serverTimeAt(c, w + 3050);
    for (let t = w + 3066; t < w + 40000; t += 16) {
      const s = serverTimeAt(c, t);
      expect(s).toBeGreaterThan(last);
      last = s;
    }
    expect(c.offset).toBe(c.target);
  });

  it("holds steady under jitter and late packets on a 150 ms link", () => {
    const rng = mulberry32(7);
    const c = createClockSync();
    const trueOffset = 123456; // server sim time minus client time
    const base = 75; // one way
    const jitter = 25;
    let minReturn = Infinity;
    const offsets: number[] = [];
    let t = 0;
    for (let i = 0; i < 90; i++) {
      // A ping each second: the request takes `out`, the reply `back`; 5% of packets are 80 ms late.
      const out = base + (rng() * 2 - 1) * jitter + (rng() < 0.05 ? 80 : 0);
      const back = base + (rng() * 2 - 1) * jitter + (rng() < 0.05 ? 80 : 0);
      const sentAt = t;
      const serverTime = sentAt + out + trueOffset;
      const recvAt = sentAt + out + back;
      addClockSample(c, sentAt, recvAt, serverTime);
      if (i >= CLOCK_SYNC.windowMs / 1000) minReturn = Math.min(minReturn, back);
      // Frames at 60 Hz until the next ping.
      for (let f = 0; f < 60; f++) {
        t += 1000 / 60;
        offsets.push(stepClock(c, t));
      }
    }
    // After the window has filled, the clock sits just under the floor (true offset less the shortest
    // possible return trip): never above it, which would stall remote players, and never more than
    // the jitter spread below it, which would add delay.
    const settled = offsets.slice(60 * (CLOCK_SYNC.windowMs / 1000));
    const floor = trueOffset - (base - jitter);
    for (const o of settled) {
      expect(o).toBeLessThanOrEqual(floor + 1e-6);
      expect(o).toBeGreaterThan(floor - 2 * jitter);
    }
    // And it never moves faster than the slew limit over any second.
    for (let i = 60; i < settled.length; i++) expect(Math.abs(settled[i] - settled[i - 60])).toBeLessThanOrEqual(CLOCK_SYNC.slewMsPerS + 1e-6);
    expect(minReturn).toBeGreaterThanOrEqual(base - jitter);
  });
});
