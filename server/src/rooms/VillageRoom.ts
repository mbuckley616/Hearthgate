import { VILLAGE, type Level, type SimEvent } from "@hearthgate/shared";
import { SimRoom, type JoinOptions } from "./SimRoom.js";

/**
 * The village (design doc, Rooms: a village room holds the hub, a dungeon room each run).
 * The greybox: the town is a Level like a floor, so walking and walls are the same code; it
 * has no enemies, four villagers who answer E, and the portal. When every standing player has
 * held the portal, a fresh dungeon room is made on the portal's level and the party handed to
 * it; this room disposes once they have gone, and the stairs bring them to an open village or
 * a new one. The host-owned village with its state lives in Phase 2.
 */
export class VillageRoom extends SimRoom {
  protected get label() {
    return "village";
  }

  protected levelFor(_options: JoinOptions): Level {
    return VILLAGE;
  }

  protected onEvents(events: SimEvent[]) {
    for (const e of events) {
      if (e.kind === "portalTaken") void this.handOffParty("dungeon", e.to, { level: e.to });
    }
  }
}
