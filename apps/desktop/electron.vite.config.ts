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
    },
  },
  renderer: {
    root: resolve(__dirname, "src"),
    build: {
      rollupOptions: { input: resolve(__dirname, "src/index.html") },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
    plugins: [react(), tailwindcss()],
  },
});
