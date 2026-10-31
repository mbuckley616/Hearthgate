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
  // J and L (and the arrows below) are Hearthgate's keyboard-only keys (decision 10A, CLAUDE.md rule 4).
  attack: ['Mouse0', 'KeyJ'],
  // Not in the brief's table; added with the guard after M4.
  block: ['Mouse2', 'KeyL'],
  // One weapon set per outing (C3; Michael, 28 Oct): 1 and 2 are the abilities, beside Q and E; 3 waits for the off-hand's.
  ability1: ['KeyQ', 'Digit1'],
  ability2: ['KeyE', 'Digit2'],
  // The off-hand's ability (C4): 3, or R beside Q and E.
  ability3: ['KeyR', 'Digit3'],
  // A health potion (D4): G, or 4 after the three abilities.
  drink: ['KeyG', 'Digit4'],
  tab1: ['Digit1'],
  tab2: ['Digit2'],
  tab3: ['Digit3'],
  // T for target: Tab is the hero screen's (Michael, 28 Oct).
  lockOn: ['KeyT', 'Mouse1'],
  interact: ['KeyF'],
  debugPanel: ['Backquote'],
  slowMo: ['Backslash'],
  hitboxes: ['KeyH'],
  inventory: ['Tab'],
  // The minimap: the corner or the whole floor (T4).
  map: ['KeyM'],
  zoomIn: ['WheelUp', 'Equal'],
  zoomOut: ['WheelDown', 'Minus'],
  menuBack: ['Escape'],
  pause: [],
};

export const keyboardMove = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
};

/** Keyboard-only camera: the arrows turn and tilt it at the right stick's rates (decision 10A). */
export const keyboardLook = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
};

/** Standard-mapping gamepad button indices. */
// Michael's layout (31 Oct, A): RT attacks, X the off-hand's ability, Start pauses, d-pad right the map.
export const gamepadBindings: Partial<Record<ButtonAction, number[]>> = {
  attack: [7], // RT / R2
  block: [6], // LT / L2
  dodge: [1], // B / Circle
  // B also steps back out of a menu (Michael, 30 Oct); Game keeps that press from dodging.
  menuBack: [1],
  sprint: [10], // left stick click
  jump: [3], // Y / Triangle
  interact: [0], // A / Cross
  inventory: [8], // View / Select
  pause: [9], // Menu / Start
  map: [15], // d-pad right, off the hero screen
  ability1: [4], // LB
  ability2: [5], // RB
  ability3: [2], // X / Square, the off-hand's
  drink: [14], // d-pad left, off the hero screen (D4)
  lockOn: [11], // right stick click
  tab1: [14], // d-pad left, on the hero screen
  tab2: [12], // d-pad up
  tab3: [15], // d-pad right
  // Off the hero screen, d-pad up and down move the camera in and out.
  zoomIn: [12],
  zoomOut: [13],
};

export const gamepadAxes = { moveX: 0, moveY: 1, lookX: 2, lookY: 3 };
