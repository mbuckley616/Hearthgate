import { arena, type LevelDef } from "@hearthgate/shared/level/arena";
import { HostRoom } from "./HostRoom.js";
import { VillageRoom } from "./VillageRoom.js";

/**
 * One dungeon run (T3): the combat slice's antechamber, waves and Warden, made when a village's
 * party takes its portal. When the run is won or lost a portal opens in the antechamber; taking it
 * hands the party back to the village they came from (or a new one, if that village has closed).
 * The room closes once the party has left.
 */
export class DungeonRoom extends HostRoom {
  /** The village this run's party came from. */
  private home = "";

  protected get kind() {
    return "arena" as const;
  }

  protected levelFor(options: Record<string, unknown>): LevelDef {
    this.home = typeof options.home === "string" ? options.home : "";
    return arena;
  }

  onDispose() {
    VillageRoom.byCode(this.home)?.runClosed();
    super.onDispose();
  }

  protected onPortal() {
    const home = VillageRoom.byCode(this.home);
    void this.handOff("village", "village", home ? home.roomId : null, {});
  }
}
