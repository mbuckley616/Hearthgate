import { expect, test, type Page } from "@playwright/test";

/**
 * Placeholder figures instead of pills: every kind is built from several parts with its own
 * silhouette (the goblin small, the Shieldbearer bigger, the Pack Leader tallest, the Charger
 * long and low), and a walking player strides. Reads the window.__hg debug handle.
 */
type Stat = { parts: number; tris: number; height: number; width: number; stride: number };
const figures = (page: Page) =>
  page.evaluate(() => (window as any).__hg.figures() as { players: Record<string, Stat>; enemies: Record<string, Stat & { kind: string }> });

test("each enemy kind and the player read as distinct figures", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Fig&level=yard");
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });
  await expect.poll(async () => Object.keys((await figures(page)).enemies).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(7);

  const f = await figures(page);
  const byKind: Record<string, Stat> = {};
  for (const e of Object.values(f.enemies)) byKind[e.kind] = e;
  for (const kind of ["goblin", "shieldbearer", "charger", "packLeader"]) expect(byKind[kind]?.parts, kind).toBeGreaterThanOrEqual(7);
  const me = Object.values(f.players)[0];
  expect(me.parts).toBeGreaterThanOrEqual(7);

  expect(byKind.goblin.height).toBeLessThan(me.height);
  expect(byKind.shieldbearer.height).toBeGreaterThan(byKind.goblin.height);
  expect(byKind.packLeader.height).toBeGreaterThan(byKind.shieldbearer.height);
  expect(byKind.charger.width).toBeGreaterThan(byKind.charger.height);
  // The art spike's budgets (backlog): about 1,500 triangles a player, 800 a goblin.
  expect(me.tris).toBeLessThanOrEqual(1500);
  expect(byKind.goblin.tris).toBeLessThanOrEqual(800);
  await page.screenshot({ path: "test-results/figures-still.png" });

  // Walking strides; standing still settles.
  expect(me.stride).toBeLessThan(0.05);
  await page.keyboard.down("KeyS");
  await expect.poll(async () => Object.values((await figures(page)).players)[0].stride, { timeout: 3_000 }).toBeGreaterThan(0.5);
  await page.screenshot({ path: "test-results/figures-walking.png" });
  await page.keyboard.up("KeyS");
  await expect.poll(async () => Object.values((await figures(page)).players)[0].stride, { timeout: 3_000 }).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});
