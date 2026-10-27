import { Room, matchMaker, type Client } from "@colyseus/core";
import { tuningEdits } from "@hearthgate/shared/config/edits";
import { tuning } from "@hearthgate/shared/config/tuning";
import { HostSession } from "@hearthgate/shared/game/HostSession";
import { buildWorld, type LevelDef } from "@hearthgate/shared/level/arena";
import type { LevelKind, ToPeer } from "@hearthgate/shared/net/protocol";
import { readToHost } from "@hearthgate/shared/net/validate";
import { createCommandBucket, takeCommands, type CommandBucket } from "./bucket.js";

/** Every message in both directions travels under this one Colyseus type, as the relay's one `msg`. */
export const MSG = "m";
/** Close code sent to a client dropped for flooding inputs (4000-4999 is the app range). */
export const CLOSE_INPUT_FLOOD = 4001;
/**
 * Ticks the loop may run back to back to catch up with wall time, half a second of them. Past this
 * the process stalled (a long GC pause, a sleeping laptop) and the lost time is dropped, not
 * replayed.
 */
const MAX_CATCHUP_TICKS = 30;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Bumped on every tuning edit this process applies; each room resends the set when it moves. */
let tuningVersion = 0;
/** Room codes in use, so two rooms never share one. */
const codes = new Set<string>();

/** Cheats (the debug panel's skip-wave, spawn and kill buttons) work only in a dev build: npm run dev, or HEARTHGATE_DEV=1. */
export const CHEATS = process.env.HEARTHGATE_DEV === "1" || process.argv.includes("--dev");

/**
 * A room that runs the combat slice's HostSession on Hearthgate's server (docs/slice-transplant-plan.md):
 * the village and every dungeon run. Every player joins as the slice's joiners did; solo is a room of
 * one. The room id is a four-letter code (the slice's invite codes), so a link or a typed code joins
 * it by id, whichever kind it is.
 *
 * The tick is Hearthgate's: locked to wall time rather than run from setInterval (whose 16.7 ms fires
 * every 17-and-a-bit, running the fight slow), catching up through stalls of up to half a second.
 * Debug slow motion slows the clock that drives it, and every snapshot carries the scale so each
 * player's prediction slows with it.
 *
 * When the party takes the open portal (T3), handOff() reserves each player a seat in the next room
 * and sends them a `handoff` message with it; their browsers leave and take the seat.
 */
export abstract class HostRoom extends Room {
  maxClients = tuning.coop.maxPlayers;

  protected host!: HostSession;
  private buckets = new Map<string, CommandBucket>();
  /** Fight time owed by wall time and not yet stepped (s). */
  private owed = 0;
  private lastPump = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sentTuning = 0;
  private handingOff = false;

  protected abstract get kind(): LevelKind;
  protected abstract levelFor(options: Record<string, unknown>): LevelDef;
  /** The party took the open portal: move them on (handOff). */
  protected abstract onPortal(): void;

  onCreate(options: Record<string, unknown> = {}) {
    this.roomId = newCode();
    const world = buildWorld(this.levelFor(options));
    this.host = new HostSession(
      world,
      (msg, peer) => {
        if (peer === undefined) this.broadcast(MSG, msg);
        else this.clients.getById(peer)?.send(MSG, msg);
      },
      CHEATS,
      () => this.onPortal(),
    );
    // The snapshot is sent by the session at the end of its tick; Colyseus has no state to patch.
    this.patchRate = 0;

    this.onMessage(MSG, (client, raw: unknown) => {
      const msg = readToHost(raw);
      if (!msg) return;
      if (msg.k === "input") {
        // Counted in commands, not messages: the slice sends one message a frame with every tick in it.
        const bucket = this.buckets.get(client.sessionId);
        if (!bucket) return;
        if (!takeCommands(bucket, msg.cmds.length, performance.now())) {
          this.buckets.delete(client.sessionId);
          this.log(`dropping ${client.sessionId}: input flood`);
          client.leave(CLOSE_INPUT_FLOOD);
          return;
        }
      }
      this.host.onMessage(client.sessionId, msg);
      if (msg.k === "tune") tuningVersion++;
    });

    this.lastPump = performance.now();
    this.pump();
    this.log(`created${CHEATS && this.kind !== "village" ? " (dev: cheats on)" : ""}`);
  }

  onJoin(client: Client) {
    // The player enters the fight on their hello, which carries their loadout (the slice's join).
    this.buckets.set(client.sessionId, createCommandBucket(performance.now()));
    this.log(`${client.sessionId} connected (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    this.host.onPeerLeft(client.sessionId);
    this.buckets.delete(client.sessionId);
    this.log(`${client.sessionId} left`);
  }

  onDispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    codes.delete(this.roomId);
    this.log("disposed");
  }

  protected log(text: string) {
    console.log(`[${this.kind} ${this.roomId}] ${text}`);
  }

  /**
   * Move everyone here into another room: the room `roomId` names, or else a fresh one of
   * `roomName` made with `createOptions`. Each client gets a seat reserved there and a `handoff`
   * message with it. If the matchmaker refuses, the portal reopens so the party can try again.
   */
  protected async handOff(roomName: string, level: LevelKind, roomId: string | null, createOptions: Record<string, unknown>): Promise<string | null> {
    if (this.handingOff) return null;
    this.handingOff = true;
    const clients = [...this.clients];
    try {
      const target = roomId ?? (await matchMaker.createRoom(roomName, createOptions)).roomId;
      for (const c of clients) {
        const reservation = await matchMaker.joinById(target, {});
        const msg: ToPeer = { k: "handoff", reservation, level };
        c.send(MSG, msg);
      }
      this.log(`handed ${clients.length} to ${roomName} ${target}`);
      return target;
    } catch (err) {
      console.error(`[${this.kind} ${this.roomId}] hand-off to ${roomName} failed`, err);
      this.host.reopenPortal();
      return null;
    } finally {
      this.handingOff = false;
    }
  }

  /** Run every tick that wall time (scaled by slow motion) owes, then sleep until the next is due. */
  private pump() {
    this.timer = null;
    const now = performance.now();
    const step = 1 / tuning.sim.tickRate;
    const scale = this.host.timeScale();
    this.owed += ((now - this.lastPump) / 1000) * scale;
    this.lastPump = now;
    if (this.owed > MAX_CATCHUP_TICKS * step) this.owed = step;
    try {
      while (this.owed >= step) {
        this.owed -= step;
        this.host.tick();
      }
      if (this.sentTuning !== tuningVersion) {
        this.sentTuning = tuningVersion;
        const msg: ToPeer = { k: "tuning", edits: tuningEdits() };
        this.broadcast(MSG, msg);
      }
    } catch (err) {
      console.error(`[${this.kind} ${this.roomId}] step failed`, err);
    }
    const waitMs = ((step - this.owed) / Math.max(0.01, scale)) * 1000;
    this.timer = setTimeout(() => this.pump(), Math.max(1, waitMs));
  }
}

function newCode(): string {
  for (;;) {
    const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    if (!codes.has(code)) {
      codes.add(code);
      return code;
    }
  }
}
