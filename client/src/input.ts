import type { InputFrame } from "@hearthgate/shared";

/**
 * Samples keyboard and gamepad into one InputFrame per tick.
 * Attack and dodge are edge-triggered: a press held across several ticks
 * fires once. Movement is sampled live.
 *
 * Keyboard-only is a hard requirement (laptop with no mouse). A gamepad is
 * read if one is connected: left stick moves, X attacks, A dodges, the
 * ability slots are Y, B and RB (keys 1, 2 and 3), LB (key E) uses a
 * Revive Draught on a dead teammate in reach, and LT (keys L or Q) is block,
 * held: raise it just before a blow lands to parry.
 */

/** Gamepad buttons for ability slots 1..3 (standard mapping: Y, B, RB). */
const PAD_SLOT_BUTTONS = [3, 1, 5];
/** Gamepad button for the Revive Draught (standard mapping: LB). */
const PAD_USE_BUTTON = 4;
/** Gamepad button for block (standard mapping: LT, an analogue trigger read as pressed). */
const PAD_BLOCK_BUTTON = 6;
export class Input {
  private down = new Set<string>();
  private attackPressed = false;
  private dodgePressed = false;
  private padAttackWasDown = false;
  private padDodgeWasDown = false;
  private abilityPressed = 0;
  private padSlotWasDown = [false, false, false];
  private usePressed = false;
  private padUseWasDown = false;
  private seq = 0;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.down.add(code);
      if (isAttackKey(code)) this.attackPressed = true;
      if (isDodgeKey(code)) this.dodgePressed = true;
      const slot = slotKey(code);
      if (slot) this.abilityPressed = slot;
      if (isUseKey(code)) this.usePressed = true;
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
    let ability = this.abilityPressed;
    let use = this.usePressed;
    let block = this.down.has("KeyL") || this.down.has("KeyQ");
    this.attackPressed = false;
    this.dodgePressed = false;
    this.abilityPressed = 0;
    this.usePressed = false;

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
      PAD_SLOT_BUTTONS.forEach((b, i) => {
        const down = pad.buttons[b]?.pressed ?? false;
        if (down && !this.padSlotWasDown[i]) ability = i + 1;
        this.padSlotWasDown[i] = down;
      });
      const padUse = pad.buttons[PAD_USE_BUTTON]?.pressed ?? false;
      if (padUse && !this.padUseWasDown) use = true;
      this.padUseWasDown = padUse;
      if (pad.buttons[PAD_BLOCK_BUTTON]?.pressed) block = true;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    this.seq++;
    return { seq: this.seq, dx: round(dx), dy: round(dy), attack, dodge, ability, use, block };
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

function isUseKey(code: string): boolean {
  return code === "KeyE";
}

/** Ability slot for a key: 1, 2, 3 on the number row or the numpad; 0 for anything else. */
function slotKey(code: string): number {
  const m = /^(?:Digit|Numpad)([1-3])$/.exec(code);
  return m ? Number(m[1]) : 0;
}

function isGameKey(code: string): boolean {
  return (
    slotKey(code) > 0 ||
    isUseKey(code) ||
    code === "KeyL" ||
    code === "KeyQ" ||
    code.startsWith("Arrow") ||
    code === "Space" ||
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD"
  );
}

export function firstGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  for (const g of navigator.getGamepads()) if (g) return g;
  return null;
}
