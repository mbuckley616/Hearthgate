import * as THREE from 'three';
import { activeLook } from './look';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * The 80s-90s look (Michael's M6 art direction): runs last, on the finished
 * low-resolution frame. Colour fringing toward the edges, contrast and
 * saturation, a split tone (purple shadows, warm highlights), a vignette and
 * a limited palette with ordered dithering. The chunky pixels come from
 * rendering small and scaling up with hard edges; scanlines and the curved
 * glass are a CSS layer (so they cover the HUD too).
 */
const shader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    levels: { value: 32 },
    dither: { value: 1 },
    contrast: { value: 1.1 },
    saturation: { value: 1.15 },
    shadowTint: { value: new THREE.Color() },
    highlightTint: { value: new THREE.Color() },
    splitTone: { value: 0.5 },
    aberration: { value: 0.6 },
    vignette: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float levels;
    uniform float dither;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform float splitTone;
    uniform float aberration;
    uniform float vignette;
    varying vec2 vUv;

    // 4x4 ordered (Bayer) threshold in 0..1, built from the 2x2 pattern.
    float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main() {
      // Colour fringing grows toward the screen's sides, like an old tube.
      vec2 off = vec2(aberration / resolution.x * (vUv.x - 0.5) * 2.0, 0.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);

      c = (c - 0.5) * contrast + 0.5;
      float l = luma(c);
      c = mix(vec3(l), c, saturation);

      // Split tone: shadows lean purple, highlights lean warm.
      vec3 st = shadowTint / max(luma(shadowTint), 0.01);
      vec3 ht = highlightTint / max(luma(highlightTint), 0.01);
      vec3 tone = mix(st, ht, smoothstep(0.08, 0.7, l));
      c *= mix(vec3(1.0), tone, splitTone);

      vec2 v = vUv - 0.5;
      c *= 1.0 - vignette * pow(length(v) * 1.45, 2.6);

      // Limited palette with ordered dithering.
      float n = max(2.0, levels) - 1.0;
      float d = (bayer4(gl_FragCoord.xy) - 0.5) * dither;
      c = floor(clamp(c, 0.0, 1.0) * n + 0.5 + d) / n;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class RetroPass extends ShaderPass {
  constructor() {
    super(shader);
  }

  /** Pull live values from tuning.look (the debug panel and settings change them). */
  sync(width: number, height: number): void {
    const look = activeLook();
    const u = this.uniforms;
    const on = look.retro;
    u.resolution.value.set(width, height);
    u.levels.value = on ? look.colorLevels : 256;
    u.dither.value = on ? look.ditherStrength : 0;
    u.contrast.value = on ? look.contrast : 1;
    u.saturation.value = on ? look.saturation : 1;
    (u.shadowTint.value as THREE.Color).setHex(look.shadowTint);
    (u.highlightTint.value as THREE.Color).setHex(look.highlightTint);
    u.splitTone.value = on ? look.splitTone : 0;
    u.aberration.value = on ? look.aberration : 0;
    u.vignette.value = on ? look.vignette : 0;
  }
}
