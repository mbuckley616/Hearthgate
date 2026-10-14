import { DEFAULT_LEVEL_ID, VILLAGE_LEVEL_ID, levelById, type Level, type SimEvent } from "@hearthgate/shared";
import { SimRoom, type JoinOptions } from "./SimRoom.js";

export { CLOSE_INPUT_FLOOD } from "./SimRoom.js";

/**
 * One dungeon floor: the room the village's portal makes for a run (the Warrens), or one a
 * client asks for by level id (`?level=yard`, the tests and the lab). It lives for the run:
 * when every standing player has held the open stairs the party is handed to a village room
 * (an open one, or a new one) and this room disposes once they have gone.
 */
export class DungeonRoom extends SimRoom {
  protected get label() {
    return "dungeon";
  }

  protected levelFor(options: JoinOptions): Level {
    return levelById(typeof options.level === "string" ? options.level : DEFAULT_LEVEL_ID);
  }

  protected onEvents(events: SimEvent[]) {
    if (events.some((e) => e.kind === "stairsTaken")) void this.handOffParty("village", VILLAGE_LEVEL_ID, null);
  }
}
