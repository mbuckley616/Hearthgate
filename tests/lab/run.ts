/**
 * The lag lab (owned by the critic): two real browser clients fight the combat slice's run on
 * Hearthgate's server through a bad link.
 *
 * Boots the server and the Vite dev server on spare ports, puts tests/lab/proxy.ts in front of the
 * server, and opens two Chromium pages through it, each in its own browser so neither is a
 * background tab. Alpha makes a fight (`?play`) and Bravo joins it by its code; both walk through
 * the antechamber gate, and for `--seconds` per condition Alpha fights by a seeded schedule of held
 * keys, swings (J), dodges (Ctrl), jumps, Q and E and hero swaps, leaning back to where the run
 * started; Bravo stands, revives Alpha when down, and a lost run is restarted (F) and walked into
 * again. Per condition it reports:
 *
 *   corr/min   Alpha's reconciliation corrections a minute (the slice's ClientSession, counted)
 *   snaps      corrections too big to ease (over 2.5 m), less those within a second of the server
 *              moving the player itself (the gate bringing stragglers in, a restart, a revive)
 *   holds/min  times Bravo's drawn Alpha stood still for 4+ frames while Alpha really moved
 *   view lag   how far behind Bravo draws Alpha: the shift that best lines the two tracks up (ms),
 *              and the mean distance left at that shift (m)
 *   in flight  Alpha's inputs sent and not yet acked, on average, as ms of ticks
 *   KB/s       what the server sends one player (the proxy counts it; local runs only)
 *
 * Verdict: "snaps" if any network snap, "rough" over 30 corrections or 20 holds a minute, else "ok".
 *
 * Run: npm run lab [-- --seconds 60 --only "150 ms" --warmup 10 --cpu-throttle 4]. Writes tests/tmp/lab-result.json.
 *
 * A hosted build instead of a local one: `--server wss://host --client https://host` boots nothing
 * and puts no proxy in the way, so the two browsers reach the real server over the real network
 * (the machine stand-in for the "two people on different networks" playtest). One condition, named
 * after the host; `lost_chunks` and KB/s are 0 because no proxy counted them.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { mulberry32, startProxy, type Link } from "./proxy";

const SERVER_PORT = 2621;
const VITE_PORT = 5191;
const PROXY_BASE = 2630;
const SETTLE_MS = 1500;
// Small on purpose: software WebGL at full size starves the input timer and the socket and makes the
// netcode look worse than it is. The lab measures the network, not the GPU.
const LAB_VIEWPORT = { width: 320, height: 200 };
const HOLD_MOVED_M = 0.25;
/** A snap this close to the server moving the player itself (gate, restart, revive) is not the network's. */
const PLACED_MS = 1000;

interface Condition extends Link {
  name: string;
}

const CONDITIONS: Condition[] = [
  { name: "0 ms", oneWayMs: 0, jitterMs: 0, loss: 0 },
  { name: "50 ms", oneWayMs: 50, jitterMs: 0, loss: 0 },
  { name: "150 ms", oneWayMs: 150, jitterMs: 0, loss: 0 },
  { name: "50 ms +-20, 2% loss", oneWayMs: 50, jitterMs: 20, loss: 0.02 },
];

const args = process.argv.slice(2);
const argOf = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const SECONDS = Number(argOf("--seconds") ?? 60);
const ONLY = argOf("--only") ?? "";
/** A hosted build to measure: no local server and no proxy with --server, no Vite with --client. */
const REMOTE_SERVER = argOf("--server") ?? "";
const REMOTE_CLIENT = argOf("--client") ?? "";
const CLIENT_BASE = REMOTE_CLIENT || `http://127.0.0.1:${VITE_PORT}`;
const WARMUP_S = Number(argOf("--warmup") ?? 10);
/** Slows Alpha's page by this factor (CDP CPU throttling) to see what a low frame rate does to the numbers. */
const CPU_THROTTLE = Number(argOf("--cpu-throttle") ?? 1);
/** --tune path=value (repeatable): tuning edits Alpha sends through the server once in the fight, to test one cause at a time. */
const TUNES = args.flatMap((a, i) => (a === "--tune" ? [args[i + 1]] : [])).map((t) => {
  const [path, raw] = t.split("=");
  return { path, value: raw === "true" ? true : raw === "false" ? false : Number(raw) };
});

const root = fileURLToPath(new URL("../..", import.meta.url));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`nothing at ${url}`);
}

/** node directly, never npx: a .cmd shim spawn() cannot run on Windows, and killing a shell leaves its child. */
function boot(): { server: ChildProcess | null; vite: ChildProcess | null } {
  const tsx = `${root}node_modules/tsx/dist/cli.mjs`;
  const server = REMOTE_SERVER
    ? null
    : spawn(process.execPath, [tsx, "src/index.ts"], { cwd: `${root}server`, env: { ...process.env, PORT: String(SERVER_PORT) }, stdio: "ignore" });
  const vite = REMOTE_CLIENT
    ? null
    : spawn(process.execPath, [`${root}node_modules/vite/bin/vite.js`, "--port", String(VITE_PORT), "--strictPort", "--host", "127.0.0.1"], {
        cwd: `${root}client`,
        stdio: "ignore",
      });
  return { server, vite };
}

/**
 * Headless Chromium draws WebGL in software unless told to use the GPU, and the slice's look at
 * software speed runs the pages near 25 fps, where every frame carries two or three ticks. --cpu
 * keeps the software path (a machine with no GPU, CI).
 */
const GPU_ARGS = args.includes("--cpu") ? [] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];

async function launch(): Promise<Browser> {
  const opts = {
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", ...GPU_ARGS],
  };
  try {
    return await chromium.launch(opts);
  } catch {
    return await chromium.launch({ ...opts, executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  }
}

// In-page probes, as strings: tsx's keepNames would inject a __name helper the page lacks.
const PROBE = `(() => {
  const g = window.game, s = g.session;
  const lerp = (b, id) => {
    const c = b.curr.players.find((p) => p.id === id);
    if (!c) return null;
    const p = b.prev.players.find((q) => q.id === id) || c;
    return { x: p.x + (c.x - p.x) * b.alpha, z: p.z + (c.z - p.z) * b.alpha, hp: c.hp, mode: c.mode };
  };
  window.__probe = {
    me: () => {
      const h = s.hero();
      if (!h) return null;
      const a = h.alpha;
      return { x: h.prev.x + (h.curr.x - h.prev.x) * a, z: h.prev.z + (h.curr.z - h.prev.z) * a, hp: h.curr.hp, mode: h.curr.mode };
    },
    other: (id) => lerp(s.view(), id),
    phase: () => s.view().curr.run.phase,
    /** The nearest enemy still standing, as drawn here. */
    enemy: () => {
      const h = s.hero();
      if (!h) return null;
      let best = null, bd = Infinity;
      for (const e of s.view().curr.enemies) {
        if (e.ai === 'dead' || e.hp <= 0) continue;
        const d = Math.hypot(e.x - h.curr.x, e.z - h.curr.z);
        if (d < bd) { bd = d; best = { x: e.x, z: e.z, d }; }
      }
      return best;
    },
    /** Turn the camera to face a point, so W walks there and a swing goes there (the camera is the browser's own). */
    aim: (x, z) => {
      const h = s.hero();
      if (!h) return;
      window.game.cam.yaw = Math.atan2(-(x - h.curr.x), -(z - h.curr.z));
    },
  };
})()`;

/** One sample per animation frame, wall-clock stamped so the two pages line up. */
function recorder(watchId: string | null) {
  return `(() => {
  const id = ${JSON.stringify(watchId)};
  const phases = { ante: 0, intro: 1, wave: 2, rest: 3, won: 4, lost: 5 };
  window.__lab = [];
  const tick = () => {
    const s = window.game.session;
    if (id === null) {
      const m = window.__probe.me();
      if (m) window.__lab.push([Date.now(), m.x, m.z, m.hp, s.stats.snaps, s.stats.corrections, phases[window.__probe.phase()], s.unacked, s.stats.sumCorrection, s.stats.maxCorrection, s.stats.bigCorrections, s.stats.bigBySwing, s.stats.bigByHit, s.stats.bigOther]);
    } else {
      const p = window.__probe.other(id);
      if (p) window.__lab.push([Date.now(), p.x, p.z]);
    }
    if (window.__labOn !== false) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;
}

const info = (p: Page) =>
  p.evaluate(`(() => { const s = window.game.session; return { id: s.localId, code: s.code, playing: s.playing, players: s.view().curr.players.length, phase: s.view().curr.run.phase }; })()`) as Promise<{
    id: string;
    code: string;
    playing: boolean;
    players: number;
    phase: string;
  }>;

async function until(ok: () => Promise<boolean>, timeoutMs: number, what: string) {
  const start = Date.now();
  while (!(await ok())) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out: ${what}`);
    await sleep(100);
  }
}

interface Row {
  condition: string;
  /** "local" or the hosted server's URL. */
  target: string;
  latency: number;
  jitter: number;
  loss: number;
  seconds: number;
  corrections: number;
  corrections_per_min: number;
  /** Mean and largest correction (m): eased over coop.correctionBlendMs, so a few cm do not show. */
  correction_mean_m: number;
  correction_max_m: number;
  /** Corrections over 10 cm a minute, and those by cause: the hero's own swing or ability, a hit taken, or neither (the network's). */
  big_per_min: number;
  big_swing_per_min: number;
  big_hit_per_min: number;
  big_other_per_min: number;
  snaps: number;
  placed_snaps: number;
  walked_m_per_min: number;
  snap_moments: { at_s: number; x: number; z: number; hp: number; frame_gap_ms: number; jump_m: number }[];
  holds_per_min: number;
  view_lag_ms: number;
  view_gap_m: number;
  /** How far behind the server Bravo draws everyone else at the end (the adaptive delay, T2). */
  draw_delay_ms: number;
  in_flight_ms: number;
  kb_per_s_per_player: number;
  downs: number;
  runs_started: number;
  /** Runs the pair finished with the Warden down. */
  runs_won: number;
  fps_a: number;
  fps_b: number;
  lost_chunks: number;
  page_errors: string[];
  verdict: string;
}

async function runCondition(ba: Browser, bb: Browser, c: Condition, port: number, seconds = SECONDS): Promise<Row> {
  const proxy = REMOTE_SERVER ? null : await startProxy(port, SERVER_PORT, c);
  const errors: string[] = [];
  const ctxA = await ba.newContext({ viewport: LAB_VIEWPORT });
  const ctxB = await bb.newContext({ viewport: LAB_VIEWPORT });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  if (CPU_THROTTLE > 1) {
    const cdp = await ctxA.newCDPSession(a);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  }
  for (const [n, p] of [["Alpha", a], ["Bravo", b]] as const) p.on("pageerror", (e) => errors.push(`${n}: ${e.message}`));
  const held = new Map<Page, Set<string>>([
    [a, new Set()],
    [b, new Set()],
  ]);
  const setKeys = async (p: Page, want: string[]) => {
    const have = held.get(p)!;
    for (const k of [...have]) if (!want.includes(k)) (await p.keyboard.up(k), have.delete(k));
    for (const k of want) if (!have.has(k)) (await p.keyboard.down(k), have.add(k));
  };
  try {
    const server = `server=${REMOTE_SERVER || `ws://127.0.0.1:${port}`}`;
    await a.goto(`${CLIENT_BASE}/?play&${server}`);
    await until(async () => (await info(a)).playing, 20000, "Alpha in a fight");
    const { code, id: alphaId } = await info(a);
    await b.goto(`${CLIENT_BASE}/?join=${code}&${server}`);
    await until(async () => (await info(b)).playing && (await info(a)).players === 2, 20000, "Bravo joined");
    for (const p of [a, b]) await p.evaluate(PROBE);
    for (const t of TUNES) await a.evaluate(`window.game.session.request({ k: "tune", edit: ${JSON.stringify(t)} })`);

    // Into the arena together: the run starts when both are through the gate.
    let runs = 0;
    const enterRun = async () => {
      runs++;
      await setKeys(a, ["KeyW"]);
      await setKeys(b, ["KeyW"]);
      await until(async () => (await info(a)).phase !== "ante", 30000, "the run starts");
      await setKeys(a, []);
      await setKeys(b, []);
    };
    await enterRun();
    await sleep(SETTLE_MS);
    await a.evaluate(recorder(null));
    await b.evaluate(recorder(alphaId));
    const home = (await a.evaluate("window.__probe.me()")) as { x: number; z: number };
    const bytes0 = proxy?.bytesDown() ?? 0;
    const wall0 = Date.now();

    // Alpha's schedule: seeded, so every condition and every day plays the same game.
    const rng = mulberry32(7);
    const end = Date.now() + seconds * 1000;
    let downs = 0;
    let wasDown = false;
    let won = 0;
    while (Date.now() < end) {
      const phase = (await info(a)).phase;
      if (phase === "won" || phase === "lost") {
        if (phase === "won") won++;
        await setKeys(a, []);
        await setKeys(b, []);
        await a.keyboard.press("KeyF");
        await until(async () => (await info(a)).phase === "ante", 5000, "the restart");
        await enterRun();
        continue;
      }
      const me = (await a.evaluate("window.__probe.me()")) as { x: number; z: number; mode: string };
      const down = me.mode === "down";
      if (down && !wasDown) downs++;
      wasDown = down;
      // Wander, but lean home when far, so Alpha stays in the fight in the arena.
      const far = Math.hypot(me.x - home.x, me.z - home.z) > 6;
      const keys: string[] = [];
      if (!down) {
        if (far) {
          // The camera has not turned: W is north (-z), D is east (+x).
          if (me.x > home.x + 2) keys.push("KeyA");
          else if (me.x < home.x - 2) keys.push("KeyD");
          if (me.z > home.z + 2) keys.push("KeyW");
          else if (me.z < home.z - 2) keys.push("KeyS");
        } else {
          const r = rng();
          if (r < 0.25) keys.push("KeyD");
          else if (r < 0.5) keys.push("KeyA");
          if (rng() < 0.5) keys.push(rng() < 0.5 ? "KeyW" : "KeyS");
        }
        if (keys.length > 0 && rng() < 0.3) keys.push("ShiftLeft");
      }
      await setKeys(a, keys);
      const act = rng();
      if (act < 0.3) await a.keyboard.press("KeyJ");
      else if (act < 0.38) await a.keyboard.press("ControlLeft");
      else if (act < 0.46) await a.keyboard.press("Space");
      else if (act < 0.5) await a.keyboard.press(rng() < 0.5 ? "KeyQ" : "KeyE");
      else if (act < 0.53) await a.keyboard.press(["Digit1", "Digit2", "Digit3"][Math.floor(rng() * 3)]);

      // Bravo fights: faces the nearest enemy, closes in and swings; and when Alpha is down, goes to
      // them and holds F (the slice's revive). Deterministic, so Alpha's seeded schedule is unchanged.
      const target = down
        ? ((await b.evaluate(`window.__probe.other(${JSON.stringify(alphaId)})`)) as { x: number; z: number } | null)
        : ((await b.evaluate("window.__probe.enemy()")) as { x: number; z: number } | null);
      const bme = (await b.evaluate("window.__probe.me()")) as { x: number; z: number; mode: string } | null;
      if (target && bme && bme.mode !== "down") {
        await b.evaluate(`window.__probe.aim(${target.x}, ${target.z})`);
        const d = Math.hypot(target.x - bme.x, target.z - bme.z);
        if (down) await setKeys(b, d < 1.2 ? ["KeyF"] : ["KeyW"]);
        else if (d > 2) await setKeys(b, d > 6 ? ["KeyW", "ShiftLeft"] : ["KeyW"]);
        else {
          await setKeys(b, []);
          for (let i = 0; i < 3; i++) await b.keyboard.press("KeyJ");
        }
      } else await setKeys(b, []);
      await sleep(250 + rng() * 650);
    }
    await setKeys(a, []);
    await setKeys(b, []);

    const fps = (track: number[][]) => (track.length > 1 ? Math.round(((track.length - 1) / ((track[track.length - 1][0] - track[0][0]) / 1000)) * 10) / 10 : 0);
    const trueTrack = (await a.evaluate("(window.__labOn = false, window.__lab)")) as number[][];
    const seen = (await b.evaluate("(window.__labOn = false, window.__lab)")) as number[][];
    const drawDelay = (await b.evaluate("window.game.session.drawDelayMs")) as number;

    // How far behind does Bravo draw Alpha? The lag that best lines the two tracks up.
    const trueAt = (t: number) => {
      let lo = 0;
      let hi = trueTrack.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (trueTrack[mid][0] <= t) lo = mid;
        else hi = mid - 1;
      }
      return trueTrack[lo];
    };
    const gapAt = (lag: number) => {
      let sum = 0;
      for (const s of seen) {
        const tr = trueAt(s[0] - lag);
        sum += Math.hypot(tr[1] - s[1], tr[2] - s[2]);
      }
      return sum / Math.max(1, seen.length);
    };
    let viewLag = 0;
    let bestGap = Infinity;
    for (let lag = 0; lag <= 800; lag += 5) {
      const g = gapAt(lag);
      if (g < bestGap) (bestGap = g), (viewLag = lag);
    }
    // Holds: Bravo's Alpha frozen for 4+ frames while the real Alpha, shifted by that lag, moved.
    let holds = 0;
    let run = 1;
    for (let i = 1; i < seen.length; i++) {
      const same = seen[i][1] === seen[i - 1][1] && seen[i][2] === seen[i - 1][2];
      if (same) run++;
      else {
        if (run >= 4) {
          const s = trueAt(seen[i - run][0] - viewLag);
          const e = trueAt(seen[i - 1][0] - viewLag);
          if (Math.hypot(e[1] - s[1], e[2] - s[2]) > HOLD_MOVED_M) holds++;
        }
        run = 1;
      }
    }
    // The server moves the player itself when the gate brings stragglers in, at a restart and at a
    // revive: a snap within PLACED_MS of a phase change or of hp coming back from 0 is not the link's.
    const placedAt: number[] = [];
    for (let i = 1; i < trueTrack.length; i++) {
      if (trueTrack[i][6] !== trueTrack[i - 1][6] || (trueTrack[i - 1][3] <= 0 && trueTrack[i][3] > 0)) placedAt.push(trueTrack[i][0]);
    }
    let placedSnaps = 0;
    const snapMoments: Row["snap_moments"] = [];
    for (let i = 1; i < trueTrack.length; i++) {
      const n = trueTrack[i][4] - trueTrack[i - 1][4];
      if (n <= 0) continue;
      const t = trueTrack[i][0];
      if (placedAt.some((p) => Math.abs(p - t) < PLACED_MS)) placedSnaps += n;
      else
        snapMoments.push({
          at_s: Math.round((t - trueTrack[0][0]) / 100) / 10,
          x: Math.round(trueTrack[i][1] * 10) / 10,
          z: Math.round(trueTrack[i][2] * 10) / 10,
          hp: trueTrack[i][3],
          frame_gap_ms: t - trueTrack[i - 1][0],
          jump_m: Math.round(Math.hypot(trueTrack[i][1] - trueTrack[i - 1][1], trueTrack[i][2] - trueTrack[i - 1][2]) * 100) / 100,
        });
    }
    const minutes = seconds / 60;
    let walked = 0;
    let inFlight = 0;
    for (let i = 1; i < trueTrack.length; i++) {
      const d = Math.hypot(trueTrack[i][1] - trueTrack[i - 1][1], trueTrack[i][2] - trueTrack[i - 1][2]);
      if (d < 2) walked += d;
      inFlight += trueTrack[i][7];
    }
    const first = trueTrack[0];
    const last = trueTrack[trueTrack.length - 1];
    const corr = last[5] - first[5];
    const snaps = last[4] - first[4] - placedSnaps;
    const cpm = corr / minutes;
    const verdict = snaps > 0 ? "snaps" : cpm > 30 || holds / minutes > 20 ? "rough" : "ok";
    return {
      condition: c.name,
      target: REMOTE_SERVER || "local",
      latency: c.oneWayMs,
      jitter: c.jitterMs,
      loss: c.loss,
      seconds,
      corrections: corr,
      corrections_per_min: Math.round(cpm * 10) / 10,
      correction_mean_m: corr > 0 ? Math.round(((last[8] - first[8]) / corr) * 1000) / 1000 : 0,
      correction_max_m: Math.round(last[9] * 100) / 100,
      big_per_min: Math.round(((last[10] - first[10]) / minutes) * 10) / 10,
      big_swing_per_min: Math.round(((last[11] - first[11]) / minutes) * 10) / 10,
      big_hit_per_min: Math.round(((last[12] - first[12]) / minutes) * 10) / 10,
      big_other_per_min: Math.round(((last[13] - first[13]) / minutes) * 10) / 10,
      snaps,
      placed_snaps: placedSnaps,
      walked_m_per_min: Math.round(walked / minutes),
      snap_moments: snapMoments,
      holds_per_min: Math.round((holds / minutes) * 10) / 10,
      view_lag_ms: viewLag,
      view_gap_m: Math.round(bestGap * 100) / 100,
      draw_delay_ms: Math.round(drawDelay),
      in_flight_ms: Math.round(((inFlight / Math.max(1, trueTrack.length - 1)) * 1000) / 60),
      kb_per_s_per_player: proxy ? Math.round((proxy.bytesDown() - bytes0) / 1024 / 2 / ((Date.now() - wall0) / 1000)) : 0,
      downs,
      runs_started: runs,
      runs_won: won,
      fps_a: fps(trueTrack),
      fps_b: fps(seen),
      lost_chunks: proxy ? proxy.lost() : 0,
      page_errors: errors,
      verdict,
    };
  } finally {
    await ctxA.close();
    await ctxB.close();
    await proxy?.close();
    await sleep(800); // let the empty room dispose
  }
}

async function main() {
  const procs = boot();
  let ba: Browser | null = null;
  let bb: Browser | null = null;
  try {
    if (REMOTE_SERVER) {
      // A free Render instance sleeps; its health URL wakes it and answers within about a minute.
      const health = REMOTE_SERVER.replace(/^ws/, "http").replace(/\/$/, "") + "/health";
      await waitFor(health, 90000);
    } else await waitFor(`http://127.0.0.1:${SERVER_PORT}/health`);
    await waitFor(`${CLIENT_BASE}/`);
    ba = await launch();
    bb = await launch();
    const rows: Row[] = [];
    let i = 0;
    const conditions: Condition[] = REMOTE_SERVER ? [{ name: `remote ${new URL(REMOTE_SERVER).host}`, oneWayMs: 0, jitterMs: 0, loss: 0 }] : CONDITIONS;
    // A fresh machine's first condition runs slow (JIT, Vite's first transform, the shader cache),
    // so a short clean run goes first and is thrown away. Local only.
    if (!REMOTE_SERVER && WARMUP_S > 0) {
      const w = await runCondition(ba, bb, { name: "warm-up", oneWayMs: 0, jitterMs: 0, loss: 0 }, PROXY_BASE + 9, WARMUP_S);
      console.log(`warm-up (${WARMUP_S} s, discarded): corr/min ${w.corrections_per_min}, holds/min ${w.holds_per_min}, fps ${w.fps_a}/${w.fps_b}`);
    }
    for (const c of conditions) {
      // Exact, or "50 ms" would also run "50 ms +-20, 2% loss"; "loss" picks the lossy row alone.
      if (ONLY && c.name !== ONLY && !(ONLY === "loss" && c.loss > 0)) continue;
      const row = await runCondition(ba, bb, c, PROXY_BASE + i++);
      rows.push(row);
      console.log(
        `${row.condition.padEnd(22)} corr/min ${String(row.corrections_per_min).padStart(6)} (over 10 cm ${row.big_per_min}: swing ${row.big_swing_per_min} hit ${row.big_hit_per_min} other ${row.big_other_per_min}, max ${row.correction_max_m} m)  snaps ${row.snaps} (+${row.placed_snaps} placed)  holds/min ${row.holds_per_min}  view lag ${row.view_lag_ms} ms (gap ${row.view_gap_m} m, delay ${row.draw_delay_ms} ms)  in flight ${row.in_flight_ms} ms  ${row.kb_per_s_per_player} KB/s  downs ${row.downs}  runs ${row.runs_started} (won ${row.runs_won})  fps ${row.fps_a}/${row.fps_b}  walked ${row.walked_m_per_min} m/min  lost ${row.lost_chunks}  errors ${row.page_errors.length}  -> ${row.verdict}`,
      );
      for (const m of row.snap_moments) console.log(`  snap at ${m.at_s} s, (${m.x}, ${m.z}), hp ${m.hp}, frame gap ${m.frame_gap_ms} ms, jumped ${m.jump_m} m`);
      for (const e of row.page_errors.slice(0, 3)) console.log(`  page error: ${e}`);
    }
    mkdirSync(`${root}tests/tmp`, { recursive: true });
    writeFileSync(`${root}tests/tmp/lab-result.json`, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  } finally {
    await ba?.close();
    await bb?.close();
    procs.server?.kill();
    procs.vite?.kill();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
