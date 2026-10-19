# Large buffer performance

The markdown editor stays responsive with long buffers. It opens them quickly, and typing
and resizing do not lag. A resize of the window, the sidebar, or the outline sidebar keeps
a steady frame rate.

## Problem

Before this change, the cost of the markdown editor increased with the full length of the
buffer, not with the part on the screen:

- Each resize frame laid out every block again.
- Each resize frame measured every heading and moved every collapse toggle.
- The Button `transition-all` class animated each of those moves.
- Pele redrew every Mermaid diagram on each width change, also off-screen diagrams.
- Each keystroke rendered the page, the toolbar, the editor context menu, and the outline
  sidebar again, although their data did not change.

With a 174 KB buffer, one window resize step took 72 to 90 ms.

## Behavior

| Area                    | Behavior                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| Off-screen blocks       | The browser does not lay out or paint them until they come near the view. |
| Collapse toggles        | Only headings near the view have a toggle.                                |
| Toggle position         | CSS anchor positioning keeps a toggle next to its heading. No JS runs.    |
| Mermaid diagrams        | A diagram redraws 150 ms after its width stops changing.                  |
| Off-screen diagrams     | A diagram redraws when it comes near the view.                            |
| Typing                  | Only components with changed data render again.                           |
| Find, when closed       | Edits do not render the find panel.                                       |
| Outline, cursor changes | A selection change does not calculate the headings again.                 |

## Design

### Off-screen blocks

`globals.css` gives each top-level block of the markdown editor
`content-visibility: auto`. `contain-intrinsic-size: auto 1.75rem` keeps the last height
of a block for the scrollbar.

Rules:

- The rule applies only on the screen. PDF export prints all blocks.
- Lexical's block cursor does not get the rule, because its glyph is outside its box.
- Containment clips overflow. `overflow-clip-margin` keeps space for focus rings.
- Containment stops margin collapse into a block. Thus the first and last items of a
  top-level list have no outer margin. This keeps the spacing that lists had before.

### Collapse toggles

`heading-collapse-plugin.tsx` watches headings with an `IntersectionObserver` on the
scroll viewport of the editor. The root margin is 25%. This value is in the area that
`content-visibility` renders. An anchor on a skipped heading cannot place its toggle.

Each heading near the view gets an `anchor-name`. Its toggle uses that anchor in
`heading-collapse-plugin.css`. The plugin measures only the line height. It does this 150
ms after a resize stops, because a font change can change the line height. The toggle
animates only its colors, so it does not move behind its heading.

### Mermaid diagrams

`mermaid-preview.tsx` mounts Pele with `watch: false`. The component redraws itself:

- A width change starts a fit 150 ms after the last change.
- An appearance style change starts a full refresh.
- A diagram that is not near the view keeps the redraw until it comes near the view.
- A pending refresh is not replaced by a fit.

### Renders on each keystroke

- `page.tsx` selects the active buffer without its content. The editor reads the content
  one time, when it mounts.
- `app-outline-sidebar.tsx` selects only the buffer kind.
- The toolbar state keeps the same array while the active formats do not change.
- The find panel listens to edits only while it is open.
- The outline ignores updates that change only the selection.

## Scope

In scope: the markdown editor on desktop and on the web, the desktop page, and the outline
sidebar.

Not in scope:

- Markdown export on each keystroke. It takes about 10 ms for a 174 KB buffer. A delay can
  make a save use old text.
- The sidebar file list. It still renders again on each keystroke.

## Limits

- The scrollbar thumb can move a little when you scroll into a part that you did not see.
- A long jump from the outline or from find can stop a small distance from the target.
- On screen, Mermaid diagrams keep their old layout during a resize, and change when the
  resize stops.
- Anchor positioning needs a new browser engine. Electron supports it. Old browsers that
  use the web app show toggles in the wrong position.

## Validation and acceptance

Run `bun run format`, `bun run lint`, `bun run check-types`, and `bun run build`.

Measurements used a production build of the desktop renderer in headless Chrome, with a
174 KB buffer that has 185 headings and 83 Mermaid diagrams:

| Measurement                 | Before       | After                  |
| --------------------------- | ------------ | ---------------------- |
| Window resize step, median  | 72 to 90 ms  | 33 ms (test minimum)   |
| 40 resize steps, total      | 3.1 to 3.5 s | 1.5 s                  |
| Sidebar collapse and expand | Not measured | 16.7 ms frames, 60 fps |

With `content-visibility` turned off, one resize step takes 208 ms. Thus the block skip is
necessary for the result.

Acceptance:

- A resize of the window or a sidebar does not drop frames with a long buffer.
- Each toggle stays next to its heading during and after a resize.
- No toggle shows for a heading that is far from the view.
- Mermaid diagrams fit their width after a resize stops.
- PDF export includes all blocks.
- List spacing is the same as before.
