/**
 * The art spike's turnaround (`npm run turnaround`): starts a Vite dev server on its own port,
 * opens `client/turnaround.html` in headless Chromium, and writes one PNG per figure and pose to
 * `docs/art/spike/`, each the reference model's crop beside the figure from the front, side, back
 * and the game's over-the-shoulder camera. The images are for Michael's one look: keep, or hire.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5179;
const outDir = join(root, "docs/art/spike");

/** Where each reference model stands in its sheet: [x, y, w, h] in source pixels. */
const REFS = {
  // The coloured front, side and back of the base adventurer (sheet 02 panel 1), which the Knight replaces.
  knight: { file: "adventurer.png", crop: [255, 70, 450, 345] },
  // The basic goblin, the first of the four (sheet 03 panel 2).
  goblin: { file: "goblin.png", crop: [5, 150, 200, 240] }
} as const;

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not come up in ${ms} ms`);
}

async function main() {
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: join(root, "client"), stdio: "ignore" });
  try {
    const base = `http://localhost:${PORT}`;
    await waitFor(`${base}/turnaround.html`, 30_000);
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/turnaround.html`);
    await page.waitForFunction(() => typeof (window as any).__turnaround === "function", null, { timeout: 30_000 });
    const refs = Object.fromEntries(
      Object.entries(REFS).map(([kind, r]) => [
        kind,
        { src: `data:image/png;base64,${readFileSync(join(root, "docs/art/reference-models", r.file)).toString("base64")}`, crop: r.crop }
      ])
    );
    const sheets = (await page.evaluate((r) => (window as any).__turnaround(r), refs)) as Record<string, string>;
    await browser.close();
    if (errors.length) throw new Error(errors.join("\n"));
    mkdirSync(outDir, { recursive: true });
    for (const [name, url] of Object.entries(sheets)) {
      const file = join(outDir, `${name}.png`);
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
      console.log(`wrote ${file.slice(root.length + 1)}`);
    }
  } finally {
    vite.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
