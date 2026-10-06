/** URL scheme prefix of Google's native sign-in redirects. */
export const GOOGLE_REDIRECT_PREFIX = "com.googleusercontent.apps.";

/** Google redirects a native client to its reversed client ID as a URL scheme. */
export function googleRedirectScheme(clientId: string) {
  return `${GOOGLE_REDIRECT_PREFIX}${clientId.replace(".apps.googleusercontent.com", "")}`;
}
