import type { Client } from "@colyseus/core";
import { planChoice, planRun } from "@hearthgate/shared/game/runPlan";
import { choiceDifficulty, maxDifficulty } from "@hearthgate/shared/game/portalChoice";
import { applyUpgrade, bankHenchmen, henchmanCap, tavernHenchmen, upgradeProblem, villageView, type VillageSave } from "@hearthgate/shared/game/villageSave";
import type { HenchmanCard } from "@hearthgate/shared/sim/henchman";
import type { Style } from "@hearthgate/shared/config/tuning";
import { tuning } from "@hearthgate/shared/config/tuning";
import { buyPrice, dailyStock, sellPrice, storeDay } from "@hearthgate/shared/game/store";
import type { GearItem } from "@hearthgate/shared/sim/catalogue";
import { PROTOCOL_VERSION, type ToHost, type ToPeer } from "@hearthgate/shared/net/protocol";
import type { LevelDef } from "@hearthgate/shared/level/arena";
import { village } from "@hearthgate/shared/level/village";
import { HostRoom, MSG } from "./HostRoom.js";

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
  /**
   * The village itself (P2): the first save a hello brings, kept here from then on, so the party's
   * banks add to it while they are away. Null until someone with a save has joined.
   */
  private save: VillageSave | null = null;
  /** The owner's name as their hello last gave it. */
  private ownerName = "";
  /** Who here is the village's owner, by session. */
  private owners = new Set<string>();
  /** The General Store's shelves (P5): the day they were rolled for, at which tier, and what is left. */
  private stockDay = -1;
  private stockTier = 0;
  private stock: GearItem[] = [];
  /** Today's items bought already, by uid, so raising the store's tier does not put them back. */
  private boughtToday = new Set<string>();

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

  protected onPeerMessage(client: Client, msg: ToHost) {
    if (msg.k === "hello") this.onHello(client, msg);
    if (msg.k === "upgrade") this.onUpgrade(client, msg);
    if (msg.k === "buy") this.onBuy(client, msg);
    if (msg.k === "portal") this.onPortalChoice(msg);
    if (msg.k === "hire") this.onHire(client, msg);
    if (msg.k === "dismiss") this.host.dismissHenchman(msg.kit);
    if (msg.k === "sell") this.onSell(client, msg);
  }

  /**
   * Anyone may ask Keeper Wren (as with the ring's destination); a difficulty past what the shrine's
   * tier opens is refused (P7; Michael, 28 Oct). Whether a story dungeon is open is the browser's
   * to say: progress lives in its save until Phase 3.
   */
  private onPortalChoice(msg: Extract<ToHost, { k: "portal" }>) {
    if (choiceDifficulty(msg.choice) > maxDifficulty(this.save?.tiers.shrine ?? 1)) return;
    this.host.choice = msg.choice;
    this.host.destination = null;
  }

  /**
   * Old Fenn hires a henchman out (P10): as many at once as the Tavern's tier allows, one of each
   * kit, within the party's four, for the coin the player says they hold. A top-tier Tavern's are quick.
   */
  private onHire(client: Client, msg: Extract<ToHost, { k: "hire" }>) {
    const tier = this.save?.tiers.tavern ?? 1;
    const hench = this.host.sim.players.filter((p) => p.henchman);
    if (hench.length >= tavernHenchmen(tier) || hench.some((p) => p.style === msg.kit)) return;
    if (msg.coin < tuning.village.hireCoin) return;
    const h = this.host.addHenchman(this.host.playerOf(client.sessionId), msg.kit, { quick: tier >= 4, xp: 0 });
    if (!h) return;
    this.settleHenchmen();
    const done: ToPeer = { k: "hired", kit: msg.kit, coin: tuning.village.hireCoin };
    client.send(MSG, done);
  }

  /** Today's shelves at the store's tier, rolled afresh when the day or the tier changes. */
  private shelves(): GearItem[] {
    const day = storeDay(Date.now());
    const tier = this.save?.tiers.store ?? 1;
    if (day !== this.stockDay) this.boughtToday.clear();
    if (day !== this.stockDay || tier !== this.stockTier) {
      this.stockDay = day;
      this.stockTier = tier;
      this.stock = dailyStock(day, tier).filter((i) => !this.boughtToday.has(i.uid));
    }
    return this.stock;
  }

  /** Anyone in the village may buy (the design doc: visitors use everything); the room says the price. */
  private onBuy(client: Client, msg: Extract<ToHost, { k: "buy" }>) {
    const shelves = this.shelves();
    const item = shelves.find((i) => i.uid === msg.uid);
    if (!item || msg.coin < buyPrice(item)) return;
    this.stock = shelves.filter((i) => i !== item);
    this.boughtToday.add(item.uid);
    const done: ToPeer = { k: "bought", item, coin: buyPrice(item) };
    client.send(MSG, done);
    for (const c of this.clients) this.sendVillage(c);
  }

  /** Aldous buys anything from a bag at his price; the browser takes it out of the bag on the answer. */
  private onSell(client: Client, msg: Extract<ToHost, { k: "sell" }>) {
    const done: ToPeer = { k: "sold", uid: msg.item.uid, coin: sellPrice(msg.item) };
    client.send(MSG, done);
  }

  /**
   * The owner raises a building (P4): only they may spend the village, and only what it holds and
   * what their coin covers. Everyone sees the new tier; the owner's browser pays the coin.
   */
  private onUpgrade(client: Client, msg: Extract<ToHost, { k: "upgrade" }>) {
    if (!this.save || !this.owners.has(client.sessionId)) return;
    if (upgradeProblem(villageView(this.save), msg.building, msg.coin)) return;
    const cost = applyUpgrade(this.save, msg.building);
    // A higher Tavern lifts its hires' cap at once (P12), and its top tier quickens them.
    if (msg.building === "tavern") this.settleHenchmen();
    this.log(`${msg.building} raised to tier ${this.save.tiers[msg.building]}`);
    const done: ToPeer = { k: "upgraded", building: msg.building, tier: this.save.tiers[msg.building], coin: cost.coin };
    client.send(MSG, done);
    for (const c of this.clients) this.sendVillage(c);
  }

  private onHello(client: Client, msg: Extract<ToHost, { k: "hello" }>) {
    if (msg.version !== PROTOCOL_VERSION) return;
    if (!this.save && msg.village) {
      this.save = msg.village;
      this.log(`the village of ${msg.loadout.name || "a player"}: ${this.save.lumber} lumber, ${this.save.stone} stone`);
    }
    if (this.save && msg.village?.id === this.save.id) {
      this.owners.add(client.sessionId);
      this.ownerName = msg.loadout.name;
    }
    this.sendVillage(client);
  }

  onLeave(client: Client) {
    this.owners.delete(client.sessionId);
    super.onLeave(client);
  }

  /**
   * A floor of this village's run banked (P1, P2): its lumber and stone are the village's, and the XP
   * its henchmen have earned is theirs to keep (P12).
   */
  credit(lumber: number, stone: number, hench: readonly { style: Style; xp: number }[] = []) {
    if (!this.save) return;
    const kept = bankHenchmen(this.save, hench);
    if (lumber <= 0 && stone <= 0 && !kept) return;
    this.save.lumber += lumber;
    this.save.stone += stone;
    for (const c of this.clients) this.sendVillage(c);
  }

  /** Henchmen home from a run come back at what they banked: a wipe loses what they earned since (P12). */
  welcomeHenchmen(cards: readonly HenchmanCard[]): void {
    super.welcomeHenchmen(cards);
    this.settleHenchmen();
  }

  /** The Tavern's rules on the hires here (P12): its cap, their banked XP, its top tier's quickness. */
  private settleHenchmen() {
    if (!this.save) return;
    const tier = this.save.tiers.tavern;
    this.host.settleHenchmen(henchmanCap(tier), this.save.hench ?? {}, tier >= 4);
  }

  private sendVillage(client: Client) {
    if (!this.save) return;
    const msg: ToPeer = { k: "village", village: { ...villageView(this.save), stock: this.shelves() }, host: this.ownerName, yours: this.owners.has(client.sessionId) };
    client.send(MSG, msg);
  }

  /** The ring leads into a generated dungeon (T4): a run planned for this party, its first floor a room of its own. */
  protected onPortal() {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const plan = this.host.choice ? planChoice(this.host.sim.players, seed, this.host.choice) : planRun(this.host.sim.players, seed, this.host.destination);
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
