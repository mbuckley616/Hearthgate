import { describe, expect, it } from "vitest";
import { clearedBarText, expireLogLines, nudgeOffset, pushLogLine, type LogLine } from "./feedback";
import { CELLAR, OPEN_FIELD, WARRENS, YARD } from "./level";
import { EVENT_LOG, HIT_FEEDBACK } from "./sim";

describe("hit feedback nudge", () => {
  const { takenNudgeM: s, takenNudgeMs: d } = HIT_FEEDBACK;

  it("is zero before, at and after the ends", () => {
    for (const t of [-10, 0, d, d + 1, 10_000]) expect(nudgeOffset(t, s, d)).toBe(0);
  });

  it("peaks at exactly the requested strength, early in the window", () => {
    let peak = 0;
    let peakAt = 0;
    for (let t = 1; t < d; t++) {
      const v = nudgeOffset(t, s, d);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(s + 1e-9);
      if (v > peak) [peak, peakAt] = [v, t];
    }
    expect(peak).toBeCloseTo(s, 3);
    expect(peakAt).toBeLessThan(d / 2);
  });

  it("keeps taking a hit stronger and longer than landing one", () => {
    expect(HIT_FEEDBACK.takenNudgeM).toBeGreaterThan(HIT_FEEDBACK.dealtNudgeM);
    expect(HIT_FEEDBACK.takenNudgeMs).toBeGreaterThan(HIT_FEEDBACK.dealtNudgeMs);
    // Stays a nudge, not a shake: under half a metre and a fifth of a second.
    expect(HIT_FEEDBACK.takenNudgeM).toBeLessThan(0.5);
    expect(HIT_FEEDBACK.takenNudgeMs).toBeLessThanOrEqual(200);
  });
});

describe("the enemy bar once no enemy lives", () => {
  it("promises a return only where the level resets", () => {
    expect(clearedBarText(OPEN_FIELD)).toBe("returning soon");
    expect(clearedBarText(YARD)).toBe("returning soon");
    expect(clearedBarText(WARRENS)).toBe("floor clear");
    expect(clearedBarText(CELLAR)).toBe("floor clear");
  });
});

describe("event log", () => {
  it("keeps only the newest lines when a fight makes more than fit", () => {
    const log: LogLine[] = [];
    for (let i = 0; i < 9; i++) pushLogLine(log, `line ${i}`, 1000 + i * 100, EVENT_LOG);
    expect(log.length).toBe(EVENT_LOG.maxLines);
    expect(log.map((l) => l.text)).toEqual(["line 5", "line 6", "line 7", "line 8"]);
  });

  it("shows each line for showMs, then drops it", () => {
    const log: LogLine[] = [];
    pushLogLine(log, "a", 0, EVENT_LOG);
    pushLogLine(log, "b", 1000, EVENT_LOG);
    expireLogLines(log, EVENT_LOG.showMs);
    expect(log.map((l) => l.text)).toEqual(["a", "b"]);
    expireLogLines(log, EVENT_LOG.showMs + 1);
    expect(log.map((l) => l.text)).toEqual(["b"]);
    expireLogLines(log, 1000 + EVENT_LOG.showMs + 1);
    expect(log).toEqual([]);
  });
});
