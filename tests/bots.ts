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
  id = "";
  code = "";
  seq = 0;
  snaps: { s: SimState; acks: Record<string, number>; at: number; scale: number }[] = [];
  messages: ToPeer[] = [];
  closedWith: number | null = null;

  constructor(
    readonly name: string,
    private readonly endpoint: string,
  ) {}

  /** Make a fight of our own (code null) or join one by code, say hello and wait for the welcome. */
  async join(code: string | null): Promise<this> {
    const client = new Client(this.endpoint);
    this.room = code ? await client.joinById(code) : await client.create("fight");
    this.code = this.room.roomId;
    this.room.onMessage(MSG, (m: ToPeer) => {
      this.messages.push(m);
      if (m.k === "welcome") this.id = m.id;
      if (m.k === "snap") this.snaps.push({ s: m.s, acks: m.acks, at: performance.now(), scale: m.scale });
    });
    this.room.onLeave((c) => (this.closedWith = c));
    this.send({ k: "hello", version: PROTOCOL_VERSION, loadout: loadout(this.name) });
    await this.until(() => this.id !== "" && this.snaps.length > 0, 5000, `${this.name} welcomed`);
    return this;
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
