import { tuning } from '@hearthgate/shared/config/tuning';

/**
 * The CRT glass (M6 art direction): scanlines lined up with the game's
 * pixels, a faint aperture mask, a vignette and rounded screen corners. It
 * sits over everything, HUD and menus included, and never takes clicks.
 */
export class CrtOverlay {
  private root = document.createElement('div');
  private shown = '';

  constructor() {
    this.root.className = 'crt';
    this.root.innerHTML = '<div class="crt-lines"></div><div class="crt-mask"></div><div class="crt-glass"></div>';
    document.body.appendChild(this.root);
  }

  update(): void {
    const look = tuning.look;
    const key = `${look.crt}|${look.scanlines}|${look.pixelSize}|${look.crtCornerPx}`;
    if (key === this.shown) return;
    this.shown = key;
    this.root.style.display = look.crt ? 'block' : 'none';
    const s = this.root.style;
    s.setProperty('--crt-line', `${Math.max(2, Math.round(look.pixelSize))}px`);
    s.setProperty('--crt-strength', String(look.scanlines));
    s.setProperty('--crt-corner', `${look.crtCornerPx}px`);
  }
}
