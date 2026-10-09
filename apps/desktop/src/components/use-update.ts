import type { SidebarUpdate } from "@lunarscribe/components/sidebar/app-sidebar-header";
import { toast } from "@lunarscribe/components/ui/toast";
import { useEffect, useState } from "react";

/** Asks to restart, which drops unsaved buffers, so the user picks the moment. */
function showRestartToast(toastId: string, version: string) {
  toast.update(toastId, {
    type: "success",
    title: `Lunarscribe ${version} is installed`,
    description: "Save your buffers, then restart to use it.",
    timeout: 0,
    actionProps: {
      children: "Restart",
      onClick: () => window.lunarscribe.restartApp(),
    },
  });
}

/** Checks for a newer release once, then downloads, installs and restarts on request. */
export function useUpdate(): SidebarUpdate | null {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<SidebarUpdate["status"]>("available");

  useEffect(() => {
    let isCancelled = false;

    void window.lunarscribe.checkForUpdate().then((latest) => {
      if (!isCancelled) {
        setVersion(latest);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (version === null) {
    return null;
  }

  const install = async () => {
    setStatus("downloading");

    const toastId = toast.add({
      type: "loading",
      title: `Downloading Lunarscribe ${version}`,
      timeout: 0,
    });

    const { error } = await window.lunarscribe.installUpdate();

    if (error !== null) {
      setStatus("available");
      toast.update(toastId, {
        type: "error",
        title: "Unable to update Lunarscribe",
        description: error,
        timeout: 0,
      });

      return;
    }

    setStatus("ready");
    showRestartToast(toastId, version);
  };

  return {
    version,
    status,
    onClick: () => {
      if (status === "available") {
        void install();
      }

      if (status === "ready") {
        window.lunarscribe.restartApp();
      }
    },
  };
}
