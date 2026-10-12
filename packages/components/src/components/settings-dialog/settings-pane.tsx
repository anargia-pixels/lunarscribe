import type { ReactNode } from "react";

/**
 * Frame for one settings section: its content keeps a single readable width and
 * sits centered in the space beside the settings sidebar.
 */
export function SettingsPane({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-auto select-none">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        {children}
      </div>
    </div>
  );
}
