import { Room, type Client } from "@colyseus/core";
import { tuningEdits } from "@hearthgate/shared/config/edits";
import { tuning } from "@hearthgate/shared/config/tuning";
import { HostSession } from "@hearthgate/shared/game/HostSession";
import { arena, buildWorld } from "@hearthgate/shared/level/arena";
import type { ToPeer } from "@hearthgate/shared/net/protocol";
import { readToHost } from "@hearthgate/shared/net/validate";
import { createCommandBucket, takeCommands, type CommandBucket } from "./bucket.js";

/** Every message in both directions travels under this one Colyseus type, as the relay's one `msg`. */
export const MSG = "m";
/** Close code sent to a client dropped for flooding inputs (4000-4999 is the app range). */
export const CLOSE_INPUT_FLOOD = 4001;
/**
 * Ticks the loop may run back to back to catch up with wall time, half a second of them. Past this
 * the process stalled (a long GC pause, a sleeping laptop) and the lost time is dropped, not
 * replayed: a joiner's inputs are folded by the slice's queue rather than replayed at speed.
 */
const MAX_CATCHUP_TICKS = 30;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Bumped on every tuning edit this process applies; each room resends the set when it moves. */
let tuningVersion = 0;
/** Room codes in use, so two rooms never share one. */
const codes = new Set<string>();

/** Cheats (the debug panel's skip-wave, spawn and kill buttons) work only in a dev build: npm run dev, or HEARTHGATE_DEV=1. */
const CHEATS = process.env.HEARTHGATE_DEV === "1" || process.argv.includes("--dev");

/**
 * One fight: the combat slice's HostSession on Hearthgate's server (docs/slice-transplant-plan.md,
 * T1). Every player joins as the slice's joiners did; solo is a room of one. The room id is a
 * four-letter code (the slice's invite codes), so a link or a typed code joins it by id.
 *
 * The tick is Hearthgate's: locked to wall time rather than run from setInterval (whose 16.7 ms
 * fires every 17-and-a-bit, running the fight slow), catching up through stalls of up to half a
 * second. Debug slow motion slows the clock that drives it, as the slice's host scaled its frame
 * time, and every snapshot carries the scale so each player's prediction slows with it.
 */
export class FightRoom extends Room {
  maxClients = tuning.coop.maxPlayers;

  private host!: HostSession;
  private buckets = new Map<string, CommandBucket>();
  /** Fight time owed by wall time and not yet stepped (s). */
  private owed = 0;
  private lastPump = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sentTuning = 0;

  onCreate() {
    this.roomId = newCode();
    const world = buildWorld(arena);
    this.host = new HostSession(
      world,
      (msg, peer) => {
        if (peer === undefined) this.broadcast(MSG, msg);
        else this.clients.getById(peer)?.send(MSG, msg);
      },
      CHEATS,
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
          console.log(`[fight ${this.roomId}] dropping ${client.sessionId}: input flood`);
          client.leave(CLOSE_INPUT_FLOOD);
          return;
        }
      }
      this.host.onMessage(client.sessionId, msg);
      if (msg.k === "tune") tuningVersion++;
    });

    this.lastPump = performance.now();
    this.pump();
    console.log(`[fight ${this.roomId}] created${CHEATS ? " (dev: cheats on)" : ""}`);
  }

  onJoin(client: Client) {
    // The player enters the fight on their hello, which carries their loadout (the slice's join).
    this.buckets.set(client.sessionId, createCommandBucket(performance.now()));
    console.log(`[fight ${this.roomId}] ${client.sessionId} connected (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    this.host.onPeerLeft(client.sessionId);
    this.buckets.delete(client.sessionId);
    console.log(`[fight ${this.roomId}] ${client.sessionId} left`);
  }

  onDispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    codes.delete(this.roomId);
    console.log(`[fight ${this.roomId}] disposed`);
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
      console.error(`[fight ${this.roomId}] step failed`, err);
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
