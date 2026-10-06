import { cpSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

import { version } from "./package.json";

const rendererPublicDir = resolve(__dirname, "node_modules/.excalidraw-assets");

/**
 * Copies app icons and Excalidraw's fonts into the renderer's public dir for offline use.
 * Xiaolai, the 13MB CJK handwriting font, is left out.
 */
function rendererAssets(): Plugin {
  return {
    name: "renderer-assets",
    buildStart() {
      cpSync(
        resolve(__dirname, "../../assets/icons"),
        resolve(rendererPublicDir, "icons"),
        {
          recursive: true,
          filter: (path) => !path.endsWith(".ase") && !path.endsWith(".icns"),
        },
      );
      cpSync(
        resolve(
          __dirname,
          "../../packages/components/node_modules/@excalidraw/excalidraw/dist/prod/fonts",
        ),
        resolve(rendererPublicDir, "fonts"),
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
    // Compiles the sign-in page's Tailwind stylesheet.
    plugins: [tailwindcss()],
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
    define: { __APP_VERSION__: JSON.stringify(version) },
    publicDir: rendererPublicDir,
    build: {
      // electron-vite skips minification; smaller code means less for V8 to parse and keep.
      minify: true,
      rollupOptions: { input: resolve(__dirname, "src/index.html") },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
    plugins: [react(), tailwindcss(), rendererAssets()],
  },
});
