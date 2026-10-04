import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The editor reads browser storage while its modules load, so it never renders on the server.
// React.lazy replaces the router's lazyRouteComponent, which calls use() conditionally.
const App = lazy(() => import("@/app/app"));

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <Suspense>
      <App />
    </Suspense>
  ),
});
