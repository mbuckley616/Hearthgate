// A teammate's name plate never grows past its usual size on screen, however near the camera they
// stand (the critic, 4 Nov: about a third of a 960 x 600 screen wide at a metre or two). Run by
// `npm run check`.
import assert from 'node:assert/strict';
import { tuning } from '@hearthgate/shared/config/tuning';
import { plateFit, type PlateFit } from '../client/src/render/plateFit';

const c = tuning.camera;
const cfg = { worldHeight: 0.4, maxScreen: c.nameplateMaxScreen, fadeNear: c.nameplateFadeNear, hideNear: c.nameplateHideNear };
const out: PlateFit = { scale: 1, opacity: 1 };
const VW = 960;
const VH = 600;

function px(d: number): { w: number; h: number; opacity: number } {
  plateFit(d, c.fovDeg, cfg, out);
  const view = 2 * d * Math.tan((c.fovDeg * Math.PI) / 360);
  const h = ((0.4 * out.scale) / view) * VH;
  return { w: h * 4, h, opacity: out.opacity };
}

function ok(name: string, fn: () => void): void {
  fn();
  console.log(`ok    ${name}`);
}

ok('near the camera the plate is no taller than its cap', () => {
  for (const d of [0.3, 0.8, 1.2, 1.8, 2.6, 4]) {
    const { w, h } = px(d);
    assert.ok(h <= c.nameplateMaxScreen * VH + 1e-6, `${d} m: ${h.toFixed(1)} px tall`);
    assert.ok(w < VW / 5, `${d} m: ${w.toFixed(0)} px wide`);
  }
});

ok('the cap is about the plate at the usual camera distance', () => {
  const usual = px(c.distance);
  assert.ok(usual.h > c.nameplateMaxScreen * VH * 0.8, `${usual.h.toFixed(1)} px at ${c.distance} m`);
});

ok('far off it keeps its world size', () => {
  plateFit(20, c.fovDeg, cfg, out);
  assert.equal(out.scale, 1);
  assert.equal(out.opacity, 1);
});

ok('it fades out as it nears the camera', () => {
  assert.equal(px(c.nameplateHideNear - 0.1).opacity, 0);
  assert.equal(px(c.nameplateFadeNear + 0.1).opacity, 1);
  const mid = px((c.nameplateHideNear + c.nameplateFadeNear) / 2).opacity;
  assert.ok(mid > 0.3 && mid < 0.7, `${mid}`);
});

console.log('\nall passed');
