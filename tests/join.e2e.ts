import { expect, test, type Page } from "@playwright/test";

/**
 * The join screen (Michael, A, 2026-10-05): pick a weapon and a material with the keyboard
 * alone, every choice at least 48 px, and a scripted join (?name= or ?weapon=) skips it.
 */

async function weaponOf(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).__hg?.me?.weapon ?? null), { timeout: 15_000 }).not.toBeNull();
  return page.evaluate(() => (window as any).__hg.me.weapon as { type: string; tier: number });
}

test("keyboard alone picks an Iron Claymore and joins with it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const checked = page.locator('.join-row[data-row="0"] [aria-checked="true"]');
  await expect(checked).toBeVisible();
  for (let i = 0; i < 12 && (await checked.textContent()) !== "Claymore"; i++) await page.keyboard.press("ArrowRight");
  await expect(checked).toHaveText("Claymore");
  await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 12 && (await page.locator('.join-row[data-row="1"] [aria-checked="true"]').textContent()) !== "Iron"; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(page.locator(".join-detail")).toContainText("Iron Claymore, two-handed");
  await page.keyboard.press("Enter");
  await expect(page.locator(".join")).toHaveCount(0);
  const w = await weaponOf(page);
  expect(w.type).toBe("claymore");
  expect(w.tier).toBe(3);
  await expect(page.locator("#hud-weapon")).toContainText("Iron Claymore");
});

test("every choice is at least 48 px and the screen fits a 360 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(page.locator(".join-panel")).toBeVisible();
  const boxes = await page.locator(".join-choice, .join-go").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height, right: r.right };
    })
  );
  expect(boxes.length).toBe(11 + 10 + 1);
  for (const b of boxes) {
    expect(b.w).toBeGreaterThanOrEqual(48);
    expect(b.h).toBeGreaterThanOrEqual(48);
    expect(b.right).toBeLessThanOrEqual(360);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // Touch and pointer work too: tap the bow, then Join.
  await page.locator(".join-choice", { hasText: /^Bow$/ }).click();
  await page.locator(".join-go").click();
  expect((await weaponOf(page)).type).toBe("bow");
});

test("a scripted join skips the screen and takes ?weapon= and ?tier=", async ({ page }) => {
  await page.goto("/?name=Script&weapon=warHammer&tier=3");
  const w = await weaponOf(page);
  expect(w).toEqual({ type: "warHammer", tier: 3 });
  await expect(page.locator(".join")).toHaveCount(0);
});

test("an archer's Tab locks on to the goblin, and the HUD says so", async ({ page }) => {
  await page.goto("/?name=Archer&weapon=bow&tier=1&level=field");
  await weaponOf(page);
  // The field's goblin is at (9, -9); walk toward it until it is in bow range (and it comes to us).
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  // One press once the goblin is well inside bow range (12 m): each press moves the lock on, so a second
  // press in flight would let go again.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const h = (window as any).__hg;
          const g = Object.values(h.enemies)[0] as { pose: { x: number; z: number } | null };
          return g?.pose ? Math.hypot(g.pose.x - h.me.x, g.pose.z - h.me.z) : 99;
        }),
      { timeout: 15_000 }
    )
    .toBeLessThan(10);
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => (window as any).__hg.me.lockId as string), { timeout: 5_000 }).not.toBe("");
  await expect(page.locator("#hud-enemy-label")).toContainText("(locked)");
});
