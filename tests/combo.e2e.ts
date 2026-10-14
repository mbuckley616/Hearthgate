import { expect, test } from "@playwright/test";
import { ENEMY_KINDS, PLAYER, cameraRelativeMove } from "@hearthgate/shared";

/** The eight key combinations and their screen vectors (input.ts: W is dy -1, D is dx +1). */
const DIRECTIONS: [string[], number, number][] = [
  [["KeyW"], 0, -1],
  [["KeyS"], 0, 1],
  [["KeyA"], -1, 0],
  [["KeyD"], 1, 0],
  [["KeyW", "KeyD"], Math.SQRT1_2, -Math.SQRT1_2],
  [["KeyW", "KeyA"], -Math.SQRT1_2, -Math.SQRT1_2],
  [["KeyS", "KeyD"], Math.SQRT1_2, Math.SQRT1_2],
  [["KeyS", "KeyA"], -Math.SQRT1_2, Math.SQRT1_2]
];

/**
 * The combo callout (Michael, A, 2026-10-05): Cleave (1) staggers the cellar's goblin, Execute (2)
 * consumes it, and the client draws the callout over the enemy and logs it. Alone it is a solo crit
 * ("Critical"); the two-player "Combo x1.5" over the wire is `npm run test:net`'s combo step.
 */
test("Cleave then Execute shows the callout over the goblin", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?name=Combo&level=cellar"); // the goblin at (7, -7) wakes at once and comes
  await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });

  const state = () =>
    page.evaluate(() => {
      const h = (window as any).__hg;
      const e = Object.values(h.enemies as Record<string, { pose: { x: number; z: number } }>)[0];
      return { d: e ? Math.hypot(e.pose.x - h.me.x, e.pose.z - h.me.z) : 99, callouts: h.callouts as number, last: h.lastCallout as string };
    });

  // Walk at the goblin with the keys that point at it from where the camera has turned (the camera
  // swings in behind the travel, so fixed keys drift off it), stop short, step once more to face it (we
  // face the way we last moved, and Execute's cone is in front), then 1, then 2 a beat later.
  // The step lengths come from the distance, not a fixed hold: a held key now covers the same
  // ground at any frame rate, and a fixed hold tuned to a slow page overshoots on a fast one.
  // The goblin closes too, so the approach is timed on both speeds; a run that still ends inside
  // it (under a metre, where the cones' "in front" is a coin toss) backs off first. Without that
  // the test stood in the goblin until it lost the fight (1 run in 10, more under the camera's
  // swing in behind, which turns the keys a little between the aim and the press).
  const toward = async (away = false) => {
    const at = await page.evaluate(() => {
      const h = (window as any).__hg;
      const e = Object.values(h.enemies as Record<string, { pose: { x: number; z: number } }>)[0];
      return { x: h.me.x, z: h.me.z, gx: e?.pose.x ?? h.me.x, gz: e?.pose.z ?? h.me.z, yaw: h.camYaw as number };
    });
    const want = Math.atan2(at.gx - at.x, at.gz - at.z) + (away ? Math.PI : 0);
    let best: string[] = [];
    let bestCos = -Infinity;
    for (const [keys, dx, dy] of DIRECTIONS) {
      const m = cameraRelativeMove(dx, dy, at.yaw);
      const c = Math.cos(Math.atan2(m.dx, m.dy) - want);
      if (c > bestCos) [bestCos, best] = [c, keys];
    }
    return best;
  };
  const hold = async (keys: string[], ms: number) => {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of keys) await page.keyboard.up(k);
  };
  await expect
    .poll(
      async () => {
        if (process.env.COMBO_SHOT) await page.screenshot({ path: process.env.COMBO_SHOT });
        const s = await state();
        if (s.callouts > 0) return s.callouts;
        if (s.d > 2.2) {
          // Close in, stopping about 1.5 m short; it is walking at us too.
          await hold(await toward(), Math.min(300, ((s.d - 1.5) / (PLAYER.speed + ENEMY_KINDS.goblin.speed)) * 1000));
          return s.callouts;
        }
        if (s.d < 1) {
          await hold(await toward(true), ((1.5 - s.d) / PLAYER.speed) * 1000);
          return s.callouts;
        }
        await hold(await toward(), 40);
        await page.keyboard.press("Digit1");
        await page.waitForTimeout(700);
        await hold(await toward(), 40);
        await page.keyboard.press("Digit2");
        await page.waitForTimeout(600);
        return (await state()).callouts;
      },
      { timeout: 30_000, intervals: [200] }
    )
    .toBeGreaterThan(0);

  if (process.env.COMBO_SHOT) await page.screenshot({ path: process.env.COMBO_SHOT });
  const s = await state();
  expect(s.last).toBe("Critical");
  await expect(page.locator("#hud-log")).toContainText("Critical: the goblin knocked down");
  await expect(page.locator(".hud-slot[data-slot='2'] .hud-slot-name")).toHaveText("Execute");
  expect(errors).toEqual([]);
});
