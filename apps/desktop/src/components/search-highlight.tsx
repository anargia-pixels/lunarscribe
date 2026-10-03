import { Fragment } from "react";

import type { SearchMatchRange } from "@/lib/editor-files";

/** fff exposes content ranges; file-name ranges are inferred from each fuzzy query term. */
function getFileNameMatchRanges(text: string, query: string) {
  const ranges: SearchMatchRange[] = [];

  if (!query.trim()) {
    return ranges;
  }

  let offset = 0;

  const characters = Array.from(text, (character) => {
    const start = offset;
    offset += character.length;

    return { value: character.toLowerCase(), start, end: offset };
  });

  for (const term of query.trim().split(/\s+/u)) {
    const exact = Array.from(
      text.matchAll(new RegExp(RegExp.escape(term), "giu")),
    );

    if (exact.length > 0) {
      for (const match of exact) {
        ranges.push([match.index, match.index + match[0].length]);
      }

      continue;
    }

    // Longest common subsequence keeps matching characters when the query contains a typo.
    const needle = Array.from(term, (character) => character.toLowerCase());
    const width = needle.length + 1;
    const lengths = new Uint32Array((characters.length + 1) * width);

    const lengthAt = (row: number, column: number) =>
      lengths[row * width + column] ?? 0;

    for (let row = characters.length - 1; row >= 0; row -= 1) {
      for (let column = needle.length - 1; column >= 0; column -= 1) {
        lengths[row * width + column] =
          characters[row]?.value === needle[column]
            ? lengthAt(row + 1, column + 1) + 1
            : Math.max(lengthAt(row + 1, column), lengthAt(row, column + 1));
      }
    }

    let row = 0;
    let column = 0;

    while (row < characters.length && column < needle.length) {
      const character = characters[row];

      if (!character) {
        break;
      }

      if (character.value === needle[column]) {
        ranges.push([character.start, character.end]);
        row += 1;
        column += 1;
      } else if (lengthAt(row + 1, column) >= lengthAt(row, column + 1)) {
        row += 1;
      } else {
        column += 1;
      }
    }
  }

  return ranges;
}

/** Marks matching text without changing the label's characters or text width. */
export function SearchHighlight({
  text,
  query = "",
  matchRanges,
}: {
  text: string;
  query?: string;
  matchRanges?: SearchMatchRange[];
}) {
  const ranges = matchRanges ?? getFileNameMatchRanges(text, query);
  const merged: SearchMatchRange[] = [];

  for (const [start, end] of [...ranges].sort(
    (left, right) => left[0] - right[0],
  )) {
    const previous = merged.at(-1);

    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  let cursor = 0;

  const highlighted = merged.map(([start, end]) => {
    const before = text.slice(cursor, start);
    cursor = end;

    return (
      <Fragment key={start}>
        {before}
        <mark className="bg-primary/20 text-foreground rounded-sm">
          {text.slice(start, end)}
        </mark>
      </Fragment>
    );
  });

  return (
    <>
      {highlighted}
      {text.slice(cursor)}
    </>
  );
}
