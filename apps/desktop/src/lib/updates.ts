/** A newer release tag such as `v1.2.3`, or `error` when the check could not finish. */
export type UpdateCheck = { version: string | null; error: string | null };

/** Versions and folders shown on the About pane. */
export type AppInfo = {
  version: string;
  electron: string;
  chromium: string;
  node: string;
  v8: string;
  operatingSystem: string;
  architecture: string;
  applicationFolder: string;
  userDataFolder: string;
};
