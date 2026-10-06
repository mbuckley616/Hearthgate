import { expect, test } from "@playwright/test";

/**
 * The combo callout (Michael, A, 2026-10-05): Cleave (1) staggers the cellar's goblin, Execute (2)
 * consumes it, and the client draws the callout over the enemy and logs it. Alone it is a solo crit
 * ("Critical"); the two-player "Combo x1.5" over the wire is `npm run test:net`'s combo step.
 */
test("Cleave then Execute shows the callout over the goblin", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Combo&level=cellar"); // the goblin at (7, -7) wakes at once and comes
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });

  const state = () =>
    page.evaluate(() => {
      const h = (window as any).__hg;
      const e = Object.values(h.enemies as Record<string, { pose: { x: number; z: number } }>)[0];
      return { d: e ? Math.hypot(e.pose.x - h.me.x, e.pose.z - h.me.z) : 99, callouts: h.callouts as number, last: h.lastCallout as string };
    });

  // Turn to the goblin (up-screen and right, where it comes from), then 1, then 2 a beat later.
  await expect
    .poll(
      async () => {
        if (process.env.COMBO_SHOT) await page.screenshot({ path: process.env.COMBO_SHOT });
  const s = await state();
        if (s.callouts > 0) return s.callouts;
        if (s.d > 2.2) {
          // Spawned just past its aggro range: walk at it (up-screen and right) until it is close.
          await page.keyboard.down("KeyW");
          await page.keyboard.down("KeyD");
          await page.waitForTimeout(200);
          await page.keyboard.up("KeyW");
          await page.keyboard.up("KeyD");
          return s.callouts;
        }
        await page.keyboard.down("KeyW");
        await page.keyboard.down("KeyD");
        await page.waitForTimeout(60);
        await page.keyboard.up("KeyW");
        await page.keyboard.up("KeyD");
        await page.keyboard.press("Digit1");
        await page.waitForTimeout(700);
        await page.keyboard.press("Digit2");
        await page.waitForTimeout(600);
        return (await state()).callouts;
      },
      { timeout: 30_000, intervals: [200] }
    )
    .toBeGreaterThan(0);

  if (process.env.COMBO_SHOT) await page.screenshot({ path: process.env.COMBO_SHOT });
  const s = await state();
  expect(s.last).toBe("Critical");
  await expect(page.locator("#hud-log")).toContainText("Critical: the goblin knocked down");
  await expect(page.locator(".hud-slot[data-slot='2'] .hud-slot-name")).toHaveText("Execute");
  expect(errors).toEqual([]);
});
