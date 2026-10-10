import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lunarscribe: markdown that looks like writing" },
      {
        name: "description",
        content:
          "A markdown writing app for Linux and macOS with a WYSIWYG editor, tables, math, links, Excalidraw drawings and syncing.",
      },
    ],
  }),
  component: LandingPage,
});
