import { toast } from "@lunarscribe/components/ui/toast";
import { create } from "zustand";

/**
 * `idle` until a check finishes; `current` and `failed` follow a check from the About
 * pane, since the startup check stays quiet when nothing is found.
 */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "failed"
  | "available"
  | "downloading"
  | "ready";

type UpdateStore = {
  status: UpdateStatus;
  /** The newer release tag, once a check finds one. */
  version: string | null;
  /** Why the last check from the About pane failed. */
  error: string | null;
  /** The startup check runs once; `isManual` checks again and reports the result. */
  check: (isManual: boolean) => Promise<void>;
  install: () => Promise<void>;
};

/** Update state shared by the sidebar update button and the About pane. Not persisted. */
export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  status: "idle",
  version: null,
  error: null,
  check: async (isManual) => {
    const { status } = get();

    const canCheck = isManual
      ? status !== "checking" && status !== "downloading" && status !== "ready"
      : status === "idle";

    if (!canCheck) {
      return;
    }

    set({ status: "checking", error: null });

    const { version, error } = await window.lunarscribe.checkForUpdate();

    if (version !== null) {
      set({ status: "available", version });
    } else if (!isManual) {
      // The startup check stays quiet when nothing is found.
      set({ status: "idle" });
    } else {
      set({ status: error === null ? "current" : "failed", error });
    }
  },
  install: async () => {
    const { status, version } = get();

    if (status !== "available" || version === null) {
      return;
    }

    set({ status: "downloading" });

    const toastId = toast.add({
      type: "loading",
      title: `Downloading Lunarscribe ${version}`,
      timeout: 0,
    });

    const { error } = await window.lunarscribe.installUpdate();

    if (error !== null) {
      set({ status: "available" });
      toast.update(toastId, {
        type: "error",
        title: "Unable to update Lunarscribe",
        description: error,
        timeout: 0,
      });

      return;
    }

    set({ status: "ready" });
    // Restarting drops unsaved buffers, so the user picks the moment.
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
  },
}));
