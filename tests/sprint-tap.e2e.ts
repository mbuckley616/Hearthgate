import { expect, test } from "@playwright/test";

/**
 * A double tap of W starts sprint on a slow page (the critic, 16 Nov). The page is held to about 3 fps by a
 * busy loop each frame, and the keys go in through CDP with the times a keyboard would stamp them, all at
 * once, so the browser queues them behind a frame as a real slow page does. Playwright's own keyboard waits
 * for each key to be handled, a frame apiece, which is not how a player's fingers arrive.
 */
test("two W taps start sprint on a 3 fps page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?play");
  await page.waitForFunction(() => (window as any).game?.session?.playing, null, { timeout: 30_000 });
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const f = () => {
      const t = performance.now();
      while (performance.now() - t < 180) {}
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const key = (type: string, ts: number) =>
    cdp.send("Input.dispatchKeyEvent", { type, code: "KeyW", key: "w", windowsVirtualKeyCode: 87, timestamp: ts, ...(type === "keyDown" ? { text: "w" } : {}) });
  const results: Record<number, boolean> = {};
  for (const gap of [0, 40, 80, 150, 250, 450]) {
    await page.evaluate(() => (window as any).game.kbm.sprint.reset());
    const t0 = Date.now() / 1000;
    await Promise.all([key("keyDown", t0), key("keyUp", t0 + 0.03), key("keyDown", t0 + 0.03 + gap / 1000)]);
    await page.waitForTimeout(600);
    results[gap] = await page.evaluate(() => (window as any).game.kbm.sprint.on);
    await key("keyUp", Date.now() / 1000);
    await page.waitForTimeout(700);
  }
  expect(results).toEqual({ 0: true, 40: true, 80: true, 150: true, 250: true, 450: false });
});
