import { expect, test, type Page } from "@playwright/test";

/**
 * The camera to the design doc's spec: it turns toward an awake fight, slowly, and the move keys
 * turn with it (S walks toward the eye whichever way it faces); reduced motion keeps it still.
 * Reads the window.__hg debug handle.
 */
const hg = (page: Page) => page.evaluate(() => (window as any).__hg as { me: { x: number; z: number }; camYaw: number });

async function wakeYardGoblin(page: Page) {
  // The yard's first goblin stands at (9, -9). Walk at it until something wakes: headless frames
  // are slow, so a fixed walk sometimes stops short of its aggro range. Yaw is 0 until then, so
  // the keys are world directions.
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => {
      const h = (window as any).__hg;
      const awake = Object.values(h.enemies as Record<string, { phase: string }>).some((e) => e.phase !== "idle" && e.phase !== "dead");
      return { awake, x: h.me.x as number, z: h.me.z as number };
    });
    if (s.awake) break;
    const keys = [s.x < 8 ? "KeyD" : "KeyA", s.z > -8 ? "KeyW" : "KeyS"];
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(250);
    for (const k of keys) await page.keyboard.up(k);
  }
}

test("the camera turns toward the fight and S walks toward the eye", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Cam&level=yard");
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
  expect((await hg(page)).camYaw).toBe(0);

  await wakeYardGoblin(page);
  // From some spawns the goblin ends up nearly straight up-screen, inside the deadband; stepping
  // west puts it off to the side, so the camera has a turn to make.
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1200);
  await page.keyboard.up("KeyA");
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
