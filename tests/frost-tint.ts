// A Chilled hero wears frost exactly while the slow lasts (E1d, Michael's A): none on a warm hero,
// in over the first moments, out by the time the Chill runs out, and no blink when a second Chill
// restarts the slow. Run by `npm run check`.
import assert from 'node:assert/strict';
import { tuning } from '@hearthgate/shared/config/tuning';
import { frostStep } from '../client/src/render/frost';

const peak = tuning.look.chillTint;
const fade = tuning.look.chillTintFadeS;
const dur = tuning.chill.durationS;
const dt = 1 / 60;

/** Frames of a Chill landing at `left` and counting down, as snapshots and prediction show it. */
function run(levels: number[], from: number, chillAt: (t: number) => number | undefined, seconds: number): number {
  let level = from;
  for (let t = 0; t < seconds; t += dt) {
    level = frostStep(level, chillAt(t), peak, fade, dt);
    levels.push(level);
  }
  return level;
}

function ok(name: string, fn: () => void): void {
  fn();
  console.log(`ok    ${name}`);
}

ok('the look values are sane', () => {
  assert.ok(peak > 0 && peak <= 1 && fade > 0 && fade < dur / 2);
});

ok('a warm hero shows no frost', () => {
  assert.equal(frostStep(0, undefined, peak, fade, dt), 0);
  assert.equal(frostStep(peak, undefined, peak, fade, dt), 0);
  assert.equal(frostStep(0, 0, peak, fade, dt), 0);
});

ok('a Chill fades in to its peak within its fade, and never past it', () => {
  const levels: number[] = [];
  run(levels, 0, (t) => dur - t, dur);
  assert.ok(levels[0] > 0 && levels[0] < peak);
  const inAt = Math.ceil(fade / dt) + 1;
  assert.ok(Math.abs(levels[inAt] - peak) < 1e-9, `${levels[inAt]}`);
  for (const l of levels) assert.ok(l <= peak + 1e-9);
});

ok('it is gone by the time the Chill runs out', () => {
  const levels: number[] = [];
  const last = run(levels, 0, (t) => (t < dur ? dur - t : undefined), dur + 0.1);
  assert.equal(last, 0);
  const atEnd = levels[Math.floor((dur - 0.05) / dt)];
  assert.ok(atEnd < peak * 0.2, `${atEnd}`);
});

ok('a second Chill near the end brings it back up without a blink', () => {
  const levels: number[] = [];
  // 2.8 s into one Chill, a second restarts the clock.
  run(levels, 0, (t) => (t < 2.8 ? dur - t : dur - (t - 2.8)), 3.6);
  const low = Math.min(...levels.slice(Math.floor(2.5 / dt)));
  assert.ok(low > peak * 0.3, `dipped to ${low}`);
  assert.ok(Math.abs(levels[levels.length - 1] - peak) < 1e-9);
});
