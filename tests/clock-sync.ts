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
 *   delay          the interpolation delay the viewer chose (INTERP: 100 ms plus what the
 *                  worst recent arrival needed, cap 200): mean and max over the run, ms
 *   margin         how far the interpolation cursor sits behind the newest snapshot
 *                  (ms; the design wants about the delay, steady). Below 0 the newest
 *                  snapshot is late for this frame.
 *   late           frames with margin below 0, as a share: what a fixed pose would hold on
 *   proj           frames projected past the newest snapshot (margin within one tick below
 *                  0, INTERP.extrapolateMaxMs): the remote player keeps moving on a guess
 *   held           frames past the projection cap, as a share: the remote player freezes;
 *                  and hold episodes per minute
 *   ahead          the furthest the drawn pose sat from the newest snapshot while
 *                  projecting, m: one tick of travel at the speed of the tick before, 0.3 m
 *                  walking, 0.6 when a server tick caught up two inputs
 *   pop            the largest change between frames of the drawn pose's error against the
 *                  true path (every snapshot, interpolated after the run), m: a projection
 *                  the next snapshot disagreed with, or a hold ending, shows here if it is
 *                  not eased; a server tick that catches up two inputs does not
 *   corr, snaps    the driven player's own reconciliation corrections and snaps per minute
 *
 * Run: npm run test:clock [-- --seconds 20 --only 150]. Exits non-zero if the clock moves
 * faster than its slew limit, sits ahead of the delivery floor, a remote player holds on a
 * clean or 50 ms link, the clean link pays more than the base delay, the 150 ms link
 * (+-25 ms jitter, 2% of packets 80 ms late) holds past the projection more than a tenth of
 * what the adaptive delay alone held (0.1 to 0.2% of frames, Sessions 14 and 23), a
 * projection runs further than one tick at the fastest speed it will project (INTERP), or a
 * pop is over a quarter of a tick of walking.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { CLOCK_SYNC, INTERP, PLAYER, TICK_MS, projectPose, tuning, type PoseSnapshot } from "@hearthgate/shared";
import { Net } from "../client/src/net";

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
  delayMean: number;
  delayMax: number;
  lateMax: number;
  marginMean: number;
  marginSd: number;
  marginP5: number;
  lateShare: number;
  projShare: number;
  heldShare: number;
  holdsPerMin: number;
  aheadMax: number;
  popMax: number;
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
    const delays: number[] = [];
    let lateMax = 0;
    let floor = -Infinity;
    let firstTick: { t: number; tick: number } | null = null;
    let lastTick: { t: number; tick: number } | null = null;
    let holds = 0;
    let wasHeld = false;
    let late = 0;
    let projected = 0;
    let heldFrames = 0;
    let aheadMax = 0;
    // Every snapshot Bravo received of Alpha, and every pose it drew: the truth and the drawing, compared after the run.
    const truth: PoseSnapshot[] = [];
    const drawnFrames: { t: number; x: number; z: number }[] = [];
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
      if (!r || r.track.snaps.length === 0) return;
      for (const sn of r.track.snaps) floor = Math.max(floor, sn.t - sn.at);
      const serverNow = b.serverNow();
      const delay = b.interpDelayMs;
      const newestSnap = r.track.snaps[r.track.snaps.length - 1];
      const newest = newestSnap.t;
      const margin = newest - (serverNow - delay);
      margins.push(margin);
      // What Bravo draws for Alpha this frame: interpolated, projected past a late snapshot, or held.
      const drawn = b.remotePose(r);
      if (drawn) {
        if (margin < 0) {
          late++;
          if (margin >= -INTERP.extrapolateMaxMs) projected++;
          else heldFrames++;
          aheadMax = Math.max(aheadMax, Math.hypot(drawn.x - newestSnap.x, drawn.z - newestSnap.z));
        }
        drawnFrames.push({ t: serverNow - delay, x: drawn.x, z: drawn.z });
      }
      const lastTruth = truth.length ? truth[truth.length - 1].t : -Infinity;
      for (const sn of r.track.snaps) if (sn.t > lastTruth) truth.push({ t: sn.t, x: sn.x, z: sn.z, facing: sn.facing });
      delays.push(delay);
      lateMax = Math.max(lateMax, b.lateMs);
      offsets.push({ t: now, offset: serverNow - now });
      const held = margin < -INTERP.extrapolateMaxMs;
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
    // Pop: how much the drawn pose's error against the true path changed from one frame to the next.
    let popMax = 0;
    let prevErr: { x: number; z: number } | null = null;
    for (const f of drawnFrames) {
      const tr = projectPose(truth, f.t, null, PLAYER.radius);
      if (!tr || tr.aheadMs > 0) {
        prevErr = null; // the truth past the last snapshot received is unknown
        continue;
      }
      const err = { x: f.x - tr.pose.x, z: f.z - tr.pose.z };
      if (prevErr) popMax = Math.max(popMax, Math.hypot(err.x - prevErr.x, err.z - prevErr.z));
      prevErr = err;
    }
    return {
      offsetSd: sd(offsets.map((o) => o.offset)),
      driftMsPerS: drift,
      vsFloorMean: mean(vsFloor),
      vsFloorMax: Math.max(...vsFloor),
      delayMean: mean(delays),
      delayMax: Math.max(...delays),
      lateMax,
      marginMean: mean(margins),
      marginSd: sd(margins),
      marginP5: percentile(margins, 0.05),
      lateShare: late / Math.max(1, margins.length),
      projShare: projected / Math.max(1, margins.length),
      heldShare: heldFrames / Math.max(1, margins.length),
      holdsPerMin: holds / minutes,
      aheadMax,
      popMax,
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
    console.log(`clock sync, ${SECONDS} s per run after a ${SETTLE_MS / 1000} s settle, interpolation delay ${INTERP.baseMs} to ${INTERP.maxMs} ms by jitter, projection up to ${INTERP.extrapolateMaxMs} ms past a late snapshot`);
    console.log("rtt      | ping A  ping B | srv rate | offset sd   drift | vs floor mean  max | late max | delay mean    max | margin mean    sd    p5 | late %   proj %   held %  holds/min | ahead m   pop m | corr/min snaps/min");
    for (const lag of LAGS) {
      if (ONLY && !lag.name.startsWith(ONLY)) continue;
      const s = await runScenario(lag);
      console.log(
        `${lag.name.padEnd(8)} |${fmt(s.rttA, 0)}${fmt(s.rttB, 0)} | ${s.serverRate.toFixed(4)}   |${fmt(s.offsetSd)}  ${fmt(s.driftMsPerS)} |${fmt(s.vsFloorMean)} ${fmt(s.vsFloorMax)}      | ${fmt(s.lateMax)}  |${fmt(s.delayMean)} ${fmt(s.delayMax)} |${fmt(s.marginMean)} ${fmt(s.marginSd)} ${fmt(s.marginP5)} |${fmt(100 * s.lateShare, 2)} ${fmt(100 * s.projShare, 2)} ${fmt(100 * s.heldShare, 2)}  ${fmt(s.holdsPerMin)} |${fmt(s.aheadMax, 3)} ${fmt(s.popMax, 3)} |${fmt(s.corrPerMin)} ${fmt(s.snapsPerMin)}`
      );
      if (s.driftMsPerS > CLOCK_SYNC.slewMsPerS + 1) failures.push(`${lag.name}: clock moved ${s.driftMsPerS.toFixed(1)} ms/s (slew limit ${CLOCK_SYNC.slewMsPerS})`);
      if (s.vsFloorMax > 3) failures.push(`${lag.name}: clock sat ${s.vsFloorMax.toFixed(1)} ms ahead of the delivery floor (limit 3)`);
      if (lag.name !== "150 ms" && s.heldShare > 0.01) failures.push(`${lag.name}: remote player held on ${(100 * s.heldShare).toFixed(2)}% of frames (limit 1%)`);
      if (lag.name === "150 ms" && s.heldShare > 0.0002) failures.push(`${lag.name}: remote player held past the projection on ${(100 * s.heldShare).toFixed(2)}% of frames (limit 0.02%, a tenth of the adaptive delay's holds)`);
      const tickOfTravel = (tuning.movement.runSpeed * INTERP.extrapolateMaxMs) / 1000;
      const aheadLimit = (INTERP.extrapolateMaxMps * INTERP.extrapolateMaxMs) / 1000;
      if (s.aheadMax > aheadLimit + 0.01) failures.push(`${lag.name}: a projection ran ${s.aheadMax.toFixed(3)} m past the newest snapshot (limit one tick at ${INTERP.extrapolateMaxMps} m/s, ${aheadLimit.toFixed(2)} m)`);
      if (s.popMax > tickOfTravel / 4) failures.push(`${lag.name}: the drawn remote player popped ${s.popMax.toFixed(3)} m in one frame (limit ${(tickOfTravel / 4).toFixed(3)} m)`);
      if (lag.name === "0 ms" && s.delayMean > INTERP.baseMs + 1) failures.push(`${lag.name}: clean link paid ${s.delayMean.toFixed(1)} ms of delay (base ${INTERP.baseMs})`);
      if (s.delayMax > INTERP.maxMs + 1e-6) failures.push(`${lag.name}: delay reached ${s.delayMax.toFixed(1)} ms (cap ${INTERP.maxMs})`);
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
