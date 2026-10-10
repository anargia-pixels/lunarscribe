import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, lazy, Suspense } from "react";

// Loaded in the browser only, like the layout; see layout.tsx.
const EditorPage = lazy<ComponentType>(() =>
  import.meta.env.SSR
    ? Promise.resolve({ default: () => null })
    : import("./editor-page"),
);

export const Route = createFileRoute("/app/")({
  component: () => (
    <Suspense>
      <EditorPage />
    </Suspense>
  ),
});
