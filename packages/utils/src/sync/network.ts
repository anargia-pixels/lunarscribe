import { describeFetchFailure } from "../error-message";
import { CLOUD_SYNC_PROVIDER_NAMES } from "./types";
import type { CloudSyncProvider } from "./types";

/** Fetch a cloud provider URL, turning network failures into an actionable message. */
export async function fetchCloud(
  provider: CloudSyncProvider,
  url: string,
  init?: RequestInit,
) {
  try {
    return await fetch(url, init);
  } catch (cause) {
    throw new Error(
      describeFetchFailure(CLOUD_SYNC_PROVIDER_NAMES[provider], url, cause),
      { cause },
    );
  }
}
