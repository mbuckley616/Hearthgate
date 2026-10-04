import { describe, expect, it } from "vitest";
import { CLOCK_SYNC, INTERP, TICK_MS } from "./sim";
import { addArrivalSample, addClockSample, createClockSync, interpDelayAt, minRtt, remoteTimeAt, serverTimeAt, stepClock } from "./clock";

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

describe("interpolation delay", () => {
  /**
   * Feed patches (server time = client arrival + 1000, each `late[k]` ms behind the best
   * path) and run 60 Hz frames between them, as the client does. Returns the delay seen.
   */
  function play(c: ReturnType<typeof createClockSync>, late: number[], from = 10): { delays: number[]; end: number } {
    const delays: number[] = [];
    let frame = from;
    for (let k = 0; k < late.length; k++) {
      const at = from + k * TICK_MS + late[k];
      while (frame < at) {
        delays.push(interpDelayAt(c, frame));
        frame += 1000 / 60;
      }
      addArrivalSample(c, at, from + k * TICK_MS + 1000);
    }
    return { delays, end: frame };
  }

  it("stays at the base on a link whose patches are never more than 50 ms late", () => {
    const c = createClockSync();
    const { delays } = play(c, Array.from({ length: 400 }, (_, i) => (i % 5) * 10));
    // The longest wait for a patch was a tick plus 40 ms; the base covers a tick plus 50.
    expect(c.late).toBeGreaterThan(20);
    expect(c.late).toBeLessThanOrEqual(40);
    expect(c.delayTarget).toBe(INTERP.baseMs);
    for (const d of delays) expect(d).toBe(INTERP.baseMs);
  });

  it("follows the longest wait a frame saw, capped, and comes back down when it ages out", () => {
    const c = createClockSync();
    const punctual = Array.from({ length: 20 }, () => 0);
    play(c, [...punctual, 80, ...punctual]); // one patch 80 ms late: a frame waited up to 130 ms
    expect(c.late).toBeGreaterThan(80 - 17);
    expect(c.late).toBeLessThanOrEqual(80);
    expect(c.delayTarget).toBe(c.late + TICK_MS);
    const { end } = play(c, [300, ...punctual], 10 + 42 * TICK_MS); // a 300 ms stall: capped
    expect(c.delayTarget).toBe(INTERP.maxMs);
    // Punctual patches from here on: once the stall has left the window the delay walks back
    // to the base at the slew rate (35 s of frames: 20 s window plus 10 s of slew).
    const { delays } = play(c, Array.from({ length: 700 }, () => 0), end);
    expect(c.late).toBeLessThan(17);
    expect(c.delayTarget).toBe(INTERP.baseMs);
    expect(Math.max(...delays)).toBe(INTERP.maxMs);
    expect(delays[delays.length - 1]).toBe(INTERP.baseMs);
    for (let i = 60; i < delays.length; i++) expect(Math.abs(delays[i] - delays[i - 60])).toBeLessThanOrEqual(INTERP.slewMsPerS + 1e-6);
  });

  it("slews the delay at INTERP.slewMsPerS and never jumps, even when the offset snaps", () => {
    const c = createClockSync();
    play(c, [0, 0, 0, 300]); // a frame waited 350 ms: asks for the cap
    expect(c.delayTarget).toBe(INTERP.maxMs);
    const t0 = 10 + 3 * TICK_MS + 300;
    const d0 = interpDelayAt(c, t0);
    expect(interpDelayAt(c, t0 + 1000)).toBeCloseTo(d0 + INTERP.slewMsPerS, 6);
    expect(interpDelayAt(c, t0 + 2000)).toBeCloseTo(d0 + 2 * INTERP.slewMsPerS, 6);
    // A new regime 1 s ahead snaps the offset; the delay keeps walking.
    addArrivalSample(c, t0 + 2050, t0 + 2050 + 2000);
    expect(stepClock(c, t0 + 2050)).toBe(2000);
    expect(c.delay).toBeCloseTo(d0 + 2 * INTERP.slewMsPerS + 0.5, 6);
    // It arrives at the cap within ten seconds and stops there.
    expect(interpDelayAt(c, t0 + 20000)).toBe(INTERP.maxMs);
    expect(remoteTimeAt(c, t0 + 20000)).toBe(t0 + 20000 + 2000 - INTERP.maxMs);
  });

  it("does not read a stall of this client as lateness", () => {
    const c = createClockSync();
    play(c, Array.from({ length: 40 }, () => 0));
    // The page freezes for 400 ms: eight patches arrive together before the next frame runs.
    const t = 10 + 40 * TICK_MS;
    for (let k = 0; k < 8; k++) addArrivalSample(c, t + 400, t + k * TICK_MS + 1000);
    play(c, Array.from({ length: 40 }, () => 0), t + 8 * TICK_MS);
    expect(c.late).toBeLessThan(17);
    expect(c.delayTarget).toBe(INTERP.baseMs);
  });

  it("ends the holds a fixed 100 ms leaves on a 150 ms link with jitter and late packets", () => {
    // Patches every tick through a link with 75 ms one way, +-25 ms jitter and 2% of
    // packets 80 ms late. A 60 Hz viewer draws remotes at remoteTimeAt and holds when the
    // cursor passes the newest snapshot it has. The same stream is scored with the fixed
    // base delay for comparison.
    const rng = mulberry32(11);
    const c = createClockSync();
    const serverAhead = 50000; // server sim time minus client time
    const arrivals: { t: number; recvAt: number }[] = [];
    for (let i = 0; i < 20 * 60; i++) {
      const t = serverAhead + i * TICK_MS; // server time of the tick
      const trip = 75 + (rng() * 2 - 1) * 25 + (rng() < 0.02 ? 80 : 0);
      arrivals.push({ t, recvAt: i * TICK_MS + trip });
    }
    // TCP keeps order: a late packet delays the ones behind it.
    for (let i = 1; i < arrivals.length; i++) arrivals[i].recvAt = Math.max(arrivals[i].recvAt, arrivals[i - 1].recvAt);
    let newest = -Infinity;
    let next = 0;
    let frames = 0;
    let heldAdaptive = 0;
    let heldFixed = 0;
    let maxDelay = 0;
    const settleMs = CLOCK_SYNC.windowMs + 10000;
    for (let now = 0; now < 60000; now += 1000 / 60) {
      while (next < arrivals.length && arrivals[next].recvAt <= now) {
        addArrivalSample(c, arrivals[next].recvAt, arrivals[next].t);
        newest = arrivals[next].t;
        next++;
      }
      const cursor = remoteTimeAt(c, now);
      const fixedCursor = now + c.offset - INTERP.baseMs;
      if (now < settleMs || newest === -Infinity) continue;
      frames++;
      if (cursor > newest) heldAdaptive++;
      if (fixedCursor > newest) heldFixed++;
      maxDelay = Math.max(maxDelay, c.delay);
    }
    expect(frames).toBeGreaterThan(1000);
    expect(heldFixed / frames).toBeGreaterThan(0.005); // the problem Session 6 measured
    expect(heldAdaptive).toBe(0);
    expect(maxDelay).toBeLessThanOrEqual(INTERP.maxMs);
    expect(maxDelay).toBeGreaterThan(INTERP.baseMs + 50);
  });
});
