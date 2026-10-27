import type { ButtonAction } from './actions';

/**
 * Device bindings. Keys are KeyboardEvent.code values; mouse buttons and wheel
 * use the pseudo-codes below. Matches the control table in docs/brief.md.
 */
export const keyboardBindings: Record<ButtonAction, string[]> = {
  // Michael's call after M4: dodge on Ctrl, jump on Space (the brief had Space as dodge).
  dodge: ['ControlLeft'],
  jump: ['Space'],
  sprint: ['ShiftLeft'],
  attack: ['Mouse0'],
  // Not in the brief's table; added with the guard after M4.
  block: ['Mouse2'],
  ability1: ['KeyQ'],
  ability2: ['KeyE'],
  style1: ['Digit1'],
  style2: ['Digit2'],
  style3: ['Digit3'],
  styleNext: ['WheelDown'],
  stylePrev: ['WheelUp'],
  lockOn: ['Tab', 'Mouse1'],
  interact: ['KeyF'],
  debugPanel: ['Backquote'],
  slowMo: ['Backslash'],
  hitboxes: ['KeyH'],
  inventory: ['KeyI'],
  menuBack: ['Escape'],
};

export const keyboardMove = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** Standard-mapping gamepad button indices. */
export const gamepadBindings: Partial<Record<ButtonAction, number[]>> = {
  attack: [2], // X / Square
  block: [6], // LT / L2
  dodge: [1], // B / Circle
  sprint: [10], // left stick click
  jump: [3], // Y / Triangle
  interact: [0], // A / Cross
  inventory: [8], // View / Select
  ability1: [4], // LB
  ability2: [5], // RB
  lockOn: [11], // right stick click
  style1: [14], // d-pad left
  style2: [12], // d-pad up
  style3: [15], // d-pad right
  styleNext: [13], // d-pad down cycles
};

export const gamepadAxes = { moveX: 0, moveY: 1, lookX: 2, lookY: 3 };
