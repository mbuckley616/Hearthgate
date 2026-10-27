import { afterEach, describe, expect, it } from "vitest";
import { applyTuning, resetTuning, tuning, tuningDefaults, tuningEdits, tuningRanges } from "./tuning";

afterEach(() => resetTuning());

describe("tuning edits (the debug panel, through the server)", () => {
  it("applies a value in range and lists it as an edit", () => {
    expect(applyTuning({ path: "movement.runSpeed", value: 7 })).toBe(true);
    expect(tuning.movement.runSpeed).toBe(7);
    expect(tuningEdits()).toEqual([{ path: "movement.runSpeed", value: 7 }]);
  });

  it("refuses what a client should not be able to send: no range, out of range, wrong kind, unknown", () => {
    const [lo, hi] = tuningRanges["movement.runSpeed"];
    expect(applyTuning({ path: "movement.runSpeed", value: hi + 1 })).toBe(false);
    expect(applyTuning({ path: "movement.runSpeed", value: lo - 1 })).toBe(false);
    expect(applyTuning({ path: "movement.runSpeed", value: Number.NaN })).toBe(false);
    expect(applyTuning({ path: "movement.runSpeed", value: true })).toBe(false);
    expect(applyTuning({ path: "movement.faceCamera", value: 1 })).toBe(false);
    expect(applyTuning({ path: "movement.nothing", value: 1 })).toBe(false);
    expect(applyTuning({ path: "__proto__.polluted", value: 1 })).toBe(false);
    expect(applyTuning({ path: "movement", value: 1 })).toBe(false);
    expect(applyTuning("movement.runSpeed=7")).toBe(false);
    expect(tuning).toEqual(tuningDefaults);
  });

  it("takes a boolean for a boolean, and reset puts everything back", () => {
    expect(applyTuning({ path: "movement.faceCamera", value: false })).toBe(true);
    expect(applyTuning({ path: "dodge.charges", value: 3 })).toBe(true);
    expect(tuningEdits()).toHaveLength(2);
    resetTuning();
    expect(tuning).toEqual(tuningDefaults);
    expect(tuningEdits()).toEqual([]);
  });

  it("gives every numeric value a range the defaults sit inside", () => {
    const sections = tuning as unknown as Record<string, Record<string, unknown>>;
    for (const s of Object.keys(sections)) {
      for (const [k, v] of Object.entries(sections[s])) {
        if (typeof v !== "number") continue;
        const r = tuningRanges[`${s}.${k}`];
        expect(r, `${s}.${k}`).toBeDefined();
        expect(v).toBeGreaterThanOrEqual(r[0]);
        expect(v).toBeLessThanOrEqual(r[1]);
      }
    }
  });
});
