/**
 * The bot harness: headless players that speak the slice's messages to Hearthgate's server
 * (shared/src/net/protocol.ts) over colyseus.js, for `npm run test:net` and the lag lab. A bot
 * makes or joins a fight, says hello with a loadout, keeps every snapshot and message, and sends
 * numbered commands paced by wall time at the tick rate, as the browser's frames do.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client, type Room } from "colyseus.js";
import { tuning } from "@hearthgate/shared/config/tuning";
import type { PortalState } from "@hearthgate/shared/game/portal";
import { PROTOCOL_VERSION, type SeqCommand, type ToHost, type ToPeer } from "@hearthgate/shared/net/protocol";
import type { Loadout } from "@hearthgate/shared/sim/coop";
import { emptyMods } from "@hearthgate/shared/sim/gear";
import { emptyTalents } from "@hearthgate/shared/sim/talents";
import { idleCommand, type PlayerCommand, type SimState } from "@hearthgate/shared/sim/types";

export const MSG = "m";
export const TICK_MS = 1000 / tuning.sim.tickRate;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const root = fileURLToPath(new URL("..", import.meta.url));

export function loadout(name: string): Loadout {
  return { name, xp: { sword: 0, bow: 0, staff: 0 }, talents: emptyTalents(), mods: emptyMods(), maxHp: 100 };
}

/** A command facing north (-z, into the arena from the antechamber), with any fields changed. */
export function command(over: Partial<PlayerCommand> = {}): PlayerCommand {
  return { ...idleCommand(), aimX: 0, aimZ: -1, ...over };
}

/** Boot the server on `port` with tsx (node directly: npx is a .cmd shim spawn() cannot run on Windows). */
export function bootServer(port: number, dev = true): ChildProcess {
  const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
  const proc = spawn(process.execPath, [tsxCli, "src/index.ts", ...(dev ? ["--dev"] : [])], {
    cwd: `${root}server`,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.on("data", (d) => process.env.VERBOSE && process.stdout.write(`[server] ${d}`));
  proc.stderr?.on("data", (d) => process.stderr.write(`[server] ${d}`));
  return proc;
}

export async function waitForHealth(url: string, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() - start > timeoutMs) throw new Error(`no answer from ${url}`);
    await sleep(250);
  }
}

export class Bot {
  room!: Room;
  client!: Client;
  id = "";
  code = "";
  seq = 0;
  snaps: { s: SimState; acks: Record<string, number>; at: number; scale: number; portal: PortalState | null }[] = [];
  /** A portal's hand-off the server sent, not yet taken. */
  handoff: { reservation: unknown; level: string } | null = null;
  /** What the room we are in runs. */
  kind = "";
  messages: ToPeer[] = [];
  closedWith: number | null = null;

  constructor(
    readonly name: string,
    private readonly endpoint: string,
  ) {}

  /** Make a room of our own (code null: a dungeon run unless told otherwise) or join one by code, say hello and wait for the welcome. */
  async join(code: string | null, create: "dungeon" | "village" = "dungeon"): Promise<this> {
    const client = new Client(this.endpoint);
    this.client = client;
    this.attach(code ? await client.joinById(code) : await client.create(create));
    await this.until(() => this.id !== "" && this.snaps.length > 0, 5000, `${this.name} welcomed`);
    return this;
  }

  /** Take the seat a portal's hand-off reserved: leave this room, join the next, say hello again. */
  async takeHandoff(): Promise<this> {
    const h = this.handoff!;
    this.handoff = null;
    const old = this.room;
    this.id = "";
    this.snaps = [];
    this.seq = 0;
    void old.leave();
    this.attach(await this.client.consumeSeatReservation(h.reservation as Parameters<Client["consumeSeatReservation"]>[0]));
    await this.until(() => this.id !== "" && this.snaps.length > 0, 5000, `${this.name} welcomed after the portal`);
    return this;
  }

  private attach(room: Room) {
    this.room = room;
    this.kind = room.name;
    this.code = room.roomId;
    room.onMessage(MSG, (m: ToPeer) => {
      // The room we left on a hand-off may still say something on its way out.
      if (this.room !== room) return;
      this.messages.push(m);
      if (m.k === "welcome") this.id = m.id;
      if (m.k === "snap") this.snaps.push({ s: m.s, acks: m.acks, at: performance.now(), scale: m.scale, portal: m.portal });
      if (m.k === "handoff") this.handoff = { reservation: m.reservation, level: m.level };
    });
    room.onLeave((c) => {
      if (this.room === room) this.closedWith = c;
    });
    this.send({ k: "hello", version: PROTOCOL_VERSION, loadout: loadout(this.name) });
  }

  send(msg: ToHost | Record<string, unknown>) {
    this.room.send(MSG, msg);
  }

  /** The latest snapshot's state. */
  get state(): SimState {
    return this.snaps[this.snaps.length - 1].s;
  }

  me(of: string = this.id) {
    return this.state.players.find((p) => p.id === of);
  }

  get ack(): number {
    return this.snaps[this.snaps.length - 1]?.acks[this.id] ?? 0;
  }

  /** Send `ticks` commands paced by wall time at the tick rate, every one due on each wake-up, as the browser does. */
  async drive(ticks: number, c: (k: number) => PlayerCommand = () => command()) {
    const start = performance.now();
    let sent = 0;
    while (sent < ticks) {
      const due = Math.min(ticks, Math.floor((performance.now() - start) / TICK_MS) + 1);
      const cmds: SeqCommand[] = [];
      while (sent < due) cmds.push({ seq: ++this.seq, cmd: c(sent++) });
      if (cmds.length) this.send({ k: "input", cmds });
      if (sent < ticks) await sleep(2);
    }
  }

  /**
   * Run toward (x, z) until within `tol` metres and settled there. The snapshot we steer by is a round
   * trip behind where we really are, so a bot coasts past its mark; after stopping it looks again and
   * corrects, a few times if it must, until the server has it standing on the mark.
   */
  async walkTo(x: number, z: number, tol = 0.6, timeoutMs = 20000) {
    const start = performance.now();
    for (let tries = 0; tries < 6; tries++) {
      for (;;) {
        const p = this.me();
        if (p && Math.hypot(p.x - x, p.z - z) <= tol) break;
        if (performance.now() - start > timeoutMs) throw new Error(`${this.name} never reached (${x}, ${z})`);
        const dx = p ? x - p.x : 0;
        const dz = p ? z - p.z : -1;
        const d = Math.hypot(dx, dz) || 1;
        // Ease off near the mark.
        const k = Math.min(1, Math.max(0.25, d / 4));
        await this.drive(4, () => command({ moveX: (dx / d) * k, moveZ: (dz / d) * k, aimX: dx / d, aimZ: dz / d }));
      }
      await this.drive(40);
      await sleep(150);
      const p = this.me();
      if (p && Math.hypot(p.x - x, p.z - z) <= tol) return;
    }
    throw new Error(`${this.name} would not settle on (${x}, ${z})`);
  }

  async until(ok: () => boolean, timeoutMs: number, what: string) {
    const start = performance.now();
    while (!ok()) {
      if (performance.now() - start > timeoutMs) throw new Error(`timed out: ${what}`);
      await sleep(10);
    }
  }

  async leave() {
    if (this.closedWith === null) await Promise.race([this.room.leave(), sleep(1000)]);
  }
}
