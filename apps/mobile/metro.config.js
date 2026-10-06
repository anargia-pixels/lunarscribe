const { getDefaultConfig } = require("expo/metro-config");

const { withUniwindConfig } = require("uniwind/metro");

// Leave Expo's experimental tree shaking off: it emits Uniwind's style module outside
// a module wrapper, so release builds crash on startup with "Property 'require' doesn't exist".
const config = getDefaultConfig(__dirname);

// Skip native sources: they hold no JS and slow the watcher without Watchman.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /\/node_modules\/(@[^/]+\/)?[^/.][^/]*\/(android|apple|cpp|ios|ReactAndroid|ReactApple|ReactCommon|sdks|third-party-podspecs)(\/.*)?$/,
];

// The editor DOM components are bundled for the web; pick production builds there,
// which is also the only condition Excalidraw's CSS export provides.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: ["browser", "production"],
};

// Use Mermaid's single-file build, so it stays one lazy chunk on editor pages.
const MERMAID_FILES = {
  mermaid: `${__dirname}/mermaid-single-file.js`,
  "mermaid/dist/mermaid.min.js": require.resolve(
    "mermaid/dist/mermaid.min.js",
    {
      paths: [`${__dirname}/../../packages/components`],
    },
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const filePath = platform === "web" ? MERMAID_FILES[moduleName] : undefined;

  return filePath
    ? { type: "sourceFile", filePath }
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
