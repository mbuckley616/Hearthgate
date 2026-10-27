import { expect, test, type Page } from "@playwright/test";
import { YARD, tuning } from "@hearthgate/shared";

/**
 * The combat slice's orbit camera (combat port step 1): the arrows turn and tilt it and never move
 * the player; the move keys turn with it (S walks toward the eye whichever way it faces); the eye
 * never goes under the floor or into a wall, craning up over the player instead; the mouse is an
 * option under pointer lock. Reads the window.__hg debug handle.
 */
type Vec = { x: number; y: number; z: number };
type Cam = { me: { x: number; z: number }; camYaw: number; camPitch: number; camDistance: number; camEye: Vec };
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

/** The yard's walls as the camera sees them (render.ts: a squat one is a 1.8 m pillar, a long one 1.1 m). */
const boxes = YARD.walls.map((w) => ({ ...w, h: w.h ?? (w.hw < 1 && w.hd < 1 ? 1.8 : 1.1) }));

/** The eye is above the floor and outside every wall. */
function eyeClear(e: Vec): boolean {
  if (e.y <= 0) return false;
  return !boxes.some((b) => Math.abs(e.x - b.x) < b.hw && Math.abs(e.z - b.z) < b.hd && e.y < b.h);
}

/** No wall stands between the eye and the player's head: the camera never looks through one. */
function sightClear(e: Vec, me: { x: number; z: number }): boolean {
  const head = { x: me.x, y: tuning.camera.pivotHeight, z: me.z };
  for (let i = 1; i < 40; i++) {
    const t = i / 40;
    const p = { x: head.x + (e.x - head.x) * t, y: head.y + (e.y - head.y) * t, z: head.z + (e.z - head.z) * t };
    if (!eyeClear(p)) return false;
  }
  return true;
}

test("the arrows turn and tilt the camera, never the player, and S walks toward the eye", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await join(page, "Cam");
  const a = await hg(page);
  expect(a.camYaw).toBe(0);
  expect(a.camPitch).toBeCloseTo(tuning.camera.startPitchDeg, 3);

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
  expect((await hg(page)).camPitch).toBeCloseTo(tuning.camera.pitchMinDeg, 3);
  expect(Math.hypot((await hg(page)).me.x - a.me.x, (await hg(page)).me.z - a.me.z)).toBeLessThan(0.2);

  // S walks toward the eye at the turned yaw: along (sin yaw, cos yaw).
  await hold(page, ["ArrowUp"], 600);
  const d = await hg(page);
  await hold(page, ["KeyS"], 500);
  await page.waitForTimeout(150);
  const e = await hg(page);
  const mx = e.me.x - d.me.x;
  const mz = e.me.z - d.me.z;
  const len = Math.hypot(mx, mz);
  expect(len).toBeGreaterThan(0.5);
  expect((mx * Math.sin(d.camYaw) + mz * Math.cos(d.camYaw)) / len).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
  expect(errors).toEqual([]);
});

test("the eye stays above the floor and out of the walls, craning up when backed into one", async ({ page }) => {
  await join(page, "Clip");
  // Looking up from below: the floor stops the eye, never lets it under.
  await hold(page, ["ArrowDown"], 1500);
  const low = await hg(page);
  expect(low.camEye.y).toBeGreaterThan(0.2);
  expect(low.camDistance).toBeLessThan(tuning.camera.distance);

  // Turn the eye east (yaw +90 degrees: S walks east, A north), level it, then walk to the east
  // wall's middle (x 5.6 to 6.4, z 2 to 10) and back into it. The eye would sit 5.5 m behind,
  // through the wall.
  await hold(page, ["ArrowUp"], 500);
  await expect.poll(async () => {
    const y = (await hg(page)).camYaw;
    if (y < Math.PI / 2 - 0.05) await hold(page, ["ArrowLeft"], 30);
    else if (y > Math.PI / 2 + 0.05) await hold(page, ["ArrowRight"], 30);
    else return true;
    return false;
  }, { timeout: 10_000, intervals: [20] }).toBe(true);
  await expect.poll(async () => {
    const z = (await hg(page)).me.z;
    if (z < 5) await hold(page, ["KeyA"], 120);
    else if (z > 7) await hold(page, ["KeyD"], 120);
    else return true;
    return false;
  }, { timeout: 15_000, intervals: [50] }).toBe(true);
  // 20 degrees below the pivot: from 1.7 m the eye's ray would pass through the 1.1 m wall behind.
  await expect.poll(async () => {
    const p = (await hg(page)).camPitch;
    if (p > -18) await hold(page, ["ArrowDown"], 30);
    else if (p < -22) await hold(page, ["ArrowUp"], 30);
    else return true;
    return false;
  }, { timeout: 10_000, intervals: [20] }).toBe(true);

  let samples = 0;
  for (const k of ["KeyS"]) await page.keyboard.down(k);
  for (let i = 0; i < 50; i++) {
    const s = await hg(page);
    expect(eyeClear(s.camEye), `eye at ${JSON.stringify(s.camEye)}, me at ${JSON.stringify(s.me)}`).toBe(true);
    expect(sightClear(s.camEye, s.me), `wall between eye ${JSON.stringify(s.camEye)} and ${JSON.stringify(s.me)}`).toBe(true);
    samples++;
    await page.waitForTimeout(40);
  }
  await page.keyboard.up("KeyS");
  const end = await hg(page);
  // Backed against the wall (its west face at 5.6, less the player's radius) the whole time it was sampled.
  expect(end.me.x).toBeGreaterThan(4.5);
  expect(end.me.x).toBeLessThan(5.6);
  expect(samples).toBe(50);
});

test("reduced motion: the arrows still turn", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await join(page, "Still");
  await hold(page, ["ArrowRight"], 400);
  expect((await hg(page)).camYaw).toBeLessThan(-0.2);
});

test("mouse look: a click takes the lock, the mouse turns the camera, left attacks, right guards (Michael, 2026-10-14, A)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await join(page, "Mouse");
  type M = { me: { attackUntil: number; guarding: boolean }; camYaw: number; camPitch: number; mouseLocked: boolean };
  const m = () => page.evaluate(() => (window as any).__hg as M);
  const a = await m();
  expect(a.mouseLocked).toBe(false);

  // The click that takes the lock swings nothing.
  const box = (await page.locator("#app canvas").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.click(cx, cy);
  await expect.poll(async () => (await m()).mouseLocked, { timeout: 5_000 }).toBe(true);
  await page.waitForTimeout(300);
  expect((await m()).me.attackUntil).toBe(a.me.attackUntil);

  // Right by 200 px turns the view right (yaw down) by 200 x mouseSensitivity (0.12): 24 degrees.
  // Steps, since one big jump can be clipped at the window's edge.
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 20, cy);
  await page.waitForTimeout(150);
  const b = await m();
  const want = (200 * tuning.camera.mouseSensitivity * Math.PI) / 180;
  expect(b.camYaw).toBeLessThan(-want * 0.75);
  expect(b.camYaw).toBeGreaterThan(-want * 1.25);
  // Up lowers the eye: the pitch falls.
  for (let i = 1; i <= 5; i++) await page.mouse.move(cx + 200, cy - i * 10);
  await page.waitForTimeout(150);
  expect((await m()).camPitch).toBeLessThan(b.camPitch - 3);

  // The right button guards while held.
  await page.mouse.down({ button: "right" });
  await expect.poll(async () => (await m()).me.guarding, { timeout: 3_000 }).toBe(true);
  await page.mouse.up({ button: "right" });
  await expect.poll(async () => (await m()).me.guarding, { timeout: 3_000 }).toBe(false);

  // The left button attacks.
  const before = (await m()).me.attackUntil;
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await m()).me.attackUntil, { timeout: 3_000 }).toBeGreaterThan(before);

  // Let go of the lock: the mouse turns nothing.
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(async () => (await m()).mouseLocked, { timeout: 3_000 }).toBe(false);
  const c = await m();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + 200 - i * 20, cy);
  await page.waitForTimeout(150);
  expect((await m()).camYaw).toBeCloseTo(c.camYaw, 6);
  expect(errors).toEqual([]);
});

test("keyboard only: J attacks, L guards, Ctrl dodges, Q and E use the abilities (decision 10A)", async ({ page }) => {
  await join(page, "Keys");
  type K = { me: { attackUntil: number; guarding: boolean; dodgeAt: number; readyAt: number[] } };
  const k = () => page.evaluate(() => (window as any).__hg as K);
  const a = await k();
  await page.keyboard.press("KeyJ");
  await expect.poll(async () => (await k()).me.attackUntil, { timeout: 3_000 }).toBeGreaterThan(a.me.attackUntil);
  await page.waitForTimeout(800);
  await page.keyboard.down("KeyL");
  await expect.poll(async () => (await k()).me.guarding, { timeout: 3_000 }).toBe(true);
  await page.keyboard.up("KeyL");
  await expect.poll(async () => (await k()).me.guarding, { timeout: 3_000 }).toBe(false);
  await page.keyboard.press("ControlLeft");
  await expect.poll(async () => (await k()).me.dodgeAt, { timeout: 3_000 }).toBeGreaterThan(a.me.dodgeAt);
  await page.waitForTimeout(800);
  // The starter sword: Cleave on Q puts its slot on cooldown when it fires.
  await page.keyboard.press("KeyQ");
  await expect.poll(async () => (await k()).me.readyAt[0], { timeout: 3_000 }).toBeGreaterThan(a.me.readyAt[0]);
});
