import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      lib: { entry: resolve(__dirname, "src/electron/main.ts") },
    },
  },
  preload: {
    build: {
      lib: { entry: resolve(__dirname, "src/electron/preload.ts") },
      // Sandboxed preloads cannot load ES modules.
      rollupOptions: { output: { format: "cjs" } },
    },
  },
  renderer: {
    root: resolve(__dirname, "src"),
    build: {
      // electron-vite skips minification; smaller code means less for V8 to parse and keep.
      minify: true,
      rollupOptions: { input: resolve(__dirname, "src/index.html") },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
    plugins: [react(), tailwindcss()],
  },
});
