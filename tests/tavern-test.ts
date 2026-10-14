/**
 * The village kit's scale test (`npm run tavern-test`): starts a Vite dev server on its own port,
 * opens `client/tavern-test.html` in headless Chromium, and writes the KayKit Hexagon tavern shots
 * to `docs/art/spike/hexagon-tavern-*.png`, from the game's camera at the tavern door and from
 * across the square. Michael picks the village kit from them (decisions.md 2026-10-14, 2A).
 * `npm run tavern-test -- --probe` writes four turns of the model instead, to find its door.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5180;
const outDir = join(root, "docs/art/spike");

/** Rig units to metres for the tavern: its door stands about 2.2 m (found with --probe). */
const SCALE = Number(process.env.TAVERN_SCALE ?? 6);
/** The model's door faces -z (the greybox Tavern's door) after this turn. */
const TURN = Number(process.env.TAVERN_TURN ?? Math.PI);

type Shot = { scale: number; turn: number; player: { x: number; z: number; facing: number }; yaw: number; pitchDeg?: number };

// The greybox Tavern (level.ts VILLAGE): centre (-12, 11), door at (-12, 8) facing south (-z).
const SHOTS: Record<string, Shot> = {
  // At the foot of the door's steps, the camera behind the player at its starting pitch, turned
  // a little west so the General Store's corner does not fill the frame.
  door: { scale: SCALE, turn: TURN, player: { x: -10.5, z: 4.6, facing: -0.6 }, yaw: -0.6 },
  // From across the square by the Storehouse, the tavern beyond the portal's ground.
  square: { scale: SCALE, turn: TURN, player: { x: 6, z: -4, facing: -0.85 }, yaw: -0.85, pitchDeg: 18 }
};

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
  const probe = process.argv.includes("--probe");
  const shots: Record<string, Shot> = probe
    ? Object.fromEntries([2].map((q) => [`probe-${q}`, { ...SHOTS.door, player: { x: -9.5, z: 3.5, facing: -1.2 }, yaw: -1.0, pitchDeg: 10, turn: (q * Math.PI) / 2 }]))
    : SHOTS;
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: join(root, "client"), stdio: "ignore" });
  try {
    const base = `http://localhost:${PORT}`;
    await waitFor(`${base}/tavern-test.html`, 30_000);
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/tavern-test.html`);
    await page.waitForFunction(() => typeof (window as any).__tavern === "function", null, { timeout: 30_000 });
    mkdirSync(outDir, { recursive: true });
    for (const [name, shot] of Object.entries(shots)) {
      const url = (await page.evaluate((s) => (window as any).__tavern(s), shot)) as string;
      const file = probe ? join(root, "test-results", `hexagon-tavern-${name}.png`) : join(outDir, `hexagon-tavern-${name}.png`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
      console.log(`wrote ${file.slice(root.length + 1)}`);
    }
    await browser.close();
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    vite.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
