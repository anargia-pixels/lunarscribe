<!-- prettier-ignore-start -->
# Lunarscribe glossary

Lunarscribe is a desktop markdown writing app. This glossary covers writing in
the editor, the app's interface, and the words used for the codebase.

## Language

### Product

**Lunarscribe**:
The product and the name of the Electron desktop app.
_Avoid_: desktop (as the app's name), the editor app

**Desktop app**:
The Electron build of Lunarscribe in `apps/desktop`, where writing happens.
_Avoid_: client, native app

**Web app**:
The TanStack Start app in `apps/web`, currently boilerplate.
_Avoid_: website, frontend

### Writing

**Buffer**:
One open piece of writing: a title and its markdown, held in memory by the
desktop app. A buffer is never written to disk.
_Avoid_: file, document, note, tab

**Active buffer**:
The buffer currently loaded into the markdown editor.
_Avoid_: current file, open document

**Buffer title**:
The name of a buffer, edited in the header input.
_Avoid_: file name, document name

**Markdown**:
The text form of a buffer and its source of truth; the editor loads it and
writes it back on every change.
_Avoid_: content, body, source

**Markdown editor**:
The WYSIWYG Lexical editor that renders markdown as rich text while you type.
_Avoid_: text editor, rich text editor, textarea

**Markdown shortcut**:
Markdown syntax typed at the start of a block or around text (`## `, `> `,
`**bold**`) that the editor converts to formatting on the spot.
_Avoid_: autoformat, markdown syntax

**Inline format**:
A style applied to a run of text: bold, italic, strikethrough, or inline code.
_Avoid_: text style, mark

**Block type**:
The kind of a whole block: paragraph, heading, quote, code block, bulleted
list, or numbered list.
_Avoid_: block format, paragraph style

### Interface

**Header**:
The bar across the top of the sidebar inset holding the sidebar trigger, the
buffer title input, and the theme toggle.
_Avoid_: titlebar, navbar, top bar

**Toolbar**:
The row of formatting controls below the header: history, inline formats, and
block types.
_Avoid_: titlebar, header buttons, menu bar

**Sidebar**:
The collapsible panel on the left of the window, currently empty.
_Avoid_: drawer, nav, side panel

**Sidebar inset**:
The main area beside the sidebar; it holds the header, toolbar, and markdown
editor.
_Avoid_: main content, body, page area

**Sidebar trigger**:
The header button that opens and collapses the sidebar.
_Avoid_: hamburger, menu button

**Separator**:
The shadcn `Separator` component, a thin divider placed between controls.
A separator is distinct from the sidebar border.
_Avoid_: divider, border, rule

**Sidebar border**:
The edge line where the sidebar meets the sidebar inset.
_Avoid_: separator, divider

**Theme**:
The color scheme: light (a warm paper palette) or dark (Catppuccin Mocha).
_Avoid_: mode, skin, color mode

**Theme toggle**:
The header button that flips between light and dark themes in one click.
_Avoid_: mode toggle, theme dropdown, theme picker

### Codebase

**Shadcn component**:
A generated shadcn (Base UI) primitive in `packages/components/src/components/ui`.
_Avoid_: UI kit, primitive, native element

**Shared component**:
A hand-written, non-shadcn component in `packages/components` used by more
than one app; it takes props and callbacks and holds no app state.
_Avoid_: common component, widget

**Shared lib**:
A framework-free helper in `packages/utils`, such as `cn`, `tryCatch`, or the
self-hosted fonts.
_Avoid_: helper package, lib, common

**Catalog**:
The dependency version list in the root `package.json`; workspaces reference
it with `catalog:`.
_Avoid_: version map, shared versions

<!-- prettier-ignore-end -->
