import { expect, test } from "@playwright/test";

/**
 * Two browsers join the same room; one moves and the other sees it.
 * Reads the window.__hg debug handle that client/src/main.ts exposes.
 */
test("two players see each other move", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  // The open field: this checks two players seeing each other, not the village, whose four
  // skinned villagers make a headless software-GL frame slow enough to drop input ticks.
  await a.goto("/?name=Alpha&level=field");
  await b.goto("/?name=Bravo&level=field");

  await expect(a.locator("#hud-party")).toHaveAttribute("data-players", "2", { timeout: 15_000 });
  await expect(b.locator("#hud-party")).toHaveAttribute("data-players", "2", { timeout: 15_000 });

  const alphaId = await a.evaluate(() => (window as any).__hg.sessionId);
  const startX = await a.evaluate(() => (window as any).__hg.me.x);

  await a.keyboard.down("KeyD");
  await a.waitForTimeout(700);
  await a.keyboard.up("KeyD");
  await a.waitForTimeout(300);

  const endX = await a.evaluate(() => (window as any).__hg.me.x);
  expect(endX - startX).toBeGreaterThan(2);

  await expect
    .poll(async () => b.evaluate((id) => (window as any).__hg.players[id]?.pose?.x ?? -999, alphaId), {
      timeout: 5_000
    })
    .toBeGreaterThan(startX + 2);

  await a.keyboard.press("KeyJ");
  await a.waitForTimeout(600);
  const rtt = await a.evaluate(() => (window as any).__hg.rtt);
  expect(rtt).toBeGreaterThanOrEqual(0);

  await ctxA.close();
  await ctxB.close();
});
