import { expect, test } from "@playwright/test";

/**
 * Hit feedback: walk to the goblin, trade blows, and check that hits nudge the camera
 * and that the sound path runs without errors. Reads the window.__hg debug handle.
 */
test("hits nudge the camera and play without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?name=Feel&level=yard"); // the yard's first goblin stands at (9, -9)
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });

  // The goblin spawns at (9, -9): head right and up-screen until it aggroes.
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");

  // Swing until hits land; if we miss, the goblin's own hits on us count too.
  await expect
    .poll(
      async () => {
        await page.keyboard.press("KeyJ");
        return page.evaluate(() => (window as any).__hg.myHits);
      },
      { timeout: 20_000, intervals: [300] }
    )
    .toBeGreaterThan(0);

  // Every hit you land or take nudges once; friends' hits only play the quieter sound.
  const { myHits, nudges } = await page.evaluate(() => (window as any).__hg);
  expect(nudges).toBe(myHits);
  expect(errors).toEqual([]);
});
