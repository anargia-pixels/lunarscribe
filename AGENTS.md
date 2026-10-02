# Lunarscribe

Bun + Turborepo monorepo. Versions live in the root `package.json` catalog; workspaces
reference them with `catalog:`. When naming a concept in code, UI copy, docs or
conversation, use the terms in [GLOSSARY.md](GLOSSARY.md).

## Layout

- `apps/desktop`: Electron + React via electron-vite. Next.js-style `src/`:
  `app/layout.tsx` and `app/page.tsx` are the shell, `electron/` holds main and preload,
  `stores/` holds zustand stores, `themes/` holds the color theme catalog.
- `apps/web`: TanStack Start, kept as generator boilerplate until asked otherwise.
- `packages/components`: shared UI. `src/components/ui/` is shadcn (Base UI),
  `src/components/<feature>/` holds shared non-shadcn components (the Lexical markdown
  editor), `src/styles/globals.css` is the theme both apps import.
- `packages/utils`: shared libs (`cn`, `tryCatch`, self-hosted fonts).
- `tools/oxlint`: custom lint rules, including `anti-slop/*`.

## Conventions

- Every file name is lowercase kebab-case, components included.
- UI uses shadcn components from `@lunarscribe/components/ui/*` for every button, input,
  separator and other control; plain `div`/`span`/`header` only for layout.
- Shared components stay state-agnostic: they take props and callbacks, and app state
  (zustand) is wired in the app.
- Desktop buffers live in memory in zustand; markdown is never written to disk.
- Theme: light palette is user-defined, dark is Catppuccin Mocha. Fonts are Poppins and
  Roboto Mono, bundled from `packages/utils/src/fonts` so they render offline.
- Change only what the request names. When a UI term is ambiguous (which separator, which
  buttons), ask before editing.
- Commit on the current branch. Ask before creating a new branch.

## shadcn

Run `bunx shadcn add <name>` inside `packages/components`. The CLI imports `cn` from the
`cn` package: rewrite that to `@lunarscribe/utils/cn` and remove the `"cn"` dependency it
adds.

## Verify

`bun run format`, `bun run lint`, `bun run check-types`, plus `bun run build` for
cross-package changes. Oxlint is the coding standard: fix diagnostics in the code, never
suppress them. Verify with these checks only; open a browser just when asked.

## Gotchas

- An inherited `ELECTRON_RUN_AS_NODE=1` makes Electron fail with "does not provide an
  export named BrowserWindow"; launch with `env -u ELECTRON_RUN_AS_NODE`.
- `bunfig.toml` blocks packages newer than 7 days; add exemptions to
  `minimumReleaseAgeExcludes`.
