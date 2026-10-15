import { CAMERA, cameraRelativeMove, type InputFrame } from "@hearthgate/shared";

/**
 * Samples keyboard and gamepad into one InputFrame per tick.
 * Attack, dodge and jump are edge-triggered: a press held across several ticks
 * fires once. Movement and sprint are sampled live.
 *
 * Keyboard-only is a hard requirement (laptop with no mouse). J attacks, Space jumps,
 * Shift held sprints, K or C dodges (Michael, 2026-10-15, 3A). A gamepad is read if
 * one is connected: left stick moves, X attacks, A jumps, B dodges, a click of the left
 * stick sprints until the stick comes back to rest, the ability slots are Y, RT and RB
 * (keys 1, 2 and 3), LB (key E) uses a Revive Draught on a dead teammate in reach, and
 * LT (keys L or Q) is block, held: raise it just before a blow lands to parry. With a bow,
 * RT (keys Tab or R) cycles the lock-on through the enemies in range, then back to auto:
 * the bow has no slot 2, so the one button serves both.
 *
 * Movement is camera-relative: W and the stick's up walk away from the camera whichever way
 * it has turned. The turn happens here, so the frame carries a plain world vector and the
 * server and the replay never need to know where the camera was. WASD and the left stick are
 * the only movement: the arrow keys and the right stick turn and tilt the camera (`look`), which
 * never goes in an InputFrame.
 *
 * The mouse is an option, never required (Michael, 2026-10-14, A): a click on the game view takes
 * pointer lock, and while it holds, the mouse turns the camera (and with it where W walks and the
 * player faces), the left button attacks and the right button blocks, held. Escape lets go (the
 * browser's own key), and the click that takes the lock does nothing else.
 */

/** Gamepad buttons for ability slots 1..3 (standard mapping: Y, RT, RB). B is the dodge now. */
const PAD_SLOT_BUTTONS = [3, 7, 5];
/** Standard mapping: A jumps, B dodges, X attacks, a left-stick click sprints. */
const PAD_JUMP_BUTTON = 0;
const PAD_DODGE_BUTTON = 1;
const PAD_ATTACK_BUTTON = 2;
const PAD_SPRINT_BUTTON = 10;
/** The left stick inside this is at rest: it moves nothing and ends a clicked sprint. */
const PAD_STICK_DEADZONE = 0.2;
/** Gamepad button for the Revive Draught (standard mapping: LB). */
const PAD_USE_BUTTON = 4;
/** Gamepad button for block (standard mapping: LT, an analogue trigger read as pressed). */
const PAD_BLOCK_BUTTON = 6;
/** Gamepad button for the bow's lock-on cycle (standard mapping: RT). */
const PAD_CYCLE_BUTTON = 7;
export class Input {
  private down = new Set<string>();
  /**
   * Keys pressed since the last sample. A tap shorter than the gap between two samples (a busy
   * main thread stretches it) still counts as held for one frame, so it turns or steps the player
   * instead of vanishing; the same frame-rate dependence as a dropped input tick.
   */
  private tapped = new Set<string>();
  private attackPressed = false;
  private dodgePressed = false;
  private padAttackWasDown = false;
  private padDodgeWasDown = false;
  private jumpPressed = false;
  private padJumpWasDown = false;
  /** The left-stick click latches a sprint until the stick rests: nobody holds a stick down for long. */
  private padSprint = false;
  private abilityPressed = 0;
  private padSlotWasDown = [false, false, false];
  private usePressed = false;
  private padUseWasDown = false;
  private cyclePressed = false;
  private padCycleWasDown = false;
  private seq = 0;
  /** The element pointer lock is taken on (the game canvas); null until attachMouse. */
  private lockTarget: Element | null = null;
  /** Mouse travel under the lock since the camera last took it, in pixels. */
  private mouseX = 0;
  private mouseY = 0;
  /** The right button held under the lock: block, like L, Q or LT. */
  private mouseBlock = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.down.add(code);
      this.tapped.add(code);
      if (isAttackKey(code)) this.attackPressed = true;
      if (isDodgeKey(code)) this.dodgePressed = true;
      if (isJumpKey(code)) this.jumpPressed = true;
      const slot = slotKey(code);
      if (slot) this.abilityPressed = slot;
      if (isUseKey(code)) this.usePressed = true;
      if (isCycleKey(code)) this.cyclePressed = true;
      if (isGameKey(code)) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener("blur", () => {
      this.down.clear();
      this.tapped.clear();
      this.mouseBlock = false;
    });
  }

  /**
   * Mouse look on `el`: a click takes pointer lock, then the mouse turns the camera, the left
   * button attacks and the right blocks. Buttons are read only under the lock, so a click on the
   * HUD or one that only took the lock never swings.
   */
  attachMouse(el: HTMLElement) {
    this.lockTarget = el;
    el.addEventListener("mousedown", (e) => {
      if (!this.mouseLocked) {
        if (e.button === 0) void requestLock(el);
        return;
      }
      if (e.button === 0) this.attackPressed = true;
      if (e.button === 2) this.mouseBlock = true;
      e.preventDefault();
    });
    // Up anywhere: the lock may have gone between the press and the release.
    window.addEventListener("mouseup", (e) => {
      if (e.button === 2) this.mouseBlock = false;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.mouseLocked) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      if (this.mouseLocked) return;
      this.mouseBlock = false;
      this.mouseX = 0;
      this.mouseY = 0;
    });
    // The right button is block, not a menu.
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** True while the game view holds pointer lock. */
  get mouseLocked(): boolean {
    return this.lockTarget !== null && document.pointerLockElement === this.lockTarget;
  }

  /**
   * The mouse travel since the last call, in pixels (x right, y down), and reset. Read once per
   * drawn frame by the camera. Out keeps it allocation-free.
   */
  takeMouse(out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.mouseX;
    out.y = this.mouseY;
    this.mouseX = 0;
    this.mouseY = 0;
    return out;
  }

  /** The HUD's talk button (a tap or a click): the same use press as E or LB. */
  pressUse() {
    this.usePressed = true;
  }

  /** True while the player is holding a movement key. Used by the HUD hint. */
  get anyKeyDown(): boolean {
    return this.down.size > 0;
  }

  /**
   * The camera turn the player is asking for this frame: x is -1 (Left arrow, right stick left)
   * to 1, y is -1 (Up arrow, stick up) to 1. Read live every drawn frame, not per tick, since it
   * only moves the view. Out keeps it allocation-free.
   */
  look(out: { x: number; y: number }): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.down.has("ArrowLeft")) x -= 1;
    if (this.down.has("ArrowRight")) x += 1;
    if (this.down.has("ArrowUp")) y -= 1;
    if (this.down.has("ArrowDown")) y += 1;
    const pad = firstGamepad();
    if (pad) {
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > CAMERA.stickDeadzone) {
        x = rx;
        y = ry;
      }
    }
    out.x = x;
    out.y = y;
    return out;
  }

  /** `yaw` is the camera's turn (View.yaw); 0 is the view from the south. */
  sample(yaw = 0): InputFrame {
    const held = (code: string) => this.down.has(code) || this.tapped.has(code);
    let dx = 0;
    let dy = 0;
    if (held("KeyA")) dx -= 1;
    if (held("KeyD")) dx += 1;
    // Screen "up" (dy -1) is away from the camera: world -z at yaw 0.
    if (held("KeyW")) dy -= 1;
    if (held("KeyS")) dy += 1;

    let attack = this.attackPressed;
    let dodge = this.dodgePressed;
    let jump = this.jumpPressed;
    let sprint = held("ShiftLeft") || held("ShiftRight");
    let ability = this.abilityPressed;
    let use = this.usePressed;
    let block = held("KeyL") || held("KeyQ") || this.mouseBlock;
    this.tapped.clear();
    this.attackPressed = false;
    this.dodgePressed = false;
    this.jumpPressed = false;
    this.abilityPressed = 0;
    this.usePressed = false;
    let cycle = this.cyclePressed;
    this.cyclePressed = false;

    const pad = firstGamepad();
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const stickMoving = Math.hypot(ax, ay) > PAD_STICK_DEADZONE;
      if (stickMoving) {
        dx = ax;
        dy = ay;
      }
      const padAttack = pad.buttons[PAD_ATTACK_BUTTON]?.pressed ?? false;
      const padDodge = pad.buttons[PAD_DODGE_BUTTON]?.pressed ?? false;
      const padJump = pad.buttons[PAD_JUMP_BUTTON]?.pressed ?? false;
      if (padAttack && !this.padAttackWasDown) attack = true;
      if (padDodge && !this.padDodgeWasDown) dodge = true;
      if (padJump && !this.padJumpWasDown) jump = true;
      this.padAttackWasDown = padAttack;
      this.padDodgeWasDown = padDodge;
      this.padJumpWasDown = padJump;
      if (pad.buttons[PAD_SPRINT_BUTTON]?.pressed) this.padSprint = true;
      else if (!stickMoving) this.padSprint = false;
      if (this.padSprint) sprint = true;
      PAD_SLOT_BUTTONS.forEach((b, i) => {
        const down = pad.buttons[b]?.pressed ?? false;
        if (down && !this.padSlotWasDown[i]) ability = i + 1;
        this.padSlotWasDown[i] = down;
      });
      const padUse = pad.buttons[PAD_USE_BUTTON]?.pressed ?? false;
      if (padUse && !this.padUseWasDown) use = true;
      this.padUseWasDown = padUse;
      if (pad.buttons[PAD_BLOCK_BUTTON]?.pressed) block = true;
      const padCycle = pad.buttons[PAD_CYCLE_BUTTON]?.pressed ?? false;
      if (padCycle && !this.padCycleWasDown) cycle = true;
      this.padCycleWasDown = padCycle;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (yaw !== 0) ({ dx, dy } = cameraRelativeMove(dx, dy, yaw));

    this.seq++;
    return { seq: this.seq, dx: round(dx), dy: round(dy), attack, dodge, ability, use, block, cycle, jump, sprint };
  }
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

function isAttackKey(code: string): boolean {
  return code === "KeyJ";
}

/** Shift is the sprint now (held, read in sample). */
function isDodgeKey(code: string): boolean {
  return code === "KeyK" || code === "KeyC";
}

function isJumpKey(code: string): boolean {
  return code === "Space";
}

/** Tab is the usual target-cycle key; R for keyboards where Tab is awkward. */
function isCycleKey(code: string): boolean {
  return code === "Tab" || code === "KeyR";
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
    code === "Tab" ||
    code === "KeyR" ||
    code.startsWith("Arrow") ||
    code === "Space" ||
    code === "KeyC" ||
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
