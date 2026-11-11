/** Half-open JavaScript string offsets for highlighting a search match. */
export type SearchMatchRange = [start: number, end: number];

/** A saved file returned by file-name or content search. */
export type FileSearchMatch = {
  name: string;
  lineNumber?: number;
  lineContent?: string;
  lineMatchRanges?: SearchMatchRange[]; // converted from fff's UTF-8 byte offsets
};
