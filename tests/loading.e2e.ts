import { createServer, type Server, type Socket } from "node:net";
import { expect, test } from "@playwright/test";

/**
 * The loading card (Michael, 29 Oct): after Play, a server that is slow to answer (the free Render
 * one waking) shows "Waking the server" with a filling bar and the seconds, and the card goes once
 * the room welcomes us. A server that takes the connection and never answers stands in for one
 * still waking.
 */

let silent: Server;
const sockets: Socket[] = [];
let port = 0;

test.beforeAll(async () => {
  silent = createServer((s) => sockets.push(s));
  await new Promise<void>((done) => silent.listen(0, "127.0.0.1", done));
  port = (silent.address() as { port: number }).port;
});

test.afterAll(async () => {
  for (const s of sockets) s.destroy();
  await new Promise((done) => silent.close(done));
});

test("a server slow to wake shows the loading card", async ({ page }) => {
  await page.goto(`/?play&server=ws://127.0.0.1:${port}`);
  const card = page.locator(".loading-card");
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".loading-card-title")).toHaveText("Waking the server");
  await expect(page.locator(".loading-card-line")).toContainText(/[1-9] s/, { timeout: 5_000 });
  const width = await page.locator(".loading-card-fill").evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(width).toBeGreaterThan(0);
});

test("the card goes when the room welcomes us", async ({ page }) => {
  await page.goto("/?play");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { game: any }).game.session.playing), { timeout: 20_000 })
    .toBe(true);
  await expect(page.locator(".loading-card")).toBeHidden();
});
