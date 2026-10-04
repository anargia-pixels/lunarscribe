import { useAsyncAction } from "@lunarscribe/components/hooks/use-async-action";
import { Alert, AlertDescription } from "@lunarscribe/components/ui/alert";
import { Button } from "@lunarscribe/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@lunarscribe/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@lunarscribe/components/ui/dialog";
import { Kbd, KbdGroup } from "@lunarscribe/components/ui/kbd";
import { Toggle } from "@lunarscribe/components/ui/toggle";
import { errorMessage } from "@lunarscribe/utils/error-message";
import { FileText, PenTool, TextSearch } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { SearchHighlight } from "./search-highlight";
import type { SearchMatchRange } from "./search-highlight";

/** A saved file returned by file-name or content search. */
export type FileSearchMatch = {
  name: string;
  lineNumber?: number;
  lineContent?: string;
  lineMatchRanges?: SearchMatchRange[];
};

type FileSearchState = {
  query: string;
  isContentSearch: boolean;
  revision: number;
  matches: FileSearchMatch[];
  error: string | null;
};

/**
 * Searches saved files and opens the picked match. Each app supplies its search backend,
 * a subscription to saved file changes, and the copy describing where files are searched.
 */
export function FileSearchDialog({
  open,
  onOpenChange,
  searchFiles,
  onFilesChanged,
  onOpenFile,
  isDrawing,
  scopeDescription,
  scopeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchFiles: (
    query: string,
    isContentSearch: boolean,
  ) => Promise<FileSearchMatch[]>;
  onFilesChanged: (listener: () => void) => () => void;
  onOpenFile: (name: string) => Promise<void>;
  isDrawing: (name: string) => boolean;
  scopeDescription: string;
  scopeLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [isContentSearch, setIsContentSearch] = useState(false);

  const [search, setSearch] = useState<FileSearchState | null>(null);

  const [revision, setRevision] = useState(0);

  const isSearching =
    search === null ||
    search.query !== query ||
    search.isContentSearch !== isContentSearch ||
    search.revision !== revision;

  const matches = search?.matches ?? [];
  const searchError = isSearching ? null : search.error;

  let emptyMessage = "No matching files";

  if (isSearching) {
    emptyMessage = "Searching…";
  } else if (searchError) {
    emptyMessage = "Search unavailable";
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const { run, isPending, error } = useAsyncAction("Unable to open the file.");

  // Effect events read the latest callbacks, so callers need not pass stable functions.
  const subscribeToFiles = useEffectEvent(() =>
    onFilesChanged(() => setRevision((current) => current + 1)),
  );

  const runSearch = useEffectEvent(searchFiles);

  useEffect(() => {
    return subscribeToFiles();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    const timer = window.setTimeout(async () => {
      let matches: FileSearchMatch[] = [];
      let error: string | null = null;

      try {
        matches = await runSearch(query, isContentSearch);
      } catch (cause) {
        error = errorMessage(cause, "Unable to search saved files.");
      }

      if (!isCancelled) {
        setSearch({ query, isContentSearch, revision, matches, error });
      }
    }, 120);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, isContentSearch, revision]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-16 max-h-4/5 translate-y-0 sm:max-w-xl"
        padded={false}
        showCloseButton={false}
        initialFocus={inputRef}
      >
        <DialogTitle className="sr-only">Search files</DialogTitle>
        <DialogDescription className="sr-only">
          {scopeDescription}
        </DialogDescription>
        <Command className="min-h-0" shouldFilter={false}>
          <div className="flex shrink-0 items-end gap-1 p-1">
            <div className="min-w-0 flex-1">
              <CommandInput
                ref={inputRef}
                aria-label={
                  isContentSearch ? "Search file content" : "Search file names"
                }
                placeholder={
                  isContentSearch
                    ? "Search file content…"
                    : "Search file names…"
                }
                value={query}
                onValueChange={setQuery}
              />
            </div>
            <Toggle
              variant="outline"
              className="mr-1"
              aria-label="Search file content"
              pressed={isContentSearch}
              onPressedChange={setIsContentSearch}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                }
              }}
            >
              <TextSearch />
              Content
            </Toggle>
          </div>
          {(searchError || error) && (
            <div className="shrink-0 px-2 py-1">
              <Alert variant="destructive">
                <AlertDescription>{searchError ?? error}</AlertDescription>
                {searchError && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevision((current) => current + 1)}
                  >
                    Retry
                  </Button>
                )}
              </Alert>
            </div>
          )}
          <CommandList
            className="min-h-0"
            aria-label="Matching files"
            aria-busy={isSearching}
          >
            <CommandEmpty aria-live="polite">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {matches.map((match) => (
                <CommandItem
                  key={match.name}
                  value={match.name}
                  disabled={isPending}
                  onSelect={() => {
                    if (isSearching) {
                      return;
                    }

                    void run(async () => {
                      await onOpenFile(match.name);
                      onOpenChange(false);
                    });
                  }}
                >
                  {isDrawing(match.name) ? <PenTool /> : <FileText />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <SearchHighlight
                        text={match.name}
                        query={search?.isContentSearch ? "" : search?.query}
                      />
                    </div>
                    {match.lineContent && (
                      <div className="text-muted-foreground truncate text-xs">
                        <SearchHighlight
                          text={match.lineContent}
                          matchRanges={match.lineMatchRanges}
                        />
                      </div>
                    )}
                  </div>
                  {match.lineNumber && (
                    <CommandShortcut>:{match.lineNumber}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="text-muted-foreground flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-xs">
            <span aria-live="polite">
              {isSearching ? "Searching…" : scopeLabel}
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <KbdGroup>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </KbdGroup>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Enter</Kbd>
                Open
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd>
                Close
              </span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
