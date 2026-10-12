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
 * The files the site serves at their plain paths: this app's own public folder
 * plus the icons it shares with the desktop app. Assembled under node_modules so
 * the source tree keeps only the committed files.
 */
const publicDir = resolve(import.meta.dirname, "node_modules/.web-assets");

/**
 * Assembles the served files. Cloudflare uploads the client build, public files
 * included, as the Worker's static assets, so everything here is served from the
 * CDN and never reaches the worker. Icon sources for packaging (Aseprite,
 * macOS) are left out.
 */
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
        {
          recursive: true,
          filter: (path) => !path.endsWith(".ase") && !path.endsWith(".icns"),
        },
      );
    },
  };
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
      // Rendered while building and uploaded as static assets, so a visit to these
      // pages costs no worker invocation. Only the listed pages: discovery would
      // also take the editor and the OAuth window, which render per request, and
      // crawling is off so no link can pull them in either. Each page lands beside
      // its hashed bundle output rather than in a folder, so its address answers
      // with the file itself instead of a redirect to a trailing slash.
      pages: [{ path: "/" }, { path: "/privacy" }, { path: "/terms" }],
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: false,
        crawlLinks: false,
      },
    }),
    viteReact(),
    servedFiles(),
  ],
});

export default config;
