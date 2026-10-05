import { FILE_SECTIONS } from "@lunarscribe/utils/sidebar-sections";
import { useRouter } from "expo-router";
import {
  Button,
  ListGroup,
  SearchField,
  Separator,
  Tabs,
  Typography,
  useThemeColor,
} from "heroui-native";
import { Plus, Settings } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { DarkmodeToggle } from "@/components/darkmode-toggle";
import { DeleteFileDialog } from "@/components/delete-file-dialog";
import { FileErrorAlert } from "@/components/file-error-alert";
import { FileListItem } from "@/components/file-list-item";
import { RenameFileDialog } from "@/components/rename-file-dialog";
import { SyncAlert } from "@/components/sync-alert";
import { type FileSearchMatch, searchFiles } from "@/lib/documents-folder";
import { kindOf } from "@/lib/editor-files";
import type { EditorKind } from "@/lib/editor-types";
import { useActiveBuffer, useBufferStore } from "@/stores/buffer-store";
import { useSyncStore } from "@/stores/sync-store";

type FileDialogState = { kind: "rename" | "delete"; name: string };

type FileItem = { name: string; description?: string };

/** Mobile sections, one tab each: saved notes and drawings. External files are desktop-only for now. */
const SECTIONS = FILE_SECTIONS.flatMap((section) =>
  section.kind === "external" ? [] : [section],
);

function isEditorKind(value: string): value is EditorKind {
  return SECTIONS.some((section) => section.kind === value);
}

/** Searches saved files as the query changes, dropping results from older queries. */
function useFileSearch(query: string) {
  const [matches, setMatches] = useState<FileSearchMatch[]>([]);

  useEffect(() => {
    let isCancelled = false;

    searchFiles(query).then(
      (results) => !isCancelled && setMatches(results),
      () => !isCancelled && setMatches([]),
    );

    return () => {
      isCancelled = true;
    };
  }, [query]);

  return matches;
}

function reportFileError(name: string, message: string) {
  useBufferStore.setState({ fileError: `${name}: ${message}` });
}

/** Saved notes and drawings; the mobile stand-in for the desktop sidebar. */
export default function FilesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<FileDialogState | null>(null);
  const [activeKind, setActiveKind] = useState<EditorKind>("markdown");
  const foreground = useThemeColor("foreground");

  const files = useBufferStore((state) => state.files);
  const refreshFiles = useBufferStore((state) => state.refreshFiles);
  const openFile = useBufferStore((state) => state.openFile);
  const createBuffer = useBufferStore((state) => state.createBuffer);
  const renameFile = useBufferStore((state) => state.renameFile);
  const deleteFile = useBufferStore((state) => state.deleteFile);
  const forceSyncFile = useBufferStore((state) => state.forceSyncFile);
  const isSyncConnected = useSyncStore((state) => state.provider !== null);
  const activeFileName = useActiveBuffer()?.fileName ?? null;
  const matches = useFileSearch(query);

  useEffect(refreshFiles, [refreshFiles]);

  function openInEditor(name: string) {
    openFile(name).then(
      () => router.push("/editor"),
      (error) => reportFileError(name, String(error)),
    );
  }

  function createInEditor(kind: EditorKind) {
    createBuffer(kind);
    router.push("/editor");
  }

  const isSearching = query.trim() !== "";

  /** The active search's matches, or every saved file, in the tab for `kind`. */
  function itemsOf(kind: EditorKind): FileItem[] {
    if (!isSearching) {
      return files
        .filter((name) => kindOf(name) === kind)
        .map((name) => ({ name }));
    }

    return matches
      .filter((match) => kindOf(match.name) === kind)
      .map((match) => ({ name: match.name, description: match.lineContent }));
  }

  const renderList = (items: FileItem[]) => (
    <ListGroup>
      {items.map(({ name, description }, index) => (
        <Fragment key={name}>
          {index > 0 && <Separator className="mx-4" />}
          <FileListItem
            name={name}
            description={description}
            isActive={name === activeFileName}
            onOpen={() => openInEditor(name)}
            onRename={() => setDialog({ kind: "rename", name })}
            onDelete={() => setDialog({ kind: "delete", name })}
            onForceSync={
              isSyncConnected
                ? () =>
                    forceSyncFile(name).catch((error) =>
                      reportFileError(name, String(error)),
                    )
                : undefined
            }
          />
        </Fragment>
      ))}
    </ListGroup>
  );

  return (
    <View className="bg-background pt-safe pb-safe flex-1">
      <View className="h-12 flex-row items-center gap-1 px-3">
        <Typography.Heading type="h5" className="font-logo text-accent flex-1">
          Lunarscribe
        </Typography.Heading>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          accessibilityLabel={
            activeKind === "drawing" ? "New drawing" : "New note"
          }
          onPress={() => createInEditor(activeKind)}
        >
          <Plus size={20} color={foreground} />
        </Button>
        <DarkmodeToggle />
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Settings size={18} color={foreground} />
        </Button>
      </View>
      <View className="px-4 pb-3">
        <SearchField value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search saved files" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </View>
      <FileErrorAlert />
      <SyncAlert />
      <Tabs
        value={activeKind}
        onValueChange={(value) => {
          if (isEditorKind(value)) {
            setActiveKind(value);
          }
        }}
        className="flex-1 gap-3"
      >
        {/* Tabs, in the desktop tabs' colors */}
        <Tabs.List className="bg-surface-secondary mx-4">
          <Tabs.Indicator className="bg-background dark:border-surface-tertiary dark:bg-surface-tertiary/30 dark:border" />
          {SECTIONS.map((section) => (
            <Tabs.Trigger
              key={section.section}
              value={section.kind}
              className="flex-1"
            >
              <Tabs.Label className="text-sm">{`${section.label} · ${itemsOf(section.kind).length}`}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {SECTIONS.map((section) => {
          const items = itemsOf(section.kind);

          return (
            <Tabs.Content
              key={section.section}
              value={section.kind}
              className="flex-1"
            >
              <ScrollView contentContainerClassName="gap-2 px-4 pb-8">
                {items.length > 0 ? (
                  renderList(items)
                ) : (
                  <Typography
                    type="body-sm"
                    color="muted"
                    align="center"
                    className="py-8"
                  >
                    {isSearching
                      ? `No ${section.label.toLowerCase()} match.`
                      : `No ${section.label.toLowerCase()} yet. Press + to create one.`}
                  </Typography>
                )}
              </ScrollView>
            </Tabs.Content>
          );
        })}
      </Tabs>
      {dialog?.kind === "rename" && (
        <RenameFileDialog
          key={dialog.name}
          name={dialog.name}
          onClose={() => setDialog(null)}
          onRename={(title) => renameFile(dialog.name, title)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteFileDialog
          key={dialog.name}
          name={dialog.name}
          onClose={() => setDialog(null)}
          onDelete={() => deleteFile(dialog.name)}
        />
      )}
    </View>
  );
}
