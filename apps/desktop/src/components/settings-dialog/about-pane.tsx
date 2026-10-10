import { Button } from "@lunarscribe/components/ui/button";
import { Spinner } from "@lunarscribe/components/ui/spinner";
import { Download, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { AppInfo } from "@/lib/updates";
import type { UpdateStatus } from "@/stores/update-store";
import { useUpdateStore } from "@/stores/update-store";

/** Rows of the technical info list, in display order. */
const INFO_ROWS = [
  { key: "version", label: "Version" },
  { key: "electron", label: "Electron" },
  { key: "chromium", label: "Chromium" },
  { key: "node", label: "Node.js" },
  { key: "v8", label: "V8" },
  { key: "operatingSystem", label: "Operating system" },
  { key: "architecture", label: "Architecture" },
  { key: "applicationFolder", label: "Application folder" },
  { key: "userDataFolder", label: "User data folder" },
] as const satisfies readonly { key: keyof AppInfo; label: string }[];

function getUpdateMessage(
  status: UpdateStatus,
  version: string | null,
  error: string | null,
) {
  switch (status) {
    case "idle":
      return "Lunarscribe checks GitHub for a newer release at startup.";
    case "checking":
      return "Checking for updates…";
    case "current":
      return "Lunarscribe is up to date.";
    case "failed":
      return error ?? "Unable to check for updates.";
    case "available":
      return `Lunarscribe ${version} is available.`;
    case "downloading":
      return `Downloading Lunarscribe ${version}…`;
    case "ready":
      return `Lunarscribe ${version} is installed. Save your buffers, then restart to use it.`;
  }
}

/** About pane: version and system details, and checking for and installing updates. */
export function AboutPane() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const status = useUpdateStore((state) => state.status);
  const version = useUpdateStore((state) => state.version);
  const error = useUpdateStore((state) => state.error);
  const check = useUpdateStore((state) => state.check);
  const install = useUpdateStore((state) => state.install);
  const isBusy = status === "checking" || status === "downloading";

  useEffect(() => {
    let isCancelled = false;

    void window.lunarscribe.getAppInfo().then((next) => {
      if (!isCancelled) {
        setInfo(next);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium">About</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {getUpdateMessage(status, version, error)}
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={isBusy || status === "ready"}
          onClick={() => void check(true)}
        >
          {status === "checking" ? (
            <Spinner aria-hidden="true" />
          ) : (
            <RefreshCw />
          )}
          Check for updates
        </Button>
        {(status === "available" || status === "downloading") && (
          <Button
            disabled={status === "downloading"}
            onClick={() => void install()}
          >
            {status === "downloading" ? (
              <Spinner aria-hidden="true" />
            ) : (
              <Download />
            )}
            Update to {version}
          </Button>
        )}
        {status === "ready" && (
          <Button onClick={() => window.lunarscribe.restartApp()}>
            <RotateCw />
            Restart to update
          </Button>
        )}
      </div>
      <dl className="flex max-w-2xl flex-col gap-2 text-sm">
        {INFO_ROWS.map((row) => (
          <div key={row.key} className="flex gap-6">
            <dt className="w-40 shrink-0">{row.label}</dt>
            <dd className="text-muted-foreground min-w-0 break-all select-text">
              {info?.[row.key] ?? "…"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
