const { SourceSkips } = require("expo/fingerprint");

/** @type {import('expo/fingerprint').Config} */
const config = {
  // The runtime must change only with native code. The app version changes with every
  // release, and package.json scripts are dev tooling; neither reaches the APK.
  sourceSkips:
    SourceSkips.ExpoConfigVersions | SourceSkips.PackageJsonScriptsAll,
};

module.exports = config;
