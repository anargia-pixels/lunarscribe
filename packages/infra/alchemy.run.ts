// The Cloudflare stack for `bun run deploy`: the web app and the OTA update server.
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import names from "./names.json" with { type: "json" };

/** Settings every Worker shares. */
const WORKER_DEFAULTS = {
  compatibility: { date: "2026-10-01" },
  workersDev: false, // workers.dev hosts only draw bot scans
};

// OTA updates: the files live in R2, and the update server serves them

/** Signed manifests and update files; CI writes them, the update server reads them. */
export const updatesBucket = Cloudflare.R2.Bucket("updates", {
  name: names.updatesBucket, // the publish script writes here by name
});

/** The update server that expo-updates asks on each launch; see apps/update-server. */
export const updateServer = Cloudflare.Worker("update-server", {
  ...WORKER_DEFAULTS,
  name: "lunarscribe-updates",
  main: "../../apps/update-server/src/index.ts",
  env: {
    UPDATES: updatesBucket,
  },
  domain: names.updatesDomain,
});

export type UpdateServerEnv = Cloudflare.InferEnv<typeof updateServer>;

// Web app: landing pages and the browser editor, prerendered as static assets

const web = Cloudflare.Website.Vite("web", {
  ...WORKER_DEFAULTS,
  name: "lunarscribe", // the Worker Workers Builds deployed before Alchemy
  compatibility: { ...WORKER_DEFAULTS.compatibility, flags: ["nodejs_compat"] },
  rootDir: "../../apps/web",
  memo: {
    include: ["**/*", "../../assets/icons/**"], // the served-files plugin copies the icons
    lockfile: true,
  },
  assets: {
    notFoundHandling: "none", // only paths no asset matches reach the Worker
  },
  domain: names.webDomain,
});

// Stack

export default Alchemy.Stack(
  "lunarscribe",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* web;
    yield* updatesBucket;
    const updateWorker = yield* updateServer;

    return {
      web: webWorker.url,
      updates: updateWorker.url,
    };
  }),
);
