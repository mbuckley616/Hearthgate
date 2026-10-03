import type { InputFrame } from "@hearthgate/shared";

/**
 * Samples keyboard and gamepad into one InputFrame per tick.
 * Attack and dodge are edge-triggered: a press held across several ticks
 * fires once. Movement is sampled live.
 *
 * Keyboard-only is a hard requirement (laptop with no mouse). A gamepad is
 * read if one is connected: left stick moves, X attacks, A dodges.
 */
export class Input {
  private down = new Set<string>();
  private attackPressed = false;
  private dodgePressed = false;
  private padAttackWasDown = false;
  private padDodgeWasDown = false;
  private seq = 0;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.down.add(code);
      if (isAttackKey(code)) this.attackPressed = true;
      if (isDodgeKey(code)) this.dodgePressed = true;
      if (isGameKey(code)) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener("blur", () => {
      this.down.clear();
    });
  }

  /** True while the player is holding a movement key. Used by the HUD hint. */
  get anyKeyDown(): boolean {
    return this.down.size > 0;
  }

  sample(): InputFrame {
    let dx = 0;
    let dy = 0;
    if (this.down.has("KeyA") || this.down.has("ArrowLeft")) dx -= 1;
    if (this.down.has("KeyD") || this.down.has("ArrowRight")) dx += 1;
    // Screen "up" is world -z (the camera looks down +z toward the player's front at facing 0),
    // so W moves toward -z.
    if (this.down.has("KeyW") || this.down.has("ArrowUp")) dy -= 1;
    if (this.down.has("KeyS") || this.down.has("ArrowDown")) dy += 1;

    let attack = this.attackPressed;
    let dodge = this.dodgePressed;
    this.attackPressed = false;
    this.dodgePressed = false;

    const pad = firstGamepad();
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) {
        dx = ax;
        dy = ay;
      }
      const padAttack = pad.buttons[2]?.pressed ?? false; // X on Xbox layout
      const padDodge = pad.buttons[0]?.pressed ?? false; // A
      if (padAttack && !this.padAttackWasDown) attack = true;
      if (padDodge && !this.padDodgeWasDown) dodge = true;
      this.padAttackWasDown = padAttack;
      this.padDodgeWasDown = padDodge;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    this.seq++;
    return { seq: this.seq, dx: round(dx), dy: round(dy), attack, dodge };
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function isAttackKey(code: string): boolean {
  return code === "KeyJ" || code === "Space";
}

function isDodgeKey(code: string): boolean {
  return code === "ShiftLeft" || code === "ShiftRight" || code === "KeyK";
}

function isGameKey(code: string): boolean {
  return (
    code.startsWith("Arrow") ||
    code === "Space" ||
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD"
  );
}

function firstGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  for (const g of navigator.getGamepads()) if (g) return g;
  return null;
}
