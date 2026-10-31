import { expect, test } from "@playwright/test";

/**
 * Menus with an Xbox pad (Michael, 30 Oct): B closes the hero screen without the hero dodging,
 * and RB resets a talent board only on a second press inside the window.
 */
test("B closes the hero screen without a dodge, and RB resets a board only on a second press", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A stand-in pad: B (button 1) is down while window.__padB is true.
  await page.addInitScript(() => {
    const w = window as unknown as { __padB: boolean };
    w.__padB = false;
    const buttons = () => Array.from({ length: 17 }, (_, i) => ({ pressed: i === 1 && w.__padB, touched: false, value: i === 1 && w.__padB ? 1 : 0 }));
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [{ id: "stand-in", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: buttons(), timestamp: 0 }],
    });
  });
  await page.goto("/?play");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?play");
  await expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.session.playing), { timeout: 20_000 }).toBe(true);

  // RB on the talents, driven straight through the screen's handler so no frame is missed.
  const resets = await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    let n = 0;
    const reset = g.profile.resetTalents.bind(g.profile);
    g.profile.resetTalents = (s: string) => {
      n++;
      reset(s);
    };
    g.equip.setVisible(true);
    g.equip.setTab("talents");
    const press = (a: string) => g.equip.handle({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set([a]), pressed: new Set([a]) }, 0.016);
    const idle = (dt: number) => g.equip.handle({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set(), pressed: new Set() }, dt);
    const counts: number[] = [];
    press("ability2");
    counts.push(n); // armed, not reset
    const armed = !!document.querySelector(".talent-armed");
    press("ability2");
    counts.push(n); // reset
    press("ability2");
    idle(3);
    press("ability2");
    counts.push(n); // the window ran out: armed again, not reset
    idle(0.016);
    g.equip.handle({ move: { x: 1, y: 0 }, look: { x: 0, y: 0 }, held: new Set(), pressed: new Set() }, 0.016);
    press("ability2");
    counts.push(n); // moving disarmed it
    return { counts, armed };
  });
  expect(resets).toEqual({ counts: [0, 1, 1, 1], armed: true });

  // B with the hero screen up closes it, and the hero does not dodge on that press.
  await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    g.equip.setTab("gear");
    g.equip.setVisible(true);
    const w = window as unknown as { __modes: string[] };
    w.__modes = [];
    const start = performance.now();
    const tick = () => {
      const me = g.me();
      if (me) w.__modes.push(me.mode);
      if (performance.now() - start < 1500) requestAnimationFrame(tick);
      else (window as unknown as { __done: boolean }).__done = true;
    };
    requestAnimationFrame(tick);
    (window as unknown as { __padB: boolean }).__padB = true;
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.equip.visible), { timeout: 5_000 }).toBe(false);
  await page.evaluate(() => ((window as unknown as { __padB: boolean }).__padB = false));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __done?: boolean }).__done), { timeout: 15_000 }).toBe(true);
  const modes = await page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);
  expect(modes).not.toContain("dodge");
  expect(errors).toEqual([]);
});
