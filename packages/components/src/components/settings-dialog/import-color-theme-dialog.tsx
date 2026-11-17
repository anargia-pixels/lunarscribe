import { CloudDownloadIcon, FileImportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ImportedColorTheme } from "@lunarscribe/components/themes/imported-color-themes";
import {
  loadOpenVsxColorThemes,
  type OpenVsxExtension,
  searchOpenVsxThemes,
} from "@lunarscribe/components/themes/open-vsx";
import {
  fetchT3Skin,
  listT3Skins,
  type T3SkinSummary,
} from "@lunarscribe/components/themes/t3-skins";
import {
  colorThemesFromFile,
  colorThemesFromText,
} from "@lunarscribe/components/themes/theme-files";
import { Badge } from "@lunarscribe/components/ui/badge";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@lunarscribe/components/ui/empty";
import { Input } from "@lunarscribe/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@lunarscribe/components/ui/item";
import { Label } from "@lunarscribe/components/ui/label";
import { ScrollArea } from "@lunarscribe/components/ui/scroll-area";
import { Spinner } from "@lunarscribe/components/ui/spinner";
import {
  TabItem,
  TabPanel,
  Tabs,
  TabsList,
} from "@lunarscribe/components/ui/tabs";
import { errorMessage } from "@lunarscribe/utils/error-message";
import { type DragEvent, type ReactNode, useEffect, useState } from "react";

type ImportSource = "t3-skins" | "vscode" | "file";

type SearchState<Result> =
  | { status: "loading" }
  | { status: "ready"; results: Result[] }
  | { status: "error"; message: string };

const SEARCH_DELAY_MS = 300;

/** Results for `query`, fetched a moment after typing stops; `retry` runs the search again. */
function useSearch<Result>(
  query: string,
  search: (query: string, signal: AbortSignal) => Promise<Result[]>,
) {
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${query}`;

  // Each settled search remembers what it answered, so a newer query reads as loading.
  const [settled, setSettled] = useState<{
    key: string;
    state: SearchState<Result>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      search(query, controller.signal).then(
        (results) => setSettled({ key, state: { status: "ready", results } }),
        (error) => {
          if (!controller.signal.aborted) {
            setSettled({
              key,
              state: {
                status: "error",
                message: errorMessage(error, "The search failed."),
              },
            });
          }
        },
      );
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, query, search]);

  const state: SearchState<Result> =
    settled?.key === key ? settled.state : { status: "loading" };

  return { state, retry: () => setAttempt((previous) => previous + 1) };
}

/** Runs one import at a time and remembers which result it came from. */
function useImport(onImport: (themes: ImportedColorTheme[]) => void) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (
    key: string,
    load: () => Promise<ImportedColorTheme[]>,
  ) => {
    setBusyKey(key);
    setMessage(null);

    try {
      const themes = await load();

      onImport(themes);
      const [first] = themes;

      setMessage(
        themes.length === 1 && first !== undefined
          ? `Imported ${first.label}.`
          : `Imported ${themes.length} color themes. Pick one under Light theme or Dark theme.`,
      );
    } catch (error) {
      setMessage(errorMessage(error, "The import failed."));
    } finally {
      setBusyKey(null);
    }
  };

  return { busyKey, message, run };
}

/** Loading, error and empty states shared by both galleries. */
function SearchResults<Result>({
  state,
  retry,
  emptyLabel,
  children,
}: {
  state: SearchState<Result>;
  retry: () => void;
  emptyLabel: string;
  children: (results: Result[]) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Couldn’t load themes</EmptyTitle>
          <EmptyDescription>{state.message}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={retry}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (state.results.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyLabel}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      {children(state.results)}
    </ScrollArea>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  return (
    <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
      {message}
    </p>
  );
}

/** The T3 Skins gallery: each skin with its preview, and an Install button. */
function T3SkinsPanel({
  importedIds,
  onImport,
}: {
  importedIds: ReadonlySet<string>;
  onImport: (themes: ImportedColorTheme[]) => void;
}) {
  const [query, setQuery] = useState("");
  const { state, retry } = useSearch<T3SkinSummary>(query, listT3Skins);
  const { busyKey, message, run } = useImport(onImport);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Input
        type="search"
        placeholder="Search T3 Skins"
        aria-label="Search T3 Skins"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <SearchResults state={state} retry={retry} emptyLabel="No skins found">
        {(skins) => (
          <div className="grid grid-cols-2 gap-3 pr-3 pb-1">
            {skins.map((skin) => {
              const isInstalled = importedIds.has(`t3-skins:${skin.slug}`);

              return (
                <Item key={skin.slug} variant="outline" className="items-start">
                  <img
                    src={skin.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="bg-muted aspect-video w-full rounded-md object-cover"
                  />
                  <ItemContent>
                    <ItemTitle>{skin.name}</ItemTitle>
                    <ItemDescription>
                      {skin.author ? `by ${skin.author}` : skin.description}
                    </ItemDescription>
                    <div className="flex gap-1">
                      {skin.modes.map((mode) => (
                        <Badge key={mode} variant="secondary">
                          {mode === "light" ? "Light" : "Dark"}
                        </Badge>
                      ))}
                    </div>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant={isInstalled ? "outline" : "default"}
                      size="sm"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void run(skin.slug, async () => [
                          await fetchT3Skin(skin),
                        ])
                      }
                    >
                      {busyKey === skin.slug && <Spinner />}
                      {isInstalled ? "Reinstall" : "Install"}
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </div>
        )}
      </SearchResults>
      <StatusMessage message={message} />
    </div>
  );
}

const downloadCount = new Intl.NumberFormat(undefined, { notation: "compact" });

/** Open VSX theme extensions; importing one adds every color theme it ships. */
function VsCodePanel({
  importedIds,
  onImport,
}: {
  importedIds: ReadonlySet<string>;
  onImport: (themes: ImportedColorTheme[]) => void;
}) {
  const [query, setQuery] = useState("");

  const { state, retry } = useSearch<OpenVsxExtension>(
    query,
    searchOpenVsxThemes,
  );

  const { busyKey, message, run } = useImport(onImport);
  const imported = [...importedIds];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Input
        type="search"
        placeholder="Search VS Code themes on Open VSX"
        aria-label="Search VS Code themes on Open VSX"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <SearchResults
        state={state}
        retry={retry}
        emptyLabel="No theme extensions found"
      >
        {(extensions) => (
          <div className="pr-3 pb-1">
            <ItemGroup>
              {extensions.map((extension) => {
                const key = `${extension.namespace}.${extension.name}`;
                const prefix = `vscode:${key.toLowerCase()}:`;

                const isInstalled = imported.some((id) =>
                  id.startsWith(prefix),
                );

                return (
                  <Item key={key} variant="outline" size="sm">
                    <ItemMedia variant="image">
                      {extension.iconUrl && (
                        <img src={extension.iconUrl} alt="" loading="lazy" />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{extension.displayName}</ItemTitle>
                      <ItemDescription>
                        {extension.namespace} ·{" "}
                        {downloadCount.format(extension.downloadCount)}{" "}
                        downloads
                        {extension.description && ` · ${extension.description}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant={isInstalled ? "outline" : "default"}
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void run(key, () => loadOpenVsxColorThemes(extension))
                        }
                      >
                        {busyKey === key && <Spinner />}
                        {isInstalled ? "Reimport" : "Import"}
                      </Button>
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </div>
        )}
      </SearchResults>
      <StatusMessage message={message} />
    </div>
  );
}

/** A dropped or chosen theme file, or theme JSON pasted from the clipboard. */
function FilePanel({
  onImport,
}: {
  onImport: (themes: ImportedColorTheme[]) => void;
}) {
  const { busyKey, message, run } = useImport(onImport);
  const [isDragging, setIsDragging] = useState(false);

  const importFile = (file: File | undefined) => {
    if (file !== undefined) {
      void run("file", () => colorThemesFromFile(file));
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    importFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="data-dragging:border-primary flex flex-1 rounded-xl border border-dashed"
        data-dragging={isDragging || undefined}
      >
        <Empty
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={FileImportIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Drop a theme file here</EmptyTitle>
            <EmptyDescription>
              A T3 skin (.json), a VS Code color theme (.json), or a VS Code
              extension (.vsix).
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busyKey !== null}
              render={<Label />}
              nativeButton={false}
            >
              {busyKey === "file" && <Spinner />}
              Choose file
              <Input
                type="file"
                accept=".json,.jsonc,.vsix,application/json"
                className="sr-only"
                onChange={(event) => {
                  importFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </Button>
            <Button
              variant="outline"
              disabled={busyKey !== null}
              onClick={() =>
                void run("clipboard", async () =>
                  colorThemesFromText(await navigator.clipboard.readText()),
                )
              }
            >
              {busyKey === "clipboard" && <Spinner />}
              Paste JSON
            </Button>
          </div>
        </Empty>
      </div>
      <StatusMessage message={message} />
    </div>
  );
}

/**
 * Imports color themes from T3 Skins, from VS Code theme extensions on Open
 * VSX, or from a file. Imported color themes reach the app through `onImport`.
 */
export function ImportColorThemeDialog({
  open,
  onOpenChange,
  importedIds,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importedIds: ReadonlySet<string>;
  onImport: (themes: ImportedColorTheme[]) => void;
}) {
  const [source, setSource] = useState<ImportSource>("t3-skins");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-4/5 flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import color theme</DialogTitle>
          <DialogDescription>
            Install a skin from T3 Skins, a VS Code theme from Open VSX, or a
            theme file.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={source}
          onValueChange={(next) => {
            if (next === "t3-skins" || next === "vscode" || next === "file") {
              setSource(next);
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList>
            <TabItem value="t3-skins" label="T3 Skins" />
            <TabItem value="vscode" label="VS Code" icon={CloudDownloadIcon} />
            <TabItem value="file" label="File" icon={FileImportIcon} />
          </TabsList>
          <TabPanel value="t3-skins" className="mt-3 min-h-0 flex-1">
            <T3SkinsPanel importedIds={importedIds} onImport={onImport} />
          </TabPanel>
          <TabPanel value="vscode" className="mt-3 min-h-0 flex-1">
            <VsCodePanel importedIds={importedIds} onImport={onImport} />
          </TabPanel>
          <TabPanel value="file" className="mt-3 min-h-0 flex-1">
            <FilePanel onImport={onImport} />
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
