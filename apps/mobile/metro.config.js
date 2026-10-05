const { getDefaultConfig } = require("expo/metro-config");

const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

// The editor DOM components are bundled for the web; pick production builds there,
// which is also the only condition Excalidraw's CSS export provides.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: ["browser", "production"],
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
