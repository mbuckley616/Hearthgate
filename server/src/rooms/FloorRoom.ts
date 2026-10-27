import type { PortalTo } from "@hearthgate/shared/game/portal";
import { floorSpecFor, readRunPlan, type RunPlan } from "@hearthgate/shared/game/runPlan";
import type { LevelDef } from "@hearthgate/shared/level/arena";
import { floorLevel } from "@hearthgate/shared/level/floor";
import { HostRoom } from "./HostRoom.js";
import { VillageRoom } from "./VillageRoom.js";

/**
 * One floor of a generated dungeon run (T4): made when a village's party takes its ring, or when a
 * rest room's deeper ring takes them on. It carries the run's plan (seed, tier, floors, the party's
 * level) to the next floor; the rest room's other ring, and the ring that opens where a run ends,
 * take the party home to the village they came from. The room closes once the party has left.
 */
export class FloorRoom extends HostRoom {
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
    // The village keeps itself open while any floor of its party's run is.
    VillageRoom.byCode(this.home)?.runOpened();
  }

  onDispose() {
    VillageRoom.byCode(this.home)?.runClosed();
    super.onDispose();
  }

  protected onPortal(to: PortalTo) {
    if (to === "deeper" && this.floor < this.plan.floors) {
      void this.handOff("floor", "floor", null, { ...this.plan, home: this.home, floor: this.floor + 1 });
      return;
    }
    const home = VillageRoom.byCode(this.home);
    void this.handOff("village", "village", home ? home.roomId : null, {});
  }
}
