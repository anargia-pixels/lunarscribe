import { cpSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

const excalidrawAssets = resolve(__dirname, "node_modules/.excalidraw-assets");

/**
 * Copies Excalidraw's fonts into the renderer's public dir so drawings render offline.
 * Xiaolai, the 13MB CJK handwriting font, is left out.
 */
function excalidrawFonts(): Plugin {
  return {
    name: "excalidraw-fonts",
    buildStart() {
      cpSync(
        resolve(
          __dirname,
          "../../packages/components/node_modules/@excalidraw/excalidraw/dist/prod/fonts",
        ),
        resolve(excalidrawAssets, "fonts"),
        { recursive: true, filter: (path) => !path.includes("Xiaolai") },
      );
    },
  };
}

export default defineConfig({
  main: {
    build: {
      // The sign-in page renders shared controls; bundle their TypeScript sources for Electron.
      externalizeDeps: {
        exclude: ["@lunarscribe/components", "@lunarscribe/utils"],
      },
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
    publicDir: excalidrawAssets,
    build: {
      // electron-vite skips minification; smaller code means less for V8 to parse and keep.
      minify: true,
      rollupOptions: { input: resolve(__dirname, "src/index.html") },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
    plugins: [react(), tailwindcss(), excalidrawFonts()],
  },
});
