import type { Client } from "@colyseus/core";
import type { PortalTo } from "@hearthgate/shared/game/portal";
import { floorSpecFor, readRunPlan, type RunPlan } from "@hearthgate/shared/game/runPlan";
import type { LevelDef } from "@hearthgate/shared/level/arena";
import type { SimEvent } from "@hearthgate/shared/sim/types";
import { floorLevel } from "@hearthgate/shared/level/floor";
import type { Purse } from "@hearthgate/shared/sim/floorRun";
import { HostRoom } from "./HostRoom.js";
import { VillageRoom } from "./VillageRoom.js";

/**
 * One floor of a generated dungeon run (T4): made when a village's party takes its ring, or when a
 * rest room's deeper ring takes them on. It carries the run's plan (seed, tier, floors, the party's
 * level) to the next floor; the rest room's other ring, and the ring that opens where a run ends,
 * take the party home to the village they came from. The room closes once the party has left.
 */
export class FloorRoom extends HostRoom {
  /**
   * The unbanked pay a run is taking to its next floor (Michael, 31 Oct), by its village and that
   * floor, kept here on the server between the deeper ring and the new room's creation; never in
   * create options, which a browser can send for itself.
   */
  private static purses = new Map<string, Purse>();

  /** The village this run's party came from. */
  private home = "";
  private plan!: RunPlan;
  private floor = 1;

  protected get kind() {
    return "floor" as const;
  }

  protected levelFor(options: Record<string, unknown>): LevelDef {
    this.home = typeof options.home === "string" ? options.home : "";
    this.plan = readRunPlan(options);
    this.floor = typeof options.floor === "number" ? Math.max(1, Math.min(this.plan.floors, Math.round(options.floor))) : 1;
    const spec = floorSpecFor(this.plan, this.floor);
    this.log(`floor ${spec.floor} of ${spec.floors}, seed ${spec.seed}, ${spec.pieces} pieces`);
    return floorLevel(spec);
  }

  onCreate(options: Record<string, unknown> = {}) {
    super.onCreate(options);
    const key = `${this.home}:${this.floor}`;
    const purse = FloorRoom.purses.get(key);
    if (purse && this.home) {
      FloorRoom.purses.delete(key);
      this.host.receivePurse(purse);
    }
    // The village keeps itself open while any floor of its party's run is.
    VillageRoom.byCode(this.home)?.runOpened();
  }

  onDispose() {
    VillageRoom.byCode(this.home)?.runClosed();
    super.onDispose();
  }

  protected onPortal(to: PortalTo) {
    if (to === "deeper" && this.floor < this.plan.floors) {
      const purse = this.host.runPurse();
      if (purse && this.home) FloorRoom.purses.set(`${this.home}:${this.floor + 1}`, purse);
      void this.handOff("floor", "floor", null, { ...this.plan, home: this.home, floor: this.floor + 1 });
      return;
    }
    const home = VillageRoom.byCode(this.home);
    void this.handOff("village", "village", home ? home.roomId : null, {});
  }

  /**
   * A bank pays the village the run came from (P2). Each player's banked event carries the same
   * lumber and stone, the party's, so one a tick is the village's share.
   */
  protected onEvents(events: readonly SimEvent[]) {
    const bank = events.find((e) => e.kind === "banked");
    if (bank?.kind === "banked") VillageRoom.byCode(this.home)?.credit(bank.lumber, bank.stone, bank.hench);
  }

  /** The end card's button (D10): this player alone goes back to the village the run left from. */
  protected onHome(client: Client) {
    const home = VillageRoom.byCode(this.home);
    void this.handOne(client, home ? home.roomId : null);
  }
}
