# Custom caret

The markdown editor uses one visual caret for markdown text and block boundaries. Mermaid
and math source fields retain native carets. This addresses a missing caret near block
diagrams and gives the markdown editor a consistent blink.

The browser selection and Lexical selection still determine where text is inserted. The
custom caret only displays that position. It does not move the selection or change buffer
markdown.

## User-visible behavior

The caret has a smooth opacity blink. A selection change or edit restarts the blink.
Position changes apply immediately, so the caret does not animate toward a previous
insertion point. Reduced-motion settings show a steady caret.

The custom caret hides when focus leaves the markdown text, text is selected, the editor
becomes read-only, or composition input starts. Mermaid and math source fields use native
carets with their own selections. Composition input also uses the native caret.

The markdown editor has `pb-48` trailing space inside its editable area. Users can scroll
past the last block and click in the extra space to continue writing. This spacing does
not insert blank paragraphs or change markdown.

## Placement

`CaretPlugin` mounts one overlay beside the editable root, inside a positioned container.
The overlay ignores pointer events and is hidden from assistive technology. Its position
comes from the browser's collapsed selection range.

`caret-geometry.ts` reads range rectangles and clips them against scrollable ancestors.
The existing line break supplies the rectangle for an empty paragraph. At a block
boundary, Lexical's block cursor supplies the position. The editor theme gives that cursor
a visible fallback style.

Only a measured position enables the CSS that hides the native caret. Ambiguous range
rectangles, including some bidirectional text boundaries, retain native caret rendering.
The plugin does not insert measurement text or mirror the buffer's text.

## Updates and lifecycle

Selection changes, editor updates, scrolling, resizing, font loading, and theme changes
schedule an update. Multiple events share one animation frame. Geometry reads run before
overlay writes. Position and height are written only when their values change.

The plugin caches clipping and layout ancestors for the focused element. It refreshes the
cache when focus changes, the root changes, theme styles change, or the editor's DOM
structure changes. Structural invalidation is needed because Lexical can move the same
focused text element into a different block.

Blinking uses one browser animation and does not require React renders or an idle frame
loop. A running animation on a focused ancestor can require successive position updates.
Those updates stop when the ancestor animation ends. Ordinary text edits keep the ancestor
cache when the DOM structure stays unchanged.

On unmount, the plugin cancels the pending frame and blink animation, disconnects its
observers, removes its listeners, and restores native caret visibility. A disposal guard
prevents cleanup from scheduling another frame. The overlay is outside the editable root,
so markdown export and buffer updates do not include it.

## Validation and acceptance

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build` to
validate changes. Interactive placement checks and performance profiling have not been
run.

Acceptance requires a visible caret on empty lines before and after Mermaid or math
blocks. Wrapped text, formatted text, code blocks, and table cells must use the actual
insertion position. Horizontal scrolling must clip the overlay within its scroll area.
Block conversion and checklist movement must refresh or follow the position. Source
fields, composition input, text selection, and focus changes must retain their expected
native behavior. Switching buffers must remove the previous overlay and its listeners.
