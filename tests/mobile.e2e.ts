import { devices, expect, test, type Page } from "@playwright/test";

/**
 * Mobile sanity check: the client renders and shows its HUD on phone-sized,
 * touch-capable viewports, even though there is no touch input yet.
 * Stands in for "open it on a phone over the LAN" until someone does that by hand.
 */
const PHONES = [
  { label: "Pixel 7 portrait", use: devices["Pixel 7"] },
  { label: "Pixel 7 landscape", use: devices["Pixel 7 landscape"] },
  { label: "small Android portrait (360 x 640)", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 640 } } }
];

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
}

for (const phone of PHONES) {
  test(`renders with a HUD on ${phone.label}`, async ({ browser }) => {
    const { defaultBrowserType: _, ...use } = phone.use as typeof phone.use & { defaultBrowserType?: string };
    const ctx = await browser.newContext(use);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/?name=Phone");
    await expect(page.locator("#hud-party")).toHaveAttribute("data-players", /[1-8]/, { timeout: 15_000 });

    const vp = page.viewportSize()!;
    const canvas = await box(page, "#app canvas");
    expect(canvas.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(canvas.height).toBeGreaterThanOrEqual(vp.height - 1);

    // The scene actually drew: a frame of one flat colour means WebGL failed silently.
    await page.waitForTimeout(500);
    const shot = await page.locator("#app canvas").screenshot();
    const colours = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
      return seen.size;
    }, shot.toString("base64"));
    expect(colours).toBeGreaterThan(8);

    // HUD panels sit inside the screen, in their corners, without covering each other.
    const panels = ["#hud .hud-top-left", "#hud .hud-top-right"];
    const boxes = await Promise.all(panels.map((s) => box(page, s)));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    }
    expect(overlaps(boxes[0], boxes[1])).toBe(false);
    await expect(page.locator("#hud-hp-text")).toHaveText(/\d+ \/ \d+/);

    // No sideways scroll or zoom-out on a phone.
    const scroll = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    expect(scroll.w).toBeLessThanOrEqual(vp.width);
    expect(scroll.h).toBeLessThanOrEqual(vp.height);

    expect(errors).toEqual([]);
    await ctx.close();
  });
}
