/** Justifies a paragraph with @kitlangton/justice and DOM measurements. */

import { prepare, solve, type Line } from "@kitlangton/justice";

// Constants

/** Maximum gap, in natural spaces. Wider gaps look like holes. */
const MAX_GAP_RATIO = 2;

/** Elements that only style their text. Each line can hold a copy of them. */
const INLINE = new Set([
  "A",
  "ABBR",
  "B",
  "CITE",
  "CODE",
  "EM",
  "I",
  "KBD",
  "MARK",
  "Q",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "TIME",
  "U",
  "VAR",
]);

/** ASCII whitespace. The engine keeps a non-breaking space inside a word. */
const SPACES = /[ \t\n\f\r]+/u;

// Types

/** Text and the inline element that holds it, or null for bare text. */
type Run = { text: string; owner: Element | null };

// Helpers

/**
 * Splits the paragraph into words. Each word is a list of runs.
 * Returns null when the paragraph has markup that a line cannot hold, such as
 * a nested element.
 */
function splitWords(host: HTMLElement): Run[][] | null {
  const runs: Run[] = [];

  for (const node of host.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? "", owner: null });
    } else if (node instanceof Element) {
      if (!INLINE.has(node.tagName) || node.childElementCount > 0) {
        return null;
      }

      runs.push({ text: node.textContent ?? "", owner: node });
    }
  }

  const words: Run[][] = [];
  let word: Run[] = [];

  for (const run of runs) {
    for (const [index, piece] of run.text.split(SPACES).entries()) {
      // A space before this piece ends the current word.
      if (index > 0 && word.length) {
        words.push(word);
        word = [];
      }

      if (piece) {
        word.push({ text: piece, owner: run.owner });
      }
    }
  }

  if (word.length) {
    words.push(word);
  }

  return words;
}

/** Adds a run, and joins it to the last run when both have the same element. */
function appendRun(runs: Run[], run: Run) {
  const last = runs.at(-1);

  if (last && last.owner === run.owner) {
    last.text += run.text;
  } else {
    runs.push({ ...run });
  }
}

/** Makes DOM nodes for runs. An owned run goes in a copy of its element. */
function toNodes(runs: Run[]) {
  return runs.map((run): Node => {
    if (!run.owner) {
      return document.createTextNode(run.text);
    }

    const copy = run.owner.cloneNode(false);

    copy.textContent = run.text;

    return copy;
  });
}

/**
 * Measures the space and each word in one pass, in the paragraph's font.
 * Each item is an inline block, so a code chip's padding is in its width.
 */
function measure(host: HTMLElement, words: Run[][]) {
  const box = document.createElement("div");

  box.style.cssText =
    "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre";

  const probes = [[{ text: " ", owner: null }], ...words].map((runs) => {
    const probe = document.createElement("span");

    probe.style.display = "inline-block";
    probe.append(...toNodes(runs));
    box.append(probe);

    return probe;
  });

  host.append(box);

  const [space = 0, ...widths] = probes.map(
    (probe) => probe.getBoundingClientRect().width,
  );

  box.remove();

  return { space, widths };
}

/** Makes one line: a nowrap block with the engine's word and letter spacing. */
function toRow(words: Run[][], line: Line) {
  const runs: Run[] = [];

  for (const word of words.slice(line.start, line.end)) {
    const last = runs.at(-1);

    // Keep the space in an element that continues, so a link has one underline.
    if (last) {
      const owner = last.owner === word[0]?.owner ? last.owner : null;

      appendRun(runs, { text: " ", owner });
    }

    for (const run of word) {
      appendRun(runs, run);
    }
  }

  const row = document.createElement("span");

  row.style.display = "block";
  row.style.whiteSpace = "nowrap";
  row.style.wordSpacing = `${line.wordSpacing}px`;
  row.style.letterSpacing = `${line.tracking}px`;
  row.style.marginLeft = `${-line.opening}px`;
  row.append(...toNodes(runs));

  return row;
}

// Justify

/**
 * Replaces the paragraph's content with justified lines of selectable text.
 * The paragraph does not change when the fit is bad: one line, a break inside
 * a hyphenated word, or a gap wider than MAX_GAP_RATIO.
 */
export function justifyParagraph(host: HTMLElement) {
  // Measure: get the words and their widths in the paragraph's font.
  const width = host.clientWidth;
  const words = splitWords(host);

  if (!words || words.length < 4 || width <= 0) {
    return;
  }

  const { space, widths } = measure(host, words);

  if (space <= 0 || widths.some((value) => value <= 0)) {
    return;
  }

  // Fit: let the engine choose the line breaks and the spacing.
  const texts = words.map((word) => word.map((run) => run.text).join(""));
  const widthOf = new Map(texts.map((text, index) => [text, widths[index]]));

  // The engine measures " " to get the natural space.
  const measureText = (text: string) =>
    text === " " ? space : (widthOf.get(text) ?? 0);

  const prepared = prepare(texts.join(" "), measureText);

  if (prepared.words.length !== words.length) {
    return;
  }

  const { lines } = solve(prepared, width);

  if (
    lines.length < 2 ||
    lines.some(
      (line) =>
        line.startOffset !== undefined ||
        line.endOffset !== undefined ||
        (!line.last && line.wordSpacing > space * (MAX_GAP_RATIO - 1)),
    )
  ) {
    return;
  }

  // Render: a space between rows keeps copied text apart; the layout drops it.
  host.replaceChildren(
    ...lines.flatMap((line, index) => {
      const row = toRow(words, line);

      return index > 0 ? [" ", row] : [row];
    }),
  );
}
