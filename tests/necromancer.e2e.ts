import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

// The Necromancer (the builds pass, Michael's A, 12 Nov): a level-40 staff hero who chose it presses Q
// in the arena, and a skeleton stands beside them in the server's snapshot, drawn as bones.
test("a Necromancer's Grave Call raises a skeleton", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?dungeon&play");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?dungeon&play");
  const playing = () => expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.session.playing), { timeout: 20_000 }).toBe(true);
  await playing();
  const shared = resolve("shared/src");
  // XP and the specialization go out with the hello, so save them and come back.
  const chose = await page.evaluate(async (shared) => {
    const { xpForLevel } = await import(`/@fs${shared}/sim/gear.ts`);
    const g = (window as unknown as { game: any }).game;
    g.profile.data.xp.staff = xpForLevel(40);
    // The starter bag holds a staff: wear it.
    for (let i = 0; i < g.profile.data.bag.length && g.profile.style !== "staff"; i++) if (g.profile.data.bag[i]) g.profile.wear(i);
    const ok = g.profile.setSpec("staff", "necromancer");
    g.profile.save();
    return ok;
  }, shared);
  expect(chose).toBe(true);
  await page.goto("/?dungeon&play");
  await playing();
  const me = () =>
    page.evaluate(() => {
      const g = (window as unknown as { game: any }).game;
      const p = g.session.view().curr.players.find((x: any) => x.id === g.session.localId);
      return p ? { style: p.style, spec: p.spec?.staff ?? null } : null;
    });
  await expect.poll(me, { timeout: 10_000 }).toEqual({ style: "staff", spec: "necromancer" });
  await page.keyboard.down("KeyQ");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyQ");
  const skeletons = () =>
    page.evaluate(() => {
      const g = (window as unknown as { game: any }).game;
      return g.session.view().curr.players.filter((x: any) => x.summon?.owner === g.session.localId).map((x: any) => x.name);
    });
  await expect.poll(skeletons, { timeout: 5_000 }).toEqual(["Skeleton"]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.SHOT ?? "test-results/necromancer.png" });
  expect(errors).toEqual([]);
});
