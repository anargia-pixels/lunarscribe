# Justified legal text

The privacy policy and terms of service pages in the web app show justified paragraphs.
Each paragraph has straight left and right edges. The web app uses `@kitlangton/justice`
(version 0.3.2) to select the line breaks and the spacing.

Justice is only a numerical engine. It does not measure text, and it does not change the
DOM. The web app measures the words in the browser and gives the widths to justice. Then
the web app writes the lines that justice returns.

## User-visible behavior

Justified paragraphs have straight left and right edges. The last line of a paragraph
stays ragged. Headings and lists keep the usual ragged wrap.

Some paragraphs keep the usual ragged wrap. This occurs when a paragraph has fewer than
four words or fits on one line. It also occurs when a line must break inside a hyphenated
word. A paragraph also stays ragged when one gap is more than two natural spaces wide.
Large gaps look like holes, not even text.

The text stays real text. Users can select it, copy it, and find it with the browser
search. Copied text keeps the spaces between words and between lines.

The ragged text does not show before the justified text. The paragraphs stay hidden until
the first fit is complete. Without script, the paragraphs show immediately. If the fit
does not complete in 2 seconds, the paragraphs show with the ragged wrap.

When the page width changes, the paragraphs fit again to the new width. A click on a link
in the same site uses client-side navigation. Thus the page does not load again.

## Design boundary

These files contain the feature:

- `apps/web/src/lib/legal/justify.ts` fits one paragraph.
- `apps/web/src/lib/legal/use-justified-paragraphs.ts` is the React hook. It starts each
  fit and sends link clicks to the router.
- `apps/web/src/components/legal-document.tsx` attaches the hook to `<main>`. It also sets
  `data-justify="pending"` in the server HTML.
- `apps/web/src/app/globals.css` hides the pending paragraphs.

The legal pages use `<Link>` from the router for all links. A link has no class. The
shared `globals.css` gives all links the link style.

## Fit of one paragraph

`justifyParagraph` fits one paragraph in four steps.

1. Split. The function reads the child nodes of the paragraph. It splits the text into
   words at ASCII whitespace. A word is a list of runs. A run is text and the inline
   element that holds it, such as a link or a code chip. If the paragraph has a nested
   element or a block element, the function stops. Then the paragraph does not change.
2. Measure. The function adds one hidden box to the paragraph. The box holds one inline
   block for the space and one inline block for each word. The function reads all widths
   in one pass and then removes the box. The words use the font of the paragraph. The
   width of a code chip includes its padding.
3. Solve. The function gives the text and the widths to `prepare`. Justice asks for the
   width of `" "` to get the natural space. Then `solve` returns the lines for the width
   of the paragraph. The function rejects a bad layout. The "User-visible behavior"
   section gives the rules.
4. Render. The function replaces the content of the paragraph. Each line is a `<span>`
   with `display: block` and `white-space: nowrap`. The span gets the `word-spacing`,
   `letter-spacing`, and negative left margin from justice. The README of justice
   specifies this rendering contract.

A link can cross a line break. Each line then holds a shallow copy of the link element. A
space between two words of one link stays in the link. Thus the underline does not break
between the words.

A plain space goes between two line spans. The layout removes this space, but copied text
and browser search keep it.

## Fit cycle

The hook runs in a layout effect. It keeps the original child nodes of each paragraph.
Before each fit, it puts the original nodes back. Thus each fit measures the same content.

The first fit waits for the Poppins font to load. Fallback font metrics give incorrect
line breaks. A `ResizeObserver` on `<main>` gives the content width. The hook fits again
only when this width changes. A fit changes the height of `<main>`, and this check
prevents a resize loop. All updates for one frame share one `requestAnimationFrame` call.

After the first fit, the hook removes `data-justify` from `<main>`. On unmount, the hook
stops the observer and the pending frame. Then it puts back the original nodes, so React
removes the nodes that it made.

## Links

The router `<Link>` attaches its click handler to its own `<a>` element. A line copy of
the link does not have this handler. Thus a click on a copy makes the browser load the
full page.

The hook adds one click listener to `<main>`. The listener sends a click on a same-site
link to the router. It does not change these clicks:

- A click that another handler cancelled.
- A click with a button other than the primary button.
- A click with the Ctrl, Meta, Shift, or Alt key.
- A click on a link with a `target` or a `download` attribute.
- A click on a link to a different site.

## Hidden first paint

The web app prerenders the legal pages. Thus the browser shows the server HTML before any
script runs. A hook cannot hide text that is already on the screen.

For this reason, the server HTML has `data-justify="pending"` on `<main>`. The CSS in
`apps/web/src/app/globals.css` hides `p` elements inside a pending `<main>`. The rule
applies only in `@media (scripting: enabled)`. A CSS animation shows the paragraphs after
2 seconds, without script.

## Non-goals

- Lists, headings, and other pages are not justified.
- The feature does not hyphenate words. It does not use a hyphenation dictionary.
- The feature does not use `@kitlangton/justice/static`. A build-time fit needs font
  measurements during the build.
- Only left-to-right text with one font is supported.

## Validation and acceptance

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build` to
validate changes.

These checks were done with agent-browser on the web app dev server:

- At 1280 px and at 420 px, no line goes past the paragraph edge.
- On `/privacy`, 10 of 14 paragraphs are justified. On `/terms`, 8 of 10 are justified.
- Selected text keeps the spaces between words.
- A frame recording on the built site showed no frame with ragged visible text.
- With script blocked, the paragraphs show after 2 seconds.
- The `/privacy` link on `/terms` uses client-side navigation.
- A code chip and a link that crosses a line break render correctly.

Acceptance requires straight edges on justified paragraphs and no text past the column.
Copy and search must keep the spaces. The ragged text must not show before the fit.
Same-site links must not load the full page.
