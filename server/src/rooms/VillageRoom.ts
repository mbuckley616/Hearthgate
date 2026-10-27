import { planRun } from "@hearthgate/shared/game/runPlan";
import type { LevelDef } from "@hearthgate/shared/level/arena";
import { village } from "@hearthgate/shared/level/village";
import { HostRoom } from "./HostRoom.js";

/** Open villages by code, so a dungeon run can bring its party home to the one it left (T3). */
const villages = new Map<string, VillageRoom>();
/** How long an empty village waits for its party after their run closes (their seats are on the way). */
const RETURN_WAIT_MS = 30_000;

/**
 * The host's village (T3): where Play and an invite code put you, with the four starting buildings,
 * their villagers and the portal. When the party takes the portal, a generated run's first floor
 * is made (T4) and everyone is handed to it. The village stays open while its party is away, so a
 * ring home brings them back to this same village (and its code), and closes once it is empty and
 * no floor of a run it sent out is still open.
 */
export class VillageRoom extends HostRoom {
  /** Floor rooms of this village's runs that are still open. */
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

  /** The ring leads into a generated dungeon (T4): a run planned for this party, its first floor a room of its own. */
  protected onPortal() {
    const plan = planRun(this.host.sim.players, Math.floor(Math.random() * 0xffffffff));
    void this.handOff("floor", "floor", null, { ...plan, home: this.roomId, floor: 1 });
  }

  /** A floor of a run this village sent out has opened (FloorRoom): stay open until the party is home. */
  runOpened() {
    this.away++;
    this.autoDispose = false;
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
