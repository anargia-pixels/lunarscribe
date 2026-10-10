import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, lazy, Suspense } from "react";

import { pageHead } from "@/lib/seo";

// The editor reads browser storage while its modules load, so it never renders on the server.
// The server build drops the import, which keeps the editor out of the Worker bundle.
const EditorLayout = lazy<ComponentType>(() =>
  import.meta.env.SSR
    ? Promise.resolve({ default: () => null })
    : import("./editor-layout"),
);

export const Route = createFileRoute("/app")({
  head: () =>
    pageHead({
      title: "Lunarscribe web app",
      description:
        "Write markdown with tables, math, links and Excalidraw drawings in your browser. Notes stay in your browser's storage.",
      path: "/app",
    }),
  ssr: false,
  component: () => (
    <Suspense>
      <EditorLayout />
    </Suspense>
  ),
});
