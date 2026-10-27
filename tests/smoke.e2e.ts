import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * The browser smoke test for T1: the combat slice's client against Hearthgate's server. Solo, two
 * players in one fight, and walking through the antechamber gate to start the run. `?play` skips
 * the title screen as a join link does; the slice's `window.game` handle reads the state.
 *
 * Each player gets a browser of their own: headless Chromium throttles a second page's timers,
 * which starves its frames and inputs (the lesson of the old two-players test).
 */

interface Seen {
  id: string;
  code: string;
  playing: boolean;
  snaps: number;
  players: { id: string; x: number; z: number; mode: string }[];
  phase: string;
  wave: number;
  enemies: number;
  stats: { snapshots: number; corrections: number; snaps: number; maxCorrection: number };
}

async function seen(page: Page): Promise<Seen> {
  return page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    const s = JSON.parse(g.snapshot());
    const session = g.session;
    return {
      id: session.localId,
      code: session.code,
      playing: session.playing,
      snaps: session.stats.snapshots,
      players: s.players.map((p: any) => ({ id: p.id, x: p.x, z: p.z, mode: p.mode })),
      phase: s.run.phase,
      wave: s.run.wave,
      enemies: s.enemies.filter((e: any) => e.ai !== "dead").length,
      stats: { ...session.stats },
    };
  });
}

/** The page's own hero as the server last had it. */
const mine = (s: Seen) => s.players.find((p) => p.id === s.id)!;

async function open(page: Page, query: string, errors: string[]) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?${query}`);
  await expect.poll(async () => (await seen(page)).playing, { timeout: 20_000 }).toBe(true);
}

/** Hold a key until `done` says so (polled), then let go: a slow headless frame rate must not decide the distance. */
async function holdUntil(page: Page, key: string, done: () => Promise<boolean>, timeoutMs = 15_000) {
  await page.keyboard.down(key);
  const start = Date.now();
  try {
    while (!(await done())) {
      if (Date.now() - start > timeoutMs) throw new Error(`held ${key} for ${timeoutMs} ms`);
      await page.waitForTimeout(50);
    }
  } finally {
    await page.keyboard.up(key);
  }
}

test("solo: a fight of our own on the server, the scene drawn, and the hero runs", async ({ page }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  const s0 = await seen(page);
  expect(s0.code).toMatch(/^[A-Z2-9]{4}$/);
  expect(s0.players.map((p) => p.id)).toEqual(["p1"]);
  expect(s0.phase).toBe("ante");

  // The slice's look drew something: a frame of one flat colour compresses to almost nothing as a PNG.
  // (The WebGL canvas keeps no drawing buffer to read pixels back from, so the screenshot measures it.)
  const shot = await page.screenshot();
  expect(shot.length).toBeGreaterThan(30_000);

  const start = mine(s0);
  await holdUntil(page, "KeyD", async () => {
    const p = mine(await seen(page));
    return Math.hypot(p.x - start.x, p.z - start.z) > 3;
  });
  // Let the last inputs land; standing still, prediction and server agree.
  await page.waitForTimeout(800);
  const s1 = await seen(page);
  expect(s1.stats.snaps).toBe(0);
  expect(errors).toEqual([]);
});

test("two players: a friend joins by the code, and each sees the other move", async ({ page, baseURL }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  const code = (await seen(page)).code;

  const other = await chromium.launch(test.info().project.use.launchOptions);
  try {
    const page2 = await (await other.newContext({ baseURL })).newPage();
    await open(page2, `join=${code}`, errors);
    const b0 = await seen(page2);
    expect(b0.id).toBe("p2");
    expect(b0.code).toBe(code);
    await expect.poll(async () => (await seen(page)).players.length).toBe(2);

    // Alpha runs; Bravo's drawn world (the server's snapshots) shows it.
    const a0 = mine(await seen(page));
    await holdUntil(page, "KeyA", async () => {
      const p = mine(await seen(page));
      return Math.hypot(p.x - a0.x, p.z - a0.z) > 3;
    });
    await expect
      .poll(async () => {
        const p1 = (await seen(page2)).players.find((p) => p.id === "p1")!;
        return Math.hypot(p1.x - a0.x, p1.z - a0.z);
      })
      .toBeGreaterThan(2.5);
    expect((await seen(page2)).stats.snaps).toBe(0);
  } finally {
    await other.close();
  }
  expect(errors).toEqual([]);
});

test("the run's gate: walking through it starts the run and wave 1 comes", async ({ page }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  // The camera starts behind the hero, facing the arena: W walks through the antechamber's gate.
  await holdUntil(page, "KeyW", async () => (await seen(page)).phase !== "ante", 20_000);
  await expect.poll(async () => (await seen(page)).phase, { timeout: 10_000 }).toMatch(/intro|wave/);
  await expect.poll(async () => (await seen(page)).enemies, { timeout: 15_000 }).toBeGreaterThan(0);
  const s = await seen(page);
  expect(s.wave).toBe(1);
  expect(s.stats.snaps).toBe(0);
  expect(errors).toEqual([]);
});
