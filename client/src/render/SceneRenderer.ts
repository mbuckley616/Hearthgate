import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { tuning } from '@hearthgate/shared/config/tuning';
import { RetroPass } from './RetroPass';
import { activeLook, lookMood } from './look';

/**
 * Renderer, scene-wide lighting and post-processing. Violet moonlight and
 * hemisphere fill against warm torches (in RoomView), soft shadows, purple
 * fog, bloom, then the retro pass. With look.pixelSize > 1 the whole frame
 * renders that many times smaller and the canvas scales it up with hard edges.
 */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private retro: RetroPass;
  private shownPixelSize = -1;
  private hemi: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private fog: THREE.FogExp2;
  /** Prefiltered reflection map for metal (armour, weapons); not applied scene-wide. */
  readonly envMap: THREE.Texture;
  /** The village's sky: a dome from a gold horizon to blue overhead (T3); hidden in the dungeon. */
  private sky: THREE.Mesh;
  private skyColors: THREE.BufferAttribute;

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    roomHalfSize: number,
  ) {
    const look = tuning.look;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(dungeonEnvironment(), 0.03).texture;
    pmrem.dispose();

    this.fog = new THREE.FogExp2(look.fogColor, look.fogDensity);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(look.backgroundColor);

    this.hemi = new THREE.HemisphereLight(look.hemiSkyColor, look.hemiGroundColor, look.hemiIntensity);
    this.scene.add(this.hemi);

    // Cool key light from high above, as if through an opening; the only shadow caster.
    this.moon = new THREE.DirectionalLight(look.moonColor, look.moonIntensity);
    this.moon.position.set(-8, 22, 6);
    this.moon.target.position.set(0, 0, 0);
    this.moon.castShadow = true;
    const s = this.moon.shadow;
    s.mapSize.set(look.shadowMapSize, look.shadowMapSize);
    const ext = roomHalfSize + 2;
    s.camera.left = -ext;
    s.camera.right = ext;
    s.camera.top = ext;
    s.camera.bottom = -ext;
    s.camera.near = 1;
    s.camera.far = 60;
    s.bias = -0.0004;
    s.normalBias = 0.03;
    s.radius = look.shadowRadius;
    this.scene.add(this.moon, this.moon.target);

    const skyGeo = new THREE.SphereGeometry(140, 24, 12);
    this.skyColors = new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3);
    skyGeo.setAttribute('color', this.skyColors);
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -1;
    this.sky.visible = false;
    this.scene.add(this.sky);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      look.bloomStrength,
      look.bloomRadius,
      look.bloomThreshold,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.retro = new RetroPass();
    this.composer.addPass(this.retro);
  }

  /** The level changed (T3): size the shadow area to it and show the sky only outdoors. */
  setLevel(roomHalfSize: number): void {
    const s = this.moon.shadow;
    const ext = roomHalfSize + 2;
    s.camera.left = -ext;
    s.camera.right = ext;
    s.camera.top = ext;
    s.camera.bottom = -ext;
    s.camera.far = Math.max(60, roomHalfSize * 4);
    s.camera.updateProjectionMatrix();
  }

  /** Centre the moon's shadow area on (x, z): a generated floor's shadows follow the hero (T4); every other level keeps it at the origin. */
  followShadow(x: number, z: number): void {
    this.moon.position.set(x - 8, 22, z + 6);
    this.moon.target.position.set(x, 0, z);
  }

  resize(width: number, height: number): void {
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.shownPixelSize = tuning.look.pixelSize;
    // Hard-edged upscaling only when we're drawing pixels on purpose.
    this.renderer.domElement.style.imageRendering = tuning.look.pixelSize > 1 ? 'pixelated' : 'auto';
  }

  render(): void {
    this.syncLook();
    this.composer.render();
  }

  /** Colour the sky dome from the horizon up, only when the colours changed. */
  private paintSky(top: number, horizon: number): void {
    const key = `${top}/${horizon}`;
    if (key === paintedSky) return;
    paintedSky = key;
    skyTop.setHex(top);
    skyBottom.setHex(horizon);
    const pos = this.sky.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const up = Math.max(0, pos.getY(i) / 140);
      skyMix.copy(skyBottom).lerp(skyTop, Math.pow(up, 0.6));
      this.skyColors.setXYZ(i, skyMix.r, skyMix.g, skyMix.b);
    }
    this.skyColors.needsUpdate = true;
  }

  /** Apply live tuning changes from the debug panel. */
  private syncLook(): void {
    const look = activeLook();
    const village = lookMood() === 'village';
    this.sky.visible = village;
    if (village) {
      const v = tuning.villageLook;
      this.paintSky(v.skyTopColor, v.skyHorizonColor);
      // The sun, low in the west (the look's one shadow caster), far enough out to light the whole square.
      const el = (v.sunHeightDeg * Math.PI) / 180;
      const az = (v.sunBearingDeg * Math.PI) / 180;
      this.moon.position.set(Math.sin(az) * Math.cos(el) * 40, Math.sin(el) * 40, -Math.cos(az) * Math.cos(el) * 40);
    } else {
      this.moon.position.set(-8, 22, 6);
    }
    this.renderer.toneMappingExposure = look.exposure;
    if (pixelRatio() !== this.renderer.getPixelRatio() || look.pixelSize !== this.shownPixelSize) this.resize(window.innerWidth, window.innerHeight);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.retro.sync(size.x, size.y);
    this.fog.color.setHex(look.fogColor);
    this.fog.density = look.fogDensity;
    (this.scene.background as THREE.Color).setHex(look.backgroundColor);
    this.hemi.color.setHex(look.hemiSkyColor);
    this.hemi.groundColor.setHex(look.hemiGroundColor);
    this.hemi.intensity = look.hemiIntensity;
    this.moon.color.setHex(look.moonColor);
    this.moon.intensity = look.moonIntensity;
    const shadow = this.moon.shadow;
    shadow.radius = look.shadowRadius;
    if (shadow.mapSize.x !== look.shadowMapSize) {
      shadow.mapSize.set(look.shadowMapSize, look.shadowMapSize);
      shadow.map?.dispose();
      shadow.map = null;
    }
    this.bloom.strength = look.bloomStrength;
    this.bloom.radius = look.bloomRadius;
    this.bloom.threshold = look.bloomThreshold;
  }
}

const skyTop = new THREE.Color();
const skyBottom = new THREE.Color();
const skyMix = new THREE.Color();
let paintedSky = '';

/** Device pixels per CSS pixel to render at: a fraction when drawing chunky retro pixels. */
function pixelRatio(): number {
  const look = tuning.look;
  const px = Math.max(1, Math.round(look.pixelSize));
  return px > 1 ? 1 / px : Math.min(window.devicePixelRatio, look.maxPixelRatio);
}

/**
 * Dim reflection environment that matches the room: cool dark vault above,
 * warm stone below, a ring of torch-coloured hot spots. Keeps polished metal
 * readable without the blown-out highlights a studio environment gives.
 */
function dungeonEnvironment(): THREE.Scene {
  const scene = new THREE.Scene();
  const sky = new THREE.SphereGeometry(10, 32, 16);
  const colors: number[] = [];
  const top = new THREE.Color(0x4a3a7a);
  const bottom = new THREE.Color(0x2a1810);
  const pos = sky.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const c = bottom.clone().lerp(top, (pos.getY(i) / 10 + 1) / 2);
    colors.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const torch = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a4a).multiplyScalar(3) });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), torch);
    spot.position.set(Math.cos(a) * 9, 1.5, Math.sin(a) * 9);
    scene.add(spot);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb49aff).multiplyScalar(1.5) }));
  moon.position.set(-4, 8, 3);
  scene.add(moon);
  return scene;
}
