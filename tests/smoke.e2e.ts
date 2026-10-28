import { chromium, expect, test, type Page } from "@playwright/test";

/**
 * The browser smoke test: the combat slice's client against Hearthgate's server. Solo and two players
 * in a village (T3), walking through the antechamber gate to start a run (`?dungeon` makes a run
 * straight away), and the village's round trip: talk to the keeper, take the ring onto a generated
 * floor (T4), walk it to the rest room (the dev server's cheats clear the rooms that shut on the way)
 * and take the rest room's gold ring home. `?play` skips the title screen as a join link does; the
 * slice's `window.game` handle reads the state. The dungeon editor (T4b) is built by keys alone and played,
 * and Keeper Wren turns the village's ring to a hand-built dungeon.
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

test("the village: talk to the keeper, take the ring onto a generated floor, walk it, and the rest room's ring home", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await open(page, "play", errors);
  const home = (await seen(page)).code;

  // Keeper Wren stands by the shrine; F in reach shows her line. Round the well first: it stands on the way.
  await walkTo(page, 3.2, 2, 1.2);
  await walkTo(page, 2.6, -11.6, 1.6);
  await page.keyboard.press("KeyF");
  await expect(page.locator(".talk-box")).toBeVisible();
  await expect(page.locator(".talk-name")).toHaveText("Keeper Wren");

  // Small floors from one seed (the dev server takes the panel's edits), so the walk is short.
  await tune(page, { "dungeon.pieces": 10, "dungeon.seed": 4242 });
  try {
    // Into the ring and hold still: two seconds later the party is handed onto a generated floor.
    await walkTo(page, 0, -10.5, 0.8);
    await expect.poll(async () => (await seen(page)).kind, { timeout: 10_000 }).toBe("floor");
    const run = await seen(page);
    expect(run.code).not.toBe(home);
    await expect(page.locator(".minimap")).toBeVisible();

    // Along the doorways to the rest room; a room that shuts on the way is cleared by the cheats.
    await steer(page, "exit");
    await expect.poll(async () => page.evaluate(() => (window as unknown as { game: any }).game.session.portals.map((p: any) => p.to).join(",")), { timeout: 5_000 }).toBe("deeper,village");
    await steer(page, "home");
    await expect.poll(async () => (await seen(page)).kind, { timeout: 10_000 }).toBe("village");
    const back = await seen(page);
    expect(back.code).toBe(home);
    expect(back.stats.snaps).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await tune(page, { "dungeon.pieces": 0, "dungeon.seed": 0 });
  }
});

test("the dungeon editor: a dungeon of two floors laid out by keys alone, saved and played", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/editor.html");
  await page.evaluate(() => localStorage.removeItem("hearthgate.editor.draft"));
  await page.reload();
  const status = page.locator(".editor-status");
  // A new draft is an entrance alone, the cursor on the cell north of it, a hall chosen.
  await expect(status).toContainText("rest room");
  await page.keyboard.press("Space");
  // Three steps back through the palette is the rest room; its one doorway is in the middle of its south side.
  for (const key of ["KeyQ", "KeyQ", "KeyQ", "ArrowLeft", "ArrowUp", "ArrowUp", "ArrowUp", "Space"]) await page.keyboard.press(key);
  await expect(status).toContainText("Ready to play: 1 floor, 3 pieces");
  // A second floor (N): an entrance alone, the Warden's hall north of it ends the run.
  await page.keyboard.press("KeyN");
  await expect(page.locator(".editor-tab")).toHaveCount(2);
  await expect(status).toContainText("Floor 2 of 2");
  for (const key of ["KeyE", "ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "Space"]) await page.keyboard.press(key);
  await expect(status).toContainText("Ready to play: 2 floors, 5 pieces");
  // [ goes back to the first floor and ] forward again.
  await page.keyboard.press("BracketLeft");
  await expect(status).toContainText("Floor 1 of 2");
  await page.keyboard.press("BracketRight");
  await page.locator(".editor-name").fill("Keys Only");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+KeyS");
  await expect(page.locator(".editor-saved")).toContainText("Keys Only");
  await page.keyboard.press("KeyP");
  await page.waitForURL(/hand=Keys%20Only/);
  await expect.poll(async () => (await seen(page)).kind, { timeout: 20_000 }).toBe("floor");
  // Play starts on the floor being edited: the second, the Warden's.
  const spec = await page.evaluate(() => (window as unknown as { game: any }).game.session.world.level.dungeon.def.spec);
  expect(spec.hand.name).toBe("Keys Only");
  expect([spec.floor, spec.floors]).toEqual([2, 2]);
  expect(spec.hand.pieces).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("Keeper Wren turns the village's ring to a hand-built dungeon", async ({ page }) => {
  const errors: string[] = [];
  await open(page, "play", errors);
  await walkTo(page, 3.2, 2, 1.2);
  await walkTo(page, 3.0, -12.2, 0.8);
  // Asked once she says where it opens; asked again she turns it to the next (the first hand-built one ships with the game).
  await page.keyboard.press("KeyF");
  await expect(page.locator(".talk-line")).toContainText("a new dungeon");
  await page.keyboard.press("KeyF");
  await expect(page.locator(".talk-line")).toContainText("The Old Cellar");
  await expect.poll(async () => page.evaluate(() => (window as unknown as { game: any }).game.session.portals[0]?.label), { timeout: 3_000 }).toBe("The Old Cellar");
  await walkTo(page, 0, -10.5, 0.8);
  await expect.poll(async () => (await seen(page)).kind, { timeout: 10_000 }).toBe("floor");
  const hand = await page.evaluate(() => (window as unknown as { game: any }).game.session.world.level.dungeon.def.spec.hand?.name);
  expect(hand).toBe("The Old Cellar");
  expect(errors).toEqual([]);
});

test("the bag and the body: wear a bow from the bag by keys alone, and 1 is an ability, not a swap", async ({ page }) => {
  const errors: string[] = [];
  await page.goto("/?play");
  await page.evaluate(() => localStorage.clear());
  await open(page, "play", errors);
  const style = () => page.evaluate(() => (window as unknown as { game: any }).game.me()?.style as string);
  await expect.poll(style).toBe("sword");
  await page.keyboard.press("KeyI");
  await expect(page.locator(".gear-grid")).toBeVisible();
  // A new hero carries a shortbow and a staff in the bag; from the head, D goes across to its first space.
  // Held, as a player holds it: a slow headless frame can miss a tap shorter than itself.
  const detail = page.locator(".gear-detail .item-name");
  await holdUntil(page, "KeyD", async () => (await detail.count()) > 0 && (await detail.textContent()) === "Ash shortbow", 5_000);
  await page.keyboard.press("KeyF");
  await expect.poll(style).toBe("bow");
  // The hero is drawn in what they wear (T5c): the server has the look, and the view holds the ash bow.
  const drawn = () =>
    page.evaluate(() => {
      const g = (window as unknown as { game: any }).game;
      return { look: (g.me()?.look ?? []).join(), dressed: !!g.hero.dressed, bow: g.hero.bow.group.visible, sword: g.hero.sword.visible };
    });
  await expect.poll(drawn).toEqual({ look: "ash-shortbow", dressed: true, bow: true, sword: false });
  await page.keyboard.press("KeyI");
  // 1 is an ability now (C3): it no longer takes the sword back mid-outing.
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(500);
  expect(await style()).toBe("bow");
  expect(errors).toEqual([]);
});

/** Debug-panel edits through the server (a dev build takes them). */
async function tune(page: Page, edits: Record<string, number>) {
  await page.evaluate((e) => {
    const g = (window as unknown as { game: any }).game;
    for (const [path, value] of Object.entries(e)) g.session.request({ k: "tune", edit: { path, value } });
  }, edits);
}

/**
 * Walk the hero on a generated floor: to its exit along the doorways ("exit"), or onto the open ring
 * home ("home"). Steering goes through the game's own commands (each frame's move points at the next
 * waypoint), so prediction, the server and the views all run as they do for a player.
 */
async function steer(page: Page, to: "exit" | "home") {
  await page.evaluate((dest) => {
    const g = (window as unknown as { game: any }).game;
    const w = window as unknown as { route: { x: number; z: number }[]; wp: number; orig?: (a: unknown) => any };
    const L = g.session.world.level.dungeon;
    const P = L.def.pieces;
    const me = g.session.hero().curr;
    if (dest === "home") {
      const ring = g.session.portals.find((p: any) => p.to === "village");
      w.route = [{ x: ring.x, z: ring.z }];
    } else {
      const from = L.pieces.find((p: any) => me.x >= p.bounds.minX && me.x < p.bounds.maxX && me.z >= p.bounds.minZ && me.z < p.bounds.maxZ).id;
      const prev = new Map<number, number>([[from, -1]]);
      const queue = [from];
      while (queue.length) {
        const at = queue.shift()!;
        for (const sk of P[at].sockets) if (sk.link >= 0 && !prev.has(sk.link)) prev.set(sk.link, at), queue.push(sk.link);
      }
      const chain: number[] = [];
      for (let at = L.def.exit; at !== -1; at = prev.get(at)!) chain.unshift(at);
      const D: Record<string, number[]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
      w.route = [];
      chain.forEach((id, i) => {
        const info = L.pieces[id];
        // The middle of each piece on the way, or the open spot nearest it when a pillar or a fire stands there.
        const c = { x: (info.inner.minX + info.inner.maxX) / 2, z: (info.inner.minZ + info.inner.maxZ) / 2 };
        const blocked = [...info.pillars, ...info.braziers.map((b: any) => ({ ...b, radius: 0.45 }))].some((o: any) => Math.hypot(o.x - c.x, o.z - c.z) < o.radius + 1.2);
        const mid = blocked ? [...info.spots].sort((p: any, q: any) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0] : c;
        if (i > 0) w.route.push(mid);
        const next = chain[i + 1];
        if (next === undefined) return;
        const door = info.doors[P[id].sockets.findIndex((sk: any) => sk.link === next)];
        const d = D[door.side];
        w.route.push({ x: door.x - d[0] * 1.2, z: door.z - d[1] * 1.2 }, { x: door.x + d[0] * 1.8, z: door.z + d[1] * 1.8 });
      });
    }
    w.wp = 0;
    if (!w.orig) {
      w.orig = g.buildCommand.bind(g);
      g.buildCommand = (a: unknown) => {
        const c = w.orig!(a);
        const p = g.session.hero()?.curr;
        const t = w.route[w.wp];
        if (!p || !t) return c;
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.7) {
          w.wp++;
          return c;
        }
        return { ...c, moveX: dx / dist, moveZ: dz / dist };
      };
    }
  }, to);
  const start = Date.now();
  for (;;) {
    const state = await page.evaluate(() => {
      const w = window as unknown as { route: unknown[]; wp: number; game: any };
      return { done: w.wp >= w.route.length, phase: JSON.parse(w.game.snapshot()).run.phase as string, kind: w.game.session.kind as string };
    });
    if (state.done || state.kind !== "floor") return;
    if (state.phase === "wave") await page.evaluate(() => (window as unknown as { game: any }).game.session.request({ k: "cheat", cheat: "killAll" }));
    if (Date.now() - start > 90_000) throw new Error(`never reached the ${to}`);
    await page.waitForTimeout(250);
  }
}
