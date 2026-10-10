import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import routerConfig from "./tsr.config.json" with { type: "json" };

const config = defineConfig({
  publicDir: "../../assets",
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
    }),
    viteReact(),
  ],
});

export default config;
