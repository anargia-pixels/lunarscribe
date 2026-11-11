// Write Expo Router's typed routes to .expo/types without a dev server, so
// `check-types` sees routes added since the last `expo start`.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

type TypedRoutes = {
  regenerateDeclarations: (
    directory: string,
    options: Record<string, never>,
  ) => void;
};

const projectRoot = join(import.meta.dir, "..");

const typesDirectory = join(projectRoot, ".expo/types");

const fromProject = createRequire(join(projectRoot, "package.json"));

const fromRouter = createRequire(
  fromProject.resolve("expo-router/package.json"),
);

// Expo Router reads its app folder from this variable outside Metro.
process.env.EXPO_ROUTER_APP_ROOT = join(projectRoot, "src/app");

const typedRoutes: TypedRoutes = fromRouter(
  "@expo/router-server/build/typed-routes",
);

mkdirSync(typesDirectory, { recursive: true });

typedRoutes.regenerateDeclarations(typesDirectory, {}); // writes after a 1 s debounce
