/**
 * How big a name plate is drawn, from how far it is from the camera. The plate is a world-size
 * sprite drawn over everything (`depthTest: false`), so a teammate a metre in front of the camera
 * would get a plate a third of the screen wide, over your own hero and the enemy (the critic,
 * 4 Nov). Its height on screen is capped at a share of the viewport, about what it is at the
 * camera's usual distance, and it fades out as it comes closer still. Pure, so it can be checked
 * without a renderer.
 */
export interface PlateFitConfig {
  /** The plate's world height (m) when nothing caps it. */
  worldHeight: number;
  /** The tallest it may be drawn, as a share of the viewport's height. */
  maxScreen: number;
  /** Nearer than this (m) it starts to fade... */
  fadeNear: number;
  /** ...and nearer than this it is gone. */
  hideNear: number;
}

export interface PlateFit {
  /** Multiplies the plate's world size. */
  scale: number;
  opacity: number;
}

/** Writes into `out` (drawn every frame for every plate, so it allocates nothing) and returns it. */
export function plateFit(distance: number, fovDeg: number, cfg: PlateFitConfig, out: PlateFit): PlateFit {
  const d = Math.max(distance, 1e-3);
  // The world height that fills the whole viewport at this distance.
  const viewHeight = 2 * d * Math.tan((fovDeg * Math.PI) / 360);
  const share = cfg.worldHeight / viewHeight;
  const scale = share > cfg.maxScreen ? cfg.maxScreen / share : 1;
  const span = cfg.fadeNear - cfg.hideNear;
  out.scale = scale;
  out.opacity = span > 0 ? Math.min(1, Math.max(0, (d - cfg.hideNear) / span)) : d < cfg.hideNear ? 0 : 1;
  return out;
}
