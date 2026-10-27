import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2022",
    sourcemap: true,
    // three.js alone is ~600 kB; don't warn about it.
    chunkSizeWarningLimit: 1000,
    // Two pages: the game, and the dungeon editor (T4b).
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), editor: resolve(__dirname, "editor.html") }
    }
  }
});
