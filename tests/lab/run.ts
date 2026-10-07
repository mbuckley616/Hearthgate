/**
 * The lag lab (owned by the critic): two real browser clients fight through a bad link.
 *
 * Boots the server and the Vite dev server on spare ports, puts tests/lab/proxy.ts in front
 * of the server, and opens two Chromium pages through it, each in its own browser so neither
 * is a background tab (headless Chromium throttles a second tab's input timer, which is why
 * tests/two-players.e2e.ts barely moves). Alpha is driven for `--seconds` per condition by a
 * seeded schedule of held keys, swings, dodges and Cleave; Bravo watches, and walks over to
 * pick Alpha up if Alpha goes down so the run keeps moving. Per condition it reports:
 *
 *   corr/min   Alpha's reconciliation corrections a minute, read from the HUD text
 *   snaps      Alpha's corrections too big to smooth (window.__hg.snaps), less the ones a respawn
 *              or wipe caused (the server moved the player; no network did), which are shown apart
 *   holds/min  times Bravo's drawn Alpha stood still for 4+ frames while Alpha really moved
 *
 * Verdict: "snaps" if any network snap, "rough" over 30 corrections or 20 holds a minute, else "ok".
 *   view lag   how far behind Bravo draws Alpha: the shift that best lines the two tracks up (ms),
 *              and the mean distance left at that shift (m)
 *   rtt        Alpha's HUD round trip
 *
 * Run: npm run lab [-- --seconds 60 --only 150 --level field --warmup 10]. Writes tests/tmp/lab-result.json.
 *
 * The level is pinned (`--level`, default `field`: the Phase 0 arena with one goblin, the ground the
 * first runs measured) because the client's default level changes as the floor is built, and a
 * hall where nothing wakes would lower the numbers for a reason that is not the network.
 *
 * A hosted build instead of a local one: `--server wss://host --client https://host` boots nothing
 * and puts no proxy in the way, so the two browsers reach the real server over the real network
 * (the machine stand-in for the "two people on different networks" playtest). One condition, named
 * after the host; `lost_chunks` is 0 because no proxy counted them.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { mulberry32, startProxy, type Link } from "./proxy";

const SERVER_PORT = 2621;
const VITE_PORT = 5191;
const PROXY_BASE = 2630;
const SETTLE_MS = 2500;
// Small on purpose: these sandboxes render WebGL in software (SwiftShader), and at 960 x 600 two
// pages draw at 11 fps, which starves the input timer and the socket and makes the netcode look
// worse than it is. At 320 x 200 both hold about 58 fps. The lab measures the network, not the GPU.
const LAB_VIEWPORT = { width: 320, height: 200 };
const HOLD_MOVED_M = 0.25;

interface Condition extends Link {
  name: string;
}

const CONDITIONS: Condition[] = [
  { name: "0 ms", oneWayMs: 0, jitterMs: 0, loss: 0 },
  { name: "50 ms", oneWayMs: 50, jitterMs: 0, loss: 0 },
  { name: "150 ms", oneWayMs: 150, jitterMs: 0, loss: 0 },
  { name: "50 ms +-20, 2% loss", oneWayMs: 50, jitterMs: 20, loss: 0.02 }
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
const LEVEL = argOf("--level") ?? "field";
const WARMUP_S = Number(argOf("--warmup") ?? 10);

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

function boot(): { server: ChildProcess | null; vite: ChildProcess | null } {
  const server = REMOTE_SERVER
    ? null
    : spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
        cwd: `${root}server`,
        env: { ...process.env, PORT: String(SERVER_PORT) },
        stdio: "ignore"
      });
  const vite = REMOTE_CLIENT
    ? null
    : spawn("npx", ["vite", "--port", String(VITE_PORT), "--strictPort", "--host", "127.0.0.1"], {
        cwd: `${root}client`,
        stdio: "ignore",
        detached: true,
        shell: process.platform === "win32"
      });
  return { server, vite };
}

async function launch(): Promise<Browser> {
  const opts = {
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]
  };
  try {
    return await chromium.launch(opts);
  } catch {
    return await chromium.launch({ ...opts, executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  }
}

/** Starts an in-page recorder: one sample per animation frame, wall-clock stamped so pages line up. */
async function record(page: Page, watchId: string | null) {
  // A string, not a function: tsx's keepNames would inject a __name helper the page lacks.
  await page.evaluate(`(() => {
    const id = ${JSON.stringify(watchId)};
    window.__lab = [];
    const tick = () => {
      const hg = window.__hg;
      if (hg) {
        if (id === null) window.__lab.push([Date.now(), hg.me.x, hg.me.z, hg.me.hp, hg.snaps]);
        else {
          const p = hg.players[id] && hg.players[id].pose;
          if (p) window.__lab.push([Date.now(), p.x, p.z]);
        }
      }
      if (window.__labOn !== false) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
}

const corrections = async (page: Page) => {
  const m = /(\d+) corrections/.exec((await page.locator("#hud").textContent()) ?? "");
  return m ? Number(m[1]) : NaN;
};

interface Row {
  level: string;
  condition: string;
  /** "local" or the hosted server's URL. */
  target: string;
  latency: number;
  jitter: number;
  loss: number;
  seconds: number;
  corrections: number;
  corrections_per_min: number;
  snaps: number;
  respawn_snaps: number;
  holds_per_min: number;
  view_lag_ms: number;
  view_gap_m: number;
  rtt: number;
  downs: number;
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
  for (const [n, p] of [["Alpha", a], ["Bravo", b]] as const) p.on("pageerror", (e) => errors.push(`${n}: ${e.message}`));
  try {
    const q = `server=${REMOTE_SERVER || `ws://127.0.0.1:${port}`}&level=${LEVEL}`;
    await a.goto(`${CLIENT_BASE}/?${q}&name=Alpha`);
    await b.goto(`${CLIENT_BASE}/?${q}&name=Bravo`);
    for (const p of [a, b]) await p.locator("#hud-party[data-players='2']").waitFor({ timeout: 20000 });
    await sleep(SETTLE_MS);
    const alphaId: string = await a.evaluate(() => (window as any).__hg.sessionId);
    const corr0 = await corrections(a);
    const snaps0: number = await a.evaluate(() => (window as any).__hg.snaps);
    await record(a, null);
    await record(b, alphaId);

    // Alpha's schedule: seeded, so every condition and every day plays the same game.
    const rng = mulberry32(7);
    const home = await a.evaluate(() => ({ x: (window as any).__hg.me.x, z: (window as any).__hg.me.z }));
    const end = Date.now() + seconds * 1000;
    let downs = 0;
    let wasDown = false;
    const held = new Set<string>();
    const setKeys = async (p: Page, want: string[], have: Set<string>) => {
      for (const k of [...have]) if (!want.includes(k)) (await p.keyboard.up(k), have.delete(k));
      for (const k of want) if (!have.has(k)) (await p.keyboard.down(k), have.add(k));
    };
    const bHeld = new Set<string>();
    while (Date.now() < end) {
      const me = await a.evaluate(() => (window as any).__hg.me);
      const down = me.hp <= 0;
      if (down && !wasDown) downs++;
      wasDown = down;
      // Wander, but lean home when far so Alpha stays in the goblin's yard.
      const far = Math.hypot(me.x - home.x, me.z - home.z) > 7;
      const keys: string[] = [];
      if (far) {
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
      await setKeys(a, keys, held);
      const act = rng();
      if (act < 0.25) await a.keyboard.press("KeyJ");
      else if (act < 0.32) await a.keyboard.press("KeyK");
      else if (act < 0.36) await a.keyboard.press("Digit1");

      // Bravo walks to a downed Alpha (a proximity pickup) and otherwise stands still.
      if (down) {
        const bv = await b.evaluate((id) => ({ me: (window as any).__hg.me, al: (window as any).__hg.players[id]?.pose }), alphaId);
        const want: string[] = [];
        if (bv.al) {
          if (bv.al.x - bv.me.x > 0.8) want.push("KeyD");
          else if (bv.al.x - bv.me.x < -0.8) want.push("KeyA");
          if (bv.al.z - bv.me.z > 0.8) want.push("KeyS");
          else if (bv.al.z - bv.me.z < -0.8) want.push("KeyW");
        }
        await setKeys(b, want, bHeld);
      } else await setKeys(b, [], bHeld);
      await sleep(250 + rng() * 650);
    }
    await setKeys(a, [], held);
    await setKeys(b, [], bHeld);

    const corr1 = await corrections(a);
    const snaps1: number = await a.evaluate(() => (window as any).__hg.snaps);
    const rtt: number = await a.evaluate(() => (window as any).__hg.rtt);
    const fps = (track: number[][]) =>
      track.length > 1 ? Math.round(((track.length - 1) / ((track[track.length - 1][0] - track[0][0]) / 1000)) * 10) / 10 : 0;
    const trueTrack: number[][] = await a.evaluate(() => ((window as any).__labOn = false, (window as any).__lab));
    const seen: number[][] = await b.evaluate(() => ((window as any).__labOn = false, (window as any).__lab));

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
    // Holds: Bravo's Alpha frozen for 4+ frames while the real Alpha, shifted by that lag, moved
    // over HOLD_MOVED_M. Inputs go out at 20 Hz, so a start or stop lands up to a tick off the
    // average lag; 0.25 m is 40 ms at full speed, past that quantisation.
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
    // A respawn or a wipe moves the player on the server, so the client counts a snap that no
    // network caused. Split those out: a snap within 500 ms of Alpha's hp coming back from 0.
    let respawnSnaps = 0;
    for (let i = 1; i < trueTrack.length; i++) {
      if (trueTrack[i][4] <= trueTrack[i - 1][4]) continue;
      const t = trueTrack[i][0];
      const back = trueTrack.some((r, j) => j > 0 && trueTrack[j - 1][3] <= 0 && r[3] > 0 && Math.abs(r[0] - t) < 500);
      if (back) respawnSnaps += trueTrack[i][4] - trueTrack[i - 1][4];
    }
    const minutes = seconds / 60;
    const corr = corr1 - corr0;
    const snaps = snaps1 - snaps0 - respawnSnaps;
    const cpm = corr / minutes;
    const verdict = snaps > 0 ? "snaps" : cpm > 30 || holds / minutes > 20 ? "rough" : "ok";
    return {
      condition: c.name,
      level: LEVEL,
      target: REMOTE_SERVER || "local",
      latency: c.oneWayMs,
      jitter: c.jitterMs,
      loss: c.loss,
      seconds,
      corrections: corr,
      corrections_per_min: Math.round(cpm * 10) / 10,
      snaps,
      respawn_snaps: respawnSnaps,
      holds_per_min: Math.round((holds / minutes) * 10) / 10,
      view_lag_ms: viewLag,
      view_gap_m: Math.round(bestGap * 100) / 100,
      rtt: Math.round(rtt),
      downs,
      fps_a: fps(trueTrack),
      fps_b: fps(seen),
      lost_chunks: proxy ? proxy.lost() : 0,
      page_errors: errors,
      verdict
    };
  } finally {
    await ctxA.close();
    await ctxB.close();
    await proxy?.close();
    await sleep(800); // let the empty room dispose so the next condition gets a fresh goblin
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
    const conditions: Condition[] = REMOTE_SERVER
      ? [{ name: `remote ${new URL(REMOTE_SERVER).host}`, oneWayMs: 0, jitterMs: 0, loss: 0 }]
      : CONDITIONS;
    // A fresh VM's first condition ran slow once (19 holds a minute at 0 ms that never came back:
    // JIT, Vite's first transform, SwiftShader's shader cache), so a short clean run goes first and
    // is thrown away. Local only: a hosted run's wake-up is already behind the health wait.
    if (!REMOTE_SERVER && WARMUP_S > 0) {
      const w = await runCondition(ba, bb, { name: "warm-up", oneWayMs: 0, jitterMs: 0, loss: 0 }, PROXY_BASE + 9, WARMUP_S);
      console.log(`warm-up (${WARMUP_S} s, discarded): corr/min ${w.corrections_per_min}, holds/min ${w.holds_per_min}, fps ${w.fps_a}/${w.fps_b}`);
    }
    for (const c of conditions) {
      if (ONLY && !c.name.startsWith(ONLY)) continue;
      const row = await runCondition(ba, bb, c, PROXY_BASE + i++);
      rows.push(row);
      console.log(
        `${row.condition.padEnd(22)} corr/min ${String(row.corrections_per_min).padStart(6)}  snaps ${row.snaps} (+${row.respawn_snaps} respawn)  holds/min ${row.holds_per_min}  view lag ${row.view_lag_ms} ms (gap ${row.view_gap_m} m)  rtt ${row.rtt} ms  downs ${row.downs}  fps ${row.fps_a}/${row.fps_b}  lost ${row.lost_chunks}  errors ${row.page_errors.length}  -> ${row.verdict}`
      );
    }
    mkdirSync(`${root}tests/tmp`, { recursive: true });
    writeFileSync(`${root}tests/tmp/lab-result.json`, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  } finally {
    await ba?.close();
    await bb?.close();
    procs.server?.kill();
    if (procs.vite) {
      try {
        process.kill(-procs.vite.pid!, "SIGTERM");
      } catch {
        procs.vite.kill();
      }
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
