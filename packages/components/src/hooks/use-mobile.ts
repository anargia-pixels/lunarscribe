import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Tracks whether the window is narrower than the sidebar's mobile breakpoint. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
