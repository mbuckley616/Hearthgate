import { tuning } from '../config/tuning';

/**
 * Lumber and stone in the bag (Michael, 31 Oct, A): they stack to `loop.bagStack` a bag space,
 * picked up by whoever walks over them, and a full bag leaves them on the floor. The bag is the
 * browser's until Phase 3's ledger, so the browser says how much room it has (`Loadout.bagRoom`) and
 * the server spends that room as it hands out pieces, which keeps the "is there room" call its own.
 */
export interface BagRoom {
  /** Empty bag spaces past the safe pocket (finds and materials never land in the pocket). */
  spaces: number;
  /** Room left in the bag's part-filled lumber and stone stacks. */
  lumber: number;
  stone: number;
}

export interface Materials {
  lumber: number;
  stone: number;
}

const stacks = (n: number, stack: number) => Math.ceil(Math.max(0, n) / stack);

/** Bag spaces the materials fill, a stack a space. */
export function materialSpaces(m: Materials, stack = tuning.loop.bagStack): number {
  return stacks(m.lumber, stack) + stacks(m.stone, stack);
}

/** The room a bag with this many empty spaces (materials not yet counted) and these materials has. */
export function bagRoomOf(emptySpaces: number, m: Materials, stack = tuning.loop.bagStack): BagRoom {
  return {
    spaces: Math.max(0, emptySpaces - materialSpaces(m, stack)),
    lumber: stacks(m.lumber, stack) * stack - Math.max(0, m.lumber),
    stone: stacks(m.stone, stack) * stack - Math.max(0, m.stone),
  };
}

/** Put one unit in: a part-filled stack first, else a new stack in an empty space. False if the bag is full. */
export function roomFor(room: BagRoom, kind: 'lumber' | 'stone', stack = tuning.loop.bagStack): boolean {
  if (room[kind] > 0) {
    room[kind]--;
    return true;
  }
  if (room.spaces <= 0) return false;
  room.spaces--;
  room[kind] = stack - 1;
  return true;
}

/** A find went into the bag: one empty space fewer. */
export function spaceTaken(room: BagRoom | undefined): void {
  if (room) room.spaces = Math.max(0, room.spaces - 1);
}
