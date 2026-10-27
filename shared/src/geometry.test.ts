import { describe, expect, it } from "vitest";
import { GROUND_BOX, sphereCast, wallBox } from "./geometry";

const wall = wallBox({ x: 0, z: -5, hw: 2, hd: 0.5 }, 0, 3);
const north = { x: 0, y: 0, z: -1 };

describe("the camera's sphere cast", () => {
  it("stops a sphere short of a wall by its radius, and runs the full distance past a miss", () => {
    // The wall's near face is at z = -4.5: a 0.25 m sphere from 1 m up touches it at 4.25 m.
    expect(sphereCast({ x: 0, y: 1, z: 0 }, north, 10, 0.25, [wall])).toBeCloseTo(4.25);
    expect(sphereCast({ x: 3, y: 1, z: 0 }, north, 10, 0.25, [wall])).toBe(10);
    expect(sphereCast({ x: 0, y: 4, z: 0 }, north, 10, 0.25, [wall])).toBe(10);
    expect(sphereCast({ x: 0, y: 1, z: 0 }, north, 3, 0.25, [wall])).toBe(3);
  });

  it("starts at 0 inside a box, unless told to ignore what it already overlaps", () => {
    const inside = { x: 0, y: 1, z: -4.4 };
    expect(sphereCast(inside, north, 10, 0.25, [wall])).toBe(0);
    expect(sphereCast(inside, north, 10, 0.25, [wall], true)).toBe(10);
  });

  it("keeps the eye above the ground: a cast downward stops a radius above it", () => {
    const down = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
    // From 1.7 m, a 0.25 m sphere at 45 degrees down meets the floor after (1.7 - 0.25) * sqrt 2.
    expect(sphereCast({ x: 0, y: 1.7, z: 0 }, down, 10, 0.25, [GROUND_BOX])).toBeCloseTo(1.45 * Math.SQRT2);
  });
});
