/**
 * The action layer (the combat slice's, step 1 of the port): everything the game reads from input
 * is one of these actions, and each device maps onto them through a table here and nothing else.
 * A touch layout will be one more table.
 *
 * The keys are the slice's with Hearthgate's keyboard-only additions (decision 10A): Ctrl dodges,
 * Space jumps, Shift sprints, the left button or J attacks, the right button or L guards, Q and E
 * are the ability slots, Tab or the middle button locks on, F interacts, WASD moves and the arrows
 * turn the camera. 1, 2 and 3 are the weapon swap, which arrives with step 3.
 */
export const BUTTON_ACTIONS = ["dodge", "jump", "sprint", "attack", "block", "ability1", "ability2", "lockOn", "interact", "debugPanel"] as const;

export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

/** Actions that fire once per press; the rest are read as held. */
export const PRESS_ACTIONS: readonly ButtonAction[] = ["dodge", "jump", "attack", "ability1", "ability2", "lockOn", "interact"];

/** KeyboardEvent.code values, and Mouse0..2 for the buttons (read only under pointer lock). */
export const keyboardBindings: Record<ButtonAction, string[]> = {
  dodge: ["ControlLeft", "ControlRight"],
  jump: ["Space"],
  sprint: ["ShiftLeft", "ShiftRight"],
  attack: ["Mouse0", "KeyJ"],
  block: ["Mouse2", "KeyL"],
  ability1: ["KeyQ"],
  ability2: ["KeyE"],
  lockOn: ["Tab", "Mouse1"],
  interact: ["KeyF"],
  debugPanel: ["Backquote"]
};

export const keyboardMove = {
  forward: ["KeyW"],
  back: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"]
};

/**
 * The camera on the keyboard. Up raises the eye to look down more, as RuneScape's arrows do
 * (Session 38); the mouse and the right stick tilt the usual way, up to look up.
 */
export const keyboardLook = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  raise: ["ArrowUp"],
  lower: ["ArrowDown"]
};

/** Standard-mapping gamepad buttons (the slice's). */
export const gamepadBindings: Partial<Record<ButtonAction, number[]>> = {
  attack: [2], // X / Square
  block: [6], // LT / L2
  dodge: [1], // B / Circle
  sprint: [10], // left stick click
  jump: [3], // Y / Triangle
  interact: [0], // A / Cross
  ability1: [4], // LB
  ability2: [5], // RB
  lockOn: [11] // right stick click
};

export const gamepadAxes = { moveX: 0, moveY: 1, lookX: 2, lookY: 3 };

/** Every code a binding names: the page's own use of these keys (scroll, focus) is stopped. */
export const GAME_CODES = new Set<string>([
  ...Object.values(keyboardBindings).flat(),
  ...Object.values(keyboardMove).flat(),
  ...Object.values(keyboardLook).flat()
]);
