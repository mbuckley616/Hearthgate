/**
 * Clock sync measurement: how steady is the interpolation delay under latency and jitter?
 *
 * Boots the server, puts a delay-and-jitter TCP proxy in front of it, joins two real
 * `Net` clients (client/src/net.ts, the same code the browser runs) through the proxy,
 * drives one and watches the other render it for `--seconds` at three round trips
 * (0, 50 and 150 ms, each with jitter and the odd late packet), and reports per run:
 *
 *   offset sd      how much the client's estimate of server time wanders (ms)
 *   drift          the fastest it moved over any one second (ms/s). A remote player
 *                  drawn against a clock drifting 10 ms/s runs 1% fast or slow.
 *   vs floor       the clock against the best delivery seen in the run (the largest
 *                  stamp-minus-arrival over all snapshots): mean and max, ms. Above 0 the
 *                  clock is ahead of anything the network delivers and the budget shrinks.
 *   margin         how far the interpolation cursor sits behind the newest snapshot
 *                  (ms; the design wants about INTERP_DELAY_MS, steady). Below 0 the
 *                  pose is held and the remote player freezes.
 *   holds          frames with margin below 0, as a share, and hold episodes per minute
 *   corr, snaps    the driven player's own reconciliation corrections and snaps per minute
 *
 * Run: npm run test:clock [-- --seconds 20 --only 150]. Exits non-zero if the clock moves
 * faster than its slew limit, sits ahead of the delivery floor, or a remote player holds on
 * a clean or 50 ms link. Holds at 150 ms are reported, not judged: with +-25 ms jitter and
 * 80 ms spikes they are the fixed INTERP_DELAY_MS running out, which is a tuning question.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { CLOCK_SYNC, TICK_MS } from "@hearthgate/shared";
import { INTERP_DELAY_MS, Net } from "../client/src/net";

const SERVER_PORT = 2598;
const PROXY_PORT = 2597;
const SETTLE_MS = 3000;

interface Lag {
  name: string;
  /** One-way delay added each direction, so the round trip is twice this. */
  oneWayMs: number;
  /** Uniform jitter, plus or minus, per packet. */
  jitterMs: number;
  /** Share of packets that are late by `spikeMs` on top (a "late patch"). */
  spikeP: number;
  spikeMs: number;
}

const LAGS: Lag[] = [
  { name: "0 ms", oneWayMs: 0, jitterMs: 0, spikeP: 0, spikeMs: 0 },
  { name: "50 ms", oneWayMs: 25, jitterMs: 10, spikeP: 0.02, spikeMs: 40 },
  { name: "150 ms", oneWayMs: 75, jitterMs: 25, spikeP: 0.02, spikeMs: 80 }
];

const args = process.argv.slice(2);
const secondsArg = args.indexOf("--seconds");
const SECONDS = secondsArg >= 0 ? Number(args[secondsArg + 1]) : 20;
const onlyArg = args.indexOf("--only");
const ONLY = onlyArg >= 0 ? args[onlyArg + 1] : "";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Small seeded PRNG so every run sees the same jitter sequence. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A TCP proxy that holds every chunk for a delay, keeping order. Loss is not modelled: TCP
 * would retransmit anyway. One queue per direction, drained from the head: a timer per chunk
 * would reorder chunks that arrive in the same event-loop turn, because Node starts timers
 * from the loop's millisecond clock and the WebSocket upgrade would then fail.
 */
function startProxy(lag: Lag): net.Server {
  const rng = mulberry32(42);
  const server = net.createServer((down) => {
    const up = net.connect(SERVER_PORT, "localhost");
    const relay = (from: net.Socket, to: net.Socket) => {
      const queue: { due: number; chunk: Buffer }[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      let closeAfterDrain = false;
      const pump = () => {
        timer = null;
        const now = performance.now();
        while (queue.length && queue[0].due <= now + 0.5) {
          const { chunk } = queue.shift()!;
          if (!to.destroyed) to.write(chunk);
        }
        if (queue.length) timer = setTimeout(pump, Math.max(1, Math.ceil(queue[0].due - now)));
        else if (closeAfterDrain) to.destroy();
      };
      from.on("data", (chunk: Buffer) => {
        const spike = rng() < lag.spikeP ? lag.spikeMs : 0;
        const delay = Math.max(0, lag.oneWayMs + (rng() * 2 - 1) * lag.jitterMs + spike);
        const last = queue.length ? queue[queue.length - 1].due : 0;
        queue.push({ due: Math.max(last, performance.now() + delay), chunk });
        if (!timer) pump();
      });
      from.on("close", () => {
        closeAfterDrain = true;
        if (!timer) pump();
      });
      from.on("error", () => to.destroy());
    };
    relay(down, up);
    relay(up, down);
  });
  server.listen(PROXY_PORT);
  return server;
}

async function waitForHealth(url: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error(`server did not come up at ${url}`);
}

interface Stats {
  offsetSd: number;
  driftMsPerS: number;
  vsFloorMean: number;
  vsFloorMax: number;
  marginMean: number;
  marginSd: number;
  marginP5: number;
  holdShare: number;
  holdsPerMin: number;
  corrPerMin: number;
  snapsPerMin: number;
  rttA: number;
  rttB: number;
  /** Server simulation seconds per wall second, from the tick stamps Bravo received. */
  serverRate: number;
  frames: number;
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}
function sd(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function percentile(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
}

async function runScenario(lag: Lag): Promise<Stats> {
  const proxy = startProxy(lag);
  const a = new Net();
  const b = new Net();
  try {
    await a.connect(`ws://localhost:${PROXY_PORT}`, "Alpha");
    await b.connect(`ws://localhost:${PROXY_PORT}`, "Bravo");

    // Alpha walks back and forth so Bravo always has something moving to interpolate.
    let seq = 0;
    const driver = setInterval(() => {
      const dx = Math.floor(performance.now() / 2000) % 2 === 0 ? 1 : -1;
      a.tick({ seq: ++seq, dx, dy: 0, attack: false, dodge: false });
    }, TICK_MS);

    const start = performance.now();
    const offsets: { t: number; offset: number }[] = [];
    const margins: number[] = [];
    let floor = -Infinity;
    let firstTick: { t: number; tick: number } | null = null;
    let lastTick: { t: number; tick: number } | null = null;
    let holds = 0;
    let wasHeld = false;
    let corrAtSettle = 0;
    let snapsAtSettle = 0;
    let settled = false;

    // Bravo "renders" at about 60 Hz: where would the interpolation cursor be, and how far behind the newest snapshot?
    const watcher = setInterval(() => {
      const now = performance.now();
      if (now - start < SETTLE_MS) return;
      if (!settled) {
        settled = true;
        corrAtSettle = a.corrections;
        snapsAtSettle = a.snaps;
      }
      if (!firstTick) firstTick = { t: now, tick: b.lastServerTick };
      lastTick = { t: now, tick: b.lastServerTick };
      const r = b.remotes.get(a.sessionId);
      if (!r || r.snaps.length === 0) return;
      for (const sn of r.snaps) floor = Math.max(floor, sn.t - sn.at);
      const serverNow = b.serverNow();
      const newest = r.snaps[r.snaps.length - 1].t;
      const margin = newest - (serverNow - INTERP_DELAY_MS);
      margins.push(margin);
      offsets.push({ t: now, offset: serverNow - now });
      const held = margin < 0;
      if (held && !wasHeld) holds++;
      wasHeld = held;
    }, 16);

    await sleep(SETTLE_MS + SECONDS * 1000);
    clearInterval(driver);
    clearInterval(watcher);

    const minutes = SECONDS / 60;
    // Drift: the largest change of the offset over any one-second window.
    let drift = 0;
    for (let i = 0, j = 0; i < offsets.length; i++) {
      while (j < offsets.length && offsets[j].t - offsets[i].t < 1000) j++;
      if (j < offsets.length) drift = Math.max(drift, Math.abs(offsets[j].offset - offsets[i].offset) / ((offsets[j].t - offsets[i].t) / 1000));
    }
    const vsFloor = offsets.map((o) => o.offset - floor);
    return {
      offsetSd: sd(offsets.map((o) => o.offset)),
      driftMsPerS: drift,
      vsFloorMean: mean(vsFloor),
      vsFloorMax: Math.max(...vsFloor),
      marginMean: mean(margins),
      marginSd: sd(margins),
      marginP5: percentile(margins, 0.05),
      holdShare: margins.filter((m) => m < 0).length / Math.max(1, margins.length),
      holdsPerMin: holds / minutes,
      corrPerMin: (a.corrections - corrAtSettle) / minutes,
      snapsPerMin: (a.snaps - snapsAtSettle) / minutes,
      rttA: a.rttMs,
      rttB: b.rttMs,
      serverRate: firstTick && lastTick && lastTick.t > firstTick.t ? ((lastTick.tick - firstTick.tick) * TICK_MS) / (lastTick.t - firstTick.t) : 0,
      frames: margins.length
    };
  } finally {
    a.dispose();
    b.dispose();
    await sleep(300);
    proxy.close();
  }
}

function fmt(n: number, d = 1) {
  return n.toFixed(d).padStart(7);
}

async function main() {
  const server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("../server/", import.meta.url)),
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: ["ignore", "ignore", "pipe"]
  });
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  const failures: string[] = [];
  try {
    await waitForHealth(`http://localhost:${SERVER_PORT}/health`);
    console.log(`clock sync, ${SECONDS} s per run after a ${SETTLE_MS / 1000} s settle, interpolation delay ${INTERP_DELAY_MS} ms`);
    console.log("rtt      | ping A  ping B | srv rate | offset sd   drift | vs floor mean  max | margin mean    sd    p5 | holds %  holds/min | corr/min snaps/min");
    for (const lag of LAGS) {
      if (ONLY && !lag.name.startsWith(ONLY)) continue;
      const s = await runScenario(lag);
      console.log(
        `${lag.name.padEnd(8)} |${fmt(s.rttA, 0)}${fmt(s.rttB, 0)} | ${s.serverRate.toFixed(4)}   |${fmt(s.offsetSd)}  ${fmt(s.driftMsPerS)} |${fmt(s.vsFloorMean)} ${fmt(s.vsFloorMax)}      |${fmt(s.marginMean)} ${fmt(s.marginSd)} ${fmt(s.marginP5)} |${fmt(100 * s.holdShare)}  ${fmt(s.holdsPerMin)} |${fmt(s.corrPerMin)} ${fmt(s.snapsPerMin)}`
      );
      if (s.driftMsPerS > CLOCK_SYNC.slewMsPerS + 1) failures.push(`${lag.name}: clock moved ${s.driftMsPerS.toFixed(1)} ms/s (slew limit ${CLOCK_SYNC.slewMsPerS})`);
      if (s.vsFloorMax > 3) failures.push(`${lag.name}: clock sat ${s.vsFloorMax.toFixed(1)} ms ahead of the delivery floor (limit 3)`);
      if (lag.name !== "150 ms" && s.holdShare > 0.01) failures.push(`${lag.name}: remote player held on ${(100 * s.holdShare).toFixed(1)}% of frames (limit 1%)`);
    }
  } finally {
    server.kill("SIGTERM");
  }
  if (failures.length) {
    console.error("FAIL:\n  " + failures.join("\n  "));
    process.exit(1);
  }
  console.log("ok");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAIL:", err instanceof Error ? err.stack : JSON.stringify(err));
    process.exit(1);
  });
