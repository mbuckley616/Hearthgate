import { expect, test } from "@playwright/test";

/**
 * Item sounds (Michael, 29 Oct): dropping an item from the bag plays its sound, and every family of
 * material (and the coin jingle a trade plays) synthesises without a fault once audio is unlocked.
 */
test("an item dropped from the bag sounds, and every material's sound plays", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?play");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?play");
  await expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.session.playing), { timeout: 20_000 }).toBe(true);
  // A key unlocks audio, as browsers ask; then count what the bag hands the sounds.
  await page.keyboard.press("KeyH");
  await expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.sfx.ctx?.state)).toBe("running");
  await page.evaluate(() => {
    const sfx = (window as unknown as { game: any }).game.sfx;
    const item = sfx.item.bind(sfx);
    sfx.played = [];
    sfx.item = (it: { id: string }, down: boolean) => {
      sfx.played.push(`${it.id}:${down}`);
      item(it, down);
    };
  });
  await page.keyboard.press("Tab");
  await expect(page.locator(".gear-grid")).toBeVisible();
  const detail = page.locator(".gear-detail .item-name");
  // One space at a time: D held while a poll waits carried the cursor past the bow on a page near
  // 12 fps (the critic, 30 Oct), so each step holds D only until the cursor has moved.
  const cursor = () => page.evaluate(() => (window as unknown as { game: any }).game.equip.cursor as number);
  for (let i = 0; i < 12 && !((await detail.count()) > 0 && (await detail.textContent()) === "Ash shortbow"); i++) {
    const was = await cursor();
    await page.keyboard.down("KeyD");
    await expect.poll(cursor, { timeout: 5_000, intervals: [10] }).not.toBe(was);
    await page.keyboard.up("KeyD");
  }
  await expect(detail).toHaveText("Ash shortbow");
  await page.keyboard.press("KeyQ");
  await expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.sfx.played)).toEqual(["ash-shortbow:true"]);
  // One of each family, picked up and set down, and the coins.
  await page.evaluate(() => {
    const sfx = (window as unknown as { game: any }).game.sfx;
    for (const id of ["steel-sword", "leather-coif", "linen-hat", "ash-staff", "frost-arrows", "silver-ring"]) for (const down of [true, false]) sfx.item({ id, uid: "x" }, down);
    sfx.coins();
  });
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
});
