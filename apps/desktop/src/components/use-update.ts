import type { SidebarUpdate } from "@lunarscribe/components/sidebar/app-sidebar-header";
import { useEffect } from "react";

import { useUpdateStore } from "@/stores/update-store";

/** Checks for a newer release once, then offers the sidebar update button while one applies. */
export function useUpdate(): SidebarUpdate | null {
  const status = useUpdateStore((state) => state.status);
  const version = useUpdateStore((state) => state.version);
  const check = useUpdateStore((state) => state.check);
  const install = useUpdateStore((state) => state.install);

  useEffect(() => {
    void check(false);
  }, [check]);

  if (
    version === null ||
    (status !== "available" && status !== "downloading" && status !== "ready")
  ) {
    return null;
  }

  return {
    version,
    status,
    onClick: () =>
      status === "ready" ? window.lunarscribe.restartApp() : void install(),
  };
}
