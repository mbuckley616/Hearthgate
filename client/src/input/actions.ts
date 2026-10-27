/**
 * The action layer: everything the game reads from input. Devices (keyboard
 * and mouse, gamepad, later touch) map onto these and nothing else.
 */
export const BUTTON_ACTIONS = [
  'dodge',
  'jump',
  'sprint',
  'attack',
  'block',
  'ability1',
  'ability2',
  'style1',
  'style2',
  'style3',
  'styleNext',
  'stylePrev',
  'lockOn',
  'interact',
  'debugPanel',
  'slowMo',
  'hitboxes',
  'inventory',
  'map',
  'menuBack',
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
