import type { Loadout } from '../sim/coop';
import type { Style } from '../config/tuning';
import type { PortalState } from '../game/portal';
import type { FloorSpec } from '../level/generate';
import type { HandDungeon } from '../level/handmade';
import type { PortalChoice } from '../game/portalChoice';
import type { BuildingId, VillageSave, VillageView } from '../game/villageSave';
import type { GearItem } from '../sim/catalogue';
import type { PlayerCommand, SimEvent, SimState } from '../sim/types';

/** Bumped when the messages change, so mismatched builds refuse each other politely. */
export const PROTOCOL_VERSION = 16;

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
export const CHEATS = ['restart', 'wave2', 'wave3', 'warden', 'spawnGrunts', 'spawnBrute', 'spawnArcher', 'killAll', 'henchman'] as const;
export type Cheat = (typeof CHEATS)[number];

/**
 * Player -> server. The slice's three (hello, input, loadout), plus what the slice's host did
 * itself and now asks the server for: a restart once the run is over, a tuning edit, a cheat.
 */
export type ToHost =
  /** Joining a village, the player's own village save comes too (P2); the room keeps the first one it gets. */
  | { k: 'hello'; version: number; loadout: Loadout; village?: VillageSave }
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
  | { k: 'destination'; dungeon: HandDungeon | null }
  /** Keeper Wren's menu (P7): a story dungeon or a random one; the village's room checks it against its shrine. */
  | { k: 'portal'; choice: PortalChoice }
  /**
   * The village's owner raises a building a tier (P4), saying how much coin their save holds: coin
   * is the player's, in their browser until Phase 3, so the room takes their word for it.
   */
  | { k: 'upgrade'; building: BuildingId; coin: number }
  /** Buy one of today's shelf (P5), by its uid, saying how much coin the player holds. */
  | { k: 'buy'; uid: string; coin: number }
  /** Sell an item from the bag to Aldous (P5); the browser takes it out of the bag when the room answers. */
  | { k: 'sell'; item: GearItem }
  /** Hire one of the Tavern's henchmen by kit (P10), saying the coin held; or let one go. */
  | { k: 'hire'; kit: Style; coin: number }
  | { k: 'dismiss'; kit: Style };

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
  | { k: 'handoff'; reservation: unknown; level: LevelKind }
  /**
   * The village this room is (P2), on joining and whenever it changes: whose it is, and whether it is
   * this player's own, whose browser then saves it.
   */
  | { k: 'village'; village: VillageView; host: string; yours: boolean }
  /** The owner's upgrade went through (P4): their browser takes the coin it cost from their save. */
  | { k: 'upgraded'; building: BuildingId; tier: number; coin: number }
  /** A purchase went through (P5): the item for the bag, and the coin it cost. */
  | { k: 'bought'; item: GearItem; coin: number }
  /** A sale went through (P5): which item left the bag, and the coin it brought. */
  | { k: 'sold'; uid: string; coin: number }
  /** A hire went through (P10): the browser pays its coin. */
  | { k: 'hired'; kit: Style; coin: number };

/** The kinds of room: the host's village, the slice's arena (the tests and the lab), and a generated dungeon floor (T4). */
export type LevelKind = 'village' | 'arena' | 'floor';

/** Player id for a party slot (slot 0 is p1, as the slice's host was). */
export function slotPlayerId(slot: number): string {
  return `p${slot + 1}`;
}
