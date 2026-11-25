/**
 * The action layer: everything the game reads from input. Devices (keyboard
 * and mouse, gamepad, later touch) map onto these and nothing else.
 */
export const BUTTON_ACTIONS = [
  'dodge',
  'jump',
  'sprint',
  // The keyboard's sprint, a toggle (Michael, 16 Nov, A): Ctrl, with a double W beside it.
  'sprintToggle',
  'attack',
  'block',
  'ability1',
  'ability2',
  // The off-hand's ability (C4).
  'ability3',
  // Drink a health potion (D4).
  'drink',
  // The hero screen's three tabs (C3: 1, 2 and 3 are abilities in a fight; the screen keeps them for its tabs).
  'tab1',
  'tab2',
  'tab3',
  // The hero screen on a pad (Michael, 2 Nov): LB and RB step through the tabs, the d-pad moves the
  // cursor, X drops or takes a rank off and Y (twice) resets a board. Pad-only, so Q, E and the keys stay as they were.
  'tabPrev',
  'tabNext',
  'menuUp',
  'menuDown',
  'menuLeft',
  'menuRight',
  'menuTake',
  'menuReset',
  'lockOn',
  'interact',
  'debugPanel',
  'slowMo',
  'hitboxes',
  'inventory',
  // B opens the hero screen on its Bag tab (Michael, 15 Nov, A).
  'bag',
  // X takes the next kind of weapon in the bag into the hand (Michael, 15 Nov, A; the test switch's key).
  'nextWeapon',
  // Space (Michael, 15 Nov, A): interact while a prompt is showing, otherwise jump. Game decides which.
  'jumpOrUse',
  'map',
  // The camera's distance: the wheel, - and =, the d-pad off the hero screen.
  'zoomIn',
  'zoomOut',
  'menuBack',
  // The pause card on a pad's Start (Michael, 31 Oct, A); the keyboard's is Esc, letting go of the mouse.
  'pause',
] as const;

export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

export interface ActionFrame {
  /** Movement intent in camera space: x right, y forward. Magnitude 0..1. */
  move: { x: number; y: number };
  /** Camera look this frame, in radians: x = yaw (right positive), y = pitch (up positive). */
  look: { x: number; y: number };
  /** Buttons held this frame. */
  held: Set<ButtonAction>;
  /** Buttons that went down this frame. */
  pressed: Set<ButtonAction>;
  /**
   * Up (+1) or down (-1) keys (W, S, the up and down arrows) that went down this frame, even if they
   * came up again before it: `move` and `look` are the keys held at the frame, so a tap between two
   * frames is not in them, and a menu reading only those lost it (the critic, 25 Nov). Absent is none.
   */
  tapY?: number;
}

/** A device that contributes to the action frame. Touch will be another one. */
export interface InputSource {
  /** Add this device's contribution for the frame. dt is real seconds. */
  contribute(frame: ActionFrame, dt: number): void;
  /** Called once per frame after contribute, to clear per-frame deltas. */
  endFrame(): void;
}

export function emptyFrame(): ActionFrame {
  return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set(), pressed: new Set() };
}
