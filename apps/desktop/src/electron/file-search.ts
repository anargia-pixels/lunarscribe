import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { FileFinder, GrepCursor } from "@ff-labs/fff-node";
import { app, ipcMain } from "electron";

import { getFileExtension } from "../lib/editor-files";
import type { FileSearchMatch } from "../lib/editor-files";

const MAX_RESULTS = 10;

function searchFileContent(
  fileFinder: FileFinder,
  query: string,
  savedNames: Set<string>,
) {
  const matches: FileSearchMatch[] = [];

  let cursor: GrepCursor | null = null;

  do {
    const grepResponse = fileFinder.grep(query, {
      mode: "plain",
      pageSize: MAX_RESULTS,
      maxMatchesPerFile: 1,
      cursor,
    });

    if (!grepResponse.ok) {
      throw new Error(grepResponse.error);
    }

    for (const match of grepResponse.value.items) {
      if (savedNames.delete(match.relativePath)) {
        const bytes = Buffer.from(match.lineContent, "utf8");

        matches.push({
          name: match.relativePath,
          lineNumber: match.lineNumber,
          lineContent: match.lineContent,
          lineMatchRanges: match.matchRanges.map(([start, end]) => [
            bytes.subarray(0, start).toString("utf8").length,
            bytes.subarray(0, end).toString("utf8").length,
          ]),
        });
      }

      if (matches.length === MAX_RESULTS) {
        return matches;
      }
    }

    cursor = grepResponse.value.nextCursor;
  } while (cursor !== null && savedNames.size > 0);

  return matches;
}

function searchFileNames(
  fileFinder: FileFinder,
  query: string,
  savedNames: Set<string>,
) {
  const matches: FileSearchMatch[] = [];

  for (let pageIndex = 0; savedNames.size > 0; pageIndex += 1) {
    const fileResponse = fileFinder.fileSearch(query, {
      pageSize: MAX_RESULTS,
      pageIndex,
    });

    if (!fileResponse.ok) {
      throw new Error(fileResponse.error);
    }

    for (const file of fileResponse.value.items) {
      if (savedNames.delete(file.relativePath)) {
        matches.push({ name: file.relativePath });
      }

      if (matches.length === MAX_RESULTS) {
        return matches;
      }
    }

    if ((pageIndex + 1) * MAX_RESULTS >= fileResponse.value.totalMatched) {
      break;
    }
  }

  return matches;
}

/** Owns a lazy fff index scoped to the same folder as saved buffers. */
export function registerFileSearch(folder: string) {
  let finder: FileFinder | null = null;
  let finderReady: Promise<FileFinder> | null = null;

  async function createFinder() {
    // Rust opens the shared library directly, so the SDK must resolve it outside asar.
    const sdk: typeof import("@ff-labs/fff-node") = app.isPackaged
      ? await import(
          pathToFileURL(
            join(
              process.resourcesPath,
              "app.asar.unpacked/node_modules/@ff-labs/fff-node/dist/index.js",
            ),
          ).href
        )
      : await import("@ff-labs/fff-node");

    const createdFinder = sdk.FileFinder.create({ basePath: folder });

    if (!createdFinder.ok) {
      throw new Error(createdFinder.error);
    }

    finder = createdFinder.value;

    const scan = await finder.waitForScan();

    if (!scan.ok || !scan.value) {
      finder.destroy();
      finder = null;

      throw new Error(scan.ok ? "File search indexing timed out." : scan.error);
    }

    return finder;
  }

  ipcMain.handle(
    "files:search",
    async (
      _event,
      query: string,
      isContentSearch: boolean,
    ): Promise<FileSearchMatch[]> => {
      finderReady ??= createFinder().catch((cause) => {
        finderReady = null;

        throw cause;
      });

      const fileFinder = await finderReady;
      const entries = await readdir(folder, { withFileTypes: true });
      const savedNames = new Set<string>();

      for (const entry of entries) {
        // Saved files are flat; exclude subfolders and symlinks to external files.
        if (entry.isFile() && getFileExtension(entry.name) !== null) {
          savedNames.add(entry.name);
        }
      }

      const searchQuery = query.trim();

      if (isContentSearch && searchQuery) {
        return searchFileContent(fileFinder, searchQuery, savedNames);
      }

      return searchFileNames(fileFinder, searchQuery, savedNames);
    },
  );

  app.once("will-quit", () => finder?.destroy());
}
