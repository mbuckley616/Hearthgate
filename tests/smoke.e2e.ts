import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * The browser smoke test: the combat slice's client against Hearthgate's server. Solo and two players
 * in a village (T3), walking through the antechamber gate to start a run (`?dungeon` makes a run
 * straight away), and the village's round trip: talk to the keeper, take the ring into a run, finish
 * it (the dev server's cheats) and take the antechamber's ring home. `?play` skips the title screen
 * as a join link does; the slice's `window.game` handle reads the state.
 *
 * Each player gets a browser of their own: headless Chromium throttles a second page's timers,
 * which starves its frames and inputs (the lesson of the old two-players test).
 */

interface Seen {
  id: string;
  code: string;
  kind: string;
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
      kind: session.kind,
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

/** Face the camera at (x, z) and hold W until the hero is within `tol` of it: W walks where the camera looks. */
async function walkTo(page: Page, x: number, z: number, tol = 1.2) {
  const near = async () => {
    const s = await seen(page);
    const p = mine(s);
    await page.evaluate(([tx, tz, px, pz]) => {
      (window as unknown as { game: any }).game.cam.yaw = Math.atan2(-(tx - px), -(tz - pz));
    }, [x, z, p.x, p.z]);
    return Math.hypot(p.x - x, p.z - z) <= tol;
  };
  await holdUntil(page, "KeyW", near, 25_000);
}

test("solo: a village of our own on the server, the scene drawn, and the hero runs", async ({ page }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  const s0 = await seen(page);
  expect(s0.code).toMatch(/^[A-Z2-9]{4}$/);
  expect(s0.kind).toBe("village");
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
  await open(page, "play&dungeon", errors);
  expect((await seen(page)).kind).toBe("arena");
  // The camera starts behind the hero, facing the arena: W walks through the antechamber's gate.
  await holdUntil(page, "KeyW", async () => (await seen(page)).phase !== "ante", 20_000);
  await expect.poll(async () => (await seen(page)).phase, { timeout: 10_000 }).toMatch(/intro|wave/);
  await expect.poll(async () => (await seen(page)).enemies, { timeout: 15_000 }).toBeGreaterThan(0);
  const s = await seen(page);
  expect(s.wave).toBe(1);
  expect(s.stats.snaps).toBe(0);
  expect(errors).toEqual([]);
});

test("the village: talk to the keeper, take the ring into a run, and the antechamber's ring home", async ({ page }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  const home = (await seen(page)).code;

  // Keeper Wren stands by the shrine; F in reach shows her line. Round the well first: it stands on the way.
  await walkTo(page, 3.2, 2, 1.2);
  await walkTo(page, 2.6, -11.6, 1.6);
  await page.keyboard.press("KeyF");
  await expect(page.locator(".talk-box")).toBeVisible();
  await expect(page.locator(".talk-name")).toHaveText("Keeper Wren");

  // Into the ring and hold still: two seconds later the party is handed to a run.
  await walkTo(page, 0, -10.5, 0.8);
  await expect.poll(async () => (await seen(page)).kind, { timeout: 10_000 }).toBe("arena");
  const run = await seen(page);
  expect(run.code).not.toBe(home);
  await expect.poll(async () => (await seen(page)).players.length).toBe(1);

  // Finish it (the dev server's cheats), then the ring that opens in the antechamber, where we stand, takes us home.
  await page.evaluate(() => (window as unknown as { game: any }).game.session.request({ k: "cheat", cheat: "warden" }));
  await expect.poll(async () => (await seen(page)).wave, { timeout: 5_000 }).toBe(4);
  await page.evaluate(() => (window as unknown as { game: any }).game.session.request({ k: "cheat", cheat: "killAll" }));
  await expect.poll(async () => (await seen(page)).phase, { timeout: 8_000 }).toBe("won");
  await walkTo(page, 0, 19.4, 0.8);
  await expect.poll(async () => (await seen(page)).kind, { timeout: 10_000 }).toBe("village");
  const back = await seen(page);
  expect(back.code).toBe(home);
  expect(back.stats.snaps).toBe(0);
  expect(errors).toEqual([]);
});
