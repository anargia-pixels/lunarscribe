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

### Storage

Use these exact names in code, UI copy, docs, and conversation. The
_Strictly avoid_ lists prohibit aliases for the corresponding concept.
Keep Electron API identifiers in their exact form when referring to an API.

**Application data base folder**:
The shared per-user folder returned by `app.getPath("appData")`.
On Linux, it is `$XDG_CONFIG_HOME` when set, or `~/.config/` otherwise.
On macOS, it is `~/Library/Application Support/`. Here, `~` means the
current user's home directory. By default, Electron appends the app's
name to this base to create the app data folder.
_Strictly avoid_: app data folder, binary folder, app path, install folder
(as names for this base folder)

**App data folder**:
The folder for Lunarscribe's settings, persistent app state, sync state,
and saved user credentials. Credentials include OAuth access and refresh
tokens. Store credentials as JSON with owner-only file permissions. Code must
get this folder with `app.getPath("userData")`. Build paths to files and subfolders from
this returned path. Do not hardcode the folder or construct it from a
home directory, environment variable, or application name. Its default path is
`<application data base folder>/<app-name>/`, where `<app-name>` is
Electron's application name. App updates preserve this folder. Saved
markdown and drawings use `lunarscribe/` inside the system Documents folder.
_Strictly avoid_: application data base folder, `appData`, binary folder,
app path, install folder, Documents folder, app folder
(as names for Lunarscribe's app data folder). Hardcoded paths and manual
construction of the app data folder path are prohibited.

**Binary folder**:
The folder for the installed Lunarscribe executable and all libraries,
resources, and supporting files required to run it. Its location is the
app path defined below. The installer replaces this folder during an app
update. Settings and saved credentials belong in the app data folder.
_Strictly avoid_: app data folder, application data base folder,
application data folder, `appData`, `userData`, Documents folder, app folder
(as names for the installed binary folder)

**App path**:
The filesystem path to the installed binary folder. The installer stores
this value in `APP_PATH`. The default is `~/.local/lunarscribe.app/` on
Linux and `~/Applications/Lunarscribe.app/` on macOS. On Linux,
`LUNARSCRIBE_INSTALL_DIR` sets the app path. On macOS, it sets the parent
folder, and the installer appends `Lunarscribe.app`. The Linux executable
is at `<app path>/lunarscribe`. Electron's `app.getAppPath()` returns the
loaded application code location and is a separate API.
_Strictly avoid_: app data path, user data path, application data base folder,
executable path, `app.getPath("appData")`, `app.getPath("userData")`,
`app.getAppPath()` (as names for the installer's app path)

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

**Settings window**:
The dialog that holds Lunarscribe's settings, filling 80% of the app window.
It pairs the settings sidebar with the settings of the open section.
Also: settings dialog.
_Avoid_: preferences, settings modal, options

**Settings sidebar**:
The panel on the left of the settings window listing its sections. It never
collapses.
_Avoid_: settings menu, settings nav, preferences sidebar

**Theme**:
The color scheme: light (a warm paper palette) or dark (Catppuccin Mocha).
_Avoid_: mode, skin, color mode

**Color theme**:
A named set of colors applied on top of a theme, so the same theme can look
like Modern Minimal or Catppuccin. The settings window picks one per theme
under Appearances; "Reset to defaults" clears both, leaving the colors in
`globals.css`. The colors tweakcn ships are the catalog.
_Avoid_: mode, dark mode, skin, color mode, theme preset, palette

**Dark mode toggle**:
The header button that flips between light and dark themes in one click. It is
the only way the theme changes in Lunarscribe. It never changes the color
theme.
_Avoid_: mode toggle, theme toggle, dark switch, theme dropdown, theme picker

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
