import { expect, test, type Page } from "@playwright/test";

/**
 * The village greybox (Michael, B, 2026-10-05): a real browser joins the village first, talks
 * to the keeper with E, stands on the portal and is handed to a Warrens room without a reload.
 * Reads the window.__hg debug handle that client/src/main.ts exposes.
 */

const hg = (page: Page) => page.evaluate(() => (window as any).__hg);

/** Hold the move keys that take us toward (x, z) until we are within `reach` of it; the camera holds yaw 0 out of combat. */
async function walkTo(page: Page, x: number, z: number, reach: number, timeoutMs = 25_000) {
  const held = new Set<string>();
  const set = async (want: string[]) => {
    for (const k of [...held]) if (!want.includes(k)) (await page.keyboard.up(k), held.delete(k));
    for (const k of want) if (!held.has(k)) (await page.keyboard.down(k), held.add(k));
  };
  const start = Date.now();
  let handoffs0 = -1;
  try {
    for (;;) {
      const { me, handoffs } = await page.evaluate(() => ({ me: (window as any).__hg.me as { x: number; z: number }, handoffs: (window as any).__hg.handoffs as number }));
      if (handoffs0 === -1) handoffs0 = handoffs;
      // Arrived, or the portal already took us: another room's coordinates mean nothing here.
      if (Math.hypot(me.x - x, me.z - z) <= reach || handoffs !== handoffs0) return;
      if (Date.now() - start > timeoutMs) throw new Error(`still ${Math.hypot(me.x - x, me.z - z).toFixed(1)} m from (${x}, ${z}) after ${timeoutMs} ms, at (${me.x.toFixed(2)}, ${me.z.toFixed(2)})`);
      const want: string[] = [];
      // W walks -z and S walks +z at yaw 0 (camera.ts); D walks +x.
      if (z - me.z > 0.3) want.push("KeyS");
      else if (z - me.z < -0.3) want.push("KeyW");
      if (x - me.x > 0.3) want.push("KeyD");
      else if (x - me.x < -0.3) want.push("KeyA");
      // Near the mark, taps: a key pressed and let go between two samples is one frame (input.ts),
      // 0.3 m, however the page's timer stalls. Held, a stalled page sends up to four frames at once
      // (1.2 m) and walks back and forth over a 0.8 m mark, long enough to stand on the portal.
      if (Math.hypot(me.x - x, me.z - z) < 2.5) {
        await set([]);
        for (const k of want) await page.keyboard.down(k);
        for (const k of want) await page.keyboard.up(k);
        await page.waitForTimeout(120);
        continue;
      }
      await set(want);
      await page.waitForTimeout(100);
    }
  } finally {
    await set([]);
  }
}

test("the village: a villager answers E, and the portal hands the party to the Warrens", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Villager");
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
  const start = await hg(page);
  expect(start.level).toBe("village");
  expect(start.room).toBe("village");
  expect(Object.keys(start.enemies)).toHaveLength(0);
  await expect(page.locator("#hud-enemy-label")).toContainText("village. Nothing here can hurt you");
  await expect(page.locator("#hud-talk")).toBeHidden();

  // Keeper Wren stands by the shrine door at (2.6, -11.4), past the portal: go round it, or a slow
  // headless walk across the dais counts as standing on it. The prompt is a 48 px button; E talks.
  // Come at the keeper from the east along the shrine's front: the portal's 2.5 m reaches within
  // 3.2 m of the keeper, so a stop on the near side of the keeper's talk range can be on the portal.
  await walkTo(page, 4.5, -5, 0.8);
  await walkTo(page, 4.5, -11.4, 0.8);
  await walkTo(page, 2.6, -11.4, 1.9);
  await expect.poll(() => page.evaluate(() => (window as any).__hg.talkTo), { timeout: 5_000 }).toBe("keeper");
  const talk = page.locator("#hud-talk");
  await expect(talk).toBeVisible();
  await expect(talk).toContainText("talk to Keeper Wren");
  const box = await talk.boundingBox();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(48);
  await page.keyboard.press("KeyE");
  await expect(page.locator("#hud-speech")).toContainText("Keeper Wren: The shrine's portal", { timeout: 5_000 });

  // The portal at (0, -9.5): stand on it alone for two seconds and the server moves us.
  // The label is checked while we walk: stepping onto the portal starts its two seconds.
  await Promise.all([
    walkTo(page, 0, -9.5, 0.8),
    expect(page.locator("#hud-enemy-label")).toContainText("Portal: everyone on it", { timeout: 10_000 })
  ]);
  await expect.poll(() => page.evaluate(() => (window as any).__hg.level), { timeout: 15_000 }).toBe("warrens");
  await expect.poll(() => page.evaluate(() => (window as any).__hg.tick), { timeout: 10_000 }).toBeGreaterThan(0);
  const after = await hg(page);
  expect(after.room).toBe("dungeon");
  expect(after.handoffs).toBe(1);
  expect(Object.keys(after.enemies)).toHaveLength(9);
  expect(after.snaps).toBe(0);
  await expect(page.locator("#hud-status")).toBeHidden();
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", "1");
  // Still in control after the move: a step moves us on the new server clock.
  const x0 = after.me.x;
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyD");
  await expect.poll(() => page.evaluate(() => (window as any).__hg.me.x), { timeout: 5_000 }).toBeGreaterThan(x0 + 0.5);
  expect(errors).toEqual([]);
});
