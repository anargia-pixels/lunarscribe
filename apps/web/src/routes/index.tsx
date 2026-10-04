import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

// The editor reads browser storage while its modules load, so it never renders on the server.
export const Route = createFileRoute("/")({
  ssr: false,
  component: lazyRouteComponent(() => import("@/app/app")),
});
