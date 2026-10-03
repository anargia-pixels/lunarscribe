# Lunarscribe

Lunarscribe is a desktop markdown writing app for Linux and macOS. The markdown editor
shows formatted text as you type. The app has a formatting toolbar, local file storage,
Excalidraw drawings, and PDF and DOCX export.

## Features

- **Markdown editor:** Markdown shortcuts apply headings, quotes, bulleted lists, numbered
  lists, checkbox lists, code blocks, links, and horizontal rules. Code blocks show syntax
  highlighting.
- **Checkbox lists:** Completed items move below incomplete items. An animation shows the
  change in item order.
- **Inline formats:** The editor supports bold, italic, underline, strikethrough,
  superscript, subscript, and inline code. The toolbar shows the inline formats of the
  selected text. It also has undo and redo controls.
- **Tables:** The toolbar has a control to insert tables. The editor also loads markdown
  tables. Each cell has an action menu to insert or delete rows and columns, or delete the
  table. A right-click in a cell opens the same actions. Wide tables have horizontal
  scroll controls inside the editor.
- **Math:** KaTeX shows LaTeX equations as inline math or math blocks. The toolbar has
  controls to insert both types. The editor also converts `$...$`, `$$...$$`, and pasted
  markdown equations to math. You can edit the LaTeX source of a selected equation.
- **Drawings:** The app has an Excalidraw canvas to create and edit drawings. Lunarscribe
  saves drawing scenes as local `.draw` files.
- **Local storage:** Lunarscribe automatically saves changes two seconds after the last
  edit. The save shortcut saves the active buffer immediately. When the app starts, it
  opens the last selected saved file.
- **External files:** The editor opens `.md`, `.markdown`, and `.txt` files. You can drag
  files into the markdown editor or give their paths to the desktop app. Packaged apps
  support file associations and `lunarscribe://open?path=...` links. Lunarscribe saves
  changes to the original file.
- **Sidebar:** The sidebar has Notes, Drawings, and External files sections. Each section
  shows its file count and has separate scroll controls. The app keeps the sidebar
  visibility and section settings between app starts. File actions are Rename, Copy path,
  Delete for saved files, and Remove for external entries. Delete requires confirmation.
- **Search:** Find shows matching text in the active buffer. It has controls for case
  matching, whole-word matching, and the next and previous matches. The fff search finds
  saved files by name or text. Results show highlighted matches and line previews.
- **PDF and DOCX export:** The sidebar has actions to export text files. For an open
  buffer, exports use the current edits. Exports use the selected theme and fonts. They
  keep formatted text, tables, code, and equations.
- **Appearance:** The default themes are a warm paper light theme and Catppuccin Mocha
  dark theme. Each theme can have a separate color theme. The interface, buffer writing,
  and code can use different fonts. Available fonts are Poppins, Roboto Mono, Pixelify
  Sans, and installed system fonts. The app keeps appearance settings between app starts.
- **Offline use:** The app includes its fonts, KaTeX fonts, and Excalidraw fonts. These
  fonts support writing, equations, and drawings without a network connection.

## Install

The installer downloads the latest release for your operating system and architecture. It
checks the SHA-256 checksum before installation. It does not require Bun or Node.js.

| Operating system | Architecture        | Release format | Default install location         |
| ---------------- | ------------------- | -------------- | -------------------------------- |
| Linux            | x86_64              | ZIP            | `~/.local/lunarscribe.app/`      |
| macOS            | Intel x86_64        | DMG            | `~/Applications/Lunarscribe.app` |
| macOS            | Apple Silicon arm64 | DMG            | `~/Applications/Lunarscribe.app` |

The installer requires Bash, curl, and jq. Linux also requires `sha256sum` and `unzip`.
macOS provides the other required commands.

On Linux, the ZIP includes the executable and its required files and folders. The
installer extracts them to `~/.local/lunarscribe.app/`. It installs the desktop entry at
`~/.local/share/applications/lunarscribe.desktop`. If you set `XDG_DATA_HOME`, the desktop
entry uses that directory's `applications/` folder.

This repository is private. Use a GitHub token with read access to the repository and its
releases. With an authenticated GitHub CLI, run these commands:

```sh
export GH_TOKEN="$(gh auth token)"
curl -fsSL \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github.raw+json" \
  "https://api.github.com/repos/anargia-pixels/lunarscribe/contents/install.sh?ref=main" | bash
```

You can also set `GH_TOKEN` to an existing token before the curl command. Repeat the
installer command to update the app. On Linux, the installer replaces the app folder.

On Linux, select Lunarscribe in your application menu. You can also run
`~/.local/lunarscribe.app/lunarscribe`. On macOS, open `~/Applications/Lunarscribe.app`.

The macOS releases use ad-hoc signatures. They do not have Apple notarization. macOS can
require approval in System Settings → Privacy & Security before the first start.

Set `LUNARSCRIBE_INSTALL_DIR` to change the install location. On Linux, this path is the
app folder. On macOS, this path is the folder that contains `Lunarscribe.app`. Set
`LUNARSCRIBE_VERSION` to a release tag, such as `v0.0.13`, to install that version. Export
these variables before the installer command.

You can also download the ZIP or DMG from
[GitHub Releases](https://github.com/anargia-pixels/lunarscribe/releases). The release
includes `install.sh` and `sha256sums.txt`.

## Run from source

Use Linux or macOS with Bun 1.3.14. The root `package.json` specifies this Bun version.
The app does not support Windows yet.

```sh
git clone https://github.com/anargia-pixels/lunarscribe.git
cd lunarscribe
bun install
env -u ELECTRON_RUN_AS_NODE bun run dev:desktop
```

The desktop development command installs the Electron runtime before it starts the app.
The `env -u ELECTRON_RUN_AS_NODE` command removes this environment variable for the app
process. If this variable is set, Electron can run as Node.js instead of the desktop app.

## Use Lunarscribe

1. Select the new markdown buffer button in the sidebar. This button creates a buffer for
   writing.
2. Type markdown shortcuts or use the toolbar to apply formats. For example, type `## `
   for a heading or `> ` for a quote.
3. Press `Ctrl+S` on Linux or `Cmd+S` on macOS to save the active buffer immediately. The
   app also automatically saves changes after two seconds without edits.
4. Select a saved entry in the sidebar to open it.

To create a drawing, select New drawing in the sidebar.

To edit an external text file, drag it into the markdown editor. The file appears under
External files. The app saves edits to the original path.

To rename a file:

1. Open the file's action menu with a right-click or the ellipsis button.
2. Select Rename.
3. Enter the new name in the dialog.
4. Confirm the new name.

To export a text file:

1. Open the file's action menu with a right-click or the ellipsis button.
2. Select Export as PDF or Export as DOCX.
3. Select the destination in the save dialog.
4. Save the export.

To change color themes and fonts, open Settings → Appearances. To change between the light
and dark themes, use the dark mode toggle in the sidebar.

### Markdown extensions

Lunarscribe uses the syntax below for inline formats and math. Other markdown readers can
show different results for this syntax.

| Syntax                    | Format        |
| ------------------------- | ------------- |
| `**bold**`                | Bold          |
| `*italic*`                | Italic        |
| `__underline__`           | Underline     |
| `~~strike~~`              | Strikethrough |
| `^superscript^`           | Superscript   |
| `~subscript~`             | Subscript     |
| `$x^2$`                   | Inline math   |
| `$$x^2$$` on its own line | Math block    |

To insert a math block with multiple lines:

1. Type `$$` on a separate line.
2. Press Enter.
3. Enter the LaTeX source.

To insert a horizontal rule, type `---` on a separate line and press Enter.

### Keyboard shortcuts

| Action                | Linux    | macOS         |
| --------------------- | -------- | ------------- |
| Save active buffer    | `Ctrl+S` | `Cmd+S`       |
| Find in active buffer | `Ctrl+F` | `Cmd+F`       |
| Search saved files    | `Ctrl+E` | `Ctrl+E`      |
| Bold                  | `Ctrl+B` | `Cmd+B`       |
| Italic                | `Ctrl+I` | `Cmd+I`       |
| Underline             | `Ctrl+U` | `Cmd+U`       |
| Undo                  | `Ctrl+Z` | `Cmd+Z`       |
| Redo                  | `Ctrl+Y` | `Cmd+Shift+Z` |

In Find, press Enter to select the next match. Press Shift+Enter to select the previous
match. Press Escape to close Find.

In saved-file search, use the arrow keys to select a result. Press Enter to open the
selected file. Select Content to search for text inside saved files.

Saved-file search shows a maximum of ten results from the Lunarscribe documents folder. It
does not search external files.

### Where writing is saved

Lunarscribe saves new markdown buffers as `.md` files and drawings as `.draw` files. These
files are in the `lunarscribe/` folder inside the system Documents folder. The usual path
is `~/Documents/lunarscribe/`.

For a new empty buffer, the save shortcut creates an empty file. An automatic save creates
the file after you add writing or drawing data.

External text files stay at their original paths. Remove saves pending edits and removes
the external entry from the sidebar. The file stays on disk. After confirmation, Delete
removes a saved file from the Lunarscribe documents folder.

Refer to [File saving, renaming, and removal](docs/001-file-saving.md) for save behavior
and file operation details.

## Development

The project uses Bun and Turborepo to manage its workspaces. It uses React, TypeScript,
Electron, Lexical, Tailwind CSS, and shadcn components.

| Location              | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `apps/desktop`        | Electron desktop app, app state, themes, and file operations |
| `apps/web`            | TanStack Start generator boilerplate                         |
| `packages/components` | Shared UI, markdown editor, and drawing editor               |
| `packages/utils`      | Shared libs and bundled fonts                                |
| `tools/oxlint`        | Custom lint rules                                            |

Run the repository checks from the project root:

```sh
bun run format
bun run lint
bun run check-types
```

To build release packages, run the command for the target operating system:

```sh
bun run package:linux
bun run package:macos:x64
bun run package:macos:arm64
```

Run the macOS commands on the corresponding Mac architecture. Packages are in
`apps/desktop/dist/`. A version tag, such as `v0.0.13`, starts the GitHub Actions release
workflow. The workflow builds all three packages and publishes them with their checksums.

The root `package.json` catalog specifies dependency versions. Workspaces use `catalog:`
references. Refer to [AGENTS.md](AGENTS.md) for repository conventions. Refer to
[GLOSSARY.md](GLOSSARY.md) for product and codebase terms.
