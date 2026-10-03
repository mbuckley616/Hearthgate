import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the client under /hearthgate/; local dev stays at /.
  base: process.env.VITE_BASE ?? "/",
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
