import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, lazy, Suspense } from "react";

// The editor reads browser storage while its modules load, so it never renders on the server.
// React.lazy replaces the router's lazyRouteComponent, which calls use() conditionally.
// The server build drops the import, which keeps the editor out of the Worker bundle.
const App = lazy<ComponentType>(() =>
  import.meta.env.SSR
    ? Promise.resolve({ default: () => null })
    : import("@/app/app"),
);

export const Route = createFileRoute("/app")({
  ssr: false,
  component: () => (
    <Suspense>
      <App />
    </Suspense>
  ),
});
