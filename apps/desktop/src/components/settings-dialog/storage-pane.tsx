import { StoragePane as SharedStoragePane } from "@lunarscribe/components/settings-dialog/storage-pane";

import { useAppearanceStore } from "@/stores/appearance-store";
import { useBufferStore } from "@/stores/buffer-store";
import { useFileAccessStore } from "@/stores/file-access-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useZoomStore } from "@/stores/zoom-store";

const PERSISTED_STORES = [
  {
    label: "Appearance",
    description: "Theme, fonts and editor options.",
    persist: useAppearanceStore.persist,
  },
  {
    label: "Open files",
    description:
      "The file to reopen on launch and your list of external files.",
    persist: useBufferStore.persist,
  },
  {
    label: "File history",
    description: "When each file was last opened and where you were scrolled.",
    persist: useFileAccessStore.persist,
  },
  {
    label: "Layout",
    description: "Sidebar and outline visibility and width, and open folders.",
    persist: useSidebarStore.persist,
  },
  {
    label: "Zoom",
    description: "The window zoom level.",
    persist: useZoomStore.persist,
  },
];

export function StoragePane() {
  return (
    <SharedStoragePane
      stores={PERSISTED_STORES}
      keptNote="Saved files in your Documents folder and sync sign-ins are not affected."
    />
  );
}
