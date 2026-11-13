// A Necromancer's skeleton (sim/summons.ts) is drawn as bones, not as a knight: a hero with `summon`
// shows the skeleton's figure, its sword and no shield; a hero without it keeps the slice's figures,
// and the bones are built only for a summon. Run by `npm run check`.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer } from '@hearthgate/shared/sim/player';
import { HeroView } from '../client/src/render/HeroView';
import { Palette } from '../client/src/render/props';

function ok(name: string, fn: () => void): void {
  fn();
  console.log(`ok    ${name}`);
}

/** Every mesh drawn now under the view's root (visible all the way up), by material. */
function shown(view: HeroView, material: THREE.Material): number {
  let n = 0;
  view.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.material !== material) return;
    for (let a: THREE.Object3D | null = o; a; a = a.parent) if (!a.visible) return;
    n++;
  });
  return n;
}

const palette = new Palette(new THREE.Texture());

ok('a hero is drawn in the slice\'s knight, with its shield, and no bones', () => {
  const view = new HeroView(palette);
  const p = createPlayer('p1', 0, 0, 0);
  view.update(p, p, 1, 1 / 60);
  assert.ok(shown(view, palette.helm) > 0);
  assert.equal(shown(view, palette.bone), 0);
});

ok('a summon is drawn as bones with violet eyes, sword in hand and no shield or helm', () => {
  const view = new HeroView(palette);
  const s = createPlayer('k7', 0, 0, 0);
  s.henchman = true;
  s.summon = { owner: 'p1', until: 12 };
  view.update(s, s, 1, 1 / 60);
  assert.ok(shown(view, palette.bone) > 10);
  assert.equal(shown(view, palette.soul), 2);
  assert.equal(shown(view, palette.helm), 0);
  assert.ok(shown(view, palette.blade) > 0, 'the sword is in hand');
  // The knight's shield is the royal heater; none on a skeleton.
  assert.equal(shown(view, palette.royal), 0);
});
