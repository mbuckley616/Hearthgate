import { expect, test, type Page } from "@playwright/test";

/**
 * The camera to the design doc's spec: it turns toward an awake fight, slowly, and the move keys
 * turn with it (S walks toward the eye whichever way it faces); reduced motion keeps it still.
 * Reads the window.__hg debug handle.
 */
const hg = (page: Page) => page.evaluate(() => (window as any).__hg as { me: { x: number; z: number }; camYaw: number });

async function wakeYardGoblin(page: Page) {
  // The yard's first goblin stands at (9, -9): head right and up-screen until it wakes.
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
}

test("the camera turns toward the fight and S walks toward the eye", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Cam&level=yard");
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
  expect((await hg(page)).camYaw).toBe(0);

  await wakeYardGoblin(page);
  await expect.poll(async () => Math.abs((await hg(page)).camYaw), { timeout: 10_000 }).toBeGreaterThan(0.15);

  const a = await hg(page);
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(150);
  const b = await hg(page);
  const yaw = (a.camYaw + b.camYaw) / 2;
  const mx = b.me.x - a.me.x;
  const mz = b.me.z - a.me.z;
  const len = Math.hypot(mx, mz);
  expect(len).toBeGreaterThan(0.5);
  // Toward the eye: along (sin yaw, cos yaw), within 35 degrees.
  expect((mx * Math.sin(yaw) + mz * Math.cos(yaw)) / len).toBeGreaterThan(Math.cos((35 * Math.PI) / 180));
  expect(errors).toEqual([]);
});

test("reduced motion keeps the camera from turning", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?name=Still&level=yard");
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
  await wakeYardGoblin(page);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    expect((await hg(page)).camYaw).toBe(0);
  }
});
