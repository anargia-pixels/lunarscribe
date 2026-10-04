import type { SavedFileRecord } from "@/lib/browser-database";
import type { FileSearchMatch, SearchMatchRange } from "@/lib/editor-files";
import { readAllFiles } from "@/lib/saved-files";

const MAX_RESULTS = 10;

/**
 * Scores `query` as a case-insensitive subsequence of `name`; lower is better, null when
 * a character is missing. Gaps between matched characters and a late start cost points.
 */
function fuzzyScore(name: string, query: string) {
  const haystack = name.toLowerCase();
  let score = 0;
  let position = -1;

  for (const character of query.toLowerCase()) {
    const next = haystack.indexOf(character, position + 1);

    if (next === -1) {
      return null;
    }

    score += position === -1 ? next : next - position - 1;
    position = next;
  }

  return score;
}

function searchFileNames(files: SavedFileRecord[], query: string) {
  if (!query) {
    // Without a query, recently edited files come first.
    return files
      .toSorted((left, right) => right.modifiedAt - left.modifiedAt)
      .slice(0, MAX_RESULTS)
      .map(({ name }): FileSearchMatch => ({ name }));
  }

  return files
    .flatMap((file) => {
      const score = fuzzyScore(file.name, query);

      return score === null ? [] : [{ name: file.name, score }];
    })
    .toSorted((left, right) => left.score - right.score)
    .slice(0, MAX_RESULTS)
    .map(({ name }): FileSearchMatch => ({ name }));
}

/** Finds the first line containing `query`, with every match on that line. */
function findLineMatch(file: SavedFileRecord, query: string) {
  const needle = query.toLowerCase();
  const lines = file.content.split("\n");

  for (const [index, line] of lines.entries()) {
    const haystack = line.toLowerCase();
    const lineMatchRanges: SearchMatchRange[] = [];

    for (
      let start = haystack.indexOf(needle);
      start !== -1;
      start = haystack.indexOf(needle, start + needle.length)
    ) {
      lineMatchRanges.push([start, start + needle.length]);
    }

    if (lineMatchRanges.length > 0) {
      return {
        name: file.name,
        lineNumber: index + 1,
        lineContent: line,
        lineMatchRanges,
      } satisfies FileSearchMatch;
    }
  }

  return null;
}

function searchFileContent(files: SavedFileRecord[], query: string) {
  const matches: FileSearchMatch[] = [];

  for (const file of files.toSorted((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const match = findLineMatch(file, query);

    if (match) {
      matches.push(match);
    }

    if (matches.length === MAX_RESULTS) {
      break;
    }
  }

  return matches;
}

/** Searches saved files in browser storage by name, or by content when asked. */
export async function searchFiles(query: string, isContentSearch: boolean) {
  const files = await readAllFiles();
  const searchQuery = query.trim();

  if (isContentSearch && searchQuery) {
    return searchFileContent(files, searchQuery);
  }

  return searchFileNames(files, searchQuery);
}
