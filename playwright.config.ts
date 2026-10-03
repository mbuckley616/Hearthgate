import { defineConfig } from "@playwright/test";

/**
 * Browser smoke test. Starts the server and the Vite dev server, then opens
 * two pages. Run with `npm run test:e2e` after `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true
  },
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://localhost:2567/health",
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: "npm run dev:client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});
