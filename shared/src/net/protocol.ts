import type { Loadout } from '../sim/coop';
import type { PlayerCommand, SimEvent, SimState } from '../sim/types';

/** Bumped when the messages change, so mismatched builds refuse each other politely. */
export const PROTOCOL_VERSION = 2;

/** A joiner's input for one of its ticks, numbered so the host can say which it has applied. */
export interface SeqCommand {
  seq: number;
  cmd: PlayerCommand;
}

/** A debug-panel edit: a tuning path ('movement.runSpeed') and its new value. */
export interface TuneEdit {
  path: string;
  value: number | boolean;
}

/** The debug panel's buttons that change the fight; the server takes them only in a dev build (HEARTHGATE_DEV=1). */
export const CHEATS = ['restart', 'wave2', 'wave3', 'warden', 'spawnGrunts', 'spawnBrute', 'spawnArcher', 'killAll'] as const;
export type Cheat = (typeof CHEATS)[number];

/**
 * Player -> server. The slice's three (hello, input, loadout), plus what the slice's host did
 * from its own debug panel and now asks the server for: a tuning edit, a cheat.
 */
export type ToHost =
  | { k: 'hello'; version: number; loadout: Loadout }
  | { k: 'input'; cmds: SeqCommand[] }
  | { k: 'loadout'; loadout: Loadout }
  | { k: 'tune'; edit: TuneEdit }
  | { k: 'cheat'; cheat: Cheat };

/** Server -> players. */
export type ToPeer =
  | { k: 'welcome'; id: string }
  | { k: 'refused'; reason: string }
  /**
   * The whole sim (it's plain data by design), the last input tick applied
   * for each joiner, every event since the previous snapshot, and how fast
   * the server is running the fight (1, or the debug slow motion's scale).
   */
  | { k: 'snap'; s: SimState; acks: Record<string, number>; ev: SimEvent[]; scale: number }
  /** Every tuning edit the server has applied since it started (path -> value). */
  | { k: 'tuning'; edits: Record<string, number | boolean> };

/** Player id for a party slot (slot 0 is p1, as the slice's host was). */
export function slotPlayerId(slot: number): string {
  return `p${slot + 1}`;
}
