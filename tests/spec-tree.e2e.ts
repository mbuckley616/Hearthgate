import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

// The specialization trees on the hero screen (Michael's A, 8 Nov): a row opens at its level, A steps
// through its two, X clears it, and what is picked goes out with the loadout.
test("the Paladin's tree on the hero screen, by pad", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?play");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/?play");
  const playing = () => expect.poll(() => page.evaluate(() => (window as unknown as { game: any }).game.session.playing), { timeout: 20_000 }).toBe(true);
  await playing();
  const shared = resolve("shared/src");
  // XP is the server's: save it, then come back so the hello brings it.
  await page.evaluate(async (shared) => {
    const { xpForLevel } = await import(`/@fs${shared}/sim/gear.ts`);
    const g = (window as unknown as { game: any }).game;
    g.profile.data.xp.sword = xpForLevel(30);
    g.profile.save();
  }, shared);
  await page.goto("/?play");
  await playing();
  const out = await page.evaluate(async (shared) => {
    const { gamepadBindings } = await import("/src/input/bindings.ts");
    const { TALENT_IDS } = await import(`/@fs${shared}/sim/talents.ts`);
    const actionsOf = (button: number) => Object.entries(gamepadBindings as Record<string, number[]>).filter(([, b]) => b.includes(button)).map(([a]) => a);
    const g = (window as unknown as { game: any }).game;
    const press = (button: number) => {
      const a = actionsOf(button);
      g.equip.handle({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set(a), pressed: new Set(a) }, 0.016);
      g.equip.handle({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set(), pressed: new Set() }, 0.5);
    };
    g.profile.setSpec("sword", "paladin");
    g.equip.setVisible(true);
    g.equip.setTab("talents");
    g.equip.tCol = 0;
    const r: Record<string, unknown> = {};
    const picks = () => JSON.stringify(g.profile.loadout().tree ?? null);
    g.equip.tRow = TALENT_IDS.length + 1; // the tree's first row, Lv 20
    g.equip.render();
    r.rows = document.querySelectorAll(".tree-row").length;
    r.crescendo = document.body.textContent?.includes("Judgement") ?? false;
    press(0); // A
    r.first = picks();
    press(0);
    r.second = picks();
    g.equip.tRow = TALENT_IDS.length + 3; // Lv 40, shut at 30
    press(0);
    r.shut = picks();
    g.equip.tRow = TALENT_IDS.length + 1;
    press(2); // X clears the row
    r.cleared = picks();
    g.profile.setSpec("sword", "spellblade");
    r.otherSpec = picks();
    g.equip.setVisible(false);
    return r;
  }, shared);
  expect(out).toEqual({
    rows: 4,
    crescendo: true,
    first: JSON.stringify({ sword: ["long-grudge"] }),
    second: JSON.stringify({ sword: ["hallowed-ground"] }),
    shut: JSON.stringify({ sword: ["hallowed-ground"] }),
    cleared: "null",
    otherSpec: "null",
  });
  expect(errors).toEqual([]);
});
