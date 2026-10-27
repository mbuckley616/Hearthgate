import { tuning } from '@hearthgate/shared/config/tuning';
import { BUTTON_ACTIONS, type ActionFrame, type InputSource } from './actions';
import { keyboardBindings, keyboardLook, keyboardMove } from './bindings';

const DEG = Math.PI / 180;

/** Keyboard + mouse. Mouse look and mouse buttons only count while the pointer is locked. */
export class KeyboardMouseSource implements InputSource {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.held.clear());
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('wheel', this.onWheel, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  requestPointerLock(): void {
    if (!this.pointerLocked) this.target.requestPointerLock()?.catch?.(() => {});
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  contribute(frame: ActionFrame, dt: number): void {
    const any = (codes: string[]) => codes.some((c) => this.held.has(c));
    const mx = (any(keyboardMove.right) ? 1 : 0) - (any(keyboardMove.left) ? 1 : 0);
    const my = (any(keyboardMove.forward) ? 1 : 0) - (any(keyboardMove.back) ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      frame.move.x += mx / len;
      frame.move.y += my / len;
    }

    const lx = (any(keyboardLook.right) ? 1 : 0) - (any(keyboardLook.left) ? 1 : 0);
    const ly = (any(keyboardLook.up) ? 1 : 0) - (any(keyboardLook.down) ? 1 : 0);
    frame.look.x += lx * tuning.camera.gamepadYawDegPerSec * DEG * dt;
    frame.look.y += ly * tuning.camera.gamepadPitchDegPerSec * DEG * dt;

    const sens = tuning.camera.mouseSensitivity * DEG;
    frame.look.x += this.mouseDX * sens;
    frame.look.y -= this.mouseDY * sens;

    for (const action of BUTTON_ACTIONS) {
      const codes = keyboardBindings[action];
      if (codes.some((c) => this.held.has(c))) frame.held.add(action);
      if (codes.some((c) => this.pressed.has(c))) frame.pressed.add(action);
    }
  }

  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    // Wheel "keys" are momentary.
    this.held.delete('WheelUp');
    this.held.delete('WheelDown');
  }

  private isTypingInField(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTypingInField(e)) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    // Ctrl is dodge: while playing, stop the Ctrl shortcuts a page is allowed to stop (save, bookmark, find...).
    // Ctrl+W / T / N can't be stopped by any page; Game asks before leaving instead.
    if (this.pointerLocked && e.ctrlKey) e.preventDefault();
    if (!this.held.has(e.code)) this.pressed.add(e.code);
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    const code = `Mouse${e.button}`;
    if (e.button === 1) e.preventDefault();
    this.pressed.add(code);
    this.held.add(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.held.delete(`Mouse${e.button}`);
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.pointerLocked) return;
    e.preventDefault();
    const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
    this.pressed.add(code);
    this.held.add(code);
  };
}
