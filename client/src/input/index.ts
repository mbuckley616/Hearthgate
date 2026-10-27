import { cameraRelativeMove, tuning, type InputFrame } from "@hearthgate/shared";
import { BUTTON_ACTIONS, GAME_CODES, PRESS_ACTIONS, gamepadAxes, gamepadBindings, keyboardBindings, keyboardLook, keyboardMove, type ButtonAction } from "./bindings";

const DEG = Math.PI / 180;

/**
 * Samples the keyboard, the mouse and a gamepad into one InputFrame per tick, through the action
 * layer in `bindings.ts`. Press actions (attack, dodge, jump, the abilities, lock-on, interact) are
 * edge-triggered: a press held across several ticks fires once, and one between two samples is
 * kept for the next. Movement, sprint and guard are read live.
 *
 * Keyboard-only is a hard requirement (rule 4): every action has a key. The mouse is an option: a
 * click on the game view takes pointer lock, and under it the mouse turns the camera and its
 * buttons count (left attacks, right guards, middle locks on). Escape lets go (the browser's own
 * key), and the click that takes the lock does nothing else.
 *
 * Movement is camera-relative: W walks away from the camera however it has turned. The turn
 * happens here, so the frame carries a plain world vector and the server and the replay never
 * need to know where the camera was. The camera's own turn (`look`) never goes in an InputFrame.
 */
export class Input {
  private down = new Set<string>();
  /**
   * Codes down at any point since the last sample. A tap shorter than the gap between two samples
   * (a busy main thread stretches it) still counts as held for one frame, so it steps the player
   * instead of vanishing.
   */
  private tapped = new Set<string>();
  /** Press actions since the last sample, from any device. */
  private pressed = new Set<ButtonAction>();
  /** Gamepad actions held at the last sample, for its edges. */
  private padWas = new Set<ButtonAction>();
  private readonly padNow = new Set<ButtonAction>();
  /** The left-stick click latches a sprint until the stick rests: nobody holds a stick down for long. */
  private padSprint = false;
  private seq = 0;
  /** The element pointer lock is taken on (the game canvas); null until attachMouse. */
  private lockTarget: Element | null = null;
  /** Mouse travel under the lock since the camera last took it, in pixels. */
  private mouseX = 0;
  private mouseY = 0;
  /** In play (attachMouse has run): Ctrl is the dodge, so the browser's Ctrl shortcuts are stopped. */
  private playing = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (GAME_CODES.has(e.code) || (this.playing && e.ctrlKey)) e.preventDefault();
      if (e.repeat) return;
      this.press(e.code);
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener("blur", () => {
      this.down.clear();
      this.tapped.clear();
    });
  }

  private press(code: string) {
    this.down.add(code);
    this.tapped.add(code);
    for (const a of PRESS_ACTIONS) if (keyboardBindings[a].includes(code)) this.pressed.add(a);
  }

  /**
   * Mouse look on `el`: a click takes pointer lock, then the mouse turns the camera and its
   * buttons are actions. Buttons are read only under the lock, so a click on the HUD or one that
   * only took the lock never swings.
   */
  attachMouse(el: HTMLElement) {
    this.lockTarget = el;
    this.playing = true;
    el.addEventListener("mousedown", (e) => {
      if (!this.mouseLocked) {
        if (e.button === 0) void requestLock(el);
        return;
      }
      e.preventDefault();
      this.press(`Mouse${e.button}`);
    });
    // Up anywhere: the lock may have gone between the press and the release.
    window.addEventListener("mouseup", (e) => {
      this.down.delete(`Mouse${e.button}`);
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.mouseLocked) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      if (this.mouseLocked) return;
      for (const b of [0, 1, 2]) this.down.delete(`Mouse${b}`);
      this.mouseX = 0;
      this.mouseY = 0;
    });
    // The right button is guard, not a menu.
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** True while the game view holds pointer lock. */
  get mouseLocked(): boolean {
    return this.lockTarget !== null && document.pointerLockElement === this.lockTarget;
  }

  /** The HUD's talk button (a tap or a click): the same press as F or A. */
  pressUse() {
    this.pressed.add("interact");
  }

  /** True while the player is holding a key. Used by the HUD hint. */
  get anyKeyDown(): boolean {
    return this.down.size > 0;
  }

  /**
   * The camera turn for this drawn frame, in radians (x yaw right positive, y pitch up positive,
   * the orbit camera's `applyLook`): the arrows and the right stick at their rates over `dtMs`, and
   * the mouse's travel since the last call. Read every drawn frame, not per tick, since it only
   * moves the view. Out keeps it allocation-free.
   */
  look(dtMs: number, out: { x: number; y: number }): { x: number; y: number } {
    const c = tuning.camera;
    const s = dtMs / 1000;
    const key = (codes: string[]) => codes.some((k) => this.down.has(k));
    const kx = (key(keyboardLook.right) ? 1 : 0) - (key(keyboardLook.left) ? 1 : 0);
    const ky = (key(keyboardLook.lower) ? 1 : 0) - (key(keyboardLook.raise) ? 1 : 0);
    let x = kx * c.arrowYawDegPerSec * DEG * s;
    let y = ky * c.arrowPitchDegPerSec * DEG * s;

    x += this.mouseX * c.mouseSensitivity * DEG;
    y -= this.mouseY * c.mouseSensitivity * DEG;
    this.mouseX = 0;
    this.mouseY = 0;

    const pad = firstGamepad();
    if (pad) {
      const look = deadzone(pad.axes[gamepadAxes.lookX] ?? 0, -(pad.axes[gamepadAxes.lookY] ?? 0), tuning.input.stickDeadzone);
      if (look.mag > 0) {
        const curved = Math.pow(look.mag, tuning.input.lookStickCurve) / look.mag;
        x += look.x * curved * c.gamepadYawDegPerSec * DEG * s;
        y += look.y * curved * c.gamepadPitchDegPerSec * DEG * s;
      }
    }
    out.x = x;
    out.y = y;
    return out;
  }

  /** `yaw` is the camera's turn (the orbit camera's yaw); 0 is the view from the south. */
  sample(yaw = 0): InputFrame {
    const keyHeld = (codes: string[]) => codes.some((k) => this.down.has(k) || this.tapped.has(k));
    let dx = (keyHeld(keyboardMove.right) ? 1 : 0) - (keyHeld(keyboardMove.left) ? 1 : 0);
    // Screen "up" (dy -1) is away from the camera: world -z at yaw 0.
    let dy = (keyHeld(keyboardMove.back) ? 1 : 0) - (keyHeld(keyboardMove.forward) ? 1 : 0);
    const held = (a: ButtonAction) => keyHeld(keyboardBindings[a]) || this.padNow.has(a);

    const pad = firstGamepad();
    this.padNow.clear();
    if (pad) {
      for (const a of BUTTON_ACTIONS) {
        for (const i of gamepadBindings[a] ?? []) if (pad.buttons[i]?.pressed) this.padNow.add(a);
      }
      for (const a of this.padNow) if (!this.padWas.has(a)) this.pressed.add(a);
      const move = deadzone(pad.axes[gamepadAxes.moveX] ?? 0, pad.axes[gamepadAxes.moveY] ?? 0, tuning.input.stickDeadzone);
      if (move.mag > 0) {
        dx = move.x;
        dy = move.y;
      }
      if (this.padNow.has("sprint")) this.padSprint = true;
      else if (move.mag === 0) this.padSprint = false;
    } else {
      this.padSprint = false;
    }
    this.padWas.clear();
    for (const a of this.padNow) this.padWas.add(a);

    const p = this.pressed;
    const ability = p.has("ability1") ? 1 : p.has("ability2") ? 2 : 0;
    const frame: InputFrame = {
      seq: ++this.seq,
      dx: 0,
      dy: 0,
      attack: p.has("attack"),
      dodge: p.has("dodge"),
      jump: p.has("jump"),
      ability,
      use: p.has("interact"),
      cycle: p.has("lockOn"),
      block: held("block"),
      sprint: held("sprint") || this.padSprint
    };
    this.pressed.clear();
    this.tapped.clear();

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (yaw !== 0) ({ dx, dy } = cameraRelativeMove(dx, dy, yaw));
    frame.dx = round(dx);
    frame.dy = round(dy);
    // Where the camera looks, on the ground: with strafe movement the hero faces it, so a swing goes there.
    const aim = cameraRelativeMove(0, -1, yaw);
    frame.aimX = round(aim.dx);
    frame.aimZ = round(aim.dy);
    return frame;
  }
}

/** Radial deadzone, rescaled so output starts at 0 just past it (the slice's). */
function deadzone(x: number, y: number, dz: number): { x: number; y: number; mag: number } {
  const mag = Math.hypot(x, y);
  if (mag <= dz) return { x: 0, y: 0, mag: 0 };
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled, mag: scaled };
}

/** Ask for pointer lock, raw (unaccelerated) where the browser offers it. A refusal (the lock was
 * just let go, or the page is not focused) leaves the mouse free; the next click asks again. */
async function requestLock(el: HTMLElement): Promise<void> {
  try {
    await (el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void).call(el, { unadjustedMovement: true });
  } catch {
    try {
      await el.requestPointerLock();
    } catch {
      // Refused: the mouse stays free.
    }
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function firstGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  for (const g of navigator.getGamepads()) if (g) return g;
  return null;
}
