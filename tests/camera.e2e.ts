import { expect, test, type Page } from "@playwright/test";

/**
 * The camera over the shoulder (Michael, 2026-10-13): the arrows turn and tilt it and never move
 * the player; the move keys turn with it (S walks toward the eye whichever way it faces); after a
 * pause with no camera input it swings in behind forward travel; reduced motion keeps the swing
 * off but not the player's own turning. Reads the window.__hg debug handle.
 */
type Cam = { me: { x: number; z: number }; camYaw: number; camPitch: number; camDistance: number };
const hg = (page: Page) => page.evaluate(() => (window as any).__hg as Cam);

async function join(page: Page, name: string) {
  await page.goto(`/?name=${name}&level=yard`);
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
}

async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}

test("the arrows turn and tilt the camera, never the player, and S walks toward the eye", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await join(page, "Cam");
  const a = await hg(page);
  expect(a.camYaw).toBe(0);
  expect(a.camDistance).toBeGreaterThan(4);
  expect(a.camDistance).toBeLessThanOrEqual(6);

  // Left turns the view left (yaw up); the player stays put.
  await hold(page, ["ArrowLeft"], 500);
  const b = await hg(page);
  expect(b.camYaw).toBeGreaterThan(0.3);
  expect(Math.hypot(b.me.x - a.me.x, b.me.z - a.me.z)).toBeLessThan(0.2);

  // Up raises the eye; Down lowers it; both stay in the clamp.
  await hold(page, ["ArrowUp"], 400);
  const c = await hg(page);
  expect(c.camPitch).toBeGreaterThan(a.camPitch + 5);
  await hold(page, ["ArrowDown"], 3000);
  expect((await hg(page)).camPitch).toBeGreaterThanOrEqual(5);
  expect(Math.hypot((await hg(page)).me.x - a.me.x, (await hg(page)).me.z - a.me.z)).toBeLessThan(0.2);

  // S walks toward the eye at the turned yaw: along (sin yaw, cos yaw). The swing waits for a
  // pause and ignores backing up, so the yaw holds through the walk.
  const d = await hg(page);
  await hold(page, ["KeyS"], 500);
  await page.waitForTimeout(150);
  const e = await hg(page);
  const yaw = (d.camYaw + e.camYaw) / 2;
  const mx = e.me.x - d.me.x;
  const mz = e.me.z - d.me.z;
  const len = Math.hypot(mx, mz);
  expect(len).toBeGreaterThan(0.5);
  expect((mx * Math.sin(yaw) + mz * Math.cos(yaw)) / len).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
  expect(errors).toEqual([]);
});

test("the camera swings in behind forward travel after a pause", async ({ page }) => {
  await join(page, "Swing");
  // Forward and right at once: travel 45 degrees right of the view, inside the swing window.
  // Short holds with the yaw checked between them, since the yard's walls can stop a long walk.
  const start = (await hg(page)).camYaw;
  await expect
    .poll(
      async () => {
        await hold(page, ["KeyW", "KeyD"], 600);
        return wrap(start - (await hg(page)).camYaw);
      },
      { timeout: 15_000, intervals: [50] }
    )
    .toBeGreaterThan(0.2);
});

test("reduced motion keeps the swing off but the arrows still turn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await join(page, "Still");
  for (let i = 0; i < 5; i++) {
    await hold(page, ["KeyW", "KeyD"], 600);
    expect((await hg(page)).camYaw).toBe(0);
  }
  await hold(page, ["ArrowRight"], 400);
  expect((await hg(page)).camYaw).toBeLessThan(-0.2);
});

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
