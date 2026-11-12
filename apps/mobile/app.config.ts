import type { ConfigContext, ExpoConfig } from "expo/config";

import names from "../../packages/infra/names.json";
import codeSigning from "./certs/code-signing.json";
import publicCredentials from "./src/lib/sync/public-creds.json";

/**
 * Google redirects a native sign-in to the reversed client ID, so each client's
 * scheme is registered once its ID is set. Expo cannot load `src/` modules here,
 * so this repeats `googleRedirectScheme`.
 */
function googleScheme(clientId: string) {
  return clientId.trim()
    ? [
        `com.googleusercontent.apps.${clientId.trim().replace(".apps.googleusercontent.com", "")}`,
      ]
    : [];
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Lunarscribe",
  slug: "lunarscribe",
  version: "0.13.43",
  orientation: "default",
  // The desktop app icon. Absolute, because Expo Go requests it as `/assets/<path>`
  // and a leading `../` collapses out of that URL.
  icon: `${projectRoot}/../../assets/icons/512x512.png`,
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.lunarscribe.app",
    supportsTablet: true,
  },
  android: {
    package: "com.lunarscribe.app",
    softwareKeyboardLayoutMode: "resize",
  },
  scheme: [
    "lunarscribe",
    ...googleScheme(publicCredentials.googleIosClientId),
    ...googleScheme(publicCredentials.googleAndroidClientId),
  ],
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-updates",
    [
      "expo-splash-screen",
      {
        // The theme backgrounds from globals.css. At 128dp the square icon fits
        // inside the circle that Android 12 and later crop the splash icon to.
        image: `${projectRoot}/../../assets/icons/512x512.png`,
        imageWidth: 128,
        backgroundColor: "#f5f1e6",
        dark: { backgroundColor: "#1e1e2e" },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // The runtime is a fingerprint of the native code. An OTA update applies only to an
  // APK with the same fingerprint; fingerprint.config.js keeps the app version out.
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: `https://${names.updatesDomain}/manifest`, // see apps/update-server
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0, // start at once; a new update applies on the next cold start
    codeSigningCertificate: codeSigning.certificate,
    codeSigningMetadata: { keyid: codeSigning.keyid, alg: "rsa-v1_5-sha256" },
  },
});
