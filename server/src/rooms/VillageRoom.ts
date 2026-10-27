import type { LevelDef } from "@hearthgate/shared/level/arena";
import { village } from "@hearthgate/shared/level/village";
import { HostRoom } from "./HostRoom.js";

/** Open villages by code, so a dungeon run can bring its party home to the one it left (T3). */
const villages = new Map<string, VillageRoom>();
/** How long an empty village waits for its party after their run closes (their seats are on the way). */
const RETURN_WAIT_MS = 30_000;

/**
 * The host's village (T3): where Play and an invite code put you, with the four starting buildings,
 * their villagers and the portal. When the party takes the portal, a fresh dungeon room is made
 * and everyone is handed to it. The village stays open while its party is away, so the arena's
 * portal brings them back to this same village (and its code), and closes once it is empty and no
 * run it sent out is still going.
 */
export class VillageRoom extends HostRoom {
  /** Dungeon rooms this village has sent a party into that are still open. */
  private away = 0;

  protected get kind() {
    return "village" as const;
  }

  protected levelFor(): LevelDef {
    return village;
  }

  onCreate(options: Record<string, unknown> = {}) {
    super.onCreate(options);
    villages.set(this.roomId, this);
  }

  onDispose() {
    villages.delete(this.roomId);
    super.onDispose();
  }

  protected onPortal() {
    void this.handOff("dungeon", "arena", null, { home: this.roomId }).then((dungeon) => {
      if (!dungeon) return;
      this.away++;
      this.autoDispose = false;
    });
  }

  /**
   * A dungeon this village sent a party into has closed. That happens as the party leaves it, before
   * they have taken their seats here, so an empty village waits a while for them before it closes.
   */
  runClosed() {
    this.away = Math.max(0, this.away - 1);
    if (this.away > 0) return;
    this.autoDispose = true;
    this.clock.setTimeout(() => {
      if (this.away === 0 && this.clients.length === 0) void this.disconnect();
    }, RETURN_WAIT_MS);
  }

  /** The open village with this code, if it is still there. */
  static byCode(code: unknown): VillageRoom | undefined {
    return typeof code === "string" ? villages.get(code) : undefined;
  }
}
