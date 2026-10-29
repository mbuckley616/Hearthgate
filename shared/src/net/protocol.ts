import type { Loadout } from '../sim/coop';
import type { PortalState } from '../game/portal';
import type { FloorSpec } from '../level/generate';
import type { HandDungeon } from '../level/handmade';
import type { GearItem } from '../sim/catalogue';
import type { PlayerCommand, SimEvent, SimState } from '../sim/types';

/** Bumped when the messages change, so mismatched builds refuse each other politely. */
export const PROTOCOL_VERSION = 10;

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
 * itself and now asks the server for: a restart once the run is over, a tuning edit, a cheat.
 */
export type ToHost =
  | { k: 'hello'; version: number; loadout: Loadout }
  | { k: 'input'; cmds: SeqCommand[] }
  | { k: 'loadout'; loadout: Loadout }
  | { k: 'restart' }
  /** Back to the village from a generated floor's end card (D10): only once the run is won or lost. */
  | { k: 'home' }
  /** An item from the bag put on the floor at the player's feet (D13); the browser has already taken it out. */
  | { k: 'drop'; item: GearItem }
  | { k: 'tune'; edit: TuneEdit }
  | { k: 'cheat'; cheat: Cheat }
  /** Keeper Wren (T4b): where the village's ring leads, a hand-built dungeon or (null) a generated run. */
  | { k: 'destination'; dungeon: HandDungeon | null };

/** Server -> players. */
export type ToPeer =
  /** A generated floor (T4) comes with its spec: the browser builds the same floor from it. */
  | { k: 'welcome'; id: string; floor?: FloorSpec }
  | { k: 'refused'; reason: string }
  /**
   * The whole sim (it's plain data by design), the last input tick applied
   * for each joiner, every event since the previous snapshot, and how fast
   * the server is running the fight (1, or the debug slow motion's scale).
   */
  | { k: 'snap'; s: SimState; acks: Record<string, number>; ev: SimEvent[]; scale: number; portals: PortalState[] }
  /** Every tuning edit the server has applied since it started (path -> value). */
  | { k: 'tuning'; edits: Record<string, number | boolean> }
  /**
   * The party took a portal (T3): a seat the server reserved for this player in the next room. The
   * browser leaves this room and takes the seat (colyseus.js consumeSeatReservation); `level` says
   * what that room runs, so it can be built before the first snapshot.
   */
  | { k: 'handoff'; reservation: unknown; level: LevelKind };

/** The kinds of room: the host's village, the slice's arena (the tests and the lab), and a generated dungeon floor (T4). */
export type LevelKind = 'village' | 'arena' | 'floor';

/** Player id for a party slot (slot 0 is p1, as the slice's host was). */
export function slotPlayerId(slot: number): string {
  return `p${slot + 1}`;
}
