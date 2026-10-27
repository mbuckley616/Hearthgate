import { tuning } from '@hearthgate/shared/config/tuning';
import type { ActionFrame, ButtonAction, InputSource } from './actions';
import { gamepadAxes, gamepadBindings } from './bindings';

const DEG = Math.PI / 180;

/** Radial deadzone, rescaled so output starts at 0 just past the deadzone. */
function deadzone(x: number, y: number, dz: number): { x: number; y: number; mag: number } {
  const mag = Math.hypot(x, y);
  if (mag <= dz) return { x: 0, y: 0, mag: 0 };
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled, mag: scaled };
}

/** First connected standard gamepad. */
export class GamepadSource implements InputSource {
  private prev: boolean[] = [];

  contribute(frame: ActionFrame, dt: number): void {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p && p.connected);
    if (!pad) {
      this.prev = [];
      return;
    }
    const dz = tuning.input.stickDeadzone;
    const axis = (i: number) => pad.axes[i] ?? 0;

    const move = deadzone(axis(gamepadAxes.moveX), -axis(gamepadAxes.moveY), dz);
    frame.move.x += move.x;
    frame.move.y += move.y;

    const look = deadzone(axis(gamepadAxes.lookX), -axis(gamepadAxes.lookY), dz);
    if (look.mag > 0) {
      const curved = Math.pow(look.mag, tuning.input.lookStickCurve) / look.mag;
      frame.look.x += look.x * curved * tuning.camera.gamepadYawDegPerSec * DEG * dt;
      frame.look.y += look.y * curved * tuning.camera.gamepadPitchDegPerSec * DEG * dt;
    }

    const down = pad.buttons.map((b) => b.pressed);
    for (const [action, indices] of Object.entries(gamepadBindings) as [ButtonAction, number[]][]) {
      for (const i of indices) {
        if (down[i]) {
          frame.held.add(action);
          if (!this.prev[i]) frame.pressed.add(action);
        }
      }
    }
    this.prev = down;
  }

  endFrame(): void {}
}
