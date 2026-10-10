import { Button } from "@lunarscribe/components/ui/button";
import { Separator } from "@lunarscribe/components/ui/separator";
import { cn } from "@lunarscribe/utils/cn";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download } from "lucide-react";
import type { ReactNode } from "react";

import { Galaxy } from "@/components/landing/galaxy";
import { InstallCommand } from "@/components/landing/install-command";
import { TextType } from "@/components/landing/text-type";

// Router links take external URLs at runtime; plain strings keep them off the typed route list.
const EXTERNAL_LINKS = {
  repository: "https://github.com/anargia-pixels/lunarscribe",
  releases: "https://github.com/anargia-pixels/lunarscribe/releases/latest",
  fff: "https://github.com/dmtrKovalenko/fff",
  lexical: "https://lexical.dev/docs/intro",
};

const HEADLINE = "An Obsidian OSS alternative";

function InlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** Screenshots of the web app, captured at 1920×1200. */
const SHOWCASE = [
  {
    title: (
      <>
        <InlineLink to={EXTERNAL_LINKS.lexical}>Lexical</InlineLink> powered
        markdown editor
      </>
    ),
    description: "Local first OSS alternative to Obsidian.",
    image: "/landing/context-menu.webp",
    alt: "The editor context menu with the Paragraph submenu open",
  },
  {
    title: "Zen mode",
    description:
      "Hide the toolbar and the sidebar, and it's just you and the page. Every format and insert is still a right-click away.",
    image: "/landing/zen.webp",
    alt: "The markdown editor with the toolbar hidden and the sidebar collapsed",
  },
  {
    title: "Drawings with Excalidraw",
    description:
      "An Excalidraw canvas for sketches and diagrams, saved as .draw files next to your markdown.",
    image: "/landing/drawing.webp",
    alt: "An Excalidraw drawing of an observing plan",
  },
  {
    title: "Math and Mermaid blocks",
    description:
      "KaTeX renders inline math and math blocks, and Mermaid blocks turn plain text into diagrams.",
    image: "/landing/math-mermaid.webp",
    alt: "An equation, a highlighted code block and a Mermaid flowchart",
  },
  {
    title: "Syncing and external files",
    description:
      "Sync saved notes and drawings with Google Drive or Dropbox, and with GitHub in the desktop app. Open .md and .txt files from anywhere and save straight back to them.",
    image: "/landing/syncing.webp",
    alt: "The Syncing settings with a provider to connect",
  },
  {
    title: (
      <>
        File search by <InlineLink to={EXTERNAL_LINKS.fff}>fff</InlineLink>
      </>
    ),
    description:
      "Search saved files by name or by the text inside them, with highlighted matches and line previews.",
    image: "/landing/search.webp",
    alt: "File search with matches for a query",
  },
  {
    title: "PDF and DOCX export",
    description:
      "Export any note with your theme and fonts, keeping tables, code and equations.",
    image: "/landing/export.webp",
    alt: "A file's action menu with Export as PDF and Export as DOCX",
  },
  {
    title: "Make it yours",
    description:
      "A warm paper light theme and Catppuccin Mocha dark theme, color themes for each, and separate fonts for the interface, writing and code. More to come.",
    image: "/landing/editor-light.webp",
    alt: "The markdown editor in the light theme",
  },
] as const;

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={1920}
      height={1200}
      loading="lazy"
      className="ring-foreground/10 w-full rounded-xl shadow-2xl ring-1"
    />
  );
}

/** The marketing page at `/`; the web app itself lives at `/app`. */
export function LandingPage() {
  return (
    <div className="dark bg-sidebar text-foreground min-h-full">
      <div className="relative isolate">
        <Galaxy className="absolute inset-0 -z-10 mask-b-from-50%" />
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-logo text-primary text-3xl">Lunarscribe</span>
          <nav className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="max-sm:hidden"
              nativeButton={false}
              render={<Link to={EXTERNAL_LINKS.repository} />}
            >
              GitHub
            </Button>
            <Button nativeButton={false} render={<Link to="/app" />}>
              Open web app
            </Button>
          </nav>
        </header>

        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center">
            <h1 className="text-primary max-w-3xl text-5xl font-bold tracking-tight text-balance">
              <span className="sr-only">{HEADLINE}</span>
              <span aria-hidden>
                <TextType text={HEADLINE} durationMs={800} />
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
              Lunarscribe is a local first, open source markdown editor. Write
              with tables, math, links and Excalidraw drawings, and sync to
              where you want.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                nativeButton={false}
                render={<Link to="/app" />}
              >
                Open web app
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link to={EXTERNAL_LINKS.releases} />}
              >
                <Download data-icon="inline-start" />
                Linux ZIP and macOS DMG
              </Button>
            </div>
            <div className="flex w-full max-w-2xl flex-col items-center gap-2">
              <InstallCommand />
              <p className="text-muted-foreground text-sm">
                Installs or updates the desktop app on Linux x86_64 and Apple
                Silicon Macs, and checks the release's SHA-256 checksum.
              </p>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-6 pb-24">
            <img
              src="/landing/editor-dark.webp"
              alt="The markdown editor with frontmatter, a checklist and a table"
              width={1920}
              height={1200}
              className="ring-foreground/10 shadow-primary/20 w-full rounded-xl shadow-2xl ring-1"
            />
          </div>
        </section>
      </div>

      <main>
        <section className="mx-auto flex max-w-6xl flex-col gap-24 px-6 py-16">
          {SHOWCASE.map(({ title, description, image, alt }, index) => (
            <div
              key={image}
              className="grid items-center gap-10 md:grid-cols-5"
            >
              <div
                className={cn(
                  "md:col-span-2",
                  index % 2 === 1 && "md:order-last",
                )}
              >
                <h2 className="text-3xl font-semibold tracking-tight">
                  {title}
                </h2>
                <p className="text-muted-foreground mt-3 text-lg">
                  {description}
                </p>
              </div>
              <div className="md:col-span-3">
                <Screenshot src={image} alt={alt} />
              </div>
            </div>
          ))}
        </section>
      </main>

      <Separator />
      <footer className="text-muted-foreground mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm">
        <span className="font-logo text-primary text-xl">Lunarscribe</span>
        <Button
          variant="link"
          nativeButton={false}
          render={<Link to={EXTERNAL_LINKS.repository} />}
        >
          Source on GitHub
        </Button>
      </footer>
    </div>
  );
}
