import * as THREE from 'three';
import type { Style } from '@hearthgate/shared/config/tuning';
import { applyLoadout, type Loadout } from '@hearthgate/shared/sim/coop';
import { createPlayer } from '@hearthgate/shared/sim/player';
import { HeroView } from '../render/HeroView';
import { Palette } from '../render/props';
import { dungeonEnvironment } from '../render/SceneRenderer';

const WIDTH = 200;
const HEIGHT = 280;
/** A little off square-on, so the figure reads as a body and not a cut-out. */
const FACING = -0.35;

/**
 * The hero on the bag and body tab (Michael, 28 Oct): the game's own HeroView, dressed from the
 * profile's loadout and facing the player, drawn by a small renderer of its own so it never
 * touches the game's frame. Built on first use, then kept for the session.
 */
export class HeroPreview {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, WIDTH / HEIGHT, 0.1, 20);
  private view: HeroView | null = null;
  private state = createPlayer('preview', 0, 0, FACING);

  constructor() {
    this.canvas.className = 'hero-preview';
    this.canvas.style.width = `${WIDTH}px`;
    this.canvas.style.height = `${HEIGHT}px`;
  }

  /** Dress the figure in what the profile wears and hold the weapon in hand. */
  show(loadout: Loadout, style: Style): void {
    this.build();
    applyLoadout(this.state, loadout, true);
    this.state.style = style;
  }

  /** Step the idle and draw; only while the hero screen is open. */
  frame(dt: number): void {
    if (!this.renderer || !this.view) return;
    this.view.update(this.state, this.state, 1, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private build(): void {
    if (this.renderer) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(WIDTH, HEIGHT, false);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer = r;
    const pmrem = new THREE.PMREMGenerator(r);
    const env = pmrem.fromScene(dungeonEnvironment(), 0.03).texture;
    pmrem.dispose();

    // Warm key from the front left, cool rim from behind, as the village's afternoon lights a hero.
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a48, 1.4));
    const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
    key.position.set(-2, 3, 4);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 1.6);
    rim.position.set(2, 2.5, -3);
    this.scene.add(key, rim);

    this.view = new HeroView(new Palette(env));
    this.scene.add(this.view.root);
    this.camera.position.set(0, 1.0, 4.6);
    this.camera.lookAt(0, 0.92, 0);
  }
}
