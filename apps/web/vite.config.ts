import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import routerConfig from "./tsr.config.json" with { type: "json" };

/**
 * The files the site serves at their plain paths, assembled under node_modules
 * so the source tree keeps only the committed files.
 */
const publicDir = resolve(import.meta.dirname, "node_modules/.web-assets");

/** Copies this app's public files and the icons it shares with the desktop app. */
function servedFiles(): Plugin {
  return {
    name: "served-files",
    buildStart() {
      rmSync(publicDir, { force: true, recursive: true });
      cpSync(resolve(import.meta.dirname, "public"), publicDir, {
        recursive: true,
      });
      cpSync(
        resolve(import.meta.dirname, "../../assets/icons"),
        resolve(publicDir, "icons"),
        { filter: isWebIcon, recursive: true },
      );
    },
  };
}

/** Keeps the icon files; drops the sources desktop packaging builds from. */
function isWebIcon(path: string): boolean {
  return !path.endsWith(".ase") && !path.endsWith(".icns");
}

const config = defineConfig({
  publicDir,
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // Next.js-style app router: `page` and `layout`/`route` files are routes, and other
    // files beside them are the page's own components. tsr.config.json holds the same
    // rules for the `tsr generate` CLI; this plugin resolves the folder from `src`.
    tanstackStart({
      router: {
        routesDirectory: "app",
        indexToken: routerConfig.indexToken,
        routeToken: routerConfig.routeToken,
        routeFileIgnorePattern: routerConfig.routeFileIgnorePattern,
      },
      // Rendered while building and uploaded as static assets, so a visit to
      // these pages costs no worker request.
      pages: [{ path: "/" }, { path: "/privacy" }, { path: "/terms" }],
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false, // do not add every route with a component
        autoSubfolderIndex: false, // write privacy.html, not privacy/index.html
        crawlLinks: false, // do not follow a landing page link into /app
      },
    }),
    viteReact(),
    servedFiles(),
  ],
});

export default config;
