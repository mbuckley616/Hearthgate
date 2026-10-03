import { describe, expect, it } from "vitest";
import { nudgeOffset } from "./feedback";
import { HIT_FEEDBACK } from "./sim";

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
