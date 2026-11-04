import { ArrowUpRight01Icon, TextSearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { baseNameOf } from "@lunarscribe/utils/saved-paths";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { SearchHighlight } from "./search-highlight";
import type { SearchMatchRange } from "./search-highlight";

/** Most matches the dialog lists. */
const MAX_RESULTS = 10;

/** Tier of matches that only fit loosely; they keep the backend's ranking. */
const FUZZY_TIER = 2;

/**
 * How closely a file-name match fits `query`; lower is better. A file name containing it
 * beats a path containing it, which beats a fuzzy match. Content matches all tie.
 */
function matchTier(name: string, query: string, isContentSearch: boolean) {
  const needle = query.trim().toLowerCase();

  if (isContentSearch || !needle) {
    return 0;
  }

  if (baseNameOf(name).toLowerCase().includes(needle)) {
    return 0;
  }

  return name.toLowerCase().includes(needle) ? 1 : FUZZY_TIER;
}

/** Whether every character of `query` appears in `name` in order, ignoring case. */
function isFuzzyMatch(name: string, query: string) {
  const haystack = name.toLowerCase();
  let position = 0;

  for (const character of query.toLowerCase()) {
    position = haystack.indexOf(character, position) + 1;

    if (position === 0) {
      return false;
    }
  }

  return true;
}

/** A listed result: a saved file match or a tracked external file. */
type FileSearchResult = FileSearchMatch & {
  key: string;
  /** The external file's key; absent for saved files. */
  externalKey?: string;
  openedAt: number;
};

/**
 * Closer matches first; within a tier, except the fuzzy one, the most recently opened.
 * Fuzzy matches keep the backend's ranking, with external files after saved ones.
 */
function rankResults(
  results: FileSearchResult[],
  query: string,
  isContentSearch: boolean,
) {
  return results
    .map((result) => ({
      result,
      tier: matchTier(result.name, query, isContentSearch),
    }))
    .toSorted((first, second) => {
      if (first.tier !== second.tier) {
        return first.tier - second.tier;
      }

      return first.tier === FUZZY_TIER
        ? 0
        : second.result.openedAt - first.result.openedAt;
    })
    .slice(0, MAX_RESULTS)
    .map(({ result }) => result);
}

/** A saved file returned by file-name or content search. */
export type FileSearchMatch = {
  name: string;
  lineNumber?: number;
  lineContent?: string;
  lineMatchRanges?: SearchMatchRange[];
};

/** A tracked external file; the dialog matches it by name, never by content. */
export type ExternalSearchFile = {
  /** Unique among external files; passed back to `onOpenExternalFile`. */
  key: string;
  name: string;
  /** Epoch milliseconds the file was last opened, if ever. */
  openedAt?: number;
};

/** Saved file matches as results, with when each was last opened. */
function savedResults(
  matches: FileSearchMatch[],
  lastOpenedAt: (name: string) => number | undefined,
): FileSearchResult[] {
  return matches.map((match) => ({
    ...match,
    key: `saved:${match.name}`,
    openedAt: lastOpenedAt(match.name) ?? 0,
  }));
}

/** External files whose names fuzzily match `query`; every file when it is empty. */
function externalResults(
  files: readonly ExternalSearchFile[],
  query: string,
): FileSearchResult[] {
  return files.flatMap((file) =>
    isFuzzyMatch(file.name, query.trim())
      ? [
          {
            key: `external:${file.key}`,
            externalKey: file.key,
            name: file.name,
            openedAt: file.openedAt ?? 0,
          },
        ]
      : [],
  );
}

type FileSearchState = {
  query: string;
  isContentSearch: boolean;
  revision: number;
  matches: FileSearchMatch[];
  error: string | null;
};

/**
 * Searches saved files, and tracked external files by name, and opens the picked match.
 * Each app supplies its search backend, a subscription to saved file changes, its external
 * files, when each file was last opened, and the copy describing where files are searched.
 * Closer name matches list first; within a tier the most recently opened come first,
 * except fuzzy matches, which keep the backend's ranking.
 */
export function FileSearchDialog({
  open,
  onOpenChange,
  searchFiles,
  onFilesChanged,
  onOpenFile,
  lastOpenedAt,
  externalFiles,
  onOpenExternalFile,
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
  /** Epoch milliseconds the saved file was last opened, if ever. */
  lastOpenedAt: (name: string) => number | undefined;
  externalFiles: readonly ExternalSearchFile[];
  onOpenExternalFile: (key: string) => Promise<void>;
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

  const matches = search
    ? rankResults(
        [
          ...savedResults(search.matches, lastOpenedAt),
          ...(search.isContentSearch
            ? []
            : externalResults(externalFiles, search.query)),
        ],
        search.query,
        search.isContentSearch,
      )
    : [];

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
              <HugeiconsIcon icon={TextSearchIcon} strokeWidth={2} />
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
                  key={match.key}
                  value={match.key}
                  disabled={isPending}
                  onSelect={() => {
                    if (isSearching) {
                      return;
                    }

                    void run(async () => {
                      await (match.externalKey === undefined
                        ? onOpenFile(match.name)
                        : onOpenExternalFile(match.externalKey));
                      onOpenChange(false);
                    });
                  }}
                >
                  {match.externalKey !== undefined && (
                    <HugeiconsIcon
                      icon={ArrowUpRight01Icon}
                      strokeWidth={2}
                      aria-label="External file"
                      className="size-3 opacity-60"
                    />
                  )}
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
